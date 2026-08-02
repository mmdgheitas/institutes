'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, BadgeCheck, FileText, MapPin } from 'lucide-react';
import { institutes as institutesApi, discovery } from '@/lib/api/endpoints';
import { InstituteScope, useInstituteId } from '@/components/console/InstituteScope';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input, Textarea, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Badge, hexToTone } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Misc';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { ErrorState, EmptyState } from '@/components/ui/States';
import { MapPicker, type LatLngValue } from '@/components/map/MapPicker';
import { UploadButton } from '@/components/ui/UploadButton';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';
import { VERIFICATION_STATUS_FA, VERIFICATION_COLORS } from '@/lib/constants';
import { formatJalaliDateTime } from '@/lib/format';
import type { InstituteRow } from '@/types/api';

function ProfileForm({ institute }: { institute: InstituteRow }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: institute.name,
    description: institute.description ?? '',
    shortDescription: institute.short_description ?? '',
    address: institute.address,
    city: institute.city,
    province: institute.province ?? '',
    phone: institute.phone ?? '',
    email: institute.email ?? '',
    website: institute.website ?? '',
    skills: institute.skills.join('، '),
    amenities: institute.amenities.join('، '),
    workingHours: institute.working_hours ?? {},
    freePreRegistration: institute.free_pre_registration,
    isPublished: institute.is_published,
  });
  const [location, setLocation] = useState<LatLngValue>({
    lat: institute.latitude,
    lng: institute.longitude,
  });
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: categories } = useQuery({
    queryKey: ['discovery', 'categories'],
    queryFn: () => discovery.categories(),
  });

  // The storefront exposes the institute's current categories (only when the
  // institute is published); otherwise the selector starts empty and the user
  // picks categories that get fully replaced on save.
  const { data: storefront } = useQuery({
    queryKey: ['discovery', 'storefront', institute.slug],
    queryFn: () => discovery.storefront(institute.slug),
    retry: false,
  });

  useEffect(() => {
    if (storefront?.categories?.length) {
      setCategoryIds(storefront.categories.map((c) => c.id));
    }
  }, [storefront]);

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => institutesApi.update(institute.id, body),
    onSuccess: () => {
      toastSuccess('مشخصات آموزشگاه ذخیره شد');
      queryClient.invalidateQueries({ queryKey: ['institutes'] });
      queryClient.invalidateQueries({ queryKey: ['discovery', 'storefront'] });
    },
    onError: (error) => toastError('خطا در ذخیره مشخصات', errorMessage(error)),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (form.name.trim().length < 3) nextErrors.name = 'نام آموزشگاه حداقل ۳ کاراکتر است';
    if (form.address.trim().length < 5) nextErrors.address = 'آدرس حداقل ۵ کاراکتر است';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'ایمیل معتبر نیست';
    if (form.website && !/^https?:\/\/.+/.test(form.website)) nextErrors.website = 'وب‌سایت باید با http یا https شروع شود';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    updateMutation.mutate({
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      shortDescription: form.shortDescription.trim() || undefined,
      address: form.address.trim(),
      city: form.city.trim(),
      province: form.province.trim() || undefined,
      phone: form.phone.trim() || undefined,
      email: form.email.trim() || undefined,
      website: form.website.trim() || undefined,
      latitude: location.lat,
      longitude: location.lng,
      skills: form.skills.split(/[،,]/).map((s) => s.trim()).filter(Boolean),
      amenities: form.amenities.split(/[،,]/).map((s) => s.trim()).filter(Boolean),
      // Only send days that actually have a range; drop 'closed' placeholders.
      workingHours: Object.fromEntries(
        Object.entries(form.workingHours).filter(([, hours]) => hours && hours !== 'closed' && hours.trim()),
      ),
      freePreRegistration: form.freePreRegistration,
      isPublished: form.isPublished,
      categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Card>
        <CardHeader title="اطلاعات پایه" description="نام، توضیحات و اطلاعات تماس" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Input label="نام آموزشگاه" required value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="نام کوتاه / شعار" value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} />
          <div className="sm:col-span-2">
            <Textarea label="توضیحات کامل" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <Input label="آدرس" required value={form.address} error={errors.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="شهر" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Input label="استان" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
          </div>
          <Input label="تلفن" latin value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="ایمیل" latin value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input label="وب‌سایت" latin value={form.website} error={errors.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          <div className="sm:col-span-2">
            <Select
              label="دسته‌بندی‌ها"
              multiple
              value={categoryIds}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                setCategoryIds(values);
              }}
            >
              {categories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-slate-400">برای انتخاب چند مورد، Ctrl را نگه دارید.</p>
          </div>
          <Input label="مهارت‌ها (با ویرگول جدا کنید)" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
          <Input label="امکانات (با ویرگول جدا کنید)" value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="موقعیت روی نقشه" description="کلیک کنید یا نشانگر را بکشید" />
        <CardBody className="flex flex-col gap-3">
          <MapPicker value={location} onChange={setLocation} />
          <p className="flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin className="h-4 w-4 text-primary-600" />
            عرض جغرافیایی: <span dir="ltr" className="font-mono">{location.lat}</span> · طول جغرافیایی:{' '}
            <span dir="ltr" className="font-mono">{location.lng}</span>
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="سایر تنظیمات" />
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800">انتشار آموزشگاه</p>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                تا زمانی که منتشر نشده، آموزشگاه در نقشه، نتایج جستجو و ویترین برای دانش‌آموزان
                نمایش داده نمی‌شود. وضعیت تأیید مدارک مستقل از انتشار است.
              </p>
            </div>
            <Switch
              checked={form.isPublished}
              onChange={(v) => setForm({ ...form, isPublished: v })}
              label={form.isPublished ? 'منتشر شده' : 'پیش‌نویس'}
            />
          </div>
          <Switch
            checked={form.freePreRegistration}
            onChange={(v) => setForm({ ...form, freePreRegistration: v })}
            label="پیش‌ثبت‌نام رایگان"
          />
          <div className="border-t border-slate-100 pt-4">
            <p className="mb-2 text-sm font-semibold text-slate-700">ساعات کاری روزانه (قالب 09:00-18:00 — روزهای خالی بسته هستند)</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {['0', '1', '2', '3', '4', '5', '6'].map((day) => (
                <div key={day} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-xs text-slate-500">
                    {['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'][Number(day)]}
                  </span>
                  <Input
                    latin
                    placeholder="09:00-18:00"
                    value={form.workingHours[day] && form.workingHours[day] !== 'closed' ? form.workingHours[day] : ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        workingHours: { ...form.workingHours, [day]: e.target.value },
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" size="lg" loading={updateMutation.isPending}>
          <Save className="h-4 w-4" />
          ذخیره تغییرات
        </Button>
      </div>
    </form>
  );
}

function VerificationSection({ instituteId }: { instituteId: string }) {
  const queryClient = useQueryClient();
  const { data: docs, isLoading } = useQuery({
    queryKey: ['institutes', 'verification', instituteId],
    queryFn: () => institutesApi.verificationDocs(instituteId),
  });

  const submitMutation = useMutation({
    mutationFn: ({ mediaId, docType }: { mediaId: string; docType: string }) =>
      institutesApi.submitVerification(instituteId, { mediaId, docType }),
    onSuccess: () => {
      toastSuccess('مدرک برای بررسی ارسال شد');
      queryClient.invalidateQueries({ queryKey: ['institutes', 'verification', instituteId] });
    },
    onError: (error) => toastError('خطا در ارسال مدرک', errorMessage(error)),
  });

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-primary-600" />
            تأیید هویت آموزشگاه
          </span>
        }
        description="برای دریافت نشان تأیید، مدرک رسمی معتبر بارگذاری کنید"
      />
      <CardBody className="flex flex-col gap-4">
        {isLoading ? (
          <SkeletonRows rows={2} />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone={hexToTone(VERIFICATION_COLORS[(docs?.[0]?.status as InstituteRow['verification_status']) ?? 'UNVERIFIED'])} dot={VERIFICATION_COLORS[(docs?.[0]?.status as InstituteRow['verification_status']) ?? 'UNVERIFIED']}>
                وضعیت فعلی: {VERIFICATION_STATUS_FA[(docs?.[0]?.status as InstituteRow['verification_status']) ?? 'UNVERIFIED']}
              </Badge>
              {docs?.[0]?.review_note && (
                <p className="text-xs text-slate-500">دلیل بررسی: {docs[0].review_note}</p>
              )}
            </div>

            {docs && docs.length > 0 && (
              <div className="flex flex-col gap-2">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3.5 py-2.5">
                    <span className="flex items-center gap-2 text-sm text-slate-700">
                      <FileText className="h-4 w-4 text-slate-400" />
                      {doc.title ?? doc.doc_type}
                      <span className="text-xs text-slate-400">({formatJalaliDateTime(doc.created_at)})</span>
                    </span>
                    <Badge tone={hexToTone(VERIFICATION_COLORS[doc.status])} dot={VERIFICATION_COLORS[doc.status]}>
                      {VERIFICATION_STATUS_FA[doc.status]}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              <UploadButton
                purpose="VERIFICATION_DOCUMENT"
                kind="DOCUMENT"
                instituteId={instituteId}
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                label="بارگذاری مدرک جدید"
                onUploaded={(result) => submitMutation.mutate({ mediaId: result.mediaId, docType: 'LICENSE' })}
                onError={(message) => toastError('خطا در بارگذاری', message)}
              />
              <p className="text-xs text-slate-400">پروانه فعالیت، روزنامه رسمی یا کارت ملی (PDF یا تصویر)</p>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

export default function InstituteProfilePage() {
  const instituteId = useInstituteId();
  const { data: institute, isLoading, isError, refetch } = useQuery({
    queryKey: ['institutes', 'manage', instituteId],
    queryFn: () => institutesApi.manage(instituteId!),
    enabled: Boolean(instituteId),
  });

  return (
    <InstituteScope>
      <PageHeader title="مشخصات آموزشگاه" description="اطلاعات نمایش داده‌شده به دانش‌آموزان روی نقشه و ویترین" />
      {isLoading ? (
        <SkeletonRows rows={6} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !institute ? (
        <EmptyState title="آموزشگاه یافت نشد" />
      ) : (
        <div className="flex flex-col gap-5">
          <ProfileForm institute={institute} />
          <VerificationSection instituteId={institute.id} />
        </div>
      )}
    </InstituteScope>
  );
}
