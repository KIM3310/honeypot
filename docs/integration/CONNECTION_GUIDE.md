# 🔗 Railway ↔️ Vercel 연결 확인 체크리스트

## ✅ 설정 확인

### Railway (Backend)
- [ ] 배포 완료됨
- [ ] Backend URL 확인: `https://________.up.railway.app`
- [ ] Health check 응답: `curl https://your-backend.up.railway.app/api/health`
- [ ] 환경 변수 설정됨:
  - [ ] `VERCEL_FRONTEND_URL` = Vercel URL
  - [ ] `AZURE_STORAGE_ACCOUNT_NAME` (필수)
  - [ ] `AZURE_OPENAI_API_KEY` (필수)
  - [ ] `AZURE_SEARCH_KEY` (필수)
  - [ ] `GOOGLE_API_KEY` (필수)
  - [ ] `JWT_SECRET` (필수, 32자 이상)
  - [ ] 기타 Azure 관련 변수들

### Vercel (Frontend)
- [ ] 배포 완료됨
- [ ] Frontend URL 확인: `https://________.vercel.app`
- [ ] 환경 변수 설정됨:
  - [ ] `VITE_API_BASE_URL` = Railway URL
- [ ] 환경 변수 추가 후 재배포 완료

## 🧪 기능 테스트

### 1. 로그인 테스트
```
URL: https://your-frontend.vercel.app
1. 페이지 열기
2. 로그인 화면 표시 확인
3. 로컬에서 생성한 개발용 계정으로 로그인
4. 로그인 성공 확인
```

- [ ] 로그인 화면 표시됨
- [ ] 로그인 성공
- [ ] 채팅 화면으로 이동

### 2. API 호출 테스트 (개발자 도구)
```
F12 → Network 탭
- POST /api/auth/login → 200 OK
- Status: 200
- Response: { "access_token": "...", "token_type": "bearer" }
```

- [ ] `/api/auth/login` 호출 성공
- [ ] CORS 에러 없음
- [ ] 200 응답 받음

### 3. 파일 업로드 테스트
```
1. 채팅 화면 진입
2. 왼쪽 사이드바 "파일 업로드" 클릭
3. 테스트 파일 업로드 (.txt, .pdf, .docx 중 하나)
4. 업로드 진행률 확인
5. 업로드 완료 확인
```

- [ ] 파일 선택 가능
- [ ] 업로드 시작됨
- [ ] 업로드 완료 (Azure Blob Storage)

### 4. 채팅 테스트
```
1. 채팅 입력창에 메시지 입력
2. 전송 버튼 클릭
3. AI 응답 대기
4. 응답 표시 확인
```

- [ ] 메시지 전송 가능
- [ ] AI 응답 받음 (OpenAI/Gemini)
- [ ] 채팅 히스토리 표시됨

## 🐛 문제 발생 시

### CORS 에러
```
Console에 표시:
Access to fetch at 'https://...' from origin 'https://...' has been blocked by CORS
```

**해결**:
1. Railway → Variables → `VERCEL_FRONTEND_URL` 확인
2. 값이 정확한 Vercel URL인지 확인 (https://, 슬래시 없음)
3. Railway 자동 재배포 대기 (30초)
4. 브라우저 캐시 지우기 (Ctrl+Shift+R)

### 502 Bad Gateway
```
Backend URL 접속 시 502 에러
```

**해결**:
1. Railway → Deployments → 로그 확인
2. 환경 변수 누락 확인 (특히 Azure 관련)
3. Railway → Variables에서 필수 변수 모두 있는지 확인

### 401 Unauthorized (로그인 실패)
```
로그인 시 401 에러
```

**해결**:
1. JWT_SECRET 환경 변수 확인
2. Backend 로그 확인 (Railway → Deployments → Logs)
3. ENVIRONMENT=production 설정 확인

### config_valid: false
```
/api/health 응답:
{ "status": "ok", "config_valid": false }
```

**해결**:
1. Railway → Variables 확인
2. 모든 필수 Azure 환경 변수 설정되었는지 확인
3. 변수 값에 오타가 없는지 확인

## 📝 환경 변수 전체 목록

### Railway (Backend) - 필수 15개

```bash
# 환경 설정
ENVIRONMENT=production

# Azure Storage
AZURE_STORAGE_ACCOUNT_NAME=xxx
AZURE_STORAGE_ACCOUNT_KEY=xxx
AZURE_STORAGE_CONTAINER_NAME=kkuldanji-mvp-raw

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://xxx.openai.azure.com/
AZURE_OPENAI_API_KEY=xxx
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o
AZURE_OPENAI_EMBEDDING_DEPLOYMENT=text-embedding-3-large

# Azure AI Search
AZURE_SEARCH_ENDPOINT=https://xxx.search.windows.net
AZURE_SEARCH_KEY=xxx
AZURE_SEARCH_INDEX_NAME=kkuldanji-mvp

# Google Gemini
GOOGLE_API_KEY=xxx
GEMINI_MODEL=gemini-3-pro-preview

# Security
JWT_SECRET=your-super-secret-key-minimum-32-characters-long
JWT_ALGORITHM=HS256

# CORS
VERCEL_FRONTEND_URL=https://your-frontend.vercel.app
```

### Vercel (Frontend) - 필수 1개

```bash
VITE_API_BASE_URL=https://your-backend.up.railway.app
```

## 🎉 연결 완료!

모든 체크리스트를 통과하면 Railway Backend와 Vercel Frontend가 성공적으로 연결된 것입니다!

---

**다음 단계**:
- 실제 사용자 테스트
- 성능 모니터링 (Railway Metrics, Vercel Analytics)
- 에러 로그 확인 (Railway Logs)
