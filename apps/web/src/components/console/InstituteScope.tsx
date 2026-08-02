'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react';
import { institutes as institutesApi } from '@/lib/api/endpoints';
import { useActiveInstitute } from '@/stores/activeInstitute';
import { useSession } from '@/stores/session';
import { EmptyState } from '@/components/ui/States';
import { Skeleton } from '@/components/ui/Skeleton';

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

  // Teachers use the same pages but reach courses through /me/courses — no
  // institute selection required (their role has no institute-switcher UI).
  if (user?.role === 'TEACHER') {
    return <>{children}</>;
  }

  // Auto-select the first institute when the admin hasn't chosen one yet.
  if (user?.role === 'INSTITUTE_ADMIN' && !instituteId && institutes && institutes.length > 0) {
    setInstituteId(institutes[0].id);
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
        <EmptyState
          icon={<Building2 className="h-7 w-7" />}
          title="آموزشگاهی انتخاب نشده است"
          description="از منوی بالای صفحه، آموزشگاهی را برای مدیریت انتخاب کنید."
        />
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
