from sqlalchemy import Column, String, DateTime, Text, JSON, Boolean
from sqlalchemy.ext.hybrid import hybrid_property
from app.core.database import Base
from app.core.byok import decrypt_data, byok_key_var
import datetime
import uuid

def generate_uuid():
    return str(uuid.uuid4())

class SessionRecord(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, index=True, default=generate_uuid)
    project = Column(String, index=True)
    branch = Column(String, nullable=True)
    _terminal_output = Column("terminal_output", Text)
    tags = Column(JSON, nullable=True)
    github_url = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Tracking Cognee ingestion status
    status = Column(String, default="queued") # queued, processing, completed, failed
    error_message = Column(Text, nullable=True)
    cognee_response_id = Column(String, nullable=True)

    @hybrid_property
    def terminal_output(self) -> str:
        key = byok_key_var.get()
        return decrypt_data(self._terminal_output, key)

    @terminal_output.setter
    def terminal_output(self, value: str):
        self._terminal_output = value

class PinnedNode(Base):
    __tablename__ = "pinned_nodes"

    node_id = Column(String, primary_key=True, index=True)
    pinned = Column(Boolean, default=True)
