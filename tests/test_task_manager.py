import unittest

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


if __name__ == "__main__":
    unittest.main()
