'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Eye, AlertTriangle } from 'lucide-react';
import { quizzes as quizzesApi } from '@/lib/api/endpoints';
import { InstituteScope } from '@/components/console/InstituteScope';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge, hexToTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { ATTEMPT_STATUS_FA, ATTEMPT_COLORS } from '@/lib/constants';
import { formatJalaliDateTime, formatNumber, toPersianDigits } from '@/lib/format';
import { connectSocket, onSocketEvent, type ProctorFocusLossEvent } from '@/lib/realtime/socket';
import { toastWarning } from '@/stores/toasts';

export default function QuizAttemptsPage() {
  const params = useParams<{ quizId: string }>();
  const quizId = params.quizId;
  const queryClient = useQueryClient();

  const { data: attempts, isLoading, isError, refetch } = useQuery({
    queryKey: ['quizzes', 'attempts', quizId],
    queryFn: () => quizzesApi.attempts(quizId),
    enabled: Boolean(quizId),
  });

  // Live proctor feed: focus-loss events push a toast and refresh the list.
  useEffect(() => {
    const socket = connectSocket();
    const off = onSocketEvent('proctor:focus-loss', (event: ProctorFocusLossEvent) => {
      toastWarning(
        `خروج از آزمون: ${event.studentName}`,
        `${toPersianDigits(event.count)} بار (حداکثر ${toPersianDigits(event.limit)})`,
      );
      queryClient.invalidateQueries({ queryKey: ['quizzes', 'attempts', quizId] });
    });
    return () => {
      off();
      void socket;
    };
  }, [quizId, queryClient]);

  return (
    <InstituteScope>
      <PageHeader
        title="پاسخ‌های دانش‌آموزان"
        description="تلاش‌های آزمون — وضعیت، خروج از آزمون و تصحیح دستی"
      />

      {isLoading ? (
        <SkeletonRows rows={5} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !attempts || attempts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardCheck className="h-7 w-7" />}
            title="تلاشی ثبت نشده"
            description="وقتی دانش‌آموزی آزمون را شروع کند، اینجا نمایش داده می‌شود."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {attempts.map((attempt) => {
            const status = attempt.status as keyof typeof ATTEMPT_STATUS_FA;
            return (
              <Card key={attempt.id}>
                <CardBody className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">{attempt.full_name}</p>
                      <span className="text-xs text-slate-400" dir="ltr">{attempt.phone}</span>
                      <Badge tone={hexToTone(ATTEMPT_COLORS[status])} dot={ATTEMPT_COLORS[status]}>
                        {ATTEMPT_STATUS_FA[status]}
                      </Badge>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>ارسال: {formatJalaliDateTime(attempt.submitted_at)}</span>
                      {attempt.score != null && (
                        <span className="font-bold text-slate-700">
                          نمره: {formatNumber(attempt.score)} از {formatNumber(attempt.max_score)}
                        </span>
                      )}
                      {attempt.pending_manual > 0 && (
                        <span className="inline-flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {toPersianDigits(attempt.pending_manual)} سؤال در انتظار تصحیح دستی
                        </span>
                      )}
                    </p>
                    {attempt.focus_loss_count > 0 && (
                      <p className="mt-1 text-xs text-danger-600">
                        خروج از آزمون: {toPersianDigits(attempt.focus_loss_count)} بار
                      </p>
                    )}
                  </div>
                  <Link href={`/institute/quizzes/${quizId}/attempts/${attempt.id}`}>
                    <Button size="sm" variant="outline">
                      <Eye className="h-4 w-4" />
                      مشاهده و تصحیح
                    </Button>
                  </Link>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </InstituteScope>
  );
}
