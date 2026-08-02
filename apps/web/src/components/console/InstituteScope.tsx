'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react';
import { institutes as institutesApi } from '@/lib/api/endpoints';
import { useActiveInstitute } from '@/stores/activeInstitute';
import { useSession } from '@/stores/session';
import { EmptyState } from '@/components/ui/States';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';

/**
 * Wraps institute-scoped content: resolves the active institute and renders a
 * friendly "pick an institute" state when none is selected.
 */
export function InstituteScope({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const { instituteId, setInstituteId } = useActiveInstitute();

  const { data: institutes, isLoading } = useQuery({
    queryKey: ['institutes', 'mine'],
    queryFn: () => institutesApi.mine(),
    enabled: user?.role === 'INSTITUTE_ADMIN',
  });

  // Auto-select the first institute once the list arrives (in an effect —
  // setting store state during render can trigger update loops).
  useEffect(() => {
    if (user?.role === 'INSTITUTE_ADMIN' && !instituteId && institutes && institutes.length > 0) {
      setInstituteId(institutes[0].id);
    }
  }, [user?.role, instituteId, institutes, setInstituteId]);

  // Teachers use the same pages but reach courses through /me/courses — no
  // institute selection required (their role has no institute-switcher UI).
  if (user?.role === 'TEACHER') {
    return <>{children}</>;
  }

  if (user?.role === 'INSTITUTE_ADMIN' && isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!instituteId) {
    return (
      <div className="rounded-card border border-slate-200 bg-white">
        {user?.role === 'INSTITUTE_ADMIN' ? (
          <EmptyState
            icon={<Building2 className="h-7 w-7" />}
            title="هنوز آموزشگاهی ثبت نکرده‌اید"
            description="با ثبت آموزشگاه خود، همه ابزارهای مدیریت (دوره‌ها، CRM، آزمون‌ها و مالی) فعال می‌شوند."
            action={
              <Link href="/institute/new">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  ثبت آموزشگاه جدید
                </Button>
              </Link>
            }
          />
        ) : (
          <EmptyState
            icon={<Building2 className="h-7 w-7" />}
            title="آموزشگاهی انتخاب نشده است"
            description="از منوی بالای صفحه، آموزشگاهی را برای مدیریت انتخاب کنید."
          />
        )}
      </div>
    );
  }

  return <>{children}</>;
}

/** Hook for pages: returns the active institute id or null. */
export function useInstituteId(): string | null {
  const { instituteId } = useActiveInstitute();
  return instituteId;
}
