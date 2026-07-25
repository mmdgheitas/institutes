import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../db/database.service';
import { paginate } from '../../common/dto/pagination.dto';
import type { Paginated } from '../../packages/shared/src/index';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  kind: string;
  linkUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly database: DatabaseService) {}

  async create(input: {
    userId: string;
    title: string;
    body: string;
    kind?: string;
    linkUrl?: string;
  }): Promise<void> {
    await this.database.db
      .insertInto('notifications')
      .values({
        user_id: input.userId,
        title: input.title.slice(0, 200),
        body: input.body,
        kind: input.kind ?? 'SYSTEM',
        link_url: input.linkUrl ?? null,
      })
      .execute();
  }

  async list(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<Paginated<NotificationItem>> {
    const rows = await this.database.db
      .selectFrom('notifications')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .execute();

    const { count } = await this.database.db
      .selectFrom('notifications')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('user_id', '=', userId)
      .executeTakeFirstOrThrow();

    return paginate(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        kind: row.kind,
        linkUrl: row.link_url,
        readAt: row.read_at ? row.read_at.toISOString() : null,
        createdAt: row.created_at.toISOString(),
      })),
      Number(count),
      page,
      pageSize,
    );
  }

  async unreadCount(userId: string): Promise<number> {
    const { count } = await this.database.db
      .selectFrom('notifications')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('user_id', '=', userId)
      .where('read_at', 'is', null)
      .executeTakeFirstOrThrow();
    return Number(count);
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.database.db
      .updateTable('notifications')
      .set({ read_at: new Date() })
      .where('id', '=', notificationId)
      .where('user_id', '=', userId)
      .where('read_at', 'is', null)
      .execute();
  }

  async markAllRead(userId: string): Promise<void> {
    await this.database.db
      .updateTable('notifications')
      .set({ read_at: new Date() })
      .where('user_id', '=', userId)
      .where('read_at', 'is', null)
      .execute();
  }
}
