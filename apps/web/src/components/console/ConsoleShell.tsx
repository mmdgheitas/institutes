'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Building2,
  BadgeCheck,
  Wallet,
  GraduationCap,
  DoorOpen,
  CalendarDays,
  ClipboardList,
  Clock,
  KanbanSquare,
  Image as ImageIcon,
  Users,
  Star,
  Landmark,
  FileText,
  Menu,
  X,
  GraduationCap as Logo,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useSession } from '@/stores/session';
import { useActiveInstitute } from '@/stores/activeInstitute';
import { institutes as institutesApi } from '@/lib/api/endpoints';
import { InstituteSwitcher } from './InstituteSwitcher';
import { NotificationBell } from './NotificationBell';
import { ProfileMenu } from './ProfileMenu';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** Visible to these roles; undefined = all authenticated roles. */
  roles?: string[];
  /** Only when an institute is selected (admin/teacher areas). */
  needsInstitute?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'داشبورد', icon: <LayoutDashboard className="h-5 w-5" /> },
  {
    href: '/institutes',
    label: 'مؤسسات',
    icon: <Building2 className="h-5 w-5" />,
    roles: ['SUPER_ADMIN'],
  },
  {
    href: '/verification',
    label: 'بررسی مدارک',
    icon: <BadgeCheck className="h-5 w-5" />,
    roles: ['SUPER_ADMIN'],
  },
  {
    href: '/payouts',
    label: 'تسویه‌حساب‌ها',
    icon: <Wallet className="h-5 w-5" />,
    roles: ['SUPER_ADMIN'],
  },
  { href: '/institute/profile', label: 'مشخصات آموزشگاه', icon: <Building2 className="h-5 w-5" />, roles: ['INSTITUTE_ADMIN'], needsInstitute: true },
  { href: '/institute/courses', label: 'دوره‌ها', icon: <GraduationCap className="h-5 w-5" />, roles: ['INSTITUTE_ADMIN', 'TEACHER'], needsInstitute: true },
  { href: '/institute/classrooms', label: 'کلاس‌ها', icon: <DoorOpen className="h-5 w-5" />, roles: ['INSTITUTE_ADMIN'], needsInstitute: true },
  { href: '/institute/timetable', label: 'زمان‌بندی هفتگی', icon: <CalendarDays className="h-5 w-5" />, roles: ['INSTITUTE_ADMIN'], needsInstitute: true },
  { href: '/institute/forms', label: 'فرم‌های پیش‌ثبت‌نام', icon: <ClipboardList className="h-5 w-5" />, roles: ['INSTITUTE_ADMIN'], needsInstitute: true },
  { href: '/institute/slots', label: 'بازه‌های زمانی', icon: <Clock className="h-5 w-5" />, roles: ['INSTITUTE_ADMIN'], needsInstitute: true },
  { href: '/institute/leads', label: 'لیدها (CRM)', icon: <KanbanSquare className="h-5 w-5" />, roles: ['INSTITUTE_ADMIN'], needsInstitute: true },
  { href: '/institute/media', label: 'رسانه‌ها', icon: <ImageIcon className="h-5 w-5" />, roles: ['INSTITUTE_ADMIN'], needsInstitute: true },
  { href: '/institute/instructors', label: 'اساتید', icon: <Users className="h-5 w-5" />, roles: ['INSTITUTE_ADMIN'], needsInstitute: true },
  { href: '/institute/reviews', label: 'نظرات', icon: <Star className="h-5 w-5" />, roles: ['INSTITUTE_ADMIN'], needsInstitute: true },
  { href: '/institute/finance', label: 'مالی و تسویه', icon: <Landmark className="h-5 w-5" />, roles: ['INSTITUTE_ADMIN'], needsInstitute: true },
  { href: '/notifications', label: 'اعلان‌ها', icon: <FileText className="h-5 w-5" /> },
];

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useSession();
  const { instituteId, setInstituteId } = useActiveInstitute();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Load the admin's institutes once; auto-select the first one so the
  // dashboard and every scoped page have a working institute immediately.
  const { data: myInstitutes } = useQuery({
    queryKey: ['institutes', 'mine'],
    queryFn: () => institutesApi.mine(),
    enabled: user?.role === 'INSTITUTE_ADMIN',
  });

  useEffect(() => {
    if (user?.role === 'INSTITUTE_ADMIN' && myInstitutes && myInstitutes.length > 0 && !instituteId) {
      setInstituteId(myInstitutes[0].id);
    }
  }, [user?.role, myInstitutes, instituteId, setInstituteId]);

  const visibleItems = useMemo(() => {
    if (!user) return [];
    return NAV_ITEMS.filter((item) => {
      if (item.roles && !item.roles.includes(user.role)) return false;
      return true;
    });
  }, [user]);

  const active = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  };
  // Dashboard is the entry point after login (the root path redirects there),
  // so it must highlight when the sidebar's active page is the dashboard.
  const isDashboard = pathname === '/' || pathname === '/dashboard';

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-slate-800 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white">
          <Logo className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-white">سامانه آموزشگاه‌ها</p>
          <p className="text-[11px] text-slate-400">پنل مدیریت</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="ناوبری اصلی">
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setSidebarOpen(false)}
            className={clsx(
              'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors',
              (item.href === '/dashboard' ? isDashboard : active(item.href))
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white',
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="border-t border-slate-800 px-5 py-4">
        <p className="text-[11px] leading-5 text-slate-500">
          نسخه ۱٫۰ — سامانه مدیریت آموزشگاه‌ها
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-64 bg-slate-900 lg:block">{sidebar}</aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute inset-y-0 start-0 w-72 bg-slate-900 shadow-pop">{sidebar}</aside>
          <button
            className="absolute top-4 end-4 rounded-lg bg-white/10 p-2 text-white"
            onClick={() => setSidebarOpen(false)}
            aria-label="بستن منو"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="lg:ps-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="باز کردن منو"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1">
            {user?.role === 'INSTITUTE_ADMIN' && <InstituteSwitcher />}
            {user?.role === 'TEACHER' && (
              <p className="text-sm font-semibold text-slate-700">دوره‌های من</p>
            )}
            {user?.role === 'SUPER_ADMIN' && (
              <p className="text-sm font-semibold text-slate-700">کنسول مدیر سامانه</p>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <NotificationBell />
            <ProfileMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
