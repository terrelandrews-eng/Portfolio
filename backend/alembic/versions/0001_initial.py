"""initial schema — Knowledge Hub (spec §5)

Revision ID: 0001_initial
Revises:
Create Date: 2026-07-04
"""

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects.postgresql import JSONB, UUID

from app.config import get_settings

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

DIM = get_settings().embedding_dim


def _uuid_col():
    return sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()"))


def upgrade():
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")  # gen_random_uuid()

    op.create_table(
        "entities",
        _uuid_col(),
        sa.Column("type", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("attributes", JSONB(), nullable=False, server_default="{}"),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_entities_type", "entities", ["type"])

    op.create_table(
        "tasks",
        _uuid_col(),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("domain", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="open"),
        sa.Column("due_date", sa.Date()),
        sa.Column("scheduled_for", sa.Date()),
        sa.Column("effort_min", sa.Integer()),
        sa.Column("priority", sa.Integer(), server_default="3"),
        sa.Column("recurrence", sa.Text()),
        sa.Column("entity_id", UUID(as_uuid=True), sa.ForeignKey("entities.id")),
        sa.Column("source", sa.Text(), server_default="user"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("completed_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_tasks_domain", "tasks", ["domain"])
    op.create_index("ix_tasks_status", "tasks", ["status"])

    op.create_table(
        "observations",
        _uuid_col(),
        sa.Column("domain", sa.Text(), nullable=False),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), server_default="0.5"),
        sa.Column("evidence_count", sa.Integer(), server_default="1"),
        sa.Column("status", sa.Text(), server_default="active"),
        sa.Column("embedding", Vector(DIM)),
        sa.Column("last_confirmed_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index(
        "ix_observations_embedding",
        "observations",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )

    op.create_table(
        "documents",
        _uuid_col(),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("domain", sa.Text()),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("entity_id", UUID(as_uuid=True), sa.ForeignKey("entities.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "chunks",
        _uuid_col(),
        sa.Column(
            "document_id",
            UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(DIM)),
        sa.Column("chunk_index", sa.Integer()),
    )
    op.create_index(
        "ix_chunks_embedding",
        "chunks",
        ["embedding"],
        postgresql_using="hnsw",
        postgresql_ops={"embedding": "vector_cosine_ops"},
    )

    op.create_table(
        "priorities",
        _uuid_col(),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "briefings",
        _uuid_col(),
        sa.Column("date", sa.Date(), nullable=False, unique=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("inputs", JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "weekly_plans",
        _uuid_col(),
        sa.Column("week_start", sa.Date(), nullable=False, unique=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("structured", JSONB(), nullable=False, server_default="{}"),
        sa.Column("status", sa.Text(), server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "reviews",
        _uuid_col(),
        sa.Column("week_start", sa.Date(), nullable=False, unique=True),
        sa.Column("planned", JSONB(), nullable=False, server_default="{}"),
        sa.Column("actual", JSONB(), nullable=False, server_default="{}"),
        sa.Column("insights", sa.Text(), nullable=False),
        sa.Column("proposed_observations", JSONB(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "events_cache",
        _uuid_col(),
        sa.Column("external_id", sa.Text()),
        sa.Column("calendar_id", sa.Text()),
        sa.Column("title", sa.Text()),
        sa.Column("start", sa.DateTime(timezone=True)),
        sa.Column("end", sa.DateTime(timezone=True)),
        sa.Column("location", sa.Text()),
        sa.Column("raw", JSONB(), server_default="{}"),
        sa.Column("synced_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "chat_messages",
        _uuid_col(),
        sa.Column("session_id", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("agent", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )
    op.create_index("ix_chat_messages_session", "chat_messages", ["session_id"])

    op.create_table(
        "agent_runs",
        _uuid_col(),
        sa.Column("agent", sa.Text(), nullable=False),
        sa.Column("trigger", sa.Text()),
        sa.Column("input", JSONB(), server_default="{}"),
        sa.Column("output", sa.Text()),
        sa.Column("tokens_in", sa.Integer()),
        sa.Column("tokens_out", sa.Integer()),
        sa.Column("latency_ms", sa.Integer()),
        sa.Column("error", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "transactions",
        _uuid_col(),
        sa.Column("date", sa.Date()),
        sa.Column("amount", sa.Float()),
        sa.Column("merchant", sa.Text()),
        sa.Column("category", sa.Text()),
        sa.Column("entity_id", UUID(as_uuid=True), sa.ForeignKey("entities.id")),
        sa.Column("raw", JSONB(), server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.UniqueConstraint("date", "amount", "merchant", name="uq_txn_natural"),
    )


def downgrade():
    for table in [
        "transactions",
        "agent_runs",
        "chat_messages",
        "events_cache",
        "reviews",
        "weekly_plans",
        "briefings",
        "priorities",
        "chunks",
        "documents",
        "observations",
        "tasks",
        "entities",
    ]:
        op.drop_table(table)
