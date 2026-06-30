from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME:  str           = "Dev-Context Assistant"
    DATABASE_URL:  str           = "sqlite:///./dev_context.db"
    GITHUB_TOKEN:  Optional[str] = None
    GITHUB_REPO:   Optional[str] = None   # e.g. "owner/repo" — now read from .env
    GROQ_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    LLM_MODEL:     Optional[str] = "gemini/gemini-1.5-flash"

    class Config:
        import os
        from pathlib import Path
        BASE_DIR = Path(__file__).resolve().parent.parent.parent
        env_file = os.path.join(BASE_DIR, ".env")
        extra = "allow"


settings = Settings()
