import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import type { AppConfig } from '../../config/configuration';

export const QUEUE_NAMES = {
  MEDIA: 'media-processing',
  NOTIFICATIONS: 'notifications',
} as const;

export interface TranscodeJobData {
  mediaId: string;
  objectKey: string;
  mimeType: string;
  /** Renditions the FFmpeg worker should produce. */
  renditions: ('1080p' | '720p' | '480p' | '360p')[];
  generateThumbnail: boolean;
}

export interface NotificationJobData {
  userId: string;
  title: string;
  body: string;
  kind: string;
  channels: ('IN_APP' | 'SMS')[];
  phone?: string;
}

/**
 * BullMQ producer.
 *
 * Redis is optional: when `REDIS_ENABLED=false` (tests, minimal local setups)
 * every enqueue becomes a logged no-op instead of throwing, so the API keeps
 * working without the queue infrastructure.
 */
@Injectable()
export class QueueService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(QueueService.name);
  private mediaQueue: Queue<TranscodeJobData> | null = null;
  private notificationQueue: Queue<NotificationJobData> | null = null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  onModuleInit(): void {
    const redis = this.config.get('redis', { infer: true });
    if (!redis.enabled) {
      this.logger.warn('Redis is disabled — background jobs will be skipped');
      return;
    }

    const connection = { url: redis.url };
    const defaultJobOptions = {
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 5000 },
      removeOnComplete: { age: 3600, count: 1000 },
      removeOnFail: { age: 24 * 3600 },
    };

    this.mediaQueue = new Queue<TranscodeJobData>(QUEUE_NAMES.MEDIA, {
      connection,
      defaultJobOptions,
    });
    this.notificationQueue = new Queue<NotificationJobData>(QUEUE_NAMES.NOTIFICATIONS, {
      connection,
      defaultJobOptions,
    });

    this.logger.log(`BullMQ queues ready on ${redis.url}`);
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all([
      this.mediaQueue?.close().catch(() => undefined),
      this.notificationQueue?.close().catch(() => undefined),
    ]);
  }

  /** Queues HLS transcoding for an uploaded video. */
  async enqueueTranscode(data: TranscodeJobData): Promise<string | null> {
    if (!this.mediaQueue) {
      this.logger.debug(`Skipped transcode for ${data.mediaId} (queue disabled)`);
      return null;
    }
    const job = await this.mediaQueue.add('transcode', data, {
      jobId: `transcode-${data.mediaId}`,
    });
    return job.id ?? null;
  }

  async enqueueNotification(data: NotificationJobData): Promise<string | null> {
    if (!this.notificationQueue) return null;
    const job = await this.notificationQueue.add('notify', data);
    return job.id ?? null;
  }

  /** Queue depths for the admin health panel. */
  async getStats(): Promise<Record<string, { waiting: number; active: number; failed: number }>> {
    const stats: Record<string, { waiting: number; active: number; failed: number }> = {};
    for (const [name, queue] of [
      [QUEUE_NAMES.MEDIA, this.mediaQueue],
      [QUEUE_NAMES.NOTIFICATIONS, this.notificationQueue],
    ] as const) {
      if (!queue) continue;
      const [waiting, active, failed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getFailedCount(),
      ]);
      stats[name] = { waiting, active, failed };
    }
    return stats;
  }
}
