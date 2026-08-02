import { beforeEach, describe, expect, it } from 'vitest';
import { useSession } from '@/stores/session';
import * as tokens from '@/lib/auth/tokens';

/**
 * Regression: hydrate() must never re-set state after the first call.
 * Each re-set produced a fresh user object reference, which re-ran effects
 * depending on `user` and caused "Maximum update depth exceeded".
 */
describe('session store hydrate', () => {
  beforeEach(() => {
    tokens.clearTokens();
    useSession.setState({ user: null, hydrated: false, restoring: false });
  });

  it('sets the cached user exactly once', () => {
    tokens.setTokens('access-1', 'refresh-1');
    tokens.setCachedUser({
      id: 'u1',
      fullName: 'Test User',
      phone: '09120000000',
      email: null,
      role: 'SUPER_ADMIN',
      avatarUrl: null,
      instituteId: null,
    });

    expect(useSession.getState().hydrated).toBe(false);

    const hasRefresh = useSession.getState().hydrate();
    expect(hasRefresh).toBe(true);
    expect(useSession.getState().hydrated).toBe(true);
    expect(useSession.getState().user?.fullName).toBe('Test User');

    const userAfterFirst = useSession.getState().user;
    const stateAfterFirst = useSession.getState();

    // Second call must not produce a new state object / user reference.
    const hasRefreshAgain = useSession.getState().hydrate();
    expect(hasRefreshAgain).toBe(true);
    expect(useSession.getState().user).toBe(userAfterFirst);
    expect(useSession.getState()).toBe(stateAfterFirst);
  });

  it('reports no refresh token when storage is empty', () => {
    expect(useSession.getState().hydrate()).toBe(false);
    expect(useSession.getState().hydrated).toBe(true);
    expect(useSession.getState().user).toBeNull();
  });

  it('clear() resets the user but keeps hydrated=true', () => {
    tokens.setTokens('access-1', 'refresh-1');
    useSession.getState().hydrate();
    useSession.getState().clear();

    expect(useSession.getState().user).toBeNull();
    expect(useSession.getState().hydrated).toBe(true);
  });
});
