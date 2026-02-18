from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from fastapi import Request


DEFAULT_USER_MODEL = "gpt-4o-mini"


@dataclass(frozen=True)
class LLMOverrideConfig:
    api_key: str
    model: str = DEFAULT_USER_MODEL
    base_url: Optional[str] = None


def _clean(value: Optional[str], *, max_len: int = 2048) -> str:
    return str(value or "").strip()[:max_len]


def parse_llm_override_from_request(request: Request) -> Optional[LLMOverrideConfig]:
    """
    Read optional per-request LLM credentials from headers.

    Security note:
    - The key is used only for this request path and not persisted server-side.
    """
    api_key = _clean(request.headers.get("X-LLM-Api-Key"), max_len=512)
    if not api_key:
        return None

    model = _clean(request.headers.get("X-LLM-Model"), max_len=128) or DEFAULT_USER_MODEL
    base_url = _clean(request.headers.get("X-LLM-Base-URL"))
    if base_url and not base_url.startswith(("http://", "https://")):
        base_url = f"https://{base_url}"

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
