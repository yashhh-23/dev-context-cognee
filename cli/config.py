import json
import os
from pathlib import Path

CONFIG_DIR = Path.home() / ".devcontext"
CONFIG_FILE = CONFIG_DIR / "config.json"

DEFAULTS = {
    "api_url": "http://localhost:8000/api",
    "api_key": None,
    "auto_ingest_on_error": True,
    "watch_chunk_interval_seconds": 30,
    "recall_top_k": 5,
}

def load_config() -> dict:
    CONFIG_DIR.mkdir(exist_ok=True)
    if not CONFIG_FILE.exists():
        save_config(DEFAULTS)
        return DEFAULTS.copy()
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return {**DEFAULTS, **json.load(f)}
    except json.JSONDecodeError:
        return DEFAULTS.copy()

def save_config(cfg: dict):
    CONFIG_DIR.mkdir(exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)

def get_auth_headers(cfg: dict) -> dict:
    headers = {}
    if cfg.get("api_key"):
        headers["X-BYOK-Key"] = cfg["api_key"]
    return headers
