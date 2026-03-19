import { describe, it, expect } from 'vitest';
import {
  setToken,
  getToken,
  setRefreshToken,
  getRefreshToken,
  setCsrfToken,
  getCsrfToken,
  removeAllTokens,
  setUserInfo,
  getUserInfo,
  getAuthHeaders,
  isAuthenticated,
  getTokenExpiresIn,
} from '../../utils/auth';

describe('auth utilities', () => {
  it('should set and get access token', () => {
    setToken('test-token-123');
    expect(getToken()).toBe('test-token-123');
  });

  it('should set and get refresh token', () => {
    setRefreshToken('refresh-abc');
    expect(getRefreshToken()).toBe('refresh-abc');
  });

  it('should set and get CSRF token', () => {
    setCsrfToken('csrf-xyz');
    expect(getCsrfToken()).toBe('csrf-xyz');
  });

  it('should remove all tokens at once', () => {
    setToken('t1');
    setRefreshToken('t2');
    setCsrfToken('t3');
    removeAllTokens();
    expect(getToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getCsrfToken()).toBeNull();
  });

  it('should store and retrieve user info', () => {
    const user = { email: 'a@b.com', name: 'Test', role: 'admin', department: 'eng' };
    setUserInfo(user);
    const retrieved = getUserInfo();
    expect(retrieved).toEqual(user);
  });

  it('should build auth headers with token and csrf', () => {
    setToken('tok');
    setCsrfToken('csrf');
    const headers = getAuthHeaders();
    expect(headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer tok',
      'X-CSRF-Token': 'csrf',
    });
  });

  it('should report authenticated when token exists', () => {
    expect(isAuthenticated()).toBe(false);
    setToken('any');
    expect(isAuthenticated()).toBe(true);
  });

  it('should return 0 for getTokenExpiresIn with no token', () => {
    expect(getTokenExpiresIn()).toBe(0);
  });

  it('should return 0 for getTokenExpiresIn with invalid token', () => {
    setToken('not-a-jwt');
    expect(getTokenExpiresIn()).toBe(0);
  });
});
