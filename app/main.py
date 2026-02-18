import os
import time
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from app.routers import upload, chat, auth  # ← 추가: auth import
from app.config import APP_MODE, CONFIG_VALID


if not CONFIG_VALID:
    print("⚠️ Live cloud config is incomplete. Running in demo mode by default.")


app = FastAPI(title="RAG Chatbot API")
APP_STARTED_AT = int(time.time())


# CORS 미들웨어 설정
def get_allowed_origins():
    """환경에 따라 허용할 Origin 목록 반환"""
    # Local dev defaults
    origins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ]

    # 프로덕션: 환경 변수에서 Vercel 도메인 추가
    vercel_url = (os.getenv("VERCEL_FRONTEND_URL") or "").strip()
    if vercel_url:
        if not vercel_url.startswith(("http://", "https://")):
            vercel_url = f"https://{vercel_url}"
        origins.append(vercel_url)
        # https가 아닌 경우 https 버전도 추가
        if vercel_url.startswith("http://"):
            origins.append(vercel_url.replace("http://", "https://"))

    # 추가 프로덕션 도메인들
    production_domains = os.getenv("ALLOWED_ORIGINS", "").split(",")
    for domain in production_domains:
        if domain.strip():
            origins.append(domain.strip())

    # Keep first-seen order while removing duplicates.
    deduped: list[str] = []
    seen: set[str] = set()
    for origin in origins:
        if origin not in seen:
            deduped.append(origin)
            seen.add(origin)

    return deduped

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_origin_regex=r"https://.*\.vercel\.app",  # Vercel Preview 배포 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],  # CSRF Token 헤더 포함
    max_age=3600,
)

# ✅ 보안 헤더 미들웨어 추가 (CORS 다음에)
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or f"req-{uuid.uuid4().hex[:12]}"
    request.state.request_id = request_id
    started = time.time()
    try:
        response = await call_next(request)
    except Exception as exc:  # noqa: BLE001
        latency_ms = int((time.time() - started) * 1000)
        return JSONResponse(
            status_code=500,
            content={
                "detail": "internal server error",
                "request_id": request_id,
                "latency_ms": latency_ms,
                "error": str(exc),
            },
            headers={"x-request-id": request_id, "cache-control": "no-store"},
        )
    
    # XSS 방지
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    # Clickjacking 방지
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    
    # HTTPS 강제 (프로덕션)
    if os.getenv("ENVIRONMENT") == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    response.headers["x-request-id"] = request_id
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", f"req-{uuid.uuid4().hex[:12]}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "request_id": request_id},
        headers={"x-request-id": request_id, "cache-control": "no-store"},
    )

# ... 기존 라우터 등록 코드 ...

# Frontend 경로
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")


@app.get("/")
def root():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))


# 라우터 포함 (auth 추가)
app.include_router(upload.router, prefix="/api/upload", tags=["Upload"])
app.include_router(chat.router, prefix="/api", tags=["Chat"])
app.include_router(auth.router)  # ← 추가


# Health check endpoint
@app.get("/api/health")
def health_check(request: Request):
    return {
        "status": "ok",
        "mode": APP_MODE,
        "config_valid": CONFIG_VALID,
        "uptime_seconds": max(0, int(time.time()) - APP_STARTED_AT),
        "allowed_origins_count": len(get_allowed_origins()),
        "request_id": getattr(request.state, "request_id", None),
    }


@app.get("/test")
def test():
    return {"message": "Backend is working!"}
