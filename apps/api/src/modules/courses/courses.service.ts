import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import slugify from 'slugify';
import type { CourseSummary } from '@institutes/shared';
import { DatabaseService } from '../../db/database.service';
import { InstituteAccessService } from '../institutes/institute-access.service';
import type { AuthenticatedUser } from '../../common/decorators';
import type { CourseScheduleJson } from '../../db/schema';
import type {
  CreateClassroomDto,
  CreateCourseDto,
  CreateTimetableEntryDto,
  UpdateCourseDto,
} from './dto/course.dto';

/** Overlap test for two "HH:mm" ranges on the same weekday. */
export function timeRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

@Injectable()
export class CoursesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: InstituteAccessService,
  ) {}

  async create(user: AuthenticatedUser, instituteId: string, dto: CreateCourseDto) {
    await this.access.assertCanManage(user, instituteId);

    if (dto.startDate && dto.endDate && dto.startDate >= dto.endDate) {
      throw new BadRequestException('endDate must be after startDate');
    }
    this.assertSessionsValid(dto.sessions);

    const slug = await this.uniqueSlug(instituteId, dto.title);

    return this.database.transaction(async (trx) => {
      const course = await trx
        .insertInto('courses')
        .values({
          institute_id: instituteId,
          category_id: dto.categoryId ?? null,
          slug,
          title: dto.title,
          description: dto.description ?? null,
          type: dto.type ?? 'IN_PERSON',
          level: dto.level ?? 'ALL_LEVELS',
          price: dto.price,
          discount_percent: dto.discountPercent ?? 0,
          currency: dto.currency ?? 'IRR',
          duration_hours: dto.durationHours ?? 0,
          capacity: dto.capacity ?? 20,
          start_date: dto.startDate ? new Date(dto.startDate) : null,
          end_date: dto.endDate ? new Date(dto.endDate) : null,
          schedule: JSON.stringify(this.normalizeSessions(dto.sessions)),
          is_published: dto.isPublished ?? false,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      if (dto.instructorIds?.length) {
        await this.assertInstructorsBelong(instituteId, dto.instructorIds);
        await trx
          .insertInto('course_instructors')
          .values(
            dto.instructorIds.map((instructorId) => ({
              course_id: course.id,
              instructor_id: instructorId,
            })),
          )
          .execute();
      }

      return course;
    });
  }

  async update(user: AuthenticatedUser, courseId: string, dto: UpdateCourseDto) {
    const instituteId = await this.access.assertCanManageCourse(user, courseId);
    this.assertSessionsValid(dto.sessions);

    const patch: Record<string, unknown> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.level !== undefined) patch.level = dto.level;
    if (dto.price !== undefined) patch.price = dto.price;
    if (dto.discountPercent !== undefined) patch.discount_percent = dto.discountPercent;
    if (dto.currency !== undefined) patch.currency = dto.currency;
    if (dto.durationHours !== undefined) patch.duration_hours = dto.durationHours;
    if (dto.capacity !== undefined) patch.capacity = dto.capacity;
    if (dto.startDate !== undefined) patch.start_date = new Date(dto.startDate);
    if (dto.endDate !== undefined) patch.end_date = new Date(dto.endDate);
    if (dto.categoryId !== undefined) patch.category_id = dto.categoryId;
    if (dto.isPublished !== undefined) patch.is_published = dto.isPublished;
    if (dto.sessions !== undefined) {
      patch.schedule = JSON.stringify(this.normalizeSessions(dto.sessions));
    }

    // Never let capacity fall below the students already enrolled.
    if (dto.capacity !== undefined) {
      const current = await this.database.db
        .selectFrom('courses')
        .select('enrolled_count')
        .where('id', '=', courseId)
        .executeTakeFirstOrThrow();
      if (dto.capacity < current.enrolled_count) {
        throw new BadRequestException(
          `Capacity cannot be lower than the ${current.enrolled_count} students already enrolled`,
        );
      }
    }

    return this.database.transaction(async (trx) => {
      if (Object.keys(patch).length > 0) {
        await trx
          .updateTable('courses')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .set(patch as any)
          .where('id', '=', courseId)
          .execute();
      }

      if (dto.instructorIds) {
        await this.assertInstructorsBelong(instituteId, dto.instructorIds);
        await trx
          .deleteFrom('course_instructors')
          .where('course_id', '=', courseId)
          .execute();
        if (dto.instructorIds.length > 0) {
          await trx
            .insertInto('course_instructors')
            .values(
              dto.instructorIds.map((instructorId) => ({
                course_id: courseId,
                instructor_id: instructorId,
              })),
            )
            .execute();
        }
      }

      return trx
        .selectFrom('courses')
        .selectAll()
        .where('id', '=', courseId)
        .executeTakeFirstOrThrow();
    });
  }

  async remove(user: AuthenticatedUser, courseId: string) {
    await this.access.assertCanManageCourse(user, courseId);

    const enrolled = await this.database.db
      .selectFrom('enrollments')
      .select('id')
      .where('course_id', '=', courseId)
      .where('status', '=', 'ACTIVE')
      .executeTakeFirst();

    if (enrolled) {
      // Unpublish rather than destroy history.
      await this.database.db
        .updateTable('courses')
        .set({ is_published: false })
        .where('id', '=', courseId)
        .execute();
      return { deleted: false, unpublished: true };
    }

    await this.database.db.deleteFrom('courses').where('id', '=', courseId).execute();
    return { deleted: true, unpublished: false };
  }

  async listForInstitute(user: AuthenticatedUser, instituteId: string) {
    await this.access.assertCanManage(user, instituteId);
    const rows = await this.database.db
      .selectFrom('courses')
      .selectAll()
      .where('institute_id', '=', instituteId)
      .orderBy('created_at', 'desc')
      .execute();
    return rows.map((row) => this.toSummary(row));
  }

  async getPublic(courseId: string): Promise<CourseSummary & { description: string | null }> {
    const course = await this.database.db
      .selectFrom('courses')
      .selectAll()
      .where('id', '=', courseId)
      .where('is_published', '=', true)
      .executeTakeFirst();
    if (!course) throw new NotFoundException('Course not found');

    const instructors = await this.database.db
      .selectFrom('course_instructors')
      .select('instructor_id')
      .where('course_id', '=', courseId)
      .execute();

    return {
      ...this.toSummary(course),
      instructorIds: instructors.map((i) => i.instructor_id),
      description: course.description,
    };
  }

  /* ------------------------------------------------------- timetable --- */

  async createClassroom(
    user: AuthenticatedUser,
    instituteId: string,
    dto: CreateClassroomDto,
  ) {
    await this.access.assertCanManage(user, instituteId);
    return this.database.db
      .insertInto('classrooms')
      .values({
        institute_id: instituteId,
        name: dto.name,
        capacity: dto.capacity ?? 20,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async listClassrooms(user: AuthenticatedUser, instituteId: string) {
    await this.access.assertCanManage(user, instituteId);
    return this.database.db
      .selectFrom('classrooms')
      .selectAll()
      .where('institute_id', '=', instituteId)
      .orderBy('name')
      .execute();
  }

  /**
   * Adds a timetable entry, rejecting double-booking of the same classroom.
   * The overlap check runs inside the transaction against committed rows.
   */
  async addTimetableEntry(user: AuthenticatedUser, dto: CreateTimetableEntryDto) {
    const instituteId = await this.access.assertCanManageCourse(user, dto.courseId);

    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('startTime must be before endTime');
    }

    if (dto.classroomId) {
      const classroom = await this.database.db
        .selectFrom('classrooms')
        .select('id')
        .where('id', '=', dto.classroomId)
        .where('institute_id', '=', instituteId)
        .executeTakeFirst();
      if (!classroom) {
        throw new BadRequestException('Classroom does not belong to this institute');
      }
    }

    return this.database.transaction(async (trx) => {
      if (dto.classroomId) {
        const existing = await trx
          .selectFrom('timetable_entries')
          .select(['start_time', 'end_time'])
          .where('classroom_id', '=', dto.classroomId)
          .where('day_of_week', '=', dto.dayOfWeek)
          .execute();

        const clash = existing.some((entry) =>
          timeRangesOverlap(dto.startTime, dto.endTime, entry.start_time, entry.end_time),
        );
        if (clash) {
          throw new ConflictException(
            'That classroom is already booked during this time slot',
          );
        }
      }

      return trx
        .insertInto('timetable_entries')
        .values({
          course_id: dto.courseId,
          classroom_id: dto.classroomId ?? null,
          day_of_week: dto.dayOfWeek,
          start_time: dto.startTime,
          end_time: dto.endTime,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    });
  }

  async getTimetable(user: AuthenticatedUser, instituteId: string) {
    await this.access.assertCanManage(user, instituteId);
    return this.database.db
      .selectFrom('timetable_entries as t')
      .innerJoin('courses as c', 'c.id', 't.course_id')
      .leftJoin('classrooms as r', 'r.id', 't.classroom_id')
      .select([
        't.id',
        't.day_of_week',
        't.start_time',
        't.end_time',
        'c.id as course_id',
        'c.title as course_title',
        'c.type as course_type',
        'r.id as classroom_id',
        'r.name as classroom_name',
      ])
      .where('c.institute_id', '=', instituteId)
      .orderBy('t.day_of_week')
      .orderBy('t.start_time')
      .execute();
  }

  async removeTimetableEntry(user: AuthenticatedUser, entryId: string) {
    const entry = await this.database.db
      .selectFrom('timetable_entries')
      .select('course_id')
      .where('id', '=', entryId)
      .executeTakeFirst();
    if (!entry) throw new NotFoundException('Timetable entry not found');
    await this.access.assertCanManageCourse(user, entry.course_id);

    await this.database.db
      .deleteFrom('timetable_entries')
      .where('id', '=', entryId)
      .execute();
    return { success: true };
  }

  /* --------------------------------------------------------- helpers --- */

  private toSummary(course: {
    id: string;
    slug: string;
    title: string;
    type: string;
    level: string;
    price: string;
    discount_percent: number;
    currency: string;
    duration_hours: number;
    capacity: number;
    enrolled_count: number;
    start_date: Date | null;
    schedule: unknown;
  }): CourseSummary {
    const price = Number(course.price);
    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      type: course.type as CourseSummary['type'],
      level: course.level as CourseSummary['level'],
      price,
      discountPercent: course.discount_percent,
      effectivePrice: Math.round(price * (1 - course.discount_percent / 100)),
      currency: course.currency,
      durationHours: course.duration_hours,
      capacity: course.capacity,
      enrolledCount: course.enrolled_count,
      seatsLeft: Math.max(0, course.capacity - course.enrolled_count),
      startDate: course.start_date ? course.start_date.toISOString() : null,
      sessions: Array.isArray(course.schedule)
        ? (course.schedule as CourseSummary['sessions'])
        : [],
      instructorIds: [],
    };
  }

  private normalizeSessions(
    sessions: { dayOfWeek: number; startTime: string; endTime: string; room?: string | null }[] = [],
  ): CourseScheduleJson {
    return sessions.map((s) => ({
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room ?? null,
    }));
  }

  private assertSessionsValid(
    sessions?: { dayOfWeek: number; startTime: string; endTime: string }[],
  ): void {
    if (!sessions?.length) return;

    for (const session of sessions) {
      if (session.startTime >= session.endTime) {
        throw new BadRequestException(
          `Session on day ${session.dayOfWeek}: startTime must be before endTime`,
        );
      }
    }

    // A course cannot overlap itself on the same weekday.
    for (let i = 0; i < sessions.length; i += 1) {
      for (let j = i + 1; j < sessions.length; j += 1) {
        const a = sessions[i];
        const b = sessions[j];
        if (
          a.dayOfWeek === b.dayOfWeek &&
          timeRangesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)
        ) {
          throw new BadRequestException(
            'Two sessions of this course overlap on the same day',
          );
        }
      }
    }
  }

  private async assertInstructorsBelong(
    instituteId: string,
    instructorIds: string[],
  ): Promise<void> {
    if (instructorIds.length === 0) return;
    const rows = await this.database.db
      .selectFrom('instructors')
      .select('id')
      .where('id', 'in', instructorIds)
      .where('institute_id', '=', instituteId)
      .execute();
    if (rows.length !== instructorIds.length) {
      throw new BadRequestException(
        'One or more instructors do not belong to this institute',
      );
    }
  }

  private async uniqueSlug(instituteId: string, title: string): Promise<string> {
    const base =
      slugify(title, { lower: true, strict: true, trim: true }).slice(0, 120) || 'course';
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const clash = await this.database.db
        .selectFrom('courses')
        .select('id')
        .where('institute_id', '=', instituteId)
        .where('slug', '=', candidate)
        .executeTakeFirst();
      if (!clash) return candidate;
    }
    return `${base}-${Date.now().toString(36)}`;
  }
}
