"""Seed realistic demo data (spec §11 Phase 1).

Idempotent: if entities already exist, it exits without duplicating. Run via
`python -m scripts.seed` from the backend working directory (done automatically
by docker-compose on `app` startup).

Produces: 1 family (people entities), 8 entities total, 15 tasks, 3 documents
(chunked + embedded), 5 observations (embedded), and the active priorities doc —
enough that Phase 1 hybrid search is demoable with no real integrations.
"""

from __future__ import annotations

import asyncio
from datetime import date, timedelta

from sqlalchemy import func, select

from app.db.models import Document, Entity, Observation, Priority, Task
from app.db.session import SessionLocal
from app.knowledge.embeddings import get_embedding_provider
from app.knowledge.indexing import embed_observation, reindex_document

TODAY = date.today()


PRIORITIES_SEED = """# My Priorities (season: 2026)
1. Faith — daily practice non-negotiable
2. Family — present at dinner, weekly date night, kids' events > work events
3. Health — 3 workouts/week minimum, sleep by 10:30pm
4. Business — deep work 9–12 weekdays; no meetings before 9
5. Home & Finance — batch on weekends where possible
Conflict rule: family emergencies > everything; otherwise follow order above.
"""


def _entities() -> list[Entity]:
    return [
        Entity(
            type="person",
            name="Sarah",
            attributes={
                "relationship": "wife",
                "birthday": "1988-04-02",
                "food_preferences": ["Italian", "local restaurants"],
                "date_night_notes": "prefers local restaurants over chains",
                "domain": "family",
            },
            notes="Wife. Anniversary June 14. Loves the new Thai place downtown.",
        ),
        Entity(
            type="person",
            name="Micah",
            attributes={"relationship": "son", "birthday": "2016-09-20", "age": 9, "domain": "family"},
            notes="Son, 9. Soccer on Tuesdays. Allergic to peanuts.",
        ),
        Entity(
            type="person",
            name="Ada",
            attributes={"relationship": "daughter", "birthday": "2019-11-30", "age": 6, "domain": "family"},
            notes="Daughter, 6. Ballet on Thursdays.",
        ),
        Entity(
            type="home_system",
            name="HVAC",
            attributes={
                "filter_size": "20x25x1",
                "last_serviced": "2026-03-01",
                "service_interval_months": 6,
                "domain": "home",
            },
            notes="Central HVAC. Filter swapped monthly; professional service every 6 months.",
        ),
        Entity(
            type="vehicle",
            name="Honda Odyssey",
            attributes={
                "oil_change_due_miles": 52000,
                "current_miles": 49800,
                "year": 2021,
                "domain": "home",
            },
            notes="Family minivan. Oil change due at 52,000 miles.",
        ),
        Entity(
            type="appliance",
            name="Refrigerator",
            attributes={"brand": "LG", "water_filter_interval_months": 6, "last_filter": "2026-02-15", "domain": "home"},
            notes="LG French-door fridge. Water filter every 6 months.",
        ),
        Entity(
            type="business",
            name="Andrews Consulting",
            attributes={"role": "founder", "focus": "deep work 9-12 weekdays", "domain": "business"},
            notes="Solo consulting practice. Protect morning deep-work blocks.",
        ),
        Entity(
            type="account",
            name="Chase Checking",
            attributes={"kind": "checking", "institution": "Chase", "domain": "finance"},
            notes="Primary household checking account.",
        ),
    ]


def _tasks(by_name: dict[str, Entity]) -> list[Task]:
    hvac = by_name["HVAC"]
    odyssey = by_name["Honda Odyssey"]
    return [
        Task(title="Morning prayer + reading", domain="faith", priority=1,
             scheduled_for=TODAY, recurrence="FREQ=DAILY", effort_min=20, source="recurring"),
        Task(title="Replace HVAC filter (20x25x1)", domain="home", priority=3,
             due_date=TODAY + timedelta(days=5), entity_id=hvac.id, effort_min=15),
        Task(title="Schedule Odyssey oil change", domain="home", priority=3,
             due_date=TODAY + timedelta(days=10), entity_id=odyssey.id, effort_min=10),
        Task(title="Plan Sarah's birthday (Apr 2)", domain="family", priority=2,
             due_date=date(TODAY.year, 4, 2), effort_min=60),
        Task(title="Micah soccer practice pickup", domain="family", priority=2,
             scheduled_for=TODAY, recurrence="FREQ=WEEKLY;BYDAY=TU", effort_min=30, source="recurring"),
        Task(title="Ada ballet — Thursday", domain="family", priority=2,
             recurrence="FREQ=WEEKLY;BYDAY=TH", effort_min=30, source="recurring"),
        Task(title="Weekly date night with Sarah", domain="family", priority=2,
             recurrence="FREQ=WEEKLY;BYDAY=FR", effort_min=120, source="recurring"),
        Task(title="Deep work: client proposal", domain="business", priority=1,
             scheduled_for=TODAY, due_date=TODAY + timedelta(days=2), effort_min=180),
        Task(title="Invoice Q2 clients", domain="business", priority=2,
             due_date=TODAY + timedelta(days=3), effort_min=45),
        Task(title="Strength workout", domain="health", priority=2,
             scheduled_for=TODAY, recurrence="FREQ=WEEKLY;BYDAY=MO,WE,FR", effort_min=45, source="recurring"),
        Task(title="Annual physical checkup", domain="health", priority=3,
             due_date=TODAY + timedelta(days=25), effort_min=60),
        Task(title="Sunday meal prep block", domain="meals", priority=3,
             recurrence="FREQ=WEEKLY;BYDAY=SU", effort_min=90, source="recurring"),
        Task(title="Pay electric bill", domain="finance", priority=2,
             due_date=TODAY + timedelta(days=2), effort_min=10),
        Task(title="Review monthly budget", domain="finance", priority=3,
             due_date=TODAY + timedelta(days=7), effort_min=30),
        Task(title="Overdue: fix leaky garage faucet", domain="home", priority=3,
             due_date=TODAY - timedelta(days=9), effort_min=30),
    ]


