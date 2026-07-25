import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MediaKind, type StudyMaterial } from '../../packages/shared/src/index';
import { DatabaseService } from '../../db/database.service';
import { InstituteAccessService } from '../institutes/institute-access.service';
import { StorageService } from './storage.service';
import type { AuthenticatedUser } from '../../common/decorators';
import type { CreateMaterialDto } from './dto/storage.dto';

/**
 * Access-controlled study materials.
 *
 * Download links are presigned per request and expire in 15 minutes, so a URL
 * copied out of the network tab cannot be shared with non-enrolled students.
 */
@Injectable()
export class MaterialsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: InstituteAccessService,
    private readonly storage: StorageService,
  ) {}

  async create(user: AuthenticatedUser, courseId: string, dto: CreateMaterialDto) {
    const instituteId = await this.access.assertCanManageCourse(user, courseId);

    const media = await this.database.db
      .selectFrom('media')
      .select(['id', 'institute_id', 'kind', 'status'])
      .where('id', '=', dto.mediaId)
      .executeTakeFirst();
    if (!media) throw new NotFoundException('Uploaded file not found');
    if (media.institute_id && media.institute_id !== instituteId) {
      throw new BadRequestException('That file belongs to another institute');
    }
    if (media.status === 'PENDING_UPLOAD') {
      throw new BadRequestException('Confirm the upload before attaching it');
    }

    return this.database.db
      .insertInto('study_materials')
      .values({
        course_id: courseId,
        media_id: dto.mediaId,
        title: dto.title,
        description: dto.description ?? null,
        kind: dto.kind ?? (media.kind as MediaKind),
        position: dto.position ?? 0,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** Lists materials; download URLs are omitted here and issued on demand. */
  async listForCourse(
    user: AuthenticatedUser,
    courseId: string,
  ): Promise<StudyMaterial[]> {
    await this.access.assertCourseAccess(user, courseId);

    const rows = await this.database.db
      .selectFrom('study_materials as sm')
      .leftJoin('media as m', 'm.id', 'sm.media_id')
      .select([
        'sm.id',
        'sm.course_id',
        'sm.title',
        'sm.kind',
        'sm.is_downloadable',
        'sm.created_at',
        'm.size_bytes',
      ])
      .where('sm.course_id', '=', courseId)
      .orderBy('sm.position')
      .orderBy('sm.created_at', 'desc')
      .execute();

    return rows.map((row) => ({
      id: row.id,
      courseId: row.course_id,
      title: row.title,
      kind: row.kind as MediaKind,
      sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : null,
      downloadUrl: null,
      isDownloadable: row.is_downloadable,
      createdAt: row.created_at.toISOString(),
    }));
  }

  /** Issues a short-lived presigned download URL after re-checking access. */
  async getDownloadUrl(
    user: AuthenticatedUser,
    materialId: string,
  ): Promise<{ url: string; expiresInSeconds: number; fileName: string }> {
    const material = await this.database.db
      .selectFrom('study_materials as sm')
      .leftJoin('media as m', 'm.id', 'sm.media_id')
      .select([
        'sm.id',
        'sm.course_id',
        'sm.title',
        'sm.is_downloadable',
        'm.object_key',
        'm.hls_url',
        'm.is_public',
        'm.url',
      ])
      .where('sm.id', '=', materialId)
      .executeTakeFirst();

    if (!material) throw new NotFoundException('Material not found');
    await this.access.assertCourseAccess(user, material.course_id);

    if (!material.is_downloadable) {
      throw new BadRequestException('This material is view-only');
    }
    if (!material.object_key) {
      throw new NotFoundException('The underlying file is no longer available');
    }

    // Streamable video: prefer the HLS playlist produced by the FFmpeg worker.
    if (material.hls_url) {
      return { url: material.hls_url, expiresInSeconds: 0, fileName: material.title };
    }

    const url = await this.storage.createDownloadUrl(material.object_key, 900);
    return { url, expiresInSeconds: 900, fileName: material.title };
  }

  async remove(user: AuthenticatedUser, materialId: string) {
    const material = await this.database.db
      .selectFrom('study_materials')
      .select(['id', 'course_id'])
      .where('id', '=', materialId)
      .executeTakeFirst();
    if (!material) throw new NotFoundException('Material not found');
    await this.access.assertCanManageCourse(user, material.course_id);

    await this.database.db
      .deleteFrom('study_materials')
      .where('id', '=', materialId)
      .execute();
    return { success: true };
  }
}
