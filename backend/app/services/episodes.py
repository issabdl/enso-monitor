"""Détection et comparaison d'épisodes ENSO à partir d'une série ONI.

Règle utilisée (définition opérationnelle de la NOAA CPC) :
un épisode El Niño (resp. La Niña) correspond à au moins 5 saisons glissantes consécutives
avec ONI >= +0,5 °C (resp. <= -0,5 °C).

La classe d'intensité est indicative : elle dépend uniquement du pic absolu de l'ONI
(faible < 1,0 ; modéré < 1,5 ; fort < 2,0 ; très fort >= 2,0). Ce n'est pas une
classification officielle NOAA et le terme « Super El Niño » n'est volontairement pas utilisé.
"""

from dataclasses import dataclass
from datetime import date

THRESHOLD = 0.5
MIN_SEASONS = 5
# En dessous de cet écart, la différence entre deux pics n'est pas interprétée
# (valeurs publiées au centième et révisables d'une version ERSST à l'autre).
SIGNIFICANT_GAP = 0.1
RULE = "au moins 5 saisons consécutives avec ONI ≥ +0,5 °C (El Niño) ou ≤ −0,5 °C (La Niña)"
INTENSITY_SCALE = "pic absolu : faible < 1,0 ; modéré < 1,5 ; fort < 2,0 ; très fort ≥ 2,0 °C"


@dataclass(frozen=True)
class Point:
    period: date
    season: str
    year: int
    anomaly: float


@dataclass(frozen=True)
class Episode:
    kind: str  # "el_nino" | "la_nina"
    start: date
    end: date
    seasons: int
    peak: float
    peak_period: date
    peak_label: str
    mean: float
    intensity: str
    ongoing: bool


@dataclass(frozen=True)
class PeriodSummary:
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
    dominant_phase: str  # "el_nino" | "la_nina" | "neutre"


def months_between(a: date, b: date) -> int:
    return (b.year - a.year) * 12 + b.month - a.month


def intensity(peak: float) -> str:
    value = abs(peak)
    if value >= 2.0:
        return "très fort"
    if value >= 1.5:
        return "fort"
    if value >= 1.0:
        return "modéré"
    return "faible"


def _phase(value: float) -> str | None:
    if value >= THRESHOLD:
        return "el_nino"
    if value <= -THRESHOLD:
        return "la_nina"
    return None


def detect_episodes(points: list[Point]) -> list[Episode]:
    """Parcourt la série triée et regroupe les saisons consécutives de même phase."""
    episodes: list[Episode] = []
    run: list[Point] = []
    run_phase: str | None = None

    def close_run(is_last: bool) -> None:
        if run_phase and len(run) >= MIN_SEASONS:
            peak_point = max(run, key=lambda p: abs(p.anomaly))
            episodes.append(
                Episode(
                    kind=run_phase,
                    start=run[0].period,
                    end=run[-1].period,
                    seasons=len(run),
                    peak=peak_point.anomaly,
                    peak_period=peak_point.period,
                    peak_label=f"{peak_point.season} {peak_point.year}",
                    mean=round(sum(p.anomaly for p in run) / len(run), 2),
                    intensity=intensity(peak_point.anomaly),
                    ongoing=is_last,
                )
            )

    for point in points:
        phase = _phase(point.anomaly)
        contiguous = bool(run) and months_between(run[-1].period, point.period) == 1
        if phase == run_phase and phase is not None and contiguous:
            run.append(point)
            continue
        close_run(is_last=False)
        run, run_phase = ([point], phase) if phase else ([], None)
    close_run(is_last=True)
    return episodes


def summarize(points: list[Point]) -> PeriodSummary:
    if not points:
        raise ValueError("Aucune observation sur la période demandée")
    values = [p.anomaly for p in points]
    peak_point = max(points, key=lambda p: abs(p.anomaly))
    warm = sum(v >= THRESHOLD for v in values)
    cold = sum(v <= -THRESHOLD for v in values)
    if warm > cold and warm >= len(values) / 2:
        dominant = "el_nino"
    elif cold > warm and cold >= len(values) / 2:
        dominant = "la_nina"
    else:
        dominant = "neutre"
    return PeriodSummary(
        start=points[0].period,
        end=points[-1].period,
        seasons=len(points),
        mean=round(sum(values) / len(values), 2),
        max=max(values),
        min=min(values),
        peak=peak_point.anomaly,
        peak_label=f"{peak_point.season} {peak_point.year}",
        el_nino_seasons=warm,
        la_nina_seasons=cold,
        dominant_phase=dominant,
    )


PHASE_LABEL = {"el_nino": "El Niño", "la_nina": "La Niña", "neutre": "neutre"}


def fmt(value: float, signed: bool = True) -> str:
    """Format français : +1,23 (virgule décimale)."""
    return (f"{value:+.2f}" if signed else f"{value:.2f}").replace(".", ",")


def interpret(a: PeriodSummary, b: PeriodSummary) -> list[str]:
    """Interprétation volontairement prudente : description des mesures, pas d'impacts."""
    lines = [
        f"Période A ({a.seasons} saisons) : phase dominante {PHASE_LABEL[a.dominant_phase]}, "
        f"pic {fmt(a.peak)} °C ({a.peak_label}), moyenne {fmt(a.mean)} °C.",
        f"Période B ({b.seasons} saisons) : phase dominante {PHASE_LABEL[b.dominant_phase]}, "
        f"pic {fmt(b.peak)} °C ({b.peak_label}), moyenne {fmt(b.mean)} °C.",
    ]
    gap = abs(a.peak) - abs(b.peak)
    if abs(gap) < SIGNIFICANT_GAP:
        lines.append(
            "Les pics absolus sont très proches (écart inférieur à 0,1 °C) : "
            "l'indice ne permet pas de dire qu'une période a été plus intense que l'autre."
        )
    else:
        stronger = "A" if gap > 0 else "B"
        lines.append(
            f"Selon l'ONI, le pic absolu de la période {stronger} est plus élevé "
            f"de {fmt(abs(gap), signed=False)} °C."
        )
    if a.dominant_phase != b.dominant_phase:
        lines.append(
            "Les deux périodes ne relèvent pas de la même phase : la comparaison "
            "porte sur des situations de nature différente."
        )
    return lines


CAVEATS = [
    "L'ONI mesure une anomalie de température de surface sur la seule région Niño 3.4 : "
    "il ne décrit ni les impacts (pluies, sécheresses) ni la réponse de l'atmosphère.",
    "Les valeurs les plus récentes peuvent être révisées par la NOAA lors des mises à jour.",
    "Les classes d'intensité affichées sont indicatives (pic absolu), pas une "
    "classification officielle.",
    "Aucune prévision n'est faite : il s'agit uniquement de mesures passées.",
]
