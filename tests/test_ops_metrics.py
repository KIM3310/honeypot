import asyncio
import unittest

import httpx

from app.main import app


class TestOpsMetrics(unittest.TestCase):
    def test_ops_metrics_admin_only(self) -> None:
        async def _run() -> None:
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                # unauthenticated
                unauth = await client.get("/api/ops/metrics")
                self.assertEqual(unauth.status_code, 403)

                # non-admin
                login_user = await client.post(
                    "/api/auth/login",
                    json={"email": "user1@company.com", "password": "password123"},
                )
                self.assertEqual(login_user.status_code, 200)
                user_token = login_user.json()["access_token"]

                forbidden = await client.get(
                    "/api/ops/metrics",
                    headers={"Authorization": f"Bearer {user_token}"},
                )
                self.assertEqual(forbidden.status_code, 403)

                # probe a dynamic-path endpoint to ensure route template metrics are used
                not_found_status = await client.get(
                    "/api/upload/status/not-a-real-task-id",
                    headers={"Authorization": f"Bearer {user_token}"},
                )
                self.assertEqual(not_found_status.status_code, 404)

                # admin
                login_admin = await client.post(
                    "/api/auth/login",
                    json={"email": "admin@company.com", "password": "admin123"},
                )
                self.assertEqual(login_admin.status_code, 200)
                admin_token = login_admin.json()["access_token"]

                ok = await client.get(
                    "/api/ops/metrics",
                    headers={"Authorization": f"Bearer {admin_token}"},
                )
                self.assertEqual(ok.status_code, 200)
                payload = ok.json()
                self.assertIn("totals", payload)
                self.assertIn("routes", payload)
                self.assertIn("requests", payload["totals"])
                self.assertIn("max_tracked_routes", payload["totals"])
                self.assertIn("route_overflow_requests", payload["totals"])
                self.assertIn(
                    "GET /api/upload/status/{task_id}",
                    {item["route"] for item in payload["routes"]},
                )

                runtime = await client.get(
                    "/api/ops/runtime",
                    headers={"Authorization": f"Bearer {admin_token}"},
                )
                self.assertEqual(runtime.status_code, 200)
                runtime_payload = runtime.json()
                self.assertIn("mode", runtime_payload)
                self.assertIn("metrics", runtime_payload)
                self.assertIn("security", runtime_payload)
                self.assertIn("csrf_tokens", runtime_payload["security"])
                self.assertIn("refresh_tokens", runtime_payload["security"])

        asyncio.run(_run())


if __name__ == "__main__":
    unittest.main()
