'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/stores/session';
import { PageLoading } from '@/components/ui/States';

/** Root path: role-based entry point into the console. */
export default function HomePage() {
  const router = useRouter();
  const { user, hydrated, hydrate } = useSession();

  useEffect(() => {
    hydrate();
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role === 'STUDENT') {
      router.replace('/student');
      return;
    }
    router.replace('/dashboard');
  }, [user, router, hydrate]);

  if (!hydrated) return <PageLoading />;
  return <PageLoading label="در حال انتقال…" />;
}
