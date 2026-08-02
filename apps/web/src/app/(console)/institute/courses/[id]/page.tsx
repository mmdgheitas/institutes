'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { courses as coursesApi } from '@/lib/api/endpoints';
import { useSession } from '@/stores/session';
import { InstituteScope, useInstituteId } from '@/components/console/InstituteScope';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/States';
import { Badge } from '@/components/ui/Badge';
import { COURSE_TYPE_FA, COURSE_LEVEL_FA } from '@/lib/constants';
import { formatIRRCompact } from '@/lib/format';
import { CourseEditTab } from '@/components/courses/CourseEditTab';
import { CourseQuizzesTab } from '@/components/courses/CourseQuizzesTab';
import { CourseMaterialsTab } from '@/components/courses/CourseMaterialsTab';
import { CourseLiveSessionsTab } from '@/components/courses/CourseLiveSessionsTab';
import { CourseEnrollmentsTab } from '@/components/courses/CourseEnrollmentsTab';

export default function CourseDetailPage() {
  const params = useParams<{ id: string }>();
  const courseId = params.id;
  const instituteId = useInstituteId();
  const { user } = useSession();

  const { data: course, isLoading, isError, refetch } = useQuery({
    queryKey: ['courses', 'get', courseId],
    queryFn: () => coursesApi.get(courseId),
    enabled: Boolean(courseId),
  });

  return (
    <InstituteScope>
      {isLoading ? (
        <SkeletonRows rows={6} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !course ? (
        <Card>دوره یافت نشد.</Card>
      ) : (
        <div className="flex flex-col gap-5">
          <PageHeader
            title={course.title}
            description={
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">{COURSE_TYPE_FA[course.type]}</Badge>
                <Badge tone="violet">{COURSE_LEVEL_FA[course.level]}</Badge>
                <Badge tone={course.isPublished ? 'green' : 'slate'}>
                  {course.isPublished ? 'منتشر شده' : 'پیش‌نویس'}
                </Badge>
                <span className="font-bold text-slate-800">{formatIRRCompact(course.effectivePrice)}</span>
              </span>
            }
          />

          <Card>
            <div className="p-2">
              <Tabs
                defaultTab="edit"
                tabs={[
                  {
                    id: 'edit',
                    label: 'مشخصات دوره',
                    content:
                      user?.role === 'TEACHER' ? (
                        <p className="px-2 py-6 text-center text-sm text-slate-500">
                          فقط مدیر آموزشگاه می‌تواند مشخصات دوره را ویرایش کند.
                        </p>
                      ) : instituteId ? (
                        <CourseEditTab course={course} instituteId={instituteId} />
                      ) : null,
                  },
                  { id: 'quizzes', label: 'آزمون‌ها', content: <CourseQuizzesTab courseId={course.id} /> },
                  { id: 'materials', label: 'مواد درسی', content: <CourseMaterialsTab courseId={course.id} /> },
                  { id: 'live', label: 'جلسات آنلاین', content: <CourseLiveSessionsTab courseId={course.id} /> },
                  { id: 'students', label: 'دانش‌آموزان', content: <CourseEnrollmentsTab courseId={course.id} /> },
                ]}
              />
            </div>
          </Card>
        </div>
      )}
    </InstituteScope>
  );
}
