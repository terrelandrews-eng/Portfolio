# LifeOS — Technical Specification v1.0

> **Purpose of this document:** Complete implementation spec for LifeOS, a personal AI "chief of staff" system. This spec is written to be handed to Claude Code for implementation. Build in the phase order specified — do not build Phase 4 components before Phase 2 is working end-to-end.

---

## 1. Product Summary

LifeOS is a personal AI operating system that answers one question: **"What should I be doing right now?"**

It consists of:
1. A **Knowledge Hub** — structured + semantic storage of everything about the user's life
2. A **Daily Briefing** engine — synthesizes calendar, tasks, weather, health, meals, home, and business context into one prioritized daily plan, delivered automatically each morning
3. A **Weekly Planning** engine — Sunday planning session covering meals, groceries, chores, workouts, family time, and business priorities
4. A **Memory/Learning loop** — extracts patterns from what happened vs. what was planned, and writes durable insights back to the Knowledge Hub
5. **Domain Agents** — specialized sub-agents (Home, Meals, Family, Health, Faith, Finance, Business) coordinated by a central **Chief of Staff agent**
6. A **conversational interface** — chat with the system at any time; it routes to the right domain agent and answers from full life context

### Non-goals (v1)
- No mobile app (web + notifications only)
- No multi-user/family accounts (single user; family members are *entities in the data*, not users)
- No direct bank account integration (manual/CSV finance import in v1)
- No voice interface

---

## 2. Design Principles

1. **One source of truth.** Every agent reads from and writes to the same Knowledge Hub. No agent maintains private state about the user.
2. **Synthesis over data display.** The output of any briefing is a *decision* ("do X first, here's why"), never a raw dump of calendar events.
3. **Priorities are explicit and versioned.** The user's priority hierarchy lives in a single editable document (`priorities.md` equivalent in DB). Every agent prompt includes it. When priorities conflict, the Chief of Staff resolves using this document and *says so* in its output.
4. **Memory compounds.** The system must get smarter weekly. Every weekly review MUST produce at least a review record, and observations when patterns are detected.
5. **Fail soft.** If an integration is down (weather API, calendar), the briefing still generates with a note about what's missing. Never block the morning briefing.
6. **Human in the loop for writes.** Agents propose calendar events, tasks, and grocery lists; the user confirms before anything is written to external systems (v1). Auto-write is a per-integration setting for later.

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Interfaces                           │
│   Web app (Next.js)   │   Email briefings   │  Telegram bot │
└───────────┬───────────────────┬──────────────────┬──────────┘
            │                   │                  │
