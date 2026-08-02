'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Download, Trash2, Plus } from 'lucide-react';
import { storage } from '@/lib/api/endpoints';
import { Card, CardBody } from '@/components/ui/Card';
import {Badge} from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Misc';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { UploadButton } from '@/components/ui/UploadButton';
import { MEDIA_KIND_FA } from '@/lib/constants';
import { formatJalaliShort } from '@/lib/format';
import { formatBytes } from '@/lib/validation';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';
import type { StudyMaterial } from '@shared/dto';

export function CourseMaterialsTab({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const [pendingMedia, setPendingMedia] = useState<{ mediaId: string } | null>(null);
  const [title, setTitle] = useState('');
  const [isDownloadable, setIsDownloadable] = useState(true);
  const [deleting, setDeleting] = useState<StudyMaterial | null>(null);

  const { data: materials, isLoading, isError, refetch } = useQuery({
    queryKey: ['materials', courseId],
    queryFn: () => storage.materials(courseId),
  });

  const addMutation = useMutation({
    mutationFn: ({ mediaId }: { mediaId: string }) =>
      storage.addMaterial(courseId, { mediaId, title: title.trim(), isDownloadable }),
    onSuccess: () => {
      toastSuccess('ماده درسی اضافه شد');
      queryClient.invalidateQueries({ queryKey: ['materials', courseId] });
      setPendingMedia(null);
      setTitle('');
      setIsDownloadable(true);
    },
    onError: (error) => toastError('خطا در افزودن', errorMessage(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => storage.removeMaterial(id),
    onSuccess: () => {
      toastSuccess('ماده درسی حذف شد');
      queryClient.invalidateQueries({ queryKey: ['materials', courseId] });
      setDeleting(null);
    },
    onError: (error) => toastError('خطا در حذف', errorMessage(error)),
  });

  const download = async (material: StudyMaterial) => {
    try {
      const { url, fileName } = await storage.materialDownloadUrl(material.id);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.target = '_blank';
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      toastError('خطا در دریافت لینک دانلود', errorMessage(error));
    }
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <UploadButton
          purpose="COURSE_MATERIAL"
          kind="DOCUMENT"
          courseId={courseId}
          label={
            <span className="inline-flex items-center gap-2">
              <Plus className="h-4 w-4" />
              افزودن ماده درسی
            </span>
          }
          onUploaded={(result) => {
            setPendingMedia({ mediaId: result.mediaId });
            setTitle('');
            setIsDownloadable(true);
          }}
          onError={(m) => toastError('خطا در بارگذاری', m)}
        />
      </div>

      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !materials || materials.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="h-7 w-7" />}
            title="ماده درسی‌ای نیست"
            description="جزوه، اسلاید یا فایل صوتی/تصویری دوره را بارگذاری کنید."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {materials.map((material) => (
            <Card key={material.id}>
              <CardBody className="flex flex-wrap items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{material.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {MEDIA_KIND_FA[material.kind]} · {formatBytes(material.sizeBytes)} · {formatJalaliShort(material.createdAt)}
                  </p>
                </div>
                <Badge tone={material.isDownloadable ? 'green' : 'slate'}>
                  {material.isDownloadable ? 'قابل دانلود' : 'فقط پخش'}
                </Badge>
                <Button variant="outline" size="sm" onClick={() => void download(material)}>
                  <Download className="h-4 w-4" />
                  دانلود
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleting(material)}>
                  <Trash2 className="h-4 w-4 text-danger-600" />
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(pendingMedia)}
        onClose={() => setPendingMedia(null)}
        title="ثبت ماده درسی"
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingMedia(null)}>
              انصراف
            </Button>
            <Button
              loading={addMutation.isPending}
              disabled={!title.trim()}
              onClick={() => pendingMedia && addMutation.mutate({ mediaId: pendingMedia.mediaId })}
            >
              ذخیره
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-500">فایل با موفقیت بارگذاری شد. عنوان و تنظیمات را تکمیل کنید:</p>
          <Input label="عنوان" required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: جزوه فصل ۱" />
          <Switch checked={isDownloadable} onChange={setIsDownloadable} label="دانلود برای دانش‌آموزان مجاز باشد" />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        title="حذف ماده درسی"
        message={`«${deleting?.title}» حذف شود؟`}
        confirmLabel="حذف"
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
