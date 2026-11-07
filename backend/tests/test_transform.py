"""Test de données : transformation Python des observations NOAA (doublons, lignes invalides)."""

from datetime import date

import pytest

from etl.transform import parse_oni_text, transform

RAW = """ SEAS  YR   TOTAL   ANOM
  DJF 1997  26.18  -0.50
  JFM 1997  26.44  -0.40
  JFM 1997  26.45  -0.39
  XYZ 1997  26.80  -0.20
  MAM 1997  27.80   abc
  AMJ 19x7  28.40   0.80
  NDJ 1997  28.70   2.40
"""


def test_transform_removes_duplicates_and_invalid_rows():
    result = transform(parse_oni_text(RAW))

    assert result.rows_read == 7
    # saison inconnue, valeur non numérique, année invalide
    assert result.rows_rejected == 3
    # JFM 1997 apparaît deux fois : la dernière ligne du fichier est conservée
    assert result.duplicates_removed == 1
    assert list(result.clean["season"]) == ["DJF", "JFM", "NDJ"]
    assert result.clean.loc[1, "anomaly"] == -0.39


def test_transform_computes_center_month_of_season():
    clean = transform(parse_oni_text(RAW)).clean

    # DJF 1997 = déc. 1996 + janv. + févr. 1997, centrée sur janvier 1997
    assert clean.loc[0, "period"] == date(1997, 1, 1)
    # NDJ 1997 = nov. + déc. 1997 + janv. 1998, centrée sur décembre 1997
    assert clean.loc[2, "period"] == date(1997, 12, 1)


def test_parse_rejects_unexpected_format():
    with pytest.raises(ValueError, match="colonnes manquantes"):
        parse_oni_text("YEAR VALUE\n1997 1.2\n")
