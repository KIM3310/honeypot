from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any, Dict, List


def _now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _safe_strip(s: str, max_len: int) -> str:
    t = (s or "").strip()
    if len(t) <= max_len:
        return t
    return t[: max(0, max_len - 20)] + f"\n\n...[truncated {len(t) - max_len} chars]"


def _split_paragraphs(text: str) -> List[str]:
    # Split on blank lines, keep only non-empty.
    parts = re.split(r"\n\s*\n+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def _chunk_text(text: str, *, max_chars: int = 1200) -> List[str]:
    paras = _split_paragraphs(text)
    if not paras:
        return []

    chunks: List[str] = []
    buf: List[str] = []
    size = 0
    for p in paras:
        if size + len(p) + 2 > max_chars and buf:
            chunks.append("\n\n".join(buf).strip())
            buf = [p]
            size = len(p)
        else:
            buf.append(p)
            size += len(p) + 2
    if buf:
        chunks.append("\n\n".join(buf).strip())
    return chunks


_STOPWORDS = {
    "the",
    "and",
    "for",
    "with",
    "this",
    "that",
    "from",
    "into",
    "have",
    "has",
    "will",
    "are",
    "was",
    "were",
    "you",
    "your",
    "our",
    "their",
    "they",
    "them",
    "있습니다",
    "합니다",
    "그리고",
    "하지만",
    "또는",
    "및",
    "에서",
    "으로",
    "입니다",
    "합니다",
}


def _extract_tags(text: str, *, limit: int = 8) -> List[str]:
    tokens = re.split(r"[^0-9A-Za-z가-힣]+", (text or "").lower())
    out: List[str] = []
    seen = set()
    for t in tokens:
        t = t.strip()
        if len(t) < 3:
            continue
        if t in _STOPWORDS:
            continue
        if t in seen:
            continue
        seen.add(t)
        out.append(t)
        if len(out) >= limit:
            break
    return out


def _related_sections(text: str) -> List[str]:
    t = (text or "").lower()
    sec = set()
    if any(k in t for k in ["risk", "issue", "현안", "리스크"]):
        sec.add("risks")
    if any(k in t for k in ["roadmap", "계획", "마일스톤"]):
        sec.add("roadmap")
    if any(k in t for k in ["owner", "담당", "contact", "연락"]):
        sec.add("stakeholders")
    if any(k in t for k in ["system", "tool", "계정", "접속", "url"]):
        sec.add("resources")
    return sorted(sec)


def build_demo_chunks(text: str, file_name: str, *, file_type: str = "doc") -> List[Dict[str, Any]]:
    """
    Demo-grade preprocessing that creates structured chunk JSON without external LLM calls.
    The returned shape is compatible with the rest of the pipeline and local demo search.
    """
    text = _safe_strip(text, 50_000)
    chunks_text = _chunk_text(text, max_chars=1200)
    if not chunks_text:
        return []

    parent_summary = _safe_strip(text.replace("\n", " "), 400)
    processed_date = _now_iso()
    out: List[Dict[str, Any]] = []

    for i, c in enumerate(chunks_text):
        first_line = (c.splitlines()[0].strip() if c.splitlines() else "").strip()
        chunk_summary = _safe_strip(first_line or c.replace("\n", " "), 160)

        out.append(
            {
                "id": str(uuid.uuid4()),
                "parentId": "",
                "fileName": file_name,
                "filePath": "",
                "url": "",
                "fileType": file_type,
                "language": "",
                "framework": "",
                "serviceDomain": "",
                "processedDate": processed_date,
                "paraCategory": "demo",
                "isArchived": False,
                "content": c,
                "parentSummary": parent_summary,
                "chunkSummary": chunk_summary,
                "codeExplanation": "",
                "designIntent": "",
                "handoverNotes": "",
                "codeComments": [],
                "tags": _extract_tags(c),
                "relatedSection": _related_sections(c),
                "chunkMeta": {"index": i + 1, "total": len(chunks_text)},
                "codeMetadata": {},
                "involvedPeople": [],
                "rawCode": "",
                "relatedFiles": [],
            }
        )

    return out


def generate_demo_handover(context: str) -> Dict[str, Any]:
    """
    Demo-grade handover generator.
    Produces the frontend-required JSON shape without calling Azure OpenAI.
    """
    text = _safe_strip(context, 20_000)

    # Extremely light metadata extraction
    email_re = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}")
    emails = email_re.findall(text)
    first_email = emails[0] if emails else ""

    title = "Handover Draft (Demo)"
    if "프로젝트" in text or "project" in text.lower():
        title = "Project Handover Draft (Demo)"

    responsibilities = []
    for line in text.splitlines():
        s = line.strip()
        if s.startswith(("-", "•", "*")) and len(s) > 4:
            responsibilities.append(s.lstrip("-•* ").strip())
        if len(responsibilities) >= 5:
            break

    if not responsibilities:
        responsibilities = [
            "Review uploaded documents and confirm owners / timelines.",
            "Validate access to systems, credentials, and runbooks.",
            "Track open risks and next milestones.",
        ]

    return {
        "overview": {
            "transferor": {"name": "", "position": "", "contact": first_email},
            "transferee": {"name": "", "position": "", "contact": ""},
            "reason": "",
            "background": _safe_strip(text.replace("\n", " "), 600),
            "period": "",
            "schedule": [],
        },
        "jobStatus": {
            "title": title,
            "responsibilities": responsibilities,
            "authority": "",
            "reportingLine": "",
            "teamMission": "",
            "teamGoals": [],
        },
        "priorities": [
            {"rank": 1, "title": "Confirm key stakeholders and escalation path", "status": "TODO", "solution": "", "deadline": ""},
            {"rank": 2, "title": "Validate system access and deployment environment variables", "status": "TODO", "solution": "", "deadline": ""},
            {"rank": 3, "title": "Run a dry-run handover Q&A session and capture gaps", "status": "TODO", "solution": "", "deadline": ""},
        ],
        "stakeholders": {"manager": "", "internal": [], "external": []},
        "teamMembers": [],
        "ongoingProjects": [],
        "risks": {"issues": "", "risks": ""},
        "roadmap": {"shortTerm": "", "longTerm": ""},
        "resources": {"docs": [], "systems": [], "contacts": []},
        "checklist": [{"text": "Run demo pipeline end-to-end", "completed": False}],
    }


def generate_demo_chat_answer(query: str, context: str) -> str:
    q = (query or "").strip()
    if not q:
        return "메시지를 입력해주세요."

    # Pick relevant lines as evidence.
    q_tokens = [t for t in re.split(r"[^0-9A-Za-z가-힣]+", q.lower()) if len(t) >= 2]
    hits: List[str] = []
    for line in (context or "").splitlines():
        l = line.strip()
        if not l:
            continue
        ll = l.lower()
        if any(t in ll for t in q_tokens):
            hits.append(l)
        if len(hits) >= 5:
            break

    if not hits:
        return "문서에서 확인되지 않습니다. 업로드된 자료에 해당 내용이 있는지 확인해 주세요."

    bullets = "\n".join(f"- {h}" for h in hits)
    return f"문서 근거 기반 답변 (Demo 모드)\n\n질문: {q}\n\n근거:\n{bullets}"

