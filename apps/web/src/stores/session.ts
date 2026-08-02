import { create } from 'zustand';
import type { SessionUser } from '@shared/dto';
import {
  getCachedUser,
  getRefreshToken,
  setCachedUser,
  setTokens as persistTokens,
} from '@/lib/auth/tokens';

interface SessionState {
  user: SessionUser | null;
  hydrated: boolean;
  /** true while the initial /auth/me round-trip is in flight */
  restoring: boolean;
  setUser: (user: SessionUser | null) => void;
  /** Persist a full auth response (tokens + user). */
  applyAuth: (accessToken: string, refreshToken: string, user: SessionUser) => void;
  /** Restore session from cached storage; returns whether a refresh token exists. */
  hydrate: () => boolean;
  clear: () => void;
}

export const useSession = create<SessionState>((set) => ({
  user: null,
  hydrated: false,
  restoring: false,

  setUser: (user) => {
    setCachedUser(user);
    set({ user });
  },

  applyAuth: (accessToken, refreshToken, user) => {
    persistTokens(accessToken, refreshToken);
    setCachedUser(user);
    set({ user, hydrated: true, restoring: false });
  },

  hydrate: () => {
    const user = getCachedUser();
    const hasRefresh = Boolean(getRefreshToken());
    set({ user, hydrated: true });
    return hasRefresh;
  },

  clear: () => {
    set({ user: null, hydrated: true, restoring: false });
  },
}));

/** True while a refresh token exists (i.e. the console route guard may pass). */
export function hasRefreshToken(): boolean {
  return Boolean(getRefreshToken());
}
