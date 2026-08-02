'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, FileText, Eye } from 'lucide-react';
import { institutes as institutesApi } from '@/lib/api/endpoints';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Field';
import { formatJalaliDateTime } from '@/lib/format';
import { toastSuccess, toastError } from '@/stores/toasts';

const DOC_TYPES_FA: Record<string, string> = {
  LICENSE: 'پروانه فعالیت',
  OFFICIAL_REGISTRATION: 'روزنامه رسمی',
  NATIONAL_ID_CARD: 'کارت ملی',
  OTHER: 'سایر مدارک',
};

export default function VerificationQueuePage() {
  const queryClient = useQueryClient();
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ id: string; name: string } | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['verification', 'pending'],
    queryFn: () => institutesApi.pendingVerifications(),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ documentId, status, note }: { documentId: string; status: 'VERIFIED' | 'REJECTED'; note?: string }) =>
      institutesApi.reviewVerification(documentId, { status, note }),
    onSuccess: (_data, variables) => {
      toastSuccess(
        variables.status === 'VERIFIED' ? 'مدرک تأیید شد' : 'مدرک رد شد',
        'به مدیر آموزشگاه اعلان ارسال شد.',
      );
      queryClient.invalidateQueries({ queryKey: ['verification'] });
      setRejecting(null);
      setRejectNote('');
    },
    onError: (error) => toastError('خطا در بررسی مدرک', (error as Error).message),
  });

  return (
    <div>
      <PageHeader
        title="بررسی مدارک تأیید هویت"
        description="مدارک ارسالی آموزشگاه‌ها برای دریافت نشان تأیید"
      />

      {isLoading ? (
        <SkeletonRows rows={5} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BadgeCheck className="h-7 w-7" />}
            title="مدرکی در انتظار بررسی نیست"
            description="همه مدارک بررسی شده‌اند."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((item) => (
            <Card key={item.id}>
              <CardBody className="flex flex-wrap items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">{item.institute_name}</p>
                    <Badge tone="amber">در انتظار بررسی</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {DOC_TYPES_FA[item.doc_type] ?? item.doc_type} · {item.city} · ارسال در{' '}
                    {formatJalaliDateTime(item.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {item.document_url && (
                    <Button variant="outline" size="sm" onClick={() => setDocumentUrl(item.document_url!)}>
                      <Eye className="h-4 w-4" />
                      مشاهده مدرک
                    </Button>
                  )}
                  <Button
                    variant="success"
                    size="sm"
                    loading={reviewMutation.isPending && reviewMutation.variables?.documentId === item.id && reviewMutation.variables?.status === 'VERIFIED'}
                    onClick={() =>
                      reviewMutation.mutate({ documentId: item.id, status: 'VERIFIED' })
                    }
                  >
                    تأیید
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setRejecting({ id: item.id, name: item.institute_name })}
                  >
                    رد
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {/* Document viewer */}
      <Modal open={Boolean(documentUrl)} onClose={() => setDocumentUrl(null)} title="مدرک ارسالی" size="lg">
        {documentUrl && (
          <div className="overflow-hidden rounded-card border border-slate-200">
            {/\.(png|jpe?g|webp|gif)$/i.test(documentUrl) ? (
              <img src={documentUrl} alt="مدرک تأیید هویت" className="w-full object-contain" />
            ) : (
              <iframe src={documentUrl} title="مدرک تأیید هویت" className="h-[60vh] w-full" />
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        onConfirm={() => {
          if (rejecting) reviewMutation.mutate({ documentId: rejecting.id, status: 'REJECTED', note: rejectNote || undefined });
        }}
        title="رد مدرک تأیید هویت"
        message={
          <div className="flex flex-col gap-3">
            <p>
              آیا از رد مدرک <b>{rejecting?.name}</b> مطمئن هستید؟ وضعیت آموزشگاه «رد شده» می‌شود و
              مدیر آن اعلان دریافت می‌کند.
            </p>
            <Textarea
              label="دلیل رد (اختیاری — برای مدیر آموزشگاه ارسال می‌شود)"
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="مثلاً: سند نامعتبر است، تصویر خوانا نیست…"
            />
          </div>
        }
        confirmLabel="رد مدرک"
        loading={reviewMutation.isPending}
      />
    </div>
  );
}
