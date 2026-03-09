"""Manual login check script.

This file is intentionally not a pytest test module.
Run directly:
  python test_login.py
"""

from __future__ import annotations

import requests


def run_manual_login_check(base_url: str = "http://localhost:8000") -> dict:
    response = requests.post(
        f"{base_url}/api/auth/login",
        json={"email": "employee@company.local", "password": "EmployeeDemo!2026"},
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


if __name__ == "__main__":
    try:
        print(run_manual_login_check())
    except Exception as exc:  # pragma: no cover - manual utility output
        print({"ok": False, "error": str(exc)})
