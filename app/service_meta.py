from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple


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
                REPO_ROOT / "DEPLOYMENT_GUIDE.md",
                REPO_ROOT / "RAILWAY_DEPLOYMENT.md",
                REPO_ROOT / "CONNECTION_GUIDE.md",
                REPO_ROOT / "CLOUDFLARE_PAGES.md",
                REPO_ROOT / "ELECTRON_GUIDE.md",
            )
            if path.exists()
        ]
    )
    ops_artifacts = len(
        [
            path
            for path in (
                REPO_ROOT / "RUNBOOK.md",
                REPO_ROOT / "POSTMORTEM_TEMPLATE.md",
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
                    ("Runbook", "RUNBOOK.md", "doc"),
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
                    ("Connection guide", "CONNECTION_GUIDE.md", "doc"),
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
                    ("Postmortem template", "POSTMORTEM_TEMPLATE.md", "doc"),
                ]
            ),
        },
    ]

    watchouts = [
        "Prototype mode still uses in-memory refresh-token and CSRF stores.",
        "Fine-grained document RBAC at retrieval time is not implemented in this prototype.",
    ]
    if mode == "demo":
        watchouts.append(
            "The backend is in demo mode. Live Azure Blob/Search/OpenAI and Gemini paths are not active."
        )
    if not config_valid:
        watchouts.append(
            "Cloud configuration is incomplete, so the service cannot demonstrate the full Azure-backed pipeline yet."
        )

    return {
        "service": "honeypot",
        "contract_version": "honeypot-service-meta-v1",
        "tagline": "AI-assisted handover generation with Azure retrieval and operator review",
        "maturity_stage": "prototype with service-grade controls",
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
            "Azure-native retrieval architecture is paired with local BYO LLM override support for reviewer-friendly demos.",
            "JWT, refresh-token, CSRF rotation, security headers, and ops runtime endpoints make the prototype operationally legible.",
            "The interactive editor, print template, and follow-up chat keep the handover flow grounded in practical output.",
        ],
        "watchouts": watchouts,
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
            "handover_schema": "/api/schema/handover",
            "ops_metrics": "/api/ops/metrics",
            "ops_runtime": "/api/ops/runtime",
            "runbook": "RUNBOOK.md",
            "deployment_guide": "DEPLOYMENT_GUIDE.md",
            "railway_deployment": "RAILWAY_DEPLOYMENT.md",
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
        },
    }