┌───────────▼───────────────────▼──────────────────▼──────────┐
│                      API Layer (FastAPI)                     │
│  /briefing  /chat  /weekly-plan  /knowledge  /review  /admin │
└───────────┬──────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────┐
│                   Orchestration Layer                        │
│  ChiefOfStaff agent ──┬── HomeAgent                          │
│  (routing, synthesis, ├── MealsAgent                         │
│   conflict resolution)├── FamilyAgent                        │
│                       ├── HealthAgent                        │
│                       ├── FaithAgent                         │
│                       ├── FinanceAgent                       │
│                       └── BusinessAgent                      │
└───────────┬──────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────┐
│                     Knowledge Hub                            │
│  Postgres (structured)  +  pgvector (semantic)               │
│  entities • tasks • events cache • observations • priorities │
└───────────┬──────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────┐
│                  Integrations Layer                          │
│  Google Calendar │ Weather (Open-Meteo) │ Todoist/internal  │
│  Gmail (read)    │ CSV finance import   │ Scheduler (cron)   │
└──────────────────────────────────────────────────────────────┘
```

## 4. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Backend | Python 3.12 + FastAPI | Async, easy Anthropic SDK use, fast to build |
| Agent framework | Anthropic Python SDK directly (no LangChain) | Full control, fewer abstractions, tool-use API is sufficient |
| LLM | Claude Sonnet (briefings, agents), Claude Haiku (classification/extraction) | Cost/quality balance; model IDs in config, never hardcoded |
| Database | Postgres 16 + pgvector extension | One DB for structured + vector; avoid running a separate vector store |
| ORM | SQLAlchemy 2.0 + Alembic migrations | Standard |
| Scheduler | APScheduler (in-process) in v1 | Simple; swap for Temporal/cron later if needed |
| Web frontend | Next.js 14 (App Router) + Tailwind | Single-page dashboard + chat |
| Notifications | Email via Resend (or SMTP) + optional Telegram bot | Email is the v1 briefing channel |
| Embeddings | Voyage AI (voyage-3) or any embedding API behind an interface | Behind `EmbeddingProvider` interface so it's swappable |
| Deployment | Docker Compose (app + postgres) on a small VPS or Fly.io | Single-user system, keep it cheap |
| Secrets | `.env` + pydantic-settings | Never commit secrets |

**Environment variables (create `.env.example`):**
```
ANTHROPIC_API_KEY=
DATABASE_URL=postgresql+asyncpg://lifeos:lifeos@localhost:5432/lifeos
EMBEDDING_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
RESEND_API_KEY=
BRIEFING_EMAIL_TO=
TELEGRAM_BOT_TOKEN=          # optional
TELEGRAM_CHAT_ID=            # optional
TIMEZONE=America/New_York
BRIEFING_HOUR=06             # local time
WEEKLY_PLAN_DAY=SUN
WEEKLY_PLAN_HOUR=16
MODEL_MAIN=claude-sonnet-4-6
MODEL_FAST=claude-haiku-4-5-20251001
```

---

## 5. Data Model (Knowledge Hub)

All tables in Postgres. Use SQLAlchemy models + Alembic migration `0001_initial`.

### 5.1 `entities`
The universal "things in my life" table. People, home systems, appliances, vehicles, recurring commitments, businesses, accounts.

```sql
CREATE TABLE entities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          TEXT NOT NULL,        -- 'person' | 'home_system' | 'vehicle' | 'appliance' | 'account' | 'business' | 'pet' | 'organization' | 'other'
  name          TEXT NOT NULL,
  attributes    JSONB NOT NULL DEFAULT '{}',  -- flexible: {"birthday": "1988-04-02", "relationship": "wife", "allergies": ["shellfish"]}
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

Examples of rows:
- `{type: person, name: "Sarah", attributes: {relationship: "wife", food_preferences: ["Italian","local restaurants"], birthday: "..."}}`
- `{type: home_system, name: "HVAC", attributes: {filter_size: "20x25x1", last_serviced: "2026-03-01", service_interval_months: 6}}`
- `{type: vehicle, name: "Honda Odyssey", attributes: {oil_change_due_miles: 52000, current_miles: 49800}}`

### 5.2 `tasks`
Internal task store (source of truth even if mirrored to Todoist later).

```sql
CREATE TABLE tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  description   TEXT,
  domain        TEXT NOT NULL,       -- 'home' | 'meals' | 'family' | 'health' | 'faith' | 'finance' | 'business' | 'personal'
  status        TEXT NOT NULL DEFAULT 'open',  -- 'open' | 'done' | 'dropped' | 'deferred'
  due_date      DATE,
  scheduled_for DATE,                -- when the system plans for the user to do it
  effort_min    INT,                 -- estimated minutes
  priority      INT DEFAULT 3,       -- 1 (critical) .. 5 (someday)
  recurrence    TEXT,                -- RRULE string, nullable
  entity_id     UUID REFERENCES entities(id),
  source        TEXT DEFAULT 'user', -- 'user' | 'agent' | 'weekly_plan' | 'recurring'
  created_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ
);
```

### 5.3 `observations`
The long-term memory table. This is what makes the system compound.

```sql
CREATE TABLE observations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain        TEXT NOT NULL,
  kind          TEXT NOT NULL,        -- 'pattern' | 'preference' | 'fact' | 'anti_pattern'
  content       TEXT NOT NULL,        -- "User completes workouts 3x more often when scheduled before 7am"
  confidence    REAL DEFAULT 0.5,     -- 0..1, raised when re-confirmed, lowered when contradicted
  evidence_count INT DEFAULT 1,
  status        TEXT DEFAULT 'active',-- 'active' | 'retired'
  embedding     VECTOR(1024),
  last_confirmed_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);
```

Rules:
- Weekly review proposes new observations; duplicates (cosine similarity > 0.88 against existing active observations in same domain) increment `evidence_count` and `confidence` (+0.1, cap 0.95) instead of inserting.
- Contradicted observations get confidence -0.2; below 0.2 → `status='retired'`.
- Only observations with confidence ≥ 0.5 are injected into agent prompts.

