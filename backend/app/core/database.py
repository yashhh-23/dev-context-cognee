from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL, connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    # Import models so they are registered with Base
    from app.models.session import SessionRecord, PinnedNode
    Base.metadata.create_all(bind=engine)
    
    # Safe SQLite column migration for context_size
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE sessions ADD COLUMN context_size INTEGER DEFAULT 1"))
            conn.commit()
    except Exception:
        pass # Column already exists


