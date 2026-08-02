'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/stores/session';
import { auth } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/errors';
import { PageLoading } from '@/components/ui/States';

/**
 * Gate for the console area: restores the session from storage, verifies it
 * against /auth/me (which triggers the refresh flow when the access token has
 * expired), and redirects to /login when there is no session.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, hydrated, setUser, hydrate } = useSession();
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    const hasRefresh = hydrate();
    if (!hasRefresh) {
      router.replace('/login');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const me = await auth.me();
        if (!cancelled) setUser(me);
      } catch (error) {
        if (!cancelled && error instanceof ApiError && !error.isUnauthorized) {
          // 5xx etc. — still let the cached user through rather than a hard loop.
          setUser(null);
        }
      } finally {
        if (!cancelled) setVerifying(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrate, router, setUser]);

  if (!hydrated || verifying) {
    return <PageLoading label="در حال بررسی نشست…" />;
  }

  if (!user) {
    return <PageLoading label="در حال انتقال به صفحه ورود…" />;
  }

  return <>{children}</>;
}
