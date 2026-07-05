"""Phase 4: deterministic routing + finance CSV normalization (spec §6.3, §6.4)."""

from datetime import date

from app.flows.finance import _categorize, _parse_amount, normalize_csv
from app.flows.routing import _keyword_classify


def test_routing_single_domain():
    assert _keyword_classify("plan a date night for Friday") == {"domain": "family", "needs_multiple": False}
    assert _keyword_classify("what's for dinner tonight")["domain"] == "meals"
    assert _keyword_classify("schedule my workout")["domain"] == "health"
    assert _keyword_classify("pay the electric bill")["domain"] == "finance"


def test_routing_multi_domain_goes_to_chief():
    r = _keyword_classify("balance my workout with the client proposal deadline")
    assert r == {"domain": "chief", "needs_multiple": True}


def test_routing_unknown_goes_to_chief():
    assert _keyword_classify("hello there") == {"domain": "chief", "needs_multiple": False}


def test_parse_amount_variants():
    assert _parse_amount("$1,234.50") == 1234.50
    assert _parse_amount("(12.34)") == -12.34
    assert _parse_amount("  45.00 ") == 45.0
    assert _parse_amount("") is None


def test_categorize_by_keyword():
    assert _categorize("Whole Foods Market") == "Groceries"
    assert _categorize("Shell Gas #123") == "Transport"
    assert _categorize("Netflix.com") == "Subscriptions"
    assert _categorize("Local Thai Restaurant") == "Dining"
    assert _categorize("Mystery Vendor") == "Other"


def test_normalize_csv_headers_and_rows():
    csv_text = (
        "Date,Description,Amount,Category\n"
        "2026-07-01,Whole Foods Market,84.20,\n"
        "07/02/2026,Shell Gas,45.00,Transport\n"
        "bad,row,here,\n"  # unparseable date → skipped
    )
    rows = normalize_csv(csv_text)
    assert len(rows) == 2
    assert rows[0] == {"date": date(2026, 7, 1), "amount": 84.20, "merchant": "Whole Foods Market", "category": "Groceries"}
    # explicit category column is honored over the keyword guess
    assert rows[1]["category"] == "Transport"
    assert rows[1]["date"] == date(2026, 7, 2)
