import unittest
from typing import Dict, Optional

from fastapi import Request

from app.services.llm_override import LOCAL_OVERRIDE_API_KEY, parse_llm_override_from_request


def _build_request(headers: Optional[Dict[str, str]] = None) -> Request:
    raw_headers = []
    for key, value in (headers or {}).items():
        raw_headers.append((key.lower().encode("utf-8"), value.encode("utf-8")))
    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "GET",
        "path": "/",
        "raw_path": b"/",
        "query_string": b"",
        "headers": raw_headers,
        "client": ("127.0.0.1", 12345),
        "server": ("testserver", 80),
        "scheme": "http",
    }
    return Request(scope)


class TestLlmOverride(unittest.TestCase):
    def test_returns_none_when_api_key_header_missing(self) -> None:
        request = _build_request()
        self.assertIsNone(parse_llm_override_from_request(request))

    def test_allows_local_override_without_api_key(self) -> None:
        request = _build_request(
            {
                "X-LLM-Model": "llama3.2:latest",
                "X-LLM-Base-URL": "127.0.0.1:11434/v1",
            }
        )
        cfg = parse_llm_override_from_request(request)

        self.assertIsNotNone(cfg)
        assert cfg is not None
        self.assertEqual(cfg.api_key, LOCAL_OVERRIDE_API_KEY)
        self.assertEqual(cfg.model, "llama3.2:latest")
        self.assertEqual(cfg.base_url, "http://127.0.0.1:11434/v1")

    def test_rejects_external_base_url_without_api_key(self) -> None:
        request = _build_request(
            {
                "X-LLM-Model": "gpt-4o-mini",
                "X-LLM-Base-URL": "api.openai.com/v1",
            }
        )
        self.assertIsNone(parse_llm_override_from_request(request))

    def test_parses_headers_and_normalizes_base_url(self) -> None:
        request = _build_request(
            {
                "X-LLM-Api-Key": " sk-test-1234 ",
                "X-LLM-Model": " gpt-4o-mini ",
                "X-LLM-Base-URL": "api.openai.com/v1",
            }
        )
        cfg = parse_llm_override_from_request(request)

        self.assertIsNotNone(cfg)
        assert cfg is not None
        self.assertEqual(cfg.api_key, "sk-test-1234")
        self.assertEqual(cfg.model, "gpt-4o-mini")
        self.assertEqual(cfg.base_url, "https://api.openai.com/v1")


if __name__ == "__main__":
    unittest.main()
