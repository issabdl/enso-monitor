from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import ClimateIndex, DataImport, Observation
from app.schemas import (
    CompareResponse,
    EpisodesResponse,
    ErrorOut,
    ImportOut,
    IndexOut,
    ObservationsResponse,
)
from app.services import episodes as ep

router = APIRouter(prefix="/indices", tags=["indices"])

MONTH_PATTERN = r"^\d{4}-(0[1-9]|1[0-2])$"
MAX_COMPARE_MONTHS = 120
NOT_FOUND = {404: {"model": ErrorOut, "description": "Indice inconnu"}}

Month = Annotated[
    str | None,
    Query(pattern=MONTH_PATTERN, description="Mois au format AAAA-MM", examples=["1997-01"]),
]
RequiredMonth = Annotated[str, Query(pattern=MONTH_PATTERN, description="Mois au format AAAA-MM")]


def parse_month(value: str | None) -> date | None:
    if value is None:
        return None
    year, month = value.split("-")
    return date(int(year), int(month), 1)


def check_range(start: date | None, end: date | None, label: str = "") -> None:
    if start and end and start > end:
        raise HTTPException(422, f"Période {label}invalide : le début est postérieur à la fin")


def get_index(db: Session, code: str) -> ClimateIndex:
    index = db.scalar(select(ClimateIndex).where(ClimateIndex.code == code.upper()))
    if index is None:
        raise HTTPException(404, f"Indice '{code}' inconnu")
    return index


def load_points(db: Session, index: ClimateIndex, start: date | None, end: date | None):
    query = select(Observation).where(Observation.index_id == index.id)
    if start:
        query = query.where(Observation.period >= start)
    if end:
        query = query.where(Observation.period <= end)
    return list(db.scalars(query.order_by(Observation.period)))


def to_points(observations) -> list[ep.Point]:
    return [ep.Point(o.period, o.season, o.year, float(o.anomaly)) for o in observations]


@router.get("", response_model=list[IndexOut], summary="Lister les indices disponibles")
def list_indices(db: Session = Depends(get_db)):
    result = []
    for index in db.scalars(select(ClimateIndex).order_by(ClimateIndex.code)):
        last_import = db.scalar(
            select(DataImport)
            .where(DataImport.index_id == index.id)
            .order_by(DataImport.imported_at.desc(), DataImport.id.desc())
            .limit(1)
        )
        first, last = db.execute(
            select(func.min(Observation.period), func.max(Observation.period)).where(
                Observation.index_id == index.id
            )
        ).one()
        out = IndexOut.model_validate(index)
        out.last_import = ImportOut.model_validate(last_import) if last_import else None
        out.first_period, out.last_period = first, last
        result.append(out)
    return result


@router.get(
    "/{code}/observations",
    response_model=ObservationsResponse,
    responses=NOT_FOUND,
    summary="Observations d'un indice, filtrées par période",
)
def list_observations(
    code: str, start: Month = None, end: Month = None, db: Session = Depends(get_db)
):
    start_date, end_date = parse_month(start), parse_month(end)
    check_range(start_date, end_date)
    index = get_index(db, code)
    observations = load_points(db, index, start_date, end_date)
    return ObservationsResponse(
        index=index.code,
        unit=index.unit,
        source=index.source,
        start=start_date,
        end=end_date,
        count=len(observations),
        observations=observations,
    )


@router.get(
    "/{code}/episodes",
    response_model=EpisodesResponse,
    responses=NOT_FOUND,
    summary="Épisodes El Niño / La Niña détectés",
)
def list_episodes(
    code: str,
    kind: Annotated[str | None, Query(pattern="^(el_nino|la_nina)$")] = None,
    db: Session = Depends(get_db),
):
    index = get_index(db, code)
    found = ep.detect_episodes(to_points(load_points(db, index, None, None)))
    if kind:
        found = [e for e in found if e.kind == kind]
    return EpisodesResponse(
        index=index.code,
        rule=ep.RULE,
        intensity_scale=ep.INTENSITY_SCALE,
        episodes=found,
    )


@router.get(
    "/{code}/compare",
    response_model=CompareResponse,
    responses=NOT_FOUND,
    summary="Comparer deux périodes (par exemple deux épisodes historiques)",
)
def compare_periods(
    code: str,
    a_start: RequiredMonth,
    a_end: RequiredMonth,
    b_start: RequiredMonth,
    b_end: RequiredMonth,
    db: Session = Depends(get_db),
):
    periods = {
        "A": (parse_month(a_start), parse_month(a_end)),
        "B": (parse_month(b_start), parse_month(b_end)),
    }
    for label, (start, end) in periods.items():
        check_range(start, end, f"{label} ")
        if ep.months_between(start, end) + 1 > MAX_COMPARE_MONTHS:
            raise HTTPException(422, f"Période {label} trop longue (max {MAX_COMPARE_MONTHS} mois)")

    index = get_index(db, code)
    points = {label: to_points(load_points(db, index, *p)) for label, p in periods.items()}
    for label, pts in points.items():
        if not pts:
            raise HTTPException(404, f"Aucune observation sur la période {label}")

    a, b = ep.summarize(points["A"]), ep.summarize(points["B"])
    length = max(len(points["A"]), len(points["B"]))
    aligned = [
        {
            "offset": i,
            "a": points["A"][i].anomaly if i < len(points["A"]) else None,
            "b": points["B"][i].anomaly if i < len(points["B"]) else None,
        }
        for i in range(length)
    ]
    return CompareResponse(
        index=index.code,
        unit=index.unit,
        a=a,
        b=b,
        aligned=aligned,
        interpretation=ep.interpret(a, b),
        caveats=ep.CAVEATS,
    )
