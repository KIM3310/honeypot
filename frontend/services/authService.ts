import { setToken, setCsrfToken, setUserInfo } from "../utils/auth";
import { API_ENDPOINTS, fetchWithRetry } from "../config/api";

// ✅ Backend 응답 형식에 맞춤
interface LoginResponse {
  access_token: string;
  token_type: string;
  user_email: string;
  user_name: string;
  user_role: string;
  expires_in: number;
  refresh_token: string; // ← 추가!
  refresh_expires_in: number; // ← 추가!
  csrf_token: string; // ← 추가!
  csrf_expires_in: number; // ← 추가!
}

export const loginUser = async (
  email: string,
  password: string
): Promise<LoginResponse> => {
  const response = await fetchWithRetry(API_ENDPOINTS.LOGIN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "로그인 실패");
  }

  const data: LoginResponse = await response.json();

  // ✅ 토큰 저장 (Refresh Token 추가)
  setToken(data.access_token);
  setCsrfToken(data.csrf_token); // ← 추가!

  // ✅ 사용자 정보 저장
  setUserInfo({
    email: data.user_email,
    name: data.user_name,
    role: data.user_role,
    department: "",
  });

  return data;
};
