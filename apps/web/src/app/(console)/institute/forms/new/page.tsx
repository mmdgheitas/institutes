'use client';

import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { forms as formsApi } from '@/lib/api/endpoints';
import { InstituteScope, useInstituteId } from '@/components/console/InstituteScope';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { FormBuilder } from '@/components/forms/FormBuilder';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';
import type { FormFieldSchema } from '@shared/dto';

export default function NewFormPage() {
  const router = useRouter();
  const instituteId = useInstituteId();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (payload: { title: string; description: string; fields: FormFieldSchema[]; requiresContract: boolean; contractText: string; requiresOtp: boolean; isActive: boolean }) =>
      formsApi.create(instituteId!, {
        title: payload.title.trim(),
        description: payload.description.trim() || undefined,
        fields: payload.fields.map((field, index) => ({ ...field, position: index })),
        requiresContract: payload.requiresContract,
        contractText: payload.requiresContract && payload.contractText.trim() ? payload.contractText.trim() : undefined,
        requiresOtp: payload.requiresOtp,
        isActive: payload.isActive,
      }),
    onSuccess: (_result) => {
      toastSuccess('فرم ساخته شد');
      queryClient.invalidateQueries({ queryKey: ['forms', 'list', instituteId] });
      router.push('/institute/forms');
    },
    onError: (error) => toastError('خطا در ساخت فرم', errorMessage(error)),
  });

  return (
    <InstituteScope>
      <PageHeader title="فرم جدید" description="فیلدهای فرم پیش‌ثبت‌نام را بسازید" />
      <Card>
        <FormBuilder
          submitting={createMutation.isPending}
          onSubmit={(payload) => createMutation.mutate(payload)}
        />
      </Card>
    </InstituteScope>
  );
}
