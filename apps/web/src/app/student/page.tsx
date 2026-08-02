'use client';

import Link from 'next/link';
import { GraduationCap, Smartphone, LogOut } from 'lucide-react';
import { useSession } from '@/stores/session';
import { clearTokens } from '@/lib/auth/tokens';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { disconnectSocket } from '@/lib/realtime/socket';

/** Students use the mobile app — the web console has no student surfaces. */
export default function StudentNoticePage() {
  const { user, clear } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  const logout = () => {
    clearTokens();
    clear();
    disconnectSocket();
    queryClient.clear();
    router.replace('/login');
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 p-4">
      <div className="w-full max-w-lg rounded-card border border-slate-200 bg-white p-8 text-center shadow-card">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-lg shadow-primary-600/30">
          <GraduationCap className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-xl font-extrabold text-slate-900">
          سلام {user?.fullName ?? 'کاربر عزیز'} 👋
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          این حساب کاربری یک <b>حساب دانش‌آموزی</b> است. سرویس‌های دانش‌آموزی
          (جستجوی آموزشگاه‌ها روی نقشه، پیش‌ثبت‌نام، دوره‌ها و آزمون‌های آنلاین)
          از طریق <b>اپلیکیشن موبایل</b> در دسترس هستند.
        </p>

        <div className="mt-6 flex items-center gap-3 rounded-card bg-slate-50 p-4 text-start">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
            <Smartphone className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">اپلیکیشن موبایل</p>
            <p className="mt-0.5 text-xs leading-5 text-slate-500">
              با همان شماره موبایل و رمز عبور خود وارد شوید.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/"
            className="inline-flex h-11 flex-1 items-center justify-center rounded-control border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            بازگشت
          </Link>
          <button
            onClick={logout}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-control bg-danger-600 text-sm font-semibold text-white transition-colors hover:bg-danger-700"
          >
            <LogOut className="h-4 w-4" />
            خروج از حساب
          </button>
        </div>
      </div>
    </main>
  );
}
