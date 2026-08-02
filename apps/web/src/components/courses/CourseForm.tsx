'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { discovery, institutes as institutesApi } from '@/lib/api/endpoints';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Misc';
import { Button } from '@/components/ui/Button';
import { COURSE_TYPE_FA, COURSE_LEVEL_FA } from '@/lib/constants';
import { validateTime } from '@/lib/validation';
import { weekdayFa } from '@/lib/format';
import type { CourseType, CourseLevel } from '@shared/enums';
import type { CourseSummary } from '@shared/dto';

export interface SessionDraft {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
}

export interface CourseFormValues {
  title: string;
  description: string;
  categoryId: string;
  type: CourseType;
  level: CourseLevel;
  price: string;
  discountPercent: string;
  durationHours: string;
  capacity: string;
  startDate: string;
  endDate: string;
  sessions: SessionDraft[];
  instructorIds: string[];
  isPublished: boolean;
}

export function emptyCourseForm(): CourseFormValues {
  return {
    title: '',
    description: '',
    categoryId: '',
    type: 'IN_PERSON',
    level: 'ALL_LEVELS',
    price: '',
    discountPercent: '0',
    durationHours: '0',
    capacity: '20',
    startDate: '',
    endDate: '',
    sessions: [],
    instructorIds: [],
    isPublished: false,
  };
}

export function courseToForm(course: CourseSummary & { description?: string | null }): CourseFormValues {
  return {
    title: course.title,
    description: course.description ?? '',
    categoryId: '',
    type: course.type,
    level: course.level,
    price: String(course.price),
    discountPercent: String(course.discountPercent),
    durationHours: String(course.durationHours),
    capacity: String(course.capacity),
    startDate: course.startDate ? course.startDate.slice(0, 10) : '',
    endDate: '',
    sessions: course.sessions.map((s) => ({ ...s, room: s.room ?? '' })),
    instructorIds: course.instructorIds ?? [],
    isPublished: course.isPublished ?? true,
  };
}

export function validateCourseForm(form: CourseFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.title.trim().length < 3) errors.title = 'عنوان دوره حداقل ۳ کاراکتر است';
  if (!form.price || Number(form.price) < 0) errors.price = 'قیمت معتبر وارد کنید';
  if (form.discountPercent && (Number(form.discountPercent) < 0 || Number(form.discountPercent) > 100)) {
    errors.discountPercent = 'تخفیف بین ۰ تا ۱۰۰ است';
  }
  if (form.capacity && Number(form.capacity) < 1) errors.capacity = 'ظرفیت حداقل ۱ است';
  if (form.startDate && form.endDate && form.startDate >= form.endDate) {
    errors.endDate = 'تاریخ پایان باید بعد از شروع باشد';
  }
  const sessionErrors: string[] = [];
  form.sessions.forEach((session, index) => {
    const timeError = validateTime(session.startTime) ?? validateTime(session.endTime);
    if (timeError) sessionErrors.push(`جلسه ${index + 1}: ${timeError}`);
    if (session.startTime >= session.endTime) sessionErrors.push(`جلسه ${index + 1}: زمان شروع باید قبل از پایان باشد`);
  });
  if (sessionErrors.length > 0) errors.sessions = sessionErrors.join(' · ');
  return errors;
}

