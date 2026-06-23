import cognee
from app.core.config import settings


def init_cognee():
    """Initialise Cognee with LLM config if provided."""
    try:
        if settings.OPENAI_API_KEY:
            cognee.config.llm_api_key = settings.OPENAI_API_KEY
        if settings.LLM_MODEL:
            cognee.config.llm_model = settings.LLM_MODEL
        print("[cognee] initialised")
    except Exception as e:
        print(f"[cognee] init warning: {e}")
