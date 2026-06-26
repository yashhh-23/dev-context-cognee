import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import ingest, sessions, context, bugs
from app.api import recall, graph, stats, lifecycle, contribute, ws
from app.core.database import Base, engine
from app.core.config import settings
from app.core.cognee_client import init_cognee

logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Dev-Context Assistant — persistent developer memory powered by Cognee.",
    version="2.0.0",
)

import os
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,https://dev-context-cognee.vercel.app").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    # Attempt to create DB tables — non-fatal if DB is unreachable
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created/verified.")
    except Exception as exc:
        logger.warning(
            "Could not connect to the database on startup: %s. "
            "Cognee memory features will still work via SQLite.", exc
        )
    init_cognee()


# ── existing routes (unchanged) ──────────────────────────────────────────────
app.include_router(ingest.router,    prefix="/api/ingest",    tags=["ingest"])
app.include_router(sessions.router,  prefix="/api/sessions",  tags=["sessions"])
app.include_router(context.router,   prefix="/api/context",   tags=["context"])
app.include_router(bugs.router,      prefix="/api/bugs",      tags=["bugs"])

# ── dashboard-v2 routes ───────────────────────────────────────────────────────
app.include_router(recall.router,    prefix="/api/recall",    tags=["recall"])
app.include_router(graph.router,     prefix="/api/graph",     tags=["graph"])
app.include_router(stats.router,     prefix="/api/overview",  tags=["stats"])
app.include_router(lifecycle.router, prefix="/api",           tags=["lifecycle"])
app.include_router(contribute.router, prefix="/api/contribute", tags=["contribute"])

# ── WebSocket ─────────────────────────────────────────────────────────────────
app.include_router(ws.router, tags=["ws"])


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok", "version": "2.0.0"}
