# 꿀단지 Electron 데스크톱 앱 가이드

React + Electron으로 구현된 완전한 데스크톱 애플리케이션입니다.
Python FastAPI 백엔드가 자동으로 번들링되어 독립 실행형 앱으로 동작합니다.

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
# 프론트엔드 의존성 설치
cd frontend
npm install

# 백엔드 의존성 설치
cd ..
pip install -r requirements.txt
pip install pyinstaller  # 백엔드 빌드용
```

### 2. 개발 모드 실행

```bash
# 터미널 1: 백엔드 실행
cd /home/user/honeypot_proto
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 터미널 2: Electron 앱 실행
cd frontend
npm run electron:dev
```

개발 모드에서는 Vite dev 서버(포트 5173)와 Python 백엔드(포트 8000)가 별도로 실행됩니다.

## 📦 프로덕션 빌드

### 1단계: Python 백엔드 빌드

```bash
# 프로젝트 루트에서
./build_backend.sh
```

이 스크립트는:
- PyInstaller로 Python 백엔드를 독립 실행 파일로 빌드
- `dist/backend` 생성
- 빌드된 파일을 `frontend/electron/resources/backend/`로 복사

### 2단계: Electron 앱 빌드

```bash
cd frontend

# 프론트엔드 빌드
npm run build

# Electron 앱 패키징
npm run electron:build
```

빌드된 앱은 `frontend/release/` 디렉토리에 생성됩니다.

## 🏗️ 프로젝트 구조

```
honeypot_proto/
├── app/                          # Python FastAPI 백엔드
│   ├── main.py
│   ├── routers/
│   └── services/
├── frontend/                     # React 프론트엔드
│   ├── electron/                 # Electron 관련 파일
│   │   ├── main.js              # Electron 메인 프로세스
│   │   ├── preload.js           # 프리로드 스크립트
│   │   └── resources/           # 앱 리소스 (아이콘 등)
│   ├── src/                     # React 소스 코드
│   ├── dist/                    # 빌드된 React 앱
│   ├── electron-builder.json   # Electron 빌드 설정
│   └── package.json
├── backend.spec                 # PyInstaller 빌드 설정
└── build_backend.sh            # 백엔드 빌드 스크립트
```

## 🔧 주요 설정 파일

### package.json 스크립트

```json
{
  "scripts": {
    "dev": "vite",                              // Vite dev 서버
    "build": "tsc && vite build",               // React 앱 빌드
    "electron": "wait-on http://localhost:5173 && electron .",  // Electron 실행
    "electron:dev": "concurrently \"npm run dev\" \"npm run electron\"",  // 개발 모드
    "electron:build": "npm run build && electron-builder"  // 프로덕션 빌드
  }
}
```

### vite.config.ts

```typescript
export default defineConfig({
  base: './',  // Electron에서 상대 경로로 리소스 로드
  build: {
    outDir: 'dist'
  }
});
```

## 🎯 동작 방식

### 개발 모드
1. Vite dev 서버가 포트 5173에서 실행
2. Electron이 `http://localhost:5173`을 로드
3. Python 백엔드는 별도로 실행 (포트 8000)

### 프로덕션 모드
1. React 앱이 `frontend/dist`에 빌드됨
2. Python 백엔드가 독립 실행 파일로 빌드됨
3. Electron 앱 시작 시:
   - 번들된 백엔드 자동 실행 (포트 8000)
   - 빌드된 React 앱 로드
4. 앱 종료 시 백엔드도 자동 종료

## 🔐 보안 설정

Electron 앱의 보안을 위해 다음 설정이 적용되었습니다:

```javascript
webPreferences: {
  nodeIntegration: false,      // Node.js 통합 비활성화
  contextIsolation: true,       // 컨텍스트 격리 활성화
  preload: path.join(__dirname, 'preload.js')  // 프리로드 스크립트
}
```

## 📝 환경 변수

백엔드에서 사용하는 환경 변수들은 `.env` 파일에 설정:

```bash
# Azure Blob Storage
AZURE_STORAGE_CONNECTION_STRING=your_connection_string
AZURE_CONTAINER_NAME=your_container

# Azure AI Search
AZURE_SEARCH_ENDPOINT=your_search_endpoint
AZURE_SEARCH_ADMIN_KEY=your_search_key
AZURE_SEARCH_INDEX_NAME=your_index_name

# OpenAI (또는 Azure OpenAI)
OPENAI_API_KEY=your_openai_key
```

## 🐛 문제 해결

### Electron 설치 실패
네트워크 문제로 Electron 설치가 실패하는 경우:
```bash
cd frontend
npm cache clean --force
npm install
```

### 백엔드 빌드 오류
의존성 누락 시:
```bash
pip install -r requirements.txt
pip install pyinstaller uvicorn[standard]
```

### 빌드된 앱에서 백엔드가 시작되지 않음
- `electron/main.js`의 로그 확인
- 백엔드 실행 파일 경로 확인
- 환경 변수 설정 확인

## 📱 지원 플랫폼

- **Windows**: `.exe` (NSIS 인스톨러)
- **macOS**: `.dmg`
- **Linux**: `.AppImage`, `.deb`

## 🎨 아이콘 추가

앱 아이콘을 추가하려면 `frontend/electron/resources/`에 다음 파일들을 배치:

- `icon.png` (Linux용, 512x512 이상)
- `icon.ico` (Windows용)
- `icon.icns` (macOS용)

## 🔄 업데이트

향후 자동 업데이트 기능을 추가하려면 `electron-updater` 사용을 권장합니다.

```bash
npm install electron-updater
```

## 📚 참고 자료

- [Electron 공식 문서](https://www.electronjs.org/docs)
- [electron-builder 문서](https://www.electron.build/)
- [PyInstaller 문서](https://pyinstaller.org/)
- [Vite 문서](https://vitejs.dev/)
