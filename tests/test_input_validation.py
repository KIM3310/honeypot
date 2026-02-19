import asyncio
import unittest

import httpx

from app.main import app


class TestInputValidation(unittest.TestCase):
    def test_upload_extension_and_index_validation(self) -> None:
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

                bad_ext = await client.post(
                    "/api/upload",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "X-CSRF-Token": csrf_token,
                    },
                    files={"file": ("bad.exe", b"dummy", "application/octet-stream")},
                )
                self.assertEqual(bad_ext.status_code, 415)
                rotated_csrf = bad_ext.headers.get("X-CSRF-Token")
                self.assertTrue(rotated_csrf)
                self.assertNotEqual(rotated_csrf, csrf_token)

                bad_index = await client.post(
                    "/api/upload",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "X-CSRF-Token": rotated_csrf,
                    },
                    data={"index_name": "INVALID INDEX NAME"},
                    files={"file": ("ok.txt", b"hello", "text/plain")},
                )
                self.assertEqual(bad_index.status_code, 400)
                rotated_csrf_2 = bad_index.headers.get("X-CSRF-Token")
                self.assertTrue(rotated_csrf_2)
                self.assertNotEqual(rotated_csrf_2, rotated_csrf)

                ok_upload = await client.post(
                    "/api/upload",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "X-CSRF-Token": rotated_csrf_2,
                    },
                    files={"file": ("ok.txt", b"hello", "text/plain")},
                )
                self.assertEqual(ok_upload.status_code, 200)

        asyncio.run(_run())

    def test_chat_message_validation(self) -> None:
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

                invalid_messages = await client.post(
                    "/api/chat",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "X-CSRF-Token": csrf_token,
                    },
                    json={"messages": [{"role": "hacker", "content": "x"}]},
                )
                self.assertEqual(invalid_messages.status_code, 400)
                rotated_csrf = invalid_messages.headers.get("X-CSRF-Token")
                self.assertTrue(rotated_csrf)
                self.assertNotEqual(rotated_csrf, csrf_token)

                too_many = [{"role": "user", "content": "x"} for _ in range(41)]
                too_many_resp = await client.post(
                    "/api/chat",
                    headers={
                        "Authorization": f"Bearer {access_token}",
                        "X-CSRF-Token": rotated_csrf,
                    },
                    json={"messages": too_many},
                )
                self.assertEqual(too_many_resp.status_code, 400)

        asyncio.run(_run())


if __name__ == "__main__":
    unittest.main()
