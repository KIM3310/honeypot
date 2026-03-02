import unittest
from datetime import datetime, timedelta, timezone

from app.state import TaskManager


class TestTaskManager(unittest.TestCase):
    def test_get_task_returns_copy_for_private_view(self) -> None:
        manager = TaskManager()
        manager.create_task("task-1", owner_email="owner@example.com")

        snapshot = manager.get_task("task-1", include_private=True)
        self.assertIsNotNone(snapshot)
        snapshot["status"] = "hacked"
        snapshot["details"].append("tamper")

        fresh = manager.get_task("task-1", include_private=True)
        self.assertEqual(fresh["status"], "pending")
        self.assertEqual(fresh["details"], [])

    def test_progress_is_clamped_to_0_100(self) -> None:
        manager = TaskManager()
        manager.create_task("task-2")

        manager.update_task("task-2", progress=250)
        self.assertEqual(manager.get_task("task-2", include_private=True)["progress"], 100)

        manager.update_task("task-2", progress=-5)
        self.assertEqual(manager.get_task("task-2", include_private=True)["progress"], 0)

    def test_get_task_includes_expiry_hint(self) -> None:
        manager = TaskManager()
        manager.create_task("task-3")

        snapshot = manager.get_task("task-3")
        self.assertIsNotNone(snapshot)
        self.assertIn("expires_in_seconds", snapshot)
        self.assertGreaterEqual(snapshot["expires_in_seconds"], 0)

    def test_cleanup_handles_legacy_naive_datetimes(self) -> None:
        manager = TaskManager()
        manager.create_task("task-legacy")
        manager.create_task("task-current")

        stale_minutes = max(5, manager.TASK_TTL_MINUTES) + 1
        legacy_updated_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=stale_minutes)
        manager.tasks["task-legacy"]["updated_at"] = legacy_updated_at
        manager.tasks["task-legacy"]["created_at"] = legacy_updated_at

        self.assertIsNotNone(manager.get_task("task-current", include_private=True))
        self.assertIsNone(manager.get_task("task-legacy", include_private=True))


if __name__ == "__main__":
    unittest.main()
