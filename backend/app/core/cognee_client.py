import cognee
from app.core.config import settings

def init_cognee():
    """Initialise Cognee with LLM config if provided."""
    import os
    try:
        os.environ["COGNEE_SKIP_CONNECTION_TEST"] = "true"
        
        # Load environment keys
        if settings.GROQ_API_KEY:
            os.environ["GROQ_API_KEY"] = settings.GROQ_API_KEY
            # For the OpenAI workaround wrapper:
            os.environ["OPENAI_API_KEY"] = settings.GROQ_API_KEY
            os.environ["OPENAI_API_BASE"] = "https://api.groq.com/openai/v1"
        if settings.GEMINI_API_KEY:
            os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY

        if settings.GROQ_API_KEY:
            # Groq is primary, route through openai provider workaround
            cognee.config.set_llm_config({
                "llm_provider": "openai",
                "llm_model": "openai/llama-3.1-8b-instant",
                "llm_api_key": settings.GROQ_API_KEY,
                "llm_endpoint": "https://api.groq.com/openai/v1",
                "fallback_model": "gemini/gemini-2.5-flash" if settings.GEMINI_API_KEY else "",
                "fallback_api_key": settings.GEMINI_API_KEY or "",
                "fallback_endpoint": "",
            })
            # Use Fastembed as embedding provider (runs locally without API keys)
            cognee.config.set_embedding_config({
                "embedding_provider": "fastembed",
                "embedding_model": "BAAI/bge-small-en-v1.5",
            })
        elif settings.GEMINI_API_KEY:
            # Fall back to Gemini as primary if Groq is not set
            cognee.config.set_llm_config({
                "llm_provider": "gemini",
                "llm_model": "gemini/gemini-2.5-flash",
                "llm_api_key": settings.GEMINI_API_KEY,
            })
            cognee.config.set_embedding_config({
                "embedding_provider": "fastembed",
                "embedding_model": "BAAI/bge-small-en-v1.5",
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
            if settings.LLM_MODEL:
                cognee.config.llm_model = settings.LLM_MODEL
            print("[cognee] initialised (legacy config)")
        except Exception as e:
            print(f"[cognee] init warning (legacy config): {e}")
    except Exception as e:
        print(f"[cognee] init warning: {e}")
