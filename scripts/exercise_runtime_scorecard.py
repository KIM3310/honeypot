from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.main import app


async def _run() -> None:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        login = await client.post(
            "/api/auth/login",
            json={"email": "admin@company.local", "password": "AdminDemo!2026"},
        )
        login.raise_for_status()
        access_token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {access_token}"}

        await client.get("/api/health")
        await client.get("/api/runtime-brief")
        await client.get("/api/review-summary")
        await client.get("/api/runtime-scorecard")
        ops_runtime = await client.get("/api/ops/runtime", headers=headers)
        ops_runtime.raise_for_status()
        scorecard = await client.get("/api/runtime-scorecard")
        scorecard.raise_for_status()

    body = scorecard.json()
    print(
        json.dumps(
            {
                "contract": body["readiness_contract"],
                "summary": body["summary"],
                "security_posture": body["security_posture"],
                "alerts": body["route_health"]["alerts"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    asyncio.run(_run())
