# 꿀단지 (Kkuldanji) - AI 인수인계서 생성 시스템

> **Sweet Handover AI** - 당신의 업무를 가장 달콤하게 이어주는 AI

업무 문서를 업로드하면 AI가 자동으로 체계적인 인수인계서를 생성하는 엔터프라이즈급 RAG(Retrieval-Augmented Generation) 시스템입니다.

---

## 📋 목차

- [프로젝트 개요](#프로젝트-개요)
- [핵심 기능](#핵심-기능)
- [아키텍처](#아키텍처)
- [기술 스택](#기술-스택)
- [LLM 사용 전략](#llm-사용-전략)
- [디렉토리 구조](#디렉토리-구조)
- [설치 및 실행](#설치-및-실행)
- [사용 방법](#사용-방법)
- [API 엔드포인트](#api-엔드포인트)
- [데이터 플로우](#데이터-플로우)
- [보안](#보안)

---

## 🎯 프로젝트 개요

### 문제점
- 인수인계 문서 작성에 많은 시간 소요
- 중요한 정보 누락 위험
- 비표준화된 인수인계 프로세스

### 솔루션
꿀단지는 업무 문서를 분석하여 자동으로 체계적인 인수인계서를 생성합니다:
- 📄 **자동 문서 분석**: PDF, DOCX, TXT 등 다양한 파일 형식 지원
- 🤖 **AI 기반 생성**: Azure OpenAI와 Google Gemini를 전략적으로 활용
- 📊 **구조화된 출력**: 6개 섹션으로 체계화된 인수인계서
- 💬 **대화형 AI 어시스턴트**: 실시간 질의응답 및 문서 보완
- 🔒 **엔터프라이즈 보안**: JWT 인증, CSRF 방어, Azure Key Vault 통합

---

## 🚀 핵심 기능

### 1. 파일 업로드 및 자동 처리
- **지원 파일 형식**: PDF, DOCX, TXT, 이미지, 코드 파일
- **자동 텍스트 추출**: Azure Document Intelligence 활용
- **백그라운드 처리**: 비동기 파일 처리로 빠른 응답
- **진행 상태 추적**: 실시간 처리 상태 확인

### 2. AI 기반 문서 분석
- **컨텍스트 보존**: Gemini의 큰 컨텍스트 윈도우 활용
- **구조화된 데이터 추출**: JSON 형태로 정보 구조화
- **Azure AI Search 인덱싱**: 검색 최적화된 벡터 저장

### 3. 인수인계서 자동 생성
- **6개 핵심 섹션**: 개요, 직무, 과제, 현황, 자료, 확인
- **실시간 편집**: 생성된 내용을 즉시 수정 가능
- **대화형 보완**: AI 챗봇으로 추가 정보 요청

### 4. RAG 기반 검색
- **의미 기반 검색**: 벡터 임베딩으로 관련 문서 검색
- **하이브리드 검색**: 키워드 + 벡터 검색 결합
- **컨텍스트 인식**: 검색 결과를 바탕으로 정확한 답변 생성

---

## 🏗️ 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        프론트엔드 (React + Vite)                 │
│  ┌──────────────┬──────────────────────┬──────────────────┐    │
│  │ SourceSidebar│   HandoverForm       │  ChatWindow      │    │
│  │  자료 관리    │   인수인계서 편집     │  AI 어시스턴트    │    │
│  └──────────────┴──────────────────────┴──────────────────┘    │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP/REST API (JWT 인증)
┌───────────────────────────▼─────────────────────────────────────┐
│                    백엔드 (FastAPI + Python)                     │
│  ┌────────────┬────────────┬────────────┬────────────┐         │
│  │ auth.py    │ upload.py  │  chat.py   │  main.py   │         │
│  │ JWT 인증    │ 파일 처리   │ 챗봇 API   │ 라우팅     │         │
│  └────────────┴────────────┴────────────┴────────────┘         │
│  ┌──────────────────────────────────────────────────┐           │
│  │               Services Layer                      │           │
│  │  • openai_service.py  (LLM 통합)                 │           │
│  │  • blob_service.py    (파일 저장)                │           │
│  │  • search_service.py  (RAG 검색)                 │           │
│  │  • document_service.py (텍스트 추출)             │           │
│  └──────────────────────────────────────────────────┘           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      Azure Cloud Services                        │
│  ┌─────────────┬──────────────┬──────────────┬────────────┐    │
│  │ Blob Storage│ AI Search    │ OpenAI       │ Document   │    │
│  │ 파일 저장    │ 벡터 검색     │ GPT-4o       │ Intelligence│   │
│  └─────────────┴──────────────┴──────────────┴────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                      Google Cloud                                │
│  ┌────────────────────────────────────────────────┐             │
│  │  Gemini API (gemini-2.0-flash-exp)            │             │
│  │  - 대용량 텍스트 처리 (50,000자)                 │             │
│  └────────────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ 기술 스택

### 프론트엔드
- **React 19.2** - UI 프레임워크
- **TypeScript** - 타입 안정성
- **Vite** - 빌드 도구
- **Tailwind CSS** - 스타일링
- **Lucide React** - 아이콘

### 백엔드
- **FastAPI** - 고성능 웹 프레임워크
- **Python 3.10+** - 프로그래밍 언어
- **Uvicorn** - ASGI 서버
- **PyJWT** - JWT 인증
- **python-multipart** - 파일 업로드 처리

### AI/ML
- **Azure OpenAI (GPT-4o)** - 인수인계서 생성, 채팅
- **Google Gemini (2.0 Flash)** - 대용량 텍스트 → JSON 변환
- **Azure AI Search** - 벡터 검색 엔진
- **text-embedding-3-large** - 텍스트 임베딩

### Azure Services
- **Azure Blob Storage** - 파일 저장소 (Raw + Processed)
- **Azure Document Intelligence** - OCR 및 문서 분석
- **Azure Key Vault** - 시크릿 관리

---

## 🧠 LLM 사용 전략

### 왜 두 가지 LLM을 사용하는가?

| 단계 | 사용 LLM | 이유 | 파일 위치 |
|------|---------|------|-----------|
| **1. 파일 → JSON 변환** | **Google Gemini**<br>`gemini-2.0-flash-exp` | • **대용량 컨텍스트**: 50,000자 처리<br>• **빠른 응답**: Flash 모델<br>• **비용 효율적**: 토큰당 가격 저렴 | `app/services/openai_service.py:37-125` |
| **2. 인수인계서 생성** | **Azure OpenAI**<br>`gpt-4o` | • **정확한 구조화**: JSON 스키마 준수<br>• **일관된 품질**: 엔터프라이즈급 안정성<br>• **한국어 최적화**: 비즈니스 문서 생성 | `app/services/openai_service.py:127-287` |
| **3. 채팅 응답** | **Azure OpenAI**<br>`gpt-4o` | • **컨텍스트 이해**: RAG 검색 결과 활용<br>• **대화 일관성**: 이전 대화 기억<br>• **전문성**: 업무 관련 정확한 답변 | `app/services/openai_service.py:289-337` |

### 데이터 플로우 예시

```
[대용량 PDF 업로드 (20페이지)]
    ↓
[Gemini] 50,000자 텍스트 → 구조화된 JSON chunks
    ↓ (비용 효율적)
[Blob Storage] JSON 저장
    ↓
[Azure AI Search] 벡터 인덱싱
    ↓
[사용자: "리포트 생성" 클릭]
    ↓
[Azure OpenAI GPT-4o] 인덱스에서 데이터 조회 → HandoverData 생성
    ↓ (정확한 구조화)
[프론트엔드] 6개 섹션으로 구성된 인수인계서 표시
```

---

## 📁 디렉토리 구조

```
honeypot_proto/
├── app/                          # 백엔드 FastAPI 애플리케이션
│   ├── __init__.py
│   ├── main.py                   # FastAPI 앱 진입점
│   ├── config.py                 # 환경 변수 및 설정
│   ├── auth.py                   # JWT 인증 미들웨어
│   ├── state.py                  # 인메모리 태스크 관리
│   ├── routers/                  # API 라우터
│   │   ├── auth.py               # 인증 엔드포인트 (로그인, CSRF)
│   │   ├── upload.py             # 파일 업로드 및 처리
│   │   └── chat.py               # 채팅 및 분석 엔드포인트
│   └── services/                 # 비즈니스 로직
│       ├── openai_service.py     # LLM 통합 (Gemini + Azure OpenAI)
│       ├── blob_service.py       # Azure Blob Storage 연동
│       ├── search_service.py     # Azure AI Search 연동
│       ├── document_service.py   # 텍스트 추출 (OCR)
│       └── prompts.py            # LLM 프롬프트 템플릿
├── frontend/                     # 프론트엔드 React 애플리케이션
│   ├── App.tsx                   # 메인 앱 컴포넌트
│   ├── index.tsx                 # React 진입점
│   ├── components/               # UI 컴포넌트
│   │   ├── LoginScreen.tsx       # 로그인 화면
│   │   ├── SourceSidebar.tsx     # 파일 관리 사이드바
│   │   ├── HandoverForm.tsx      # 인수인계서 편집 폼
│   │   └── ChatWindow.tsx        # AI 챗봇 창
│   ├── services/                 # API 서비스
│   │   ├── geminiService.ts      # 백엔드 API 호출
│   │   └── authService.ts        # 인증 API
│   ├── utils/                    # 유틸리티
│   │   └── auth.ts               # 토큰 관리
│   ├── types.ts                  # TypeScript 타입 정의
│   ├── package.json              # NPM 의존성
│   └── vite.config.ts            # Vite 설정
├── requirements.txt              # Python 의존성
├── proto.env                     # 환경 변수 (git ignored)
├── test_upload.html              # 업로드 테스트 페이지
└── README.md                     # 이 문서
```

---

## 🔧 설치 및 실행

### 사전 요구사항
- **Python 3.10+**
- **Node.js 18+**
- **Azure 계정** (OpenAI, Blob Storage, AI Search, Document Intelligence)
- **Google Cloud 계정** (Gemini API)

### 1. 저장소 클론
```bash
git clone https://github.com/your-org/honeypot_proto.git
cd honeypot_proto
```

### 2. 환경 변수 설정
프로젝트 루트에 `proto.env` 파일을 생성하세요:

```env
# Azure Storage
AZURE_STORAGE_ACCOUNT_NAME=your_storage_account
AZURE_STORAGE_ACCOUNT_KEY=your_storage_key
AZURE_STORAGE_CONTAINER_NAME=kkuldanji-mvp-raw
AZURE_STORAGE_PROCESSED_CONTAINER_NAME=kkuldanji-mvp-processed

# Azure Document Intelligence
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=your_key

# Azure AI Search
AZURE_SEARCH_ENDPOINT=https://your-search.search.windows.net
AZURE_SEARCH_KEY=your_admin_key
AZURE_SEARCH_INDEX_NAME=documents-index

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com/
AZURE_OPENAI_API_KEY=your_openai_key
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-large
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Google Gemini
GOOGLE_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash-exp

# Key Vault (선택 사항)
KEYVAULT_URL=https://your-keyvault.vault.azure.net/
ENVIRONMENT=development
```

### 3. 백엔드 설치 및 실행
```bash
# Python 가상환경 생성
python -m venv venv

# 가상환경 활성화
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# 의존성 설치
pip install -r requirements.txt

# 백엔드 실행
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

백엔드가 `http://localhost:8000`에서 실행됩니다.

### 4. 프론트엔드 설치 및 실행
```bash
cd frontend

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

프론트엔드가 `http://localhost:5173`에서 실행됩니다.

---

## 📖 사용 방법

### 1단계: 로그인
```
URL: http://localhost:5173
테스트 계정:
- user1@company.com / password123
- user2@company.com / password123
- admin@company.com / admin123
```

### 2단계: 파일 업로드
1. 좌측 사이드바에서 **"자료 추가하기"** 버튼 클릭
2. PDF, DOCX, TXT 파일 선택 (여러 파일 동시 업로드 가능)
3. 자동으로 백그라운드 처리 시작:
   - 텍스트 추출
   - Gemini로 JSON 변환
   - Blob Storage 저장
   - AI Search 인덱싱

### 3단계: 인수인계서 생성
1. 우측 상단 **"리포트 생성하기"** 버튼 클릭
2. AI가 업로드된 문서를 분석하여 인수인계서 자동 생성
3. 6개 섹션으로 구성:
   - **1. 개요**: 인계자/인수자 정보, 인계 사유
   - **2. 직무**: 직무명, 핵심 책임, 보고 체계
   - **3. 과제**: Top 3 우선 과제, 관계자, 팀원
   - **4. 현황**: 진행 중 프로젝트, 이슈/리스크
   - **5. 자료**: 참고 문서, 시스템 정보
   - **6. 확인**: 체크리스트, 전자서명

### 4단계: 실시간 편집 및 대화
- 생성된 인수인계서는 모든 필드를 **직접 편집 가능**
- 우측 **AI 어시스턴트**에서 추가 질문:
  ```
  "프로젝트 X의 담당자는 누구인가요?"
  "다음 마일스톤은 언제인가요?"
  "누락된 정보를 추가해주세요"
  ```

### 5단계: 출력 및 저장
- 하단 **"리포트 출력 및 PDF 저장"** 버튼으로 PDF 생성
- 브라우저의 인쇄 기능 활용

---

## 🔌 API 엔드포인트

### 인증 (Authentication)
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user1@company.com",
  "password": "password123"
}

Response:
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "user_name": "김철수",
  "user_email": "user1@company.com",
  "user_role": "user"
}
```

### 파일 업로드 (Upload)
```http
POST /api/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary>

Response:
{
  "message": "Upload started",
  "task_id": "123e4567-e89b-12d3-a456-426614174000",
  "file_name": "report.pdf"
}
```

### 업로드 상태 확인
```http
GET /api/upload/status/{task_id}
Authorization: Bearer <token>

Response:
{
  "status": "processing",
  "progress": 70,
  "message": "Indexing to Search..."
}
```

### 문서 목록 조회
```http
GET /api/upload/documents
Authorization: Bearer <token>

Response:
{
  "count": 5,
  "documents": [
    {
      "id": "doc-1",
      "file_name": "report.pdf",
      "content": "문서 내용...",
      "content_length": 1234
    }
  ]
}
```

### 인수인계서 생성 (Analyze)
```http
POST /api/analyze
Authorization: Bearer <token>
Content-Type: application/json

{
  "messages": [
    {
      "role": "system",
      "content": "당신은 인수인계서 생성 전문가입니다."
    },
    {
      "role": "user",
      "content": "다음 자료를 분석해 인수인계서 JSON을 만들어줘..."
    }
  ]
}

Response:
{
  "overview": {...},
  "jobStatus": {...},
  "priorities": [...],
  ...
}
```

### 채팅 (Chat)
```http
POST /api/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "query": "프로젝트 X의 진행 상황은?",
  "index_name": "documents-index"
}

Response:
{
  "response": "프로젝트 X는 현재 70% 진행 중입니다..."
}
```

---

## 🔄 데이터 플로우

### 전체 시스템 플로우
```
[사용자 로그인]
    ↓
[JWT 토큰 발급]
    ↓
[파일 업로드 (SourceSidebar)]
    ↓
┌──────────────────────────────────────────────┐
│       백엔드 백그라운드 처리 파이프라인        │
├──────────────────────────────────────────────┤
│ 1. Raw Blob 업로드                           │
│    → kkuldanji-mvp-raw/{task_id}.pdf        │
│                                              │
│ 2. 텍스트 추출                                │
│    • TXT/코드: 직접 디코딩                    │
│    • DOCX: 로컬 추출 (python-docx)           │
│    • PDF/이미지: Azure Document Intelligence │
│                                              │
│ 3. LLM 분석 (Gemini) ← 대용량 컨텍스트        │
│    → 구조화된 JSON chunks 생성                │
│                                              │
│ 4. Processed JSON Blob 업로드                │
│    → kkuldanji-mvp-processed/{task_id}.json │
│                                              │
│ 5. Azure AI Search 인덱싱                    │
│    → documents-index에 벡터 저장              │
└──────────────────────────────────────────────┘
    ↓
[사용자: "리포트 생성" 클릭]
    ↓
[백엔드: AI Search에서 모든 문서 조회]
    ↓
[LLM 분석 (Azure OpenAI GPT-4o)]
    ↓
[HandoverData JSON 생성]
    ↓
[프론트엔드: HandoverForm 렌더링]
    ↓
[사용자: 실시간 편집 가능]
    ↓
[AI 챗봇으로 추가 질문]
    ↓
[RAG 검색 + Azure OpenAI 답변]
```

### 파일 처리 상세 플로우 (upload.py)
```python
# app/routers/upload.py:68-173
async def process_file_background(task_id, file_name, file_data, file_ext):
    # 1. Blob 업로드 (Raw)
    blob_url = upload_to_blob(f"{task_id}.{file_ext}", file_data)

    # 2. 텍스트 추출
    if file_ext in ['txt', 'py', ...]:
        text = file_data.decode('utf-8')
    elif file_ext == 'docx':
        text = extract_text_from_docx(file_data)
    else:
        text = extract_text_from_url(blob_url)  # Document Intelligence

    # 3. Gemini로 JSON 변환
    chunks = analyze_text_for_search(text, file_name, file_type)

    # 4. Processed JSON 저장
    json_str = json.dumps(chunks, ensure_ascii=False)
    save_processed_json(f"{task_id}_processed.json", json_str)

    # 5. AI Search 인덱싱
    indexed_count = index_processed_chunks(chunks)
```

---

## 🔒 보안

### 인증 및 권한
- **JWT (JSON Web Token)**: stateless 인증
- **토큰 만료**: 1시간 (갱신 가능)
- **역할 기반 접근 제어**: user, admin

### CSRF 방어
- **CSRF 토큰**: 모든 state-changing 요청에 필요
- **토큰 검증**: 서버 측 HMAC 서명 검증
- **세션 바인딩**: 사용자 이메일에 토큰 바인딩

### 보안 헤더
```python
# app/main.py:39-54
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000
```

### 시크릿 관리
- **Azure Key Vault**: 프로덕션 환경 시크릿 저장
- **환경 변수**: 개발 환경 로컬 `.env` 사용
- **Managed Identity**: 프로덕션 Azure 리소스 접근

### 데이터 보호
- **전송 중 암호화**: HTTPS/TLS
- **저장 시 암호화**: Azure Blob Storage 기본 암호화
- **SAS 토큰**: Blob 접근 제한 (1시간 유효)

---

## 🧪 테스트

### 백엔드 테스트
```bash
# 단위 테스트 (예정)
pytest app/tests/

# API 테스트
python test_login.py
```

### 프론트엔드 테스트
```bash
cd frontend

# 빌드 테스트
npm run build

# 미리보기
npm run preview
```

### 수동 테스트
1. `http://localhost:8000/docs` - Swagger UI
2. `http://localhost:8000/test` - 백엔드 헬스체크
3. `test_upload.html` - 파일 업로드 테스트 페이지

---

## 🐛 트러블슈팅

### 문제: 백엔드가 시작되지 않음
```bash
# 환경 변수 확인
python -c "from app.config import validate_config; validate_config()"

# 의존성 재설치
pip install -r requirements.txt --force-reinstall
```

### 문제: 파일 업로드 실패
- Azure Blob Storage 연결 확인
- SAS 토큰 생성 권한 확인
- 파일 크기 제한 확인 (기본 10MB)

### 문제: LLM 응답 없음
- Azure OpenAI 할당량 확인
- Gemini API 키 유효성 확인
- 로그 확인: `backend.log`

### 문제: 인덱싱 실패
- Azure AI Search 인덱스 생성 확인
- Admin Key 권한 확인
- 벡터 차원 일치 확인 (3072)

---

## 📊 성능 최적화

### 백엔드
- **비동기 처리**: FastAPI + BackgroundTasks
- **연결 풀링**: Azure SDK 싱글톤 패턴
- **청크 배치 인덱싱**: Azure Search 배치 API

### 프론트엔드
- **코드 스플리팅**: Vite 자동 최적화
- **Lazy Loading**: React.lazy (예정)
- **메모이제이션**: React.memo (예정)

### LLM
- **모델 선택**: Gemini Flash (빠름) → GPT-4o (정확)
- **컨텍스트 제한**: 50,000자 (Gemini), 4,000 토큰 (GPT-4o)
- **타임아웃**: 120초

---

## 🚀 배포

### Azure App Service (예정)
```bash
# 백엔드 배포
az webapp up --name honeypot-backend --resource-group honeypot-rg

# 프론트엔드 빌드 및 배포
cd frontend
npm run build
az storage blob upload-batch --account-name honeypot --destination '$web' --source ./dist
```

### Docker (예정)
```dockerfile
# Dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 📈 향후 개선 사항

### 기능
- [ ] 다국어 지원 (영어, 일본어)
- [ ] 인수인계서 템플릿 커스터마이징
- [ ] 버전 관리 및 히스토리
- [ ] 이메일 알림 (인계 완료 시)
- [ ] 모바일 반응형 개선

### 기술
- [ ] Redis 캐싱 (세션, 검색 결과)
- [ ] PostgreSQL (영구 데이터 저장)
- [ ] WebSocket (실시간 업데이트)
- [ ] Kubernetes 배포
- [ ] CI/CD 파이프라인 (GitHub Actions)

### 보안
- [ ] MFA (다중 인증)
- [ ] API Rate Limiting
- [ ] 감사 로그 (Azure Monitor)
- [ ] 민감 정보 마스킹

---

## 👥 기여

이 프로젝트는 엔터프라이즈 인수인계 프로세스 개선을 목표로 합니다.
기여하시려면 Pull Request를 제출해주세요.

---

## 📄 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

---

## 📞 문의

- **이슈 제기**: [GitHub Issues](https://github.com/your-org/honeypot_proto/issues)
- **이메일**: honeypot@company.com
- **문서**: [프로젝트 Wiki](https://github.com/your-org/honeypot_proto/wiki)

---

**Made with 🍯 by Kkuldanji Team**
