from __future__ import annotations

import os
import secrets
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
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-key-change-in-prod")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_HOURS = float(os.getenv("JWT_EXPIRE_HOURS", "1"))
JWT_REFRESH_EXPIRE_HOURS = float(os.getenv("JWT_REFRESH_EXPIRE_HOURS", "24"))

# ===== CSRF / rate limit (demo-grade, in-memory) =====
CSRF_TOKEN_EXPIRE_MINUTES = 30
RATE_LIMIT_LOGIN = 10
RATE_LIMIT_WINDOW = 60

# ===== In-memory token stores (demo only) =====
ISSUED_REFRESH_TOKENS: dict[str, dict] = {}
ISSUED_CSRF_TOKENS: dict[str, dict] = {}
LOGIN_ATTEMPTS: dict[str, list[float]] = defaultdict(list)

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


def get_client_ip(request: Request) -> str:
    # NOTE: This is for demo/dev only. In production behind proxies, use forwarded headers.
    return request.client.host if request.client else "unknown"


def check_rate_limit(ip_address: str) -> bool:
    """Simple login rate limiting (in-memory)."""
    now = time()

    # Drop timestamps older than the window.
    LOGIN_ATTEMPTS[ip_address] = [
        ts for ts in LOGIN_ATTEMPTS[ip_address] if now - ts < RATE_LIMIT_WINDOW
    ]

    if len(LOGIN_ATTEMPTS[ip_address]) >= RATE_LIMIT_LOGIN:
        return False

    LOGIN_ATTEMPTS[ip_address].append(now)
    return True


def create_csrf_token(email: str) -> str:
    token = secrets.token_urlsafe(32)
    expire = datetime.utcnow() + timedelta(minutes=CSRF_TOKEN_EXPIRE_MINUTES)
    ISSUED_CSRF_TOKENS[token] = {
        "email": email,
        "exp": expire,
        "created_at": datetime.utcnow(),
    }
    return token


def verify_csrf_token(token: str, email: str) -> bool:
    if token not in ISSUED_CSRF_TOKENS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="유효하지 않은 CSRF Token입니다.",
        )

    csrf_data = ISSUED_CSRF_TOKENS[token]

    if datetime.utcnow() > csrf_data["exp"]:
        del ISSUED_CSRF_TOKENS[token]
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
    ISSUED_CSRF_TOKENS.pop(token, None)


def create_access_token(email: str, name: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRE_HOURS)
    to_encode = {"email": email, "name": name, "role": role, "exp": expire}
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(email: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=JWT_REFRESH_EXPIRE_HOURS)
    to_encode = {"email": email, "type": "refresh", "exp": expire}
    token = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    ISSUED_REFRESH_TOKENS[token] = {"email": email, "exp": expire, "created_at": datetime.utcnow()}
    return token


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

