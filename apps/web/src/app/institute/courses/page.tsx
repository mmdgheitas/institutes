'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, Plus, Users } from 'lucide-react';
import { courses as coursesApi } from '@/lib/api/endpoints';
import { useSession } from '@/stores/session';
import { InstituteScope, useInstituteId } from '@/components/console/InstituteScope';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { COURSE_TYPE_FA, COURSE_LEVEL_FA } from '@/lib/constants';
import { formatIRRCompact, formatNumber, toPersianDigits } from '@/lib/format';

export default function CoursesPage() {
  const instituteId = useInstituteId();
  const { user } = useSession();
  const isTeacher = user?.role === 'TEACHER';

  const { data: courses, isLoading, isError, refetch } = useQuery({
    queryKey: isTeacher ? ['courses', 'mine'] : ['courses', 'list', instituteId],
    queryFn: () => (isTeacher ? coursesApi.mine() : coursesApi.list(instituteId!)),
    enabled: isTeacher || Boolean(instituteId),
  });

  return (
    <InstituteScope>
      <PageHeader
        title={isTeacher ? 'دوره‌های من' : 'دوره‌ها'}
        description={
          isTeacher
            ? 'دوره‌هایی که تدریس می‌کنید — آزمون‌ها، مواد درسی و جلسات آنلاین'
            : 'مدیریت دوره‌های آموزشی، آزمون‌ها، جلسات و مواد درسی'
        }
        actions={
          !isTeacher && (
            <Link href="/institute/courses/new">
              <Button>
                <Plus className="h-4 w-4" />
                دوره جدید
              </Button>
            </Link>
          )
        }
      />

      {isLoading ? (
        <SkeletonCards />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !courses || courses.length === 0 ? (
        <Card>
          <EmptyState
            icon={<GraduationCap className="h-7 w-7" />}
            title="دوره‌ای ثبت نشده"
            description="اولین دوره آموزشی آموزشگاه را ایجاد کنید."
            action={
              <Link href="/institute/courses/new">
                <Button size="sm">
                  <Plus className="h-4 w-4" />
                  ایجاد دوره
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.map((course) => (
            <Link key={course.id} href={`/institute/courses/${course.id}`}>
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-pop">
                <CardBody className="flex h-full flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-bold leading-6 text-slate-900">{course.title}</p>
                    <Badge tone={course.effectivePrice < course.price ? 'green' : 'slate'}>
                      {course.discountPercent > 0 ? `${toPersianDigits(course.discountPercent)}٪ تخفیف` : 'بدون تخفیف'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="blue">{COURSE_TYPE_FA[course.type]}</Badge>
                    <Badge tone="violet">{COURSE_LEVEL_FA[course.level]}</Badge>
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                    <span className="font-bold text-slate-800">{formatIRRCompact(course.effectivePrice)}</span>
                    <span className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {formatNumber(course.enrolledCount)}/{formatNumber(course.capacity)}
                      </span>
                      <span className="text-success-600">{formatNumber(course.seatsLeft)} جای باقی‌مانده</span>
                    </span>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </InstituteScope>
  );
}
