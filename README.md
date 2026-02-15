# Kkuldanji (Honeypot) - AI-Assisted Handover Document Generator (Prototype)

Kkuldanji converts internal documents into a structured 6-section handover document and supports follow-up Q&A via retrieval (vector + semantic search).

This repo was built as a portfolio prototype to practice:
- Document ingestion (PDF/DOCX/TXT/images/code)
- LLM-based preprocessing into structured JSON chunks
- Retrieval on Azure AI Search (embeddings + semantic ranking)
- Generation/Q&A on Azure OpenAI
- Practical web security basics (JWT, refresh tokens, CSRF, security headers)

Status: prototype. Some security features use in-memory stores (suitable for demo/dev, not production).

## Table of Contents
- [Problem](#problem)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [LLM Strategy](#llm-strategy)
- [Directory Structure](#directory-structure)
- [Local Run](#local-run)
- [API](#api)
- [Security Notes](#security-notes)
- [Testing](#testing)
- [Ops Artifacts](#ops-artifacts)
- [Limitations](#limitations)

## Problem
Handover documents are often:
- Time-consuming to write and review
- Inconsistent in structure across teams
- Missing key details (owners, timelines, risks, references)

Kkuldanji aims to reduce that overhead by extracting structured information from uploaded documents and generating an editable handover template, with retrieval-backed Q&A for follow-ups.

## Key Features
- Upload multiple files (PDF/DOCX/TXT/images/code)
- Async processing pipeline with progress tracking
- LLM preprocessing to structured JSON chunks (optimized for indexing/search)
- Retrieval-backed chat using top-k relevant chunks
- "Generate report" flow producing a 6-section handover JSON that the UI renders/edit
- Optional Electron packaging for desktop usage

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│ Frontend (React + Vite + TypeScript)                           │
│ - Upload sidebar                                               │
│ - Handover editor (6 sections)                                 │
│ - Chat/Q&A                                                     │
└───────────────────────────────┬───────────────────────────────┘
                                │ HTTP (JWT + CSRF header)
┌───────────────────────────────▼───────────────────────────────┐
│ Backend (FastAPI)                                              │
│ - app/routers/auth.py    (login/refresh/me)                    │
│ - app/routers/upload.py  (async ingest + status)               │
│ - app/routers/chat.py    (analyze + chat)                      │
│ - app/security.py        (JWT/CSRF/rate-limit helpers)          │
│ - app/services/*         (blob/doc/search/llm)                 │
└───────────────────────────────┬───────────────────────────────┘
                                │
┌───────────────────────────────▼───────────────────────────────┐
│ Cloud Services (optional for local demo)                       │
│ - Azure Blob Storage (raw + processed JSON)                    │
│ - Azure Document Intelligence (OCR / PDF pipeline)             │
│ - Azure AI Search (vector + semantic search)                   │
│ - Azure OpenAI (generation + embeddings)                       │
│ - Google Gemini (preprocessing)                                │
└───────────────────────────────────────────────────────────────┘
```

## LLM Strategy
This project uses "model role separation" to reduce failure modes and cost:

1) Preprocess (long text -> structured JSON chunks)
- Provider: Google Gemini (OpenAI-compatible endpoint)
- Goal: robust JSON extraction for long inputs (up to 50,000 chars in this prototype)
- Output: chunk list with metadata fields (`fileName`, `parentSummary`, `chunkSummary`, `tags`, `relatedSection`, ...)

2) Retrieval + Q&A / Report generation
- Provider: Azure OpenAI (configurable deployment)
- Goal: higher answer quality and consistent schema output

Configuration is controlled by `proto.env`:
- `GEMINI_MODEL` (preprocess)
- `AZURE_OPENAI_CHAT_DEPLOYMENT` (generate report, chat)
- `AZURE_OPENAI_EMBEDDING_DEPLOYMENT` (embeddings for retrieval)

## Directory Structure
```
.
├── app/
│   ├── main.py                 # FastAPI entrypoint, CORS, security headers
│   ├── config.py               # loads proto.env, optional Key Vault helper
│   ├── security.py             # JWT/refresh/CSRF/rate-limit helpers (demo-grade)
│   ├── routers/
│   │   ├── auth.py             # /api/auth/*
│   │   ├── upload.py           # /api/upload/*
│   │   └── chat.py             # /api/analyze, /api/chat
│   └── services/
│       ├── openai_service.py   # Azure OpenAI + Gemini calls
│       ├── search_service.py   # Azure AI Search index/create/search
│       ├── blob_service.py     # Azure Blob (raw/processed)
│       ├── document_service.py # text extraction (DOCX local + Azure DI)
│       └── prompts.py          # JSON extraction prompts
├── frontend/
│   ├── App.tsx
│   ├── services/               # auth + API calls
│   ├── components/             # UI
│   └── electron/               # optional desktop packaging
├── proto.env.example           # local env template (copy to proto.env)
├── RUNBOOK.md
└── .github/workflows/ci.yml
```

## Local Run
### Prerequisites
- Python 3.9+
- Node.js 18+

### 1) Backend
Demo mode (no cloud keys):
- You can run the full UI end-to-end without Azure/Gemini credentials.
- If `proto.env` is missing or incomplete, the backend auto-falls back to `APP_MODE=demo`.
- Demo mode supports: `txt`, `md`, code files, and `docx` uploads (PDF/images require live mode).

Live mode (Azure/OpenAI/Search/Gemini):
Create `proto.env`:
```bash
cp proto.env.example proto.env
```

Install and run:
```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend endpoints:
- Health: `GET http://localhost:8000/api/health`
- Swagger: `http://localhost:8000/docs`

### 2) Frontend
```bash
cd frontend
npm ci
npm run dev
```

Open:
- `http://localhost:5173`

### Demo Accounts
For the local prototype login:
- `user1@company.com / password123`
- `user2@company.com / password123`
- `admin@company.com / admin123`

## API
All state-changing requests must include:
- `Authorization: Bearer <access_token>`
- `X-CSRF-Token: <csrf_token>`

### Auth
- `POST /api/auth/login`
  - body: `{ "email": "...", "password": "..." }`
- `POST /api/auth/refresh`
  - body: `{ "refresh_token": "..." }`
- `GET /api/auth/me`
- `POST /api/auth/validate-token`

### Upload
- `POST /api/upload` (multipart)
  - fields: `file`, optional `index_name`
- `GET /api/upload/status/{task_id}`
- `GET /api/upload/documents` (optional query: `index_name`)
- `GET /api/upload/indexes`

### Analyze / Chat
Frontend sends a message array (OpenAI-style):
- `POST /api/analyze`
  - body: `{ "messages": [{ "role": "user", "content": "..." }, ...], "index_name": "..." }`
- `POST /api/chat`
  - body: `{ "messages": [...], "index_name": "..." }`

## Data Flow
1. Upload (`POST /api/upload`)
1. Backend async pipeline:
1. Raw file upload to Blob (uses a safe `task_id` filename)
1. Text extraction:
1. TXT/code: decode bytes
1. DOCX: local extraction (`python-docx`)
1. PDF/images: Azure Document Intelligence (via SAS URL)
1. LLM preprocessing (Gemini) produces structured chunk JSON
1. Store processed JSON to Blob (optional)
1. Index chunks to Azure AI Search (embeddings + semantic config)
1. Generate report (`POST /api/analyze`) uses indexed docs as context and produces 6-section JSON
1. Q&A (`POST /api/chat`) runs retrieval over the selected index and answers using Azure OpenAI

Implementation pointers:
- Pipeline orchestration: `app/routers/upload.py`
- Chunk indexing/search: `app/services/search_service.py`
- LLM calls and schema expectations: `app/services/openai_service.py`, `app/services/prompts.py`

## Security Notes
Implemented (prototype-grade):
- JWT access token + refresh token
- CSRF token issued at login; required via `X-CSRF-Token` header
- Basic login rate limiting (in-memory per IP)
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, etc.)
- Safe blob naming: use `task_id`-based filenames to avoid OCR failures on non-ASCII/whitespace filenames

Not implemented (out of scope for this prototype):
- Persistent token store / revocation (e.g., Redis)
- Real user management / SSO
- Fine-grained document RBAC enforced at retrieval time

## Testing
Backend:
```bash
python -m unittest discover -s tests -p 'test_*.py'
```

Frontend:
```bash
cd frontend
npm run build
```

CI: `.github/workflows/ci.yml` runs backend compile/tests + frontend build.

## Ops Artifacts
- `RUNBOOK.md` (local demo runbook)
- `POSTMORTEM_TEMPLATE.md` (incident postmortem template)
- `.github/workflows/ci.yml` (CI pipeline)

## Deployment Notes
This repo includes deployment references for a few common setups:
- Backend: `Dockerfile`, `Procfile`, `railway.json`, `RAILWAY_DEPLOYMENT.md`
- Frontend: Vite build in `frontend/` (recommended to set `VITE_API_BASE_URL` in production)

If you run into CORS/environment issues, see:
- `DEPLOYMENT_GUIDE.md`
- `CONNECTION_GUIDE.md`

## Troubleshooting
- CORS errors:
  - Ensure frontend `VITE_API_BASE_URL` points to the backend base URL.
  - Backend allows additional domains via `ALLOWED_ORIGINS` (comma-separated).
- 401 / token expired loops:
  - Confirm `refresh_token` is stored in localStorage and `/api/auth/refresh` is reachable.
- 403 CSRF errors:
  - Ensure requests include `X-CSRF-Token` from the login response.
- Azure AI Search indexing failures:
  - Confirm the index exists and you provided a key with indexing permissions.
  - Embedding vector dimension must match the index schema (default: 3072 for `text-embedding-3-large`).

## Limitations
- Live mode requires cloud credentials for the full pipeline (Blob / Document Intelligence / AI Search / Azure OpenAI / Gemini).
- Demo mode upload support: `txt`, `md`, code files, and `docx` (PDF/images require Azure Document Intelligence in live mode).
- Demo mode retrieval is keyword-based (no vector/semantic ranking).
- Demo mode index is in-memory (resets when the backend restarts).
- Demo mode report generation / chat are deterministic (no external LLM calls).
- Token stores (refresh/CSRF) are in-memory for demo purposes.
