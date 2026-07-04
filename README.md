# LifeOS

Personal AI "chief of staff" — see [`lifeos-spec.md`](./lifeos-spec.md) for the full spec.

**Status: Phase 1 (Foundation — Knowledge Hub + skeleton).**

## What Phase 1 delivers

- Postgres 16 + pgvector, all Knowledge Hub tables (spec §5), Alembic `0001_initial`
- FastAPI backend with bearer-token auth (spec §8)
- CRUD for entities, tasks, documents, priorities
- Embedding pipeline behind an `EmbeddingProvider` interface (Voyage `voyage-3`, or a
  deterministic offline mock so Phase 1 runs with **no paid API keys**)
- Hybrid search: pgvector cosine over chunks + observations, plus keyword match over
  entities (`GET /api/v1/knowledge/search`)
- Seed script with realistic demo data (`scripts/seed.py`)
- Minimal Next.js UI: Knowledge (search + entity browser) and Settings (token + priorities)

## Run it

```bash
cp .env.example .env          # defaults work offline (MOCK_INTEGRATIONS=true)
docker compose up --build     # postgres + api; runs migrations + seed on boot
```

Then verify the Phase 1 acceptance criterion:

```bash
curl -H "Authorization: Bearer dev-local-token-change-me" \
  "http://localhost:8000/api/v1/knowledge/search?q=when%20was%20the%20HVAC%20serviced"
```

You should see the `HVAC` entity and the "HVAC Maintenance Log" document chunk
(last serviced 2026-03-01) in the results.

Interactive API docs: <http://localhost:8000/docs>

### Frontend (optional, runs separately)

```bash
cd frontend
npm install
npm run dev            # http://localhost:3000
```

In **Settings**, paste the API token (matches `API_TOKEN` in `.env`) to authorize the
browser, then use **Knowledge** to search and browse entities.

## Tests

```bash
make test              # or: docker compose exec app pytest -q
```

Phase 1 unit tests cover the pure functions: markdown chunking and the mock embedder.

## Enabling real embeddings

Set `MOCK_INTEGRATIONS=false` and `EMBEDDING_API_KEY=<voyage key>` in `.env`. The
`VoyageEmbeddingProvider` (voyage-3, 1024-dim) is then used automatically. The DB
`VECTOR(1024)` dimension matches voyage-3; keep `EMBEDDING_DIM=1024`.

## Layout

```
backend/    FastAPI app, SQLAlchemy models, Alembic migrations, knowledge pipeline, tests
frontend/   Next.js 14 (App Router) + Tailwind — Knowledge & Settings screens
scripts/    seed.py (demo data), google_auth.py (Phase 2 stub)
```
# Portfolio
