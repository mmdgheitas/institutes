'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Video, Plus, Trash2, Link2, ExternalLink } from 'lucide-react';
import { liveClasses } from '@/lib/api/endpoints';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Field';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SkeletonRows } from '@/components/ui/Skeleton';
import {formatJalaliDateTime, fromLocalInputValue} from '@/lib/format';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';
import type { LiveSessionInfo } from '@shared/dto';
import type { LiveClassProvider } from '@shared/enums';

const PROVIDER_FA: Record<LiveClassProvider, string> = {
  ADOBE_CONNECT: 'Adobe Connect',
  BIG_BLUE_BUTTON: 'BigBlueButton',
};

export function CourseLiveSessionsTab({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<LiveSessionInfo | null>(null);
  const [recordingFor, setRecordingFor] = useState<LiveSessionInfo | null>(null);
  const [recordingUrl, setRecordingUrl] = useState('');
  const [form, setForm] = useState({ title: '', provider: 'BIG_BLUE_BUTTON' as LiveClassProvider, startsAt: '', endsAt: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: sessions, isLoading, isError, refetch } = useQuery({
    queryKey: ['live-classes', courseId],
    queryFn: () => liveClasses.list(courseId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      liveClasses.create(courseId, {
        title: form.title.trim(),
        provider: form.provider,
        startsAt: fromLocalInputValue(form.startsAt),
        endsAt: fromLocalInputValue(form.endsAt),
      }),
    onSuccess: () => {
      toastSuccess('جلسه آنلاین ایجاد شد');
      queryClient.invalidateQueries({ queryKey: ['live-classes', courseId] });
      setCreating(false);
      setForm({ title: '', provider: 'BIG_BLUE_BUTTON', startsAt: '', endsAt: '' });
    },
    onError: (error) => toastError('خطا در ایجاد جلسه', errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => liveClasses.remove(id),
    onSuccess: () => {
      toastSuccess('جلسه حذف شد');
      queryClient.invalidateQueries({ queryKey: ['live-classes', courseId] });
      setDeleting(null);
    },
    onError: (error) => toastError('خطا در حذف', errorMessage(error)),
  });

  const recordingMutation = useMutation({
    mutationFn: (sessionId: string) => liveClasses.addRecording(sessionId, { recordingUrl: recordingUrl.trim() }),
    onSuccess: () => {
      toastSuccess('لینک ضبط جلسه ثبت شد');
      queryClient.invalidateQueries({ queryKey: ['live-classes', courseId] });
      setRecordingFor(null);
      setRecordingUrl('');
    },
    onError: (error) => toastError('خطا در ثبت لینک', errorMessage(error)),
  });

  const join = async (session: LiveSessionInfo) => {
    try {
      const { joinUrl } = await liveClasses.join(session.id);
      window.open(joinUrl, '_blank', 'noopener');
    } catch (error) {
      toastError('خطا در دریافت لینک ورود', errorMessage(error));
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (form.title.trim().length < 3) nextErrors.title = 'عنوان حداقل ۳ کاراکتر است';
    if (!form.startsAt) nextErrors.startsAt = 'زمان شروع را وارد کنید';
    if (!form.endsAt) nextErrors.endsAt = 'زمان پایان را وارد کنید';
    if (form.startsAt && form.endsAt && form.startsAt >= form.endsAt) nextErrors.endsAt = 'پایان باید بعد از شروع باشد';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    createMutation.mutate();
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          جلسه جدید
        </Button>
      </div>

      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !sessions || sessions.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Video className="h-7 w-7" />}
            title="جلسه آنلاینی برنامه‌ریزی نشده"
            description="جلسات زنده BigBlueButton یا Adobe Connect بسازید."
            action={
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" />
                برنامه‌ریزی جلسه
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {sessions.map((session) => (
            <Card key={session.id}>
              <CardBody className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <Video className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800">{session.title}</p>
                    <Badge tone="violet">{PROVIDER_FA[session.provider]}</Badge>
                    {session.isLive && <Badge tone="green">در حال برگزاری</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatJalaliDateTime(session.startsAt)} — {formatJalaliDateTime(session.endsAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {session.isLive && (
                    <Button size="sm" variant="success" onClick={() => void join(session)}>
                      <ExternalLink className="h-4 w-4" />
                      ورود به جلسه
                    </Button>
                  )}
                  {!session.recordingUrl && (
                    <Button size="sm" variant="outline" onClick={() => setRecordingFor(session)}>
                      <Link2 className="h-4 w-4" />
                      ثبت لینک ضبط
                    </Button>
                  )}
                  {session.recordingUrl && (
                    <a
                      href={session.recordingUrl}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-green-50 px-3 text-xs font-semibold text-green-700 hover:bg-green-100"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      ضبط جلسه
                    </a>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(session)}>
                    <Trash2 className="h-4 w-4 text-danger-600" />
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="برنامه‌ریزی جلسه آنلاین">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Input label="عنوان جلسه" required value={form.title} error={errors.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <Select label="سرویس برگزاری" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value as LiveClassProvider })}>
            {(Object.keys(PROVIDER_FA) as LiveClassProvider[]).map((provider) => (
              <option key={provider} value={provider}>
                {PROVIDER_FA[provider]}
              </option>
            ))}
          </Select>
          <Input label="زمان شروع" latin type="datetime-local" value={form.startsAt} error={errors.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
          <Input label="زمان پایان" latin type="datetime-local" value={form.endsAt} error={errors.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
          <Button type="submit" loading={createMutation.isPending}>
            ایجاد جلسه
          </Button>
        </form>
      </Modal>

      <Modal
        open={Boolean(recordingFor)}
        onClose={() => setRecordingFor(null)}
        title="ثبت لینک ضبط جلسه"
        footer={
          <>
            <Button variant="outline" onClick={() => setRecordingFor(null)}>
              انصراف
            </Button>
            <Button loading={recordingMutation.isPending} disabled={!recordingUrl.trim()} onClick={() => recordingFor && recordingMutation.mutate(recordingFor.id)}>
              ذخیره
            </Button>
          </>
        }
      >
        <Input
          label="آدرس ویدئوی ضبط‌شده"
          latin
          autoFocus
          value={recordingUrl}
          onChange={(e) => setRecordingUrl(e.target.value)}
          placeholder="https://…"
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title="حذف جلسه آنلاین"
        message={`جلسه «${deleting?.title}» حذف شود؟`}
        confirmLabel="حذف"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
