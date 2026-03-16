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
        self.assertEqual(len(payload["two_minute_review"]), 6)
        self.assertEqual(payload["proof_assets"][0]["label"], "Health Route")
        self.assertEqual(payload["links"]["runtime_brief"], "/api/runtime-brief")
        self.assertEqual(payload["links"]["runtime_scorecard"], "/api/runtime-scorecard")
        self.assertEqual(payload["links"]["handover_schema"], "/api/schema/handover")
        self.assertEqual(payload["links"]["review_summary"], "/api/review-summary")
        self.assertEqual(payload["completeness_gate"]["schema"], "honeypot-handover-completeness-v1")
        self.assertFalse(payload["completeness_gate"]["review_ready"])
        self.assertGreaterEqual(len(payload["completeness_gate"]["missing_fields"]), 1)

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
        self.assertEqual(len(payload["two_minute_review"]), 6)
        self.assertEqual(payload["proof_assets"][0]["path"], "/api/health")
        self.assertIn("demo or live-configured", payload["proof_assets"][0]["why"])
        self.assertEqual(payload["proof_assets"][1]["path"], "/api/runtime-scorecard")
        self.assertEqual(payload["links"]["ops_runtime"], "/api/ops/runtime")
        self.assertEqual(payload["links"]["runtime_scorecard"], "/api/runtime-scorecard")
        self.assertEqual(payload["links"]["review_summary"], "/api/review-summary")
        self.assertEqual(payload["completeness_gate"]["schema"], "honeypot-handover-completeness-v1")
        self.assertIn("owner coverage", payload["completeness_gate"]["required_checks"])

    def test_runtime_scorecard_surface_exposes_route_and_security_snapshot(self) -> None:
        client = TestClient(app)

        response = client.get("/api/runtime-scorecard")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["service"], "honeypot")
        self.assertEqual(payload["readiness_contract"], "honeypot-runtime-scorecard-v1")
        self.assertIn("runtime_score", payload["summary"])
        self.assertIn("latency_status", payload["summary"])
        self.assertEqual(payload["links"]["runtime_scorecard"], "/api/runtime-scorecard")
        self.assertIn("hottest_route", payload["route_health"])
        self.assertIn("csrf_tokens", payload["security_posture"])

    def test_review_summary_surface_exposes_compact_operator_snapshot(self) -> None:
        client = TestClient(app)

        response = client.get("/api/review-summary")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["service"], "honeypot")
        self.assertEqual(payload["contract_version"], "honeypot-review-summary-v1")
        self.assertEqual(payload["runtime_summary"]["report_schema"], "honeypot-handover-v1")
        self.assertIn("/api/review-summary", payload["runtime_summary"]["review_endpoints"])
        self.assertEqual(payload["fastest_review_path"][1], "/api/review-summary")
        self.assertGreaterEqual(payload["snapshot"]["ready_stage_count"], 1)
        self.assertIn("completeness_score", payload["snapshot"])
        self.assertFalse(payload["runtime_summary"]["review_ready"])
        self.assertEqual(payload["links"]["runtime_scorecard"], "/api/runtime-scorecard")
        self.assertEqual(payload["links"]["review_summary_schema"], "/api/review-summary/schema")

    def test_review_summary_schema_exposes_required_contract_fields(self) -> None:
        client = TestClient(app)

        response = client.get("/api/review-summary/schema")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["schema"], "honeypot-review-summary-v1")
        self.assertIn("snapshot.mode", payload["required_fields"])
        self.assertIn("links.runtime_scorecard", payload["required_fields"])
        self.assertEqual(payload["links"]["runtime_scorecard"], "/api/runtime-scorecard")
        self.assertEqual(payload["links"]["review_summary"], "/api/review-summary")

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
        self.assertEqual(payload["links"]["review_summary"], "/api/review-summary")


if __name__ == "__main__":
    unittest.main()
