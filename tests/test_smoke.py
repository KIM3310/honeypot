import unittest


class TestSmoke(unittest.TestCase):
    def test_import_app(self):
        # Import should not require real cloud credentials.
        from app.main import app  # noqa: F401

    def test_health_route_exists(self):
        from app.main import app

        paths = {route.path for route in app.routes}
        self.assertIn("/api/health", paths)

    def test_health_payload_exposes_runtime_links(self):
        from fastapi.testclient import TestClient
        from app.main import app

        client = TestClient(app)
        response = client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["service"], "honeypot")
        self.assertEqual(payload["links"]["ops_runtime"], "/api/ops/runtime")
        self.assertIn("security-guardrails", payload["capabilities"])
        self.assertEqual(payload["ops_contract"]["schema"], "ops-envelope-v1")
        self.assertIn("next_action", payload["diagnostics"])


if __name__ == "__main__":
    unittest.main()
