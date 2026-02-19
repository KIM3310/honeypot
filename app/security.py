from __future__ import annotations

import os
import secrets
import threading
from collections import defaultdict
from datetime import datetime, timedelta
from time import time
from typing import Optional

import jwt
from dotenv import load_dotenv
from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# Keep behavior consistent with app/config.py (backend reads `proto.env` locally).
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), "proto.env"))

# ===== JWT settings =====
DEFAULT_JWT_SECRET = "dev-secret-key-change-in-prod"
JWT_SECRET = os.getenv("JWT_SECRET", DEFAULT_JWT_SECRET)
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_HOURS = float(os.getenv("JWT_EXPIRE_HOURS", "1"))
JWT_REFRESH_EXPIRE_HOURS = float(os.getenv("JWT_REFRESH_EXPIRE_HOURS", "24"))

# ===== CSRF / rate limit (demo-grade, in-memory) =====
CSRF_TOKEN_EXPIRE_MINUTES = 30
RATE_LIMIT_LOGIN = 10
RATE_LIMIT_WINDOW = 60
SECURITY_CLEANUP_INTERVAL_SECONDS = max(5, int(os.getenv("SECURITY_CLEANUP_INTERVAL_SECONDS", "30")))
RATE_LIMIT_TRACK_TTL_SECONDS = max(600, int(os.getenv("RATE_LIMIT_TRACK_TTL_SECONDS", "3600")))

# ===== In-memory store sizing (demo-only safety guards) =====
MAX_REFRESH_TOKENS = max(100, int(os.getenv("MAX_REFRESH_TOKENS", "5000")))
MAX_CSRF_TOKENS = max(200, int(os.getenv("MAX_CSRF_TOKENS", "10000")))
MAX_LOGIN_ATTEMPT_KEYS = max(100, int(os.getenv("MAX_LOGIN_ATTEMPT_KEYS", "5000")))
MAX_API_RATE_KEYS = max(100, int(os.getenv("MAX_API_RATE_KEYS", "10000")))

# ===== In-memory token stores (demo only) =====
ISSUED_REFRESH_TOKENS: dict[str, dict] = {}
ISSUED_CSRF_TOKENS: dict[str, dict] = {}
LOGIN_ATTEMPTS: dict[str, list[float]] = defaultdict(list)
API_RATE_ATTEMPTS: dict[str, list[float]] = defaultdict(list)

_STORE_LOCK = threading.RLock()
_LAST_SECURITY_CLEANUP_TS = 0.0

# ===== Demo users =====
MOCK_USERS = {
    "user1@company.com": {
        "password": "password123",
        "name": "김신입",
        "role": "employee",
        "department": "Engineering",
    },
    "user2@company.com": {
        "password": "password123",
        "name": "이팀장",
        "role": "manager",
        "department": "HR",
    },
    "admin@company.com": {
        "password": "admin123",
        "name": "관리자",
        "role": "admin",
        "department": "Management",
    },
}


def _safe_datetime(value: object) -> datetime:
    if isinstance(value, datetime):
        return value
    return datetime.min


def _cleanup_token_store(store: dict[str, dict], *, now_dt: datetime, max_items: int) -> None:
    for token, data in list(store.items()):
        exp = data.get("exp") if isinstance(data, dict) else None
        if isinstance(exp, datetime) and now_dt > exp:
            store.pop(token, None)

    if len(store) <= max_items:
        return

    items = sorted(
        store.items(),
        key=lambda kv: _safe_datetime(kv[1].get("created_at") if isinstance(kv[1], dict) else None),
        reverse=True,
    )
    keep = {token for token, _ in items[:max_items]}
    for token in list(store.keys()):
        if token not in keep:
            store.pop(token, None)


def _cleanup_attempt_store(
    store: dict[str, list[float]],
    *,
    now_ts: float,
    stale_ttl_seconds: int,
    max_keys: int,
) -> None:
    cutoff = now_ts - max(1, stale_ttl_seconds)
    for key, timestamps in list(store.items()):
        fresh = [ts for ts in timestamps if ts >= cutoff]
        if fresh:
            store[key] = fresh
        else:
            store.pop(key, None)

    if len(store) <= max_keys:
        return

    items = sorted(store.items(), key=lambda kv: kv[1][-1] if kv[1] else 0.0, reverse=True)
    keep = {key for key, _ in items[:max_keys]}
    for key in list(store.keys()):
        if key not in keep:
            store.pop(key, None)


