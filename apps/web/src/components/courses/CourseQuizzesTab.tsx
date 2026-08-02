'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { FileQuestion, Plus, ClipboardCheck } from 'lucide-react';
import { quizzes as quizzesApi } from '@/lib/api/endpoints';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { formatNumber } from '@/lib/format';

export function CourseQuizzesTab({ courseId }: { courseId: string }) {
  const { data: quizzes, isLoading, isError, refetch } = useQuery({
    queryKey: ['quizzes', 'list', courseId],
    queryFn: () => quizzesApi.list(courseId),
  });

  const now = Date.now();
  const isOpen = (quiz: { opensAt: string | null; closesAt: string | null }) => {
    if (quiz.opensAt && new Date(quiz.opensAt).getTime() > now) return 'scheduled';
    if (quiz.closesAt && new Date(quiz.closesAt).getTime() < now) return 'closed';
    return 'open';
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Link href={`/institute/courses/${courseId}/quizzes/new`}>
          <Button size="sm">
            <Plus className="h-4 w-4" />
            آزمون جدید
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !quizzes || quizzes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileQuestion className="h-7 w-7" />}
            title="آزمونی برای این دوره نیست"
            description="آزمون آنلاین با تصحیح خودکار و حالت آفلاین بسازید."
            action={
              <Link href={`/institute/courses/${courseId}/quizzes/new`}>
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  ساخت آزمون
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {quizzes.map((quiz) => {
            const state = isOpen(quiz);
            return (
              <Link key={quiz.id} href={`/institute/quizzes/${quiz.id}`}>
                <Card className="cursor-pointer transition-shadow hover:shadow-pop">
                  <CardBody className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">{quiz.title}</p>
                        <Badge
                          tone={!quiz.isPublished ? 'slate' : state === 'open' ? 'green' : state === 'scheduled' ? 'amber' : 'red'}
                        >
                          {!quiz.isPublished ? 'پیش‌نویس' : state === 'open' ? 'فعال' : state === 'scheduled' ? 'برنامه‌ریزی شده' : 'بسته شده'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatNumber(quiz.questionCount)} سؤال · {formatNumber(quiz.maxScore)} نمره · حداقل قبولی{' '}
                        {formatNumber(quiz.passingScore)} · {formatNumber(quiz.timeLimitSeconds / 60)} دقیقه
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {quiz.antiCheatEnabled && <Badge tone="cyan">ضد تقلب</Badge>}
                      <Link href={`/institute/quizzes/${quiz.id}/attempts`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-50">
                        <ClipboardCheck className="h-4 w-4" />
                        پاسخ‌ها
                      </Link>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
