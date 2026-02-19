import asyncio
import unittest

import httpx

from app.main import app


class TestCsrfRotation(unittest.TestCase):
    def test_chat_csrf_rotation_and_reuse_blocked(self) -> None:
        async def _run() -> None:
            transport = httpx.ASGITransport(app=app)
            async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
                login = await client.post(
                    "/api/auth/login",
                    json={"email": "user1@company.com", "password": "password123"},
                )
                self.assertEqual(login.status_code, 200)
                login_data = login.json()
                access_token = login_data["access_token"]
                csrf_token = login_data["csrf_token"]

                payload = {"messages": [{"role": "user", "content": "테스트"}]}
                first = await client.post(
                    "/api/chat",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "X-CSRF-Token": csrf_token,
                    },
                )
                self.assertEqual(first.status_code, 200)
                next_csrf = first.headers.get("X-CSRF-Token")
                self.assertTrue(next_csrf)
                self.assertNotEqual(next_csrf, csrf_token)

                reused = await client.post(
                    "/api/chat",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "X-CSRF-Token": csrf_token,
                    },
                )
                self.assertEqual(reused.status_code, 403)

                second = await client.post(
                    "/api/chat",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "X-CSRF-Token": next_csrf,
                    },
                )
                self.assertEqual(second.status_code, 200)

        asyncio.run(_run())


if __name__ == "__main__":
    unittest.main()
