import os
os.environ["COGNEE_SYSTEM_PATH"] = os.path.expanduser("~/.cognee_system")

import cognee
from app.core.config import settings

# ── Quota-error keywords that signal Gemini daily limit exhaustion ────────────
_QUOTA_SIGNALS = (
    "quota",
    "resourceexhausted",
    "429",
    "rate limit",
    "quotafailure",
    "daily limit",
    "free tier",
)

def _is_quota_error(exc: Exception) -> bool:
    """Return True if the exception looks like a Gemini quota exhaustion."""
    msg = str(exc).lower()
    return any(sig in msg for sig in _QUOTA_SIGNALS)


def _apply_groq_config() -> None:
    """Reconfigure cognee in-process to use Groq immediately."""
    groq_key = settings.GROQ_API_KEY or os.environ.get("GROQ_API_KEY", "")
    if not groq_key:
        print("[cognee] WARNING: No GROQ_API_KEY available for fallback!")
        return

    os.environ["LLM_API_KEY"]    = groq_key
    os.environ["LLM_PROVIDER"]   = "openai"
    os.environ["LLM_MODEL"]      = "openai/llama-3.1-8b-instant"
    os.environ["LLM_ENDPOINT"]   = "https://api.groq.com/openai/v1"
    os.environ["OPENAI_API_KEY"]  = groq_key
    os.environ["OPENAI_API_BASE"] = "https://api.groq.com/openai/v1"

    try:
        cognee.config.set_llm_config({
            "llm_provider": "openai",
            "llm_model":    "openai/llama-3.1-8b-instant",
            "llm_api_key":  groq_key,
            "llm_endpoint": "https://api.groq.com/openai/v1",
        })
    except Exception:
        # Older cognee versions use direct attribute assignment
        try:
            cognee.config.llm_provider = "openai"
            cognee.config.llm_model    = "openai/llama-3.1-8b-instant"
            cognee.config.llm_api_key  = groq_key
            cognee.config.llm_endpoint = "https://api.groq.com/openai/v1"
        except Exception as e:
            print(f"[cognee] Groq config fallback (legacy) warning: {e}")

    print("[cognee] Switched to Groq (llama-3.1-8b-instant) — Gemini quota exhausted.")


async def cognify_with_fallback() -> None:
    """Run cognee.cognify() with Gemini, auto-falling back to Groq on quota errors.

    Flow
    ────
    1. Attempt cognify() with the currently configured LLM (Gemini by default).
    2. If a quota / rate-limit error is raised, reconfigure cognee to Groq in-process.
    3. Retry cognify() once with Groq — no server restart required.
    4. If Groq also fails, re-raise the Groq error so the caller can handle it.
    """
    try:
        await cognee.cognify()
    except Exception as primary_exc:
        if _is_quota_error(primary_exc):
            print(f"[cognee] Gemini quota exhausted — switching to Groq fallback. Error: {primary_exc}")
            _apply_groq_config()
            try:
                await cognee.cognify()
                print("[cognee] ✓ cognify() completed successfully via Groq fallback.")
            except Exception as fallback_exc:
                print(f"[cognee] Groq fallback also failed: {fallback_exc}")
                raise fallback_exc
        else:
            # Not a quota error — re-raise as-is
            raise primary_exc


async def init_cognee():
    """Initialise Cognee with LLM config — Gemini primary, Groq pre-staged for fallback."""
    try:
        os.environ["COGNEE_SKIP_CONNECTION_TEST"] = "true"

        # Cloud mode: Cognee Cloud takes priority over local
        if settings.COGNEE_API_KEY and settings.COGNEE_TENANT_URL:
            print("[cognee] Connecting to Cognee Cloud...")
            await cognee.serve(
                url=settings.COGNEE_TENANT_URL,
                api_key=settings.COGNEE_API_KEY
            )
        else:
            print("[cognee] Using local filesystem memory...")
            cognee.config.system_root_directory(os.path.expanduser("~/.cognee_system"))
            cognee.config.data_root_directory(os.path.expanduser("~/.cognee_system/data"))

        # ── Fix LanceDB Windows spill bug ──────────────────────────────────────
        os.environ.setdefault("LANCE_IO_THREADS", "2")
        os.environ.setdefault("LANCE_CPU_THREADS", "2")

        # ── Clear stale lru_cache so new LLM config takes effect ──────────────
        try:
            from cognee.infrastructure.databases.vector.embeddings.get_embedding_engine import (  # type: ignore[import]
                create_embedding_engine,
            )
            create_embedding_engine.cache_clear()
        except Exception:
            pass

        # ── Pre-load API keys into env (Cognee SDK reads these directly) ──────
        if settings.GROQ_API_KEY:
            os.environ["GROQ_API_KEY"] = settings.GROQ_API_KEY
        if settings.GEMINI_API_KEY:
            os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY

        # ── LLM config: Gemini primary, Groq env vars pre-staged for fallback ─
        if settings.GEMINI_API_KEY:
            try:
                cognee.config.set_llm_config({
                    "llm_provider": "gemini",
                    "llm_model":    "gemini/gemini-2.5-flash",
                    "llm_api_key":  settings.GEMINI_API_KEY,
                })
                print("[cognee] LLM: Gemini (primary) | Groq (auto-fallback on quota)")
            except AttributeError:
                # Older cognee versions
                cognee.config.llm_provider = "gemini"
                cognee.config.llm_model    = "gemini/gemini-2.5-flash"
                cognee.config.llm_api_key  = settings.GEMINI_API_KEY
        elif settings.GROQ_API_KEY:
            # No Gemini key — go straight to Groq
            _apply_groq_config()
            print("[cognee] LLM: Groq (no Gemini key present)")

        # ── Embedding: fastembed is local, no API key needed ──────────────────
        try:
            cognee.config.set_embedding_config({
                "embedding_provider":  "fastembed",
                "embedding_model":     "BAAI/bge-small-en-v1.5",
                "embedding_dimensions": 384,
            })
        except Exception:
            pass  # optional — cognee falls back to its own default if unavailable

        print("[cognee] initialised ✓")

    except AttributeError as e:
        print(f"[cognee] init warning (legacy config path): {e}")
    except Exception as e:
        print(f"[cognee] init warning: {e}")

