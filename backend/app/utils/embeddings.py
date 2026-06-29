import logging
import threading
from collections import OrderedDict
from typing import Optional, List
import numpy as np
from cognee.infrastructure.databases.vector.embeddings.get_embedding_engine import get_embedding_engine

# Setup structured-like logging
logger = logging.getLogger("app.embeddings")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter("[%(asctime)s] %(levelname)s [%(name)s]: %(message)s")
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)

# Centralized similarity thresholds configurations
EXACT_MATCH_THRESHOLD = 0.94
SUPERSEDE_MIN_THRESHOLD = 0.70
SUPERSEDE_MAX_THRESHOLD = 0.94
CONFLICT_MIN_THRESHOLD = 0.45
CONFLICT_MAX_THRESHOLD = 0.90
DIFFLIB_FAST_RATIO = 0.55
DIFFLIB_CONFLICT_MIN = 0.30
DIFFLIB_CONFLICT_MAX = 0.85

# Thread-safe LRU cache capped at 1000 keys to prevent Out-Of-Memory (OOM) errors
class EmbeddingLRUCache:
    def __init__(self, maxsize: int = 1000):
        self.cache = OrderedDict()
        self.maxsize = maxsize
        self.lock = threading.Lock()

    def get(self, key: str) -> Optional[List[float]]:
        with self.lock:
            if key in self.cache:
                self.cache.move_to_end(key)
                return self.cache[key]
            return None

    def set(self, key: str, value: List[float]) -> None:
        with self.lock:
            if key in self.cache:
                self.cache.move_to_end(key)
            self.cache[key] = value
            if len(self.cache) > self.maxsize:
                self.cache.popitem(last=False)

_embedding_cache = EmbeddingLRUCache(maxsize=1000)

async def _get_text_embedding(text: str) -> Optional[List[float]]:
    val = text.strip()
    if not val:
        return None
    
    cached = _embedding_cache.get(val)
    if cached is not None:
        return cached
        
    try:
        engine = get_embedding_engine()
        res = await engine.embed_text([val])
        if res and len(res) > 0:
            emb = res[0]
            _embedding_cache.set(val, emb)
            return emb
    except Exception as e:
        logger.error(f"Failed to get embedding: {e}", exc_info=True)
    return None

def _calculate_cosine_similarity(v1: List[float], v2: List[float]) -> float:
    try:
        arr1 = np.array(v1)
        arr2 = np.array(v2)
        norm1 = np.linalg.norm(arr1)
        norm2 = np.linalg.norm(arr2)
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return float(np.dot(arr1, arr2) / (norm1 * norm2))
    except Exception as e:
        logger.error(f"Error calculating cosine similarity: {e}", exc_info=True)
        return 0.0

def sanitize_dataset_name(name: str) -> str:
    """Strip or replace dots, spaces, backslashes, and dashes from dataset tokens/identifiers to prevent engine failures."""
    if not name:
        return "default_dataset"
    return name.replace(".", "_").replace(" ", "_").replace("/", "_").replace("\\", "_").replace("-", "_")
