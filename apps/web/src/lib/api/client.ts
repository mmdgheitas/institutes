import { ApiError, NetworkError } from './errors';
import type { ApiErrorBody, AuthResponse } from '@shared/dto';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  onAuthFailure,
  setAccessToken,
  setCachedUser,
  setTokens,
} from '../auth/tokens';

/**
 * Typed fetch client for the NestJS API.
 *
 * - Attaches `Authorization: Bearer` automatically.
 * - On 401, performs a single-flight refresh (concurrent 401s share one
 *   refresh call), replays the original request, and redirects to /login
 *   when the refresh token is itself invalid.
 * - Throws typed `ApiError` / `NetworkError` for every failure path.
 */

/**
 * API origin. Defaults to the local dev API; override with
 * NEXT_PUBLIC_API_BASE_URL when the API lives elsewhere. The dev-only
 * rewrites in next.config.ts (/api/* → localhost:4000) still work for setups
 * that prefer a same-origin client.
 */
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000').replace(/\/$/, '');

function resolveUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${API_ORIGIN}/api/v1${clean}`;
}

async function parseError(response: Response): Promise<ApiErrorBody | null> {
  try {
    return (await response.json()) as ApiErrorBody;
  } catch {
    return null;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(resolveUrl(path), init);
  } catch (error) {
    throw new NetworkError(error);
  }
  return response;
}

async function doFetch(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  return rawFetch(path, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;
    try {
      const response = await rawFetch('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as AuthResponse;
      setTokens(data.accessToken, data.refreshToken);
      setCachedUser(data.user);
      return data.accessToken;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const first = await doFetch(path, options, getAccessToken());

  if (first.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retried = await doFetch(path, options, refreshed);
      if (retried.ok) return (await retried.json()) as T;
      if (retried.status === 401) {
        onAuthFailure();
        throw new ApiError(401, await parseError(retried));
      }
      throw new ApiError(retried.status, await parseError(retried));
    }
    onAuthFailure();
    throw new ApiError(401, await parseError(first));
  }

  if (!first.ok) {
    throw new ApiError(first.status, await parseError(first));
  }

  if (first.status === 204) return undefined as T;
  return (await first.json()) as T;
}

export { clearTokens, setTokens, setCachedUser, setAccessToken };

/** Convenience for mutations that return void/204. */
export const apiPost = <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
  apiFetch<T>(path, { ...options, method: 'POST', body });
export const apiPatch = <T = unknown>(path: string, body?: unknown, options?: RequestOptions) =>
  apiFetch<T>(path, { ...options, method: 'PATCH', body });
export const apiDelete = <T = unknown>(path: string, options?: RequestOptions) =>
  apiFetch<T>(path, { ...options, method: 'DELETE' });
export const apiGet = <T = unknown>(path: string, options?: RequestOptions) =>
  apiFetch<T>(path, { ...options, method: 'GET' });
