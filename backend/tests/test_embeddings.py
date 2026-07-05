import math

import pytest

from app.knowledge.embeddings import MockEmbeddingProvider


def _cosine(a, b):
    return sum(x * y for x, y in zip(a, b))  # both are unit vectors


@pytest.mark.asyncio
async def test_dim_and_determinism():
    p = MockEmbeddingProvider(dim=1024)
    v1 = await p.embed_one("when was the HVAC serviced")
    v2 = await p.embed_one("when was the HVAC serviced")
    assert len(v1) == 1024
    assert v1 == v2  # deterministic


@pytest.mark.asyncio
async def test_unit_norm():
    p = MockEmbeddingProvider(dim=1024)
    v = await p.embed_one("hello world of embeddings")
    assert math.isclose(math.sqrt(sum(x * x for x in v)), 1.0, rel_tol=1e-6)


@pytest.mark.asyncio
async def test_shared_words_raise_similarity():
    p = MockEmbeddingProvider(dim=1024)
    query = await p.embed_one("when was the HVAC serviced")
    related = await p.embed_one("HVAC was serviced on March 1")
    unrelated = await p.embed_one("ballet recital tickets for Ada")
    assert _cosine(query, related) > _cosine(query, unrelated)


@pytest.mark.asyncio
async def test_batch_matches_single():
    p = MockEmbeddingProvider(dim=256)
    batch = await p.embed(["alpha", "beta"])
    assert batch[0] == await p.embed_one("alpha")
    assert batch[1] == await p.embed_one("beta")
