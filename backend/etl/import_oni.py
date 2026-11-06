"""Import de l'ONI (NOAA CPC) dans PostgreSQL.

Usage :
    python -m etl.import_oni                 # importe l'instantané versionné data/raw/oni.ascii.txt
    python -m etl.import_oni --download      # télécharge d'abord la dernière version NOAA

L'import est idempotent : relancé sur le même fichier, il n'insère rien de plus.
Les valeurs révisées par la NOAA sont mises à jour et rattachées au nouvel import.
"""

import argparse
import hashlib
import json
import logging
import os
import sys
import urllib.request
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import ClimateIndex, DataImport, Observation, Source
from etl.transform import parse_oni_text, transform

log = logging.getLogger("etl.oni")

DATA_DIR = Path(
    os.environ.get("ONI_DATA_DIR", Path(__file__).resolve().parents[2] / "data" / "raw")
)
RAW_FILE = DATA_DIR / "oni.ascii.txt"
META_FILE = DATA_DIR / "oni.metadata.json"
ONI_URL = "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"


def download(dest: Path, meta_file: Path = META_FILE) -> dict:
    """Télécharge le fichier NOAA et met à jour les métadonnées d'extraction."""
    with urllib.request.urlopen(ONI_URL, timeout=30) as resp:  # noqa: S310 (URL https constante)
        content = resp.read()
        last_modified = resp.headers.get("Last-Modified")
    dest.write_bytes(content)
    meta = json.loads(meta_file.read_text(encoding="utf-8"))
    meta.update(
        extracted_at=datetime.now(UTC).isoformat(timespec="seconds"),
        server_last_modified=last_modified,
        sha256=hashlib.sha256(content).hexdigest(),
    )
    meta_file.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return meta


def get_or_create_index(session: Session, meta: dict) -> ClimateIndex:
    index = session.scalar(select(ClimateIndex).where(ClimateIndex.code == "ONI"))
    if index:
        index.version = meta["dataset_version"]
        return index
    source = session.scalar(select(Source).where(Source.name == "NOAA CPC ONI"))
    if not source:
        source = Source(name="NOAA CPC ONI", organization=meta["organization"], url=meta["page"])
        session.add(source)
    index = ClimateIndex(
        code="ONI",
        name=meta["name"],
        unit="°C",
        version=meta["dataset_version"],
        description=(
            "Anomalie de température de surface de la mer dans la région Niño 3.4 "
            "(5°N-5°S, 170°W-120°W), moyenne glissante sur 3 mois."
        ),
        source=source,
    )
    session.add(index)
    session.flush()
    return index


def run(
    raw_file: Path = RAW_FILE, meta_file: Path = META_FILE, session_factory=SessionLocal
) -> DataImport:
    content = raw_file.read_bytes()
    meta = json.loads(meta_file.read_text(encoding="utf-8"))
    sha256 = hashlib.sha256(content).hexdigest()
    if sha256 != meta["sha256"]:
        log.warning("Empreinte différente des métadonnées : fichier modifié depuis l'extraction ?")

    result = transform(parse_oni_text(content.decode("utf-8")))

    # Une seule transaction : en cas d'erreur, rien n'est écrit (pas d'import partiel).
    with session_factory() as session, session.begin():
        index = get_or_create_index(session, meta)
        existing = {
            o.period: o
            for o in session.scalars(select(Observation).where(Observation.index_id == index.id))
        }
        data_import = DataImport(
            index=index,
            file_url=meta["file_url"],
            file_sha256=sha256,
            extracted_at=datetime.fromisoformat(meta["extracted_at"].replace("Z", "+00:00")),
            rows_read=result.rows_read,
            rows_inserted=0,
            rows_updated=0,
            rows_rejected=result.rows_rejected + result.duplicates_removed,
            status="success",
        )
        session.add(data_import)
        session.flush()

        for row in result.clean.itertuples(index=False):
            total, anomaly = Decimal(f"{row.total:.2f}"), Decimal(f"{row.anomaly:.2f}")
            current = existing.get(row.period)
            if current is None:
                session.add(
                    Observation(
                        index_id=index.id,
                        import_id=data_import.id,
                        season=row.season,
                        year=row.year,
                        period=row.period,
                        total=total,
                        anomaly=anomaly,
                    )
                )
                data_import.rows_inserted += 1
            elif current.anomaly != anomaly or current.total != total:
                current.total, current.anomaly = total, anomaly
                current.import_id = data_import.id
                data_import.rows_updated += 1

    log.info(
        "Import ONI terminé : lues=%s insérées=%s mises à jour=%s rejetées=%s",
        data_import.rows_read,
        data_import.rows_inserted,
        data_import.rows_updated,
        data_import.rows_rejected,
    )
    return data_import


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    parser = argparse.ArgumentParser(description="Import de l'ONI NOAA dans PostgreSQL")
    parser.add_argument("--download", action="store_true", help="télécharger la dernière version")
    args = parser.parse_args()
    if args.download:
        download(RAW_FILE)
    run()
    return 0


if __name__ == "__main__":
    sys.exit(main())
