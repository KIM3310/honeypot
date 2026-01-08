// frontend/services/geminiService.ts
import {
  getAuthHeaders,
  removeToken,
  removeAllTokens,
  getCsrfToken,
  removeCsrfToken,
} from "../utils/auth.ts";
import { HandoverData, SourceFile } from "../types.ts";
import { API_BASE_URL, API_ENDPOINTS } from "../config/api";

const CONFIG = {
  USE_LOCAL_BACKEND: true,
  LOCAL_BACKEND_URL: API_BASE_URL,
  AZURE_ENDPOINT: "https://YOUR_RESOURCE_NAME.openai.azure.com",
  AZURE_KEY: "YOUR_AZURE_API_KEY",
  DEPLOYMENT_NAME: "YOUR_DEPLOYMENT_NAME",
  API_VERSION: "2024-02-15-preview",
};

// ← 추가: Refresh Token으로 토큰 갱신
async function refreshAccessToken(): Promise<string | null> {
  try {
    // 여기서 Backend의 /api/auth/refresh 호출
    // (이미 auth.ts에 getRefreshToken이 있으면 사용)
    console.log("🔄 Access Token 갱신 중...");

    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) return null;

    const response = await fetch(API_ENDPOINTS.REFRESH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      console.error("❌ Refresh Token 갱신 실패");
      return null;
    }

    const data = await response.json();
    const newAccessToken = data.access_token;

    // 새 토큰 저장
    localStorage.setItem("access_token", newAccessToken);
    console.log("✅ 새 Access Token 획득");

    return newAccessToken;
  } catch (error) {
    console.error("❌ Refresh 에러:", error);
    return null;
  }
}

async function callAI(path: string, payload: any) {
  let url = "";
  const authHeaders = getAuthHeaders();
  let headers: Record<string, string> = authHeaders instanceof Headers
    ? Object.fromEntries(authHeaders.entries())
    : Array.isArray(authHeaders)
    ? Object.fromEntries(authHeaders)
    : (authHeaders as Record<string, string>);
  let body = JSON.stringify(payload);

  if (CONFIG.USE_LOCAL_BACKEND) {
    url = `${CONFIG.LOCAL_BACKEND_URL}/api${path}`;
  } else {
    url = `${CONFIG.AZURE_ENDPOINT}/openai/deployments/${CONFIG.DEPLOYMENT_NAME}/chat/completions?api-version=${CONFIG.API_VERSION}`;
    headers["api-key"] = CONFIG.AZURE_KEY;
    body = JSON.stringify({
      messages: payload.messages,
      response_format: payload.response_format,
      temperature: payload.temperature || 0.7,
    });
  }

  try {
    console.log(`🌐 ${path} 요청:`, {
      url,
      method: "POST",
      headerKeys: Object.keys(headers),
    });
    console.log(`📊 페이로드 크기: ${body.length} bytes`);

    const fetchOptions: RequestInit = {
      method: "POST",
      headers: headers,
      body: body,
      mode: "cors",
      credentials: "include",
    };

    const response = await fetch(url, fetchOptions);
    console.log(`📨 ${path} 응답 상태:`, response.status, response.statusText);

    // ← Step 1: 429 Rate Limit 처리 (401 전에 추가)
    if (response.status === 429) {
      const error = await response.json();
      const retryAfter = response.headers.get("Retry-After");

      console.error(
        `❌ 너무 많은 요청입니다. ${retryAfter}초 후 다시 시도해주세요.`
      );
      throw new Error(
        `너무 많은 요청이 발생했습니다. ${retryAfter}초 후 다시 시도해주세요.`
      );
    }

    // ← Step 2: 403 CSRF 처리
    if (response.status === 403) {
      const error = await response.json();
      console.error("❌ CSRF Token 검증 실패:", error.detail);

      removeCsrfToken();
      throw new Error("보안 검증에 실패했습니다. 다시 로그인해주세요.");
    }

    // ← Step 3: 401 토큰 만료 처리 (Refresh 자동 시도)
    if (response.status === 401) {
      console.warn("⚠️ Access Token 만료. Refresh Token으로 갱신 시도...");

      const newAccessToken = await refreshAccessToken();

      if (newAccessToken) {
        console.log("✅ 새로운 Access Token 획득. API 재요청...");

        // ✅ 방법 2 사용 (간단하고 명확)
        const newHeaders = getAuthHeaders();
        const retryResponse = await fetch(url, {
          ...fetchOptions,
          headers: newHeaders,
          body: body, // ← body도 명시적으로 포함
        });

        if (retryResponse.ok) {
          console.log("✅ 재요청 성공");
          return await retryResponse.json();
        }
      }

      // Refresh 실패 시 로그아웃
      console.error("❌ Refresh 실패. 로그아웃합니다.");
      removeAllTokens();
      window.location.href = "/";
      throw new Error("토큰 갱신에 실패했습니다. 다시 로그인해주세요.");
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ${path} HTTP 에러:`, response.status, errorText);
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(
          `API 에러 (${response.status}): ${errorJson.detail || errorText}`
        );
      } catch {
        throw new Error(`API 에러 (${response.status}): ${errorText}`);
      }
    }

    const result = await response.json();
    console.log(`✅ ${path} 성공 응답:`, result);

    if (CONFIG.USE_LOCAL_BACKEND) {
      const content = result.content || result.response;
      if (typeof content === "object") {
        console.log("✅ content가 이미 object 형태");
        return content;
      }
      if (typeof content === "string") {
        try {
          console.log("🔍 content를 JSON으로 파싱 시도");
          return JSON.parse(content);
        } catch (e) {
          console.warn(
            "⚠️ content JSON 파싱 실패, 원본 반환:",
            content.substring(0, 200)
          );
          return content;
        }
      }
      return content;
    } else {
      return result.choices[0].message.content;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`🔴 callAI 전체 에러 [${path}]:`, errorMsg);
    console.error(` URL: ${url}`);
    console.error(` 원본 에러:`, error);

    // 네트워크 오류 처리
    if (error instanceof TypeError && errorMsg.includes('fetch')) {
      throw new Error(
        `백엔드 서버에 연결할 수 없습니다.\n` +
        `- 백엔드가 실행 중인지 확인해주세요 (http://localhost:8000)\n` +
        `- 네트워크 연결을 확인해주세요`
      );
    }

    throw error;
  }
}

