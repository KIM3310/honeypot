from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

from app.services.demo_pipeline import generate_demo_handover


REPO_ROOT = Path(__file__).resolve().parents[1]


def _artifact(label: str, path: str, kind: str) -> Optional[Dict[str, str]]:
    if not (REPO_ROOT / path).exists():
        return None
    return {
        "label": label,
        "path": path,
        "kind": kind,
    }


def _artifacts(specs: Iterable[Tuple[str, str, str]]) -> List[Dict[str, str]]:
    artifacts: List[Dict[str, str]] = []
    for label, path, kind in specs:
        item = _artifact(label, path, kind)
        if item is not None:
            artifacts.append(item)
    return artifacts


def _count_files(path: Path, pattern: str) -> int:
    if not path.exists():
        return 0
    return len(list(path.glob(pattern)))


def _build_watchouts(*, config_valid: bool, mode: str) -> List[str]:
    watchouts = [
        "Prototype mode still uses in-memory refresh-token and CSRF stores.",
        "Fine-grained document RBAC at retrieval time is not implemented in this prototype.",
    ]
    if mode == "demo":
        watchouts.append(
            "The backend is in demo mode by design; treat it as a walkthrough path, not the live Azure stack."
        )
    if not config_valid:
        watchouts.append(
            "Cloud configuration is incomplete, so the service cannot demonstrate the full Azure-backed pipeline yet."
        )
    return watchouts


def _build_handover_completeness_gate(sample: Optional[Dict[str, object]] = None) -> Dict[str, object]:
    handover = sample or generate_demo_handover("")
    missing_fields: List[str] = []

    projects = list(handover.get("ongoingProjects", []) or [])
    priorities = list(handover.get("priorities", []) or [])
    resources = handover.get("resources", {}) or {}
    risks = handover.get("risks", {}) or {}
    transferor = (handover.get("overview", {}) or {}).get("transferor", {}) or {}
    transferee = (handover.get("overview", {}) or {}).get("transferee", {}) or {}

    if not str(transferor.get("name") or "").strip() or not str(transferee.get("name") or "").strip():
        missing_fields.append("owner coverage")
    if not any(str(item.get("deadline") or "").strip() for item in priorities + projects):
        missing_fields.append("timeline coverage")
    if not str(risks.get("issues") or "").strip() and not str(risks.get("risks") or "").strip():
        missing_fields.append("risk coverage")
    if not list(resources.get("docs", []) or []) and not list(resources.get("systems", []) or []) and not list(resources.get("contacts", []) or []):
        missing_fields.append("reference coverage")

    score_pct = max(0, 100 - len(missing_fields) * 25)
    return {
        "schema": "honeypot-handover-completeness-v1",
        "score_pct": score_pct,
        "review_ready": len(missing_fields) == 0,
        "missing_fields": missing_fields,
        "required_checks": [
            "owner coverage",
            "timeline coverage",
            "risk coverage",
            "reference coverage",
        ],
    }


def build_honeypot_approval_matrix(*, config_valid: bool, mode: str) -> Dict[str, object]:
    completeness_gate = _build_handover_completeness_gate()
    return {
        "service": "honeypot",
        "contract_version": "honeypot-approval-matrix-v1",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "summary": {
            "review_ready": completeness_gate["review_ready"],
            "completeness_score": completeness_gate["score_pct"],
            "runtime_mode": mode,
            "config_valid": config_valid,
        },
        "roles": [
            {
                "role": "transferor",
                "required": ["owner coverage", "timeline coverage"],
                "status": "ready" if "owner coverage" not in completeness_gate["missing_fields"] else "needs-review",
            },
            {
                "role": "reviewer",
                "required": ["risk coverage", "reference coverage"],
                "status": "ready" if completeness_gate["review_ready"] else "needs-review",
            },
            {
                "role": "approver",
                "required": ["config valid or explicit demo posture", "ops runtime visible"],
                "status": "ready" if config_valid or mode == "demo" else "blocked",
            },
        ],
        "review_actions": [
            "Open the approval matrix before claiming the draft is ready for delivery.",
            "Treat missing coverage as a handoff blocker, not an editorial footnote.",
            "Keep ops runtime and approval matrix paired during reviewer walkthroughs.",
        ],
        "links": {
            "approval_matrix": "/api/approval-matrix",
            "runtime_brief": "/api/runtime-brief",
            "runtime_scorecard": "/api/runtime-scorecard",
            "review_summary": "/api/review-summary",
            "handover_schema": "/api/schema/handover",
        },
    }


