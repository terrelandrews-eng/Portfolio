# LifeOS — Session Handoff

> Read this first when resuming. It captures everything needed to continue without
> re-deriving context. Spec is [`lifeos-spec.md`](./lifeos-spec.md); build in phase
> order (§11), verifying each phase's acceptance criteria before the next.

Last updated: 2026-07-04

---

## 1. Status at a glance

| Phase | Scope | Status |
|---|---|---|
| **1 — Foundation** | Knowledge Hub, CRUD, embeddings, hybrid search, seed, minimal UI | ✅ complete & verified |
| **2 — Daily Briefing** | Weather + calendar + email, briefing flow, scheduler, chat (SSE), Today screen, agent_runs | ✅ complete & verified |
| **3 — Weekly rhythm + memory** | Weekly plan (Meals/Health/Home fan-out), Week screen, weekly review, observation lifecycle | ✅ complete & verified |
| **4 — Full roster + routing** | Family/Faith/Finance/Business agents, chat routing, proposals, finance CSV, quick-capture, Telegram stub | ✅ complete & verified |

**All four phases** meet their acceptance criteria **verified against the running stack** (see §5).
The spec's build plan (§11) is fully implemented; remaining work is live-key exercise + optional polish (§7).

---

## 2. How to run it

```bash
cd "/Users/terrelandrews/Documents/LifeoS Final"
cp .env.example .env          # only if .env doesn't exist; defaults run fully offline
open -a Docker                # Docker Desktop daemon must be running (it was NOT by default)
docker compose up --build     # postgres + api on :8000; auto-runs migrations + seed
```

- API: <http://localhost:8000> · docs <http://localhost:8000/docs> · prefix `/api/v1`
- Bearer token (all endpoints): `dev-local-token-change-me` (from `API_TOKEN` in `.env`)
- Frontend (separate): `cd frontend && npm install && npm run dev` → <http://localhost:3000>
  (or `make fe`). In **Settings**, paste the token to authorize the browser.
- Stop: `docker compose down` (add `-v` to also wipe the seeded DB volume).

Everything runs **offline with no paid API keys** while `MOCK_INTEGRATIONS=true`:
embeddings, LLM, weather, calendar, and email all use deterministic mocks/fallbacks.

### Handy commands (`make <target>`)
- `make test` — backend unit tests (`docker compose exec app pytest -q`)
- `make migrate` / `make seed` — run manually in the container
- `make logs` — tail the app logs

---

## 3. Architecture / where things live

```
backend/app/
  config.py            pydantic-settings; use_real_embeddings / use_real_llm gates
  main.py              FastAPI app + lifespan (starts APScheduler)
  llm.py               Anthropic wrapper; logs EVERY call to agent_runs; mock-aware
  scheduler.py         APScheduler; daily briefing job at BRIEFING_HOUR in TZ
  db/models.py         all §5 tables (SQLAlchemy 2.0); Vector(1024) via pgvector
  api/                 routers: entities, tasks, documents, priorities, knowledge,
                       briefing, weekly_plan, review, observations, proposals, finance,
                       capture, chat (SSE), admin, health; deps.py = bearer auth
  agents/agent.py      ONE generic Agent class + AgentConfig (§6.1) + chief_of_staff()
                       + domain_agent(name) + DOMAIN_AGENTS (5: +family,business) + CHAT_DOMAINS (7)
  agents/contributions.py  pydantic domain-contribution schemas + deterministic fallbacks
                           + Python merge → structured plan (§7.2/§15.4; now incl. family/business)
  agents/tools.py      Phase 4 tool registry (§6.2): Anthropic tool defs + execute_tool +
                       per-agent AGENT_TOOLS subsets (search/tasks/calendar/propose/etc.)
  prompts/*.md         chief_of_staff, daily_briefing, whatnow, meals/health/home,
                       family/faith/finance/business, domain_contribution,
                       weekly_plan_merge, weekly_review (NEVER inline prompts)
  knowledge/           chunking, embeddings (Voyage + Mock), search (hybrid), indexing,
                       observations (§5.3 lifecycle: dedup/reinforce/accept/retire)
  integrations/        weather (Open-Meteo), gcal (read + staged-write create_event),
                       email (Resend/mock), telegram (feature-flagged stub)
  flows/               alerts, context, render, daily_briefing, whatnow,
                       weekly_context/plan/review/render (Phase 3), routing (§6.3 classify),
                       chat_agent (route + calendar-intent + tool loop), proposals,
                       finance (CSV normalize + monthly summary), capture (§7.5) (Phase 4)
backend/alembic/       env.py (async) + 0001_initial (all §5 tables + hnsw) + 0002_proposals
backend/tests/         chunking, embeddings, alerts, briefing_format, weekly_plan,
                       observations, routing_finance, phase4_agents (46 tests)
frontend/app/          today, week, chat, knowledge (+ observations panel), settings
                       (+ finance import); lib/api.ts (client + chatStream + all phase methods)
scripts/               seed.py (demo data), google_auth.py (Phase 2 stub, not impl)
```

