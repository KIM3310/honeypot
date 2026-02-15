from __future__ import annotations

import re
import threading
from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple


DEFAULT_INDEX_NAME = "documents-index"

_lock = threading.Lock()
_indexes: Dict[str, List[Dict[str, Any]]] = defaultdict(list)


def normalize_index_name(index_name: Optional[str]) -> str:
    name = (index_name or "").strip()
    return name or DEFAULT_INDEX_NAME


def ensure_index(index_name: Optional[str]) -> str:
    name = normalize_index_name(index_name)
    with _lock:
        _indexes.setdefault(name, [])
    return name


def list_indexes() -> List[Dict[str, Any]]:
    with _lock:
        # Always expose the default index so the UI has something to select.
        _indexes.setdefault(DEFAULT_INDEX_NAME, [])
        names = sorted(_indexes.keys())
    return [{"name": n, "fields_count": 0} for n in names]


def add_chunks(index_name: Optional[str], chunks: Iterable[Dict[str, Any]]) -> int:
    name = ensure_index(index_name)
    now_iso = datetime.utcnow().isoformat() + "Z"
    batch = []
    for c in chunks:
        if not isinstance(c, dict):
            continue
        c = dict(c)
        c.setdefault("processedDate", now_iso)
        # Keep both camelCase and snake_case names to match existing API consumers.
        file_name = c.get("fileName") or c.get("file_name") or ""
        if file_name:
            c["fileName"] = file_name
            c["file_name"] = file_name
        batch.append(c)

    with _lock:
        _indexes[name].extend(batch)
    return len(batch)


def get_all_documents(index_name: Optional[str] = None) -> List[Dict[str, Any]]:
    name = ensure_index(index_name)
    with _lock:
        docs = list(_indexes.get(name, []))
    return docs


def get_document_count(index_name: Optional[str] = None) -> int:
    name = ensure_index(index_name)
    with _lock:
        return len(_indexes.get(name, []))


def _tokenize(text: str) -> List[str]:
    parts = re.split(r"[^0-9A-Za-z가-힣]+", (text or "").lower())
    return [p for p in parts if len(p) >= 2]


def search_documents(query: str, *, top_k: int = 5, index_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Local demo search (keyword overlap). Returns a list shaped similarly to Azure Search results.
    """
    name = ensure_index(index_name)
    q = (query or "").strip()
    if not q:
        return []

    q_tokens = set(_tokenize(q))
    if not q_tokens:
        return []

    with _lock:
        docs = list(_indexes.get(name, []))

    scored: List[Tuple[float, Dict[str, Any]]] = []
    for d in docs:
        content = str(d.get("content") or "")
        summary = str(d.get("chunkSummary") or "")
        hay = f"{summary}\n{content}"
        hay_l = hay.lower()
        score = 0.0

        # Exact substring bonus.
        if q.lower() in hay_l:
            score += 3.0

        # Token overlap.
        for t in q_tokens:
            if t in hay_l:
                score += 1.0

        if score <= 0:
            continue

        out = {
            "id": d.get("id"),
            "content": content,
            "fileName": d.get("fileName") or d.get("file_name") or "",
            "file_name": d.get("fileName") or d.get("file_name") or "",
            "parentSummary": d.get("parentSummary") or "",
            "chunkSummary": summary,
            "score": score,
            "reranker_score": None,
        }
        scored.append((score, out))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [d for _s, d in scored[: max(1, top_k)]]


def clear_all() -> None:
    """Test helper."""
    with _lock:
        _indexes.clear()

