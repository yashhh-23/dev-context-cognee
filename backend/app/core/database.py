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
    import logging
    # Ensure all models are imported so SQLAlchemy knows about them before creation
    from app.models.session import SessionRecord, PinnedNode, MemoryFeedback
    
    logging.info("Initializing database and ensuring all tables exist...")
    try:
        # Self-correcting generation script to guarantee all tables exist
        Base.metadata.create_all(bind=engine)
        logging.info("Database tables initialized successfully.")
    except Exception as e:
        logging.error(f"Failed to initialize database tables: {e}")
        raise