### 5.4 `documents` + `chunks`
Free-form knowledge: notes, health history, business docs, sermon notes, manuals.

```sql
CREATE TABLE documents (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title      TEXT NOT NULL,
  domain     TEXT,
  content    TEXT NOT NULL,           -- markdown
  entity_id  UUID REFERENCES entities(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  embedding   VECTOR(1024),
  chunk_index INT
);
CREATE INDEX ON chunks USING hnsw (embedding vector_cosine_ops);
```

Chunking: split on markdown headings first, then ~800-token windows with 100-token overlap. Re-chunk on document update (delete + reinsert chunks).

### 5.5 `priorities`
```sql
CREATE TABLE priorities (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version    INT NOT NULL,
  content    TEXT NOT NULL,   -- markdown; the user's priority hierarchy + season-of-life notes
  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
Exactly one row has `active=true`. Editing creates a new version. Every agent system prompt includes the active priorities document verbatim.

Seed content (user will edit):
```markdown
# My Priorities (season: 2026)
1. Faith — daily practice non-negotiable
2. Family — present at dinner, weekly date night, kids' events > work events
3. Health — 3 workouts/week minimum, sleep by 10:30pm
4. Business — deep work 9–12 weekdays; no meetings before 9
5. Home & Finance — batch on weekends where possible
Conflict rule: family emergencies > everything; otherwise follow order above.
```

### 5.6 `briefings`, `weekly_plans`, `reviews`
```sql
CREATE TABLE briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  content TEXT NOT NULL,            -- final markdown as sent
  inputs JSONB NOT NULL,            -- full snapshot of context used (for debugging + weekly review)
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE weekly_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL UNIQUE,  -- Monday
  content TEXT NOT NULL,
  structured JSONB NOT NULL,        -- {meals: [...], groceries: [...], workouts: [...], chores: [...], family: [...], business_focus: [...]}
  status TEXT DEFAULT 'draft',      -- 'draft' | 'confirmed'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL UNIQUE,
  planned JSONB NOT NULL,
  actual JSONB NOT NULL,            -- completed tasks, calendar as it happened, user's answers to review questions
  insights TEXT NOT NULL,           -- narrative
  proposed_observations JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 5.7 `events_cache`, `chat_messages`, `agent_runs`
- `events_cache`: read-through cache of Google Calendar events (id, calendar_id, title, start, end, location, raw JSONB, synced_at). Refresh on demand with 15-min TTL.
- `chat_messages`: (id, session_id, role, content, agent, created_at) for the chat interface.
- `agent_runs`: (id, agent, trigger, input JSONB, output TEXT, tokens_in, tokens_out, latency_ms, error, created_at) — log EVERY LLM call for debugging and cost tracking.

---

## 6. Agent Architecture

### 6.1 General pattern
All agents are implemented as a single `Agent` class instantiated with different configs — do NOT write 8 separate classes.

```python
@dataclass
class AgentConfig:
    name: str                  # "chief_of_staff", "meals", ...
    system_prompt: str         # template, rendered with context blocks
    tools: list[ToolDef]       # subset of the tool registry
    model: str                 # from settings
    max_context_observations: int = 12
```

Every agent prompt is assembled from ordered blocks:
1. Role definition (who this agent is, what it owns)
2. Active `priorities` document (verbatim)
3. Current date/time/timezone + weather (if relevant)
4. Relevant `observations` (top-N by domain match + semantic similarity to the current query, confidence ≥ 0.5)
5. Domain context (agent-specific structured data — see per-agent specs)
6. Task instructions + output format

### 6.2 Tool registry
Implement as Anthropic tool-use definitions. Shared registry; each agent gets a subset.

