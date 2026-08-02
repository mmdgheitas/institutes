import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/api/client';
import * as tokens from '@/lib/auth/tokens';
import { ApiError, NetworkError } from '@/lib/api/errors';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiFetch', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    tokens.setAccessToken('access-1');
    tokens.setTokens('access-1', 'refresh-1');
    tokens.setCachedUser({ id: 'u1', fullName: 'T', phone: '09120000000', email: null, role: 'INSTITUTE_ADMIN', avatarUrl: null, instituteId: null });
    // Prevent the redirect side-effect during tests.
    vi.spyOn(tokens, 'onAuthFailure').mockImplementation(() => {
      tokens.clearTokens();
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    tokens.clearTokens();
  });

  it('sends the bearer token and parses JSON', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const result = await apiFetch<{ ok: boolean }>('/health');
    expect(result).toEqual({ ok: true });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/health');
    const headers = init.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer access-1');
  });

  it('refreshes once on 401 and replays the request', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(
        jsonResponse({
          accessToken: 'access-2',
          refreshToken: 'refresh-2',
          expiresIn: 900,
          user: { id: 'u1', fullName: 'T', phone: '09120000000', email: null, role: 'INSTITUTE_ADMIN', avatarUrl: null, instituteId: null },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const result = await apiFetch<{ ok: boolean }>('/auth/me');
    expect(result).toEqual({ ok: true });

    // Three calls: original, refresh, replay.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const refreshCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(refreshCall[0]).toContain('/auth/refresh');
    expect(JSON.parse(String(refreshCall[1].body))).toEqual({ refreshToken: 'refresh-1' });

    const replayCall = fetchMock.mock.calls[2] as [string, RequestInit];
    const headers = replayCall[1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer access-2');
  });

  it('single-flights concurrent 401s (one refresh call)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(
        jsonResponse({
          accessToken: 'access-2',
          refreshToken: 'refresh-2',
          expiresIn: 900,
          user: { id: 'u1', fullName: 'T', phone: '09120000000', email: null, role: 'INSTITUTE_ADMIN', avatarUrl: null, instituteId: null },
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    const [first, second] = await Promise.all([
      apiFetch<{ ok: boolean }>('/a'),
      apiFetch<{ ok: boolean }>('/b'),
    ]);
    expect(first).toEqual({ ok: true });
    expect(second).toEqual({ ok: true });

    const refreshCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });

  it('clears the session and throws ApiError when refresh fails', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: 'Invalid refresh token' }, 401));

    await expect(apiFetch('/protected')).rejects.toThrow(ApiError);
    expect(tokens.getAccessToken()).toBeNull();
    expect(tokens.getRefreshToken()).toBeNull();
  });

  it('throws typed ApiError with the server message for 4xx', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ statusCode: 400, message: 'bad request' }, 400));

    try {
      await apiFetch('/x');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(400);
      expect((error as ApiError).message).toBe('bad request');
    }
  });

  it('throws NetworkError on fetch rejection', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(apiFetch('/x')).rejects.toThrow(NetworkError);
  });

  it('serializes JSON bodies and sets Content-Type', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: '1' }));
    await apiFetch('/institutes', { method: 'POST', body: { name: 'X' } });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Headers).get('Content-Type')).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({ name: 'X' });
  });
});
