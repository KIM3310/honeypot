// API 설정 파일
// Electron 환경 감지
const hasWindow = typeof window !== 'undefined';
const isElectron = hasWindow && !!(window as any).electronAPI;
const MISCONFIGURED_API_BASE_URL = "https://backend-not-configured.invalid";

// 개발/프로덕션 환경 감지
const isDev = import.meta.env.DEV;

function normalizeBaseUrl(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

const explicitApiBaseUrl = normalizeBaseUrl(
  String(import.meta.env.VITE_API_BASE_URL || '')
);

export const API_RUNTIME_CONFIG = {
  baseUrl: explicitApiBaseUrl || (isDev ? '' : isElectron ? 'http://localhost:8000' : MISCONFIGURED_API_BASE_URL),
  hasExplicitBaseUrl: explicitApiBaseUrl.length > 0,
  isDev,
  isElectron,
  isProductionMisconfigured: !isDev && !isElectron && explicitApiBaseUrl.length === 0,
};

export const API_BASE_URL = API_RUNTIME_CONFIG.baseUrl;

if (API_RUNTIME_CONFIG.isProductionMisconfigured) {
  console.warn(
    "VITE_API_BASE_URL is not set in production. Backend calls are disabled until the API base URL is configured."
  );
}

function apiPath(path: string): string {
  return API_BASE_URL ? `${API_BASE_URL}${path}` : path;
}

// API 엔드포인트
export const API_ENDPOINTS = {
  // 인증
  LOGIN: apiPath('/api/auth/login'),
  REFRESH: apiPath('/api/auth/refresh'),

  // 업로드
  UPLOAD: apiPath('/api/upload'),
  DOCUMENTS: apiPath('/api/upload/documents'),
  INDEXES: apiPath('/api/upload/indexes'),
  STATS: apiPath('/api/upload/stats'),

  // 채팅
  CHAT: apiPath('/api/chat'),
  ANALYZE: apiPath('/api/analyze'),

  // 헬스체크
  HEALTH: apiPath('/api/health'),
  META: apiPath('/api/meta'),
  RUNTIME_BRIEF: apiPath('/api/runtime-brief'),
  HANDOVER_SCHEMA: apiPath('/api/schema/handover'),
};

// Fetch 헬퍼 함수 (타임아웃 및 재시도 지원)
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout: number = 30000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('요청 시간이 초과되었습니다. 네트워크 연결을 확인해주세요.');
    }
    throw error;
  }
}

// 재시도가 포함된 fetch
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetchWithTimeout(url, options);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`재시도 ${i + 1}/${maxRetries} 실패:`, lastError.message);

      // 마지막 시도가 아니면 대기 후 재시도
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  throw lastError || new Error('요청에 실패했습니다.');
}

// 백엔드 헬스체크
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(API_ENDPOINTS.HEALTH, {}, 5000);
    return response.ok;
  } catch (error) {
    console.error('백엔드 헬스체크 실패:', error);
    return false;
  }
}
