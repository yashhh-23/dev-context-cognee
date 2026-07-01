import math
import logging
from functools import lru_cache
import numpy as np
from typing import Optional, List
from cognee.infrastructure.databases.vector.embeddings.get_embedding_engine import get_embedding_engine

logger = logging.getLogger(__name__)

MAX_CACHE_SIZE = 512

# Original Thresholds from previous implementations
EXACT_MATCH_THRESHOLD = 0.94
SUPERSEDE_MIN_THRESHOLD = 0.70
SUPERSEDE_MAX_THRESHOLD = 0.94
CONFLICT_MIN_THRESHOLD = 0.45
CONFLICT_MAX_THRESHOLD = 0.90
DIFFLIB_FAST_RATIO = 0.55
DIFFLIB_CONFLICT_MIN = 0.30
DIFFLIB_CONFLICT_MAX = 0.85

from collections import OrderedDict
import threading

class AsyncLRUCache:
    def __init__(self, maxsize=512):
        self.cache = OrderedDict()
        self.maxsize = maxsize
        self.lock = threading.Lock()

    def get(self, key):
        with self.lock:
            if key in self.cache:
                self.cache.move_to_end(key)
                return self.cache[key]
            return None

    def set(self, key, value):
        with self.lock:
            if key in self.cache:
                self.cache.move_to_end(key)
            self.cache[key] = value
            if len(self.cache) > self.maxsize:
                self.cache.popitem(last=False)

_cache = AsyncLRUCache(maxsize=MAX_CACHE_SIZE)

async def get_text_embedding(text: str) -> Optional[List[float]]:
    val = text.strip()
    if not val:
        return None
    cached = _cache.get(val)
    if cached is not None:
        return cached
    try:
        engine = get_embedding_engine()
        res = await engine.embed_text([val])
        if res and len(res) > 0:
            emb = res[0]
            _cache.set(val, emb)
            return emb
    except Exception as e:
        logger.error(f"Failed to get embedding: {e}")
    return None

def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    try:
        dot = sum(a * b for a, b in zip(vec_a, vec_b))
        mag_a = math.sqrt(sum(a ** 2 for a in vec_a))
        mag_b = math.sqrt(sum(b ** 2 for b in vec_b))
        if mag_a == 0 or mag_b == 0:
            return 0.0
        return float(dot / (mag_a * mag_b))
    except Exception as e:
        logger.error(f"Error calculating cosine similarity: {e}")
        return 0.0

def sanitize_dataset_name(name: str) -> str:
    if not name:
        return "default_dataset"
    return name.replace(".", "_").replace(" ", "_").replace("/", "_").replace("\\", "_").replace("-", "_")
