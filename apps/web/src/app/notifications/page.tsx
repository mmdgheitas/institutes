'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { notifications as notificationsApi } from '@/lib/api/endpoints';
import { Card, CardBody } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { formatJalaliDateTime } from '@/lib/format';
import { clsx } from 'clsx';
import { toastSuccess } from '@/stores/toasts';

const KIND_LABELS: Record<string, string> = {
  SYSTEM: 'سیستمی',
  VERIFICATION: 'تأیید هویت',
  PAYOUT: 'تسویه‌حساب',
  LEAD: 'لید',
  ENROLLMENT: 'ثبت‌نام',
};

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications', 'list', page],
    queryFn: () => notificationsApi.list({ page, pageSize: 20 }),
  });

  const markAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toastSuccess('همه اعلان‌ها خوانده شد');
    } catch {
      /* toast handled by caller */
    }
  };

  const markRead = async (id: string) => {
    try {
      await notificationsApi.markRead(id);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    } catch {
      /* ignore */
    }
  };

  return (
    <div>
      <PageHeader
        title="اعلان‌ها"
        description="پیام‌های سیستم، تأیید مدارک، تسویه‌حساب و رویدادهای لید"
        actions={
          <Button variant="outline" size="sm" onClick={() => void markAllRead()}>
            <CheckCheck className="h-4 w-4" />
            خواندن همه
          </Button>
        }
      />

      {isLoading ? (
        <SkeletonRows rows={6} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !data || data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bell className="h-7 w-7" />}
            title="اعلانی ندارید"
            description="وقتی رویداد جدیدی رخ دهد، اینجا پیام می‌بینید."
          />
        </Card>
      ) : (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-slate-100">
              {data.items.map((notification) => (
                <li
                  key={notification.id}
                  className={clsx(
                    'flex items-start gap-3 px-5 py-4',
                    !notification.read_at && 'bg-primary-50/40',
                  )}
                >
                  <div
                    className={clsx(
                      'mt-1 h-2.5 w-2.5 shrink-0 rounded-full',
                      notification.read_at ? 'bg-slate-200' : 'bg-primary-600',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-bold text-slate-800">{notification.title}</p>
                      <span className="text-[11px] text-slate-400">
                        {formatJalaliDateTime(notification.created_at)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{notification.body}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
                        {KIND_LABELS[notification.kind] ?? notification.kind}
                      </span>
                      {!notification.read_at && (
                        <button
                          onClick={() => void markRead(notification.id)}
                          className="text-[11px] text-primary-600 hover:underline"
                        >
                          علامت‌گذاری به‌عنوان خوانده‌شده
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
          <div className="border-t border-slate-100 px-4">
            <Pagination page={page} pageSize={20} total={data.total} onPageChange={setPage} />
          </div>
        </Card>
      )}
    </div>
  );
}