def build_honeypot_service_meta(
    *,
    allowed_origins_count: int,
    config_valid: bool,
    error_rate: float,
    errors_total: int,
    mode: str,
    requests_total: int,
) -> Dict[str, object]:
    test_files = _count_files(REPO_ROOT / "tests", "test_*.py")
    deployment_guides = len(
        [
            path
            for path in (
                REPO_ROOT / "docs/deployment/DEPLOYMENT_GUIDE.md",
                REPO_ROOT / "docs/deployment/RAILWAY_DEPLOYMENT.md",
                REPO_ROOT / "docs/integration/CONNECTION_GUIDE.md",
                REPO_ROOT / "docs/deployment/CLOUDFLARE_PAGES.md",
                REPO_ROOT / "docs/deployment/ELECTRON_GUIDE.md",
            )
            if path.exists()
        ]
    )
    ops_artifacts = len(
        [
            path
            for path in (
                REPO_ROOT / "docs/ops/RUNBOOK.md",
                REPO_ROOT / "docs/ops/POSTMORTEM_TEMPLATE.md",
                REPO_ROOT / "tests" / "test_ops_metrics.py",
                REPO_ROOT / "tests" / "test_security_runtime.py",
            )
            if path.exists()
        ]
    )
    frontend_surfaces = len(list((REPO_ROOT / "frontend" / "components").glob("*.tsx")))

    stages = [
        {
            "key": "ingest",
            "label": "Ingest and Validation",
            "readiness": "ready",
            "artifact_count": 4,
            "highlights": _artifacts(
                [
                    ("Upload router", "app/routers/upload.py", "endpoint"),
                    ("Input validation tests", "tests/test_input_validation.py", "test"),
                    ("Upload authz tests", "tests/test_upload_authz.py", "test"),
                    ("Source sidebar surface", "frontend/components/SourceSidebar.tsx", "surface"),
                ]
            ),
        },
        {
            "key": "structure",
            "label": "Structure and Extraction",
            "readiness": "ready",
            "artifact_count": 4,
            "highlights": _artifacts(
                [
                    ("Document service", "app/services/document_service.py", "endpoint"),
                    ("Prompt templates", "app/services/prompts.py", "endpoint"),
                    ("Runbook", "docs/ops/RUNBOOK.md", "doc"),
                    ("Handover form", "frontend/components/HandoverForm.tsx", "surface"),
                ]
            ),
        },
        {
            "key": "retrieve",
            "label": "Retrieve and Search",
            "readiness": "ready",
            "artifact_count": 4,
            "highlights": _artifacts(
                [
                    ("Search service", "app/services/search_service.py", "endpoint"),
                    ("BYO LLM override test", "tests/test_llm_override.py", "test"),
                    ("Assistant service", "frontend/services/assistantService.ts", "surface"),
                    ("Connection guide", "docs/integration/CONNECTION_GUIDE.md", "doc"),
                ]
            ),
        },
        {
            "key": "draft",
            "label": "Draft and Collaboration",
            "readiness": "ready",
            "artifact_count": 4,
            "highlights": _artifacts(
                [
                    ("Analyze router", "app/routers/chat.py", "endpoint"),
                    ("Chat window", "frontend/components/ChatWindow.tsx", "surface"),
                    ("Print template", "frontend/components/HandoverPrintTemplate.tsx", "surface"),
                    ("Frontend README", "frontend/README.md", "doc"),
                ]
            ),
        },
        {
            "key": "review",
            "label": "Operator Review and Runtime",
            "readiness": "ready",
            "artifact_count": 4,
            "highlights": _artifacts(
                [
                    ("Ops runtime route", "app/routers/ops.py", "endpoint"),
                    ("Security runtime tests", "tests/test_security_runtime.py", "test"),
                    ("Ops metrics tests", "tests/test_ops_metrics.py", "test"),
                    ("Postmortem template", "docs/ops/POSTMORTEM_TEMPLATE.md", "doc"),
                ]
            ),
        },
    ]
    completeness_gate = _build_handover_completeness_gate()

    watchouts = _build_watchouts(config_valid=config_valid, mode=mode)

    return {
        "service": "honeypot",
        "contract_version": "honeypot-service-meta-v1",
        "tagline": "AI-assisted handover generation with Azure retrieval and operator review",
        "maturity_stage": "prototype with operational controls",
        "runtime": {
            "mode": mode,
            "config_valid": config_valid,
            "allowed_origins_count": allowed_origins_count,
            "requests_total": requests_total,
            "errors_total": errors_total,
            "error_rate": error_rate,
            "security_headers_enabled": True,
            "auth_controls": [
                "jwt-access-token",
                "refresh-token",
                "csrf-header",
                "route-rate-limit",
            ],
        },
        "evidence": {
            "test_files": test_files,
            "deployment_guides": deployment_guides,
            "ops_artifacts": ops_artifacts,
            "frontend_surfaces": frontend_surfaces,
        },
        "platforms": [
            "azure-blob-storage",
            "azure-document-intelligence",
            "azure-ai-search",
            "azure-openai",
            "gemini-preprocess",
            "local-byo-llm",
            "electron",
        ],
        "strengths": [
            "The service covers upload, structure extraction, retrieval, draft generation, and operator review in one product surface.",
            "Azure-native retrieval architecture is paired with local BYO LLM override support for offline demos.",
            "JWT, refresh-token, CSRF rotation, security headers, and ops runtime endpoints make the prototype operationally legible.",
            "The interactive editor, print template, and follow-up chat keep the handover flow grounded in practical output.",
        ],
        "watchouts": watchouts,
        "completeness_gate": completeness_gate,
        "two_minute_review": [
            "Open /api/health to confirm runtime mode and the next diagnostics step.",
            "Read /api/runtime-brief for trust boundary, review flow, and watchouts.",
            "Read /api/runtime-scorecard to understand route pressure and security posture before live claims.",
            "Open /api/approval-matrix before treating the draft as reviewer-ready.",
            "Inspect /api/schema/handover before trusting draft structure claims.",
            "Open /api/ops/runtime before claiming live Azure-backed readiness.",
        ],
        "proof_assets": _artifacts(
            [
                ("Health Route", "app/main.py", "endpoint"),
                ("Runtime Brief Builder", "app/service_meta.py", "endpoint"),
                ("Runtime Scorecard Builder", "app/runtime_scorecard.py", "endpoint"),
                ("Ops Runtime Route", "app/routers/ops.py", "endpoint"),
                ("Approval Matrix Route", "app/main.py", "endpoint"),
                ("Readiness Board", "frontend/components/ServiceReadinessBoard.tsx", "surface"),
            ]
        ),
        "stages": stages,
        "review_flow": [
            {
                "order": 1,
                "title": "Login and issue a CSRF-protected session",
                "endpoint": "/api/auth/login",
                "persona": "operator",
            },
            {
                "order": 2,
                "title": "Upload source documents into the selected index",
                "endpoint": "/api/upload",
                "persona": "operator",
            },
            {
                "order": 3,
                "title": "Generate the editable handover draft",
                "endpoint": "/api/analyze",
                "persona": "buyer",
            },
            {
                "order": 4,
                "title": "Ask retrieval-backed follow-up questions",
                "endpoint": "/api/chat",
                "persona": "operator",
            },
            {
                "order": 5,
                "title": "Inspect runtime diagnostics and security posture",
                "endpoint": "/api/ops/runtime",
                "persona": "security",
            },
        ],
        "links": {
            "health": "/api/health",
            "meta": "/api/meta",
            "runtime_brief": "/api/runtime-brief",
            "runtime_scorecard": "/api/runtime-scorecard",
            "approval_matrix": "/api/approval-matrix",
            "review_summary": "/api/review-summary",
            "handover_schema": "/api/schema/handover",
            "ops_metrics": "/api/ops/metrics",
            "ops_runtime": "/api/ops/runtime",
            "runbook": "docs/ops/RUNBOOK.md",
            "deployment_guide": "docs/deployment/DEPLOYMENT_GUIDE.md",
            "railway_deployment": "docs/deployment/RAILWAY_DEPLOYMENT.md",
        },
    }


