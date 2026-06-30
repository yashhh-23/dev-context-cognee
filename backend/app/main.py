from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import asyncio
import subprocess
import sys

from app.core.database import init_db
from app.api import ingest, sessions, context, bugs, recall, graph, stats, lifecycle, contribute, ws, memory_health
from app.core.byok import byok_key_var

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

@app.middleware("http")
async def add_byok_key_context(request: Request, call_next):
    byok_key = request.headers.get("X-BYOK-Key")
    token = byok_key_var.set(byok_key)
    try:
        response = await call_next(request)
        return response
    finally:
        byok_key_var.reset(token)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(ingest.router,     prefix="/api/ingest",    tags=["ingest"])
app.include_router(sessions.router,   prefix="/api/sessions",  tags=["sessions"])
app.include_router(context.router,    prefix="/api/context",   tags=["context"])
app.include_router(bugs.router,       prefix="/api/bugs",      tags=["bugs"])
app.include_router(recall.router,     prefix="/api/recall",    tags=["recall"])
app.include_router(recall.router,     prefix="/api/memory",    tags=["recall"])
app.include_router(graph.router,      prefix="/api/graph",     tags=["graph"])
app.include_router(stats.router,      prefix="/api/overview",  tags=["stats"])
app.include_router(lifecycle.router,  prefix="/api",           tags=["lifecycle"])
app.include_router(contribute.router, prefix="/api/contribute", tags=["contribute"])
app.include_router(ws.router,         tags=["ws"])
app.include_router(memory_health.router, prefix="/api/stats",   tags=["memory_health"])


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/dependencies/health")
async def dependencies_health():
    """
    Real dependency health check — runs `pip list --outdated` in a
    subprocess and parses the JSON output. Falls back gracefully if
    pip is unavailable or the environment is restricted.
    """
    try:
        proc = await asyncio.create_subprocess_exec(
            sys.executable, "-m", "pip", "list", "--outdated", "--format=json",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
        import json
        outdated_packages = json.loads(stdout.decode()) if stdout else []
    except Exception:
        outdated_packages = []

    # Count installed packages for total_dependencies
    try:
        proc2 = await asyncio.create_subprocess_exec(
            sys.executable, "-m", "pip", "list", "--format=json",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout2, _ = await asyncio.wait_for(proc2.communicate(), timeout=30)
        import json as _json
        all_packages = _json.loads(stdout2.decode()) if stdout2 else []
    except Exception:
        all_packages = []

    return {
        "total_dependencies": len(all_packages),
        "outdated_count": len(outdated_packages),
        "vulnerable_count": 0,  # Reserved: integrate pip-audit for real CVE scanning
        "packages": [
            {
                "name": pkg["name"],
                "current_version": pkg["version"],
                "latest_version": pkg["latest_version"],
            }
            for pkg in outdated_packages
        ],
    }
