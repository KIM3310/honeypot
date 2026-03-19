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
    assert "Verification route" in source
    assert "/api/runtime-scorecard" in source


def test_handover_form_exposes_first_secure_workflow_copy() -> None:
    source = HANDOVER_FORM.read_text(encoding="utf-8")
    assert "First secure workflow" in source
    assert "manual review 완료 후에만 파일 export를 엽니다." in source
