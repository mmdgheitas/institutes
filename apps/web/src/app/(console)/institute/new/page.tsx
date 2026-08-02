'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, MapPin } from 'lucide-react';
import { institutes as institutesApi, discovery } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input, Textarea, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Misc';
import { MapPicker, type LatLngValue } from '@/components/map/MapPicker';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';
import { useActiveInstitute } from '@/stores/activeInstitute';

const WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

export default function NewInstitutePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setInstituteId } = useActiveInstitute();

  const [form, setForm] = useState({
    name: '',
    description: '',
    shortDescription: '',
    address: '',
    city: 'تهران',
    province: 'تهران',
    phone: '',
    email: '',
    website: '',
    skills: '',
    amenities: '',
    freePreRegistration: true,
    isPublished: false,
  });
  const [location, setLocation] = useState<LatLngValue>({ lat: 35.7219, lng: 51.3347 });
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [workingHours, setWorkingHours] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: categories } = useQuery({
    queryKey: ['discovery', 'categories'],
    queryFn: () => discovery.categories(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      institutesApi.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        shortDescription: form.shortDescription.trim() || undefined,
        address: form.address.trim(),
        city: form.city.trim() || 'تهران',
        province: form.province.trim() || undefined,
        latitude: location.lat,
        longitude: location.lng,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        website: form.website.trim() || undefined,
        skills: form.skills.split(/[،,]/).map((s) => s.trim()).filter(Boolean),
        amenities: form.amenities.split(/[،,]/).map((s) => s.trim()).filter(Boolean),
        categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
        workingHours: Object.fromEntries(Object.entries(workingHours).filter(([, v]) => v.trim())),
        freePreRegistration: form.freePreRegistration,
        isPublished: form.isPublished,
      }),
    onSuccess: (institute) => {
      toastSuccess('آموزشگاه با موفقیت ثبت شد', 'حالا می‌توانید دوره‌ها و فرم‌ها را بسازید.');
      setInstituteId(institute.id);
      queryClient.invalidateQueries({ queryKey: ['institutes', 'mine'] });
      router.push('/institute/profile');
    },
    onError: (error) => toastError('ثبت آموزشگاه ناموفق بود', errorMessage(error)),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (form.name.trim().length < 3) nextErrors.name = 'نام آموزشگاه حداقل ۳ کاراکتر است';
    if (form.address.trim().length < 5) nextErrors.address = 'آدرس حداقل ۵ کاراکتر است';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'ایمیل معتبر نیست';
    if (form.website && !/^https?:\/\/.+/.test(form.website)) nextErrors.website = 'وب‌سایت باید با http یا https شروع شود';
    if (form.phone && !/^0\d{10}$/.test(form.phone.replace(/[\s-]/g, '')) && !/^021\d{8}$/.test(form.phone.replace(/[\s-]/g, ''))) {
      nextErrors.phone = 'تلفن معتبر نیست';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    createMutation.mutate();
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="ثبت آموزشگاه جدید"
        description="اطلاعات آموزشگاه را وارد کنید تا روی نقشه و ویترین نمایش داده شود. پس از ثبت، باید مدارک تأیید هویت را بارگذاری کنید."
      />

        <form onSubmit={submit} className="flex flex-col gap-5">
          <Card>
            <CardHeader title="اطلاعات پایه" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Input label="نام آموزشگاه" required value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثلاً: آموزشگاه زبان پارسی" />
              <Input label="شعار / توضیح کوتاه" value={form.shortDescription} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} />
              <div className="sm:col-span-2">
                <Textarea label="توضیحات کامل" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <Input label="آدرس" required value={form.address} error={errors.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <Input label="شهر" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                <Input label="استان" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} />
              </div>
              <Input label="تلفن" latin value={form.phone} error={errors.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input label="ایمیل" latin value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input label="وب‌سایت" latin value={form.website} error={errors.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              <Select
                label="دسته‌بندی‌ها (Ctrl برای چند انتخاب)"
                multiple
                value={categoryIds}
                onChange={(e) => setCategoryIds(Array.from(e.target.selectedOptions).map((o) => o.value))}
              >
                {categories?.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
              <div className="grid grid-cols-2 gap-3">
                <Input label="مهارت‌ها (با ویرگول)" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="آیلتس، زبان، برنامه‌نویسی" />
                <Input label="امکانات (با ویرگول)" value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} placeholder="پارکینگ، وای‌فای" />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="موقعیت روی نقشه" description="کلیک کنید یا نشانگر را بکشید — دانش‌آموزان آموزشگاه را روی نقشه پیدا می‌کنند" />
            <CardBody className="flex flex-col gap-3">
              <MapPicker value={location} onChange={setLocation} />
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="h-4 w-4 text-primary-600" />
                عرض: <span dir="ltr" className="font-mono">{location.lat}</span> · طول:{' '}
                <span dir="ltr" className="font-mono">{location.lng}</span>
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="ساعات کاری" description="قالب 09:00-18:00 — روزهای خالی بسته در نظر گرفته می‌شوند" />
            <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {WEEKDAYS.map((day, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-slate-500">{day}</span>
                  <Input
                    latin
                    placeholder="09:00-18:00"
                    value={workingHours[String(index)] ?? ''}
                    onChange={(e) => setWorkingHours((w) => ({ ...w, [String(index)]: e.target.value }))}
                  />
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="انتشار و پیش‌ثبت‌نام" />
            <CardBody className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">انتشار فوری آموزشگاه</p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    در حالت پیش‌نویس، آموزشگاه برای دانش‌آموزان نمایش داده نمی‌شود. می‌توانید بعداً از
                    صفحه «مشخصات آموزشگاه» نیز منتشر کنید.
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
                label="پیش‌ثبت‌نام برای دانش‌آموزان رایگان باشد"
              />
            </CardBody>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" size="lg" loading={createMutation.isPending}>
              <Save className="h-4 w-4" />
              ثبت آموزشگاه
            </Button>
          </div>
        </form>
    </div>
  );
}
