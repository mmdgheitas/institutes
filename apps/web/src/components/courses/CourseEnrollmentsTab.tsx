'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { enrollments } from '@/lib/api/endpoints';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge, hexToTone } from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Select } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/Misc';
import { Avatar } from '@/components/ui/Avatar';
import { ENROLLMENT_STATUS_FA, ENROLLMENT_COLORS } from '@/lib/constants';
import { formatJalaliShort } from '@/lib/format';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';
import type { EnrollmentStatus } from '@shared/enums';

export function CourseEnrollmentsTab({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');

  const { data: rows, isLoading, isError, refetch } = useQuery({
    queryKey: ['enrollments', courseId],
    queryFn: () => enrollments.forCourse(courseId),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => enrollments.updateStatus(id, status),
    onSuccess: () => {
      toastSuccess('وضعیت ثبت‌نام تغییر کرد');
      queryClient.invalidateQueries({ queryKey: ['enrollments', courseId] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
    onError: (error) => toastError('خطا در تغییر وضعیت', errorMessage(error)),
  });

  const progressMutation = useMutation({
    mutationFn: ({ id, progressPercent }: { id: string; progressPercent: number }) =>
      enrollments.updateProgress(id, progressPercent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrollments', courseId] });
    },
    onError: (error) => toastError('خطا در ثبت پیشرفت', errorMessage(error)),
  });

  const saveProgress = (id: string, value: string) => {
    const percent = Number(value);
    if (Number.isNaN(percent) || percent < 0 || percent > 100) {
      toastError('مقدار پیشرفت باید بین ۰ تا ۱۰۰ باشد');
      queryClient.invalidateQueries({ queryKey: ['enrollments', courseId] });
      return;
    }
    progressMutation.mutate({ id, progressPercent: percent });
  };

  const filtered = rows?.filter((row) => !statusFilter || row.status === statusFilter);

  return (
    <div>
      <div className="mb-4 max-w-52">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">همه وضعیت‌ها</option>
          {(Object.keys(ENROLLMENT_STATUS_FA) as EnrollmentStatus[]).map((status) => (
            <option key={status} value={status}>
              {ENROLLMENT_STATUS_FA[status]}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <SkeletonRows rows={4} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !filtered || filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-7 w-7" />}
            title="دانش‌آموزی ثبت‌نام نکرده"
            description="وقتی دانش‌آموزی در این دوره ثبت‌نام کند، اینجا نمایش داده می‌شود."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {filtered.map((row) => (
            <Card key={row.id}>
              <CardBody className="flex flex-wrap items-center gap-3">
                <Avatar name={row.full_name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{row.full_name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    <span dir="ltr">{row.phone}</span> · ثبت‌نام: {formatJalaliShort(row.enrolled_at)}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <ProgressBar value={row.progress_percent} className="max-w-36" />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={row.progress_percent}
                      onBlur={(e) => saveProgress(row.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
                      }}
                      className="w-16 rounded-lg border border-slate-300 px-2 py-1 text-end text-xs focus:border-primary-600 focus:outline-none"
                      aria-label="درصد پیشرفت"
                      dir="ltr"
                    />
                    <span className="text-[11px] text-slate-500">٪ پیشرفت</span>
                  </div>
                </div>
                <Badge tone={hexToTone(ENROLLMENT_COLORS[row.status as EnrollmentStatus])} dot={ENROLLMENT_COLORS[row.status as EnrollmentStatus]}>
                  {ENROLLMENT_STATUS_FA[row.status as EnrollmentStatus]}
                </Badge>
                <div className="w-36">
                  <Select
                    value={row.status}
                    onChange={(e) => statusMutation.mutate({ id: row.id, status: e.target.value })}
                  >
                    {(Object.keys(ENROLLMENT_STATUS_FA) as EnrollmentStatus[]).map((status) => (
                      <option key={status} value={status}>
                        {ENROLLMENT_STATUS_FA[status]}
                      </option>
                    ))}
                  </Select>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
