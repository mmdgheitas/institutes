'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {LogOut, ShieldCheck, RefreshCcw} from 'lucide-react';
import { useSession } from '@/stores/session';
import { auth } from '@/lib/api/endpoints';
import { getRefreshToken, clearTokens } from '@/lib/auth/tokens';
import { disconnectSocket } from '@/lib/realtime/socket';
import { useQueryClient } from '@tanstack/react-query';
import { Dropdown } from '@/components/ui/Dropdown';
import { Avatar } from '@/components/ui/Avatar';
import { USER_ROLE_FA } from '@/lib/constants';
import { ConfirmDialog } from '@/components/ui/Modal';

export function ProfileMenu() {
  const { user, clear } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);

  if (!user) return null;

  const logout = async () => {
    const refresh = getRefreshToken();
    try {
      if (refresh) await auth.logout(refresh);
    } catch {
      /* best effort — clear locally regardless */
    }
    clearTokens();
    clear();
    disconnectSocket();
    queryClient.clear();
    router.replace('/login');
  };

  const logoutAll = async () => {
    try {
      await auth.logoutAll();
    } catch {
      /* best effort */
    }
    clearTokens();
    clear();
    disconnectSocket();
    queryClient.clear();
    router.replace('/login');
  };

  return (
    <>
      <Dropdown
        width="w-64"
        trigger={
          <button className="flex items-center gap-2 rounded-full p-1 transition-colors hover:bg-slate-100" aria-label="منوی حساب کاربری">
            <Avatar name={user.fullName} src={user.avatarUrl} size={34} />
          </button>
        }
        items={[
          {
            id: 'identity',
            label: (
              <div className="py-0.5">
                <p className="truncate text-sm font-bold text-slate-800">{user.fullName}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {USER_ROLE_FA[user.role]}
                  <span className="font-mono" dir="ltr">· {user.phone}</span>
                </p>
              </div>
            ),
            disabled: true,
          },
          { id: 'div1', label: '', divider: true, disabled: true },
          {
            id: 'logout',
            label: (
              <span className="inline-flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                خروج از حساب
              </span>
            ),
            danger: true,
            onSelect: () => void logout(),
          },
          {
            id: 'logout-all',
            label: (
              <span className="inline-flex items-center gap-2">
                <RefreshCcw className="h-4 w-4" />
                خروج از همه دستگاه‌ها
              </span>
            ),
            danger: true,
            onSelect: () => setLogoutAllOpen(true),
          },
        ]}
      />

      <ConfirmDialog
        open={logoutAllOpen}
        onClose={() => setLogoutAllOpen(false)}
        onConfirm={() => void logoutAll()}
        title="خروج از همه دستگاه‌ها"
        message="همه نشست‌های این حساب در همه دستگاه‌ها باطل می‌شود. ادامه می‌دهید؟"
        confirmLabel="بله، خروج از همه"
      />
    </>
  );
}
