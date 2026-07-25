import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { MediaKind, type PresignRequest, type PresignResponse } from '@institutes/shared';
import type { AppConfig } from '../../config/configuration';
import { DatabaseService } from '../../db/database.service';
import { InstituteAccessService } from '../institutes/institute-access.service';
import { QueueService } from '../queue/queue.service';
import type { AuthenticatedUser } from '../../common/decorators';

/** Per-purpose upload policy: who may upload, what, and how large. */
const UPLOAD_POLICY: Record<
  PresignRequest['purpose'],
  { maxBytes: number; mimePrefixes: string[]; requiresInstitute: boolean; isPublic: boolean }
> = {
  INSTITUTE_GALLERY: {
    maxBytes: 500 * 1024 * 1024,
    mimePrefixes: ['image/', 'video/'],
    requiresInstitute: true,
    isPublic: true,
  },
  INSTITUTE_LOGO: {
    maxBytes: 5 * 1024 * 1024,
    mimePrefixes: ['image/'],
    requiresInstitute: true,
    isPublic: true,
  },
  COURSE_MATERIAL: {
    maxBytes: 2 * 1024 * 1024 * 1024,
    mimePrefixes: ['image/', 'video/', 'audio/', 'application/pdf', 'application/'],
    requiresInstitute: true,
    isPublic: false,
  },
  SUBMISSION_ATTACHMENT: {
    maxBytes: 25 * 1024 * 1024,
    mimePrefixes: ['image/', 'application/pdf'],
    requiresInstitute: false,
    isPublic: false,
  },
  QUIZ_ANSWER: {
    maxBytes: 50 * 1024 * 1024,
    mimePrefixes: ['image/', 'application/pdf', 'application/', 'text/'],
    requiresInstitute: false,
    isPublic: false,
  },
  VERIFICATION_DOCUMENT: {
    maxBytes: 25 * 1024 * 1024,
    mimePrefixes: ['image/', 'application/pdf'],
    requiresInstitute: true,
    isPublic: false,
  },
  REVIEW_VIDEO: {
    maxBytes: 200 * 1024 * 1024,
    mimePrefixes: ['video/'],
    requiresInstitute: false,
    isPublic: true,
  },
  AVATAR: {
    maxBytes: 5 * 1024 * 1024,
    mimePrefixes: ['image/'],
    requiresInstitute: false,
    isPublic: true,
  },
};

