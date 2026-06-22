from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import ingest, sessions, context, bugs
from app.core.database import Base, engine
from app.core.config import settings
from app.core.cognee_client import init_cognee

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    init_cognee()


app.include_router(ingest.router,   prefix="/ingest",   tags=["ingest"])
app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
app.include_router(context.router,  prefix="/context",  tags=["context"])
app.include_router(bugs.router,     prefix="/bugs",     tags=["bugs"])


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
