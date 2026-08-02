'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import { courses as coursesApi } from '@/lib/api/endpoints';
import { InstituteScope, useInstituteId } from '@/components/console/InstituteScope';
import { PageHeader } from '@/components/ui/PageHeader';
import {Card} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import {WEEKDAYS_FA, formatTime} from '@/lib/format';
import { COURSE_TYPE_FA } from '@/lib/constants';
import { validateTime } from '@/lib/validation';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';

export default function TimetablePage() {
  const instituteId = useInstituteId();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ courseId: '', classroomId: '', dayOfWeek: '0', startTime: '17:30', endTime: '19:00' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: entries, isLoading, isError, refetch } = useQuery({
    queryKey: ['timetable', instituteId],
    queryFn: () => coursesApi.timetable(instituteId!),
    enabled: Boolean(instituteId),
  });

  const { data: courses } = useQuery({
    queryKey: ['courses', 'list', instituteId],
    queryFn: () => coursesApi.list(instituteId!),
    enabled: Boolean(instituteId),
  });

  const { data: classrooms } = useQuery({
    queryKey: ['classrooms', instituteId],
    queryFn: () => coursesApi.classrooms(instituteId!),
    enabled: Boolean(instituteId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      coursesApi.addTimetableEntry({
        courseId: form.courseId,
        classroomId: form.classroomId || undefined,
        dayOfWeek: Number(form.dayOfWeek),
        startTime: form.startTime,
        endTime: form.endTime,
      }),
    onSuccess: () => {
      toastSuccess('زمان‌بندی اضافه شد');
      queryClient.invalidateQueries({ queryKey: ['timetable', instituteId] });
      setCreating(false);
    },
    onError: (error) => {
      toastError('خطا در افزودن زمان‌بندی', errorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => coursesApi.removeTimetableEntry(entryId),
    onSuccess: () => {
      toastSuccess('زمان‌بندی حذف شد');
      queryClient.invalidateQueries({ queryKey: ['timetable', instituteId] });
    },
    onError: (error) => toastError('خطا در حذف', errorMessage(error)),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!form.courseId) nextErrors.courseId = 'دوره را انتخاب کنید';
    const startError = validateTime(form.startTime);
    const endError = validateTime(form.endTime);
    if (startError) nextErrors.startTime = startError;
    if (endError) nextErrors.endTime = endError;
    if (!nextErrors.startTime && !nextErrors.endTime && form.startTime >= form.endTime) {
      nextErrors.endTime = 'زمان پایان باید بعد از شروع باشد';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    createMutation.mutate();
  };

  return (
    <InstituteScope>
      <PageHeader
        title="زمان‌بندی هفتگی"
        description="برنامه هفتگی کلاس‌های آموزشگاه — تشخیص تداخل کلاس‌ها در سمت سرور انجام می‌شود"
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" />
            افزودن زمان‌بندی
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonRows rows={6} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !entries || entries.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarDays className="h-7 w-7" />}
            title="زمان‌بندی‌ای ثبت نشده"
            description="جلسات هفتگی دوره‌ها را به برنامه اضافه کنید."
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {WEEKDAYS_FA.map((dayName, index) => {
            const dayEntries = entries.filter((entry) => entry.day_of_week === index);
            return (
              <div key={index} className="flex flex-col rounded-card border border-slate-200 bg-white shadow-card">
                <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-2.5 text-center">
                  <p className="text-xs font-bold text-slate-700">{dayName}</p>
                  <p className="text-[10px] text-slate-400">{dayEntries.length > 0 ? `${dayEntries.length} جلسه` : '—'}</p>
                </div>
                <div className="flex flex-col gap-2 p-2.5">
                  {dayEntries.length === 0 && (
                    <p className="py-4 text-center text-[11px] text-slate-300">برنامه‌ای نیست</p>
                  )}
                  {dayEntries.map((entry) => (
                    <div key={entry.id} className="group rounded-lg border border-slate-100 bg-slate-50 p-2">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-[11px] font-bold text-primary-700" dir="ltr">
                          {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
                        </p>
                        <button
                          onClick={() => deleteMutation.mutate(entry.id)}
                          className="text-slate-300 opacity-0 transition-opacity hover:text-danger-600 group-hover:opacity-100"
                          aria-label="حذف"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="mt-1 truncate text-[11px] font-semibold text-slate-700">{entry.course_title}</p>
                      <div className="mt-1 flex items-center gap-1">
                        <Badge tone="slate" className="px-1.5 py-0 text-[10px]">
                          {COURSE_TYPE_FA[entry.course_type as keyof typeof COURSE_TYPE_FA] ?? entry.course_type}
                        </Badge>
                        {entry.classroom_name && (
                          <span className="truncate text-[10px] text-slate-400">{entry.classroom_name}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="افزودن زمان‌بندی">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Select label="دوره" required value={form.courseId} error={errors.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
            <option value="">انتخاب دوره…</option>
            {courses?.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </Select>
          <Select label="کلاس" value={form.classroomId} onChange={(e) => setForm({ ...form, classroomId: e.target.value })}>
            <option value="">بدون کلاس</option>
            {classrooms?.map((classroom) => (
              <option key={classroom.id} value={classroom.id}>
                {classroom.name}
              </option>
            ))}
          </Select>
          <Select label="روز هفته" value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}>
            {WEEKDAYS_FA.map((name, index) => (
              <option key={index} value={index}>
                {name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="شروع (HH:MM)" latin value={form.startTime} error={errors.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
            <Input label="پایان (HH:MM)" latin value={form.endTime} error={errors.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
          </div>
          <Button type="submit" loading={createMutation.isPending}>
            افزودن
          </Button>
        </form>
      </Modal>
    </InstituteScope>
  );
}
