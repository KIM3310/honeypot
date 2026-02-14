// Authentication utilities (demo / prototype).

export const setToken = (token: string): void => {
  localStorage.setItem("access_token", token);
};

export const setRefreshToken = (token: string): void => {
  localStorage.setItem("refresh_token", token);
};

export const getToken = (): string | null => {
  return localStorage.getItem("access_token");
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem("refresh_token");
};

export type UserInfo = {
  email: string;
  name: string;
  role: string;
  department?: string;
};

export const setUserInfo = (user: UserInfo): void => {
  localStorage.setItem("user_info", JSON.stringify(user));
  localStorage.setItem("user_email", user.email);
  localStorage.setItem("user_name", user.name);
  localStorage.setItem("user_role", user.role);
};

export const getUserInfo = (): UserInfo | null => {
  const userInfo = localStorage.getItem("user_info");
  return userInfo ? JSON.parse(userInfo) : null;
};

export const getAuthHeaders = (): HeadersInit => {
  const token = getToken();
  const csrfToken = getCsrfToken();

  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(csrfToken && { "X-CSRF-Token": csrfToken }),
  };
};

export const isAuthenticated = (): boolean => {
  return !!getToken();
};

export const removeToken = (): void => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user_info");
  localStorage.removeItem("user_email");
  localStorage.removeItem("user_name");
  localStorage.removeItem("user_role");
};

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

export const isTokenExpired = (): boolean => {
  return getTokenExpiresIn() <= 0;
};

export const setCsrfToken = (token: string): void => {
  localStorage.setItem("csrf_token", token);
};

export const getCsrfToken = (): string | null => {
  return localStorage.getItem("csrf_token");
};

export const removeCsrfToken = (): void => {
  localStorage.removeItem("csrf_token");
};

export const removeRefreshToken = (): void => {
  localStorage.removeItem("refresh_token");
};

export const removeAllTokens = (): void => {
  removeToken();
  removeRefreshToken();
  removeCsrfToken();
};
