import cognee
from app.core.config import settings


def init_cognee():
    """Initialise Cognee with LLM config if provided."""
    try:
        if settings.GEMINI_API_KEY:
            import os
            os.environ["GEMINI_API_KEY"] = settings.GEMINI_API_KEY
            cognee.config.set_llm_config(
                provider="gemini",
                model="gemini/gemini-1.5-pro",
                api_key=settings.GEMINI_API_KEY,
            )
        elif settings.GROQ_API_KEY:
            import os
            os.environ["GROQ_API_KEY"] = settings.GROQ_API_KEY
            cognee.config.set_llm_config(
                provider="groq",
                model="groq/llama3-8b-8192", # Defaulting to a Groq model
                api_key=settings.GROQ_API_KEY,
            )
        print("[cognee] initialised")
    except AttributeError:
        # Fallback for older cognee versions that don't have set_llm_config
        try:
            if settings.GEMINI_API_KEY:
                cognee.config.llm_api_key = settings.GEMINI_API_KEY
            elif settings.GROQ_API_KEY:
                cognee.config.llm_api_key = settings.GROQ_API_KEY
            if settings.LLM_MODEL:
                cognee.config.llm_model = settings.LLM_MODEL
            print("[cognee] initialised (legacy config)")
        except Exception as e:
            print(f"[cognee] init warning: {e}")
    except Exception as e:
        print(f"[cognee] init warning: {e}")
