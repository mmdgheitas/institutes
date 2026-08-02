'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, Search, MapPin } from 'lucide-react';
import { discovery } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';

import { Badge, hexToTone } from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { VERIFICATION_STATUS_FA, VERIFICATION_COLORS } from '@/lib/constants';
import { formatNumber, formatIRRCompact, toPersianDigits } from '@/lib/format';
import { InstitutePreviewModal } from '@/components/institutes/InstitutePreviewModal';

export default function InstitutesDirectoryPage() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [previewSlug, setPreviewSlug] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['discovery', 'institutes', debounced, page],
    queryFn: () => discovery.institutes({ query: debounced || undefined, page, pageSize: 12, sort: 'popularity' }),
  });

  return (
    <div>
      <PageHeader
        title="مؤسسات"
        description="فهرست همه آموزشگاه‌های منتشرشده روی پلتفرم"
      />

      <div className="mb-4 max-w-md">
        <div className="relative">
          <Search className="absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
              window.setTimeout(() => setDebounced(e.target.value), 350);
            }}
            placeholder="جستجوی نام آموزشگاه…"
            className="w-full rounded-control border border-slate-300 bg-white py-2.5 ps-10 pe-3.5 text-sm focus:border-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-600/30"
          />
        </div>
      </div>

      {isLoading ? (
        <SkeletonRows rows={6} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data || data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 className="h-7 w-7" />}
            title="آموزشگاهی پیدا نشد"
            description="عبارت جستجو را تغییر دهید."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((institute) => (
              <Card key={institute.id} className="cursor-pointer transition-shadow hover:shadow-pop" onClick={() => setPreviewSlug(institute.slug)}>
                <div className="flex items-start gap-3.5 p-5">
                  {institute.coverImageUrl ? (
                    <img
                      src={institute.coverImageUrl}
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
                      <Badge
                        tone={hexToTone(VERIFICATION_COLORS[institute.verificationStatus])}
                        dot={VERIFICATION_COLORS[institute.verificationStatus]}
                      >
                        {VERIFICATION_STATUS_FA[institute.verificationStatus]}
                      </Badge>
                      <Badge tone="amber">★ {formatNumber(institute.rating)}</Badge>
                      {institute.minPrice != null && (
                        <Badge tone="slate">{formatIRRCompact(institute.minPrice)}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
                  <span>{toPersianDigits(institute.courseCount)} دوره</span>
                  <span>{toPersianDigits(institute.reviewCount)} نظر</span>
                  <span className="text-primary-600">مشاهده جزئیات</span>
                </div>
              </Card>
            ))}
          </div>

          <Pagination page={page} pageSize={12} total={data.total} onPageChange={setPage} />
        </>
      )}

      <InstitutePreviewModal slug={previewSlug} onClose={() => setPreviewSlug(null)} />
    </div>
  );
}
