import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '../../packages/shared/src/index';
import { DatabaseService } from '../../db/database.service';
import type { AuthenticatedUser } from '../../common/decorators';

/**
 * Single place where "may this user act on this institute?" is decided.
 * Every write path in the dashboard, CRM, LMS and finance modules funnels
 * through here so tenancy can never be bypassed by a forged id in the body.
 */
@Injectable()
export class InstituteAccessService {
  constructor(private readonly database: DatabaseService) {}

  /** Throws unless the user administers the institute (or is a super admin). */
  async assertCanManage(user: AuthenticatedUser, instituteId: string): Promise<void> {
    if (user.role === UserRole.SUPER_ADMIN) return;

    // The token carries memberships, but re-check the DB so revoked access
    // takes effect before the access token expires.
    const membership = await this.database.db
      .selectFrom('institute_members')
      .select('id')
      .where('institute_id', '=', instituteId)
      .where('user_id', '=', user.id)
      .executeTakeFirst();

    if (!membership) {
      throw new ForbiddenException('You do not have access to this institute');
    }
  }

  /** Resolves the institute a dashboard user is acting on. */
  async resolveInstituteId(
    user: AuthenticatedUser,
    requested?: string,
  ): Promise<string> {
    if (requested) {
      await this.assertCanManage(user, requested);
      return requested;
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        'A super admin must specify which institute to act on',
      );
    }

    const membership = await this.database.db
      .selectFrom('institute_members')
      .select('institute_id')
      .where('user_id', '=', user.id)
      .orderBy('is_owner', 'desc')
      .executeTakeFirst();

    if (!membership) {
      throw new ForbiddenException('Your account is not linked to any institute');
    }
    return membership.institute_id;
  }

  /** Ensures a course belongs to an institute the user may manage. */
  async assertCanManageCourse(
    user: AuthenticatedUser,
    courseId: string,
  ): Promise<string> {
    const course = await this.database.db
      .selectFrom('courses')
      .select('institute_id')
      .where('id', '=', courseId)
      .executeTakeFirst();

    if (!course) throw new NotFoundException('Course not found');
    await this.assertCanManage(user, course.institute_id);
    return course.institute_id;
  }

  /** Ensures a quiz belongs to an institute the user may manage. */
  async assertCanManageQuiz(user: AuthenticatedUser, quizId: string): Promise<string> {
    const row = await this.database.db
      .selectFrom('quizzes as q')
      .innerJoin('courses as c', 'c.id', 'q.course_id')
      .select(['c.institute_id', 'q.course_id'])
      .where('q.id', '=', quizId)
      .executeTakeFirst();

    if (!row) throw new NotFoundException('Quiz not found');
    await this.assertCanManage(user, row.institute_id);
    return row.course_id;
  }

  /** True when the student has an active/completed enrollment in the course. */
  async isEnrolled(userId: string, courseId: string): Promise<boolean> {
    const enrollment = await this.database.db
      .selectFrom('enrollments')
      .select('id')
      .where('student_id', '=', userId)
      .where('course_id', '=', courseId)
      .where('status', 'in', ['ACTIVE', 'COMPLETED'])
      .executeTakeFirst();
    return Boolean(enrollment);
  }

  /** Students need an enrollment; staff of the owning institute always pass. */
  async assertCourseAccess(user: AuthenticatedUser, courseId: string): Promise<void> {
    if (user.role === UserRole.SUPER_ADMIN) return;

    const course = await this.database.db
      .selectFrom('courses')
      .select('institute_id')
      .where('id', '=', courseId)
      .executeTakeFirst();
    if (!course) throw new NotFoundException('Course not found');

    const membership = await this.database.db
      .selectFrom('institute_members')
      .select('id')
      .where('institute_id', '=', course.institute_id)
      .where('user_id', '=', user.id)
      .executeTakeFirst();
    if (membership) return;

    if (await this.isEnrolled(user.id, courseId)) return;

    throw new ForbiddenException('You are not enrolled in this course');
  }
}
