'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ShieldCheck, RefreshCcw, Pencil } from 'lucide-react';
import { useSession } from '@/stores/session';
import { auth } from '@/lib/api/endpoints';
import { getRefreshToken, clearTokens } from '@/lib/auth/tokens';
import { disconnectSocket } from '@/lib/realtime/socket';
import { useQueryClient } from '@tanstack/react-query';
import { Dropdown } from '@/components/ui/Dropdown';
import { Avatar } from '@/components/ui/Avatar';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { USER_ROLE_FA } from '@/lib/constants';
import { validateEmail } from '@/lib/validation';
import { toastSuccess, toastError, errorMessage } from '@/stores/toasts';

export function ProfileMenu() {
  const { user, clear, setUser } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ fullName: '', email: '' });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const openEdit = () => {
    setEditForm({ fullName: user.fullName, email: user.email ?? '' });
    setEditErrors({});
    setEditOpen(true);
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (editForm.fullName.trim().length < 2) nextErrors.fullName = 'نام کامل حداقل ۲ کاراکتر است';
    if (editForm.email.trim()) {
      const emailError = validateEmail(editForm.email.trim());
      if (emailError) nextErrors.email = emailError;
    }
    setEditErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const updated = await auth.updateMe({
        fullName: editForm.fullName.trim(),
        email: editForm.email.trim() || undefined,
      });
      setUser(updated);
      toastSuccess('پروفایل به‌روزرسانی شد');
      setEditOpen(false);
    } catch (error) {
      toastError('خطا در ذخیره پروفایل', errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

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
            id: 'edit',
            label: (
              <span className="inline-flex items-center gap-2">
                <Pencil className="h-4 w-4" />
                ویرایش پروفایل
              </span>
            ),
            onSelect: openEdit,
          },
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

      {/* Profile editor */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="ویرایش پروفایل" size="sm">
        <form onSubmit={saveProfile} className="flex flex-col gap-4">
          <Input
            label="نام و نام خانوادگی"
            required
            autoFocus
            value={editForm.fullName}
            error={editErrors.fullName}
            onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
          />
          <Input
            label="ایمیل"
            latin
            type="email"
            value={editForm.email}
            error={editErrors.email}
            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            placeholder="example@mail.com"
          />
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" loading={saving}>
              ذخیره
            </Button>
          </div>
        </form>
      </Modal>

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
