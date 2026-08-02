'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Users,
  GraduationCap,
  Star,
  CalendarClock,
  Wallet,
  TrendingUp,
  Building2,
  UserPlus,
  Percent,
  Activity,
} from 'lucide-react';
import { crm, courses, finance, institutes as institutesApi, liveClasses } from '@/lib/api/endpoints';
import { useSession } from '@/stores/session';
import { useActiveInstitute } from '@/stores/activeInstitute';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState, EmptyState } from '@/components/ui/States';
import {formatIRRCompact, formatNumber, formatPercent} from '@/lib/format';
import { RevenueChart } from '@/components/finance/RevenueChart';

import { Badge } from '@/components/ui/Badge';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { COURSE_TYPE_FA } from '@/lib/constants';
import { formatJalaliDateTime } from '@/lib/format';

function StatCard({
  title,
  value,
  icon,
  tone = 'blue',
  sub,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  tone?: 'blue' | 'green' | 'amber' | 'violet' | 'cyan' | 'red';
  sub?: string;
}) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
    cyan: 'bg-cyan-50 text-cyan-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <Card>
      <CardBody className="flex items-start gap-4">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{title}</p>
          <p className="mt-1 text-xl font-extrabold text-slate-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
        </div>
      </CardBody>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useSession();
  const { instituteId } = useActiveInstitute();

  const superStats = useQuery({
    queryKey: ['finance', 'platform-stats'],
    queryFn: () => finance.platformStats(),
    enabled: user?.role === 'SUPER_ADMIN',
  });

  const instituteStats = useQuery({
    queryKey: ['crm', 'stats', instituteId],
    queryFn: () => crm.stats(instituteId!),
    enabled: user?.role === 'INSTITUTE_ADMIN' && Boolean(instituteId),
  });

  const revenue = useQuery({
    queryKey: ['finance', 'revenue', instituteId, 12],
    queryFn: () => finance.revenue(instituteId!, 12),
    enabled: user?.role === 'INSTITUTE_ADMIN' && Boolean(instituteId),
  });

  const mine = useQuery({
    queryKey: ['institutes', 'mine'],
    queryFn: () => institutesApi.mine(),
    enabled: user?.role === 'INSTITUTE_ADMIN',
  });

  // Super admin console
  if (user?.role === 'SUPER_ADMIN') {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">داشبورد سامانه</h1>
          <p className="mt-1 text-sm text-slate-500">نمای کلی فعالیت کل پلتفرم</p>
        </div>

        {superStats.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : superStats.isError ? (
          <ErrorState onRetry={() => superStats.refetch()} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="حجم ناخالص تراکنش‌ها"
              value={formatIRRCompact(superStats.data?.totalGrossVolume)}
              icon={<TrendingUp className="h-5 w-5" />}
              tone="blue"
            />
            <StatCard
              title="کارمزد سامانه"
              value={formatIRRCompact(superStats.data?.totalCommission)}
              icon={<Percent className="h-5 w-5" />}
              tone="violet"
            />
            <StatCard
              title="آموزشگاه‌های منتشرشده"
              value={formatNumber(superStats.data?.publishedInstitutes)}
              icon={<Building2 className="h-5 w-5" />}
              tone="green"
            />
            <StatCard
              title="کل ثبت‌نام‌ها"
              value={formatNumber(superStats.data?.totalEnrollments)}
              icon={<GraduationCap className="h-5 w-5" />}
              tone="cyan"
            />
          </div>
        )}
      </div>
    );
  }

  // Teacher dashboard: the courses they teach + upcoming live sessions.
  if (user?.role === 'TEACHER') {
    return <TeacherDashboard />;
  }

  // Institute admin dashboard
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">داشبورد آموزشگاه</h1>
        <p className="mt-1 text-sm text-slate-500">
          {mine.data?.[0]?.name ?? 'نمای کلی عملکرد آموزشگاه شما'}
        </p>
      </div>

      {!instituteId ? (
        <Card>
          <EmptyState
            title="آموزشگاهی انتخاب نشده است"
            description="از منوی بالای صفحه، آموزشگاه مورد نظر را انتخاب کنید."
          />
        </Card>
      ) : instituteStats.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : instituteStats.isError ? (
        <ErrorState onRetry={() => instituteStats.refetch()} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="کل لیدها"
              value={formatNumber(instituteStats.data?.totalLeads)}
              icon={<UserPlus className="h-5 w-5" />}
              tone="blue"
              sub={`${formatNumber(instituteStats.data?.newLeadsThisWeek)} لید جدید این هفته`}
            />
            <StatCard
              title="نرخ تبدیل"
              value={formatPercent(instituteStats.data?.conversionRate)}
              icon={<Activity className="h-5 w-5" />}
              tone="green"
            />
            <StatCard
              title="دانش‌آموزان فعال"
              value={formatNumber(instituteStats.data?.activeStudents)}
              icon={<Users className="h-5 w-5" />}
              tone="violet"
            />
            <StatCard
              title="دوره‌های فعال"
              value={formatNumber(instituteStats.data?.activeCourses)}
              icon={<GraduationCap className="h-5 w-5" />}
              tone="cyan"
            />
            <StatCard
              title="درآمد این ماه"
              value={formatIRRCompact(instituteStats.data?.revenueThisMonth)}
              icon={<Wallet className="h-5 w-5" />}
              tone="green"
            />
            <StatCard
              title="میانگین امتیاز"
              value={formatNumber(instituteStats.data?.averageRating)}
              icon={<Star className="h-5 w-5" />}
              tone="amber"
            />
            <StatCard
              title="جلسات آنلاین پیش رو"
              value={formatNumber(instituteStats.data?.upcomingSessions)}
              icon={<CalendarClock className="h-5 w-5" />}
              tone="red"
            />
          </div>

          {revenue.data && revenue.data.length > 0 && (
            <Card>
              <CardHeader
                title="روند درآمد ۱۲ ماه اخیر"
                description="درآمد ناخالص، کارمزد سامانه و درآمد خالص"
              />
              <CardBody>
                <RevenueChart data={revenue.data} />
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function TeacherDashboard() {
  const myCourses = useQuery({
    queryKey: ['courses', 'mine'],
    queryFn: () => courses.mine(),
  });

  const mySessions = useQuery({
    queryKey: ['live-classes', 'mine'],
    queryFn: () => liveClasses.mine(),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">داشبورد مدرس</h1>
        <p className="mt-1 text-sm text-slate-500">دوره‌ها و جلسات آنلاین شما</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="دوره‌های من"
            description="دوره‌هایی که تدریس می‌کنید"
          />
          <CardBody className="flex flex-col gap-2">
            {myCourses.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : myCourses.isError ? (
              <ErrorState onRetry={() => myCourses.refetch()} />
            ) : !myCourses.data || myCourses.data.length === 0 ? (
              <EmptyState title="دوره‌ای به شما اختصاص داده نشده" description="مدیر آموزشگاه باید شما را به یک دوره متصل کند." />
            ) : (
              myCourses.data.map((course) => (
                <Link key={course.id} href={`/institute/courses/${course.id}`}>
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3.5 py-3 transition-colors hover:border-primary-200 hover:bg-primary-50/40">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{course.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {COURSE_TYPE_FA[course.type]}
                      </p>
                    </div>
                    <ArrowLeft className="h-4 w-4 shrink-0 text-slate-400" />
                  </div>
                </Link>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="جلسات آنلاین پیش رو" description="برنامه جلسات زنده شما" />
          <CardBody className="flex flex-col gap-2">
            {mySessions.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : mySessions.isError ? (
              <ErrorState onRetry={() => mySessions.refetch()} />
            ) : !mySessions.data || mySessions.data.length === 0 ? (
              <EmptyState title="جلسه‌ای برنامه‌ریزی نشده" />
            ) : (
              mySessions.data.slice(0, 6).map((session) => (
                <div key={session.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3.5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{session.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{formatJalaliDateTime(session.startsAt)}</p>
                  </div>
                  {session.isLive && <Badge tone="green">در حال برگزاری</Badge>}
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
