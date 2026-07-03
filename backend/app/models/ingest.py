from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class IngestRequest(BaseModel):
    project: Optional[str] = None
    branch: Optional[str] = None
    terminal_output: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    github_url: Optional[str] = None
    timestamp: Optional[datetime] = None
    content: Optional[str] = None
    fileName: Optional[str] = None
    languageId: Optional[str] = None
    source: Optional[str] = None
    symbols: Optional[List[str]] = None

class IngestResponse(BaseModel):
    session_id: str
    status: str
