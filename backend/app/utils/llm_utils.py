import httpx
import logging

logger = logging.getLogger(__name__)

SUPERSEDE_PROMPT = """You are a memory deduplication assistant.
Below are two memory entries stored in a developer's context memory system.

Memory A (OLDER):
{mem_a}

Memory B (NEWER):
{mem_b}

Does Memory B supersede (replace / make obsolete) Memory A?
A supersedes B only when B represents an UPDATED state of the same fact (e.g. 'bug fixed' supersedes 'bug exists', 'PR merged' supersedes 'PR open').
Do NOT answer YES if both could be true at the same time, or if they describe different things.

Answer with exactly one word: YES or NO."""

async def ask_gemini(prompt: str, api_key: str) -> str | None:
    """Call Gemini 2.0 Flash Lite — fast, free-tier friendly, 60s timeout."""
    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent"
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                url,
                params={"key": api_key},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {
                        "maxOutputTokens": 2048,
                        "temperature": 0.2,
                    },
                },
            )
            r.raise_for_status()
            return r.json()["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        logger.error(f"[llm_utils] Gemini failed: {e}")
        return None

async def ask_groq(prompt: str, api_key: str) -> str | None:
    """Call Groq with llama-3.3-70b-versatile — high quality, 60s timeout."""
    url = "https://api.groq.com/openai/v1/chat/completions"
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                url,
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 2048,
                    "temperature": 0.2,
                },
            )
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"[llm_utils] Groq failed: {e}")
        return None

