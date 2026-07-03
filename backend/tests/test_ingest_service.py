import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.services.ingest_service import process_file_ingest, process_github_ingest

@pytest.mark.asyncio
async def test_ingest_service_no_fake_node_count():
    with patch("cognee.add", new_callable=AsyncMock) as mock_add, \
         patch("app.services.ingest_service._debounced_cognify", new_callable=AsyncMock):
        
        mock_result = MagicMock()
        mock_result.id = "real_node_id_123"
        mock_add.return_value = mock_result
        
        with patch("app.services.ingest_service.SessionLocal") as mock_session_local, \
             patch("app.core.ws_manager.manager.broadcast", new_callable=AsyncMock):
            
            mock_db = MagicMock()
            mock_record = MagicMock()
            mock_record.cognee_response_id = None
            mock_db.query.return_value.filter.return_value.first.return_value = mock_record
            mock_session_local.return_value = mock_db
            
            await process_file_ingest("session-1", {"content": "print('hello')", "fileName": "test.py"})
            assert mock_record.cognee_response_id == "real_node_id_123"
