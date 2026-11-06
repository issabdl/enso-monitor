"""Transformations pures (sans base de données) du fichier ONI de la NOAA.

Format source (https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt) :

     SEAS  YR   TOTAL   ANOM
      DJF 1950  25.01  -1.32
"""

from dataclasses import dataclass
from io import StringIO

import pandas as pd

from app.models import SEASONS

# DJF est centrée sur janvier, JFM sur février, ..., NDJ sur décembre.
SEASON_CENTER_MONTH = {season: i + 1 for i, season in enumerate(SEASONS)}
EXPECTED_COLUMNS = ["SEAS", "YR", "TOTAL", "ANOM"]


@dataclass
class TransformResult:
    clean: pd.DataFrame
    rows_read: int
    rows_rejected: int
    duplicates_removed: int


def parse_oni_text(text: str) -> pd.DataFrame:
    """Lit le texte brut en DataFrame. Toutes les colonnes restent en texte à ce stade."""
    df = pd.read_csv(StringIO(text), sep=r"\s+", dtype=str)
    missing = [c for c in EXPECTED_COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"Format ONI inattendu, colonnes manquantes : {missing}")
    return df[EXPECTED_COLUMNS]


def transform(raw: pd.DataFrame) -> TransformResult:
    """Nettoie les lignes brutes.

    - rejette les saisons inconnues, années ou valeurs non numériques, valeurs hors bornes ;
    - calcule la période (mois central de la saison) ;
    - supprime les doublons (même période) en gardant la dernière occurrence du fichier.
    """
    df = raw.copy()
    rows_read = len(df)

    df["season"] = df["SEAS"].str.strip().str.upper()
    df["year"] = pd.to_numeric(df["YR"], errors="coerce")
    df["total"] = pd.to_numeric(df["TOTAL"], errors="coerce")
    df["anomaly"] = pd.to_numeric(df["ANOM"], errors="coerce")

    valid = (
        df["season"].isin(list(SEASON_CENTER_MONTH))
        & df["year"].between(1850, 2100)
        & df["total"].between(15, 35)
        & df["anomaly"].between(-5, 5)
    )
    df = df[valid].copy()
    rows_rejected = rows_read - len(df)

    df["year"] = df["year"].astype(int)
    df["period"] = pd.to_datetime(
        pd.DataFrame({"year": df["year"], "month": df["season"].map(SEASON_CENTER_MONTH), "day": 1})
    ).dt.date

    before = len(df)
    df = df.drop_duplicates(subset="period", keep="last")
    duplicates_removed = before - len(df)

    clean = (
        df[["season", "year", "period", "total", "anomaly"]]
        .sort_values("period")
        .reset_index(drop=True)
    )
    clean["total"] = clean["total"].round(2)
    clean["anomaly"] = clean["anomaly"].round(2)
    return TransformResult(clean, rows_read, rows_rejected, duplicates_removed)
