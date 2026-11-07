from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class SourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    organization: str
    url: str


class ImportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    file_url: str
    file_sha256: str
    extracted_at: datetime
    imported_at: datetime
    rows_read: int
    rows_inserted: int
    rows_updated: int
    rows_rejected: int
    status: str


class IndexOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str
    unit: str
    version: str
    description: str
    source: SourceOut
    last_import: ImportOut | None = None
    first_period: date | None = None
    last_period: date | None = None


class ObservationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    period: date
    season: str
    year: int
    anomaly: float
    total: float


class ObservationsResponse(BaseModel):
    index: str
    unit: str
    source: SourceOut
    start: date | None
    end: date | None
    count: int
    observations: list[ObservationOut]


class EpisodeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    kind: str
    start: date
    end: date
    seasons: int
    peak: float
    peak_period: date
    peak_label: str
    mean: float
    intensity: str
    ongoing: bool


class EpisodesResponse(BaseModel):
    index: str
    rule: str
    intensity_scale: str
    episodes: list[EpisodeOut]


class PeriodSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    start: date
    end: date
    seasons: int
    mean: float
    max: float
    min: float
    peak: float
    peak_label: str
    el_nino_seasons: int
    la_nina_seasons: int
    dominant_phase: str


class AlignedPoint(BaseModel):
    offset: int  # nombre de mois depuis le début de la période
    a: float | None
    b: float | None


class CompareResponse(BaseModel):
    index: str
    unit: str
    a: PeriodSummaryOut
    b: PeriodSummaryOut
    aligned: list[AlignedPoint]
    interpretation: list[str]
    caveats: list[str]


class ErrorOut(BaseModel):
    detail: str
