#!/usr/bin/env node
/**
 * Standalone media-processing worker.
 *
 * Runs FFmpeg out-of-process so the API never blocks on transcoding:
 *   1. downloads the source object from S3 to a temp dir
 *   2. produces HLS renditions plus a poster thumbnail
 *   3. uploads the results back and flips the media row to READY
 *
 * Start with `npm run worker` (built) or `npm run worker:dev` (ts-node).
 * Requires `ffmpeg` and `ffprobe` on PATH.
 */
import 'reflect-metadata';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Worker, type Job } from 'bullmq';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { Pool } from 'pg';
import configuration from './config/configuration';
import { QUEUE_NAMES, type TranscodeJobData } from './modules/queue/queue.service';

const config = configuration();

const s3 = new S3Client({
  endpoint: config.storage.endpoint,
  region: config.storage.region,
  forcePathStyle: config.storage.forcePathStyle,
  credentials: {
    accessKeyId: config.storage.accessKeyId,
    secretAccessKey: config.storage.secretAccessKey,
  },
});

const pool = new Pool({ connectionString: config.database.url, max: 4 });

const RENDITION_SETTINGS: Record<string, { height: number; bitrate: string; audio: string }> = {
  '1080p': { height: 1080, bitrate: '5000k', audio: '192k' },
  '720p': { height: 720, bitrate: '2800k', audio: '128k' },
  '480p': { height: 480, bitrate: '1400k', audio: '128k' },
  '360p': { height: 360, bitrate: '800k', audio: '96k' },
};

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}: ${stderr.slice(-1500)}`));
    });
  });
}

async function probeDuration(filePath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const child = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath,
    ]);
    let out = '';
    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()));
    child.on('error', () => resolve(null));
    child.on('close', () => {
      const seconds = Number.parseFloat(out.trim());
      resolve(Number.isFinite(seconds) ? Math.round(seconds) : null);
    });
  });
}

async function downloadObject(objectKey: string, destination: string): Promise<void> {
  const response = await s3.send(
    new GetObjectCommand({ Bucket: config.storage.bucket, Key: objectKey }),
  );
  if (!response.Body) throw new Error(`Empty body for ${objectKey}`);
  await pipeline(response.Body as Readable, createWriteStream(destination));
}

async function uploadDirectory(localDir: string, keyPrefix: string): Promise<void> {
  const entries = await readdir(localDir, { withFileTypes: true });
  for (const entry of entries) {
    const localPath = join(localDir, entry.name);
    if (entry.isDirectory()) {
      await uploadDirectory(localPath, `${keyPrefix}/${entry.name}`);
      continue;
    }
    const body = await readFile(localPath);
    const contentType = entry.name.endsWith('.m3u8')
      ? 'application/vnd.apple.mpegurl'
      : entry.name.endsWith('.ts')
        ? 'video/mp2t'
        : entry.name.endsWith('.jpg')
          ? 'image/jpeg'
          : 'application/octet-stream';

    await s3.send(
      new PutObjectCommand({
        Bucket: config.storage.bucket,
        Key: `${keyPrefix}/${entry.name}`,
        Body: body,
        ContentType: contentType,
      }),
    );
  }
}

async function processTranscode(job: Job<TranscodeJobData>): Promise<void> {
  const { mediaId, objectKey, renditions, generateThumbnail } = job.data;
  const workDir = join(tmpdir(), `transcode-${mediaId}`);
  const outputDir = join(workDir, 'hls');
  const sourcePath = join(workDir, 'source');

  console.log(`[worker] transcoding media ${mediaId} (${objectKey})`);

  try {
    await mkdir(outputDir, { recursive: true });
    await downloadObject(objectKey, sourcePath);

    const duration = await probeDuration(sourcePath);

    // One HLS variant per requested rendition, plus a master playlist.
    const variants: { name: string; playlist: string; bandwidth: number; height: number }[] = [];

    for (const rendition of renditions) {
      const settings = RENDITION_SETTINGS[rendition];
      if (!settings) continue;

      const variantDir = join(outputDir, rendition);
      await mkdir(variantDir, { recursive: true });

      await run('ffmpeg', [
        '-y',
        '-i', sourcePath,
        '-vf', `scale=-2:${settings.height}`,
        '-c:v', 'libx264',
        '-profile:v', 'main',
        '-preset', 'veryfast',
        '-b:v', settings.bitrate,
        '-maxrate', settings.bitrate,
        '-bufsize', `${Number.parseInt(settings.bitrate, 10) * 2}k`,
        '-c:a', 'aac',
        '-b:a', settings.audio,
        '-hls_time', '6',
        '-hls_playlist_type', 'vod',
        '-hls_segment_filename', join(variantDir, 'seg_%03d.ts'),
        join(variantDir, 'index.m3u8'),
      ]);

      variants.push({
        name: rendition,
        playlist: `${rendition}/index.m3u8`,
        bandwidth: Number.parseInt(settings.bitrate, 10) * 1000,
        height: settings.height,
      });
    }

    if (variants.length === 0) throw new Error('No valid renditions were requested');

    const master = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      ...variants.flatMap((variant) => [
        `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bandwidth},RESOLUTION=x${variant.height}`,
        variant.playlist,
      ]),
    ].join('\n');

    await writeFile(join(outputDir, 'master.m3u8'), master, 'utf8');

    let thumbnailKey: string | null = null;
    if (generateThumbnail) {
      const thumbPath = join(outputDir, 'poster.jpg');
      await run('ffmpeg', [
        '-y',
        '-i', sourcePath,
        '-ss', '00:00:03',
        '-vframes', '1',
        '-vf', 'scale=640:-2',
        thumbPath,
      ]);
      thumbnailKey = `${objectKey}-hls/poster.jpg`;
    }

    const hlsPrefix = `${objectKey}-hls`;
    await uploadDirectory(outputDir, hlsPrefix);

    const base = config.storage.publicBaseUrl.replace(/\/$/, '');
    await pool.query(
      `UPDATE media
          SET status = 'READY',
              hls_url = $2,
              thumbnail_url = COALESCE($3, thumbnail_url),
              duration_seconds = COALESCE($4, duration_seconds)
        WHERE id = $1`,
      [
        mediaId,
        `${base}/${hlsPrefix}/master.m3u8`,
        thumbnailKey ? `${base}/${thumbnailKey}` : null,
        duration,
      ],
    );

    console.log(`[worker] media ${mediaId} is READY (${variants.length} renditions)`);
  } catch (error) {
    console.error(`[worker] media ${mediaId} failed:`, (error as Error).message);
    await pool.query(`UPDATE media SET status = 'FAILED' WHERE id = $1`, [mediaId]);
    throw error;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function main(): void {
  if (!config.redis.enabled) {
    console.error('REDIS_ENABLED is false — the worker has nothing to consume. Exiting.');
    process.exit(1);
  }

  const worker = new Worker<TranscodeJobData>(QUEUE_NAMES.MEDIA, processTranscode, {
    connection: { url: config.redis.url },
    concurrency: Number.parseInt(process.env.WORKER_CONCURRENCY ?? '2', 10),
  });

  worker.on('completed', (job) => console.log(`[worker] job ${job.id} completed`));
  worker.on('failed', (job, error) =>
    console.error(`[worker] job ${job?.id} failed: ${error.message}`),
  );

  console.log(`[worker] listening on queue "${QUEUE_NAMES.MEDIA}"`);

  const shutdown = async (): Promise<void> => {
    console.log('[worker] shutting down');
    await worker.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main();
