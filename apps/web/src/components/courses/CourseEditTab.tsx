'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { courses as coursesApi } from '@/lib/api/endpoints';
import { CourseForm, courseToForm, type CourseFormValues } from './CourseForm';
import { toastSuccess, toastError, toastInfo, errorMessage } from '@/stores/toasts';
import type { CourseSummary } from '@shared/dto';
import type { CourseRow } from '@/types/api';

export function CourseEditTab({ course, instituteId }: { course: CourseRow; instituteId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (values: CourseFormValues) =>
      coursesApi.update(course.id, {
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
        instructorIds: values.instructorIds,
        isPublished: values.isPublished,
      }),
    onSuccess: () => {
      toastSuccess('تغییرات دوره ذخیره شد');
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['discovery', 'storefront'] });
    },
    onError: (error) => toastError('خطا در ذخیره', errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: () => coursesApi.remove(course.id),
    onSuccess: (result) => {
      if (result.deleted) toastSuccess('دوره حذف شد');
      else toastInfo('دوره دانش‌آموز فعال دارد و به‌جای حذف، از انتشار خارج شد');
      queryClient.invalidateQueries({ queryKey: ['courses', 'list'] });
      router.push('/institute/courses');
    },
    onError: (error) => toastError('خطا در حذف', errorMessage(error)),
  });

  return (
    <div className="relative">
      <CourseForm
        key={course.id}
        instituteId={instituteId}
        initial={courseToForm(course as CourseSummary)}
        submitting={updateMutation.isPending}
        onSubmit={(values) => updateMutation.mutate(values)}
      />
      <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
        <button
          onClick={() => {
            if (window.confirm('دوره حذف شود؟ اگر دانش‌آموز فعال داشته باشد فقط از انتشار خارج می‌شود.')) {
              deleteMutation.mutate();
            }
          }}
          className="text-sm font-semibold text-danger-600 hover:underline"
        >
          حذف دوره
        </button>
      </div>
    </div>
  );
}
