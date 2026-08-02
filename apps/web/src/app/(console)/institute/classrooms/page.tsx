'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DoorOpen, Plus } from 'lucide-react';
import { courses as coursesApi } from '@/lib/api/endpoints';
import { InstituteScope, useInstituteId } from '@/components/console/InstituteScope';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { formatNumber } from '@/lib/format';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';

export default function ClassroomsPage() {
  const instituteId = useInstituteId();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', capacity: '20' });
  const [error, setError] = useState('');

  const { data: classrooms, isLoading, isError, refetch } = useQuery({
    queryKey: ['classrooms', instituteId],
    queryFn: () => coursesApi.classrooms(instituteId!),
    enabled: Boolean(instituteId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      coursesApi.createClassroom(instituteId!, {
        name: form.name.trim(),
        capacity: Number(form.capacity),
      }),
    onSuccess: () => {
      toastSuccess('کلاس اضافه شد');
      queryClient.invalidateQueries({ queryKey: ['classrooms', instituteId] });
      setCreating(false);
      setForm({ name: '', capacity: '20' });
    },
    onError: (error) => toastError('خطا در ایجاد کلاس', errorMessage(error)),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (form.name.trim().length < 2) {
      setError('نام کلاس حداقل ۲ کاراکتر است');
      return;
    }
    setError('');
    createMutation.mutate();
  };

  return (
    <InstituteScope>
      <PageHeader
        title="کلاس‌ها"
        description="فضاهای آموزشی آموزشگاه برای زمان‌بندی"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            کلاس جدید
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonCards count={4} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !classrooms || classrooms.length === 0 ? (
        <Card>
          <EmptyState
            icon={<DoorOpen className="h-7 w-7" />}
            title="کلاسی ثبت نشده"
            description="کلاس‌های فیزیکی آموزشگاه را اضافه کنید تا در زمان‌بندی استفاده شوند."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classrooms.map((classroom) => (
            <Card key={classroom.id}>
              <CardBody className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                  <DoorOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-800">{classroom.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">ظرفیت {formatNumber(classroom.capacity)} نفر</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="کلاس جدید" size="sm">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Input label="نام کلاس" required autoFocus value={form.name} error={error} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثلاً: کلاس A" />
          <Input label="ظرفیت" latin type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          <Button type="submit" loading={createMutation.isPending}>
            ایجاد
          </Button>
        </form>
      </Modal>
    </InstituteScope>
  );
}