| Tool | Description | Access |
|---|---|---|
| `search_knowledge(query, domain?)` | Hybrid search: pgvector similarity over chunks+observations, plus ILIKE over entity names/attributes. Returns top 8 with sources. | all agents |
| `get_entities(type?, name?)` | Structured entity lookup | all agents |
| `upsert_entity(...)` | Create/update entity | chief, home, family, health, finance |
| `list_tasks(domain?, status?, due_before?)` | Query tasks | all agents |
| `create_task(...)` / `complete_task(id)` / `update_task(...)` | Task CRUD | all agents (create is a *proposal* in briefing context — see §6.4) |
| `get_calendar(start, end)` | Read events_cache (refresh if stale) | chief, family, business, health |
| `propose_calendar_event(...)` | Stages an event for user confirmation; never writes directly in v1 | chief, family, health, business |
| `get_weather(days)` | Open-Meteo forecast for configured location | chief, home, meals, health |
| `save_observation(domain, kind, content)` | Insert observation (dedup logic in §5.3 applies) | chief only (review flow) |
| `get_recent_briefings(n)` | Last N briefings | chief |
| `get_weekly_plan(week)` | Current weekly plan | all agents |
| `search_recipes(constraints)` | Search `documents` where domain='meals' | meals |
| `get_finance_summary(month)` | Aggregates from finance tables/CSV imports | finance, chief |

### 6.3 The Chief of Staff agent
**Owns:** synthesis, routing, conflict resolution, daily briefing, and the "what should I do right now" answer.

System prompt core (implement as template in `prompts/chief_of_staff.md`):

```
You are the Chief of Staff for {user_name}'s life. You coordinate seven domain
assistants and hold the complete picture. Your job is never to display data —
it is to make a call. Given everything you know, you tell {user_name} what
matters most right now and why, in his own priority language.

Rules:
- Always resolve conflicts using the Priorities document. Name the tradeoff
  explicitly ("Moving your workout to 6am protects family dinner").
- Be concrete: times, durations, names. Never say "consider" — say "do".
- Surface at most 3 focus items per day. Everything else is "parked" with a reason.
- If context is missing (calendar didn't sync, etc.), say so in one line and proceed.
- Flag anything falling through the cracks: overdue tasks > 7 days, entities with
  overdue maintenance, goals with no scheduled time this week.
```

**Routing (chat mode):** For each user chat message, first call MODEL_FAST with a classification prompt returning JSON `{"domain": "...", "needs_multiple": bool}`. If single domain → run that domain agent with the message. If multiple/ambiguous → Chief of Staff runs with tools and may internally call domain agents (implement domain agents as callable tools for the chief: `ask_domain_agent(domain, question)`).

### 6.4 Domain agents

Each domain agent spec = role + domain context assembly + tools. All share the general pattern.

**HomeAgent** — owns maintenance schedules, projects, seasonal chores.
- Context: entities of type home_system/appliance/vehicle with computed "due" status (compare attributes like `last_serviced` + `service_interval_months` against today; compute in Python, not in the prompt).
- Behaviors: generates recurring maintenance tasks; weekly plan contribution = chores for the week weighted by weather (outdoor tasks on dry days).

**MealsAgent** — owns meal planning and groceries.
- Context: family food preferences/allergies from `entities`, recipe documents, last 4 weeks of meal plans (avoid repetition), calendar (nights with events → quick meals or leftovers).
- Weekly plan contribution: 7 dinners + prep notes + consolidated grocery list grouped by store section. Honors observations like "meal prep on Sundays correlates with weight loss" by defaulting a Sunday prep block.

**FamilyAgent** — owns relationships, events, gifts, kid activities.
- Context: person entities (birthdays, anniversaries, preferences), calendar family events, observations (e.g., "wife prefers local restaurants for date night").
- Behaviors: surfaces upcoming birthdays/anniversaries 14 days out with gift/plan proposals; protects weekly date night and flags weeks where no family time is scheduled.

**HealthAgent** — owns workouts, sleep, medical.
- Context: health goals (documents, domain='health'), workout completion history (tasks domain='health'), medical entities (doctor, medications, appointment cadence).
- Weekly plan contribution: workout schedule fitted around calendar; flags overdue checkups.

**FaithAgent** — owns spiritual practices and commitments.
- Context: user-defined practices (documents domain='faith'), church/community calendar items, observations.
- Behaviors: daily practice slot in briefing; weekly reflection prompt in the weekly plan. Tone: supportive, never preachy or guilt-based; follows the user's stated tradition and practices exactly as the user has defined them — the agent never invents doctrinal content.

**FinanceAgent** — owns budget, bills, subscriptions.
- Context: account entities, recurring bills (tasks with recurrence, domain='finance'), monthly CSV import summaries.
- v1 data flow: user drops bank/card CSV into web UI → Haiku extraction pass normalizes to (date, amount, merchant, category) → stored in `transactions` table (add to migration) → monthly summary computed in SQL, not by the LLM.
- Behaviors: bill-due warnings in daily briefing (3 days out); monthly spend vs budget summary in the first weekly plan of the month. **Never gives investment advice; factual reporting and budget math only.**

