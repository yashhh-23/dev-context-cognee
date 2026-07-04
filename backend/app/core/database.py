from sqlalchemy import create_engine, inspect, text
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
        
        # Auto-migrate missing columns for existing tables (e.g. Postgres on Render)
        try:
            inspector = inspect(engine)
            if "sessions" in inspector.get_table_names():
                columns = [col["name"] for col in inspector.get_columns("sessions")]
                with engine.begin() as conn:
                    if "is_encrypted" not in columns:
                        logging.info("Migrating schema: adding column 'is_encrypted' to table 'sessions'...")
                        if engine.dialect.name == "sqlite":
                            conn.execute(text("ALTER TABLE sessions ADD COLUMN is_encrypted BOOLEAN DEFAULT 0"))
                        else:
                            conn.execute(text("ALTER TABLE sessions ADD COLUMN is_encrypted BOOLEAN DEFAULT FALSE"))
                        logging.info("Column 'is_encrypted' added successfully.")
        except Exception as mig_err:
            logging.warning(f"Schema migration check encountered an issue (non-fatal): {mig_err}")

        logging.info("Database tables initialized successfully.")
    except Exception as e:
        logging.error(f"Failed to initialize database tables: {e}")
        raise


