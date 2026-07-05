.PHONY: up down logs seed migrate test fe

# Bring up postgres + api (runs migrations + seed automatically).
up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f app

# Run migrations / seed manually inside the running app container.
migrate:
	docker compose exec app alembic upgrade head

seed:
	docker compose exec app python -m scripts.seed

# Backend unit tests (pure functions: chunking, embeddings).
test:
	docker compose exec app pytest -q

# Frontend dev server (separate from docker compose).
fe:
	cd frontend && npm install && npm run dev
