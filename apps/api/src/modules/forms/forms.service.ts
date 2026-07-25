import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FormFieldType,
  LEAD_TRANSITIONS,
  LeadStatus,
  validateSubmission,
  type FormFieldSchema,
  type FormSchema,
  type SubmissionValue,
} from '@institutes/shared';
import { DatabaseService } from '../../db/database.service';
import { InstituteAccessService } from '../institutes/institute-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SmsService } from '../notifications/sms.service';
import { AuthService } from '../auth/auth.service';
import type { AuthenticatedUser } from '../../common/decorators';
import type {
  CreateFormDto,
  FormFieldDto,
  SubmitFormDto,
  UpdateFormDto,
} from './dto/form.dto';

@Injectable()
export class FormsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: InstituteAccessService,
    private readonly notifications: NotificationsService,
    private readonly sms: SmsService,
    private readonly auth: AuthService,
  ) {}

  /* ------------------------------------------------------ authoring --- */

  async createForm(user: AuthenticatedUser, instituteId: string, dto: CreateFormDto) {
    await this.access.assertCanManage(user, instituteId);
    const fields = this.normalizeFields(dto.fields);

    if (dto.requiresContract && !dto.contractText?.trim()) {
      throw new BadRequestException(
        'contractText is required when requiresContract is enabled',
      );
    }

    return this.database.db
      .insertInto('forms')
      .values({
        institute_id: instituteId,
        title: dto.title,
        description: dto.description ?? null,
        fields: JSON.stringify(fields),
        requires_contract: dto.requiresContract ?? false,
        contract_text: dto.contractText ?? null,
        requires_otp: dto.requiresOtp ?? false,
        is_active: dto.isActive ?? true,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateForm(user: AuthenticatedUser, formId: string, dto: UpdateFormDto) {
    const form = await this.requireForm(formId);
    await this.access.assertCanManage(user, form.institute_id);

    const patch: Record<string, unknown> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.fields !== undefined) {
      patch.fields = JSON.stringify(this.normalizeFields(dto.fields));
    }
    if (dto.requiresContract !== undefined) patch.requires_contract = dto.requiresContract;
    if (dto.contractText !== undefined) patch.contract_text = dto.contractText;
    if (dto.requiresOtp !== undefined) patch.requires_otp = dto.requiresOtp;
    if (dto.isActive !== undefined) patch.is_active = dto.isActive;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('No changes supplied');
    }

    return this.database.db
      .updateTable('forms')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(patch as any)
      .where('id', '=', formId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async listForms(user: AuthenticatedUser, instituteId: string) {
    await this.access.assertCanManage(user, instituteId);
    const rows = await this.database.db
      .selectFrom('forms')
      .selectAll()
      .where('institute_id', '=', instituteId)
      .orderBy('created_at', 'desc')
      .execute();
    return rows.map((row) => this.toSchema(row));
  }

  /** Public: the form a student fills in. Contract text included, fields sorted. */
  async getPublicForm(formId: string): Promise<FormSchema> {
    const form = await this.requireForm(formId);
    if (!form.is_active) throw new NotFoundException('This form is no longer accepting entries');
    return this.toSchema(form);
  }

  /* ---------------------------------------------------- submissions --- */

  /**
   * Validates and stores a pre-registration.
   *
   * The exact same `validateSubmission()` used by the web client re-runs here,
   * so a tampered client payload is rejected with identical error messages.
   */
  async submit(
    user: AuthenticatedUser,
    formId: string,
    dto: SubmitFormDto,
    meta: { ip: string; userAgent: string | null },
  ) {
    const form = await this.requireForm(formId);
    if (!form.is_active) {
      throw new BadRequestException('This form is no longer accepting entries');
    }

    const fields = this.readFields(form.fields);
    const { valid, errors, sanitized } = validateSubmission(
      fields,
      dto.data as Record<string, SubmissionValue>,
    );
    if (!valid) {
      throw new BadRequestException(errors.map((e) => `${e.key}: ${e.message}`));
    }

    if (form.requires_contract && dto.contractAccepted !== true) {
      throw new BadRequestException('You must accept the terms to continue');
    }

    if (form.requires_otp) {
      if (!dto.otpCode) {
        throw new BadRequestException('An SMS confirmation code is required');
      }
      await this.auth.assertOtpValid(user.phone, dto.otpCode, 'SUBMISSION');
    }

    if (dto.courseId) {
      const course = await this.database.db
        .selectFrom('courses')
        .select(['id', 'institute_id', 'capacity', 'enrolled_count'])
        .where('id', '=', dto.courseId)
        .executeTakeFirst();
      if (!course || course.institute_id !== form.institute_id) {
        throw new BadRequestException('That course does not belong to this institute');
      }
    }

    const existing = await this.database.db
      .selectFrom('submissions')
      .select('id')
      .where('form_id', '=', formId)
      .where('student_id', '=', user.id)
      .where('status', '!=', LeadStatus.CANCELLED)
      .executeTakeFirst();
    if (existing) {
      throw new ConflictException(
        'You already have an open pre-registration for this form',
      );
    }

    const now = new Date();

    const submission = await this.database.transaction(async (trx) => {
      // Append to the end of the NEW column on the Kanban board.
      const { max } = await trx
        .selectFrom('submissions')
        .select((eb) => eb.fn.max('board_position').as('max'))
        .where('institute_id', '=', form.institute_id)
        .where('status', '=', LeadStatus.NEW)
        .executeTakeFirstOrThrow();

      const created = await trx
        .insertInto('submissions')
        .values({
          form_id: formId,
          institute_id: form.institute_id,
          course_id: dto.courseId ?? null,
          student_id: user.id,
          status: LeadStatus.NEW,
          data: JSON.stringify(sanitized),
          board_position: (Number(max ?? 0) || 0) + 1,
          contract_accepted_at: form.requires_contract ? now : null,
          contract_ip: form.requires_contract ? meta.ip.slice(0, 64) : null,
          contract_user_agent: form.requires_contract
            ? (meta.userAgent?.slice(0, 300) ?? null)
            : null,
          sms_confirmed_at: form.requires_otp ? now : null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('submission_events')
        .values({
          submission_id: created.id,
          from_status: null,
          to_status: LeadStatus.NEW,
          actor_id: user.id,
          note: 'Pre-registration submitted',
        })
        .execute();

      // Reserve the assessment slot in the same transaction.
      if (dto.slotId) {
        const slot = await trx
          .selectFrom('time_slots')
          .selectAll()
          .where('id', '=', dto.slotId)
          .where('institute_id', '=', form.institute_id)
          .forUpdate()
          .executeTakeFirst();

        if (!slot) throw new BadRequestException('That time slot does not exist');
        if (slot.status === 'CANCELLED') {
          throw new BadRequestException('That time slot was cancelled');
        }
        if (slot.booked_count >= slot.capacity) {
          throw new ConflictException('That time slot is fully booked');
        }
        if (slot.starts_at < now) {
          throw new BadRequestException('That time slot is in the past');
        }

        await trx
          .insertInto('slot_bookings')
          .values({
            slot_id: slot.id,
            student_id: user.id,
            submission_id: created.id,
          })
          .execute();

        const bookedCount = slot.booked_count + 1;
        await trx
          .updateTable('time_slots')
          .set({
            booked_count: bookedCount,
            status: bookedCount >= slot.capacity ? 'BOOKED' : slot.status,
          })
          .where('id', '=', slot.id)
          .execute();
      }

      return created;
    });

    const institute = await this.database.db
      .selectFrom('institutes')
      .select('name')
      .where('id', '=', form.institute_id)
      .executeTakeFirstOrThrow();

    // Side effects outside the transaction: they must not roll back the lead.
    await this.sms.sendLeadNotification(user.phone, institute.name);
    if (form.requires_contract) {
      await this.sms.sendContractConfirmation(
        user.phone,
        institute.name,
        submission.id.slice(0, 8).toUpperCase(),
      );
    }

    const members = await this.database.db
      .selectFrom('institute_members')
      .select('user_id')
      .where('institute_id', '=', form.institute_id)
      .execute();
    await Promise.all(
      members.map((m) =>
        this.notifications.create({
          userId: m.user_id,
          title: 'New pre-registration',
          body: `${user.fullName} applied via "${form.title}".`,
          kind: 'LEAD',
          linkUrl: `/dashboard/leads?highlight=${submission.id}`,
        }),
      ),
    );

    return submission;
  }

  async mySubmissions(user: AuthenticatedUser) {
    return this.database.db
      .selectFrom('submissions as s')
      .innerJoin('institutes as i', 'i.id', 's.institute_id')
      .innerJoin('forms as f', 'f.id', 's.form_id')
      .leftJoin('courses as c', 'c.id', 's.course_id')
      .select([
        's.id',
        's.status',
        's.created_at',
        's.data',
        'i.id as institute_id',
        'i.name as institute_name',
        'i.slug as institute_slug',
        'f.title as form_title',
        'c.title as course_title',
      ])
      .where('s.student_id', '=', user.id)
      .orderBy('s.created_at', 'desc')
      .execute();
  }

  /* ------------------------------------------------------ time slots --- */

  async createSlots(
    user: AuthenticatedUser,
    instituteId: string,
    dto: {
      courseId?: string;
      startTimes: string[];
      durationMinutes: number;
      capacity?: number;
      location?: string;
    },
  ) {
    await this.access.assertCanManage(user, instituteId);
    if (dto.startTimes.length === 0) {
      throw new BadRequestException('At least one start time is required');
    }

    const rows = dto.startTimes.map((iso) => {
      const startsAt = new Date(iso);
      if (Number.isNaN(startsAt.getTime())) {
        throw new BadRequestException(`Invalid start time: ${iso}`);
      }
      return {
        institute_id: instituteId,
        course_id: dto.courseId ?? null,
        starts_at: startsAt,
        ends_at: new Date(startsAt.getTime() + dto.durationMinutes * 60_000),
        capacity: dto.capacity ?? 1,
        location: dto.location ?? null,
      };
    });

    return this.database.db.insertInto('time_slots').values(rows).returningAll().execute();
  }

  /** Public: bookable slots for a storefront's assessment calendar. */
  async listAvailableSlots(instituteId: string, courseId?: string) {
    let query = this.database.db
      .selectFrom('time_slots')
      .selectAll()
      .where('institute_id', '=', instituteId)
      .where('starts_at', '>', new Date())
      .where('status', '=', 'AVAILABLE');

    if (courseId) {
      query = query.where((eb) =>
        eb.or([eb('course_id', '=', courseId), eb('course_id', 'is', null)]),
      );
    }

    const rows = await query.orderBy('starts_at').limit(200).execute();
    return rows.map((row) => ({
      id: row.id,
      instituteId: row.institute_id,
      courseId: row.course_id,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      capacity: row.capacity,
      bookedCount: row.booked_count,
      status: row.status,
      location: row.location,
    }));
  }

  async cancelSlot(user: AuthenticatedUser, slotId: string) {
    const slot = await this.database.db
      .selectFrom('time_slots')
      .select(['id', 'institute_id'])
      .where('id', '=', slotId)
      .executeTakeFirst();
    if (!slot) throw new NotFoundException('Time slot not found');
    await this.access.assertCanManage(user, slot.institute_id);

    await this.database.transaction(async (trx) => {
      await trx
        .updateTable('time_slots')
        .set({ status: 'CANCELLED' })
        .where('id', '=', slotId)
        .execute();
      await trx
        .updateTable('slot_bookings')
        .set({ status: 'CANCELLED' })
        .where('slot_id', '=', slotId)
        .execute();
    });

    return { success: true };
  }

  /* --------------------------------------------------------- helpers --- */

  private async requireForm(formId: string) {
    const form = await this.database.db
      .selectFrom('forms')
      .selectAll()
      .where('id', '=', formId)
      .executeTakeFirst();
    if (!form) throw new NotFoundException('Form not found');
    return form;
  }

  private toSchema(form: {
    id: string;
    institute_id: string;
    title: string;
    description: string | null;
    is_active: boolean;
    requires_contract: boolean;
    contract_text: string | null;
    fields: unknown;
  }): FormSchema {
    return {
      id: form.id,
      instituteId: form.institute_id,
      title: form.title,
      description: form.description,
      isActive: form.is_active,
      requiresContract: form.requires_contract,
      contractText: form.contract_text,
      fields: this.readFields(form.fields),
    };
  }

  private readFields(raw: unknown): FormFieldSchema[] {
    if (!Array.isArray(raw)) return [];
    return (raw as FormFieldSchema[])
      .slice()
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  /** Validates the authored schema itself (keys unique, options present, regex compiles). */
  private normalizeFields(fields: FormFieldDto[]): FormFieldSchema[] {
    if (!fields.length) {
      throw new BadRequestException('A form must contain at least one field');
    }

    const seen = new Set<string>();
    return fields.map((field, index) => {
      const key = field.key.trim();
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
        throw new BadRequestException(
          `Field key "${field.key}" must start with a letter and contain only letters, digits and underscores`,
        );
      }
      if (seen.has(key)) {
        throw new BadRequestException(`Duplicate field key: ${key}`);
      }
      seen.add(key);

      const needsOptions =
        field.type === FormFieldType.SELECT || field.type === FormFieldType.MULTI_SELECT;
      if (needsOptions && !field.options?.length) {
        throw new BadRequestException(`Field "${key}" requires at least one option`);
      }

      if (field.pattern) {
        try {
          new RegExp(field.pattern);
        } catch {
          throw new BadRequestException(`Field "${key}" has an invalid regular expression`);
        }
      }

      if (
        field.minLength != null &&
        field.maxLength != null &&
        field.minLength > field.maxLength
      ) {
        throw new BadRequestException(`Field "${key}": minLength exceeds maxLength`);
      }

      return {
        key,
        label: field.label.trim(),
        type: field.type,
        required: field.required ?? false,
        placeholder: field.placeholder,
        helpText: field.helpText,
        options: field.options,
        minLength: field.minLength,
        maxLength: field.maxLength,
        min: field.min,
        max: field.max,
        pattern: field.pattern,
        acceptedMimeTypes: field.acceptedMimeTypes,
        maxFileSizeMb: field.maxFileSizeMb ?? 10,
        position: field.position ?? index,
      };
    });
  }

  /** Exposed for the CRM module so transition rules live in one place. */
  static assertTransitionAllowed(from: LeadStatus, to: LeadStatus): void {
    if (from === to) return;
    if (!LEAD_TRANSITIONS[from].includes(to)) {
      throw new ForbiddenException(`A lead cannot move from ${from} to ${to}`);
    }
  }
}
