from __future__ import annotations

import threading
from functools import lru_cache
from typing import Iterable, Sequence

import numpy as np
from sentence_transformers import SentenceTransformer


@lru_cache(maxsize=4)
def _load_model(model_name: str) -> SentenceTransformer:
    return SentenceTransformer(model_name, device="cpu")


_model_lock = threading.Lock()


def embed_texts(
    texts: Sequence[str] | Iterable[str],
    model_name: str,
    normalize: bool = True,
) -> np.ndarray:
    """Encode a batch of texts using a cached SentenceTransformer model."""

    # The model loading path is cached but SentenceTransformer is not inherently thread-safe
    # during the first load, so we protect it with a lock.
    with _model_lock:
        model = _load_model(model_name)

    vectors = model.encode(list(texts), convert_to_numpy=True, show_progress_bar=False)
    if normalize:
        norms = np.linalg.norm(vectors, axis=1, keepdims=True) + 1e-9
        vectors = vectors / norms
    return vectors.astype(np.float32)
