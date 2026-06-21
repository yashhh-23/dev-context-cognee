import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Dev Context Cognee Integration"
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./sessions.db")

    class Config:
        env_file = ".env"

settings = Settings()
