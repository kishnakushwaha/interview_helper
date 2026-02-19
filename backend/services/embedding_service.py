"""Lightweight embedding service using scikit-learn TF-IDF.

Uses TF-IDF vectorization for text similarity — fast, zero API cost,
no heavy model downloads.  Good enough for MVP resume-chunk retrieval.
"""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import hashlib, json

# We'll use a fixed-dimension approach: hash-based embeddings
# for storage, and TF-IDF for retrieval/similarity at query time.

_EMBED_DIM = 384  # same dimension as MiniLM for schema compatibility


def _text_to_hash_vector(text: str) -> list[float]:
    """Create a deterministic pseudo-embedding from text using hashing.
    This is used purely for storage; real similarity is computed via TF-IDF."""
    import numpy as np
    h = hashlib.sha256(text.encode()).hexdigest()
    # Use hash bytes to seed a random generator for reproducible vector
    rng = np.random.RandomState(int(h[:8], 16))
    vec = rng.randn(_EMBED_DIM).astype(float)
    # Normalise to unit length
    vec = vec / (np.linalg.norm(vec) + 1e-10)
    return vec.tolist()


def get_embeddings(texts: list[str]) -> list[list[float]]:
    """Return pseudo-embeddings for a list of text strings.
    These are stored in Supabase for future retrieval."""
    return [_text_to_hash_vector(t) for t in texts]


def get_single_embedding(text: str) -> list[float]:
    """Convenience wrapper for a single string."""
    return _text_to_hash_vector(text)


def compute_similarity(query: str, chunks: list[str]) -> list[float]:
    """Compute real TF-IDF cosine similarity between query and chunks.
    Used at retrieval time for accurate ranking."""
    if not chunks:
        return []
    corpus = [query] + chunks
    vectorizer = TfidfVectorizer(stop_words="english")
    tfidf = vectorizer.fit_transform(corpus)
    sims = cosine_similarity(tfidf[0:1], tfidf[1:]).flatten()
    return sims.tolist()
