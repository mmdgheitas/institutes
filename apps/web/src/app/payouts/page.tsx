'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Wallet, CheckCircle2, XCircle, Banknote } from 'lucide-react';
import { finance } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge, hexToTone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Field';
import { PAYOUT_STATUS_FA, PAYOUT_COLORS } from '@/lib/constants';
import { formatIRR, formatJalaliDateTime } from '@/lib/format';
import { toastSuccess, toastError } from '@/stores/toasts';
import type { PayoutStatus } from '@shared/enums';

const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'همه' },
  { value: 'REQUESTED', label: 'درخواست شده' },
  { value: 'APPROVED', label: 'تأیید شده' },
  { value: 'PAID', label: 'پرداخت شده' },
  { value: 'REJECTED', label: 'رد شده' },
];

export default function PayoutsPage() {
  const [status, setStatus] = useState('');
  const [action, setAction] = useState<{ payoutId: string; status: 'APPROVED' | 'PAID' | 'REJECTED'; institute: string; amount: number } | null>(null);
  const [note, setNote] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['finance', 'admin-payouts', status],
    queryFn: () => finance.adminPayouts(status || undefined),
  });

  const processMutation = useMutation({
    mutationFn: ({ payoutId, status: s, note: n }: { payoutId: string; status: 'APPROVED' | 'PAID' | 'REJECTED'; note?: string }) =>
      finance.processPayout(payoutId, { status: s, note: n }),
    onSuccess: (_data, _variables) => {
      toastSuccess('وضعیت تسویه به‌روزرسانی شد');
      queryClient.invalidateQueries({ queryKey: ['finance', 'admin-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'platform-stats'] });
      setAction(null);
      setNote('');
    },
    onError: (error) => toastError('خطا در پردازش تسویه', (error as Error).message),
  });

  const counts = (data ?? []).reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="تسویه‌حساب‌ها"
        description="درخواست‌های تسویه آموزشگاه‌ها — تأیید، پرداخت یا رد"
        actions={
          <Badge tone="blue">
            <Wallet className="h-3.5 w-3.5" />
            {FILTERS.filter((f) => f.value).map((f) => (
              <span key={f.value} className="ms-2">
                {f.label}: {counts[f.value] ?? 0}
              </span>
            ))}
          </Badge>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatus(filter.value)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              status === filter.value
                ? 'bg-primary-600 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {filter.label}
            {filter.value && (
              <span className="ms-1 opacity-70">({counts[filter.value] ?? 0})</span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <SkeletonRows rows={5} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data || data.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Banknote className="h-7 w-7" />}
            title="درخواست تسویه‌ای نیست"
            description="در این وضعیت، درخواستی ثبت نشده است."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((payout) => (
            <Card key={payout.id}>
              <CardBody className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">{payout.institute_name}</p>
                    <Badge tone={hexToTone(PAYOUT_COLORS[payout.status as PayoutStatus])} dot={PAYOUT_COLORS[payout.status as PayoutStatus]}>
                      {PAYOUT_STATUS_FA[payout.status as PayoutStatus]}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    درخواست: {formatJalaliDateTime(payout.created_at)} · شبا:{' '}
                    <span className="font-mono" dir="ltr">{payout.iban ?? '—'}</span>
                  </p>
                </div>
                <p className="text-base font-extrabold text-slate-900">{formatIRR(payout.amount)}</p>
                <div className="flex items-center gap-2">
                  {payout.status === 'REQUESTED' && (
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => setAction({ payoutId: payout.id, status: 'APPROVED', institute: payout.institute_name, amount: payout.amount })}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      تأیید
                    </Button>
                  )}
                  {(payout.status === 'REQUESTED' || payout.status === 'APPROVED') && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => setAction({ payoutId: payout.id, status: 'PAID', institute: payout.institute_name, amount: payout.amount })}
                    >
                      <Banknote className="h-4 w-4" />
                      پرداخت شد
                    </Button>
                  )}
                  {payout.status === 'REQUESTED' && (
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => setAction({ payoutId: payout.id, status: 'REJECTED', institute: payout.institute_name, amount: payout.amount })}
                    >
                      <XCircle className="h-4 w-4" />
                      رد
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(action)}
        onClose={() => setAction(null)}
        onConfirm={() => {
          if (action) processMutation.mutate({ payoutId: action.payoutId, status: action.status, note: note || undefined });
        }}
        danger={action?.status === 'REJECTED'}
        title={
          action?.status === 'APPROVED'
            ? 'تأیید درخواست تسویه'
            : action?.status === 'PAID'
              ? 'ثبت پرداخت تسویه'
              : 'رد درخواست تسویه'
        }
        message={
          <div className="flex flex-col gap-3">
            <p>
              {action?.status === 'APPROVED'
                ? `درخواست تسویه ${formatIRR(action?.amount)} آموزشگاه «${action?.institute}» تأیید شود؟ مبلغ از موجودی قابل برداشت رزرو می‌شود.`
                : action?.status === 'PAID'
                  ? `پرداخت مبلغ ${formatIRR(action?.amount)} به آموزشگاه «${action?.institute}» ثبت شود؟ پس از این، مبلغ از کیف پول کسر می‌شود.`
                  : `درخواست تسویه ${formatIRR(action?.amount)} آموزشگاه «${action?.institute}» رد شود؟`}
            </p>
            <Textarea
              label="یادداشت (اختیاری)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="توضیح برای مدیر آموزشگاه…"
            />
          </div>
        }
        confirmLabel={action?.status === 'APPROVED' ? 'تأیید درخواست' : action?.status === 'PAID' ? 'ثبت پرداخت' : 'رد درخواست'}
        loading={processMutation.isPending}
      />
    </div>
  );
}
