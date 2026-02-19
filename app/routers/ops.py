from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.config import APP_MODE, CONFIG_VALID
from app.metrics import get_metrics_snapshot
from app.security import enforce_api_rate_limit, get_security_runtime_snapshot, require_role


router = APIRouter(prefix="/api/ops", tags=["Ops"])


@router.get("/metrics")
async def get_ops_metrics(
    request: Request,
    user: dict = Depends(require_role("admin")),
):
    enforce_api_rate_limit(
        request,
        bucket="ops-metrics",
        limit=90,
        window_seconds=60,
        user_email=user.get("email"),
    )
    return get_metrics_snapshot(include_routes=True, top_n=20)


@router.get("/runtime")
async def get_ops_runtime(
    request: Request,
    user: dict = Depends(require_role("admin")),
):
    enforce_api_rate_limit(
        request,
        bucket="ops-runtime",
        limit=120,
        window_seconds=60,
        user_email=user.get("email"),
    )
    metrics = get_metrics_snapshot(include_routes=False)
    return {
        "mode": APP_MODE,
        "config_valid": CONFIG_VALID,
        "metrics": metrics.get("totals", {}),
        "security": get_security_runtime_snapshot(),
    }
