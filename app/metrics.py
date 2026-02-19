from __future__ import annotations

import os
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class RouteMetric:
    count: int = 0
    errors: int = 0
    total_latency_ms: int = 0
    recent_latency_ms: deque = field(default_factory=lambda: deque(maxlen=400))


_LOCK = threading.Lock()
_STARTED_AT = int(time.time())
_TOTAL_REQUESTS = 0
_TOTAL_ERRORS = 0
_ROUTE_OVERFLOW_REQUESTS = 0
_ROUTES: Dict[str, RouteMetric] = {}
MAX_TRACKED_ROUTES = max(1, int(os.getenv("METRICS_MAX_ROUTES", "500")))
OVERFLOW_ROUTE_PATH = "/__overflow__"


def _calc_p95(values: List[int]) -> int:
    if not values:
        return 0
    data = sorted(values)
    idx = int(round((len(data) - 1) * 0.95))
    return int(data[max(0, min(idx, len(data) - 1))])


def _resolve_route_key(method: str, path: str) -> tuple[str, bool]:
    route_key = f"{method.upper()} {path}"
    if route_key in _ROUTES:
        return route_key, False

    # Keep one slot for the overflow bucket to avoid unbounded cardinality.
    overflow_key = f"* {OVERFLOW_ROUTE_PATH}"
    route_capacity_without_overflow = max(0, MAX_TRACKED_ROUTES - 1)
    if len(_ROUTES) < route_capacity_without_overflow:
        return route_key, False
    return overflow_key, True


def record_request(method: str, path: str, status_code: int, latency_ms: int) -> None:
    global _TOTAL_REQUESTS, _TOTAL_ERRORS, _ROUTE_OVERFLOW_REQUESTS
    with _LOCK:
        route_key, overflowed = _resolve_route_key(method, path)
        if overflowed:
            _ROUTE_OVERFLOW_REQUESTS += 1

        _TOTAL_REQUESTS += 1
        if status_code >= 400:
            _TOTAL_ERRORS += 1

        route = _ROUTES.get(route_key)
        if route is None:
            route = RouteMetric()
            _ROUTES[route_key] = route

        route.count += 1
        if status_code >= 400:
            route.errors += 1
        route.total_latency_ms += max(0, int(latency_ms))
        route.recent_latency_ms.append(max(0, int(latency_ms)))


def get_metrics_snapshot(*, include_routes: bool = True, top_n: int = 15) -> dict:
    with _LOCK:
        totals = {
            "uptime_seconds": max(0, int(time.time()) - _STARTED_AT),
            "requests": _TOTAL_REQUESTS,
            "errors": _TOTAL_ERRORS,
            "error_rate": (round((_TOTAL_ERRORS / _TOTAL_REQUESTS) * 100, 2) if _TOTAL_REQUESTS else 0.0),
            "routes": len(_ROUTES),
            "route_overflow_requests": _ROUTE_OVERFLOW_REQUESTS,
            "max_tracked_routes": MAX_TRACKED_ROUTES,
        }

        if not include_routes:
            return {"totals": totals}

        route_items = []
        for route_key, metric in _ROUTES.items():
            avg_ms = int(metric.total_latency_ms / metric.count) if metric.count else 0
            p95_ms = _calc_p95(list(metric.recent_latency_ms))
            route_items.append(
                {
                    "route": route_key,
                    "count": metric.count,
                    "errors": metric.errors,
                    "error_rate": (round((metric.errors / metric.count) * 100, 2) if metric.count else 0.0),
                    "avg_latency_ms": avg_ms,
                    "p95_latency_ms": p95_ms,
                }
            )

        route_items.sort(key=lambda item: item["count"], reverse=True)
        return {"totals": totals, "routes": route_items[: max(1, int(top_n))]}


def reset_metrics_for_tests() -> None:
    global _STARTED_AT, _TOTAL_REQUESTS, _TOTAL_ERRORS, _ROUTE_OVERFLOW_REQUESTS
    with _LOCK:
        _STARTED_AT = int(time.time())
        _TOTAL_REQUESTS = 0
        _TOTAL_ERRORS = 0
        _ROUTE_OVERFLOW_REQUESTS = 0
        _ROUTES.clear()
