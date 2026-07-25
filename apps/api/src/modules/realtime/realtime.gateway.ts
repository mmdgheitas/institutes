import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { UserRole } from '@institutes/shared';
import type { AppConfig } from '../../config/configuration';
import { DatabaseService } from '../../db/database.service';

interface SocketUser {
  id: string;
  role: UserRole;
  fullName: string;
  instituteIds: string[];
}

/**
 * Socket.IO gateway for the CRM board, quiz proctoring signals and chat.
 *
 * Rooms:
 *   user:<id>        — personal notifications
 *   institute:<id>   — live Kanban updates for staff
 *   attempt:<id>     — quiz countdown / anti-cheat channel
 */
@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly users = new Map<string, SocketUser>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly database: DatabaseService,
  ) {}

  /** Authenticates the socket from the handshake token and joins its rooms. */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.headers.authorization as string | undefined)?.replace(
          /^Bearer\s+/i,
          '',
        );

      if (!token) {
        client.emit('error', { message: 'Authentication token is required' });
        client.disconnect(true);
        return;
      }

      const payload = await this.jwt.verifyAsync<{
        sub: string;
        role: UserRole;
        inst?: string[];
        type: string;
      }>(token, { secret: this.config.get('jwt', { infer: true }).accessSecret });

      if (payload.type !== 'access') {
        client.disconnect(true);
        return;
      }

      const user = await this.database.db
        .selectFrom('users')
        .select(['id', 'full_name', 'role', 'is_active'])
        .where('id', '=', payload.sub)
        .executeTakeFirst();

      if (!user || !user.is_active) {
        client.disconnect(true);
        return;
      }

      const socketUser: SocketUser = {
        id: user.id,
        role: user.role as UserRole,
        fullName: user.full_name,
        instituteIds: payload.inst ?? [],
      };
      this.users.set(client.id, socketUser);

      await client.join(`user:${user.id}`);
      for (const instituteId of socketUser.instituteIds) {
        await client.join(`institute:${instituteId}`);
      }

      client.emit('connected', { userId: user.id, rooms: socketUser.instituteIds });
    } catch (error) {
      this.logger.warn(`Rejected socket ${client.id}: ${(error as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.users.delete(client.id);
  }

  /** Students subscribe to their own attempt channel for countdown sync. */
  @SubscribeMessage('attempt:subscribe')
  async subscribeAttempt(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { attemptId: string },
  ): Promise<{ ok: boolean; message?: string }> {
    const user = this.users.get(client.id);
    if (!user) return { ok: false, message: 'Not authenticated' };

    const attempt = await this.database.db
      .selectFrom('quiz_attempts')
      .select(['id', 'student_id', 'expires_at', 'status'])
      .where('id', '=', body.attemptId)
      .executeTakeFirst();

    if (!attempt || attempt.student_id !== user.id) {
      return { ok: false, message: 'Attempt not found' };
    }

    await client.join(`attempt:${attempt.id}`);
    client.emit('attempt:state', {
      attemptId: attempt.id,
      status: attempt.status,
      expiresAt: attempt.expires_at.toISOString(),
      serverTime: new Date().toISOString(),
    });
    return { ok: true };
  }

  /**
   * Anti-cheat: the client reports focus loss immediately so proctors see it
   * live even if the student never syncs again.
   */
  @SubscribeMessage('attempt:focus-lost')
  async reportFocusLoss(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { attemptId: string; count: number },
  ): Promise<{ ok: boolean }> {
    const user = this.users.get(client.id);
    if (!user) return { ok: false };

    const attempt = await this.database.db
      .selectFrom('quiz_attempts')
      .select(['id', 'student_id', 'quiz_id', 'focus_loss_count'])
      .where('id', '=', body.attemptId)
      .executeTakeFirst();
    if (!attempt || attempt.student_id !== user.id) return { ok: false };

    const count = Math.max(attempt.focus_loss_count, Math.max(0, body.count | 0));
    await this.database.db
      .updateTable('quiz_attempts')
      .set({ focus_loss_count: count })
      .where('id', '=', attempt.id)
      .execute();

    const quiz = await this.database.db
      .selectFrom('quizzes as q')
      .innerJoin('courses as c', 'c.id', 'q.course_id')
      .select(['c.institute_id', 'q.max_focus_losses', 'q.anti_cheat_enabled'])
      .where('q.id', '=', attempt.quiz_id)
      .executeTakeFirst();

    if (quiz) {
      this.server.to(`institute:${quiz.institute_id}`).emit('proctor:focus-loss', {
        attemptId: attempt.id,
        studentName: user.fullName,
        count,
        limit: quiz.max_focus_losses,
        at: new Date().toISOString(),
      });

      if (quiz.anti_cheat_enabled && count > quiz.max_focus_losses) {
        this.server.to(`attempt:${attempt.id}`).emit('attempt:voided', {
          attemptId: attempt.id,
          reason: 'FOCUS_LOSS_LIMIT',
        });
      }
    }

    return { ok: true };
  }

  /* ------------------------------------------------ server-side emits --- */

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  emitToInstitute(instituteId: string, event: string, payload: unknown): void {
    this.server?.to(`institute:${instituteId}`).emit(event, payload);
  }

  /** Broadcast a Kanban move so every open dashboard stays in sync. */
  emitLeadMoved(
    instituteId: string,
    payload: { submissionId: string; from: string; to: string; actor: string },
  ): void {
    this.emitToInstitute(instituteId, 'lead:moved', payload);
  }
}