def run_security_maintenance(*, force: bool = False) -> None:
    global _LAST_SECURITY_CLEANUP_TS

    now_ts = time()
    if not force and now_ts - _LAST_SECURITY_CLEANUP_TS < SECURITY_CLEANUP_INTERVAL_SECONDS:
        return

    now_dt = datetime.utcnow()
    with _STORE_LOCK:
        if not force and now_ts - _LAST_SECURITY_CLEANUP_TS < SECURITY_CLEANUP_INTERVAL_SECONDS:
            return
        _cleanup_token_store(ISSUED_REFRESH_TOKENS, now_dt=now_dt, max_items=MAX_REFRESH_TOKENS)
        _cleanup_token_store(ISSUED_CSRF_TOKENS, now_dt=now_dt, max_items=MAX_CSRF_TOKENS)
        _cleanup_attempt_store(
            LOGIN_ATTEMPTS,
            now_ts=now_ts,
            stale_ttl_seconds=RATE_LIMIT_TRACK_TTL_SECONDS,
            max_keys=MAX_LOGIN_ATTEMPT_KEYS,
        )
        _cleanup_attempt_store(
            API_RATE_ATTEMPTS,
            now_ts=now_ts,
            stale_ttl_seconds=RATE_LIMIT_TRACK_TTL_SECONDS,
            max_keys=MAX_API_RATE_KEYS,
        )
        _LAST_SECURITY_CLEANUP_TS = now_ts


def get_security_runtime_snapshot() -> dict:
    run_security_maintenance()
    with _STORE_LOCK:
        return {
            "csrf_tokens": len(ISSUED_CSRF_TOKENS),
            "refresh_tokens": len(ISSUED_REFRESH_TOKENS),
            "login_rate_keys": len(LOGIN_ATTEMPTS),
            "api_rate_keys": len(API_RATE_ATTEMPTS),
            "cleanup_interval_seconds": SECURITY_CLEANUP_INTERVAL_SECONDS,
            "rate_limit_track_ttl_seconds": RATE_LIMIT_TRACK_TTL_SECONDS,
        }


def get_client_ip(request: Request) -> str:
    # NOTE: This is for demo/dev only. In production behind proxies, use forwarded headers.
    return request.client.host if request.client else "unknown"


def check_rate_limit(ip_address: str) -> bool:
    """Simple login rate limiting (in-memory)."""
    run_security_maintenance()
    now = time()
    with _STORE_LOCK:
        LOGIN_ATTEMPTS[ip_address] = [
            ts for ts in LOGIN_ATTEMPTS[ip_address] if now - ts < RATE_LIMIT_WINDOW
        ]

        if len(LOGIN_ATTEMPTS[ip_address]) >= RATE_LIMIT_LOGIN:
            return False

        LOGIN_ATTEMPTS[ip_address].append(now)
        return True


def _check_sliding_window(
    attempts_store: dict[str, list[float]],
    key: str,
    *,
    limit: int,
    window_seconds: int,
) -> tuple[bool, int]:
    run_security_maintenance()
    now = time()
    with _STORE_LOCK:
        attempts_store[key] = [ts for ts in attempts_store[key] if now - ts < window_seconds]
        if len(attempts_store[key]) >= limit:
            oldest = attempts_store[key][0]
            retry_after = max(1, int(window_seconds - (now - oldest)))
            return False, retry_after

        attempts_store[key].append(now)
        return True, 0


def enforce_api_rate_limit(
    request: Request,
    *,
    bucket: str,
    limit: int,
    window_seconds: int,
    user_email: Optional[str] = None,
) -> None:
    """
    Generic per-endpoint sliding-window limiter.
    """
    ip = get_client_ip(request)
    identity = (user_email or "").strip().lower() or "anonymous"
    key = f"{bucket}:{identity}:{ip}"
    allowed, retry_after = _check_sliding_window(
        API_RATE_ATTEMPTS,
        key,
        limit=max(1, int(limit)),
        window_seconds=max(1, int(window_seconds)),
    )
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"요청이 너무 많습니다. {retry_after}초 후 다시 시도해주세요.",
            headers={"Retry-After": str(retry_after)},
        )


