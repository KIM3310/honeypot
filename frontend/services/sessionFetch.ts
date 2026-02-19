import { API_ENDPOINTS, fetchWithRetry } from "../config/api";
import {
  getAuthHeaders,
  getRefreshToken,
  removeAllTokens,
  setCsrfToken,
  setToken,
} from "../utils/auth";

function syncCsrfFromResponse(response: Response): void {
  const nextCsrf = response.headers.get("X-CSRF-Token");
  if (nextCsrf) {
    setCsrfToken(nextCsrf);
  }
}

async function tryRefreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

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
    return false;
  }

  if (!response.ok) return false;

  const data = await response.json().catch(() => ({}));
  if (typeof data?.access_token !== "string" || !data.access_token) {
    return false;
  }
  setToken(data.access_token);
  if (typeof data?.csrf_token === "string" && data.csrf_token) {
    setCsrfToken(data.csrf_token);
  }
  return true;
}

export async function fetchWithSession(
  url: string,
  options: RequestInit = {},
  maxRetries = 3
): Promise<Response> {
  const makeRequest = () => {
    const headers = {
      ...(getAuthHeaders() as Record<string, string>),
      ...((options.headers as Record<string, string>) || {}),
    };
    if (options.body instanceof FormData) {
      delete headers["Content-Type"];
    }
    return fetchWithRetry(
      url,
      {
        ...options,
        headers,
      },
      maxRetries
    );
  };

  let response = await makeRequest();
  syncCsrfFromResponse(response);

  if (response.status === 401) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      response = await makeRequest();
      syncCsrfFromResponse(response);
    }
  }

  if (response.status === 401) {
    removeAllTokens();
    throw new Error("세션이 만료되었습니다. 다시 로그인해주세요.");
  }

  return response;
}
