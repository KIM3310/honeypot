import unittest
from unittest.mock import patch

from app import metrics


class TestMetricsLimits(unittest.TestCase):
    def setUp(self) -> None:
        metrics.reset_metrics_for_tests()

    def tearDown(self) -> None:
        metrics.reset_metrics_for_tests()

    def test_route_cardinality_limit_uses_overflow_bucket(self) -> None:
        with patch.object(metrics, "MAX_TRACKED_ROUTES", 3):
            for idx in range(10):
                metrics.record_request("GET", f"/api/dynamic/{idx}", 200, 12)

            snapshot = metrics.get_metrics_snapshot(include_routes=True, top_n=20)

        totals = snapshot["totals"]
        self.assertLessEqual(totals["routes"], 3)
        self.assertGreater(totals["route_overflow_requests"], 0)
        self.assertIn(
            f"* {metrics.OVERFLOW_ROUTE_PATH}",
            {item["route"] for item in snapshot["routes"]},
        )


if __name__ == "__main__":
    unittest.main()
