import hashlib
import json
import os

# Doit être défini avant l'import de l'application (la configuration l'exige).
os.environ.setdefault("DATABASE_URL", "sqlite://")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import get_db
from app.main import app
from app.models import SEASONS, Base
from etl.import_oni import run

# Jeu de données réduit et maîtrisé, au format exact du fichier NOAA.
# 2000 : El Niño de 9 saisons (FMA -> OND), pic +1,6 en JAS.
# 2001 : 4 saisons <= -0,5 seulement -> pas un épisode.
# 2002 : La Niña de 7 saisons (DJF -> JJA), pic -1,3 en MAM.
ANOMALIES = {
    2000: [0.1, 0.2, 0.6, 0.7, 0.8, 0.9, 1.2, 1.6, 1.4, 1.0, 0.7, 0.3],
    2001: [-0.6, -0.7, -0.8, -0.6, 0.0, 0.1, 0.2, 0.1, 0.0, -0.1, -0.2, -0.3],
    2002: [-0.5, -0.9, -1.1, -1.3, -1.0, -0.7, -0.5, -0.2, 0.0, 0.0, 0.0, 0.0],
}


def oni_text(anomalies: dict[int, list[float]]) -> str:
    lines = [" SEAS  YR   TOTAL   ANOM"]
    for year, values in anomalies.items():
        for season, value in zip(SEASONS, values, strict=True):
            lines.append(f"  {season} {year}  {26.5 + value:5.2f}  {value:5.2f}")
    return "\n".join(lines) + "\n"


def write_raw(tmp_path, text: str):
    raw = tmp_path / "oni.ascii.txt"
    raw.write_text(text, encoding="utf-8")
    meta = tmp_path / "oni.metadata.json"
    meta.write_text(
        json.dumps(
            {
                "name": "Oceanic Nino Index",
                "organization": "NOAA Climate Prediction Center (CPC)",
                "page": "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/oni/v6/index.php",
                "file_url": "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt",
                "dataset_version": "ONI v6 (ERSST.v6)",
                "extracted_at": "2026-11-08T00:30:00Z",
                "sha256": hashlib.sha256(raw.read_bytes()).hexdigest(),
            }
        ),
        encoding="utf-8",
    )
    return raw, meta


@pytest.fixture
def session_factory():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    yield sessionmaker(engine, expire_on_commit=False)
    engine.dispose()


@pytest.fixture
def raw_files(tmp_path):
    return write_raw(tmp_path, oni_text(ANOMALIES))


@pytest.fixture
def client(session_factory, raw_files):
    run(*raw_files, session_factory=session_factory)

    def override_get_db():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
