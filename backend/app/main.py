from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os

from app.core.database import init_db
from app.api import sessions, cognee_api, overview, dependencies
from app.api.stats import router as stats_router
from app.api.memory_health import router as memory_health_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        init_db()
    except Exception as e:
        print(f"[startup] DB init failed (non-fatal): {e}")
    yield


app = FastAPI(title="dev-context-cognee", lifespan=lifespan)

allow_origins = [
    "http://localhost:3000",
    "https://localhost:3000",
]
vercel_url = os.getenv("VERCEL_FRONTEND_URL", "")
if vercel_url:
    allow_origins.append(vercel_url)
    if not vercel_url.startswith("https://"):
        allow_origins.append(f"https://{vercel_url}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(sessions.router,     prefix="/api")
app.include_router(cognee_api.router,   prefix="/api")
app.include_router(overview.router,     prefix="/api")
app.include_router(dependencies.router, prefix="/api")
app.include_router(stats_router,        prefix="/api")
app.include_router(memory_health_router, prefix="/api/stats")


@app.get("/health")
def health():
    return {"status": "ok"}