def _documents() -> list[Document]:
    return [
        Document(
            title="HVAC Maintenance Log",
            domain="home",
            content=(
                "# HVAC Maintenance Log\n\n"
                "The central HVAC system was last serviced on 2026-03-01 by Cool Air Pros. "
                "The technician replaced the capacitor and cleaned the condenser coils. "
                "Filter size is 20x25x1 and should be swapped monthly. "
                "Professional service is scheduled every 6 months, so the next service is due 2026-09-01.\n\n"
                "## Notes\n"
                "System runs well below 78F. Recurring reminder set for filter changes."
            ),
        ),
        Document(
            title="Health Goals 2026",
            domain="health",
            content=(
                "# Health Goals 2026\n\n"
                "Target three strength workouts per week, minimum. "
                "Sleep by 10:30pm on weeknights. "
                "Annual physical is due in late July.\n\n"
                "## Observations\n"
                "Workouts scheduled before 7am get completed far more often than evening ones."
            ),
        ),
        Document(
            title="Weeknight Dinner Ideas",
            domain="meals",
            content=(
                "# Weeknight Dinner Ideas\n\n"
                "Family favorites that avoid peanuts (Micah's allergy):\n\n"
                "## Quick meals\n"
                "- Sheet-pan chicken and vegetables\n"
                "- Turkey tacos with local salsa\n"
                "- Pasta with marinara (Sarah loves Italian)\n\n"
                "## Prep notes\n"
                "Sunday meal prep makes weeknights much smoother."
            ),
        ),
    ]


def _observations() -> list[Observation]:
    return [
        Observation(domain="health", kind="pattern", confidence=0.8, evidence_count=4,
                    content="User completes workouts far more often when scheduled before 7am."),
        Observation(domain="family", kind="preference", confidence=0.7, evidence_count=3,
                    content="Sarah prefers local restaurants over chains for date night."),
        Observation(domain="meals", kind="pattern", confidence=0.65, evidence_count=2,
                    content="Sunday meal prep correlates with fewer takeout nights during the week."),
        Observation(domain="business", kind="preference", confidence=0.75, evidence_count=3,
                    content="Deep work between 9am and noon is the most productive block; no meetings before 9."),
        Observation(domain="faith", kind="fact", confidence=0.9, evidence_count=5,
                    content="Daily morning practice is a non-negotiable anchor for the day."),
    ]


async def seed() -> None:
    embedder = get_embedding_provider()
    async with SessionLocal() as db:
        existing = await db.scalar(select(func.count()).select_from(Entity))
        if existing:
            print(f"[seed] {existing} entities already present — skipping seed.")
            return

        # Entities
        entities = _entities()
        db.add_all(entities)
        await db.flush()
        by_name = {e.name: e for e in entities}

        # Tasks
        db.add_all(_tasks(by_name))

        # Documents (chunk + embed each)
        docs = _documents()
        db.add_all(docs)
        await db.flush()
        for doc in docs:
            await reindex_document(db, doc, embedder)

        # Observations (embed each)
        obs = _observations()
        for o in obs:
            await embed_observation(o, embedder)
        db.add_all(obs)

        # Priorities (version 1, active)
        db.add(Priority(version=1, content=PRIORITIES_SEED, active=True))

        await db.commit()
        print(
            f"[seed] inserted {len(entities)} entities, {len(_tasks(by_name))} tasks, "
            f"{len(docs)} documents, {len(obs)} observations, 1 priorities doc."
        )


if __name__ == "__main__":
    asyncio.run(seed())
