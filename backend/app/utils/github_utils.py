from urllib.parse import urlparse
import httpx
import logging

logger = logging.getLogger(__name__)

def get_github_headers(token: str | None) -> dict:
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers

def parse_repo_from_url(url: str) -> str:
    """Safe extraction: handles trailing slashes and non-standard paths."""
    parsed = urlparse(url)
    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) >= 2:
        return f"{parts[-2]}/{parts[-1]}"
    raise ValueError(f"Invalid GitHub URL: {url}")

async def search_github(query: str, headers: dict, label: str = "") -> list[dict]:
    """Single reusable GitHub search helper with error propagation."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://api.github.com/search/issues",
                params={"q": query, "per_page": 5, "sort": "relevance"},
                headers=headers
            )
            if r.status_code == 403:
                logger.warning(f"[github] Rate limited during {label}")
                raise httpx.HTTPStatusError("Rate limited", request=r.request, response=r)
            r.raise_for_status()
            return r.json().get("items", [])
    except Exception as e:
        logger.error(f"[github] Search failed ({label}): {e}")
        return []