function decodeBase64(base64String: string): string {
  try {
    return atob(base64String);
  } catch (e) {
    console.warn("Base64 디코딩 실패:", e);
    return base64String;
  }
}

export const analyzeFilesForHandover = async (
  files: SourceFile[]
): Promise<HandoverData> => {
  const fileContext = files
    .map((f) => {
      const content = f.content.substring(0, 2000);
      return `[파일명: ${f.name}]\n${content}`;
    })
    .join("\n\n---\n");

  console.log("📄 생성된 파일 컨텍스트:", fileContext.substring(0, 500));

  const payload = {
    messages: [
      {
        role: "system",
        content:
          "당신은 인수인계서 생성 전문가입니다. 반드시 JSON 형식으로만 답변하세요.",
      },
      {
        role: "user",
        content: `다음 자료를 분석해 인수인계서 JSON을 만들어줘. 파일이 없으면 샘플 데이터로 만들어줘:\n\n${fileContext}`,
      },
    ],
    response_format: { type: "json_object" },
  };

  try {
    console.log("🔍 analyzeFilesForHandover 호출 - 파일수:", files.length);
    const responseData = await callAI("/analyze", payload);

    console.log(
      "📦 API 응답 타입:",
      typeof responseData,
      "내용:",
      responseData
    );

    if (
      typeof responseData === "object" &&
      responseData !== null &&
      "overview" in responseData
    ) {
      console.log("✅ 응답이 이미 HandoverData 형태");
      return responseData as HandoverData;
    }

    if (typeof responseData === "string") {
      try {
        console.log("🔍 응답을 JSON으로 파싱");
        const parsed = JSON.parse(responseData);
        return parsed as HandoverData;
      } catch (e) {
        console.error(
          "❌ JSON 파싱 실패:",
          e,
          "원본:",
          responseData.substring(0, 200)
        );
        throw new Error(`JSON 파싱 실패: ${e}`);
      }
    }

    console.log("✨ 최종 결과:", responseData);
    return responseData as HandoverData;
  } catch (error) {
    console.error("❌ analyzeFilesForHandover 에러:", error);
    throw error;
  }
};

export const chatWithGemini = async (
  message: string,
  files: SourceFile[],
  history: { role: string; text: string }[]
): Promise<string> => {
  const payload = {
    messages: [
      { role: "system", content: "당신은 인수인계 도우미 '꿀단지'입니다." },
      ...history.map((h) => ({
        role: h.role === "user" ? "user" : "assistant",
        content: h.text,
      })),
      { role: "user", content: message },
    ],
  };

  return await callAI("/chat", payload);
};