### Load-bearing design decisions (do not undo without reason)
1. **One generic `Agent` class** driven by `AgentConfig` — never 8 per-agent classes (§6.1, §15.2).
2. **Prompts live in `app/prompts/*.md`** with `{placeholders}`, loaded via `load_prompt()`. Never inline prompt strings.
3. **Deterministic fallback renderers** (`render_fallback_briefing`, `render_fallback_whatnow`, `render_fallback_chat`) serve **double duty**: the offline/mock output AND the fail-soft path when the real LLM errors. A briefing/answer is therefore *always* produced (§2.5).
4. **Scheduled flows pre-gather context, no tool-use loops** (§15.3). Tool loops are for chat/Phase 4.
5. **Compute in Python/SQL, not the LLM** — task buckets, maintenance-due, birthdays, bills all in `flows/alerts.py` (§15.4).
6. **Mock gates**: `use_real_embeddings` / `use_real_llm` = `not mock_integrations and <key present>`. Integrations check `mock_integrations` directly.
7. **Idempotency**: briefing upserts by `date`; priorities PUT creates a new version, exactly one `active`.
8. **agent_runs logs every LLM call** (tokens/latency/error) for cost + debugging (§5.7).

---

## 4. Model / key configuration

- Models (in `.env`, verified current as of build): `MODEL_MAIN=claude-sonnet-4-6`,
  `MODEL_FAST=claude-haiku-4-5-20251001`. Model IDs come from settings, never hardcoded.
- **Real LLM not yet exercised live.** To test real Anthropic synthesis: set
  `MOCK_INTEGRATIONS=false` and `ANTHROPIC_API_KEY=<key>` in `.env`, restart the app
  (`docker compose restart app`), then `POST /api/v1/briefing/generate`. The mock
  fallback is replaced by a real Chief-of-Staff completion.
- Real embeddings (Voyage `voyage-3`, 1024-dim): set `EMBEDDING_API_KEY` + `MOCK_INTEGRATIONS=false`.
- Real Google Calendar: needs OAuth refresh token — `scripts/google_auth.py` is a
  **stub** (Phase 2 left it unimplemented; implement when wiring real calendar).
- Real email: `RESEND_API_KEY` + `BRIEFING_EMAIL_TO`; otherwise mock writes HTML to `/app/outbox/`.

---

## 5. How each phase's acceptance was verified (re-run to confirm)

**Phase 1** — hybrid search returns the right entity/chunk:
```bash
curl -H "Authorization: Bearer dev-local-token-change-me" \
  "http://localhost:8000/api/v1/knowledge/search?q=when%20was%20the%20HVAC%20serviced"
# → top hits: HVAC entity + "HVAC Maintenance Log" chunk (last serviced 2026-03-01)
```

**Phase 2** — briefing in §7.1 format + weather-failure fail-soft:
```bash
curl -X POST -H "Authorization: Bearer dev-local-token-change-me" \
  http://localhost:8000/api/v1/briefing/generate            # → §7.1 markdown
# weather-failure proof is covered by tests/test_briefing_format.py::test_briefing_survives_weather_failure
# and was also shown end-to-end by patching weather.get_weather to raise.
```

**Phase 3** — full Sunday learning cycle (verified end-to-end against the running stack):
```bash
T=dev-local-token-change-me; B=http://localhost:8000/api/v1
curl -s -H "Authorization: Bearer $T" "$B/review/questions"          # 4 questions
curl -s -X POST -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"week_start":"2026-06-29","answers":{}}' "$B/review/answers"   # review + ≥1 proposed observation
# accept a proposed obs → POST /observations/{id}/accept
curl -s -X POST -H "Authorization: Bearer $T" "$B/weekly-plan/generate"  # 7 days + grocery; parallel fan-out
#   → structured.context.observations includes the accepted obs (learning loop closed)
# POST /weekly-plan/{id}/confirm → created 10 tasks (source='weekly_plan', scheduled)
# re-running /review/answers reinforced the repeat obs (reinforced:1) instead of duplicating (dedup §5.3)
```

`make test` → **34 passing** (adds test_weekly_plan: contribution validation + deterministic
merge + task derivation; test_observations: reinforce/cap math + review JSON parsing + fallback proposer).

