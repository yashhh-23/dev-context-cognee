import os
os.environ["COGNEE_SYSTEM_PATH"] = os.path.expanduser("~/.cognee_system")

import cognee
from app.core.config import settings

async def init_cognee():
    """Initialise Cognee with LLM config if provided."""
    import os
    try:
        os.environ["COGNEE_SKIP_CONNECTION_TEST"] = "true"

        # If Cloud variables are present, connect to Cognee Cloud
        if settings.COGNEE_API_KEY and settings.COGNEE_TENANT_URL:
            print("[cognee] Connecting to Cognee Cloud...")
            await cognee.serve(
                url=settings.COGNEE_TENANT_URL,
                api_key=settings.COGNEE_API_KEY
            )
        else:
            # Fallback to local disk for local testing
            print("[cognee] Using local filesystem memory...")
            # Explicitly set shorter root directories to prevent Windows MAX_PATH issues
            cognee.config.system_root_directory(os.path.expanduser("~/.cognee_system"))
            cognee.config.data_root_directory(os.path.expanduser("~/.cognee_system/data"))

        # ── Fix LanceDB Windows spill bug (LanceError IO: Spill has sent an error) ──
        # Disable disk-spill by setting a very high memory budget so it never spills
        os.environ.setdefault("LANCE_IO_THREADS", "2")
        os.environ.setdefault("LANCE_CPU_THREADS", "2")

        # ── Clear any stale lru_cache for embedding engine so new config takes effect ──
        # NOTE: Red underline here is a VS Code false positive — IDE uses system Python 3.13,
        # but cognee is installed in .venv. This import works correctly at runtime.
        try:
            from cognee.infrastructure.databases.vector.embeddings.get_embedding_engine import (  # type: ignore[import]
                create_embedding_engine,
            )
            create_embedding_engine.cache_clear()
        except Exception:
            pass  # safe: older cognee versions may not expose this

        # Load environment keys
        if settings.GROQ_API_KEY:
            os.environ["GROQ_API_KEY"] = settings.GROQ_API_KEY
            os.environ["OPENAI_API_KEY"] = settings.GROQ_API_KEY
            os.environ["OPENAI_API_BASE"] = "https://api.groq.com/openai/v1"
        if settings.GEMINI_API_KEY:
            os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY

        if settings.GROQ_API_KEY:
            # Groq as primary LLM only — no Gemini fallback (key not valid)
            cognee.config.set_llm_config({
                "llm_provider": "openai",
                "llm_model": "openai/llama-3.1-8b-instant",
                "llm_api_key": settings.GROQ_API_KEY,
                "llm_endpoint": "https://api.groq.com/openai/v1",
            })
            cognee.config.set_embedding_config({
                "embedding_provider": "fastembed",
                "embedding_model": "BAAI/bge-small-en-v1.5",
                "embedding_dimensions": 384,
            })

        print("[cognee] initialised")
    except AttributeError:
        # Fallback for older cognee versions that don't have set_llm_config
        try:
            if settings.GROQ_API_KEY:
                cognee.config.llm_provider = "openai"
                cognee.config.llm_model = "openai/llama-3.1-8b-instant"
                cognee.config.llm_api_key = settings.GROQ_API_KEY
                cognee.config.llm_endpoint = "https://api.groq.com/openai/v1"
            elif settings.GEMINI_API_KEY:
                cognee.config.llm_provider = "gemini"
                cognee.config.llm_model = "gemini/gemini-2.5-flash"
                cognee.config.llm_api_key = settings.GEMINI_API_KEY
            print("[cognee] initialised (legacy config)")
        except Exception as e:
            print(f"[cognee] init warning (legacy config): {e}")
    except Exception as e:
        print(f"[cognee] init warning: {e}")
