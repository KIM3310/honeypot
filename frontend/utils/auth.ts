// 🔐 Authentication Utilities

/**
 * 토큰 저장
 */
export const setToken = (token: string): void => {
  localStorage.setItem("access_token", token);
  console.log("✅ 토큰 저장됨");
};

/**
 * 토큰 가져오기
 */
export const getToken = (): string | null => {
  return localStorage.getItem("access_token");
};

/**
 * 사용자 정보 저장
 */
export const setUserInfo = (user: any): void => {
  localStorage.setItem("user_info", JSON.stringify(user));
  localStorage.setItem("user_email", user.email);
  localStorage.setItem("user_name", user.name);
  localStorage.setItem("user_role", user.role);
  console.log("✅ 사용자 정보 저장됨");
};

/**
 * 사용자 정보 가져오기
 */
export const getUserInfo = (): any | null => {
  const userInfo = localStorage.getItem("user_info");
  return userInfo ? JSON.parse(userInfo) : null;
};

/**
 * 인증 헤더 가져오기 (API 호출 시 사용)
 */
export const getAuthHeaders = (): HeadersInit => {
  const token = getToken();
  const csrfToken = getCsrfToken(); // ← 추가!

  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(csrfToken && { "X-CSRF-Token": csrfToken }), // ← 추가!
  };
};

/**
 * 로그인 상태 확인
 */
export const isAuthenticated = (): boolean => {
  return !!getToken();
};

/**
 * 토큰 제거 (로그아웃)
 */
export const removeToken = (): void => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user_info");
  localStorage.removeItem("user_email");
  localStorage.removeItem("user_name");
  localStorage.removeItem("user_role");
  console.log("✅ 토큰 제거됨 (로그아웃)");
};
// frontend/utils/auth.ts - 토큰 만료 처리 추가

/**
 * 토큰이 곧 만료되는지 확인 (5분 이내)
 */
export const isTokenExpiringSoon = (): boolean => {
  const token = getToken();
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const expiresAt = payload.exp * 1000; // 밀리초로 변환
    const now = Date.now();
    const timeRemaining = expiresAt - now;

    // 5분 이내 남았으면 true
    return timeRemaining < 5 * 60 * 1000;
  } catch {
    return false;
  }
};

/**
 * 토큰 남은 시간 (초 단위)
 */
export const getTokenExpiresIn = (): number => {
  const token = getToken();
  if (!token) return 0;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const expiresAt = payload.exp * 1000;
    const now = Date.now();
    return Math.max(0, Math.floor((expiresAt - now) / 1000));
  } catch {
    return 0;
  }
};

/**
 * 토큰이 만료되었는지 확인
 */
export const isTokenExpired = (): boolean => {
  return getTokenExpiresIn() <= 0;
};

// ✅ CSRF Token 저장
export const setCsrfToken = (token: string): void => {
  localStorage.setItem("csrf_token", token);
};

// ✅ CSRF Token 가져오기
export const getCsrfToken = (): string | null => {
  return localStorage.getItem("csrf_token");
};

// ✅ CSRF Token 삭제
export const removeCsrfToken = (): void => {
  localStorage.removeItem("csrf_token");
};

// ✅ Refresh Token 삭제
export const removeRefreshToken = (): void => {
  localStorage.removeItem("refresh_token");
};

// ✅ 모든 토큰 삭제 (수정)
export const removeAllTokens = (): void => {
  removeToken();
  removeRefreshToken();
  removeCsrfToken(); // ← 추가!
};
