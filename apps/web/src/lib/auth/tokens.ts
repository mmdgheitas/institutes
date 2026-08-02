import type { SessionUser } from '@shared/dto';

/**
 * Token storage: the access token lives in memory only (never persisted),
 * the refresh token and a cached user snapshot live in localStorage so a page
 * reload can restore the session without a round-trip.
 */

const REFRESH_KEY = 'institutes.refresh';
const USER_KEY = 'institutes.user';

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(REFRESH_KEY, refresh);
    } catch {
      /* storage full or blocked — session survives in memory */
    }
  }
}

export function getCachedUser(): SessionUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user: SessionUser | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    else window.localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

export function clearTokens(): void {
  accessToken = null;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(REFRESH_KEY);
      window.localStorage.removeItem(USER_KEY);
    } catch {
      /* ignore */
    }
  }
}

/** Invoked when the session can no longer be restored (refresh failed). */
export function onAuthFailure(): void {
  clearTokens();
  if (typeof window !== 'undefined') {
    const current = window.location.pathname;
    if (!current.startsWith('/login')) {
      window.location.assign('/login?expired=1');
    }
  }
}
