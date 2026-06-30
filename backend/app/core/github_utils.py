from app.core.config import settings

def _gh_headers() -> dict:
    h = {"Accept": "application/vnd.github+json"}
    token = settings.GITHUB_TOKEN
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h
