import { API_ENDPOINTS, fetchWithRetry } from "../config/api";
import {
  getAuthHeaders,
  getRefreshToken,
  removeAllTokens,
  removeCsrfToken,
  setToken,
} from "../utils/auth";
import { getLlmHeaders } from "../utils/llmConfig";
import { HandoverData, SourceFile } from "../types";

type ChatHistoryMessage = { role: string; text: string };

function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  let response: Response;
  try {
    response = await fetchWithRetry(
      API_ENDPOINTS.REFRESH,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      },
      2
    );
  } catch {
    return null;
  }

  if (!response.ok) return null;

  const data = await response.json().catch(() => ({}));
  const newAccessToken = data?.access_token;
  if (typeof newAccessToken === "string" && newAccessToken) {
    setToken(newAccessToken);
    return newAccessToken;
  }
  return null;
}

async function postJsonWithAuth(url: string, payload: unknown): Promise<unknown> {
  const body = JSON.stringify(payload);

  const fetchOnce = async (headers: Record<string, string>) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // AI response wait
    try {
      return await fetch(url, {
        method: "POST",
        headers,
        body,
        mode: "cors",
        credentials: "include",
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Request timed out (60s). Please retry.");
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  };

  const baseHeaders = {
    ...(getAuthHeaders() as Record<string, string>),
    ...getLlmHeaders(),
  };
  let response = await fetchOnce(baseHeaders);

  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    throw new Error(
      retryAfter
        ? `Too many requests. Retry after ${retryAfter}s.`
        : "Too many requests. Please retry later."
    );
  }

  if (response.status === 403) {
    removeCsrfToken();
    throw new Error("Security validation failed. Please sign in again.");
  }

  if (response.status === 401) {
    const newAccessToken = await refreshAccessToken();
    if (newAccessToken) {
      const retryHeaders = {
        ...(getAuthHeaders() as Record<string, string>),
        ...getLlmHeaders(),
      };
      response = await fetchOnce(retryHeaders);
    }
  }

  if (response.status === 401) {
    removeAllTokens();
    window.location.href = "/";
    throw new Error("Session expired. Please sign in again.");
  }

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorJson = JSON.parse(errorText);
      throw new Error(`API error (${response.status}): ${errorJson.detail || errorText}`);
    } catch {
      throw new Error(`API error (${response.status}): ${errorText}`);
    }
  }

  const result = await response.json();
  const content = result?.content ?? result?.response ?? result;

  if (typeof content === "string") return tryParseJson(content);
  return content;
}

export async function analyzeFilesForHandover(
  files: SourceFile[],
  indexName?: string
): Promise<HandoverData> {
  const fileContext = files
    .map((f) => {
      const content = f.content.substring(0, 2000);
      return `[파일명: ${f.name}]\n${content}`;
    })
    .join("\n\n---\n");

  const payload = {
    messages: [
      {
        role: "system",
        content: "당신은 인수인계서 생성 전문가입니다. 반드시 JSON 형식으로만 답변하세요.",
      },
      {
        role: "user",
        content: `다음 자료를 분석해 인수인계서 JSON을 만들어줘. 파일이 없으면 샘플 데이터로 만들어줘:\n\n${fileContext}`,
      },
    ],
    index_name: indexName || null,
    response_format: { type: "json_object" },
  };

  const data = await postJsonWithAuth(API_ENDPOINTS.ANALYZE, payload);
  return data as HandoverData;
}

export async function chatWithAssistant(
  message: string,
  _files: SourceFile[],
  history: ChatHistoryMessage[],
  indexName?: string
): Promise<string> {
  const payload = {
    messages: [
      { role: "system", content: "당신은 인수인계 도우미 '꿀단지'입니다." },
      ...history.map((h) => ({
        role: h.role === "user" ? "user" : "assistant",
        content: h.text,
      })),
      { role: "user", content: message },
    ],
    index_name: indexName || null,
  };

  const data = await postJsonWithAuth(API_ENDPOINTS.CHAT, payload);
  return String(data);
}
