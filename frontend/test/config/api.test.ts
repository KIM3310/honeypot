import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchWithTimeout, fetchWithRetry, checkBackendHealth } from '../../config/api';

describe('fetchWithTimeout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should resolve on successful fetch', async () => {
    const mockResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    const response = await fetchWithTimeout('/api/test', {}, 5000);
    expect(response.status).toBe(200);
  });

  it('should throw on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network error'));

    await expect(fetchWithTimeout('/api/test', {}, 5000)).rejects.toThrow('Network error');
  });

  it('should throw timeout error on abort', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        const signal = (options as RequestInit)?.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    });

    await expect(fetchWithTimeout('/api/test', {}, 10)).rejects.toThrow();
  });
});

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return on first successful attempt', async () => {
    const mockResponse = new Response('ok', { status: 200 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(mockResponse);

    const response = await fetchWithRetry('/api/test', {}, 3);
    expect(response.status).toBe(200);
  });

  it('should retry on failure and succeed', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('fail1'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const response = await fetchWithRetry('/api/test', {}, 3);
    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('should throw after all retries exhausted', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('persistent failure'));

    await expect(fetchWithRetry('/api/test', {}, 2)).rejects.toThrow('persistent failure');
  });
});

describe('checkBackendHealth', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should return true on 200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok', { status: 200 }));
    const result = await checkBackendHealth();
    expect(result).toBe(true);
  });

  it('should return false on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const result = await checkBackendHealth();
    expect(result).toBe(false);
  });
});
