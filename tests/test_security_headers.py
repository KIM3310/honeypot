import asyncio
import os
import unittest

import httpx

from app.main import app, get_allowed_origins


class TestSecurityHeaders(unittest.TestCase):
    def setUp(self) -> None:
        self._old_vercel = os.environ.get("VERCEL_FRONTEND_URL")
        self._old_origins = os.environ.get("ALLOWED_ORIGINS")
        self._old_env = os.environ.get("ENVIRONMENT")

    def tearDown(self) -> None:
        if self._old_vercel is None:
            os.environ.pop("VERCEL_FRONTEND_URL", None)
        else:
            os.environ["VERCEL_FRONTEND_URL"] = self._old_vercel

        if self._old_origins is None:
            os.environ.pop("ALLOWED_ORIGINS", None)
        else:
            os.environ["ALLOWED_ORIGINS"] = self._old_origins

        if self._old_env is None:
            os.environ.pop("ENVIRONMENT", None)
        else:
            os.environ["ENVIRONMENT"] = self._old_env

    def test_allowed_origins_normalize_and_dedupe(self) -> None:
        os.environ["VERCEL_FRONTEND_URL"] = "myapp.vercel.app"
        os.environ["ALLOWED_ORIGINS"] = "https://myapp.vercel.app,https://extra.example.com"

        origins = get_allowed_origins()

        self.assertIn("https://myapp.vercel.app", origins)
        self.assertIn("https://extra.example.com", origins)
        self.assertEqual(origins.count("https://myapp.vercel.app"), 1)

    def test_security_headers_are_set(self) -> None:
        os.environ["ENVIRONMENT"] = "development"
        response = asyncio.run(_request_health())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get("X-Content-Type-Options"), "nosniff")
        self.assertEqual(response.headers.get("X-Frame-Options"), "DENY")
        self.assertEqual(
            response.headers.get("Referrer-Policy"),
            "strict-origin-when-cross-origin",
        )
        self.assertIn("camera=()", response.headers.get("Permissions-Policy", ""))
        self.assertNotIn("strict-transport-security", (k.lower() for k in response.headers.keys()))

    def test_hsts_is_set_in_production(self) -> None:
        os.environ["ENVIRONMENT"] = "production"
        response = asyncio.run(_request_health())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers.get("Strict-Transport-Security"),
            "max-age=31536000; includeSubDomains",
        )


if __name__ == "__main__":
    unittest.main()


async def _request_health() -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        return await client.get("/api/health")
