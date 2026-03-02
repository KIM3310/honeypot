# 간단한 인메모리 상태 저장소
# 실무에서는 Redis 등을 사용하지만 MVP에서는 메모리로 충분함
from __future__ import annotations

import os
import threading
from datetime import datetime, timedelta, timezone


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: object) -> datetime | None:
    if not isinstance(value, datetime):
        return None
    if value.tzinfo is None:
        # Backward compatibility for naive datetimes from older in-memory task entries.
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


class TaskManager:
    TASK_TTL_MINUTES = int(os.getenv("TASK_TTL_MINUTES", "180"))
    TASK_MAX_ITEMS = int(os.getenv("TASK_MAX_ITEMS", "2000"))
    TASK_DETAIL_MAX_ITEMS = int(os.getenv("TASK_DETAIL_MAX_ITEMS", "100"))

    def __init__(self):
        self.tasks = {}
        self._lock = threading.RLock()

    def _cleanup(self):
        if not self.tasks:
            return

        now = _utcnow()
        ttl = timedelta(minutes=max(5, self.TASK_TTL_MINUTES))

        expired = []
        for task_id, task in self.tasks.items():
            updated_at = _as_utc(task.get("updated_at") or task.get("created_at"))
            if updated_at is None:
                continue
            if now - updated_at > ttl:
                expired.append(task_id)

        for task_id in expired:
            self.tasks.pop(task_id, None)

        if len(self.tasks) <= self.TASK_MAX_ITEMS:
            return

        # Keep most recently updated tasks.
        def _task_sort_timestamp(task: dict) -> float:
            updated_at = _as_utc(task.get("updated_at") or task.get("created_at"))
            if updated_at is None:
                return float("-inf")
            return updated_at.timestamp()

        items = sorted(
            self.tasks.items(),
            key=lambda kv: _task_sort_timestamp(kv[1]),
            reverse=True,
        )
        keep_ids = {task_id for task_id, _ in items[: self.TASK_MAX_ITEMS]}
        self.tasks = {task_id: task for task_id, task in self.tasks.items() if task_id in keep_ids}

    def _get_task_ttl_seconds(self, task: dict) -> int | None:
        updated_at = _as_utc(task.get("updated_at") or task.get("created_at"))
        if updated_at is None:
            return None
        ttl = timedelta(minutes=max(5, self.TASK_TTL_MINUTES))
        remaining_seconds = int((updated_at + ttl - _utcnow()).total_seconds())
        return max(0, remaining_seconds)

    def create_task(self, task_id: str, owner_email: str = ""):
        with self._lock:
            self._cleanup()
            now = _utcnow()
            self.tasks[task_id] = {
                "status": "pending",
                "progress": 0,
                "message": "Initializing...",
                "details": [],
                "owner_email": owner_email,
                "created_at": now,
                "updated_at": now,
            }

    def update_task(self, task_id: str, status: str = None, progress: int = None, message: str = None):
        with self._lock:
            self._cleanup()
            if task_id in self.tasks:
                if status:
                    self.tasks[task_id]["status"] = status
                if progress is not None:
                    try:
                        normalized_progress = int(progress)
                    except (TypeError, ValueError):
                        normalized_progress = 0
                    self.tasks[task_id]["progress"] = max(0, min(100, normalized_progress))
                if message is not None:
                    self.tasks[task_id]["message"] = message
                self.tasks[task_id]["updated_at"] = _utcnow()

    def add_detail(self, task_id: str, detail: str):
        with self._lock:
            self._cleanup()
            if task_id in self.tasks:
                details = self.tasks[task_id]["details"]
                details.append(detail)
                max_items = max(1, self.TASK_DETAIL_MAX_ITEMS)
                if len(details) > max_items:
                    del details[:-max_items]
                self.tasks[task_id]["updated_at"] = _utcnow()

    def get_task(self, task_id: str, include_private: bool = False):
        with self._lock:
            self._cleanup()
            task = self.tasks.get(task_id, None)
            if not task:
                return None
            safe_task = dict(task)
            safe_task["details"] = list(task.get("details", []))
            safe_task["expires_in_seconds"] = self._get_task_ttl_seconds(task)
            if not include_private:
                safe_task.pop("owner_email", None)
                safe_task.pop("created_at", None)
                safe_task.pop("updated_at", None)
            return safe_task

    def is_task_owner(self, task_id: str, owner_email: str) -> bool:
        with self._lock:
            self._cleanup()
            task = self.tasks.get(task_id, None)
            if not task:
                return False
            return task.get("owner_email") == owner_email

# 전역 인스턴스
task_manager = TaskManager()
