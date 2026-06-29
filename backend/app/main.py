from fastapi import FastAPI
from app.api import ingest, sessions
from app.core.database import Base, engine
from app.core.config import settings
from app.core.cognee_client import init_cognee

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.PROJECT_NAME)

@app.on_event("startup")
async def startup_event():
    init_cognee()

app.include_router(ingest.router, prefix="/ingest", tags=["ingest"])
app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])

@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
