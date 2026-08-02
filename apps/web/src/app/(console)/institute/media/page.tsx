'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, MoveUp, MoveDown, PlayCircle, Music, FileText, BadgeCheck, Image as ImageIcon } from 'lucide-react';
import { storage } from '@/lib/api/endpoints';
import { InstituteScope, useInstituteId } from '@/components/console/InstituteScope';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {Badge} from '@/components/ui/Badge';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { UploadButton } from '@/components/ui/UploadButton';
import { ConfirmDialog } from '@/components/ui/Modal';
import { MEDIA_KIND_FA, MEDIA_STATUS_FA } from '@/lib/constants';
import { formatJalaliShort } from '@/lib/format';
import { formatBytes } from '@/lib/validation';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';
import { clsx } from 'clsx';
import type { MediaRow } from '@/types/api';

const KIND_ICON: Record<string, React.ReactNode> = {
  IMAGE: <ImageIcon className="h-5 w-5" />,
  VIDEO: <PlayCircle className="h-5 w-5" />,
  AUDIO: <Music className="h-5 w-5" />,
  DOCUMENT: <FileText className="h-5 w-5" />,
  PANORAMA_360: <ImageIcon className="h-5 w-5" />,
};

const KIND_TONE: Record<string, string> = {
  IMAGE: 'bg-blue-50 text-blue-600',
  VIDEO: 'bg-violet-50 text-violet-600',
  AUDIO: 'bg-amber-50 text-amber-600',
  DOCUMENT: 'bg-slate-100 text-slate-600',
  PANORAMA_360: 'bg-cyan-50 text-cyan-600',
};