/**
 * S3-compatible object storage (MinIO / ArvanCloud).
 *
 * Policy: NestJS never proxies media bytes. Clients receive a presigned PUT URL
 * and upload straight to the bucket; the API only records metadata and, for
 * video, enqueues an FFmpeg transcode job.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly database: DatabaseService,
    private readonly access: InstituteAccessService,
    private readonly queue: QueueService,
  ) {
    const storage = this.config.get('storage', { infer: true });
    this.client = new S3Client({
      endpoint: storage.endpoint,
      region: storage.region,
      forcePathStyle: storage.forcePathStyle,
      credentials: {
        accessKeyId: storage.accessKeyId,
        secretAccessKey: storage.secretAccessKey,
      },
    });
  }

  private get settings() {
    return this.config.get('storage', { infer: true });
  }

  /** Issues a presigned PUT URL and creates the pending media record. */
  async createPresignedUpload(
    user: AuthenticatedUser,
    request: PresignRequest,
  ): Promise<PresignResponse> {
    const policy = UPLOAD_POLICY[request.purpose];
    if (!policy) throw new BadRequestException('Unsupported upload purpose');

    if (request.sizeBytes <= 0) {
      throw new BadRequestException('sizeBytes must be greater than zero');
    }
    if (request.sizeBytes > policy.maxBytes) {
      throw new BadRequestException(
        `Files for ${request.purpose} may not exceed ${Math.floor(policy.maxBytes / 1024 / 1024)} MB`,
      );
    }

    const mimeAllowed = policy.mimePrefixes.some((prefix) =>
      request.mimeType.toLowerCase().startsWith(prefix),
    );
    if (!mimeAllowed) {
      throw new BadRequestException(
        `Content type ${request.mimeType} is not allowed for ${request.purpose}`,
      );
    }

    if (policy.requiresInstitute) {
      if (!request.instituteId) {
        throw new BadRequestException('instituteId is required for this upload purpose');
      }
      await this.access.assertCanManage(user, request.instituteId);
    }

    const safeExtension = this.safeExtension(request.fileName, request.mimeType);
    const objectKey = [
      request.purpose.toLowerCase(),
      request.instituteId ?? user.id,
      `${Date.now()}-${randomUUID()}${safeExtension}`,
    ].join('/');

    const media = await this.database.db
      .insertInto('media')
      .values({
        institute_id: request.instituteId ?? null,
        uploader_id: user.id,
        kind: request.kind,
        status: 'PENDING_UPLOAD',
        purpose: request.purpose,
        object_key: objectKey,
        mime_type: request.mimeType,
        size_bytes: request.sizeBytes,
        title: request.fileName.slice(0, 200),
        is_public: policy.isPublic,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    const command = new PutObjectCommand({
      Bucket: this.settings.bucket,
      Key: objectKey,
      ContentType: request.mimeType,
      ContentLength: request.sizeBytes,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: this.settings.presignExpirySeconds,
    });

    return {
      mediaId: media.id,
      uploadUrl,
      objectKey,
      method: 'PUT',
      headers: {
        'Content-Type': request.mimeType,
        'Content-Length': String(request.sizeBytes),
      },
      expiresInSeconds: this.settings.presignExpirySeconds,
      maxSizeBytes: policy.maxBytes,
    };
  }

  /**
   * Called by the client once the PUT succeeds. Verifies the object really
   * exists in the bucket before marking it ready, so a forged call cannot
   * publish a phantom asset.
   */
  async confirmUpload(
    user: AuthenticatedUser,
    mediaId: string,
  ): Promise<{ id: string; status: string; url: string | null; needsProcessing: boolean }> {
    const media = await this.database.db
      .selectFrom('media')
      .selectAll()
      .where('id', '=', mediaId)
      .executeTakeFirst();
    if (!media) throw new NotFoundException('Media record not found');
    if (media.uploader_id !== user.id) {
      throw new ForbiddenException('This upload belongs to another user');
    }

    let actualSize: number | null = null;
    try {
      const head = await this.client.send(
        new HeadObjectCommand({ Bucket: this.settings.bucket, Key: media.object_key }),
      );
      actualSize = head.ContentLength ?? null;
    } catch {
      throw new BadRequestException(
        'The object was not found in storage. Complete the upload before confirming.',
      );
    }

    const needsProcessing = media.kind === MediaKind.VIDEO;
    const url = media.is_public
      ? `${this.settings.publicBaseUrl.replace(/\/$/, '')}/${media.object_key}`
      : null;

    await this.database.db
      .updateTable('media')
      .set({
        status: needsProcessing ? 'PROCESSING' : 'READY',
        url,
        size_bytes: actualSize ?? media.size_bytes,
      })
      .where('id', '=', mediaId)
      .execute();

    // Video is handed to the FFmpeg worker for HLS transcoding; the API never
    // touches the bytes itself.
    if (needsProcessing) {
      await this.queue.enqueueTranscode({
        mediaId,
        objectKey: media.object_key,
        mimeType: media.mime_type,
        renditions: ['720p', '480p', '360p'],
        generateThumbnail: true,
      });
    }

    return { id: mediaId, status: needsProcessing ? 'PROCESSING' : 'READY', url, needsProcessing };
  }

  /** Time-limited download link for access-controlled material. */
  async createDownloadUrl(objectKey: string, expiresIn = 900): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.settings.bucket,
      Key: objectKey,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async deleteMedia(user: AuthenticatedUser, mediaId: string): Promise<{ success: boolean }> {
    const media = await this.database.db
      .selectFrom('media')
      .selectAll()
      .where('id', '=', mediaId)
      .executeTakeFirst();
    if (!media) throw new NotFoundException('Media record not found');

    if (media.institute_id) {
      await this.access.assertCanManage(user, media.institute_id);
    } else if (media.uploader_id !== user.id) {
      throw new ForbiddenException('This upload belongs to another user');
    }

    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.settings.bucket, Key: media.object_key }),
      );
    } catch (error) {
      // Removing the DB row still matters even if the object is already gone.
      this.logger.warn(`Object delete failed for ${media.object_key}: ${(error as Error).message}`);
    }

    await this.database.db.deleteFrom('media').where('id', '=', mediaId).execute();
    return { success: true };
  }

  async listInstituteMedia(user: AuthenticatedUser, instituteId: string, purpose?: string) {
    await this.access.assertCanManage(user, instituteId);
    let query = this.database.db
      .selectFrom('media')
      .selectAll()
      .where('institute_id', '=', instituteId);
    if (purpose) query = query.where('purpose', '=', purpose);
    return query.orderBy('position').orderBy('created_at', 'desc').execute();
  }

  /** Reorders gallery assets in one transaction. */
  async reorderGallery(
    user: AuthenticatedUser,
    instituteId: string,
    order: { mediaId: string; position: number }[],
  ) {
    await this.access.assertCanManage(user, instituteId);
    await this.database.transaction(async (trx) => {
      for (const item of order) {
        await trx
          .updateTable('media')
          .set({ position: item.position })
          .where('id', '=', item.mediaId)
          .where('institute_id', '=', instituteId)
          .execute();
      }
    });
    return { success: true };
  }

  /** Whitelists the file extension to avoid path traversal / odd keys. */
  private safeExtension(fileName: string, mimeType: string): string {
    const raw = extname(fileName).toLowerCase();
    if (/^\.[a-z0-9]{1,8}$/.test(raw)) return raw;

    const fallback: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'audio/mpeg': '.mp3',
      'application/pdf': '.pdf',
    };
    return fallback[mimeType.toLowerCase()] ?? '';
  }
}