def build_handover_schema() -> Dict[str, object]:
    return {
        "schema": "honeypot-handover-v1",
        "required_sections": [
            "overview",
            "jobStatus",
            "priorities",
            "stakeholders",
            "teamMembers",
            "ongoingProjects",
            "risks",
            "resources",
            "checklist",
        ],
        "required_overview_fields": [
            "transferor.name",
            "transferor.position",
            "transferee.name",
            "transferee.position",
        ],
        "delivery_modes": [
            "interactive-editor",
            "print-template",
            "retrieval-backed-chat",
        ],
        "operator_rules": [
            "Generated handover drafts require human review before production use.",
            "State-changing endpoints require both JWT and X-CSRF-Token.",
            "Ops runtime surfaces remain admin-only.",
        ],
        "links": {
            "meta": "/api/meta",
            "health": "/api/health",
            "runtime_brief": "/api/runtime-brief",
            "review_summary": "/api/review-summary",
        },
    }


def build_honeypot_runtime_brief(
    *,
    allowed_origins_count: int,
    config_valid: bool,
    error_rate: float,
    errors_total: int,
    mode: str,
    requests_total: int,
) -> Dict[str, object]:
    schema = build_handover_schema()
    watchouts = _build_watchouts(config_valid=config_valid, mode=mode)
    retrieval_mode = (
        "azure-ai-search + azure-openai + gemini-preprocess"
        if config_valid and mode != "demo"
        else "demo retrieval with local BYO LLM override support"
    )
    generation_boundary = (
        "generation: azure-openai drives draft and chat responses"
        if config_valid and mode != "demo"
        else "generation: demo draft path stays local-first with optional BYO LLM override"
    )
    completeness_gate = _build_handover_completeness_gate()

    return {
        "service": "honeypot",
        "status": "ok",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "readiness_contract": "honeypot-runtime-brief-v1",
        "headline": "Azure-native handover workflow with visible controls from login to editable draft.",
        "runtime_mode": mode,
        "auth_mode": "jwt-access-token + refresh-token + csrf-header",
        "retrieval_mode": retrieval_mode,
        "request_volume": {
            "requests_total": requests_total,
            "errors_total": errors_total,
            "error_rate": error_rate,
        },
        "review_pack": {
            "required_sections": len(schema["required_sections"]),
            "delivery_modes": len(schema["delivery_modes"]),
            "allowed_origins_count": allowed_origins_count,
        },
        "report_contract": {
            "schema": schema["schema"],
            "required_sections": schema["required_sections"],
            "delivery_modes": schema["delivery_modes"],
        },
        "trust_boundary": [
            f"ingest: {'azure-document-intelligence' if config_valid and mode != 'demo' else 'demo parser + docx local support'}",
            "retrieve: azure-ai-search indexes enterprise handover evidence",
            generation_boundary,
            "override: per-request BYO LLM path stays optional and operator-controlled",
            "review: auth, csrf, ops runtime, and printable handover surface stay explicit",
        ],
        "review_flow": [
            "Issue a CSRF-protected session through /api/auth/login.",
            "Upload source materials through /api/upload.",
            "Generate the editable handover draft through /api/analyze.",
            "Use /api/chat for retrieval-backed follow-up questions.",
            "Read /api/runtime-scorecard for route pressure and security posture.",
            "Open /api/ops/runtime for route-by-route diagnostics before production claims.",
        ],
        "two_minute_review": [
            "Open /api/health to confirm whether the service is demo or live-configured.",
            "Read /api/runtime-scorecard for request pressure, alert count, and security posture.",
            "Read /api/runtime-brief for trust boundary, delivery modes, and watchouts.",
            "Open /api/approval-matrix before trusting a generated draft as handoff-ready.",
            "Inspect /api/schema/handover before trusting the editor contract.",
            "Open /api/ops/runtime before making production-readiness claims.",
        ],
        "watchouts": watchouts,
        "completeness_gate": completeness_gate,
        "proof_assets": [
            {"label": "Health", "path": "/api/health", "kind": "endpoint", "why": "Confirms whether the service is demo or live-configured before a review."},
            {"label": "Runtime Scorecard", "path": "/api/runtime-scorecard", "kind": "endpoint", "why": "Summarizes route pressure, top alerts, and security posture in one compact payload."},
            {"label": "Runtime Brief", "path": "/api/runtime-brief", "kind": "endpoint", "why": "Pins trust boundary, delivery modes, and runtime watchouts in one payload."},
            {"label": "Approval Matrix", "path": "/api/approval-matrix", "kind": "endpoint", "why": "Makes role coverage and handoff blockers explicit before delivery claims."},
            {"label": "Handover Schema", "path": "/api/schema/handover", "kind": "endpoint", "why": "Locks the editor and export contract before trusting draft structure claims."},
            {"label": "Ops Runtime", "path": "/api/ops/runtime", "kind": "endpoint", "why": "Shows route-by-route diagnostics before any production-readiness claim."},
        ],
        "links": {
            "health": "/api/health",
            "meta": "/api/meta",
            "runtime_brief": "/api/runtime-brief",
            "runtime_scorecard": "/api/runtime-scorecard",
            "approval_matrix": "/api/approval-matrix",
            "handover_schema": "/api/schema/handover",
            "review_summary": "/api/review-summary",
            "ops_runtime": "/api/ops/runtime",
            "ops_metrics": "/api/ops/metrics",
        },
    }


