"""Phase 3: observation lifecycle math + review learning loop (spec §5.3, §7.3)."""

from app.db.models import Observation
from app.flows.weekly_review import _fallback_proposals, _parse_review_output
from app.knowledge.observations import (
    CONFIDENCE_CAP,
    CONFIDENCE_STEP,
    _reinforce,
)


def test_reinforce_increments_evidence_and_confidence():
    obs = Observation(domain="meals", kind="pattern", content="x", confidence=0.6, evidence_count=2)
    _reinforce(obs)
    assert obs.evidence_count == 3
    assert abs(obs.confidence - (0.6 + CONFIDENCE_STEP)) < 1e-9
    assert obs.last_confirmed_at is not None


def test_reinforce_caps_confidence():
    obs = Observation(domain="meals", kind="pattern", content="x", confidence=0.9, evidence_count=1)
    _reinforce(obs)  # 0.9 + 0.1 = 1.0 → capped at 0.95
    assert obs.confidence == CONFIDENCE_CAP


def test_fallback_proposals_always_nonempty():
    ctx = {"week_start": "2026-07-06", "planned_count": 5, "completed_count": 2, "lagging_domain": "home"}
    proposals = _fallback_proposals(ctx)
    assert len(proposals) >= 1
    assert any(p["domain"] == "general" for p in proposals)  # completion-rate fact
    assert any(p["domain"] == "home" for p in proposals)  # lagging-domain pattern


def test_fallback_proposals_without_lagging_domain():
    ctx = {"week_start": "2026-07-06", "planned_count": 3, "completed_count": 3, "lagging_domain": None}
    proposals = _fallback_proposals(ctx)
    assert len(proposals) >= 1


def test_parse_review_output_with_json_marker():
    text = (
        "# Weekly Review\n## Insights\n- solid week\n"
        '---JSON---\n[{"domain":"health","kind":"pattern","content":"early workouts stick"}]'
    )
    narrative, proposals = _parse_review_output(text)
    assert "solid week" in narrative
    assert proposals and proposals[0]["domain"] == "health"


def test_parse_review_output_without_marker_signals_fallback():
    narrative, proposals = _parse_review_output("# Review\nnarrative only")
    assert proposals is None
    assert "narrative only" in narrative
