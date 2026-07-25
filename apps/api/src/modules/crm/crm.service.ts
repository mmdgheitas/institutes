import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'kysely';
import {
  LEAD_STATUS_ORDER,
  LeadStatus,
  type DashboardStats,
  type LeadBoardColumn,
  type SubmissionRecord,
  type SubmissionValue,
} from '../../packages/shared/src/index';
import { DatabaseService } from '../../db/database.service';
import { InstituteAccessService } from '../institutes/institute-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { FormsService } from '../forms/forms.service';
import type { AuthenticatedUser } from '../../common/decorators';
import type { UpdateLeadStatusDto } from '../forms/dto/form.dto';

@Injectable()
export class CrmService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: InstituteAccessService,
    private readonly notifications: NotificationsService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Full Kanban board: every column with its leads in board order. */
  async getBoard(
    user: AuthenticatedUser,
    instituteId: string,
    options: { courseId?: string; search?: string; limitPerColumn?: number } = {},
  ): Promise<LeadBoardColumn[]> {
    await this.access.assertCanManage(user, instituteId);
    const limit = options.limitPerColumn ?? 50;

    let query = this.database.db
      .selectFrom('submissions as s')
      .innerJoin('users as u', 'u.id', 's.student_id')
      .select([
        's.id',
        's.form_id',
        's.institute_id',
        's.course_id',
        's.student_id',
        's.status',
        's.data',
        's.note',
        's.contract_accepted_at',
        's.contract_ip',
        's.board_position',
        's.created_at',
        's.updated_at',
        'u.full_name',
        'u.phone',
      ])
      .where('s.institute_id', '=', instituteId);

    if (options.courseId) query = query.where('s.course_id', '=', options.courseId);
    if (options.search) {
      const term = `%${options.search}%`;
      query = query.where((eb) =>
        eb.or([eb('u.full_name', 'ilike', term), eb('u.phone', 'ilike', term)]),
      );
    }

    const rows = await query
      .orderBy('s.board_position', 'asc')
      .orderBy('s.created_at', 'desc')
      .execute();

    const totals = await this.database.db
      .selectFrom('submissions')
      .select(['status', (eb) => eb.fn.countAll<number>().as('count')])
      .where('institute_id', '=', instituteId)
      .groupBy('status')
      .execute();

    const totalByStatus = new Map(totals.map((t) => [t.status, Number(t.count)]));

    return LEAD_STATUS_ORDER.map((status) => ({
      status,
      total: totalByStatus.get(status) ?? 0,
      items: rows
        .filter((row) => row.status === status)
        .slice(0, limit)
        .map((row) => this.toRecord(row)),
    }));
  }

  async getLead(user: AuthenticatedUser, submissionId: string) {
    const lead = await this.database.db
      .selectFrom('submissions as s')
      .innerJoin('users as u', 'u.id', 's.student_id')
      .innerJoin('forms as f', 'f.id', 's.form_id')
      .leftJoin('courses as c', 'c.id', 's.course_id')
      .select([
        's.id',
        's.form_id',
        's.institute_id',
        's.course_id',
        's.student_id',
        's.status',
        's.data',
        's.note',
        's.contract_accepted_at',
        's.contract_ip',
        's.board_position',
        's.created_at',
        's.updated_at',
        'u.full_name',
        'u.phone',
        'u.email',
        'f.title as form_title',
        'f.fields as form_fields',
        'c.title as course_title',
      ])
      .where('s.id', '=', submissionId)
      .executeTakeFirst();

    if (!lead) throw new NotFoundException('Lead not found');
    await this.access.assertCanManage(user, lead.institute_id);

    const [events, booking] = await Promise.all([
      this.database.db
        .selectFrom('submission_events as e')
        .leftJoin('users as a', 'a.id', 'e.actor_id')
        .select([
          'e.id',
          'e.from_status',
          'e.to_status',
          'e.note',
          'e.created_at',
          'a.full_name as actor_name',
        ])
        .where('e.submission_id', '=', submissionId)
        .orderBy('e.created_at', 'desc')
        .execute(),

      this.database.db
        .selectFrom('slot_bookings as b')
        .innerJoin('time_slots as t', 't.id', 'b.slot_id')
        .select(['t.starts_at', 't.ends_at', 't.location', 'b.status'])
        .where('b.submission_id', '=', submissionId)
        .executeTakeFirst(),
    ]);

    return {
      ...this.toRecord(lead),
      email: lead.email,
      formTitle: lead.form_title,
      formFields: lead.form_fields,
      courseTitle: lead.course_title,
      events: events.map((e) => ({
        id: e.id,
        fromStatus: e.from_status,
        toStatus: e.to_status,
        note: e.note,
        actorName: e.actor_name,
        createdAt: e.created_at.toISOString(),
      })),
      booking: booking
        ? {
            startsAt: booking.starts_at.toISOString(),
            endsAt: booking.ends_at.toISOString(),
            location: booking.location,
            status: booking.status,
          }
        : null,
    };
  }

  /**
   * Moves a lead between Kanban columns.
   *
   * Reaching ENROLLED creates the enrollment plus the revenue and commission
   * wallet entries in one transaction, so finances can never drift from the CRM.
   */
  async updateStatus(
    user: AuthenticatedUser,
    submissionId: string,
    dto: UpdateLeadStatusDto,
  ): Promise<SubmissionRecord> {
    const lead = await this.database.db
      .selectFrom('submissions')
      .selectAll()
      .where('id', '=', submissionId)
      .executeTakeFirst();
    if (!lead) throw new NotFoundException('Lead not found');
    await this.access.assertCanManage(user, lead.institute_id);

    const from = lead.status as LeadStatus;
    const to = dto.status;
    FormsService.assertTransitionAllowed(from, to);

    const updated = await this.database.transaction(async (trx) => {
      let boardPosition = lead.board_position;

      if (dto.position !== undefined) {
        boardPosition = dto.position;
        // Shift the rest of the destination column down to make room.
        await trx
          .updateTable('submissions')
          .set((eb) => ({ board_position: eb('board_position', '+', 1) }))
          .where('institute_id', '=', lead.institute_id)
          .where('status', '=', to)
          .where('board_position', '>=', dto.position)
          .where('id', '!=', submissionId)
          .execute();
      } else if (from !== to) {
        const { max } = await trx
          .selectFrom('submissions')
          .select((eb) => eb.fn.max('board_position').as('max'))
          .where('institute_id', '=', lead.institute_id)
          .where('status', '=', to)
          .executeTakeFirstOrThrow();
        boardPosition = (Number(max ?? 0) || 0) + 1;
      }

      const row = await trx
        .updateTable('submissions')
        .set({
          status: to,
          board_position: boardPosition,
          ...(dto.note !== undefined ? { note: dto.note } : {}),
        })
        .where('id', '=', submissionId)
        .returningAll()
        .executeTakeFirstOrThrow();

      if (from !== to) {
        await trx
          .insertInto('submission_events')
          .values({
            submission_id: submissionId,
            from_status: from,
            to_status: to,
            actor_id: user.id,
            note: dto.note ?? null,
          })
          .execute();
      }

      if (to === LeadStatus.ENROLLED && from !== LeadStatus.ENROLLED) {
        await this.convertToEnrollment(trx, lead);
      }

      if (to === LeadStatus.CANCELLED) {
        // Free any assessment slot the lead was holding.
        const booking = await trx
          .selectFrom('slot_bookings')
          .select(['id', 'slot_id'])
          .where('submission_id', '=', submissionId)
          .where('status', '=', 'BOOKED')
          .executeTakeFirst();
        if (booking) {
          await trx
            .updateTable('slot_bookings')
            .set({ status: 'CANCELLED' })
            .where('id', '=', booking.id)
            .execute();
          await trx
            .updateTable('time_slots')
            .set((eb) => ({ booked_count: eb('booked_count', '-', 1), status: 'AVAILABLE' }))
            .where('id', '=', booking.slot_id)
            .where('booked_count', '>', 0)
            .execute();
        }
      }

      return row;
    });

    // Push the move to every open dashboard so boards stay in sync.
    this.realtime.emitLeadMoved(lead.institute_id, {
      submissionId,
      from,
      to,
      actor: user.fullName,
    });

    const messages: Partial<Record<LeadStatus, string>> = {
      CONTACTED: 'The institute has reviewed your application and will contact you.',
      INTERVIEWED: 'Your assessment has been recorded.',
      ENROLLED: 'Congratulations — you are now enrolled!',
      CANCELLED: 'Your pre-registration was closed.',
    };
    if (messages[to]) {
      await this.notifications.create({
        userId: lead.student_id,
        title: 'Pre-registration update',
        body: messages[to] as string,
        kind: 'LEAD_STATUS',
      });
    }

    const student = await this.database.db
      .selectFrom('users')
      .select(['full_name', 'phone'])
      .where('id', '=', lead.student_id)
      .executeTakeFirstOrThrow();

    return this.toRecord({ ...updated, full_name: student.full_name, phone: student.phone });
  }

  /** Creates the enrollment + revenue/commission ledger entries. */
  private async convertToEnrollment(
    trx: Parameters<Parameters<DatabaseService['transaction']>[0]>[0],
    lead: {
      id: string;
      institute_id: string;
      course_id: string | null;
      student_id: string;
    },
  ): Promise<void> {
    if (!lead.course_id) {
      throw new BadRequestException(
        'This lead is not linked to a course, so it cannot be enrolled. ' +
          'Assign a course to the lead first.',
      );
    }

    const course = await trx
      .selectFrom('courses')
      .select(['id', 'price', 'discount_percent', 'capacity', 'enrolled_count', 'title'])
      .where('id', '=', lead.course_id)
      .forUpdate()
      .executeTakeFirst();
    if (!course) throw new NotFoundException('The linked course no longer exists');

    if (course.enrolled_count >= course.capacity) {
      throw new BadRequestException(`"${course.title}" is already full`);
    }

    const existing = await trx
      .selectFrom('enrollments')
      .select('id')
      .where('course_id', '=', lead.course_id)
      .where('student_id', '=', lead.student_id)
      .executeTakeFirst();
    if (existing) return; // Idempotent: already converted.

    const institute = await trx
      .selectFrom('institutes')
      .select('commission_percent')
      .where('id', '=', lead.institute_id)
      .executeTakeFirstOrThrow();

    const gross =
      Number(course.price) * (1 - course.discount_percent / 100);
    const commission = Math.round((gross * institute.commission_percent) / 100);

    await trx
      .insertInto('enrollments')
      .values({
        course_id: lead.course_id,
        student_id: lead.student_id,
        submission_id: lead.id,
        status: 'ACTIVE',
        price_paid: Math.round(gross),
      })
      .execute();

    await trx
      .insertInto('wallet_transactions')
      .values([
        {
          institute_id: lead.institute_id,
          amount: Math.round(gross),
          type: 'ENROLLMENT_REVENUE',
          description: `Enrollment: ${course.title}`,
          reference_id: lead.id,
        },
        {
          institute_id: lead.institute_id,
          amount: -commission,
          type: 'PLATFORM_COMMISSION',
          description: `Platform commission (${institute.commission_percent}%)`,
          reference_id: lead.id,
        },
      ])
      .execute();
  }

  /** Attach or change the course a lead is applying for. */
  async assignCourse(
    user: AuthenticatedUser,
    submissionId: string,
    courseId: string,
  ): Promise<SubmissionRecord> {
    const lead = await this.database.db
      .selectFrom('submissions')
      .selectAll()
      .where('id', '=', submissionId)
      .executeTakeFirst();
    if (!lead) throw new NotFoundException('Lead not found');
    await this.access.assertCanManage(user, lead.institute_id);

    const course = await this.database.db
      .selectFrom('courses')
      .select(['id', 'institute_id'])
      .where('id', '=', courseId)
      .executeTakeFirst();
    if (!course || course.institute_id !== lead.institute_id) {
      throw new BadRequestException('That course belongs to a different institute');
    }

    const updated = await this.database.db
      .updateTable('submissions')
      .set({ course_id: courseId })
      .where('id', '=', submissionId)
      .returningAll()
      .executeTakeFirstOrThrow();

    const student = await this.database.db
      .selectFrom('users')
      .select(['full_name', 'phone'])
      .where('id', '=', lead.student_id)
      .executeTakeFirstOrThrow();

    return this.toRecord({ ...updated, full_name: student.full_name, phone: student.phone });
  }

  async addNote(user: AuthenticatedUser, submissionId: string, note: string) {
    const lead = await this.database.db
      .selectFrom('submissions')
      .select(['id', 'institute_id', 'status'])
      .where('id', '=', submissionId)
      .executeTakeFirst();
    if (!lead) throw new NotFoundException('Lead not found');
    await this.access.assertCanManage(user, lead.institute_id);

    await this.database.transaction(async (trx) => {
      await trx
        .updateTable('submissions')
        .set({ note })
        .where('id', '=', submissionId)
        .execute();
      await trx
        .insertInto('submission_events')
        .values({
          submission_id: submissionId,
          from_status: lead.status,
          to_status: lead.status,
          actor_id: user.id,
          note,
        })
        .execute();
    });

    return { success: true };
  }

  /** Headline numbers for the dashboard home screen. */
  async getStats(user: AuthenticatedUser, instituteId: string): Promise<DashboardStats> {
    await this.access.assertCanManage(user, instituteId);
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [leads, courses, students, institute, revenue, sessions] = await Promise.all([
      this.database.db
        .selectFrom('submissions')
        .select([
          (eb) => eb.fn.countAll<number>().as('total'),
          (eb) =>
            eb.fn
              .count<number>('id')
              .filterWhere('created_at', '>=', weekAgo)
              .as('this_week'),
          (eb) =>
            eb.fn.count<number>('id').filterWhere('status', '=', 'ENROLLED').as('enrolled'),
        ])
        .where('institute_id', '=', instituteId)
        .executeTakeFirstOrThrow(),

      this.database.db
        .selectFrom('courses')
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .where('institute_id', '=', instituteId)
        .where('is_published', '=', true)
        .executeTakeFirstOrThrow(),

      this.database.db
        .selectFrom('enrollments as e')
        .innerJoin('courses as c', 'c.id', 'e.course_id')
        .select((eb) => eb.fn.count<number>('e.student_id').distinct().as('count'))
        .where('c.institute_id', '=', instituteId)
        .where('e.status', '=', 'ACTIVE')
        .executeTakeFirstOrThrow(),

      this.database.db
        .selectFrom('institutes')
        .select('rating')
        .where('id', '=', instituteId)
        .executeTakeFirstOrThrow(),

      sql<{ total: string | null }>`
        SELECT COALESCE(SUM(amount), 0)::text AS total
          FROM wallet_transactions
         WHERE institute_id = ${instituteId}::uuid
           AND type = 'ENROLLMENT_REVENUE'
           AND created_at >= ${monthStart}
      `.execute(this.database.db),

      this.database.db
        .selectFrom('live_sessions as ls')
        .innerJoin('courses as c', 'c.id', 'ls.course_id')
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .where('c.institute_id', '=', instituteId)
        .where('ls.starts_at', '>', new Date())
        .executeTakeFirstOrThrow(),
    ]);

    const totalLeads = Number(leads.total);
    const enrolledLeads = Number(leads.enrolled);

    return {
      totalLeads,
      newLeadsThisWeek: Number(leads.this_week),
      conversionRate:
        totalLeads > 0 ? Number(((enrolledLeads / totalLeads) * 100).toFixed(1)) : 0,
      activeCourses: Number(courses.count),
      activeStudents: Number(students.count),
      averageRating: Number(institute.rating.toFixed(2)),
      revenueThisMonth: Number(revenue.rows[0]?.total ?? 0),
      upcomingSessions: Number(sessions.count),
    };
  }

  private toRecord(row: {
    id: string;
    form_id: string;
    institute_id: string;
    course_id: string | null;
    student_id: string;
    status: string;
    data: unknown;
    note: string | null;
    contract_accepted_at: Date | null;
    contract_ip: string | null;
    created_at: Date;
    updated_at: Date;
    full_name: string;
    phone: string;
  }): SubmissionRecord {
    return {
      id: row.id,
      formId: row.form_id,
      instituteId: row.institute_id,
      courseId: row.course_id,
      studentId: row.student_id,
      studentName: row.full_name,
      studentPhone: row.phone,
      status: row.status as LeadStatus,
      data: (row.data ?? {}) as Record<string, SubmissionValue>,
      note: row.note,
      contractAcceptedAt: row.contract_accepted_at
        ? row.contract_accepted_at.toISOString()
        : null,
      contractIp: row.contract_ip,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
