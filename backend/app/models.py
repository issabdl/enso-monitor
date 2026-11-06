from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

SEASONS = ("DJF", "JFM", "FMA", "MAM", "AMJ", "MJJ", "JJA", "JAS", "ASO", "SON", "OND", "NDJ")


class Base(DeclarativeBase):
    pass


class Source(Base):
    """Organisme et page de référence d'où proviennent les données."""

    __tablename__ = "source"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    organization: Mapped[str] = mapped_column(String(120))
    url: Mapped[str] = mapped_column(String(500))

    indices: Mapped[list["ClimateIndex"]] = relationship(back_populates="source")


class ClimateIndex(Base):
    """Indice climatique suivi (ici ONI). Le modèle permet d'en ajouter d'autres (RONI...)."""

    __tablename__ = "climate_index"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(10), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    unit: Mapped[str] = mapped_column(String(20))
    version: Mapped[str] = mapped_column(String(40))
    description: Mapped[str] = mapped_column(Text)
    source_id: Mapped[int] = mapped_column(ForeignKey("source.id"))

    source: Mapped[Source] = relationship(back_populates="indices")
    imports: Mapped[list["DataImport"]] = relationship(back_populates="index")


class DataImport(Base):
    """Trace de chaque exécution de l'ETL : fichier, empreinte, volumes, statut."""

    __tablename__ = "data_import"
    __table_args__ = (CheckConstraint("status IN ('success', 'failed')", name="ck_import_status"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    index_id: Mapped[int] = mapped_column(ForeignKey("climate_index.id"))
    file_url: Mapped[str] = mapped_column(String(500))
    file_sha256: Mapped[str] = mapped_column(String(64))
    extracted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    rows_read: Mapped[int]
    rows_inserted: Mapped[int]
    rows_updated: Mapped[int]
    rows_rejected: Mapped[int]
    status: Mapped[str] = mapped_column(String(20))

    index: Mapped[ClimateIndex] = relationship(back_populates="imports")


class Observation(Base):
    """Valeur d'un indice pour une saison glissante de 3 mois (ex. DJF 1950)."""

    __tablename__ = "observation"
    __table_args__ = (
        # Garantit en base l'absence de doublon : une seule valeur par indice et par période.
        UniqueConstraint("index_id", "period", name="uq_observation_index_period"),
        CheckConstraint("anomaly BETWEEN -5 AND 5", name="ck_observation_anomaly_range"),
        CheckConstraint(
            "season IN (" + ", ".join(f"'{s}'" for s in SEASONS) + ")",
            name="ck_observation_season",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    index_id: Mapped[int] = mapped_column(ForeignKey("climate_index.id"))
    import_id: Mapped[int] = mapped_column(ForeignKey("data_import.id"))
    season: Mapped[str] = mapped_column(String(3))
    year: Mapped[int]
    # Mois central de la saison (DJF 1950 -> 1950-01-01). Sert au tri et au filtrage temporel.
    period: Mapped[date]
    total: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    anomaly: Mapped[Decimal] = mapped_column(Numeric(4, 2))
