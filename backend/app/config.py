from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration lue depuis l'environnement (ou un fichier .env non versionné)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Obligatoire : aucune valeur par défaut, pour ne jamais embarquer d'identifiants dans le code.
    database_url: str


settings = Settings()
