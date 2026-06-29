from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    PROJECT_NAME:  str           = "Dev-Context Assistant"
    DATABASE_URL:  str           = "sqlite:///./dev_context.db"
    GITHUB_TOKEN:  Optional[str] = None
    GITHUB_REPO:   Optional[str] = None   # e.g. "owner/repo" — now read from .env
    OPENAI_API_KEY: Optional[str] = None
    LLM_MODEL:     Optional[str] = "gpt-4o-mini"

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
