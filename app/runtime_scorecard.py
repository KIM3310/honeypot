from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def _calc_runtime_score(*, request_volume: int, error_rate: float, alert_count: int) -> int:
    score = 100
    if request_volume == 0:
        score -= 8
    if error_rate >= 20:
        score -= 25
    elif error_rate >= 10:
        score -= 15
    elif error_rate >= 5:
        score -= 8
    score -= min(alert_count * 4, 20)
    return max(40, score)


def _build_latency_status(*, p95_latency_ms: int, error_rate: float) -> str:
    if error_rate >= 10 or p95_latency_ms >= 1800:
        return "needs-attention"
    if error_rate >= 3 or p95_latency_ms >= 900:
        return "watch"
    return "stable"


def build_runtime_scorecard(
    *,
    allowed_origins_count: int,
    config_valid: bool,
    mode: str,
    metrics: dict[str, Any],
    route_diagnostics: dict[str, Any],
    security: dict[str, Any],
) -> dict[str, Any]:
    totals = metrics.get("totals", {})
    hottest_routes = list(route_diagnostics.get("hottest_routes", []))
    slowest_routes = list(route_diagnostics.get("slowest_routes", []))
    error_prone_routes = list(route_diagnostics.get("error_prone_routes", []))
    alerts = list(route_diagnostics.get("alerts", []))
    top_hot_route = hottest_routes[0] if hottest_routes else {}
    top_slow_route = slowest_routes[0] if slowest_routes else {}
    top_error_route = error_prone_routes[0] if error_prone_routes else {}

    error_rate = float(totals.get("error_rate", 0.0))
    request_volume = int(totals.get("requests", 0))
    latency_status = _build_latency_status(
        p95_latency_ms=int(top_slow_route.get("p95_latency_ms", 0)),
        error_rate=error_rate,
    )
    score = _calc_runtime_score(
        request_volume=request_volume,
        error_rate=error_rate,
        alert_count=len(alerts),
    )

    return {
        "status": "ok",
        "service": "honeypot",
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "readiness_contract": "honeypot-runtime-scorecard-v1",
        "headline": "Compact runtime scorecard for route health, delivery posture, and operator-visible security controls.",
        "summary": {
            "runtime_score": score,
            "delivery_mode": "live-ready" if config_valid and mode != "demo" else "demo-safe",
            "latency_status": latency_status,
            "error_rate": error_rate,
            "request_volume": request_volume,
            "alert_count": len(alerts),
        },
        "runtime": {
            "mode": mode,
            "config_valid": config_valid,
            "allowed_origins_count": allowed_origins_count,
            "tracked_routes": int(totals.get("routes", 0)),
            "max_tracked_routes": int(totals.get("max_tracked_routes", 0)),
            "route_overflow_requests": int(totals.get("route_overflow_requests", 0)),
        },
        "route_health": {
            "hottest_route": top_hot_route,
            "slowest_route": top_slow_route,
            "error_prone_route": top_error_route,
            "alerts": alerts[:5],
        },
        "security_posture": {
            "csrf_tokens": int(security.get("csrf_tokens", 0)),
            "refresh_tokens": int(security.get("refresh_tokens", 0)),
            "login_rate_keys": int(security.get("login_rate_keys", 0)),
            "api_rate_keys": int(security.get("api_rate_keys", 0)),
        },
        "fastest_review_path": [
            "/api/health",
            "/api/runtime-scorecard",
            "/api/runtime-brief",
            "/api/ops/runtime",
        ],
        "links": {
            "health": "/api/health",
            "runtime_brief": "/api/runtime-brief",
            "runtime_scorecard": "/api/runtime-scorecard",
            "review_summary": "/api/review-summary",
            "ops_runtime": "/api/ops/runtime",
            "ops_metrics": "/api/ops/metrics",
        },
    }
