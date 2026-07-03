import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import pytest
from unittest.mock import AsyncMock, patch
import cognee
from app.services.recall_service import hybrid_recall, search_memory, recall_text

@pytest.mark.asyncio
async def test_hybrid_recall_returns_both_buckets():
    with patch.object(cognee, "search", new_callable=AsyncMock) as mock_search:
        def search_side_effect(**kwargs):
            query_type = kwargs.get("query_type") or kwargs.get("search_type")
            if str(query_type) in ("SearchType.CHUNKS", "SearchType.SIMILARITY", "CHUNKS", "SIMILARITY"):
                return [{"id": "sim-1", "text": "similarity item"}]
            return [{"id": "graph-1", "text": "graph item"}]
            
        mock_search.side_effect = search_side_effect
        
        res = await hybrid_recall("test query", limit=5)
        
        assert "similarity" in res
        assert "graph" in res
        assert len(res["similarity"]) > 0 or len(res["graph"]) > 0

@pytest.mark.asyncio
async def test_recall_text_uses_hybrid():
    with patch.object(cognee, "search", new_callable=AsyncMock) as mock_search:
        mock_search.return_value = [{"id": "1", "text": "recalled text content"}]
        
        texts = await recall_text("test query", limit=5)
        assert isinstance(texts, list)
        assert len(texts) > 0
        assert "recalled text content" in texts[0]
