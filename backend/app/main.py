from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.routers import indices

app = FastAPI(
    title="ENSO Monitor API",
    version="1.0.0",
    description=(
        "API en lecture seule exposant l'Oceanic Niño Index (NOAA CPC) : observations "
        "filtrables par période, épisodes El Niño / La Niña détectés et comparaison de périodes."
    ),
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)

app.include_router(indices.router, prefix="/api/v1")


@app.get("/api/v1/health", tags=["supervision"], summary="État de l'API et de la base")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ok"}
