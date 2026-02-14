"""
Backward-compatible auth import path.

Historically this project had both `app/auth.py` and `app/routers/auth.py`.
To avoid duplicated JWT logic, the implementation now lives in `app/security.py`.
"""

from app.security import get_current_user, require_role  # noqa: F401

