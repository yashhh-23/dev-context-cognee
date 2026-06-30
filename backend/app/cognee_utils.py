import difflib
import cognee
from app.services.recall_service import extract_text

async def is_duplicate(new_text: str, threshold: float = 0.85) -> tuple[bool, str]:
    """
    Check if semantically similar content already exists in Cognee.
    Returns (is_dup, existing_content_snippet).
    """
    try:
        results = await cognee.recall(new_text)
        if not results:
            return False, ""
        
        items = results if isinstance(results, list) else [results]
        for item in items:
            existing_text = extract_text(item)
            if not existing_text:
                continue
            similarity = difflib.SequenceMatcher(None, new_text.strip().lower(), existing_text.strip().lower()).ratio()
            if similarity >= threshold or new_text.strip().lower() in existing_text.strip().lower() or existing_text.strip().lower() in new_text.strip().lower():
                return True, existing_text
        return False, ""
    except Exception as e:
        print("[DEBUG] is_duplicate inner exception:", e)
        return False, ""
