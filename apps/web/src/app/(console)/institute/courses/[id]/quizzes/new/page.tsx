'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { quizzes as quizzesApi } from '@/lib/api/endpoints';
import { InstituteScope } from '@/components/console/InstituteScope';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { QuizForm, emptyQuizForm, type QuizFormValues } from '@/components/quizzes/QuizForm';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';

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

export default function NewQuizPage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (values: QuizFormValues) => quizzesApi.create(courseId, toApi(values)),
    onSuccess: (result) => {
      toastSuccess('آزمون ساخته شد');
      queryClient.invalidateQueries({ queryKey: ['quizzes', 'list', courseId] });
      router.push(`/institute/quizzes/${result.id}`);
    },
    onError: (error) => toastError('خطا در ساخت آزمون', errorMessage(error)),
  });

  return (
    <InstituteScope>
      <PageHeader title="آزمون جدید" description="تنظیمات آزمون و سؤال‌ها" />
      <Card>
        <QuizForm
          initial={emptyQuizForm()}
          submitting={createMutation.isPending}
          submitLabel="ساخت آزمون"
          onSubmit={(values) => createMutation.mutate(values)}
        />
      </Card>
    </InstituteScope>
  );
}