export function CourseForm({
  instituteId,
  initial,
  onSubmit,
  submitting,
}: {
  instituteId: string;
  initial: CourseFormValues;
  onSubmit: (values: CourseFormValues) => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState<CourseFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: categories } = useQuery({
    queryKey: ['discovery', 'categories'],
    queryFn: () => discovery.categories(),
  });
  const { data: instructors } = useQuery({
    queryKey: ['institutes', 'instructors', instituteId],
    queryFn: () => institutesApi.instructors(instituteId),
    enabled: Boolean(instituteId),
  });

  const set = <K extends keyof CourseFormValues>(key: K, value: CourseFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors = validateCourseForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSubmit(form);
  };

  const addSession = () =>
    set('sessions', [...form.sessions, { dayOfWeek: 0, startTime: '17:30', endTime: '19:00', room: '' }]);

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="rounded-card border border-slate-200 bg-white shadow-card">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-bold text-slate-900">اطلاعات دوره</h3>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input label="عنوان دوره" required value={form.title} error={errors.title} onChange={(e) => set('title', e.target.value)} placeholder="مثلاً: IELTS Intensive — Band 7+" />
          </div>
          <div className="sm:col-span-2">
            <Textarea label="توضیحات" value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <Select label="نوع دوره" value={form.type} onChange={(e) => set('type', e.target.value as CourseType)}>
            {(Object.keys(COURSE_TYPE_FA) as CourseType[]).map((type) => (
              <option key={type} value={type}>
                {COURSE_TYPE_FA[type]}
              </option>
            ))}
          </Select>
          <Select label="سطح" value={form.level} onChange={(e) => set('level', e.target.value as CourseLevel)}>
            {(Object.keys(COURSE_LEVEL_FA) as CourseLevel[]).map((level) => (
              <option key={level} value={level}>
                {COURSE_LEVEL_FA[level]}
              </option>
            ))}
          </Select>
          <Select label="دسته‌بندی" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
            <option value="">بدون دسته‌بندی</option>
            {categories?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="قیمت (تومان)" latin type="number" min={0} required value={form.price} error={errors.price} onChange={(e) => set('price', e.target.value)} />
            <Input label="تخفیف (٪)" latin type="number" min={0} max={100} value={form.discountPercent} error={errors.discountPercent} onChange={(e) => set('discountPercent', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="مدت (ساعت)" latin type="number" min={0} value={form.durationHours} onChange={(e) => set('durationHours', e.target.value)} />
            <Input label="ظرفیت" latin type="number" min={1} value={form.capacity} error={errors.capacity} onChange={(e) => set('capacity', e.target.value)} />
          </div>
          <Input label="تاریخ شروع" latin type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} />
          <Input label="تاریخ پایان" latin type="date" value={form.endDate} error={errors.endDate} onChange={(e) => set('endDate', e.target.value)} />
          <Select
            label="اساتید"
            multiple
            value={form.instructorIds}
            onChange={(e) => set('instructorIds', Array.from(e.target.selectedOptions).map((o) => o.value))}
          >
            {instructors?.map((instructor) => (
              <option key={instructor.id} value={instructor.id}>
                {instructor.full_name}
              </option>
            ))}
          </Select>
          <div className="flex items-end pb-1">
            <Switch checked={form.isPublished} onChange={(v) => set('isPublished', v)} label="انتشار دوره (نمایش به دانش‌آموزان)" />
          </div>
        </div>
      </div>

      <div className="rounded-card border border-slate-200 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">جلسات هفتگی</h3>
            <p className="mt-0.5 text-xs text-slate-500">روزها و ساعت‌های برگزاری دوره</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addSession}>
            <Plus className="h-4 w-4" />
            افزودن جلسه
          </Button>
        </div>
        <div className="flex flex-col gap-3 p-5">
          {errors.sessions && <p className="rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-600">{errors.sessions}</p>}
          {form.sessions.length === 0 && (
            <p className="text-sm text-slate-400">جلسه‌ای اضافه نشده است. (برای دوره‌های آنلاین می‌توانید خالی بگذارید.)</p>
          )}
          {form.sessions.map((session, index) => (
            <div key={index} className="grid grid-cols-2 items-end gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-5">
              <div className="col-span-2 sm:col-span-1">
                <Select
                  label="روز"
                  value={String(session.dayOfWeek)}
                  onChange={(e) => set('sessions', form.sessions.map((s, i) => (i === index ? { ...s, dayOfWeek: Number(e.target.value) } : s)))}
                >
                  {Array.from({ length: 7 }).map((_, day) => (
                    <option key={day} value={day}>
                      {weekdayFa(day)}
                    </option>
                  ))}
                </Select>
              </div>
              <Input label="شروع" latin value={session.startTime} onChange={(e) => set('sessions', form.sessions.map((s, i) => (i === index ? { ...s, startTime: e.target.value } : s)))} />
              <Input label="پایان" latin value={session.endTime} onChange={(e) => set('sessions', form.sessions.map((s, i) => (i === index ? { ...s, endTime: e.target.value } : s)))} />
              <Input label="اتاق" latin value={session.room} onChange={(e) => set('sessions', form.sessions.map((s, i) => (i === index ? { ...s, room: e.target.value } : s)))} />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="justify-self-end text-danger-600"
                onClick={() => set('sessions', form.sessions.filter((_, i) => i !== index))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={submitting}>
          {initial.title ? 'ذخیره تغییرات' : 'ایجاد دوره'}
        </Button>
      </div>
    </form>
  );
}
