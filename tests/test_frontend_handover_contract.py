from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HANDOVER_FORM = ROOT / "frontend" / "components" / "HandoverForm.tsx"


def test_handover_form_exposes_reviewer_gate_copy() -> None:
    source = HANDOVER_FORM.read_text(encoding="utf-8")
    assert "Reviewer handoff" in source
    assert "Export unlock checklist" in source
    assert "Next reviewer action" in source
    assert "Reviewer snapshot" in source
    assert "Review evidence snapshot" in source
