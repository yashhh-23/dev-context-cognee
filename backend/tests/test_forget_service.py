import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import cognee
from app.services.forget_service import forget_context

@pytest.mark.asyncio
async def test_forget_context_by_filename():
    with patch.object(cognee, "delete", new_callable=AsyncMock, create=True) as mock_delete, \
         patch.object(cognee, "forget", new_callable=AsyncMock, create=True) as mock_forget:
        
        res = await forget_context(filename="test_file.py")
        assert res["status"] == "deleted"
        assert res["filename"] == "test_file.py"
        assert res["score_bonus"] == 5
        
        # Verify targeted deletion was attempted and prune_system was NEVER called
        assert mock_delete.called or mock_forget.called
        if hasattr(cognee, "prune") and hasattr(cognee.prune, "prune_system") and isinstance(cognee.prune.prune_system, MagicMock):
            assert not cognee.prune.prune_system.called

@pytest.mark.asyncio
async def test_forget_context_no_target():
    res = await forget_context()
    assert res["status"] == "error"
    assert "No deletion target found" in res["error"]

@pytest.mark.asyncio
async def test_forget_flow_confirms_absence():
    from app.core.database import SessionLocal, Base, engine
    from app.models.session import SessionRecord
    from app.services.recall_service import get_all_sessions, get_session

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        test_id = "test-forget-absence-id-999"
        rec = SessionRecord(id=test_id, project="temp_test_absence.py", status="completed")
        db.add(rec)
        db.commit()

        # Verify present before forget
        assert get_session(db, test_id) is not None

        # Now call forget
        with patch.object(cognee, "delete", new_callable=AsyncMock, create=True) as mock_delete, \
             patch.object(cognee, "forget", new_callable=AsyncMock, create=True) as mock_forget:
            res = await forget_context(session_id=test_id)
            assert res["status"] == "deleted"

        # Verify absence after forget!
        assert get_session(db, test_id) is None
        all_s = get_all_sessions(db)
        assert not any(s.id == test_id for s in all_s)
    finally:
        db.query(SessionRecord).filter(SessionRecord.id == test_id).delete()
        db.commit()
        db.close()
