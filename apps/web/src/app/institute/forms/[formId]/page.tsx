'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { forms as formsApi } from '@/lib/api/endpoints';
import { InstituteScope } from '@/components/console/InstituteScope';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { FormBuilder, type FormBuilderPayload } from '@/components/forms/FormBuilder';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';

export default function EditFormPage() {
  const params = useParams<{ formId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const formId = params.formId;

  const { data: form, isLoading, isError, refetch } = useQuery({
    queryKey: ['forms', 'get', formId],
    queryFn: () => formsApi.get(formId),
    enabled: Boolean(formId),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: FormBuilderPayload) =>
      formsApi.update(formId, {
        title: payload.title,
        description: payload.description || undefined,
        fields: payload.fields.map((field, index) => ({ ...field, position: index })),
        requiresContract: payload.requiresContract,
        contractText: payload.requiresContract ? payload.contractText : undefined,
        requiresOtp: payload.requiresOtp,
        isActive: payload.isActive,
      }),
    onSuccess: () => {
      toastSuccess('فرم به‌روزرسانی شد');
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      router.push('/institute/forms');
    },
    onError: (error) => toastError('خطا در ذخیره فرم', errorMessage(error)),
  });

  return (
    <InstituteScope>
      <PageHeader title="ویرایش فرم" description="فیلدها و تنظیمات فرم پیش‌ثبت‌نام" />
      {isLoading ? (
        <SkeletonRows rows={6} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !form ? (
        <Card>فرم یافت نشد.</Card>
      ) : (
        <Card>
          <FormBuilder
            key={form.id}
            initial={{
              title: form.title,
              description: form.description ?? '',
              fields: form.fields,
              requiresContract: form.requiresContract,
              contractText: form.contractText ?? '',
              requiresOtp: (form as unknown as { requiresOtp: boolean }).requiresOtp,
              isActive: form.isActive,
            }}
            submitting={updateMutation.isPending}
            onSubmit={(payload) => updateMutation.mutate(payload)}
          />
        </Card>
      )}
    </InstituteScope>
  );
}
