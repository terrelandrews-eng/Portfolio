"""Embedding providers behind a single interface (spec §4, §14).

- VoyageEmbeddingProvider: real voyage-3 (1024-dim), used only when online + keyed.
- MockEmbeddingProvider: deterministic 1024-dim vectors derived from token hashing,
  so hybrid search runs fully offline for Phase 1. Vectors are L2-normalized and
  carry crude bag-of-words signal (shared words → higher cosine similarity), which
  is enough to exercise the vector path without a paid API.
"""

from __future__ import annotations

import hashlib
import math
import re
from abc import ABC, abstractmethod

import httpx

from app.config import Settings, get_settings

_WORD_RE = re.compile(r"[a-z0-9]+")


class EmbeddingProvider(ABC):
    def __init__(self, dim: int) -> None:
        self.dim = dim

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        ...

    async def embed_one(self, text: str) -> list[float]:
        return (await self.embed([text]))[0]


def _normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(x * x for x in vec))
    if norm == 0:
        return vec
    return [x / norm for x in vec]


class MockEmbeddingProvider(EmbeddingProvider):
    """Deterministic bag-of-words hashing into a fixed-dim space."""

    def _embed_text(self, text: str) -> list[float]:
        vec = [0.0] * self.dim
        for word in _WORD_RE.findall(text.lower()):
            h = int.from_bytes(hashlib.md5(word.encode()).digest()[:8], "big")
            idx = h % self.dim
            sign = 1.0 if (h >> 63) & 1 else -1.0
            vec[idx] += sign
        return _normalize(vec)

    async def embed(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_text(t) for t in texts]


class VoyageEmbeddingProvider(EmbeddingProvider):
    def __init__(self, dim: int, api_key: str, model: str) -> None:
        super().__init__(dim)
        self.api_key = api_key
        self.model = model

    async def embed(self, texts: list[str]) -> list[list[float]]:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.voyageai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={"input": texts, "model": self.model},
            )
            resp.raise_for_status()
            data = resp.json()["data"]
            return [item["embedding"] for item in data]


def get_embedding_provider(settings: Settings | None = None) -> EmbeddingProvider:
    settings = settings or get_settings()
    if settings.use_real_embeddings:
        return VoyageEmbeddingProvider(
            dim=settings.embedding_dim,
            api_key=settings.embedding_api_key,
            model=settings.embedding_model,
        )
    return MockEmbeddingProvider(dim=settings.embedding_dim)
