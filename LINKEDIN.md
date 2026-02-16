[Team Project] Honeypot (Kkuldanji) — Azure-Based Internal Document Handover Copilot

Handover documents often fail not because information is missing, but because context is scattered across PDFs, chats, and personal notes, and the structure depends on whoever writes it. We built Honeypot (Kkuldanji), a prototype that converts uploaded internal documents into a structured 6-section handover report and supports follow-up Q&A using retrieval (Azure AI Search).

My role: system architecture design, backend implementation, and RAG quality improvement support.

End-to-end flow (live mode)
- Upload → text extraction (DOCX local; PDF/images via Azure Document Intelligence)
- LLM preprocessing into schema-first JSON chunks (Gemini)
- Indexing on Azure AI Search (vector + semantic)
- Report generation + chat on Azure OpenAI (GPT-4o)

Reliability / troubleshooting I worked through
- Raw indexing fragmented context and pushed answers into generic responses. We stabilized retrieval by enforcing a preprocessing schema (parentSummary, chunkSummary, tags, involvedPeople, relatedSection, chunkMeta) so chunks stay field-addressable and reviewable.
- Fixed an index/UI mapping mismatch (fileName vs file_name) that broke source display and traceability.
- Improved reproducibility with async ingest + status/progress tracking, safe blob naming (Task ID) to avoid OCR failures on non-ASCII filenames, and documented deployment pitfalls (CORS/env vars) for hybrid hosting (Vercel + Railway/Azure).

Security (prototype-grade)
- JWT + refresh, CSRF validation, security headers, optional Key Vault integration

Portfolio-friendly demo mode
- If cloud config is missing/incomplete, the backend falls back to APP_MODE=demo (local extraction + in-memory demo index + deterministic outputs).

Demo
https://honeypot-proto.vercel.app/

GitHub
https://github.com/KIM3310/honeypot

