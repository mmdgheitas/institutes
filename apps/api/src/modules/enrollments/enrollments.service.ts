import { Injectable, NotFoundException } from '@nestjs/common';
import { EnrollmentStatus, type EnrollmentRecord } from '../../packages/shared/src/index';
import { DatabaseService } from '../../db/database.service';
import { InstituteAccessService } from '../institutes/institute-access.service';
import type { AuthenticatedUser } from '../../common/decorators';

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: InstituteAccessService,
  ) {}

  /** "My courses" for the student app. */
  async listMine(user: AuthenticatedUser): Promise<EnrollmentRecord[]> {
    const rows = await this.database.db
      .selectFrom('enrollments as e')
      .innerJoin('courses as c', 'c.id', 'e.course_id')
      .innerJoin('institutes as i', 'i.id', 'c.institute_id')
      .select([
        'e.id',
        'e.status',
        'e.progress_percent',
        'e.enrolled_at',
        'c.id as course_id',
        'c.title as course_title',
        'i.id as institute_id',
        'i.name as institute_name',
      ])
      .where('e.student_id', '=', user.id)
      .orderBy('e.enrolled_at', 'desc')
      .execute();

    return rows.map((row) => ({
      id: row.id,
      courseId: row.course_id,
      courseTitle: row.course_title,
      instituteId: row.institute_id,
      instituteName: row.institute_name,
      status: row.status as EnrollmentStatus,
      progressPercent: row.progress_percent,
      enrolledAt: row.enrolled_at.toISOString(),
    }));
  }

  /** Class roster for staff. */
  async listForCourse(user: AuthenticatedUser, courseId: string) {
    await this.access.assertCanManageCourse(user, courseId);
    return this.database.db
      .selectFrom('enrollments as e')
      .innerJoin('users as u', 'u.id', 'e.student_id')
      .select([
        'e.id',
        'e.status',
        'e.progress_percent',
        'e.price_paid',
        'e.enrolled_at',
        'u.id as student_id',
        'u.full_name',
        'u.phone',
        'u.email',
        'u.avatar_url',
      ])
      .where('e.course_id', '=', courseId)
      .orderBy('e.enrolled_at', 'desc')
      .execute();
  }

  async updateStatus(
    user: AuthenticatedUser,
    enrollmentId: string,
    status: EnrollmentStatus,
  ) {
    const enrollment = await this.database.db
      .selectFrom('enrollments')
      .select(['id', 'course_id'])
      .where('id', '=', enrollmentId)
      .executeTakeFirst();
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    await this.access.assertCanManageCourse(user, enrollment.course_id);

    return this.database.db
      .updateTable('enrollments')
      .set({
        status,
        completed_at: status === EnrollmentStatus.COMPLETED ? new Date() : null,
        ...(status === EnrollmentStatus.COMPLETED ? { progress_percent: 100 } : {}),
      })
      .where('id', '=', enrollmentId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateProgress(
    user: AuthenticatedUser,
    enrollmentId: string,
    progressPercent: number,
  ) {
    const enrollment = await this.database.db
      .selectFrom('enrollments')
      .select(['id', 'course_id'])
      .where('id', '=', enrollmentId)
      .executeTakeFirst();
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    await this.access.assertCanManageCourse(user, enrollment.course_id);

    const clamped = Math.min(100, Math.max(0, progressPercent));
    return this.database.db
      .updateTable('enrollments')
      .set({
        progress_percent: clamped,
        ...(clamped === 100
          ? { status: EnrollmentStatus.COMPLETED, completed_at: new Date() }
          : {}),
      })
      .where('id', '=', enrollmentId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}