**BusinessAgent** — owns work priorities and deep work protection.
- Context: business documents, tasks domain='business', calendar work events.
- Behaviors: proposes the day's "one big thing"; flags calendar fragmentation ("you have no 2-hour block today; tomorrow 9–11 is free — propose moving X").

---

## 7. Core Flows

### 7.1 Daily Briefing (the heart of the system)
**Trigger:** APScheduler at `BRIEFING_HOUR` local time daily. Also on-demand via `POST /briefing/generate` and a "Regenerate" button in the UI.

**Pipeline (implement as `flows/daily_briefing.py`):**
1. **Gather context (parallel, asyncio.gather, each step try/except → placeholder on failure):**
   - Today + next 2 days of calendar events
   - Weather today/tomorrow
   - Open tasks: due today, overdue, scheduled_for today
   - Current weekly plan (today's meals, workout, chores)
   - Active observations (top 12 by domain diversity + recency)
   - Yesterday's briefing (for continuity)
   - Entity alerts (computed maintenance due, birthdays within 14 days, bills within 3 days)
2. **Synthesis call:** single Chief of Staff completion with the full context snapshot. NO tool use in this flow — all context is pre-gathered for speed and determinism.
3. **Output format (enforced in prompt):**
   ```markdown
   # Tuesday, July 7 — Briefing
   **The one thing:** <single most important focus + why>
   ## Today's shape
   <2-4 sentences narrating the day: energy, weather, load>
   ## Focus (max 3)
   1. ...(with time anchors)
   ## Logistics
   - Dinner: ... | Workout: ... | Errands/chores: ...
   ## Watch-outs
   - <cracks: overdue items, upcoming birthdays, bills>
   ## Parked (and why)
   - ...
   ```
4. **Persist** to `briefings` (content + full `inputs` snapshot).
5. **Deliver** via email (rendered markdown → HTML) and Telegram if configured.

Latency budget: < 60s end to end. Log to `agent_runs`.

### 7.2 Weekly Planning
**Trigger:** Sunday `WEEKLY_PLAN_HOUR`, plus on-demand. This flow IS interactive — it produces a **draft**, the user edits/confirms in the web UI.

Pipeline (`flows/weekly_plan.py`):
1. Gather: next 7 days calendar, weather, open tasks by domain, last week's review (if exists), observations, last 4 weekly plans.
2. **Fan-out:** call Meals, Health, Home, Family, Business agents in parallel; each returns its structured contribution (JSON, schema-validated with pydantic; one retry on validation failure).
3. **Chief of Staff merge pass:** resolves conflicts (two things in one time slot, overloaded days), balances the week, writes the narrative plan + final `structured` JSON.
4. Save as `weekly_plans` draft → notify user → user confirms in UI → on confirm: create `tasks` rows (source='weekly_plan') and stage proposed calendar events for one-click approval.

### 7.3 Weekly Review (the learning loop)
**Trigger:** Sunday, 1 hour before weekly planning (so insights feed the new plan).

Pipeline (`flows/weekly_review.py`):
1. Load last week's plan (`planned`) + what happened (`actual`: completed/uncompleted tasks, calendar as it occurred, briefings' inputs).
2. Send user 3–5 short review questions via email/Telegram/UI ("Energy this week 1–5?", "What worked?", "What fell through?"). Proceed after answers OR after 12h timeout with data-only review.
3. Chief of Staff generates: narrative insights + `proposed_observations` (JSON list of {domain, kind, content}).
4. Apply observation dedup/confidence logic (§5.3). New observations shown in UI with accept/reject; accepted → active.

### 7.4 Chat ("What should I be doing right now?")
`POST /chat` → classify → route (§6.3). The literal question "what should I do right now" is special-cased to a mini-briefing: current time block, calendar next 4h, top tasks, today's briefing → Chief of Staff gives ONE answer with reasoning in ≤ 120 words.

### 7.5 Knowledge capture
- Web UI: quick-add box ("Sarah mentioned she wants to try the new Thai place") → MODEL_FAST extraction → proposes entity update / observation / task / document → user confirms.
- Document upload: markdown/text/PDF → stored in `documents`, chunked + embedded.

