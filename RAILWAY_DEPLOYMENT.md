# 🚂 Railway 배포 가이드 (Backend)

Railway를 사용한 백엔드 배포는 Azure Container Apps보다 **훨씬 간단**합니다!

---

## 🎯 Railway의 장점

- ✅ **GitHub 자동 연동**: Push하면 자동 배포
- ✅ **무료 티어 제공**: 월 $5 크레딧 무료
- ✅ **간단한 설정**: Container Registry 불필요
- ✅ **자동 HTTPS**: SSL 인증서 자동 발급
- ✅ **실시간 로그**: 웹 대시보드에서 즉시 확인
- ✅ **환경 변수 관리**: UI에서 쉽게 설정

---

## 📋 사전 준비사항

1. [Railway 계정](https://railway.app) 생성
2. GitHub 계정 연동
3. 코드가 GitHub에 푸시되어 있어야 함

---

## 🚀 배포 단계

### 1단계: Railway 프로젝트 생성

1. [Railway Dashboard](https://railway.app/dashboard) 접속
2. **"New Project"** 클릭
3. **"Deploy from GitHub repo"** 선택
4. `honeypot_proto` 레포지토리 선택
5. 배포할 브랜치 선택 (예: `main` 또는 `claude/review-vercel-deployment-MbTDB`)

### 2단계: 서비스 설정

Railway가 자동으로 Dockerfile을 감지합니다:

- ✅ **Build Command**: 자동 감지 (Dockerfile 사용)
- ✅ **Start Command**: Dockerfile의 CMD 사용
- ✅ **Port**: 자동 감지

**추가 설정 불필요!** Railway가 모든 것을 자동으로 처리합니다.

### 3단계: 환경 변수 설정

Railway Dashboard → 프로젝트 → **Variables** 탭에서 추가:

#### 필수 환경 변수

```bash
# 환경 설정
ENVIRONMENT=production

# Azure Storage
AZURE_STORAGE_ACCOUNT_NAME=your-storage-account
AZURE_STORAGE_ACCOUNT_KEY=your-storage-key
AZURE_STORAGE_CONTAINER_NAME=kkuldanji-mvp-raw

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com/
AZURE_OPENAI_API_KEY=your-openai-key
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-large

# Azure AI Search
AZURE_SEARCH_ENDPOINT=https://your-search.search.windows.net
AZURE_SEARCH_KEY=your-search-key
AZURE_SEARCH_INDEX_NAME=kkuldanji-mvp

# Google Gemini
GOOGLE_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-3-pro-preview

# JWT 보안
JWT_SECRET=your-super-secret-key-min-32-characters-long
JWT_ALGORITHM=HS256

# CORS (Vercel Frontend URL)
VERCEL_FRONTEND_URL=https://your-frontend.vercel.app
```

**💡 Tip**: Railway는 환경 변수를 한 번에 복사-붙여넣기 할 수 있습니다!

```
ENVIRONMENT=production
AZURE_STORAGE_ACCOUNT_NAME=xxx
...
```

형식으로 입력하면 자동으로 파싱됩니다.

### 4단계: 배포 시작

환경 변수 설정 완료 후:

1. Railway가 **자동으로 배포 시작**
2. **Deployments** 탭에서 실시간 로그 확인
3. 빌드 완료까지 약 3-5분 소요

### 5단계: Backend URL 확인

배포 완료 후:

1. **Settings** 탭 → **Domains** 섹션
2. Railway가 자동 생성한 도메인 확인:
   ```
   https://honeypot-proto-production.up.railway.app
   ```
3. 또는 **Custom Domain** 추가 가능

**✅ 이 URL을 복사해두세요!** Vercel Frontend 배포 시 필요합니다.

### 6단계: Health Check 확인

```bash
curl https://your-project.up.railway.app/api/health
```

응답:
```json
{
  "status": "ok",
  "config_valid": true
}
```

---

## 🌐 Frontend 배포 (Vercel)

### 환경 변수 설정

Vercel Dashboard → Settings → Environment Variables:

```bash
VITE_API_BASE_URL=https://your-project.up.railway.app
NODE_ENV=production
```

**⚠️ 중요**:
- Railway URL에 **https://** 포함
- 끝에 **슬래시(/) 제거**

### CORS 업데이트

Frontend가 배포되면 Railway Backend 환경 변수에 추가:

```bash
VERCEL_FRONTEND_URL=https://your-frontend.vercel.app
```

Railway가 자동으로 재배포합니다.

---

## 🔄 자동 배포 (CI/CD)

Railway는 GitHub와 자동 연동됩니다:

```bash
# 코드 수정 후
git add .
git commit -m "feat: Update backend"
git push origin main

# Railway가 자동으로:
# 1. 변경사항 감지
# 2. Docker 이미지 빌드
# 3. 새 버전 배포
# 4. 헬스체크 후 트래픽 전환
```

**Zero-downtime deployment!**

---

## 📊 모니터링 & 로그

### 실시간 로그 확인

Railway Dashboard → **Deployments** → 최신 배포 클릭

```bash
# 로그 예시
[INFO] Application startup complete
[INFO] Uvicorn running on http://0.0.0.0:8000
```

### 메트릭 확인

Railway Dashboard → **Metrics** 탭:
- CPU 사용량
- 메모리 사용량
- 네트워크 트래픽
- 응답 시간

---

## 💰 비용 & 리소스

### 무료 티어
- **월 $5 크레딧** 무료 제공
- **500시간 실행 시간**
- 소규모 프로젝트에 충분

### 리소스 할당
Railway가 자동으로 리소스를 할당하지만, 필요시 수동 설정 가능:

**Settings** → **Resources**:
- CPU: 0.5 - 8 vCPU
- Memory: 512MB - 32GB

### 비용 최적화 팁

1. **Sleep on idle** 활성화 (무료 티어):
   - Settings → Sleep on idle → Enable
   - 15분 동안 요청 없으면 자동 sleep
   - 새 요청 시 자동 wake (3-5초 소요)

2. **개발 환경 분리**:
   - Production: 항상 실행
   - Staging: Sleep on idle 활성화

---

## 🔒 보안 설정

### 1. 환경 변수 보호

Railway는 환경 변수를 자동으로 암호화하여 저장합니다.

### 2. Private Networking (선택사항)

Railway의 Private Network 기능으로 서비스 간 통신 보안:

```bash
# Settings → Networking → Private Network
```

### 3. Custom Domain + SSL

Railway는 자동으로 SSL 인증서를 발급합니다:

1. **Settings** → **Domains** → **Custom Domain**
2. 도메인 입력 (예: `api.yourdomain.com`)
3. DNS 레코드 추가 (Railway가 제공하는 CNAME)
4. SSL 자동 발급 (Let's Encrypt)

---

## 🐛 트러블슈팅

### 문제 1: 배포 실패 (Build Error)

**로그 확인**:
```
Railway Dashboard → Deployments → 실패한 배포 → Logs
```

**일반적인 원인**:
- `requirements.txt`의 패키지 버전 충돌
- Docker 빌드 오류
- 메모리 부족

**해결 방법**:
```bash
# 로컬에서 Docker 빌드 테스트
docker build -t test-backend .
docker run -p 8000:8000 test-backend
```

---

### 문제 2: 환경 변수 누락

**증상**: `config_valid: false` 응답

**확인**:
```bash
curl https://your-project.up.railway.app/api/health
# {"status": "ok", "config_valid": false}
```

**해결**:
1. Railway Dashboard → Variables 탭
2. 누락된 환경 변수 추가 (app/config.py:95-111 참조)
3. 자동 재배포 대기 (30초)

---

### 문제 3: CORS 에러

**증상**: Frontend에서 `Access-Control-Allow-Origin` 에러

**해결**:
```bash
# Railway Dashboard → Variables에 추가
VERCEL_FRONTEND_URL=https://your-frontend.vercel.app
```

또는 여러 도메인:
```bash
ALLOWED_ORIGINS=https://domain1.com,https://domain2.com
```

---

### 문제 4: 502 Bad Gateway

**원인**: Backend가 시작되지 않았거나 크래시됨

**확인**:
```bash
# Railway Dashboard → Deployments → Logs 확인
```

**일반적인 원인**:
- 환경 변수 오류로 FastAPI 시작 실패
- 메모리 부족
- Azure 서비스 연결 실패

---

## 🔧 Railway CLI (선택사항)

터미널에서 Railway 관리:

```bash
# Railway CLI 설치
npm i -g @railway/cli

# 로그인
railway login

# 프로젝트 연결
railway link

# 로그 확인
railway logs

# 환경 변수 확인
railway variables

# 로컬에서 Railway 환경으로 실행
railway run python -m uvicorn app.main:app
```

---

## 📦 Railway vs Azure Container Apps 비교

| 기능 | Railway | Azure Container Apps |
|------|---------|---------------------|
| **설정 난이도** | ⭐ 매우 쉬움 | ⭐⭐⭐ 복잡 |
| **배포 속도** | 3-5분 | 10-15분 |
| **GitHub 연동** | 자동 | 수동 설정 필요 |
| **Container Registry** | 불필요 | Azure ACR 필요 |
| **무료 티어** | $5/월 크레딧 | Pay-as-you-go |
| **로그 확인** | 실시간 웹 UI | Azure CLI 또는 Portal |
| **커스텀 도메인** | 무료 SSL | 추가 설정 필요 |
| **스케일링** | 수동 (최대 32GB) | 자동 (더 큰 규모) |
| **Azure 통합** | 없음 | 완벽 (같은 리전) |

**권장 사항**:
- **소규모 프로젝트, 빠른 개발**: Railway ✅
- **대규모 엔터프라이즈, Azure 중심**: Azure Container Apps

---

## 🎓 학습 자료

- [Railway 공식 문서](https://docs.railway.app)
- [Railway + FastAPI 가이드](https://docs.railway.app/guides/fastapi)
- [Railway Discord 커뮤니티](https://discord.gg/railway)

---

## ✅ 체크리스트

배포 전:
- [ ] Dockerfile 존재 확인
- [ ] requirements.txt 버전 명시
- [ ] 모든 환경 변수 준비
- [ ] JWT_SECRET 생성 (32자 이상)

배포 후:
- [ ] Health check 응답 확인 (`/api/health`)
- [ ] Vercel에 Backend URL 설정
- [ ] Railway에 Frontend URL 설정
- [ ] CORS 테스트 (Frontend에서 API 호출)
- [ ] 로그인 테스트
- [ ] 파일 업로드 테스트
- [ ] 채팅 기능 테스트

---

**Railway 배포 완료! 🎉**

더 간단하고 빠른 배포를 원한다면 Railway가 최고의 선택입니다!
