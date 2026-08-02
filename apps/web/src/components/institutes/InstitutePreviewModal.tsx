'use client';

import { useQuery } from '@tanstack/react-query';
import { Building2, MapPin, Phone, Globe, Star, Users } from 'lucide-react';
import { discovery } from '@/lib/api/endpoints';
import { Modal } from '@/components/ui/Modal';
import { Badge, hexToTone } from '@/components/ui/Badge';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { VERIFICATION_STATUS_FA, VERIFICATION_COLORS, COURSE_TYPE_FA } from '@/lib/constants';
import { formatNumber, formatIRRCompact, weekdayFa, toPersianDigits } from '@/lib/format';

/** Storefront preview for the super-admin directory. */
export function InstitutePreviewModal({ slug, onClose }: { slug: string | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['discovery', 'storefront', slug],
    queryFn: () => discovery.storefront(slug!),
    enabled: Boolean(slug),
  });

  return (
    <Modal open={Boolean(slug)} onClose={onClose} size="lg" title={data?.name ?? 'آموزشگاه'}>
      {isLoading || !data ? (
        <SkeletonRows rows={5} />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start gap-4">
            {data.logoUrl ? (
              <img src={data.logoUrl} alt={data.name} className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                <Building2 className="h-8 w-8" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-bold text-slate-900">{data.name}</h4>
                <Badge tone={hexToTone(VERIFICATION_COLORS[data.verificationStatus])} dot={VERIFICATION_COLORS[data.verificationStatus]}>
                  {VERIFICATION_STATUS_FA[data.verificationStatus]}
                </Badge>
              </div>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5" />
                {data.address} — {data.city}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {data.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    <span dir="ltr">{data.phone}</span>
                  </span>
                )}
                {data.website && (
                  <span className="flex items-center gap-1">
                    <Globe className="h-3.5 w-3.5" />
                    {data.website}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 text-amber-500" />
                  {formatNumber(data.rating)} ({formatNumber(data.reviewCount)} نظر)
                </span>
                {data.freePreRegistration && <span>پیش‌ثبت‌نام رایگان</span>}
              </div>
            </div>
          </div>

          {data.shortDescription && (
            <p className="text-sm leading-7 text-slate-600">{data.shortDescription}</p>
          )}

          <div>
            <p className="mb-2 text-sm font-bold text-slate-800">دوره‌ها ({formatNumber(data.courses.length)})</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.courses.slice(0, 8).map((course) => (
                <div key={course.id} className="rounded-card border border-slate-200 p-3">
                  <p className="truncate text-sm font-semibold text-slate-800">{course.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                    <Badge tone="blue">{COURSE_TYPE_FA[course.type]}</Badge>
                    <span>{formatIRRCompact(course.effectivePrice)}</span>
                    {course.discountPercent > 0 && (
                      <span className="text-success-600">{toPersianDigits(course.discountPercent)}٪ تخفیف</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {data.instructors.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-800">
                <Users className="h-4 w-4" />
                اساتید ({formatNumber(data.instructors.length)})
              </p>
              <div className="flex flex-wrap gap-2">
                {data.instructors.map((instructor) => (
                  <span key={instructor.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                    {instructor.fullName}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.workingHours && (
            <div>
              <p className="mb-2 text-sm font-bold text-slate-800">ساعات کاری</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.workingHours).map(([day, hours]) => (
                  <span key={day} className="rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
                    {weekdayFa(Number(day))}: <span dir="ltr">{hours}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
