"""Finance CSV import + monthly summary (spec §6.4 FinanceAgent).

v1 data flow: user drops a bank/card CSV → normalize to (date, amount, merchant,
category) → `transactions`. Normalization is deterministic (header detection + keyword
categorization) so it runs offline; the monthly summary is computed in SQL, not by the
LLM (spec §15.4). Factual reporting only — never investment advice.
"""

from __future__ import annotations

import csv
import io
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Transaction

# Merchant keyword → category (used when the CSV has no category column).
_CATEGORY_RULES = [
    ("Utilities", ("electric", "utility", "water", "gas company", "power", "internet", "comcast")),
    ("Groceries", ("grocery", "market", "whole foods", "trader", "aldi", "kroger", "safeway")),
    ("Dining", ("restaurant", "cafe", "coffee", "thai", "pizza", "grill", "diner", "starbucks")),
    ("Transport", ("uber", "lyft", "shell", "chevron", "exxon", "gas", "transit", "parking")),
    ("Shopping", ("amazon", "target", "walmart", "store", "shop")),
    ("Subscriptions", ("netflix", "spotify", "hulu", "subscription", "prime", "icloud")),
    ("Health", ("pharmacy", "cvs", "walgreens", "clinic", "doctor", "dental")),
]

_DATE_FORMATS = ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%d/%m/%Y")


def _categorize(merchant: str) -> str:
    m = merchant.lower()
    for category, keywords in _CATEGORY_RULES:
        if any(k in m for k in keywords):
            return category
    return "Other"


def _parse_amount(raw: str) -> float | None:
    if raw is None:
        return None
    cleaned = raw.replace("$", "").replace(",", "").strip()
    if cleaned in ("", "-"):
        return None
    neg = cleaned.startswith("(") and cleaned.endswith(")")  # (12.34) accounting negatives
    cleaned = cleaned.strip("()")
    try:
        val = float(cleaned)
    except ValueError:
        return None
    return -val if neg else val


def _parse_date(raw: str) -> date | None:
    raw = (raw or "").strip()
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        return None


def _pick(header: list[str], *candidates: str) -> str | None:
    lower = {h.lower().strip(): h for h in header}
    for cand in candidates:
        if cand in lower:
            return lower[cand]
    # substring match fallback
    for key, original in lower.items():
        if any(cand in key for cand in candidates):
            return original
    return None


def normalize_csv(text: str) -> list[dict]:
    """Parse a bank/card CSV into normalized transaction dicts. Skips unparseable rows."""
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return []
    header = list(reader.fieldnames)
    date_col = _pick(header, "date", "transaction date", "posted date")
    amount_col = _pick(header, "amount", "debit", "value")
    merchant_col = _pick(header, "merchant", "description", "name", "payee")
    category_col = _pick(header, "category")

    out: list[dict] = []
    for row in reader:
        d = _parse_date(row.get(date_col, "")) if date_col else None
        amount = _parse_amount(row.get(amount_col, "")) if amount_col else None
        merchant = (row.get(merchant_col, "") or "").strip() if merchant_col else ""
        if d is None or amount is None or not merchant:
            continue
        category = (row.get(category_col, "") or "").strip() if category_col else ""
        out.append(
            {
                "date": d,
                "amount": amount,
                "merchant": merchant,
                "category": category or _categorize(merchant),
            }
        )
    return out


async def import_csv(db: AsyncSession, text: str) -> dict:
    rows = normalize_csv(text)
    imported = 0
    skipped = 0
    for r in rows:
        exists = await db.scalar(
            select(Transaction).where(
                Transaction.date == r["date"],
                Transaction.amount == r["amount"],
                Transaction.merchant == r["merchant"],
            )
        )
        if exists:
            skipped += 1
            continue
        db.add(Transaction(date=r["date"], amount=r["amount"], merchant=r["merchant"], category=r["category"]))
        imported += 1
    await db.commit()

    month = rows[0]["date"].strftime("%Y-%m") if rows else None
    summary = await monthly_summary(db, month)
    return {"imported": imported, "skipped": skipped, "month_summary": summary}


async def monthly_summary(db: AsyncSession, month: str | None = None) -> dict:
    """Spend by category for a YYYY-MM month (defaults to the latest month with data)."""
    if not month:
        latest = await db.scalar(select(Transaction.date).order_by(Transaction.date.desc()).limit(1))
        month = latest.strftime("%Y-%m") if latest else datetime.now().strftime("%Y-%m")

    year, mon = (int(x) for x in month.split("-"))
    start = date(year, mon, 1)
    end = date(year + (mon == 12), (mon % 12) + 1, 1)

    txns = list(
        (await db.scalars(select(Transaction).where(Transaction.date >= start, Transaction.date < end))).all()
    )
    by_category: dict[str, float] = {}
    total = 0.0
    for t in txns:
        amt = t.amount or 0.0
        by_category[t.category or "Other"] = round(by_category.get(t.category or "Other", 0.0) + amt, 2)
        total += amt

    return {
        "month": month,
        "total": round(total, 2),
        "by_category": by_category,
        "transaction_count": len(txns),
    }
