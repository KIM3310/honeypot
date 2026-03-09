# 🚀 꿀단지 (Kkuldanji) 배포 가이드

이 가이드는 **하이브리드 아키텍처** 배포 방법을 설명합니다:
- **Frontend**: Vercel에 배포
- **Backend**: Railway 또는 Azure Container Apps에 배포

---

## 🎯 Backend 배포 옵션 선택

### 🚂 Option A: Railway (권장 - 간편함)
**장점**: 간단한 설정, GitHub 자동 연동, 무료 티어, 빠른 배포
**단점**: 소규모 프로젝트에 적합, Azure 리전 최적화 불가
👉 **[Railway 배포 가이드 보기](./RAILWAY_DEPLOYMENT.md)**

### 🐳 Option B: Azure Container Apps (엔터프라이즈)
**장점**: Azure 서비스와 같은 리전, 대규모 스케일링, Key Vault 통합
**단점**: 복잡한 설정, Azure CLI 필요, 비용 발생
👉 **아래 가이드 계속 진행**

---

## 📋 목차

1. [사전 준비사항](#사전-준비사항)
2. [Backend 배포 (Azure Container Apps)](#backend-배포-azure-container-apps)
3. [Frontend 배포 (Vercel)](#frontend-배포-vercel)
4. [환경 변수 설정](#환경-변수-설정)
5. [배포 확인](#배포-확인)
6. [트러블슈팅](#트러블슈팅)

---

## 🔧 사전 준비사항

### 필수 계정 및 도구
- [x] Azure 계정 (Container Apps, Storage, OpenAI 등 사용)
- [x] Vercel 계정
- [x] Azure CLI 설치: `brew install azure-cli` (macOS) 또는 [공식 문서](https://docs.microsoft.com/cli/azure/install-azure-cli)
- [x] Docker 설치 (로컬 테스트용)
- [x] Git

### Azure 리소스 준비
다음 Azure 리소스들이 이미 생성되어 있어야 합니다:
- Azure Storage Account
- Azure OpenAI Service
- Azure AI Search
- Azure Document Intelligence (선택사항)
- Azure Key Vault (선택사항, 권장)
- Google Gemini API Key

---

## 🐳 Backend 배포 (Azure Container Apps)

### 1단계: Azure CLI 로그인

```bash
az login
az account set --subscription "your-subscription-id"
```

### 2단계: 리소스 그룹 생성 (있다면 건너뛰기)

```bash
az group create \
  --name kkuldanji-rg \
  --location koreacentral
```

### 3단계: Azure Container Registry (ACR) 생성

```bash
# ACR 생성
az acr create \
  --resource-group kkuldanji-rg \
  --name kkuldanjiacr \
  --sku Basic \
  --admin-enabled true

# ACR 로그인
az acr login --name kkuldanjiacr
```

### 4단계: Docker 이미지 빌드 및 푸시

```bash
# 프로젝트 루트에서 실행
cd /path/to/honeypot-main

# Docker 이미지 빌드
docker build -t kkuldanjiacr.azurecr.io/kkuldanji-backend:latest .

# 이미지 푸시
docker push kkuldanjiacr.azurecr.io/kkuldanji-backend:latest
```

### 5단계: Container Apps 환경 생성

```bash
az containerapp env create \
  --name kkuldanji-env \
  --resource-group kkuldanji-rg \
  --location koreacentral
```

### 6단계: Container App 생성 및 배포

```bash
az containerapp create \
  --name kkuldanji-backend \
  --resource-group kkuldanji-rg \
  --environment kkuldanji-env \
  --image kkuldanjiacr.azurecr.io/kkuldanji-backend:latest \
  --target-port 8000 \
  --ingress external \
  --registry-server kkuldanjiacr.azurecr.io \
  --registry-username kkuldanjiacr \
  --registry-password $(az acr credential show --name kkuldanjiacr --query "passwords[0].value" -o tsv) \
  --cpu 1.0 \
  --memory 2.0Gi \
  --min-replicas 1 \
  --max-replicas 3
```

### 7단계: 환경 변수 설정

```bash
az containerapp update \
  --name kkuldanji-backend \
  --resource-group kkuldanji-rg \
  --set-env-vars \
    ENVIRONMENT=production \
    AZURE_STORAGE_ACCOUNT_NAME="your-storage-account" \
    AZURE_STORAGE_ACCOUNT_KEY="your-storage-key" \
    AZURE_STORAGE_CONTAINER_NAME="kkuldanji-mvp-raw" \
    AZURE_OPENAI_ENDPOINT="https://your-openai.openai.azure.com/" \
    AZURE_OPENAI_API_KEY="your-openai-key" \
    AZURE_OPENAI_CHAT_DEPLOYMENT="gpt-4o" \
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT="text-embedding-3-large" \
    AZURE_SEARCH_ENDPOINT="https://your-search.search.windows.net" \
    AZURE_SEARCH_KEY="your-search-key" \
    AZURE_SEARCH_INDEX_NAME="kkuldanji-mvp" \
    GOOGLE_API_KEY="your-gemini-api-key" \
    GEMINI_MODEL="gemini-3-pro-preview" \
    JWT_SECRET="your-production-jwt-secret-min-32-chars" \
    JWT_ALGORITHM="HS256" \
    VERCEL_FRONTEND_URL="https://your-frontend.vercel.app"
```

**⚠️ 보안 권장사항**: Azure Key Vault를 사용하는 경우:

```bash
az containerapp update \
  --name kkuldanji-backend \
  --resource-group kkuldanji-rg \
  --set-env-vars \
    KEYVAULT_URL="https://your-keyvault.vault.azure.net/" \
    ENVIRONMENT=production
```

### 8단계: Backend URL 확인

```bash
az containerapp show \
  --name kkuldanji-backend \
  --resource-group kkuldanji-rg \
  --query properties.configuration.ingress.fqdn \
  -o tsv
```

출력 예시: `kkuldanji-backend.niceocean-12345678.koreacentral.azurecontainerapps.io`

**이 URL을 복사해두세요!** Frontend 배포 시 필요합니다.

---

## 🌐 Frontend 배포 (Vercel)

### 1단계: GitHub에 푸시 (선택사항)

Vercel은 Git 기반 배포를 지원합니다:

```bash
git add .
git commit -m "feat: Add Vercel deployment configuration"
git push origin claude/review-vercel-deployment-MbTDB
```

### 2단계: Vercel 프로젝트 생성

#### 방법 A: Vercel Dashboard (권장)

1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. "Add New Project" 클릭
3. GitHub 레포지토리 연결
4. 프로젝트 설정:
   - **Framework Preset**: Other
   - **Root Directory**: `./` (프로젝트 루트)
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Output Directory**: `frontend/dist`
   - **Install Command**: `cd frontend && npm install`

#### 방법 B: Vercel CLI

```bash
# Vercel CLI 설치
npm i -g vercel

# 프로젝트 루트에서 실행
cd /path/to/honeypot-main
vercel login
vercel
```

### 3단계: Vercel 환경 변수 설정

Vercel Dashboard → Settings → Environment Variables에서 추가:

| 변수 이름 | 값 | 설명 |
|----------|-----|------|
| `VITE_API_BASE_URL` | `https://kkuldanji-backend.xxx.azurecontainerapps.io` | Backend URL (8단계에서 확인한 URL) |
| `NODE_ENV` | `production` | 프로덕션 환경 |

**⚠️ 중요**: `VITE_API_BASE_URL`에 **https://** 포함, 끝에 **슬래시(/) 제거**

### 4단계: 배포 트리거

환경 변수 설정 후 자동으로 재배포되거나, 수동으로 트리거:

```bash
vercel --prod
```

### 5단계: Frontend URL 확인

배포 완료 후 Vercel이 제공하는 URL 확인:
- Production: `https://your-project.vercel.app`
- Preview: `https://your-project-git-branch.vercel.app`

**이 URL을 복사해두세요!** Backend CORS 설정에 필요합니다.

---

## 🔐 환경 변수 설정

### Backend 환경 변수 (Azure Container Apps)

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `ENVIRONMENT` | ✅ | `development` | `production` 설정 |
| `AZURE_STORAGE_ACCOUNT_NAME` | ✅ | - | Azure Storage 계정 이름 |
| `AZURE_STORAGE_ACCOUNT_KEY` | ✅ | - | Azure Storage 키 |
| `AZURE_STORAGE_CONTAINER_NAME` | ❌ | `kkuldanji-mvp-raw` | 원본 파일 컨테이너 |
| `AZURE_OPENAI_ENDPOINT` | ✅ | - | Azure OpenAI 엔드포인트 |
| `AZURE_OPENAI_API_KEY` | ✅ | - | Azure OpenAI API 키 |
| `AZURE_OPENAI_CHAT_DEPLOYMENT` | ❌ | `gpt-4o` | 채팅 모델 배포 이름 |
| `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` | ❌ | `text-embedding-3-large` | 임베딩 모델 |
| `AZURE_SEARCH_ENDPOINT` | ✅ | - | Azure AI Search 엔드포인트 |
| `AZURE_SEARCH_KEY` | ✅ | - | Azure AI Search 키 |
| `AZURE_SEARCH_INDEX_NAME` | ❌ | `kkuldanji-mvp` | 검색 인덱스 이름 |
| `GOOGLE_API_KEY` | ✅ | - | Google Gemini API 키 |
| `GEMINI_MODEL` | ❌ | `gemini-3-pro-preview` | Gemini 모델 |
| `JWT_SECRET` | ✅ | - | JWT 서명 키 (최소 32자) |
| `JWT_ALGORITHM` | ❌ | `HS256` | JWT 알고리즘 |
| `VERCEL_FRONTEND_URL` | ✅ | - | Vercel Frontend URL |
| `ALLOWED_ORIGINS` | ❌ | - | 추가 허용 도메인 (쉼표 구분) |

### Frontend 환경 변수 (Vercel)

| 변수 | 필수 | 설명 |
|------|------|------|
| `VITE_API_BASE_URL` | ✅ | Backend API URL (https://xxx.azurecontainerapps.io) |
| `NODE_ENV` | ✅ | `production` |

---

## ✅ 배포 확인

### Backend Health Check

```bash
curl https://kkuldanji-backend.xxx.azurecontainerapps.io/api/health
```

응답 예시:
```json
{
  "status": "ok",
  "config_valid": true
}
```

### Frontend 접속

브라우저에서 Vercel URL 접속:
```
https://your-project.vercel.app
```

### CORS 테스트

1. Frontend 로그인 페이지 접속
2. 브라우저 개발자 도구 (F12) → Console 탭
3. CORS 에러 확인:
   - ✅ 정상: API 호출 성공
   - ❌ 에러: `Access-Control-Allow-Origin` 에러 → Backend CORS 설정 확인

### 통합 테스트

1. **로그인 테스트**
   - 로컬에서 생성한 demo user 또는 개발 환경 전용 계정을 사용

2. **파일 업로드 테스트**
   - PDF, DOCX 파일 업로드
   - Azure Blob Storage에 저장 확인

3. **채팅 테스트**
   - RAG 검색 기능 테스트
   - AI 응답 확인

4. **Report 생성 테스트**
   - Handover Form 작성
   - PDF 다운로드 확인

---

## 🐛 트러블슈팅

### 문제 1: CORS 에러

**증상**: 브라우저 콘솔에 `Access-Control-Allow-Origin` 에러

**해결 방법**:

1. Backend CORS 설정 확인:
```bash
az containerapp show \
  --name kkuldanji-backend \
  --resource-group kkuldanji-rg \
  --query properties.template.containers[0].env
```

2. `VERCEL_FRONTEND_URL` 환경 변수 추가/수정:
```bash
az containerapp update \
  --name kkuldanji-backend \
  --resource-group kkuldanji-rg \
  --set-env-vars VERCEL_FRONTEND_URL="https://your-frontend.vercel.app"
```

3. Backend 재시작 대기 (30초~1분)

---

### 문제 2: Backend API 호출 실패 (404)

**증상**: Frontend에서 API 호출 시 404 Not Found

**원인**: `VITE_API_BASE_URL` 설정 오류

**해결 방법**:

1. Vercel Dashboard → Settings → Environment Variables
2. `VITE_API_BASE_URL` 값 확인:
   - ✅ 올바름: `https://kkuldanji-backend.xxx.azurecontainerapps.io`
   - ❌ 잘못됨: 끝에 `/` 있음, `http://` 사용, 포트 번호 포함
3. 수정 후 Vercel 재배포

---

### 문제 3: Backend 시작 실패

**증상**: Container App이 실행되지 않음

**로그 확인**:
```bash
az containerapp logs show \
  --name kkuldanji-backend \
  --resource-group kkuldanji-rg \
  --tail 100
```

**일반적인 원인**:
- 환경 변수 누락 → `validate_config()` 실패
- Azure 서비스 권한 문제
- Docker 이미지 빌드 오류

**해결 방법**:
```bash
# 로컬에서 Docker 이미지 테스트
docker run -p 8000:8000 \
  -e AZURE_STORAGE_ACCOUNT_NAME="xxx" \
  -e AZURE_STORAGE_ACCOUNT_KEY="xxx" \
  # ... 기타 환경 변수
  kkuldanjiacr.azurecr.io/kkuldanji-backend:latest

# 브라우저에서 http://localhost:8000/api/health 접속
```

---

### 문제 4: 빌드 실패 (Vercel)

**증상**: Vercel 빌드 중 에러 발생

**로그 확인**: Vercel Dashboard → Deployments → 실패한 배포 클릭 → Build Logs

**일반적인 원인**:
- `frontend/package.json` 의존성 오류
- TypeScript 컴파일 에러
- 메모리 부족

**해결 방법**:
```bash
# 로컬에서 빌드 테스트
cd frontend
npm install
npm run build

# 에러 확인 및 수정
```

---

### 문제 5: Azure 비용 최적화

**현재 설정**:
- Container Apps: 최소 1개, 최대 3개 인스턴스
- CPU: 1.0 core, 메모리: 2.0GB

**비용 절감 방법**:

1. **개발 환경에서는 최소 인스턴스 0으로 설정** (Cold Start 발생):
```bash
az containerapp update \
  --name kkuldanji-backend \
  --resource-group kkuldanji-rg \
  --min-replicas 0
```

2. **리소스 크기 축소**:
```bash
az containerapp update \
  --name kkuldanji-backend \
  --resource-group kkuldanji-rg \
  --cpu 0.5 \
  --memory 1.0Gi
```

---

## 🔄 업데이트 배포

### Backend 업데이트

```bash
# 1. 코드 수정 후 Docker 이미지 재빌드
docker build -t kkuldanjiacr.azurecr.io/kkuldanji-backend:latest .

# 2. 이미지 푸시
docker push kkuldanjiacr.azurecr.io/kkuldanji-backend:latest

# 3. Container App 업데이트
az containerapp update \
  --name kkuldanji-backend \
  --resource-group kkuldanji-rg \
  --image kkuldanjiacr.azurecr.io/kkuldanji-backend:latest
```

### Frontend 업데이트

```bash
# Git push만 하면 자동 배포
git add .
git commit -m "feat: Update frontend"
git push origin your-branch

# 또는 수동 배포
vercel --prod
```

---

## 📊 모니터링

### Azure Monitor

```bash
# Container App 메트릭 확인
az monitor metrics list \
  --resource /subscriptions/{sub-id}/resourceGroups/kkuldanji-rg/providers/Microsoft.App/containerApps/kkuldanji-backend \
  --metric "Requests"
```

### Vercel Analytics

Vercel Dashboard → Analytics에서 확인:
- 트래픽
- 페이지 로드 시간
- Core Web Vitals

---

## 🔒 보안 체크리스트

- [ ] JWT_SECRET을 강력한 비밀번호로 설정 (최소 32자)
- [ ] Azure Key Vault 사용 (프로덕션 권장)
- [ ] HTTPS 강제 (Vercel, Azure는 기본 제공)
- [ ] CORS 설정 검증 (불필요한 도메인 제거)
- [ ] 환경 변수에 민감 정보 노출 확인
- [ ] Azure Storage 컨테이너 권한 확인 (Private)
- [ ] API Rate Limiting 설정 (현재 로그인 10회/분)
- [ ] 로그 모니터링 설정

---

## 📞 지원

문제가 발생하면:
1. 이 가이드의 트러블슈팅 섹션 확인
2. Backend 로그 확인: `az containerapp logs show`
3. Vercel Build Logs 확인
4. Azure Portal에서 리소스 상태 확인

---

## 📝 참고 문서

- [Azure Container Apps 공식 문서](https://learn.microsoft.com/azure/container-apps/)
- [Vercel 배포 가이드](https://vercel.com/docs)
- [FastAPI 배포](https://fastapi.tiangolo.com/deployment/)
- [Vite 프로덕션 빌드](https://vitejs.dev/guide/build.html)

---

**배포 완료! 🎉**
