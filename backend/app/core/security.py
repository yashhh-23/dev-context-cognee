import re
from fastapi import HTTPException

# Regex patterns for detecting common prompt injection techniques.
PROMPT_INJECTION_PATTERNS = [
    r"(?i)ignore\s+(?:all\s+)?(?:your\s+)?(?:previous\s+)?instructions?",
    r"(?i)system\s+prompt",
    r"(?i)you\s+are\s+(?:now\s+)?a",
    r"(?i)forget\s+(?:all\s+)?(?:about\s+)?(?:previous\s+)?",
    r"(?i)instead\s+of\s+doing",
    r"(?i)developer\s+mode",
    r"(?i)new\s+rule",
    r"(?i)override\s+instruction",
    r"(?i)dan\s+mode",
]

def scan_text_for_injection(text: str) -> bool:
    """Scan incoming text for potential prompt injection patterns.
    Returns True if a threat is detected, False otherwise.
    """
    if not text:
        return False
    
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, text):
            return True
    return False

def verify_safe_input(text: str, field_name: str = "input"):
    """Check text input and raise HTTP 400 if prompt injection is detected."""
    if scan_text_for_injection(text):
        raise HTTPException(
            status_code=400,
            detail=f"Security Guardrail: Potential prompt injection detected in {field_name}."
        )