**Phase 4** — chat routing → domain agent → proposal → approval creates the calendar event
(verified end-to-end against the running stack):
```bash
T=dev-local-token-change-me; B=http://localhost:8000/api/v1
# 1) route + stage: FamilyAgent pulls Sarah's "local restaurant" preference from the knowledge hub
curl -s -N -X POST -H "Authorization: Bearer $T" -H 'Content-Type: application/json' \
  -d '{"session_id":"s1","message":"plan a date night for Friday"}' "$B/chat"
#    → meta agent=family; a `proposals` SSE event with a pending calendar_event
# 2) approve → event lands on the calendar (mock: events_cache; real: Google Calendar)
curl -s -X POST -H "Authorization: Bearer $T" "$B/proposals/<id>/approve"
# also: POST /finance/import (CSV → categorized transactions + month summary);
#       POST /capture {"text":"note: Sarah wants to try the new Thai place"} → observation proposal;
#       multi-domain message → routes to chief_of_staff; GET /admin/cost → per-agent token breakdown.
```

`make test` → **46 passing** (adds test_routing_finance: keyword routing + CSV normalize/categorize;
test_phase4_agents: family/business contributions + merge + calendar-intent helpers).

---

## 6. Known caveats / open items

- **Docker Desktop daemon is not running by default** — `open -a Docker` and wait before `docker compose`.
- **Real LLM / Voyage / Google / Resend / Telegram paths are wired but untested live** (no keys used yet). Mock/fallback paths fully verified.
- `scripts/google_auth.py` is a stub — implement the OAuth flow before enabling real calendar writes. `gcal.create_event` real path is coded but unexercised; mock writes to `events_cache`.
- Seed task "Plan Sarah's birthday (Apr 2)" has a due_date in the past (2026-04-02), so it shows as overdue in briefings — cosmetic seed-data artifact, not a bug.
- `_active_priorities` (from `daily_briefing.py`) is imported by `weekly_plan.py`, `weekly_review.py`, and `chat.py` — a good candidate to promote to a shared module.
- **uvicorn runs without `--reload`** (compose mounts `./backend` but doesn't watch it): after editing backend code, `docker compose restart app` to load it. After adding a migration, `docker compose exec app alembic upgrade head`.
- **Chat routing** is deterministic offline (keyword classifier with word-boundary matching so "work" doesn't fire inside "workout"); the MODEL_FAST classifier is used only when `use_real_llm`. Single domain → domain agent; multi/ambiguous → chief.
- **Proposals are the only external-write path** (§6.2): agents/chat/capture stage a `Proposal`; nothing is written until `/proposals/{id}/approve`. The mock chat path stages calendar events via a deterministic intent extractor (`chat_agent.build_calendar_proposal`); the real-LLM path stages them via the `propose_calendar_event` tool inside `run_tool_loop`.
- Fan-out roster is now 5 (`DOMAIN_AGENTS` = meals/health/home/family/business, per spec §7.2). Faith + Finance are chat-routable (`CHAT_DOMAINS` = 7) but contribute to the plan differently, so they're not in the parallel fan-out.
- Weekly plan stores its context snapshot under `structured["context"]` (WeeklyPlan has no `inputs` column, unlike Briefing).
- New observations from review land as `status='proposed'`; dedup only reinforces `status='active'` matches, so an un-accepted proposal re-proposes on the next review (by design).

---

## 7. Next session: build plan complete — remaining is live-key + polish

All four phases of spec §11 are implemented and verified against the running (mock) stack.
There is no "Phase 5"; what's left is exercising the real integrations and optional polish:

**Exercise the live paths (all coded, none run with real keys yet):**
- **Real LLM:** set `MOCK_INTEGRATIONS=false` + `ANTHROPIC_API_KEY`, restart, then hit
  `/briefing/generate`, `/weekly-plan/generate`, and `/chat`. This is the first real test of
  the chat **tool-use loop** (`chat_agent.run_tool_loop`) and the MODEL_FAST **router/classifier**.
- **Real Google Calendar:** implement `scripts/google_auth.py` OAuth → refresh token in `.env`;
  then proposal approval calls the real `gcal._insert_google_event` instead of the mock.
- **Voyage embeddings / Resend email / Telegram:** flip the same mock gate with each key present.

**Optional polish (spec calls these out but they're not blocking):**
- Todoist two-way sync behind a `TaskProvider` interface (spec §10, "Phase 4+, optional").
- PDF upload in quick-capture (markdown/text already handled).
- Richer chat: persistent multi-session history UI, streaming *during* the tool loop
  (currently the real-LLM loop resolves then streams the final text).
- Promote `_active_priorities` to a shared module (imported in 3 flows now).

**Reuse:** everything is driven by the generic `Agent` + `domain_agent(name)` factory, the
`agents/contributions.py` fan-out/validation/fallback pattern, the `agents/tools.py` registry,
and the proposals write-path. New domains or tools slot into those without new machinery.

---

## 8. Persistent memory

Cross-session memory lives at
`~/.claude/projects/-Users-terrelandrews-Documents-LifeoS-Final/memory/project-status.md`
(indexed in `MEMORY.md`). It mirrors this status and auto-loads next session. Keep both
in sync when a phase completes.
