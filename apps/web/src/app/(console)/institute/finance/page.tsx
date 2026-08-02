'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {Wallet, TrendingUp, Percent, PiggyBank, Plus} from 'lucide-react';
import { finance } from '@/lib/api/endpoints';
import { InstituteScope, useInstituteId } from '@/components/console/InstituteScope';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import {EmptyState} from '@/components/ui/States';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Table, THead, Th, Td, TRow } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { RevenueChart } from '@/components/finance/RevenueChart';
import { PAYOUT_STATUS_FA, PAYOUT_COLORS, TRANSACTION_TYPE_FA, TRANSACTION_COLORS } from '@/lib/constants';
import { Badge, hexToTone } from '@/components/ui/Badge';
import {formatIRR, formatIRRCompact, formatJalaliDateTime} from '@/lib/format';
import { validateIban } from '@/lib/validation';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';

export default function FinancePage() {
  const instituteId = useInstituteId();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutForm, setPayoutForm] = useState({ amount: '', iban: '' });
  const [payoutErrors, setPayoutErrors] = useState<Record<string, string>>({});

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['finance', 'wallet', instituteId],
    queryFn: () => finance.wallet(instituteId!),
    enabled: Boolean(instituteId),
  });

  const { data: transactions, isLoading: txLoading } = useQuery({
    queryKey: ['finance', 'transactions', instituteId, page],
    queryFn: () => finance.transactions(instituteId!, { page, pageSize: 15 }),
    enabled: Boolean(instituteId),
  });

  const { data: revenue } = useQuery({
    queryKey: ['finance', 'revenue', instituteId, 12],
    queryFn: () => finance.revenue(instituteId!, 12),
    enabled: Boolean(instituteId),
  });

  const { data: payouts, isLoading: payoutsLoading } = useQuery({
    queryKey: ['finance', 'payouts', instituteId],
    queryFn: () => finance.payouts(instituteId!),
    enabled: Boolean(instituteId),
  });

  const payoutMutation = useMutation({
    mutationFn: () =>
      finance.requestPayout(instituteId!, {
        amount: Number(payoutForm.amount),
        iban: payoutForm.iban.replace(/\s/g, '') || undefined,
      }),
    onSuccess: () => {
      toastSuccess('درخواست تسویه ثبت شد');
      queryClient.invalidateQueries({ queryKey: ['finance', 'wallet', instituteId] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'payouts', instituteId] });
      setPayoutOpen(false);
      setPayoutForm({ amount: '', iban: '' });
    },
    onError: (error) => toastError('درخواست تسویه ثبت نشد', errorMessage(error)),
  });

  const requestPayout = (event: React.FormEvent) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    const amount = Number(payoutForm.amount);
    if (!amount || amount <= 0) errors.amount = 'مبلغ معتبر وارد کنید';
    else if (wallet && amount > wallet.availableBalance) {
      errors.amount = `موجودی قابل برداشت ${formatIRR(wallet.availableBalance)} است`;
    }
    if (payoutForm.iban.trim()) {
      const ibanError = validateIban(payoutForm.iban);
      if (ibanError) errors.iban = ibanError;
    }
    setPayoutErrors(errors);
    if (Object.keys(errors).length > 0) return;
    payoutMutation.mutate();
  };

  return (
    <InstituteScope>
      <PageHeader
        title="مالی و تسویه"
        description="کیف پول، تراکنش‌ها، درآمد و درخواست تسویه"
        actions={
          <Button onClick={() => setPayoutOpen(true)} disabled={!wallet || wallet.availableBalance <= 0}>
            <Plus className="h-4 w-4" />
            درخواست تسویه
          </Button>
        }
      />

      {walletLoading ? (
        <SkeletonRows rows={3} />
      ) : !wallet ? (
        <Card>
          <EmptyState title="کیف پول در دسترس نیست" />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardBody className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">درآمد ناخالص</p>
                  <p className="text-lg font-extrabold text-slate-900">{formatIRRCompact(wallet.grossRevenue)}</p>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                  <Percent className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">کارمزد سامانه</p>
                  <p className="text-lg font-extrabold text-slate-900">{formatIRRCompact(wallet.commissionPaid)}</p>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-green-600">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">موجودی قابل برداشت</p>
                  <p className="text-lg font-extrabold text-success-700">{formatIRRCompact(wallet.availableBalance)}</p>
                  <p className="text-[11px] text-slate-400">{formatIRR(wallet.netEarnings)} درآمد خالص</p>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <PiggyBank className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">در انتظار / پرداخت‌شده</p>
                  <p className="text-lg font-extrabold text-slate-900">
                    {formatIRRCompact(wallet.pendingPayout)} / {formatIRRCompact(wallet.paidOut)}
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>

          {revenue && revenue.length > 0 && (
            <Card>
              <CardHeader title="روند درآمد ۱۲ ماه" description="درآمد ناخالص، کارمزد و درآمد خالص" />
              <CardBody>
                <RevenueChart data={revenue} />
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader
              title="تراکنش‌های کیف پول"
              description="دفتر کل مالی آموزشگاه"
            />
            <CardBody className="p-0">
              {txLoading ? (
                <div className="p-4">
                  <SkeletonRows rows={4} />
                </div>
              ) : !transactions || transactions.items.length === 0 ? (
                <EmptyState title="تراکنشی ثبت نشده" />
              ) : (
                <>
                  <Table>
                    <THead>
                      <Th>تاریخ</Th>
                      <Th>نوع</Th>
                      <Th>شرح</Th>
                      <Th>مبلغ</Th>
                      <Th>وضعیت تسویه</Th>
                    </THead>
                    <tbody>
                      {transactions.items.map((transaction) => (
                        <TRow key={transaction.id}>
                          <Td className="whitespace-nowrap text-xs">{formatJalaliDateTime(transaction.created_at)}</Td>
                          <Td>
                            <Badge tone={hexToTone(TRANSACTION_COLORS[transaction.type])} dot={TRANSACTION_COLORS[transaction.type]}>
                              {TRANSACTION_TYPE_FA[transaction.type]}
                            </Badge>
                          </Td>
                          <Td className="max-w-72 truncate text-xs text-slate-500">{transaction.description ?? '—'}</Td>
                          <Td
                            className={`whitespace-nowrap font-bold ${
                              transaction.amount >= 0 ? 'text-success-700' : 'text-danger-600'
                            }`}
                          >
                            {transaction.amount >= 0 ? '+' : ''}
                            {formatIRR(transaction.amount)}
                          </Td>
                          <Td className="text-xs">{PAYOUT_STATUS_FA[transaction.payout_status]}</Td>
                        </TRow>
                      ))}
                    </tbody>
                  </Table>
                  <div className="px-3">
                    <Pagination page={page} pageSize={15} total={transactions.total} onPageChange={setPage} />
                  </div>
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="درخواست‌های تسویه" description="تاریخچه تسویه‌حساب‌های آموزشگاه" />
            <CardBody className="p-0">
              {payoutsLoading ? (
                <div className="p-4">
                  <SkeletonRows rows={3} />
                </div>
              ) : !payouts || payouts.length === 0 ? (
                <EmptyState title="درخواست تسویه‌ای ثبت نشده" />
              ) : (
                <Table>
                  <THead>
                    <Th>تاریخ</Th>
                    <Th>مبلغ</Th>
                    <Th>شبا</Th>
                    <Th>وضعیت</Th>
                    <Th>یادداشت</Th>
                  </THead>
                  <tbody>
                    {payouts.map((payout) => (
                      <TRow key={payout.id}>
                        <Td className="whitespace-nowrap text-xs">{formatJalaliDateTime(payout.created_at)}</Td>
                        <Td className="font-bold">{formatIRR(payout.amount)}</Td>
                        <Td className="font-mono text-xs">
                          <span dir="ltr">{payout.iban ?? '—'}</span>
                        </Td>
                        <Td>
                          <Badge tone={hexToTone(PAYOUT_COLORS[payout.status])} dot={PAYOUT_COLORS[payout.status]}>
                            {PAYOUT_STATUS_FA[payout.status]}
                          </Badge>
                        </Td>
                        <Td className="max-w-48 truncate text-xs text-slate-500">{payout.note ?? '—'}</Td>
                      </TRow>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      <Modal
        open={payoutOpen}
        onClose={() => setPayoutOpen(false)}
        title="درخواست تسویه حساب"
        description={`موجودی قابل برداشت: ${formatIRR(wallet?.availableBalance)}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setPayoutOpen(false)}>
              انصراف
            </Button>
            <Button onClick={() => (document.getElementById('payout-form') as HTMLFormElement | null)?.requestSubmit()} loading={payoutMutation.isPending}>
              ثبت درخواست
            </Button>
          </>
        }
      >
        <form id="payout-form" onSubmit={requestPayout} className="flex flex-col gap-4">
          <Input
            label="مبلغ (تومان)"
            latin
            type="number"
            min={1}
            value={payoutForm.amount}
            error={payoutErrors.amount}
            onChange={(e) => setPayoutForm({ ...payoutForm, amount: e.target.value })}
            placeholder={wallet ? String(wallet.availableBalance) : '0'}
          />
          <Input
            label="شماره شبا (اختیاری — بدون IR وارد نشود)"
            latin
            value={payoutForm.iban}
            error={payoutErrors.iban}
            onChange={(e) => setPayoutForm({ ...payoutForm, iban: e.target.value })}
            placeholder="IR820540102680020817909002"
          />
          <p className="text-xs leading-5 text-slate-400">
            پس از تأیید مدیر سامانه، مبلغ از موجودی رزرو شده و پس از پرداخت از کیف پول کسر می‌شود.
          </p>
        </form>
      </Modal>
    </InstituteScope>
  );
}
