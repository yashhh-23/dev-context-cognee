from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class IngestRequest(BaseModel):
    project: str
    branch: Optional[str] = None
    terminal_output: str
    tags: List[str] = Field(default_factory=list)
    github_url: Optional[str] = None
    timestamp: Optional[datetime] = None

class IngestResponse(BaseModel):
    session_id: str
    status: str

class SessionResponse(BaseModel):
    id: str
    project: str
    branch: Optional[str] = None
    tags: Optional[List[str]] = None
    github_url: Optional[str] = None
    timestamp: datetime
    status: str
    error_message: Optional[str] = None

    class Config:
        from_attributes = True
