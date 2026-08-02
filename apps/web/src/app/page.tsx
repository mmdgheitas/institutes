'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/stores/session';
import { PageLoading } from '@/components/ui/States';

/** Root path: role-based entry point into the console. */
export default function HomePage() {
  const router = useRouter();
  const { user, hydrated, hydrate } = useSession();

  // Restore the cached session exactly once (hydrate is idempotent).
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Redirect only after hydration has settled, so we never bounce a logged-in
  // user to /login because the store was still empty on the first render.
  useEffect(() => {
    if (!hydrated) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role === 'STUDENT') {
      router.replace('/student');
      return;
    }
    router.replace('/dashboard');
  }, [user, hydrated, router]);

  return <PageLoading label="در حال انتقال…" />;
}
