import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import type { AppConfig } from '../../config/configuration';

/**
 * BigBlueButton API client.
 *
 * BBB authenticates every call with a checksum: SHA-1(callName + queryString +
 * sharedSecret). Join URLs are therefore signed links — a one-click SSO jump
 * with no separate login.
 */
@Injectable()
export class BbbProvider {
  private readonly logger = new Logger(BbbProvider.name);

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  private get settings() {
    return this.config.get('liveClass', { infer: true }).bbb;
  }

  /** Builds a checksum-signed BBB API URL. */
  buildUrl(callName: string, params: Record<string, string | number | boolean>): string {
    const query = new URLSearchParams(
      Object.entries(params).map(([key, value]): [string, string] => [key, String(value)]),
    ).toString();

    const checksum = createHash('sha1')
      .update(callName + query + this.settings.secret)
      .digest('hex');

    const base = this.settings.baseUrl.replace(/\/$/, '');
    return `${base}/${callName}?${query}&checksum=${checksum}`;
  }

  /**
   * Creates (or re-creates, which BBB treats as idempotent) the meeting room.
   * Returns false when the BBB server is unreachable so the caller can degrade
   * gracefully instead of failing the request.
   */
  async createMeeting(input: {
    meetingId: string;
    name: string;
    moderatorPw: string;
    attendeePw: string;
    durationMinutes: number;
    record?: boolean;
    welcome?: string;
  }): Promise<boolean> {
    const url = this.buildUrl('create', {
      meetingID: input.meetingId,
      name: input.name.slice(0, 100),
      moderatorPW: input.moderatorPw,
      attendeePW: input.attendeePw,
      duration: input.durationMinutes,
      record: input.record ?? true,
      autoStartRecording: false,
      allowStartStopRecording: true,
      welcome: input.welcome ?? `Welcome to ${input.name}`,
    });

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const body = await response.text();
      const success = response.ok && /<returncode>SUCCESS<\/returncode>/i.test(body);
      if (!success) {
        this.logger.warn(`BBB create failed for ${input.meetingId}: ${body.slice(0, 300)}`);
      }
      return success;
    } catch (error) {
      this.logger.error(`BBB create unreachable: ${(error as Error).message}`);
      return false;
    }
  }

  /** Signed join URL — this is the "one-click SSO jump". */
  buildJoinUrl(input: {
    meetingId: string;
    fullName: string;
    password: string;
    userId: string;
    isModerator: boolean;
  }): string {
    return this.buildUrl('join', {
      meetingID: input.meetingId,
      fullName: input.fullName,
      password: input.password,
      userID: input.userId,
      role: input.isModerator ? 'MODERATOR' : 'VIEWER',
      redirect: true,
    });
  }

  async isMeetingRunning(meetingId: string): Promise<boolean> {
    try {
      const response = await fetch(this.buildUrl('isMeetingRunning', { meetingID: meetingId }), {
        signal: AbortSignal.timeout(8000),
      });
      const body = await response.text();
      return /<running>true<\/running>/i.test(body);
    } catch {
      return false;
    }
  }

  async getRecordingUrl(meetingId: string): Promise<string | null> {
    try {
      const response = await fetch(this.buildUrl('getRecordings', { meetingID: meetingId }), {
        signal: AbortSignal.timeout(10_000),
      });
      const body = await response.text();
      const match = body.match(/<url>([^<]+)<\/url>/i);
      return match ? match[1] : null;
    } catch (error) {
      this.logger.warn(`BBB recordings lookup failed: ${(error as Error).message}`);
      return null;
    }
  }
}
