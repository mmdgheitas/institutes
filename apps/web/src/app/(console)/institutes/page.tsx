'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Search, MapPin, Globe, Eye } from 'lucide-react';
import { institutes as institutesApi } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { VERIFICATION_STATUS_FA, VERIFICATION_COLORS } from '@/lib/constants';
import { formatNumber, formatIRRCompact, toPersianDigits } from '@/lib/format';
import { InstitutePreviewModal } from '@/components/institutes/InstitutePreviewModal';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';

type Filter = 'all' | 'published' | 'draft' | 'pending' | 'verified';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'همه' },
  { id: 'published', label: 'منتشر شده' },
  { id: 'draft', label: 'پیش‌نویس' },
  { id: 'pending', label: 'در انتظار تأیید' },
  { id: 'verified', label: 'تأیید شده' },
];

export default function InstitutesDirectoryPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['institutes', 'admin-all'],
    queryFn: () => institutesApi.adminAll(),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => institutesApi.update(id, { isPublished: true }),
    onSuccess: (_data, _id) => {
      toastSuccess('آموزشگاه منتشر شد', 'اکنون برای دانش‌آموزان در نقشه و جستجو نمایش داده می‌شود.');
      queryClient.invalidateQueries({ queryKey: ['institutes', 'admin-all'] });
      queryClient.invalidateQueries({ queryKey: ['discovery'] });
    },
    onError: (error) => toastError('انتشار انجام نشد', errorMessage(error)),
  });

  const unpublishMutation = useMutation({
    mutationFn: (id: string) => institutesApi.update(id, { isPublished: false }),
    onSuccess: () => {
      toastSuccess('آموزشگاه از انتشار خارج شد');
      queryClient.invalidateQueries({ queryKey: ['institutes', 'admin-all'] });
      queryClient.invalidateQueries({ queryKey: ['discovery'] });
    },
    onError: (error) => toastError('خطا در تغییر وضعیت', errorMessage(error)),
  });

  const filtered = useMemo(() => {
    let rows = data ?? [];
    const term = query.trim().toLowerCase();
    if (term) {
      rows = rows.filter(
        (row) => row.name.toLowerCase().includes(term) || row.city.toLowerCase().includes(term),
      );
    }
    switch (filter) {
      case 'published':
        rows = rows.filter((row) => row.is_published);
        break;
      case 'draft':
        rows = rows.filter((row) => !row.is_published);
        break;
      case 'pending':
        rows = rows.filter((row) => row.verification_status === 'PENDING');
        break;
      case 'verified':
        rows = rows.filter((row) => row.verification_status === 'VERIFIED');
        break;
    }
    return rows;
  }, [data, query, filter]);

  return (
    <div>
      <PageHeader
        title="مؤسسات"
        description={`همه آموزشگاه‌ها — منتشر شده و پیش‌نویس (${toPersianDigits(data?.length ?? 0)})`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1 sm:max-w-xs">
          <Search className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجوی نام یا شهر…"
            className="w-full rounded-control border border-slate-300 bg-white py-2.5 ps-10 pe-3.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/30"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === f.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <SkeletonRows rows={6} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !filtered || filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 className="h-7 w-7" />}
            title="آموزشگاهی پیدا نشد"
            description="عبارت یا فیلتر را تغییر دهید."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((institute) => (
            <Card key={institute.id} className="flex flex-col">
              <div className="flex items-start gap-3.5 p-5">
                {institute.cover_image_url ? (
                  <img
                    src={institute.cover_image_url}
                    alt={institute.name}
                    className="h-14 w-14 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                    <Building2 className="h-7 w-7" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900">{institute.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3.5 w-3.5" />
                    {institute.city}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone={institute.is_published ? 'green' : 'slate'}>
                      {institute.is_published ? 'منتشر شده' : 'پیش‌نویس'}
                    </Badge>
                    <Badge
                      tone={VERIFICATION_COLORS[institute.verification_status] === '#16A34A' ? 'green' : VERIFICATION_COLORS[institute.verification_status] === '#F59E0B' ? 'amber' : VERIFICATION_COLORS[institute.verification_status] === '#DC2626' ? 'red' : 'slate'}
                      dot={VERIFICATION_COLORS[institute.verification_status]}
                    >
                      {VERIFICATION_STATUS_FA[institute.verification_status]}
                    </Badge>
                    {institute.rating > 0 && <Badge tone="amber">★ {formatNumber(institute.rating)}</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                <span>{toPersianDigits(institute.course_count)} دوره</span>
                {institute.min_price != null && <span>{formatIRRCompact(institute.min_price)}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
                {institute.is_published ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setPreviewSlug(institute.slug)}>
                      <Eye className="h-4 w-4" />
                      مشاهده ویترین
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-500"
                      loading={unpublishMutation.isPending}
                      onClick={() => unpublishMutation.mutate(institute.id)}
                    >
                      توقف انتشار
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="success"
                      size="sm"
                      loading={publishMutation.isPending}
                      onClick={() => publishMutation.mutate(institute.id)}
                    >
                      <Globe className="h-4 w-4" />
                      انتشار
                    </Button>
                    <span className="text-[11px] text-slate-400">پیش‌نویس — فقط مدیر آموزشگاه می‌بیند</span>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <InstitutePreviewModal slug={previewSlug} onClose={() => setPreviewSlug(null)} />
    </div>
  );
}
