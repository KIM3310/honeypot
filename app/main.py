from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.routers import upload, chat, auth  # ← 추가: auth import
from app.config import validate_config
import os


# 환경 변수 검증
is_config_valid = validate_config()
if not is_config_valid:
    print("⚠️  Warning: Some environment variables are missing. Some features may not work correctly.")


app = FastAPI(title="RAG Chatbot API")


# CORS 미들웨어 설정
def get_allowed_origins():
    """환경에 따라 허용할 Origin 목록 반환"""
    origins = [
        # 로컬 개발
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://192.168.200.115:5173",
        "http://192.168.200.115:5174",
    ]

    # 프로덕션: 환경 변수에서 Vercel 도메인 추가
    vercel_url = os.getenv("VERCEL_FRONTEND_URL")
    if vercel_url:
        origins.append(vercel_url)
        # https가 아닌 경우 https 버전도 추가
        if vercel_url.startswith("http://"):
            origins.append(vercel_url.replace("http://", "https://"))

    # 추가 프로덕션 도메인들
    production_domains = os.getenv("ALLOWED_ORIGINS", "").split(",")
    for domain in production_domains:
        if domain.strip():
            origins.append(domain.strip())

    return origins

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
async def add_security_headers(request, call_next):
    response = await call_next(request)
    
    # XSS 방지
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    
    # Clickjacking 방지
    response.headers["X-Frame-Options"] = "DENY"
    
    # HTTPS 강제 (프로덕션)
    if os.getenv("ENVIRONMENT") == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    return response

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
def health_check():
    return {"status": "ok", "config_valid": is_config_valid}


@app.get("/test")
def test():
    return {"message": "Backend is working!"}
