'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { ClipboardCheck, Trash2 } from 'lucide-react';
import { quizzes as quizzesApi } from '@/lib/api/endpoints';
import { InstituteScope } from '@/components/console/InstituteScope';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { ConfirmDialog } from '@/components/ui/Modal';
import { QuizForm, type QuizFormValues } from '@/components/quizzes/QuizForm';
import { toPersianDigits } from '@/lib/format';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';
import { useState } from 'react';

function toApi(values: QuizFormValues) {
  return {
    title: values.title.trim(),
    description: values.description.trim() || undefined,
    timeLimitSeconds: Number(values.timeLimitSeconds),
    maxScore: Number(values.maxScore),
    passingScore: Number(values.passingScore),
    shuffleQuestions: values.shuffleQuestions,
    shuffleOptions: values.shuffleOptions,
    antiCheatEnabled: values.antiCheatEnabled,
    maxFocusLosses: Number(values.maxFocusLosses),
    attemptsAllowed: Number(values.attemptsAllowed),
    opensAt: values.opensAt ? new Date(values.opensAt).toISOString() : undefined,
    closesAt: values.closesAt ? new Date(values.closesAt).toISOString() : undefined,
    isPublished: values.isPublished,
    questions: values.questions.map((question, position) => ({
      type: question.type,
      prompt: question.prompt,
      points: Number(question.points),
      options: question.options.length > 0 ? question.options : undefined,
      correctOptionIds: question.correctOptionIds.length > 0 ? question.correctOptionIds : undefined,
      correctText:
        question.type === 'SHORT_ANSWER' || question.type === 'TRUE_FALSE'
          ? question.correctText || undefined
          : undefined,
      explanation: question.explanation || undefined,
      allowedMimeTypes: question.allowedMimeTypes
        ? question.allowedMimeTypes.split(',').map((m) => m.trim()).filter(Boolean)
        : undefined,
      position,
    })),
  };
}

function toForm(authoring: Awaited<ReturnType<typeof quizzesApi.authoring>>): QuizFormValues {
  return {
    title: authoring.title,
    description: authoring.description ?? '',
    timeLimitSeconds: String(authoring.timeLimitSeconds),
    maxScore: String(authoring.maxScore),
    passingScore: String(authoring.passingScore),
    shuffleQuestions: authoring.shuffleQuestions,
    shuffleOptions: authoring.shuffleOptions,
    antiCheatEnabled: authoring.antiCheatEnabled,
    maxFocusLosses: String(authoring.maxFocusLosses),
    attemptsAllowed: String(authoring.attemptsAllowed),
    opensAt: authoring.opensAt ? authoring.opensAt.slice(0, 16) : '',
    closesAt: authoring.closesAt ? authoring.closesAt.slice(0, 16) : '',
    isPublished: authoring.isPublished,
    questions: authoring.questions.map((question) => ({
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      points: String(question.points),
      options: question.options.map((option) => ({ id: option.id, text: option.text })),
      correctOptionIds: question.correctOptionIds ?? [],
      correctText: question.correctText ?? '',
      explanation: question.explanation ?? '',
      allowedMimeTypes: (question.allowedMimeTypes ?? []).join(', '),
    })),
  };
}

export default function QuizAuthoringPage() {
  const params = useParams<{ quizId: string }>();
  const quizId = params.quizId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: quiz, isLoading, isError, refetch } = useQuery({
    queryKey: ['quizzes', 'authoring', quizId],
    queryFn: () => quizzesApi.authoring(quizId),
    enabled: Boolean(quizId),
  });

  const updateMutation = useMutation({
    mutationFn: (values: QuizFormValues) => quizzesApi.update(quizId, toApi(values)),
    onSuccess: () => {
      toastSuccess('آزمون ذخیره شد');
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
    },
    onError: (error) => toastError('خطا در ذخیره آزمون', errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => quizzesApi.remove(quizId),
    onSuccess: () => {
      toastSuccess('آزمون حذف شد');
      queryClient.invalidateQueries({ queryKey: ['quizzes'] });
      router.push('/institute/courses');
    },
    onError: (error) => toastError('خطا در حذف آزمون', errorMessage(error)),
  });

  return (
    <InstituteScope>
      {isLoading ? (
        <SkeletonRows rows={6} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !quiz ? (
        <Card>آزمون یافت نشد.</Card>
      ) : (
        <div className="flex flex-col gap-5">
          <PageHeader
            title={quiz.title}
            description={`${toPersianDigits(quiz.questionCount)} سؤال · ${toPersianDigits(quiz.maxScore)} نمره`}
            actions={
              <div className="flex items-center gap-2">
                <Link href={`/institute/quizzes/${quizId}/attempts`}>
                  <Button variant="outline" size="sm">
                    <ClipboardCheck className="h-4 w-4" />
                    پاسخ‌های دانش‌آموزان
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} className="text-danger-600">
                  <Trash2 className="h-4 w-4" />
                  حذف آزمون
                </Button>
              </div>
            }
          />
          <Card>
            <QuizForm
              key={quiz.id}
              initial={toForm(quiz)}
              submitting={updateMutation.isPending}
              onSubmit={(values) => updateMutation.mutate(values)}
            />
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="حذف آزمون"
        message="آزمون و همه تلاش‌های مرتبط حذف شوند؟"
        confirmLabel="حذف"
        loading={deleteMutation.isPending}
      />
    </InstituteScope>
  );
}