---

## 8. API Specification (FastAPI)

All endpoints under `/api/v1`. Single-user system → auth is a single bearer token (`API_TOKEN` env var) checked by middleware; web app stores it after a simple login page. Do not build multi-user auth.

| Method | Path | Description |
|---|---|---|
| POST | `/briefing/generate` | Force-generate today's briefing |
| GET | `/briefing/today` · `/briefing/{date}` | Fetch briefing |
| POST | `/weekly-plan/generate` | Generate draft plan for upcoming week |
| GET | `/weekly-plan/current` | Current week's plan |
| POST | `/weekly-plan/{id}/confirm` | Confirm draft (body may include edited `structured`) |
| POST | `/review/answers` | Submit weekly review answers |
| GET | `/review/{week_start}` | Fetch review |
| POST | `/chat` | `{session_id, message}` → streamed response (SSE) with `agent` metadata |
| GET | `/knowledge/search?q=` | Hybrid search (same as agent tool) |
| CRUD | `/entities`, `/tasks`, `/documents` | Standard CRUD |
| GET/POST | `/observations` + `/observations/{id}/accept` `/reject` `/retire` | Memory management |
| GET/PUT | `/priorities` | Read/update priorities (PUT creates new version) |
| GET | `/proposals` + POST `/proposals/{id}/approve` `/reject` | Staged calendar events / external writes |
| POST | `/finance/import` | CSV upload |
| GET | `/admin/runs` | Recent agent_runs (debugging/cost) |
| GET | `/healthz` | DB + scheduler status |

Streaming: `/chat` uses Server-Sent Events; stream tokens as they arrive from the Anthropic API.

---

## 9. Web UI (Next.js)

Five screens, deliberately minimal. Use Tailwind; clean, calm design (this is an anti-anxiety product — no red badges everywhere).

1. **Today** (default): today's briefing rendered as the hero; inline task checkboxes (completing a task hits the API); "What should I do right now?" button → chat modal with the special-cased flow.
2. **Week**: weekly plan draft/confirmed view; editable sections (meals swap, workout move) before confirm; grocery list with check-off + "copy as text".
3. **Chat**: persistent chat sessions; shows which agent answered (small label); message input supports quick-capture prefix "note:" that routes to knowledge capture instead of chat.
4. **Knowledge**: search bar (hybrid search); entity browser by type; document list + upload; observations panel (accept/reject proposed, retire stale) — make memory *visible and editable*, this builds trust.
5. **Settings**: priorities editor (markdown textarea + version history), integration status, briefing time, review questions customization.

---

## 10. Integrations

### Google Calendar (read + staged write)
- OAuth once via a small CLI helper (`scripts/google_auth.py`) → store refresh token in `.env`.
- Read: `events_cache` read-through, 15-min TTL, calendars configurable.
- Write: ONLY via proposals flow (§6.2). On approval, insert event via API.

### Weather
- Open-Meteo (no API key). Lat/long in settings. Cache 1h. Fields: high/low, precipitation probability, summary.

### Email
- Resend (or SMTP fallback) for briefings, weekly plan notifications, review questions. Render markdown → HTML with a minimal template (single column, readable on phone).

### Telegram (optional, feature-flagged)
- Briefing push; review answers via reply; "wsid" (what should I do) command. Skip in Phase 1–2 if time-constrained.

### Todoist (Phase 4+, optional)
- Two-way sync behind a `TaskProvider` interface. v1 uses internal tasks only. Build the interface now, the sync later.

---

## 11. Build Phases & Acceptance Criteria

Build in this exact order. Each phase must meet its acceptance criteria before the next begins.

### Phase 1 — Foundation (Knowledge Hub + skeleton)
Deliverables: repo scaffold, Docker Compose (app+postgres+pgvector), migrations for ALL tables in §5, entity/task/document/priorities CRUD API + minimal UI (Knowledge + Settings screens), embedding pipeline, hybrid search endpoint, seed script (`scripts/seed.py`) with realistic demo data (1 family, 6 entities, 15 tasks, 3 documents, 5 observations, priorities doc).
**Accept when:** `docker compose up` → seeded system → `/knowledge/search?q=when was the HVAC serviced` returns the right entity/chunk.

