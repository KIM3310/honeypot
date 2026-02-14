from __future__ import annotations

from datetime import datetime
from typing import Optional

import jwt
from fastapi import APIRouter, Header, HTTPException, Request, status
from pydantic import BaseModel

from app.security import (
    CSRF_TOKEN_EXPIRE_MINUTES,
    ISSUED_REFRESH_TOKENS,
    JWT_ALGORITHM,
    JWT_EXPIRE_HOURS,
    JWT_REFRESH_EXPIRE_HOURS,
    JWT_SECRET,
    RATE_LIMIT_WINDOW,
    MOCK_USERS,
    check_rate_limit,
    create_access_token,
    create_csrf_token,
    create_refresh_token,
    get_client_ip,
    invalidate_csrf_token,
    verify_csrf_token,
    verify_token,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user_email: str
    user_name: str
    user_role: str
    expires_in: int
    refresh_token: str
    refresh_expires_in: int
    csrf_token: str
    csrf_expires_in: int


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int


class LogoutRequest(BaseModel):
    refresh_token: str


@router.post("/login", response_model=LoginResponse)
async def login(request: Request, login_request: LoginRequest):
    """
    Demo login (JWT + refresh token + CSRF token + basic rate limiting).

    Test accounts:
    - user1@company.com / password123
    - user2@company.com / password123
    - admin@company.com / admin123
    """
    client_ip = get_client_ip(request)
    if not check_rate_limit(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"너무 많은 요청이 발생했습니다. {RATE_LIMIT_WINDOW}초 후 다시 시도해주세요.",
            headers={"Retry-After": str(RATE_LIMIT_WINDOW)},
        )

    user = MOCK_USERS.get(login_request.email)
    if not user or user.get("password") != login_request.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 일치하지 않습니다.",
        )

    access_token = create_access_token(
        email=login_request.email,
        name=user["name"],
        role=user["role"],
    )
    refresh_token = create_refresh_token(login_request.email)
    csrf_token = create_csrf_token(login_request.email)

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user_email=login_request.email,
        user_name=user["name"],
        user_role=user["role"],
        expires_in=int(JWT_EXPIRE_HOURS * 3600),
        refresh_token=refresh_token,
        refresh_expires_in=int(JWT_REFRESH_EXPIRE_HOURS * 3600),
        csrf_token=csrf_token,
        csrf_expires_in=int(CSRF_TOKEN_EXPIRE_MINUTES * 60),
    )


@router.post("/refresh", response_model=RefreshTokenResponse)
async def refresh_access_token(request: RefreshTokenRequest):
    refresh_token = request.refresh_token

    if refresh_token not in ISSUED_REFRESH_TOKENS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 Refresh Token입니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(refresh_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        ISSUED_REFRESH_TOKENS.pop(refresh_token, None)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh Token이 만료되었습니다. 다시 로그인해주세요.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 Refresh Token입니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="잘못된 토큰 타입입니다.",
        )

    email = payload.get("email")
    if not email or email not in MOCK_USERS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="사용자를 찾을 수 없습니다.",
        )

    user = MOCK_USERS[email]
    new_access_token = create_access_token(email=email, name=user["name"], role=user["role"])

    return RefreshTokenResponse(
        access_token=new_access_token,
        token_type="bearer",
        expires_in=int(JWT_EXPIRE_HOURS * 3600),
    )


@router.post("/logout")
async def logout(request: LogoutRequest):
    ISSUED_REFRESH_TOKENS.pop(request.refresh_token, None)
    return {"message": "로그아웃 되었습니다."}


@router.get("/me")
async def get_me(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰이 없습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)
    return {"email": payload.get("email"), "name": payload.get("name"), "role": payload.get("role")}


@router.post("/validate-token")
async def validate_token(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰이 없습니다.",
        )

    token = authorization.replace("Bearer ", "")
    payload = verify_token(token)

    exp_timestamp = payload.get("exp")
    if exp_timestamp is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="토큰 검증 실패")

    try:
        remaining_seconds = int(exp_timestamp - datetime.utcnow().timestamp())
    except TypeError:
        # If exp was parsed as datetime by a different issuer, best-effort conversion.
        remaining_seconds = int((exp_timestamp - datetime.utcnow()).total_seconds())

    return {
        "valid": True,
        "remaining_seconds": max(0, remaining_seconds),
        "email": payload.get("email"),
        "role": payload.get("role"),
    }


def verify_csrf_header(
    csrf_token_from_header: Optional[str] = Header(None),
    email: Optional[str] = None,
) -> bool:
    """
    CSRF header validation helper.

    NOTE: This project uses in-memory CSRF tokens for demo purposes.
    """
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

