// API 설정 파일
// Electron 환경 감지
const isElectron = !!(window as any).electronAPI;

// 개발/프로덕션 환경 감지
const isDev = import.meta.env.DEV;

// API 베이스 URL 결정
function getApiBaseUrl(): string {
  // 1. 환경 변수에서 URL 가져오기 (최우선)
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // 2. Electron 환경에서는 항상 localhost:8000
  if (isElectron) {
    return 'http://localhost:8000';
  }

  // 3. 개발 환경
  if (isDev) {
    return 'http://localhost:8000';
  }

  // 4. 프로덕션 환경 (배포된 경우)
  return window.location.origin;
}

export const API_BASE_URL = getApiBaseUrl();

// API 엔드포인트
export const API_ENDPOINTS = {
  // 인증
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  REFRESH: `${API_BASE_URL}/api/auth/refresh`,

  // 업로드
  UPLOAD: `${API_BASE_URL}/api/upload`,
  DOCUMENTS: `${API_BASE_URL}/api/upload/documents`,
  INDEXES: `${API_BASE_URL}/api/upload/indexes`,

  // 채팅
  CHAT: `${API_BASE_URL}/api/chat`,
  ANALYZE: `${API_BASE_URL}/api/analyze`,

  // 헬스체크
  HEALTH: `${API_BASE_URL}/api/health`,
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

console.log('🔧 API 설정:', {
  isElectron,
  isDev,
  baseUrl: API_BASE_URL,
});
