import os
import unittest
from datetime import datetime, timedelta
from time import time
from unittest.mock import patch

from fastapi import Request
from fastapi import HTTPException

from app import security


def _build_request() -> Request:
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "GET",
        "path": "/api/chat",
        "raw_path": b"/api/chat",
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
        "scheme": "http",
    }
    return Request(scope)


class TestSecurityRuntime(unittest.TestCase):
    def setUp(self) -> None:
        security.reset_rate_limits_for_tests()

    def test_production_guard_rejects_default_jwt_secret(self) -> None:
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}, clear=False):
            with patch.object(security, "JWT_SECRET", security.DEFAULT_JWT_SECRET):
                with self.assertRaises(RuntimeError):
                    security.validate_security_runtime()

    def test_production_guard_allows_non_default_secret(self) -> None:
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}, clear=False):
            with patch.object(security, "JWT_SECRET", "super-secret-for-test"):
                security.validate_security_runtime()

    def test_api_rate_limit_blocks_excess_requests(self) -> None:
        request = _build_request()
        for _ in range(3):
            security.enforce_api_rate_limit(
                request,
                bucket="unit-test",
                limit=3,
                window_seconds=60,
                user_email="user@test.com",
            )

        with self.assertRaises(HTTPException) as ctx:
            security.enforce_api_rate_limit(
                request,
                bucket="unit-test",
                limit=3,
                window_seconds=60,
                user_email="user@test.com",
            )

        self.assertEqual(ctx.exception.status_code, 429)
        self.assertIn("Retry-After", ctx.exception.headers or {})

    def test_security_maintenance_prunes_expired_csrf_tokens(self) -> None:
        now = datetime.utcnow()
        security.ISSUED_CSRF_TOKENS["expired"] = {
            "email": "user@test.com",
            "exp": now - timedelta(minutes=1),
            "created_at": now - timedelta(minutes=2),
        }
        security.ISSUED_CSRF_TOKENS["valid"] = {
            "email": "user@test.com",
            "exp": now + timedelta(minutes=10),
            "created_at": now,
        }

        security.run_security_maintenance(force=True)

        self.assertNotIn("expired", security.ISSUED_CSRF_TOKENS)
        self.assertIn("valid", security.ISSUED_CSRF_TOKENS)

    def test_security_maintenance_limits_rate_limit_keys(self) -> None:
        for idx in range(8):
            security.LOGIN_ATTEMPTS[f"ip-{idx}"] = [time()]

        with patch.object(security, "MAX_LOGIN_ATTEMPT_KEYS", 3):
            security.run_security_maintenance(force=True)

        self.assertLessEqual(len(security.LOGIN_ATTEMPTS), 3)


if __name__ == "__main__":
    unittest.main()
