# Python 3.11 slim 이미지 사용
FROM python:3.11-slim

# 작업 디렉토리 설정
WORKDIR /app

# 시스템 의존성 설치 (필요한 경우)
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성 복사 및 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY app/ ./app/

# 환경 변수 설정
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production

# 포트 노출 (Railway는 동적 포트 사용)
EXPOSE 8000

# Health check 추가 (Railway 호환)
# Railway는 HTTP health check를 자체적으로 수행하므로 선택사항
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT:-8000}/api/health')" || exit 1

# Uvicorn으로 FastAPI 실행
# Railway는 PORT 환경 변수를 자동으로 제공 (기본값: 8000)
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
