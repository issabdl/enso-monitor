"""Chargement en base : idempotence et prise en compte des révisions NOAA."""

from sqlalchemy import func, select

from app.models import DataImport, Observation
from etl.import_oni import run
from tests.conftest import ANOMALIES, oni_text, write_raw


def test_import_is_idempotent(session_factory, raw_files):
    first = run(*raw_files, session_factory=session_factory)
    second = run(*raw_files, session_factory=session_factory)

    assert first.rows_inserted == 36
    assert (second.rows_inserted, second.rows_updated) == (0, 0)
    with session_factory() as session:
        assert session.scalar(select(func.count(Observation.id))) == 36
        assert session.scalar(select(func.count(DataImport.id))) == 2


def test_revised_value_is_updated_and_traced(session_factory, tmp_path):
    run(*write_raw(tmp_path, oni_text(ANOMALIES)), session_factory=session_factory)

    revised = {**ANOMALIES, 2002: [-0.6, *ANOMALIES[2002][1:]]}
    revision_dir = tmp_path / "revision"
    revision_dir.mkdir()
    second = run(*write_raw(revision_dir, oni_text(revised)), session_factory=session_factory)

    assert (second.rows_inserted, second.rows_updated) == (0, 1)
    with session_factory() as session:
        obs = session.scalar(
            select(Observation).where(Observation.year == 2002, Observation.season == "DJF")
        )
        assert float(obs.anomaly) == -0.6
        assert obs.import_id == second.id
