import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import slugify from 'slugify';
import { UserRole, VerificationStatus } from '../../packages/shared/src/index';
import { DatabaseService } from '../../db/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthenticatedUser } from '../../common/decorators';
import { InstituteAccessService } from './institute-access.service';
import type {
  CreateInstituteDto,
  CreateInstructorDto,
  CreateReviewDto,
  ReplyReviewDto,
  ReviewVerificationDto,
  SubmitVerificationDto,
  UpdateInstituteDto,
  UpdateInstructorDto,
} from './dto/institute.dto';

@Injectable()
export class InstitutesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: InstituteAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Creates the institute and makes the caller its owner, atomically. */
  async create(user: AuthenticatedUser, dto: CreateInstituteDto) {
    const slug = await this.uniqueSlug(dto.name);

    return this.database.transaction(async (trx) => {
      const institute = await trx
        .insertInto('institutes')
        .values({
          slug,
          name: dto.name,
          description: dto.description ?? null,
          short_description: dto.shortDescription ?? null,
          address: dto.address,
          city: dto.city,
          province: dto.province ?? null,
          latitude: dto.latitude,
          longitude: dto.longitude,
          phone: dto.phone ?? null,
          email: dto.email?.toLowerCase() ?? null,
          website: dto.website ?? null,
          skills: dto.skills ?? [],
          amenities: dto.amenities ?? [],
          working_hours: dto.workingHours ? JSON.stringify(dto.workingHours) : null,
          free_pre_registration: dto.freePreRegistration ?? true,
          logo_url: dto.logoUrl ?? null,
          cover_image_url: dto.coverImageUrl ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .insertInto('institute_members')
        .values({
          institute_id: institute.id,
          user_id: user.id,
          role: UserRole.INSTITUTE_ADMIN,
          is_owner: true,
        })
        .execute();

      // Promote a plain student account to institute admin on first institute.
      if (user.role === UserRole.STUDENT) {
        await trx
          .updateTable('users')
          .set({ role: UserRole.INSTITUTE_ADMIN })
          .where('id', '=', user.id)
          .execute();
      }

      if (dto.categoryIds?.length) {
        await trx
          .insertInto('institute_categories')
          .values(
            dto.categoryIds.map((categoryId, index) => ({
              institute_id: institute.id,
              category_id: categoryId,
              is_primary: index === 0,
            })),
          )
          .execute();
      }

      return institute;
    });
  }

  async update(user: AuthenticatedUser, instituteId: string, dto: UpdateInstituteDto) {
    await this.access.assertCanManage(user, instituteId);

    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.shortDescription !== undefined) patch.short_description = dto.shortDescription;
    if (dto.address !== undefined) patch.address = dto.address;
    if (dto.city !== undefined) patch.city = dto.city;
    if (dto.province !== undefined) patch.province = dto.province;
    if (dto.latitude !== undefined) patch.latitude = dto.latitude;
    if (dto.longitude !== undefined) patch.longitude = dto.longitude;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.email !== undefined) patch.email = dto.email.toLowerCase();
    if (dto.website !== undefined) patch.website = dto.website;
    if (dto.skills !== undefined) patch.skills = dto.skills;
    if (dto.amenities !== undefined) patch.amenities = dto.amenities;
    if (dto.workingHours !== undefined) {
      patch.working_hours = JSON.stringify(dto.workingHours);
    }
    if (dto.freePreRegistration !== undefined) {
      patch.free_pre_registration = dto.freePreRegistration;
    }
    if (dto.logoUrl !== undefined) patch.logo_url = dto.logoUrl;
    if (dto.coverImageUrl !== undefined) patch.cover_image_url = dto.coverImageUrl;
    if (dto.isPublished !== undefined) patch.is_published = dto.isPublished;

    if (Object.keys(patch).length === 0 && !dto.categoryIds) {
      throw new BadRequestException('No changes supplied');
    }

    return this.database.transaction(async (trx) => {
      if (Object.keys(patch).length > 0) {
        await trx
          .updateTable('institutes')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .set(patch as any)
          .where('id', '=', instituteId)
          .execute();
      }

      if (dto.categoryIds) {
        await trx
          .deleteFrom('institute_categories')
          .where('institute_id', '=', instituteId)
          .execute();
        if (dto.categoryIds.length > 0) {
          await trx
            .insertInto('institute_categories')
            .values(
              dto.categoryIds.map((categoryId, index) => ({
                institute_id: instituteId,
                category_id: categoryId,
                is_primary: index === 0,
              })),
            )
            .execute();
        }
      }

      return trx
        .selectFrom('institutes')
        .selectAll()
        .where('id', '=', instituteId)
        .executeTakeFirstOrThrow();
    });
  }

  /** Institutes the current dashboard user belongs to. */
  async listMine(user: AuthenticatedUser) {
    return this.database.db
      .selectFrom('institutes as i')
      .innerJoin('institute_members as m', 'm.institute_id', 'i.id')
      .selectAll('i')
      .select('m.is_owner')
      .where('m.user_id', '=', user.id)
      .orderBy('i.created_at', 'desc')
      .execute();
  }

  async getManaged(user: AuthenticatedUser, instituteId: string) {
    await this.access.assertCanManage(user, instituteId);
    const institute = await this.database.db
      .selectFrom('institutes')
      .selectAll()
      .where('id', '=', instituteId)
      .executeTakeFirst();
    if (!institute) throw new NotFoundException('Institute not found');
    return institute;
  }

  /* ---------------------------------------------------- verification --- */

  async submitVerification(
    user: AuthenticatedUser,
    instituteId: string,
    dto: SubmitVerificationDto,
  ) {
    await this.access.assertCanManage(user, instituteId);

    const media = await this.database.db
      .selectFrom('media')
      .select(['id', 'institute_id'])
      .where('id', '=', dto.mediaId)
      .executeTakeFirst();
    if (!media) throw new NotFoundException('Uploaded document not found');
    if (media.institute_id && media.institute_id !== instituteId) {
      throw new ForbiddenException('That document belongs to another institute');
    }

    return this.database.transaction(async (trx) => {
      const doc = await trx
        .insertInto('verification_documents')
        .values({
          institute_id: instituteId,
          media_id: dto.mediaId,
          doc_type: dto.docType,
          status: VerificationStatus.PENDING,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx
        .updateTable('institutes')
        .set({ verification_status: VerificationStatus.PENDING })
        .where('id', '=', instituteId)
        .where('verification_status', 'in', ['UNVERIFIED', 'REJECTED'])
        .execute();

      return doc;
    });
  }

  async listVerificationDocuments(user: AuthenticatedUser, instituteId: string) {
    await this.access.assertCanManage(user, instituteId);
    return this.database.db
      .selectFrom('verification_documents as vd')
      .leftJoin('media as m', 'm.id', 'vd.media_id')
      .select([
        'vd.id',
        'vd.doc_type',
        'vd.status',
        'vd.review_note',
        'vd.reviewed_at',
        'vd.created_at',
        'm.url',
        'm.title',
      ])
      .where('vd.institute_id', '=', instituteId)
      .orderBy('vd.created_at', 'desc')
      .execute();
  }

  /** Super-admin action: grant or refuse the blue tick. */
  async reviewVerification(documentId: string, dto: ReviewVerificationDto) {
    const doc = await this.database.db
      .selectFrom('verification_documents')
      .selectAll()
      .where('id', '=', documentId)
      .executeTakeFirst();
    if (!doc) throw new NotFoundException('Verification document not found');

    return this.database.transaction(async (trx) => {
      await trx
        .updateTable('verification_documents')
        .set({
          status: dto.status,
          review_note: dto.note ?? null,
          reviewed_at: new Date(),
        })
        .where('id', '=', documentId)
        .execute();

      await trx
        .updateTable('institutes')
        .set({
          verification_status: dto.status,
          verified_at: dto.status === VerificationStatus.VERIFIED ? new Date() : null,
        })
        .where('id', '=', doc.institute_id)
        .execute();

      const owners = await trx
        .selectFrom('institute_members')
        .select('user_id')
        .where('institute_id', '=', doc.institute_id)
        .execute();

      for (const owner of owners) {
        await trx
          .insertInto('notifications')
          .values({
            user_id: owner.user_id,
            title:
              dto.status === VerificationStatus.VERIFIED
                ? 'Your institute is verified'
                : 'Verification was rejected',
            body:
              dto.note ??
              (dto.status === VerificationStatus.VERIFIED
                ? 'Your institute now displays the verified badge.'
                : 'Please re-submit a valid official licence document.'),
            kind: 'VERIFICATION',
          })
          .execute();
      }

      return { status: dto.status };
    });
  }

  async listPendingVerifications() {
    return this.database.db
      .selectFrom('verification_documents as vd')
      .innerJoin('institutes as i', 'i.id', 'vd.institute_id')
      .leftJoin('media as m', 'm.id', 'vd.media_id')
      .select([
        'vd.id',
        'vd.doc_type',
        'vd.created_at',
        'i.id as institute_id',
        'i.name as institute_name',
        'i.city',
        'm.url as document_url',
      ])
      .where('vd.status', '=', VerificationStatus.PENDING)
      .orderBy('vd.created_at', 'asc')
      .execute();
  }

  /* ----------------------------------------------------- instructors --- */

  async createInstructor(
    user: AuthenticatedUser,
    instituteId: string,
    dto: CreateInstructorDto,
  ) {
    await this.access.assertCanManage(user, instituteId);
    return this.database.db
      .insertInto('instructors')
      .values({
        institute_id: instituteId,
        user_id: dto.userId ?? null,
        full_name: dto.fullName,
        headline: dto.headline ?? null,
        bio: dto.bio ?? null,
        avatar_url: dto.avatarUrl ?? null,
        years_of_experience: dto.yearsOfExperience ?? null,
        specialties: dto.specialties ?? [],
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async updateInstructor(
    user: AuthenticatedUser,
    instructorId: string,
    dto: UpdateInstructorDto,
  ) {
    const instructor = await this.database.db
      .selectFrom('instructors')
      .select('institute_id')
      .where('id', '=', instructorId)
      .executeTakeFirst();
    if (!instructor) throw new NotFoundException('Instructor not found');
    await this.access.assertCanManage(user, instructor.institute_id);

    const patch: Record<string, unknown> = {};
    if (dto.fullName !== undefined) patch.full_name = dto.fullName;
    if (dto.headline !== undefined) patch.headline = dto.headline;
    if (dto.bio !== undefined) patch.bio = dto.bio;
    if (dto.avatarUrl !== undefined) patch.avatar_url = dto.avatarUrl;
    if (dto.yearsOfExperience !== undefined) {
      patch.years_of_experience = dto.yearsOfExperience;
    }
    if (dto.specialties !== undefined) patch.specialties = dto.specialties;
    if (dto.isActive !== undefined) patch.is_active = dto.isActive;
    if (dto.userId !== undefined) patch.user_id = dto.userId;

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('No changes supplied');
    }

    return this.database.db
      .updateTable('instructors')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(patch as any)
      .where('id', '=', instructorId)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async listInstructors(user: AuthenticatedUser, instituteId: string) {
    await this.access.assertCanManage(user, instituteId);
    return this.database.db
      .selectFrom('instructors')
      .selectAll()
      .where('institute_id', '=', instituteId)
      .orderBy('created_at', 'desc')
      .execute();
  }

  async deleteInstructor(user: AuthenticatedUser, instructorId: string) {
    const instructor = await this.database.db
      .selectFrom('instructors')
      .select('institute_id')
      .where('id', '=', instructorId)
      .executeTakeFirst();
    if (!instructor) throw new NotFoundException('Instructor not found');
    await this.access.assertCanManage(user, instructor.institute_id);

    // Soft-delete: keeps historical course assignments intact.
    await this.database.db
      .updateTable('instructors')
      .set({ is_active: false })
      .where('id', '=', instructorId)
      .execute();
    return { success: true };
  }

  /* --------------------------------------------------------- reviews --- */

  /** Only students with an enrollment at the institute may leave a review. */
  async createReview(user: AuthenticatedUser, instituteId: string, dto: CreateReviewDto) {
    const enrollment = await this.database.db
      .selectFrom('enrollments as e')
      .innerJoin('courses as c', 'c.id', 'e.course_id')
      .select('e.id')
      .where('e.student_id', '=', user.id)
      .where('c.institute_id', '=', instituteId)
      .executeTakeFirst();

    if (!enrollment) {
      throw new ForbiddenException(
        'Only students enrolled at this institute can leave a review',
      );
    }

    const existing = await this.database.db
      .selectFrom('reviews')
      .select('id')
      .where('institute_id', '=', instituteId)
      .where('author_id', '=', user.id)
      .executeTakeFirst();
    if (existing) {
      throw new ConflictException('You have already reviewed this institute');
    }

    const review = await this.database.db
      .insertInto('reviews')
      .values({
        institute_id: instituteId,
        author_id: user.id,
        rating: dto.rating,
        title: dto.title ?? null,
        body: dto.body,
        video_media_id: dto.videoMediaId ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const members = await this.database.db
      .selectFrom('institute_members')
      .select('user_id')
      .where('institute_id', '=', instituteId)
      .execute();
    await Promise.all(
      members.map((m) =>
        this.notifications.create({
          userId: m.user_id,
          title: `New ${dto.rating}-star review`,
          body: dto.body.slice(0, 200),
          kind: 'REVIEW',
        }),
      ),
    );

    return review;
  }

  async replyToReview(user: AuthenticatedUser, reviewId: string, dto: ReplyReviewDto) {
    const review = await this.database.db
      .selectFrom('reviews')
      .select(['institute_id', 'author_id'])
      .where('id', '=', reviewId)
      .executeTakeFirst();
    if (!review) throw new NotFoundException('Review not found');
    await this.access.assertCanManage(user, review.institute_id);

    const updated = await this.database.db
      .updateTable('reviews')
      .set({ institute_reply: dto.reply, replied_at: new Date() })
      .where('id', '=', reviewId)
      .returningAll()
      .executeTakeFirstOrThrow();

    await this.notifications.create({
      userId: review.author_id,
      title: 'The institute replied to your review',
      body: dto.reply.slice(0, 200),
      kind: 'REVIEW_REPLY',
    });

    return updated;
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base =
      slugify(name, { lower: true, strict: true, trim: true }).slice(0, 100) ||
      'institute';

    for (let attempt = 0; attempt < 25; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const clash = await this.database.db
        .selectFrom('institutes')
        .select('id')
        .where('slug', '=', candidate)
        .executeTakeFirst();
      if (!clash) return candidate;
    }
    return `${base}-${Date.now().toString(36)}`;
  }
}
