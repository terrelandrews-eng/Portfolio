"""Pydantic request/response schemas for the CRUD + search API."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- Entities ----
class EntityBase(BaseModel):
    type: str
    name: str
    attributes: dict = Field(default_factory=dict)
    notes: str | None = None


class EntityCreate(EntityBase):
    pass


class EntityUpdate(BaseModel):
    type: str | None = None
    name: str | None = None
    attributes: dict | None = None
    notes: str | None = None


class EntityOut(ORMModel, EntityBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# ---- Tasks ----
class TaskBase(BaseModel):
    title: str
    description: str | None = None
    domain: str
    status: str = "open"
    due_date: date | None = None
    scheduled_for: date | None = None
    effort_min: int | None = None
    priority: int = 3
    recurrence: str | None = None
    entity_id: uuid.UUID | None = None
    source: str = "user"


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    domain: str | None = None
    status: str | None = None
    due_date: date | None = None
    scheduled_for: date | None = None
    effort_min: int | None = None
    priority: int | None = None
    recurrence: str | None = None
    entity_id: uuid.UUID | None = None


class TaskOut(ORMModel, TaskBase):
    id: uuid.UUID
    created_at: datetime
    completed_at: datetime | None = None


# ---- Documents ----
class DocumentBase(BaseModel):
    title: str
    domain: str | None = None
    content: str
    entity_id: uuid.UUID | None = None


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    title: str | None = None
    domain: str | None = None
    content: str | None = None
    entity_id: uuid.UUID | None = None


class DocumentOut(ORMModel, DocumentBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# ---- Priorities ----
class PriorityOut(ORMModel):
    id: uuid.UUID
    version: int
    content: str
    active: bool
    created_at: datetime


class PriorityUpdate(BaseModel):
    content: str


# ---- Briefings ----
class BriefingOut(ORMModel):
    id: uuid.UUID
    date: date
    content: str
    created_at: datetime


# ---- Weekly plan (Phase 3) ----
class WeeklyPlanOut(ORMModel):
    id: uuid.UUID
    week_start: date
    content: str
    structured: dict = Field(default_factory=dict)
    status: str
    created_at: datetime


class WeeklyPlanConfirm(BaseModel):
    structured: dict | None = None


class WeeklyPlanConfirmResult(BaseModel):
    plan_id: str
    status: str
    tasks_created: int


# ---- Weekly review (Phase 3) ----
class ReviewOut(ORMModel):
    id: uuid.UUID
    week_start: date
    planned: dict = Field(default_factory=dict)
    actual: dict = Field(default_factory=dict)
    insights: str
    proposed_observations: dict = Field(default_factory=dict)
    created_at: datetime


class ReviewAnswers(BaseModel):
    week_start: date | None = None
    answers: dict[str, str] = Field(default_factory=dict)


class ReviewQuestions(BaseModel):
    week_start: date
    questions: list[str]


# ---- Observations (Phase 3) ----
class ObservationOut(ORMModel):
    id: uuid.UUID
    domain: str
    kind: str
    content: str
    confidence: float
    evidence_count: int
    status: str
    last_confirmed_at: datetime | None = None
    created_at: datetime


class ObservationCreate(BaseModel):
    domain: str
    kind: str = "pattern"
    content: str


# ---- Proposals (Phase 4) ----
class ProposalOut(ORMModel):
    id: uuid.UUID
    kind: str
    status: str
    summary: str
    payload: dict = Field(default_factory=dict)
    source: str | None = None
    agent: str | None = None
    result: dict = Field(default_factory=dict)
    created_at: datetime


# ---- Capture (Phase 4) ----
class CaptureRequest(BaseModel):
    text: str


class CaptureResponse(BaseModel):
    proposals: list[ProposalOut]


# ---- Finance (Phase 4) ----
class FinanceImportResult(BaseModel):
    imported: int
    skipped: int
    month_summary: dict


class FinanceSummary(BaseModel):
    month: str
    total: float
    by_category: dict[str, float]
    transaction_count: int


# ---- Chat ----
class ChatRequest(BaseModel):
    session_id: str
    message: str


# ---- Admin ----
class AgentRunOut(ORMModel):
    id: uuid.UUID
    agent: str
    trigger: str | None = None
    tokens_in: int | None = None
    tokens_out: int | None = None
    latency_ms: int | None = None
    error: str | None = None
    created_at: datetime


# ---- Search ----
class SearchResult(BaseModel):
    source: str
    id: str
    title: str
    snippet: str
    score: float
    domain: str | None = None


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
