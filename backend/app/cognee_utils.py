import cognee

async def is_duplicate(new_text: str, threshold: float = 0.85) -> tuple[bool, str]:
    """
    Check if semantically similar content already exists in Cognee.
    Returns (is_dup, existing_content_snippet).
    """
    try:
        results = await cognee.search(new_text, query_type="SUMMARIES")
        if not results:
            return False, ""
        # results is a list of ScoredResult or dicts with .score or ['score']
        for item in results:
            score = item.score if hasattr(item, "score") else item.get("score", 0)
            if score >= threshold:
                text = item.text if hasattr(item, "text") else item.get("text", "")
                return True, text[:200]
        return False, ""
    except Exception:
        return False, ""
