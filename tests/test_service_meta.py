import unittest

from fastapi.testclient import TestClient

from app.main import app


class TestServiceMeta(unittest.TestCase):
    def test_meta_surface_exposes_runtime_and_evidence(self) -> None:
        client = TestClient(app)

        response = client.get("/api/meta")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["service"], "honeypot")
        self.assertEqual(payload["contract_version"], "honeypot-service-meta-v1")
        self.assertIn("azure-ai-search", payload["platforms"])
        self.assertGreaterEqual(payload["evidence"]["test_files"], 9)
        self.assertIn("jwt-access-token", payload["runtime"]["auth_controls"])
        self.assertTrue(
            any(stage["key"] == "review" for stage in payload["stages"])
        )
        self.assertEqual(payload["links"]["runtime_brief"], "/api/runtime-brief")
        self.assertEqual(payload["links"]["handover_schema"], "/api/schema/handover")

    def test_runtime_brief_surface_exposes_review_contract(self) -> None:
        client = TestClient(app)

        response = client.get("/api/runtime-brief")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["service"], "honeypot")
        self.assertEqual(payload["readiness_contract"], "honeypot-runtime-brief-v1")
        self.assertEqual(payload["report_contract"]["schema"], "honeypot-handover-v1")
        self.assertIn("jwt-access-token", payload["auth_mode"])
        self.assertTrue(any("api/upload" in step for step in payload["review_flow"]))
        self.assertEqual(payload["links"]["ops_runtime"], "/api/ops/runtime")

    def test_handover_schema_surface_exposes_operator_contract(self) -> None:
        client = TestClient(app)

        response = client.get("/api/schema/handover")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["schema"], "honeypot-handover-v1")
        self.assertIn("overview", payload["required_sections"])
        self.assertIn("checklist", payload["required_sections"])
        self.assertIn("interactive-editor", payload["delivery_modes"])
        self.assertTrue(
            any("human review" in rule.lower() for rule in payload["operator_rules"])
        )
        self.assertEqual(payload["links"]["runtime_brief"], "/api/runtime-brief")


if __name__ == "__main__":
    unittest.main()
