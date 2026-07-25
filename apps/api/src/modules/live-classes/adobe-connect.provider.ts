import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../../config/configuration';

/**
 * Adobe Connect API client.
 *
 * Adobe Connect uses a session cookie (`BREEZESESSION`) obtained from
 * `common-info`, then `login`. A join URL carrying that session behaves as SSO:
 * the user lands straight in the room without a second sign-in.
 */
@Injectable()
export class AdobeConnectProvider {
  private readonly logger = new Logger(AdobeConnectProvider.name);

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  private get settings() {
    return this.config.get('liveClass', { infer: true }).adobe;
  }

  private buildUrl(action: string, params: Record<string, string | number>): string {
    const query = new URLSearchParams({
      action,
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    });
    return `${this.settings.baseUrl}?${query.toString()}`;
  }

  /** Fetches a fresh BREEZESESSION cookie. */
  private async fetchSession(): Promise<string | null> {
    try {
      const response = await fetch(this.buildUrl('common-info', {}), {
        signal: AbortSignal.timeout(10_000),
      });
      const body = await response.text();
      const match = body.match(/<cookie>([^<]+)<\/cookie>/i);
      return match ? match[1] : null;
    } catch (error) {
      this.logger.error(`Adobe Connect session fetch failed: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Produces a one-click join URL for a participant.
   *
   * When the Adobe host is unreachable the plain room URL is returned so the
   * student still has a usable (login-required) link rather than an error page.
   */
  async buildJoinUrl(input: {
    roomUrlPath: string;
    login: string;
    isModerator: boolean;
  }): Promise<string> {
    const base = this.settings.baseUrl.replace(/\/api\/xml\/?$/, '');
    const roomUrl = `${base}/${input.roomUrlPath.replace(/^\//, '')}`;

    const session = await this.fetchSession();
    if (!session) return roomUrl;

    try {
      const loginUrl = this.buildUrl('login', {
        login: input.login,
        'external-auth': 'use',
        session,
      });
      await fetch(loginUrl, {
        headers: { Cookie: `BREEZESESSION=${session}` },
        signal: AbortSignal.timeout(10_000),
      });
      return `${roomUrl}?session=${encodeURIComponent(session)}`;
    } catch (error) {
      this.logger.warn(`Adobe Connect SSO failed, falling back: ${(error as Error).message}`);
      return roomUrl;
    }
  }

  /** Creates a meeting SCO and returns its url-path. */
  async createMeeting(input: {
    name: string;
    urlPath: string;
    startsAt: Date;
    endsAt: Date;
    folderId?: string;
  }): Promise<string | null> {
    const session = await this.fetchSession();
    if (!session) return null;

    try {
      const url = this.buildUrl('sco-update', {
        type: 'meeting',
        name: input.name.slice(0, 100),
        'url-path': input.urlPath,
        'date-begin': input.startsAt.toISOString(),
        'date-end': input.endsAt.toISOString(),
        ...(input.folderId ? { 'folder-id': input.folderId } : {}),
      });

      const response = await fetch(url, {
        headers: { Cookie: `BREEZESESSION=${session}` },
        signal: AbortSignal.timeout(15_000),
      });
      const body = await response.text();
      return /<status code="ok"\s*\/?>/i.test(body) ? input.urlPath : null;
    } catch (error) {
      this.logger.error(`Adobe Connect create failed: ${(error as Error).message}`);
      return null;
    }
  }
}
