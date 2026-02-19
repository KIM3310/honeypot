import asyncio
import unittest

import httpx

from app.main import app


def _auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


class TestUploadAuthz(unittest.TestCase):
    def test_sensitive_upload_endpoints_require_auth(self) -> None:
        async def _run() -> None:
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                for path in ["/api/upload/stats", "/api/upload/documents", "/api/upload/indexes"]:
                    response = await client.get(path)
                    self.assertEqual(response.status_code, 403, path)

                login = await client.post(
                    "/api/auth/login",
                    json={"email": "user1@company.com", "password": "password123"},
                )
                self.assertEqual(login.status_code, 200)
                token = login.json()["access_token"]

                for path in ["/api/upload/stats", "/api/upload/documents", "/api/upload/indexes"]:
                    response = await client.get(path, headers=_auth_header(token))
                    self.assertEqual(response.status_code, 200, path)

        asyncio.run(_run())

    def test_task_status_is_owner_scoped(self) -> None:
        async def _run() -> None:
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                login_user1 = await client.post(
                    "/api/auth/login",
                    json={"email": "user1@company.com", "password": "password123"},
                )
                self.assertEqual(login_user1.status_code, 200)
                user1_data = login_user1.json()

                upload = await client.post(
                    "/api/upload",
                    headers={
                        "Authorization": f"Bearer {user1_data['access_token']}",
                        "X-CSRF-Token": user1_data["csrf_token"],
                    },
                    files={"file": ("demo.txt", b"hello world", "text/plain")},
                )
                self.assertEqual(upload.status_code, 200)
                task_id = upload.json()["task_id"]

                login_user2 = await client.post(
                    "/api/auth/login",
                    json={"email": "user2@company.com", "password": "password123"},
                )
                self.assertEqual(login_user2.status_code, 200)
                user2_token = login_user2.json()["access_token"]

                forbidden = await client.get(
                    f"/api/upload/status/{task_id}",
                    headers=_auth_header(user2_token),
                )
                self.assertEqual(forbidden.status_code, 403)

                allowed = await client.get(
                    f"/api/upload/status/{task_id}",
                    headers=_auth_header(user1_data["access_token"]),
                )
                self.assertEqual(allowed.status_code, 200)
                self.assertIn("status", allowed.json())
                self.assertNotIn("owner_email", allowed.json())

        asyncio.run(_run())


if __name__ == "__main__":
    unittest.main()
