'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Plus, Ban } from 'lucide-react';
import { courses as coursesApi, forms as formsApi } from '@/lib/api/endpoints';
import { InstituteScope, useInstituteId } from '@/components/console/InstituteScope';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { BOOKING_STATUS_FA } from '@/lib/constants';
import { formatJalaliDateTime, toPersianDigits } from '@/lib/format';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';
import type { SlotRow } from '@/types/api';

export default function SlotsPage() {
  const instituteId = useInstituteId();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<SlotRow | null>(null);
  const [form, setForm] = useState({
    courseId: '',
    durationMinutes: '30',
    capacity: '1',
    location: '',
    startTimes: [] as string[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: slots, isLoading, isError, refetch } = useQuery({
    queryKey: ['slots', instituteId],
    queryFn: () => formsApi.slots(instituteId!),
    enabled: Boolean(instituteId),
  });

  const { data: courses } = useQuery({
    queryKey: ['courses', 'list', instituteId],
    queryFn: () => coursesApi.list(instituteId!),
    enabled: Boolean(instituteId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      formsApi.createSlots(instituteId!, {
        courseId: form.courseId || undefined,
        startTimes: form.startTimes,
        durationMinutes: Number(form.durationMinutes),
        capacity: Number(form.capacity),
        location: form.location.trim() || undefined,
      }),
    onSuccess: (created) => {
      toastSuccess(`${toPersianDigits(created.length)} بازه زمانی ایجاد شد`);
      queryClient.invalidateQueries({ queryKey: ['slots', instituteId] });
      setCreating(false);
      setForm({ courseId: '', durationMinutes: '30', capacity: '1', location: '', startTimes: [] });
    },
    onError: (error) => toastError('خطا در ایجاد بازه', errorMessage(error)),
  });

  const cancelMutation = useMutation({
    mutationFn: (slotId: string) => formsApi.cancelSlot(slotId),
    onSuccess: () => {
      toastSuccess('بازه زمانی لغو شد');
      queryClient.invalidateQueries({ queryKey: ['slots', instituteId] });
      setCancelling(null);
    },
    onError: (error) => toastError('خطا در لغو', errorMessage(error)),
  });

  const addStartTime = (value: string) => {
    if (!value) return;
    if (!form.startTimes.includes(value)) {
      setForm({ ...form, startTimes: [...form.startTimes, value] });
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (form.startTimes.length === 0) nextErrors.startTimes = 'حداقل یک زمان شروع اضافه کنید';
    if (Number(form.durationMinutes) < 5 || Number(form.durationMinutes) > 480) {
      nextErrors.durationMinutes = 'مدت باید بین ۵ تا ۴۸۰ دقیقه باشد';
    }
    if (Number(form.capacity) < 1) nextErrors.capacity = 'ظرفیت حداقل ۱ است';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    createMutation.mutate();
  };

  const upcoming = slots?.filter((slot) => new Date(slot.startsAt).getTime() > Date.now() - 60_000 && slot.status !== 'CANCELLED') ?? [];
  const past = slots?.filter((slot) => new Date(slot.startsAt).getTime() <= Date.now() - 60_000 || slot.status === 'CANCELLED') ?? [];

  return (
    <InstituteScope>
      <PageHeader
        title="بازه‌های زمانی"
        description="زمان‌های ارزیابی و مصاحبه که دانش‌آموزان هنگام پیش‌ثبت‌نام رزرو می‌کنند"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            ایجاد بازه‌ها
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonRows rows={5} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !slots || slots.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Clock className="h-7 w-7" />}
            title="بازه زمانی‌ای نیست"
            description="بازه‌های ارزیابی/مصاحبه را برای لینک‌کردن به فرم‌ها بسازید."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <section>
            <p className="mb-3 text-sm font-bold text-slate-800">پیش‌رو ({toPersianDigits(upcoming.length)})</p>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-400">بازه فعالی وجود ندارد.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {upcoming.map((slot) => (
                  <Card key={slot.id}>
                    <CardBody className="flex flex-wrap items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-600">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-800">{formatJalaliDateTime(slot.startsAt)}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {slot.location ?? 'بدون مکان'} · ظرفیت {toPersianDigits(slot.bookedCount)}/{toPersianDigits(slot.capacity)}
                        </p>
                      </div>
                      <Badge tone={slot.bookedCount >= slot.capacity ? 'red' : 'green'}>
                        {slot.bookedCount >= slot.capacity ? 'تکمیل' : `${toPersianDigits(slot.capacity - slot.bookedCount)} جای خالی`}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => setCancelling(slot)}>
                        <Ban className="h-4 w-4 text-danger-600" />
                        لغو
                      </Button>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section>
              <p className="mb-3 text-sm font-bold text-slate-800">گذشته / لغو شده ({toPersianDigits(past.length)})</p>
              <div className="flex flex-col gap-2">
                {past.slice(0, 10).map((slot) => (
                  <div key={slot.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm text-slate-500">
                    <Clock className="h-4 w-4 text-slate-300" />
                    <span className="flex-1">{formatJalaliDateTime(slot.startsAt)}</span>
                    <Badge tone={slot.status === 'CANCELLED' ? 'red' : 'slate'}>{BOOKING_STATUS_FA[slot.status]}</Badge>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="ایجاد بازه‌های زمانی" size="lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Select label="دوره (اختیاری)" value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
            <option value="">همه دوره‌ها</option>
            {courses?.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="مدت هر بازه (دقیقه)" latin type="number" min={5} max={480} value={form.durationMinutes} error={errors.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            <Input label="ظرفیت هر بازه" latin type="number" min={1} value={form.capacity} error={errors.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          </div>
          <Input label="مکان (اختیاری)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="مثلاً: دفتر آموزشگاه — طبقه دوم" />
          <div>
            <Input label="افزودن زمان شروع (تاریخ و ساعت)" latin type="datetime-local" onChange={(e) => { addStartTime(e.target.value); e.target.value = ''; }} />
            {errors.startTimes && <p className="mt-1 text-xs text-danger-600">{errors.startTimes}</p>}
          </div>
          {form.startTimes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.startTimes.map((time) => (
                <span key={time} className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs text-primary-700">
                  <span dir="ltr">{time.replace('T', ' ')}</span>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, startTimes: form.startTimes.filter((t) => t !== time) })}
                    className="text-primary-400 hover:text-danger-600"
                    aria-label="حذف"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <Button type="submit" loading={createMutation.isPending}>
            ایجاد {form.startTimes.length > 0 ? `${toPersianDigits(form.startTimes.length)} بازه` : 'بازه‌ها'}
          </Button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        onConfirm={() => cancelling && cancelMutation.mutate(cancelling.id)}
        title="لغو بازه زمانی"
        message={`بازه ${cancelling ? formatJalaliDateTime(cancelling.startsAt) : ''} لغو شود؟ رزروهای مرتبط نیز لغو می‌شوند.`}
        confirmLabel="لغو بازه"
        loading={cancelMutation.isPending}
      />
    </InstituteScope>
  );
}
