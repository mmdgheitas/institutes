'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, AlertTriangle, Save, ArrowRight } from 'lucide-react';
import { quizzes as quizzesApi } from '@/lib/api/endpoints';
import { InstituteScope } from '@/components/console/InstituteScope';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge, hexToTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { ErrorState, EmptyState } from '@/components/ui/States';
import { ATTEMPT_STATUS_FA, ATTEMPT_COLORS } from '@/lib/constants';
import { formatJalaliDateTime, formatNumber, toPersianDigits } from '@/lib/format';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';

interface GradeInput {
  questionId: string;
  awardedPoints: string;
  feedback: string;
}

export default function GradeAttemptPage() {
  const params = useParams<{ quizId: string; attemptId: string }>();
  const { quizId, attemptId } = params;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [grades, setGrades] = useState<Record<string, GradeInput>>({});

  const { data: result, isLoading, isError, refetch } = useQuery({
    queryKey: ['quizzes', 'result', attemptId],
    queryFn: () => quizzesApi.result(attemptId),
    enabled: Boolean(attemptId),
  });

  const gradeMutation = useMutation({
    mutationFn: (answers: { questionId: string; awardedPoints: number; feedback?: string }[]) =>
      quizzesApi.grade(attemptId, { answers }),
    onSuccess: () => {
      toastSuccess('تصحیح ثبت شد و آزمون بسته شد');
      queryClient.invalidateQueries({ queryKey: ['quizzes', 'attempts', quizId] });
      router.push(`/institute/quizzes/${quizId}/attempts`);
    },
    onError: (error) => toastError('خطا در ثبت تصحیح', errorMessage(error)),
  });

  const pendingItems = result?.breakdown.filter((item) => item.needsManualGrading) ?? [];

  const gradeAll = () => {
    const answers = pendingItems
      .map((item) => {
        const grade = grades[item.questionId];
        return {
          questionId: item.questionId,
          awardedPoints: grade ? Number(grade.awardedPoints) : 0,
          feedback: grade?.feedback.trim() || undefined,
        };
      })
      .filter((answer) => answer.awardedPoints >= 0);
    if (answers.length === 0) return;
    gradeMutation.mutate(answers);
  };

  return (
    <InstituteScope>
      {isLoading ? (
        <SkeletonRows rows={6} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !result ? (
        <EmptyState title="نتیجه‌ای یافت نشد" />
      ) : (
        <div className="flex flex-col gap-5">
          <PageHeader
            title="تصحیح دستی آزمون"
            description={
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone={hexToTone(ATTEMPT_COLORS[result.status])} dot={ATTEMPT_COLORS[result.status]}>
                  {ATTEMPT_STATUS_FA[result.status]}
                </Badge>
                <span>
                  نمره: {formatNumber(result.score)} از {formatNumber(result.maxScore)}
                </span>
                {result.passed && <Badge tone="green">قبول</Badge>}
                <span className="text-slate-400">ارسال: {formatJalaliDateTime(result.submittedAt)}</span>
              </span>
            }
            actions={
              <Button
                size="sm"
                disabled={pendingItems.length === 0}
                loading={gradeMutation.isPending}
                onClick={gradeAll}
              >
                <Save className="h-4 w-4" />
                ثبت تصحیح{` (${toPersianDigits(pendingItems.length)})`}
              </Button>
            }
          />

          {pendingItems.length === 0 && (
            <Card>
              <EmptyState
                icon={<CheckCircle2 className="h-7 w-7" />}
                title="سؤالی برای تصحیح دستی نیست"
                description="همه سؤال‌ها به‌صورت خودکار تصحیح شده‌اند."
              />
            </Card>
          )}

          <div className="flex flex-col gap-3">
            {result.breakdown.map((item, index) => {
              const grade = grades[item.questionId];
              return (
                <Card key={item.questionId}>
                  <CardHeader
                    title={
                      <span className="flex items-center gap-2">
                        {toPersianDigits(index + 1)}. {item.prompt}
                      </span>
                    }
                    description={
                      <span className="flex items-center gap-2">
                        نمره: {formatNumber(item.points)} · کسب‌شده: {item.awarded != null ? formatNumber(item.awarded) : '—'}
                        {item.isCorrect === true && <CheckCircle2 className="h-4 w-4 text-success-600" />}
                        {item.isCorrect === false && <XCircle className="h-4 w-4 text-danger-600" />}
                        {item.needsManualGrading && (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="h-4 w-4" />
                            نیاز به تصحیح دستی
                          </span>
                        )}
                      </span>
                    }
                  />
                  <CardBody className="flex flex-col gap-3">
                    {item.feedback && (
                      <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                        بازخورد: {item.feedback}
                      </p>
                    )}
                    {item.needsManualGrading && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input
                          label={`نمره (حداکثر ${formatNumber(item.points)})`}
                          latin
                          type="number"
                          min={0}
                          max={item.points}
                          step="0.1"
                          value={grade?.awardedPoints ?? ''}
                          onChange={(e) =>
                            setGrades((g) => ({
                              ...g,
                              [item.questionId]: { questionId: item.questionId, awardedPoints: e.target.value, feedback: grade?.feedback ?? '' },
                            }))
                          }
                          placeholder="0"
                        />
                        <Textarea
                          label="بازخورد"
                          value={grade?.feedback ?? ''}
                          onChange={(e) =>
                            setGrades((g) => ({
                              ...g,
                              [item.questionId]: { questionId: item.questionId, awardedPoints: grade?.awardedPoints ?? '', feedback: e.target.value },
                            }))
                          }
                          placeholder="توضیح برای دانش‌آموز…"
                        />
                      </div>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowRight className="h-4 w-4" />
              بازگشت
            </Button>
            <Button loading={gradeMutation.isPending} disabled={pendingItems.length === 0} onClick={gradeAll}>
              <Save className="h-4 w-4" />
              ثبت تصحیح
            </Button>
          </div>
        </div>
      )}
    </InstituteScope>
  );
}