### Phase 2 — Daily Briefing
Deliverables: Google Calendar + weather integrations, briefing flow (§7.1), scheduler, email delivery, Today screen, agent_runs logging, chat endpoint with Chief of Staff only (no routing yet).
**Accept when:** briefing arrives by email at configured hour containing calendar+weather+tasks synthesis in the §7.1 format; failure of the weather API still produces a briefing.

### Phase 3 — Weekly rhythm + memory
Deliverables: weekly plan flow with Meals/Health/Home fan-out (3 agents only), Week screen with confirm/edit, weekly review flow, observation lifecycle (propose→accept→inject→confidence updates), review insights feed next plan.
**Accept when:** full Sunday cycle runs: review questions → review with ≥1 proposed observation → accepted observation appears in the next weekly plan's context (verify via `inputs` snapshot) and plan draft is confirmable, creating tasks.

### Phase 4 — Full agent roster + routing + polish
Deliverables: Family, Faith, Finance (with CSV import), Business agents; chat routing/classification; `ask_domain_agent` tool for chief; proposals flow for calendar writes; Telegram (optional); quick-capture; admin/cost view.
**Accept when:** "plan a date night for Friday" in chat → FamilyAgent uses preferences from knowledge hub → proposes a calendar event → approval creates it in Google Calendar.

---

## 12. Repository Structure

```
lifeos/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── pyproject.toml
│   ├── alembic/
│   ├── app/
│   │   ├── main.py              # FastAPI app + scheduler startup
│   │   ├── config.py            # pydantic-settings
│   │   ├── db/                  # models.py, session.py
│   │   ├── api/                 # routers per §8
│   │   ├── agents/              # agent.py (generic), configs.py, tools/
│   │   ├── prompts/             # *.md templates, one per agent + flows
│   │   ├── flows/               # daily_briefing.py, weekly_plan.py, weekly_review.py
│   │   ├── integrations/        # gcal.py, weather.py, email.py, telegram.py
│   │   ├── knowledge/           # embeddings.py, chunking.py, search.py, observations.py
│   │   └── scheduler.py
│   └── tests/
├── frontend/                    # Next.js app
└── scripts/                     # seed.py, google_auth.py
```

---

## 13. Testing Requirements

- **Unit:** chunking, observation dedup/confidence math, maintenance-due computation, CSV normalization, RRULE expansion. Target: these are pure functions — test exhaustively.
- **Integration:** each flow end-to-end with mocked LLM (fixture responses) + mocked integrations; hybrid search against a test DB with known fixtures.
- **LLM contract tests** (run manually / on demand, hit real API): weekly-plan agent outputs validate against pydantic schemas 5/5 runs; briefing output contains all required sections.
- **Failure injection:** kill weather + calendar mocks → briefing still generates with missing-context notes.
- All prompts live in versioned `.md` files — never inline strings — so they can be iterated without code changes.

## 14. Non-Functional Requirements

- **Cost guardrail:** log tokens per run; daily briefing ≤ ~30k input tokens (trim observations/docs by relevance); monthly cost estimate visible in admin view.
- **Privacy:** this is maximally sensitive personal data. Single-tenant, no analytics/telemetry, DB volume encrypted at rest if host supports it, daily `pg_dump` backup to a configurable path, `.env` never committed.
- **Latency:** briefing < 60s; chat first token < 3s (stream); weekly plan < 3min.
- **Idempotency:** briefing/plan generation for an existing date/week overwrites (upsert), never duplicates.
- **Timezone correctness:** ALL scheduling in the user's configured timezone; store timestamps as UTC, convert at the edge.

## 15. Explicit Guidance for Claude Code

1. Build phases strictly in order (§11); stop and verify acceptance criteria between phases.
2. One generic `Agent` class + configs — resist per-agent class hierarchies.
3. Pre-gather context for scheduled flows (no tool-use loops in briefings); tool-use loops are for chat only.
4. Compute anything computable (dates due, sums, calendar gaps) in Python/SQL — the LLM narrates and decides, it does not do arithmetic.
5. Validate every structured LLM output with pydantic; one retry with the validation error appended, then fail soft.
6. Keep prompts in `backend/app/prompts/*.md` with `{placeholders}`; add a `make render-prompt AGENT=meals` debug command that prints a fully rendered prompt with seed data.
7. Seed data must be rich enough that every flow is demoable without real integrations (add `MOCK_INTEGRATIONS=true` mode).
