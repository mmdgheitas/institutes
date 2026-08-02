'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2, Check, Plus } from 'lucide-react';
import { institutes as institutesApi } from '@/lib/api/endpoints';
import { useActiveInstitute } from '@/stores/activeInstitute';
import { useSession } from '@/stores/session';
import { Dropdown } from '@/components/ui/Dropdown';
import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Institute selector for INSTITUTE_ADMIN users (a user may belong to several
 * institutes). The selection persists and drives every institute-scoped page.
 */
export function InstituteSwitcher() {
  const { user } = useSession();
  const { instituteId, setInstituteId } = useActiveInstitute();

  const { data: institutes, isLoading } = useQuery({
    queryKey: ['institutes', 'mine'],
    queryFn: () => institutesApi.mine(),
    enabled: user?.role === 'INSTITUTE_ADMIN',
  });

  const current = institutes?.find((i) => i.id === instituteId) ?? institutes?.[0];

  if (isLoading) {
    return <Skeleton className="h-8 w-48" />;
  }

  if (!institutes || institutes.length === 0) {
    return (
      <Link
        href="/institute/new"
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-primary-400 bg-primary-50 px-3 py-1.5 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-100"
      >
        <Plus className="h-4 w-4" />
        ثبت آموزشگاه جدید
      </Link>
    );
  }

  return (
    <Dropdown
      width="w-72"
      trigger={
        <button className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:border-primary-300 hover:text-primary-700">
          <Building2 className="h-4 w-4 text-slate-400" />
          <span className="max-w-44 truncate">{current?.name ?? 'انتخاب آموزشگاه'}</span>
          <span className="text-xs text-slate-400">▾</span>
        </button>
      }
      items={institutes.map((institute) => ({
        id: institute.id,
        label: (
          <span className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <Building2 className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">{institute.name}</span>
            </span>
            {institute.id === (current?.id ?? '') && <Check className="h-4 w-4 shrink-0 text-primary-600" />}
          </span>
        ),
        onSelect: () => setInstituteId(institute.id),
      }))}
    />
  );
}
