import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import pytest
from unittest.mock import AsyncMock, patch
import cognee
from app.services.bug_service import draft_github_issue

@pytest.mark.asyncio
async def test_draft_github_issue_returns_expected_keys():
    with patch.object(cognee, "recall", new_callable=AsyncMock, create=True) as mock_recall, \
         patch.object(cognee, "llm_query", new_callable=AsyncMock, create=True) as mock_llm:
        
        mock_recall.return_value = ["Past bug in memory"]
        mock_llm.return_value = '{"title": "Bug: Test issue", "body": "## Description\\nTest body", "labels": ["bug", "python"]}'
        
        result = await draft_github_issue(
            snippet="def test(): pass",
            error_message="SyntaxError",
            language="python",
            file_path="test.py"
        )
        
        assert "title" in result
        assert "body" in result
        assert "labels" in result
        assert result["title"] == "Bug: Test issue"
        assert result["labels"] == ["bug", "python"]

@pytest.mark.asyncio
async def test_draft_github_issue_fallback():
    with patch.object(cognee, "recall", new_callable=AsyncMock, create=True) as mock_recall, \
         patch.object(cognee, "llm_query", new_callable=AsyncMock, create=True) as mock_llm:
        
        mock_recall.side_effect = Exception("Memory error")
        mock_llm.side_effect = Exception("LLM failure")
        
        result = await draft_github_issue(
            snippet="def test(): pass",
            error_message="SyntaxError",
            language="python",
            file_path="test.py"
        )
        
        assert "title" in result
        assert "body" in result
        assert "labels" in result
        assert result["labels"] == ["bug", "needs-triage"]
