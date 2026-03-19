"""
Structured logging configuration for the honeypot backend.
Provides JSON-structured log output with request ID correlation.
"""

import logging
import json
import sys
import time
import uuid
from typing import Optional


class StructuredFormatter(logging.Formatter):
    """Emits log records as structured JSON lines."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Include request_id if attached
        request_id = getattr(record, "request_id", None)
        if request_id:
            log_entry["request_id"] = request_id

        # Include extra fields
        component = getattr(record, "component", None)
        if component:
            log_entry["component"] = component

        duration_ms = getattr(record, "duration_ms", None)
        if duration_ms is not None:
            log_entry["duration_ms"] = duration_ms

        # Include exception info
        if record.exc_info and record.exc_info[1]:
            log_entry["error"] = str(record.exc_info[1])
            log_entry["traceback"] = self.formatException(record.exc_info)

        return json.dumps(log_entry, ensure_ascii=False, default=str)


def setup_logging(level: str = "INFO") -> None:
    """Configure structured JSON logging for the application."""
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove existing handlers
    for handler in root.handlers[:]:
        root.removeHandler(handler)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(StructuredFormatter())
    root.addHandler(handler)

    # Reduce noise from third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("azure").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Get a named logger."""
    return logging.getLogger(f"honeypot.{name}")


def generate_request_id() -> str:
    """Generate a unique request ID."""
    return f"req-{uuid.uuid4().hex[:12]}"


class RequestLogger:
    """Context-aware logger that includes request_id in all messages."""

    def __init__(self, logger: logging.Logger, request_id: str, component: Optional[str] = None):
        self._logger = logger
        self._request_id = request_id
        self._component = component

    def _extra(self, **kwargs) -> dict:
        extra = {"request_id": self._request_id}
        if self._component:
            extra["component"] = self._component
        extra.update(kwargs)
        return extra

    def info(self, msg: str, **kwargs) -> None:
        self._logger.info(msg, extra=self._extra(**kwargs))

    def warning(self, msg: str, **kwargs) -> None:
        self._logger.warning(msg, extra=self._extra(**kwargs))

    def error(self, msg: str, **kwargs) -> None:
        self._logger.error(msg, extra=self._extra(**kwargs))

    def debug(self, msg: str, **kwargs) -> None:
        self._logger.debug(msg, extra=self._extra(**kwargs))
