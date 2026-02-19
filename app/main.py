import os
import time
import traceback
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from app.routers import upload, chat, auth, ops  # ← 추가: auth import
from app.config import APP_MODE, CONFIG_VALID
from app.metrics import get_metrics_snapshot, record_request
from app.security import validate_security_runtime


if not CONFIG_VALID:
    print("⚠️ Live cloud config is incomplete. Running in demo mode by default.")


app = FastAPI(title="RAG Chatbot API")
APP_STARTED_AT = int(time.time())


@app.on_event("startup")
def on_startup() -> None:
    validate_security_runtime()


def get_metrics_route_path(request: Request) -> str:
    route = request.scope.get("route")
    route_path = getattr(route, "path", None)
    if isinstance(route_path, str) and route_path:
        return route_path
    return request.url.path


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
        print(f"❌ Unhandled error request_id={request_id}: {exc}")
        traceback.print_exc()
        latency_ms = int((time.time() - started) * 1000)
        record_request(request.method, get_metrics_route_path(request), 500, latency_ms)
        return JSONResponse(
            status_code=500,
            content={
                "detail": "internal server error",
                "request_id": request_id,
                "latency_ms": latency_ms,
            },
            headers={"x-request-id": request_id, "cache-control": "no-store"},
        )
    
    latency_ms = int((time.time() - started) * 1000)
    record_request(request.method, get_metrics_route_path(request), response.status_code, latency_ms)

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
    headers = dict(exc.headers or {})
    headers["x-request-id"] = request_id
    headers["cache-control"] = "no-store"
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "request_id": request_id},
        headers=headers,
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
app.include_router(ops.router)


# Health check endpoint
@app.get("/api/health")
def health_check(request: Request):
    metrics = get_metrics_snapshot(include_routes=False)
    totals = metrics.get("totals", {})
    return {
        "status": "ok",
        "mode": APP_MODE,
        "config_valid": CONFIG_VALID,
        "uptime_seconds": max(0, int(time.time()) - APP_STARTED_AT),
        "allowed_origins_count": len(get_allowed_origins()),
        "requests_total": totals.get("requests", 0),
        "errors_total": totals.get("errors", 0),
        "error_rate": totals.get("error_rate", 0.0),
        "request_id": getattr(request.state, "request_id", None),
    }


@app.get("/test")
def test():
    return {"message": "Backend is working!"}
