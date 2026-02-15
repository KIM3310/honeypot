# Honeypot / Kkuldanji Runbook (Local Demo)

This repo contains:
- FastAPI backend (Python) in `app/`
- Vite + React frontend in `frontend/`

Backend configuration is loaded from `proto.env`.

## Prerequisites
- Python 3.9+
- Node.js 18+ (20+ recommended)

## Setup
1. Backend env:
   - Copy `proto.env.example` -> `proto.env`
   - Fill required Azure/OpenAI/Search values for live mode
   - Demo mode (no cloud creds): omit `proto.env` or set `APP_MODE=demo` (supports `txt/md/code/docx`)

2. Install backend:
   ```bash
   python3 -m pip install -r requirements.txt
   ```

3. Install frontend:
   ```bash
   cd frontend
   npm ci
   ```

## Run (Dev)
Terminal A (backend):
```bash
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Terminal B (frontend):
```bash
cd frontend
npm run dev
```

## Health Checks
- Backend: `GET http://localhost:8000/api/health` or open `http://localhost:8000/docs`
- Frontend: Vite URL (typically `http://localhost:5173`)

## Demo Script (5 minutes)
1. Upload a sample document (demo mode: `txt/md/code/docx`; live mode: PDF/images supported).
2. Live mode: confirm extraction path (Document Intelligence vs local DOCX) works as expected.
3. Generate a structured handover document (6-section format).
4. Ask follow-up questions and verify retrieval quality (citations / relevant chunks).
5. Verify basic security controls (auth headers/JWT, safe filename handling).

## Troubleshooting
- CORS issues:
  - See `DEPLOYMENT_GUIDE.md` and ensure frontend `VITE_API_BASE_URL` matches backend URL.
- Azure env vars missing:
  - Backend reads from `proto.env`. Confirm values are present and no trailing spaces.