def validate_security_runtime() -> None:
    """
    Fail fast for clearly unsafe production configuration.
    """
    env = (os.getenv("ENVIRONMENT") or "development").strip().lower()
    if env == "production" and JWT_SECRET == DEFAULT_JWT_SECRET:
        raise RuntimeError("JWT_SECRET must be changed from default in production.")
    if JWT_EXPIRE_HOURS <= 0 or JWT_REFRESH_EXPIRE_HOURS <= 0:
        raise RuntimeError("JWT expiration settings must be positive.")


def create_csrf_token(email: str) -> str:
    run_security_maintenance()
    token = secrets.token_urlsafe(32)
    expire = datetime.utcnow() + timedelta(minutes=CSRF_TOKEN_EXPIRE_MINUTES)
    with _STORE_LOCK:
        ISSUED_CSRF_TOKENS[token] = {
            "email": email,
            "exp": expire,
            "created_at": datetime.utcnow(),
        }
    return token


def verify_csrf_token(token: str, email: str) -> bool:
    run_security_maintenance()
    with _STORE_LOCK:
        if token not in ISSUED_CSRF_TOKENS:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="유효하지 않은 CSRF Token입니다.",
            )

        csrf_data = ISSUED_CSRF_TOKENS[token]

        if datetime.utcnow() > csrf_data["exp"]:
            ISSUED_CSRF_TOKENS.pop(token, None)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF Token이 만료되었습니다.",
            )

        if csrf_data["email"] != email:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="CSRF Token이 일치하지 않습니다.",
            )

    return True


def invalidate_csrf_token(token: str) -> None:
    with _STORE_LOCK:
        ISSUED_CSRF_TOKENS.pop(token, None)


def rotate_csrf_token(token: str, email: str) -> str:
    """
    Validate the provided CSRF token, invalidate it, and issue a fresh one.
    """
    verify_csrf_token(token, email)
    invalidate_csrf_token(token)
    return create_csrf_token(email)


def verify_and_rotate_csrf_from_request(request: Request, email: str) -> str:
    """
    Read CSRF from request headers, verify it, then rotate it.
    Returns the newly issued CSRF token.
    """
    csrf_token = request.headers.get("X-CSRF-Token")
    if not csrf_token:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF Token이 필요합니다.",
        )
    return rotate_csrf_token(csrf_token, email)


def create_access_token(email: str, name: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
    to_encode = {"email": email, "name": name, "role": role, "exp": expire}
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(email: str) -> str:
    run_security_maintenance()
    expire = datetime.utcnow() + timedelta(hours=JWT_REFRESH_EXPIRE_HOURS)
    to_encode = {"email": email, "type": "refresh", "exp": expire}
    token = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    with _STORE_LOCK:
        ISSUED_REFRESH_TOKENS[token] = {
            "email": email,
            "exp": expire,
            "created_at": datetime.utcnow(),
        }
    return token


def is_refresh_token_issued(token: str) -> bool:
    run_security_maintenance()
    with _STORE_LOCK:
        return token in ISSUED_REFRESH_TOKENS


def revoke_refresh_token(token: str) -> None:
    with _STORE_LOCK:
        ISSUED_REFRESH_TOKENS.pop(token, None)


def verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰이 만료되었습니다. 다시 로그인해주세요.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from e


security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    payload = verify_token(credentials.credentials)
    return payload


def require_role(required_role: str):
    async def role_checker(user: dict = Depends(get_current_user)):
        if user.get("role") != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return user

    return role_checker


def verify_csrf_header(
    csrf_token_from_header: Optional[str] = Header(None),
    email: Optional[str] = None,
) -> bool:
    """Optional helper for endpoints that want one-liner CSRF validation."""
    if not csrf_token_from_header:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF Token이 필요합니다.",
        )
    if not email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF 검증에 필요한 이메일이 없습니다.",
        )

    verify_csrf_token(csrf_token_from_header, email)
    invalidate_csrf_token(csrf_token_from_header)
    return True


def reset_rate_limits_for_tests() -> None:
    global _LAST_SECURITY_CLEANUP_TS
    with _STORE_LOCK:
        LOGIN_ATTEMPTS.clear()
        API_RATE_ATTEMPTS.clear()
        ISSUED_REFRESH_TOKENS.clear()
        ISSUED_CSRF_TOKENS.clear()
        _LAST_SECURITY_CLEANUP_TS = 0.0
