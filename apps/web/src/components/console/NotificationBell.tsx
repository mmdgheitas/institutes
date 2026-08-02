'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { notifications as notificationsApi } from '@/lib/api/endpoints';
import { connectSocket, onSocketEvent } from '@/lib/realtime/socket';
import { Dropdown } from '@/components/ui/Dropdown';
import { formatRelative } from '@/lib/format';
import { useSession } from '@/stores/session';

export function NotificationBell() {
  const { user } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 60_000,
  });

  const { data: recent } = useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => notificationsApi.list({ page: 1, pageSize: 6 }),
  });

  // Live push + bell badge refresh.
  useEffect(() => {
    if (!user) return;
    const socket = connectSocket();
    const off = onSocketEvent('notification', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });
    return () => {
      off();
      void socket;
    };
  }, [user, queryClient]);

  const count = unread?.count ?? 0;

  return (
    <Dropdown
      width="w-80"
      trigger={
        <button
          className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label={`اعلان‌ها${count > 0 ? ` (${count} خوانده‌نشده)` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -top-0.5 -end-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-bold text-white">
              {count > 99 ? '۹۹+' : count}
            </span>
          )}
        </button>
      }
      items={[
        ...(recent?.items ?? []).map((notification) => ({
          id: notification.id,
          label: (
            <div className="min-w-0 py-0.5">
              <p className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-800">
                <span className="truncate">{notification.title}</span>
                <span className="shrink-0 text-[10px] font-normal text-slate-400">
                  {formatRelative(notification.created_at)}
                </span>
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">{notification.body}</p>
            </div>
          ),
          onSelect: () => {
            void notificationsApi.markRead(notification.id).then(() => {
              queryClient.invalidateQueries({ queryKey: ['notifications'] });
              router.push('/notifications');
            });
          },
        })),
        {
          id: 'actions',
          divider: true,
          label: (
            <span className="inline-flex w-full items-center justify-between">
              <span className="text-slate-500">مشاهده همه اعلان‌ها</span>
              <CheckCheck className="h-4 w-4 text-slate-400" />
            </span>
          ),
          onSelect: () => router.push('/notifications'),
        },
      ]}
    />
  );
}
