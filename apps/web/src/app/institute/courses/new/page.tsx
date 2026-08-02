'use client';

import { useRouter } from 'next/navigation';

import { courses as coursesApi } from '@/lib/api/endpoints';
import { InstituteScope, useInstituteId } from '@/components/console/InstituteScope';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';

import { CourseForm, emptyCourseForm, type CourseFormValues } from '@/components/courses/CourseForm';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';

export default function NewCoursePage() {
  const router = useRouter();
  const instituteId = useInstituteId();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (values: CourseFormValues) =>
      coursesApi.create(instituteId!, {
        title: values.title.trim(),
        description: values.description.trim() || undefined,
        categoryId: values.categoryId || undefined,
        type: values.type,
        level: values.level,
        price: Number(values.price),
        discountPercent: values.discountPercent ? Number(values.discountPercent) : 0,
        durationHours: values.durationHours ? Number(values.durationHours) : 0,
        capacity: values.capacity ? Number(values.capacity) : 20,
        startDate: values.startDate ? new Date(values.startDate).toISOString() : undefined,
        endDate: values.endDate ? new Date(values.endDate).toISOString() : undefined,
        sessions: values.sessions,
        instructorIds: values.instructorIds.length > 0 ? values.instructorIds : undefined,
        isPublished: values.isPublished,
      }),
    onSuccess: () => {
      toastSuccess('دوره ایجاد شد');
      queryClient.invalidateQueries({ queryKey: ['courses', 'list', instituteId] });
      router.push('/institute/courses');
    },
    onError: (error) => toastError('خطا در ایجاد دوره', errorMessage(error)),
  });

  return (
    <InstituteScope>
      <PageHeader title="ایجاد دوره جدید" description="اطلاعات دوره و جلسات هفتگی را وارد کنید" />
      {!instituteId ? (
        <Card>آموزشگاهی انتخاب نشده است.</Card>
      ) : (
        <CourseForm
          instituteId={instituteId}
          initial={emptyCourseForm()}
          submitting={createMutation.isPending}
          onSubmit={(values) => createMutation.mutate(values)}
        />
      )}
    </InstituteScope>
  );
}
