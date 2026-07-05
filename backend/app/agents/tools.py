"""Shared tool registry (spec §6.2). Anthropic tool-use definitions + implementations.

Each agent is granted a subset via AGENT_TOOLS. The real-LLM chat loop passes the
relevant defs to the model and dispatches calls through `execute_tool`. Writes to the
outside world are always staged as proposals — `propose_calendar_event` never writes
directly (spec §6.2, §10).
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Entity, Task, WeeklyPlan
from app.flows.proposals import create_proposal
from app.integrations import gcal, weather
from app.knowledge.embeddings import get_embedding_provider
from app.knowledge.search import hybrid_search

# ---- Anthropic tool-use definitions ----
TOOL_DEFS: dict[str, dict] = {
    "search_knowledge": {
        "name": "search_knowledge",
        "description": "Hybrid search over documents, observations, and entities. Returns top matches with sources.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string"},
                "domain": {"type": "string", "description": "optional domain filter"},
            },
            "required": ["query"],
        },
    },
    "get_entities": {
        "name": "get_entities",
        "description": "Look up entities (people, home systems, vehicles, accounts) by type and/or name.",
        "input_schema": {
            "type": "object",
            "properties": {"type": {"type": "string"}, "name": {"type": "string"}},
        },
    },
    "list_tasks": {
        "name": "list_tasks",
        "description": "Query tasks by domain/status/due date.",
        "input_schema": {
            "type": "object",
            "properties": {
                "domain": {"type": "string"},
                "status": {"type": "string"},
                "due_before": {"type": "string", "description": "ISO date"},
            },
        },
    },
    "create_task": {
        "name": "create_task",
        "description": "Create a task.",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "domain": {"type": "string"},
                "due_date": {"type": "string", "description": "ISO date"},
                "priority": {"type": "integer"},
            },
            "required": ["title", "domain"],
        },
    },
    "get_calendar": {
        "name": "get_calendar",
        "description": "Read calendar events between two ISO dates.",
        "input_schema": {
            "type": "object",
            "properties": {"start": {"type": "string"}, "end": {"type": "string"}},
            "required": ["start", "end"],
        },
    },
    "propose_calendar_event": {
        "name": "propose_calendar_event",
        "description": "Stage a calendar event for the user to approve. Never writes directly.",
        "input_schema": {
            "type": "object",
            "properties": {
                "summary": {"type": "string"},
                "start": {"type": "string", "description": "ISO datetime"},
                "end": {"type": "string", "description": "ISO datetime"},
                "location": {"type": "string"},
            },
            "required": ["summary", "start", "end"],
        },
    },
    "get_weather": {
        "name": "get_weather",
        "description": "Weather forecast for the configured location, N days out.",
        "input_schema": {
            "type": "object",
            "properties": {"days": {"type": "integer"}},
        },
    },
    "get_weekly_plan": {
        "name": "get_weekly_plan",
        "description": "The current weekly plan (structured).",
        "input_schema": {"type": "object", "properties": {}},
    },
    "save_observation": {
        "name": "save_observation",
        "description": "Propose a durable observation (pattern/preference/fact) to remember.",
        "input_schema": {
            "type": "object",
            "properties": {
                "domain": {"type": "string"},
                "kind": {"type": "string"},
                "content": {"type": "string"},
            },
            "required": ["domain", "content"],
        },
    },
    "get_finance_summary": {
        "name": "get_finance_summary",
        "description": "Monthly spend summary by category from imported transactions.",
        "input_schema": {
            "type": "object",
            "properties": {"month": {"type": "string", "description": "YYYY-MM"}},
        },
    },
}

# Per-agent tool access (spec §6.2 access column).
_COMMON = ["search_knowledge", "get_entities", "list_tasks", "create_task", "get_weekly_plan"]
AGENT_TOOLS: dict[str, list[str]] = {
    "chief_of_staff": list(TOOL_DEFS.keys()),  # chief gets everything (incl. ask_domain_agent, added in chat_agent)
    "meals": _COMMON + ["get_weather"],
    "health": _COMMON + ["get_weather", "get_calendar", "propose_calendar_event"],
    "home": _COMMON + ["get_weather"],
    "family": _COMMON + ["get_calendar", "propose_calendar_event"],
    "faith": _COMMON + ["get_calendar"],
    "finance": _COMMON + ["get_finance_summary"],
    "business": _COMMON + ["get_calendar", "propose_calendar_event"],
}


def tool_defs_for(agent: str) -> list[dict]:
    return [TOOL_DEFS[name] for name in AGENT_TOOLS.get(agent, _COMMON) if name in TOOL_DEFS]


async def execute_tool(db: AsyncSession, name: str, args: dict, agent: str | None = None) -> dict:
    """Dispatch a tool call. Returns a JSON-serializable result for the model."""
    if name == "search_knowledge":
        hits = await hybrid_search(db, args["query"], get_embedding_provider(), args.get("domain"))
        return {"results": hits[:8]}

    if name == "get_entities":
        stmt = select(Entity)
        if args.get("type"):
            stmt = stmt.where(Entity.type == args["type"])
        if args.get("name"):
            stmt = stmt.where(Entity.name.ilike(f"%{args['name']}%"))
        rows = list((await db.scalars(stmt.limit(20))).all())
        return {"entities": [{"id": str(e.id), "type": e.type, "name": e.name, "attributes": e.attributes, "notes": e.notes} for e in rows]}

    if name == "list_tasks":
        stmt = select(Task)
        if args.get("domain"):
            stmt = stmt.where(Task.domain == args["domain"])
        if args.get("status"):
            stmt = stmt.where(Task.status == args["status"])
        if args.get("due_before"):
            stmt = stmt.where(Task.due_date.is_not(None), Task.due_date <= date.fromisoformat(args["due_before"]))
        rows = list((await db.scalars(stmt.limit(30))).all())
        return {"tasks": [{"id": str(t.id), "title": t.title, "domain": t.domain, "status": t.status, "due_date": t.due_date.isoformat() if t.due_date else None} for t in rows]}

    if name == "create_task":
        task = Task(title=args["title"], domain=args["domain"], priority=args.get("priority", 3),
                    due_date=date.fromisoformat(args["due_date"]) if args.get("due_date") else None, source="chat")
        db.add(task)
        await db.commit()
        await db.refresh(task)
        return {"task_id": str(task.id), "title": task.title}

    if name == "get_calendar":
        events = await gcal.get_events(db, date.fromisoformat(args["start"]), date.fromisoformat(args["end"]))
        return {"events": [{"title": e["title"], "start": e["start"].isoformat() if e.get("start") else None, "location": e.get("location")} for e in events]}

    if name == "propose_calendar_event":
        p = await create_proposal(
            db,
            kind="calendar_event",
            summary=f"Add to calendar: {args['summary']}",
            payload={"summary": args["summary"], "start": args["start"], "end": args["end"], "location": args.get("location")},
            source="chat",
            agent=agent,
        )
        return {"proposal_id": str(p.id), "status": "pending", "summary": p.summary}

    if name == "get_weather":
        return {"forecast": await weather.get_weather(args.get("days", 3))}

    if name == "get_weekly_plan":
        plan = await db.scalar(select(WeeklyPlan).order_by(WeeklyPlan.week_start.desc()).limit(1))
        return {"plan": plan.structured if plan else None}

    if name == "save_observation":
        from app.knowledge.observations import apply_proposed_observations
        summary = await apply_proposed_observations(
            db, [{"domain": args["domain"], "kind": args.get("kind", "fact"), "content": args["content"]}],
            get_embedding_provider(),
        )
        await db.commit()
        return summary

    if name == "get_finance_summary":
        from app.flows.finance import monthly_summary
        return await monthly_summary(db, args.get("month"))

    return {"error": f"unknown tool: {name}"}
