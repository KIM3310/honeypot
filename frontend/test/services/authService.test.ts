import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loginUser } from '../../services/authService';
import { getToken, getCsrfToken, getRefreshToken, getUserInfo } from '../../utils/auth';

describe('authService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockLoginResponse = {
    access_token: 'jwt-token-123',
    token_type: 'Bearer',
    user_email: 'test@example.com',
    user_name: 'Test User',
    user_role: 'operator',
    expires_in: 3600,
    refresh_token: 'refresh-abc',
    refresh_expires_in: 86400,
    csrf_token: 'csrf-xyz',
    csrf_expires_in: 3600,
  };

  it('should store tokens and user info on successful login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockLoginResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await loginUser('test@example.com', 'password');

    expect(result.access_token).toBe('jwt-token-123');
    expect(getToken()).toBe('jwt-token-123');
    expect(getCsrfToken()).toBe('csrf-xyz');
    expect(getRefreshToken()).toBe('refresh-abc');
    expect(getUserInfo()?.email).toBe('test@example.com');
  });

  it('should throw on failed login', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(loginUser('bad@test.com', 'wrong')).rejects.toThrow('Invalid credentials');
  });
});
