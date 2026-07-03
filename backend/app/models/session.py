from sqlalchemy import Column, String, DateTime, Text, JSON, Boolean, Integer
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
    timestamp = Column(DateTime, index=True, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    # Semantics: updated by ingest (log lines), recall (similar nodes),
    # lifecycle (auto-clean), and bugs (similar bugs).
    # Do NOT use as a unique stable counter; treat as "last write wins".
    context_size = Column(Integer, default=0, nullable=True)
    
    # Tracking Cognee ingestion status
    status = Column(String, index=True, default="queued") # queued, processing, completed, failed
    error_message = Column(Text, nullable=True)
    cognee_response_id = Column(String, nullable=True)

    is_encrypted = Column(Boolean, default=False)

    @property
    def terminal_output(self) -> str:
        if self.is_encrypted and self._terminal_output:
            key = byok_key_var.get()
            if key:
                try:
                    return decrypt_data(self._terminal_output, key)
                except Exception:
                    return "[DECRYPTION FAILED]"
        return self._terminal_output or ""

    @terminal_output.setter
    def terminal_output(self, value: str):
        key = byok_key_var.get()
        if key and value:
            # encrypt_data must be imported
            from app.core.byok import encrypt_data
            self._terminal_output = encrypt_data(value, key)
            self.is_encrypted = True
        else:
            self._terminal_output = value
            self.is_encrypted = False

class PinnedNode(Base):
    __tablename__ = "pinned_nodes"

    node_id = Column(String, primary_key=True, index=True)
    pinned = Column(Boolean, default=True)

class MemoryFeedback(Base):
    __tablename__ = "memory_feedback"

    node_id = Column(String, primary_key=True, index=True)
    thumbs = Column(String, default="")  # "up" or "down"
    correction_note = Column(Text, nullable=True)
    confidence_score = Column(Integer, default=100)