def build_honeypot_review_summary(
    *,
    allowed_origins_count: int,
    config_valid: bool,
    error_rate: float,
    errors_total: int,
    mode: str,
    requests_total: int,
) -> Dict[str, object]:
    service_meta = build_honeypot_service_meta(
        allowed_origins_count=allowed_origins_count,
        config_valid=config_valid,
        error_rate=error_rate,
        errors_total=errors_total,
        mode=mode,
        requests_total=requests_total,
    )
    runtime_brief = build_honeypot_runtime_brief(
        allowed_origins_count=allowed_origins_count,
        config_valid=config_valid,
        error_rate=error_rate,
        errors_total=errors_total,
        mode=mode,
        requests_total=requests_total,
    )

    stages = list(service_meta.get("stages", []))
    ready_stage_count = sum(1 for stage in stages if stage.get("readiness") == "ready")
    attention_stage_count = len(stages) - ready_stage_count
    proof_assets = list(runtime_brief.get("proof_assets", []))
    watchouts = list(runtime_brief.get("watchouts", []))
    auth_controls = list(service_meta.get("runtime", {}).get("auth_controls", []))
    completeness_gate = _build_handover_completeness_gate()

    return {
        "service": "honeypot",
        "contract_version": "honeypot-review-summary-v1",
        "headline": "Runtime snapshot for the Azure handover workflow, from session issuance to ops diagnostics.",
        "snapshot": {
            "mode": mode,
            "config_valid": config_valid,
            "allowed_origins_count": allowed_origins_count,
            "requests_total": requests_total,
            "errors_total": errors_total,
            "error_rate": error_rate,
            "ready_stage_count": ready_stage_count,
            "attention_stage_count": attention_stage_count,
            "proof_asset_count": len(proof_assets),
            "completeness_score": completeness_gate["score_pct"],
        },
        "runtime_summary": {
            "auth_controls": auth_controls,
            "retrieval_mode": runtime_brief.get("retrieval_mode"),
            "report_schema": runtime_brief.get("report_contract", {}).get("schema"),
            "review_ready": completeness_gate["review_ready"],
            "review_endpoints": [
                "/api/health",
                "/api/runtime-scorecard",
                "/api/runtime-brief",
                "/api/approval-matrix",
                "/api/review-summary",
                "/api/schema/handover",
                "/api/ops/runtime",
            ],
        },
        "top_assets": proof_assets[:3],
        "fastest_review_path": [
            "/api/health",
            "/api/review-summary",
            "/api/runtime-scorecard",
            "/api/runtime-brief",
            "/api/approval-matrix",
            "/api/schema/handover",
        ],
        "stage_highlights": [
            {
                "key": stage.get("key"),
                "label": stage.get("label"),
                "readiness": stage.get("readiness"),
                "artifact_count": stage.get("artifact_count"),
            }
            for stage in stages[:3]
        ],
        "top_watchouts": watchouts[:2],
        "links": {
            "health": "/api/health",
            "meta": "/api/meta",
            "runtime_brief": "/api/runtime-brief",
            "runtime_scorecard": "/api/runtime-scorecard",
            "approval_matrix": "/api/approval-matrix",
            "review_summary": "/api/review-summary",
            "review_summary_schema": "/api/review-summary/schema",
            "handover_schema": "/api/schema/handover",
            "ops_runtime": "/api/ops/runtime",
        },
    }


def build_honeypot_review_summary_schema() -> Dict[str, object]:
    return {
        "schema": "honeypot-review-summary-v1",
        "required_fields": [
            "service",
            "contract_version",
            "snapshot.mode",
            "snapshot.ready_stage_count",
            "runtime_summary.report_schema",
            "fastest_review_path",
            "links.runtime_scorecard",
            "links.review_summary",
        ],
        "links": {
            "health": "/api/health",
            "meta": "/api/meta",
            "runtime_brief": "/api/runtime-brief",
            "runtime_scorecard": "/api/runtime-scorecard",
            "approval_matrix": "/api/approval-matrix",
            "review_summary": "/api/review-summary",
        },
    }