export default function InstituteMediaPage() {
  const instituteId = useInstituteId();
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState<MediaRow | null>(null);

  const { data: media, isLoading, isError, refetch } = useQuery({
    queryKey: ['institutes', 'media', instituteId],
    queryFn: () => storage.instituteMedia(instituteId!),
    enabled: Boolean(instituteId),
  });

  const deleteMutation = useMutation({
    mutationFn: (mediaId: string) => storage.remove(mediaId),
    onSuccess: () => {
      toastSuccess('رسانه حذف شد');
      queryClient.invalidateQueries({ queryKey: ['institutes', 'media', instituteId] });
      setDeleting(null);
    },
    onError: (error) => toastError('خطا در حذف رسانه', errorMessage(error)),
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: string[]) => storage.reorder(instituteId!, orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutes', 'media', instituteId] });
    },
    onError: (error) => toastError('خطا در مرتب‌سازی', errorMessage(error)),
  });

  const move = (index: number, direction: -1 | 1) => {
    if (!media) return;
    const target = index + direction;
    if (target < 0 || target >= media.length) return;
    const reordered = [...media];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    reorderMutation.mutate(reordered.map((m) => m.id));
  };

  const images = media?.filter((m) => m.kind === 'IMAGE' || m.kind === 'PANORAMA_360') ?? [];
  const others = media?.filter((m) => m.kind !== 'IMAGE' && m.kind !== 'PANORAMA_360') ?? [];

  return (
    <InstituteScope>
      <PageHeader
        title="گالری رسانه‌ها"
        description="تصاویر، ویدئوها و اسناد آموزشگاه — نمایش در ویترین و روی نقشه"
        actions={
          <div className="flex flex-wrap gap-2">
            <UploadButton
              purpose="INSTITUTE_GALLERY"
              kind="IMAGE"
              instituteId={instituteId ?? undefined}
              accept="image/*"
              label="بارگذاری تصویر"
              multiple
              onUploaded={() => {
                toastSuccess('تصویر بارگذاری شد');
                queryClient.invalidateQueries({ queryKey: ['institutes', 'media', instituteId] });
              }}
              onError={(m) => toastError('خطا در بارگذاری', m)}
            />
            <UploadButton
              purpose="INSTITUTE_GALLERY"
              kind="VIDEO"
              instituteId={instituteId ?? undefined}
              accept="video/*"
              label="بارگذاری ویدئو"
              onUploaded={() => {
                toastSuccess('ویدئو بارگذاری شد — پس از پردازش نمایش داده می‌شود');
                queryClient.invalidateQueries({ queryKey: ['institutes', 'media', instituteId] });
              }}
              onError={(m) => toastError('خطا در بارگذاری', m)}
            />
          </div>
        }
      />

      {isLoading ? (
        <SkeletonCards />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !media || media.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ImageIcon className="h-7 w-7" />}
            title="رسانه‌ای بارگذاری نشده"
            description="تصاویر و ویدئوهای آموزشگاه را اضافه کنید تا در ویترین نمایش داده شوند."
            action={
              <UploadButton
                purpose="INSTITUTE_GALLERY"
                kind="IMAGE"
                instituteId={instituteId ?? undefined}
                accept="image/*"
                label="بارگذاری اولین تصویر"
                onUploaded={() => queryClient.invalidateQueries({ queryKey: ['institutes', 'media', instituteId] })}
              />
            }
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {images.length > 0 && (
            <div>
              <p className="mb-3 text-sm font-bold text-slate-800">تصاویر ({images.length})</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {images.map((item, index) => (
                  <div key={item.id} className="group relative overflow-hidden rounded-card border border-slate-200 bg-white shadow-card">
                    {item.thumbnail_url ?? item.url ? (
                      <img
                        src={item.thumbnail_url ?? item.url!}
                        alt={item.title ?? 'تصویر آموزشگاه'}
                        className="h-40 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-40 w-full items-center justify-center bg-slate-100 text-slate-400">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-slate-900/70 to-transparent p-2.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <Badge tone={item.status === 'READY' ? 'green' : item.status === 'PROCESSING' ? 'amber' : 'slate'}>
                        {MEDIA_STATUS_FA[item.status]}
                      </Badge>
                      <div className="flex gap-1">
                        <button
                          className="rounded-md bg-white/20 p-1.5 text-white hover:bg-white/35"
                          onClick={() => move(index, -1)}
                          aria-label="انتقال به بالا"
                        >
                          <MoveUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="rounded-md bg-white/20 p-1.5 text-white hover:bg-white/35"
                          onClick={() => move(index, 1)}
                          aria-label="انتقال به پایین"
                        >
                          <MoveDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="rounded-md bg-danger-600/90 p-1.5 text-white hover:bg-danger-600"
                          onClick={() => setDeleting(item)}
                          aria-label="حذف"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <p className="truncate text-xs text-slate-500">{item.title ?? MEDIA_KIND_FA[item.kind]}</p>
                      <span className="shrink-0 text-[10px] text-slate-400">{formatJalaliShort(item.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {others.length > 0 && (
            <div>
              <p className="mb-3 text-sm font-bold text-slate-800">ویدئو و اسناد ({others.length})</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {others.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-card border border-slate-200 bg-white p-4 shadow-card">
                    <div className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', KIND_TONE[item.kind])}>
                      {KIND_ICON[item.kind]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{item.title ?? MEDIA_KIND_FA[item.kind]}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {MEDIA_KIND_FA[item.kind]} · {formatBytes(item.size_bytes)} · {formatJalaliShort(item.created_at)}
                      </p>
                    </div>
                    <Badge tone={item.status === 'READY' ? 'green' : item.status === 'PROCESSING' ? 'amber' : 'slate'}>
                      {MEDIA_STATUS_FA[item.status]}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => setDeleting(item)} aria-label="حذف">
                      <Trash2 className="h-4 w-4 text-danger-600" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <BadgeCheck className="h-4 w-4" />
            ترتیب نمایش با دکمه‌های بالا/پایین تنظیم می‌شود و بلافاصله ذخیره می‌شود.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title="حذف رسانه"
        message={`«${deleting?.title ?? MEDIA_KIND_FA[deleting?.kind ?? 'IMAGE']}» برای همیشه حذف شود؟`}
        confirmLabel="حذف"
        loading={deleteMutation.isPending}
      />
    </InstituteScope>
  );
}
