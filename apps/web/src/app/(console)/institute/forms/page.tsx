'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Plus, Pencil, Power } from 'lucide-react';
import { forms as formsApi } from '@/lib/api/endpoints';
import { InstituteScope, useInstituteId } from '@/components/console/InstituteScope';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SkeletonCards } from '@/components/ui/Skeleton';
import {formatNumber} from '@/lib/format';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';

export default function FormsPage() {
  const instituteId = useInstituteId();
  const queryClient = useQueryClient();

  const { data: forms, isLoading, isError, refetch } = useQuery({
    queryKey: ['forms', 'list', instituteId],
    queryFn: () => formsApi.list(instituteId!),
    enabled: Boolean(instituteId),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ formId, isActive }: { formId: string; isActive: boolean }) =>
      formsApi.update(formId, { isActive }),
    onSuccess: (_data, variables) => {
      toastSuccess(variables.isActive ? 'فرم فعال شد' : 'فرم غیرفعال شد');
      queryClient.invalidateQueries({ queryKey: ['forms', 'list', instituteId] });
    },
    onError: (error) => toastError('خطا در تغییر وضعیت', errorMessage(error)),
  });

  return (
    <InstituteScope>
      <PageHeader
        title="فرم‌های پیش‌ثبت‌نام"
        description="فرم‌هایی که دانش‌آموزان برای پیش‌ثبت‌نام پر می‌کنند — لیدها وارد CRM می‌شوند"
        actions={
          <Link href="/institute/forms/new">
            <Button>
              <Plus className="h-4 w-4" />
              فرم جدید
            </Button>
          </Link>
        }
      />

      {isLoading ? (
        <SkeletonCards count={4} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !forms || forms.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="h-7 w-7" />}
            title="فرمی ساخته نشده"
            description="با فرم‌ساز، فرم پیش‌ثبت‌نام با فیلدهای دلخواه بسازید."
            action={
              <Link href="/institute/forms/new">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  ساخت فرم
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {forms.map((form) => (
            <Card key={form.id}>
              <CardBody className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900">{form.title}</p>
                  <Badge tone={form.isActive ? 'green' : 'slate'}>{form.isActive ? 'فعال' : 'غیرفعال'}</Badge>
                </div>
                {form.description && <p className="line-clamp-2 text-xs leading-5 text-slate-500">{form.description}</p>}
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone="blue">{formatNumber(form.fields.length)} فیلد</Badge>
                  {form.requiresContract && <Badge tone="amber">قرارداد</Badge>}
                  {form.requiresOtp && <Badge tone="violet">تأیید SMS</Badge>}
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-400">{form.fields.length > 0 ? 'شامل ' : ''}{formatNumber(form.fields.length)} فیلد</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggleMutation.mutate({ formId: form.id, isActive: !form.isActive })}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      title={form.isActive ? 'غیرفعال کردن' : 'فعال کردن'}
                    >
                      <Power className="h-4 w-4" />
                    </button>
                    <Link href={`/institute/forms/${form.id}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-primary-600" title="ویرایش">
                      <Pencil className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </InstituteScope>
  );
}
