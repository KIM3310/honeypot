from __future__ import annotations

from dataclasses import dataclass
import ipaddress
from typing import Optional
from urllib.parse import urlparse

from fastapi import Request


DEFAULT_USER_MODEL = "gpt-4o-mini"
LOCAL_OVERRIDE_API_KEY = "ollama-local"
LOCAL_HOSTNAMES = {"localhost", "host.docker.internal"}


@dataclass(frozen=True)
class LLMOverrideConfig:
    api_key: str
    model: str = DEFAULT_USER_MODEL
    base_url: Optional[str] = None


def _clean(value: Optional[str], *, max_len: int = 2048) -> str:
    return str(value or "").strip()[:max_len]


def _extract_host(raw_url: str) -> str:
    candidate = raw_url.split("/", 1)[0].strip().lower()
    if candidate.startswith("[") and "]" in candidate:
        return candidate[1 : candidate.find("]")]
    if ":" in candidate:
        return candidate.split(":", 1)[0]
    return candidate


def _is_local_host(hostname: str) -> bool:
    host = (hostname or "").strip().lower()
    if not host:
        return False
    if host in LOCAL_HOSTNAMES:
        return True
    try:
        parsed = ipaddress.ip_address(host)
        return parsed.is_loopback or parsed.is_private or parsed.is_link_local
    except ValueError:
        return host.endswith(".local")


def _normalize_base_url(value: Optional[str]) -> str:
    base_url = _clean(value)
    if not base_url:
        return ""

    if not base_url.startswith(("http://", "https://")):
        scheme = "http://" if _is_local_host(_extract_host(base_url)) else "https://"
        base_url = f"{scheme}{base_url}"

    return base_url.rstrip("/")


def _is_local_base_url(value: str) -> bool:
    parsed = urlparse(value)
    return _is_local_host(parsed.hostname or "")


def parse_llm_override_from_request(request: Request) -> Optional[LLMOverrideConfig]:
    """
    Read optional per-request LLM credentials from headers.

    Security note:
    - The key is used only for this request path and not persisted server-side.
    """
    api_key = _clean(request.headers.get("X-LLM-Api-Key"), max_len=512)
    model = _clean(request.headers.get("X-LLM-Model"), max_len=128) or DEFAULT_USER_MODEL
    base_url = _normalize_base_url(request.headers.get("X-LLM-Base-URL"))

    if not api_key:
        if base_url and _is_local_base_url(base_url):
            # Ollama local mode: keep auth optional while preserving OpenAI client compatibility.
            api_key = LOCAL_OVERRIDE_API_KEY
        else:
            return None

    return LLMOverrideConfig(
        api_key=api_key,
        model=model,
        base_url=base_url or None,
    )


def summarize_override_for_log(config: Optional[LLMOverrideConfig]) -> str:
    if not config:
        return "server-default"
    suffix = config.api_key[-4:] if len(config.api_key) >= 4 else "****"
    return f"user-key(...{suffix})/{config.model}"
