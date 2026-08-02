'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Pencil, Trash2, Star } from 'lucide-react';
import { institutes as institutesApi } from '@/lib/api/endpoints';
import { InstituteScope, useInstituteId } from '@/components/console/InstituteScope';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { formatNumber } from '@/lib/format';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';
import type { InstructorRow } from '@/types/api';

interface InstructorForm {
  fullName: string;
  headline: string;
  bio: string;
  yearsOfExperience: string;
  specialties: string;
  avatarUrl: string;
}

const emptyForm: InstructorForm = {
  fullName: '',
  headline: '',
  bio: '',
  yearsOfExperience: '',
  specialties: '',
  avatarUrl: '',
};

export default function InstructorsPage() {
  const instituteId = useInstituteId();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<InstructorRow | null>(null);
  const [deleting, setDeleting] = useState<InstructorRow | null>(null);
  const [form, setForm] = useState<InstructorForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: instructors, isLoading, isError, refetch } = useQuery({
    queryKey: ['institutes', 'instructors', instituteId],
    queryFn: () => institutesApi.instructors(instituteId!),
    enabled: Boolean(instituteId),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        fullName: form.fullName.trim(),
        headline: form.headline.trim() || undefined,
        bio: form.bio.trim() || undefined,
        yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : undefined,
        specialties: form.specialties.split(/[،,]/).map((s) => s.trim()).filter(Boolean),
        avatarUrl: form.avatarUrl.trim() || undefined,
      };
      return editing
        ? institutesApi.updateInstructor(editing.id, body)
        : institutesApi.createInstructor(instituteId!, body);
    },
    onSuccess: () => {
      toastSuccess(editing ? 'مشخصات استاد به‌روزرسانی شد' : 'استاد اضافه شد');
      queryClient.invalidateQueries({ queryKey: ['institutes', 'instructors', instituteId] });
      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (error) => toastError('خطا در ذخیره', errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => institutesApi.deleteInstructor(id),
    onSuccess: () => {
      toastSuccess('استاد غیرفعال شد');
      queryClient.invalidateQueries({ queryKey: ['institutes', 'instructors', instituteId] });
      setDeleting(null);
    },
    onError: (error) => toastError('خطا در حذف', errorMessage(error)),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (instructor: InstructorRow) => {
    setEditing(instructor);
    setForm({
      fullName: instructor.full_name,
      headline: instructor.headline ?? '',
      bio: instructor.bio ?? '',
      yearsOfExperience: instructor.years_of_experience != null ? String(instructor.years_of_experience) : '',
      specialties: instructor.specialties.join('، '),
      avatarUrl: instructor.avatar_url ?? '',
    });
    setErrors({});
    setModalOpen(true);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (form.fullName.trim().length < 3) nextErrors.fullName = 'نام کامل حداقل ۳ کاراکتر است';
    if (form.yearsOfExperience && (Number(form.yearsOfExperience) < 0 || Number(form.yearsOfExperience) > 60)) {
      nextErrors.yearsOfExperience = 'سابقه باید بین ۰ تا ۶۰ سال باشد';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    saveMutation.mutate();
  };

  return (
    <InstituteScope>
      <PageHeader
        title="اساتید"
        description="اساتید و مدرسان آموزشگاه"
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            افزودن استاد
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonCards count={4} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !instructors || instructors.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="h-7 w-7" />}
            title="استادی ثبت نشده"
            description="اساتید را اضافه کنید تا در ویترین آموزشگاه نمایش داده شوند."
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                افزودن استاد
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {instructors.map((instructor) => (
            <Card key={instructor.id}>
              <CardBody className="flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <Avatar name={instructor.full_name} src={instructor.avatar_url} size={52} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{instructor.full_name}</p>
                    {instructor.headline && <p className="mt-0.5 truncate text-xs text-slate-500">{instructor.headline}</p>}
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                      <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                      {formatNumber(instructor.rating)}
                      <span className="text-slate-400">({formatNumber(instructor.review_count)} نظر)</span>
                    </p>
                  </div>
                  <Badge tone={instructor.is_active ? 'green' : 'slate'}>
                    {instructor.is_active ? 'فعال' : 'غیرفعال'}
                  </Badge>
                </div>
                {instructor.bio && <p className="line-clamp-2 text-xs leading-5 text-slate-500">{instructor.bio}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {instructor.specialties.map((specialty) => (
                    <span key={specialty} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] text-slate-600">
                      {specialty}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-xs text-slate-400">
                    {instructor.years_of_experience != null ? `${formatNumber(instructor.years_of_experience)} سال سابقه` : '—'}
                  </span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(instructor)}>
                      <Pencil className="h-4 w-4" />
                      ویرایش
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(instructor)}>
                      <Trash2 className="h-4 w-4 text-danger-600" />
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'ویرایش استاد' : 'افزودن استاد'}
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              انصراف
            </Button>
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
              ذخیره
            </Button>
          </>
        }
      >
        <form onSubmit={submit} className="flex flex-col gap-4" id="instructor-form">
          <Input label="نام کامل" required value={form.fullName} error={errors.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <Input label="عنوان / تخصص نمایشی" value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
          <Textarea label="بیوگرافی" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="سال‌های سابقه" latin type="number" min={0} max={60} value={form.yearsOfExperience} error={errors.yearsOfExperience} onChange={(e) => setForm({ ...form, yearsOfExperience: e.target.value })} />
            <Input label="آدرس تصویر (اختیاری)" latin value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} />
          </div>
          <Input label="زمینه‌های تخصص (با ویرگول جدا کنید)" value={form.specialties} onChange={(e) => setForm({ ...form, specialties: e.target.value })} />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title="غیرفعال‌سازی استاد"
        message={`استاد «${deleting?.full_name}» غیرفعال شود؟ این عمل قابل بازگشت نیست.`}
        confirmLabel="غیرفعال‌سازی"
        loading={deleteMutation.isPending}
      />
    </InstituteScope>
  );
}
