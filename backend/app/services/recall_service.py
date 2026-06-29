from sqlalchemy.orm import Session
from app.models.session import SessionRecord

def get_all_sessions(db: Session, skip: int = 0, limit: int = 100):
    return db.query(SessionRecord).order_by(SessionRecord.timestamp.desc()).offset(skip).limit(limit).all()

def get_session(db: Session, session_id: str):
    return db.query(SessionRecord).filter(SessionRecord.id == session_id).first()

import cognee

async def search_cognee(query: str):
    # Depending on the new cognee api, usually cognee.search()
    return await cognee.search(query)
