import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { LiveClassProvider, UserRole, type LiveSessionInfo } from '../../packages/shared/src/index';
import { DatabaseService } from '../../db/database.service';
import { InstituteAccessService } from '../institutes/institute-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthenticatedUser } from '../../common/decorators';
import { AdobeConnectProvider } from './adobe-connect.provider';
import { BbbProvider } from './bbb.provider';
import type { CreateLiveSessionDto } from './dto/live-session.dto';

/** Students may enter this many minutes before the scheduled start. */
const JOIN_WINDOW_BEFORE_MINUTES = 15;
/** …and this many minutes after the scheduled end. */
const JOIN_WINDOW_AFTER_MINUTES = 30;

@Injectable()
export class LiveClassesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly access: InstituteAccessService,
    private readonly bbb: BbbProvider,
    private readonly adobe: AdobeConnectProvider,
    private readonly notifications: NotificationsService,
  ) {}

  async createSession(
    user: AuthenticatedUser,
    courseId: string,
    dto: CreateLiveSessionDto,
  ) {
    await this.access.assertCanManageCourse(user, courseId);

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (startsAt >= endsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    const provider = dto.provider ?? LiveClassProvider.BIG_BLUE_BUTTON;
    const moderatorPw = randomBytes(9).toString('base64url');
    const attendeePw = randomBytes(9).toString('base64url');

    const session = await this.database.db
      .insertInto('live_sessions')
      .values({
        course_id: courseId,
        instructor_id: dto.instructorId ?? null,
        provider,
        title: dto.title,
        starts_at: startsAt,
        ends_at: endsAt,
        moderator_pw: moderatorPw,
        attendee_pw: attendeePw,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Provision the remote room. The DB row stays valid even if the provider
    // is briefly unreachable — `join` will retry the create.
    const durationMinutes = Math.ceil((endsAt.getTime() - startsAt.getTime()) / 60_000);
    let externalRoomId: string | null = null;

    if (provider === LiveClassProvider.BIG_BLUE_BUTTON) {
      externalRoomId = `session-${session.id}`;
      await this.bbb.createMeeting({
        meetingId: externalRoomId,
        name: dto.title,
        moderatorPw,
        attendeePw,
        durationMinutes,
      });
    } else {
      const urlPath = `s${session.id.replace(/-/g, '').slice(0, 20)}`;
      externalRoomId = await this.adobe.createMeeting({
        name: dto.title,
        urlPath,
        startsAt,
        endsAt,
      });
      externalRoomId ??= urlPath;
    }

    await this.database.db
      .updateTable('live_sessions')
      .set({ external_room_id: externalRoomId })
      .where('id', '=', session.id)
      .execute();

    // Tell the enrolled students.
    const students = await this.database.db
      .selectFrom('enrollments')
      .select('student_id')
      .where('course_id', '=', courseId)
      .where('status', '=', 'ACTIVE')
      .execute();

    await Promise.all(
      students.map((s) =>
        this.notifications.create({
          userId: s.student_id,
          title: 'New live class scheduled',
          body: `${dto.title} starts at ${startsAt.toISOString()}.`,
          kind: 'LIVE_CLASS',
        }),
      ),
    );

    return { ...session, external_room_id: externalRoomId };
  }

  async listForCourse(
    user: AuthenticatedUser,
    courseId: string,
  ): Promise<LiveSessionInfo[]> {
    await this.access.assertCourseAccess(user, courseId);

    const rows = await this.database.db
      .selectFrom('live_sessions')
      .selectAll()
      .where('course_id', '=', courseId)
      .orderBy('starts_at', 'desc')
      .execute();

    const now = Date.now();
    return rows.map((row) => ({
      id: row.id,
      courseId: row.course_id,
      provider: row.provider as LiveClassProvider,
      title: row.title,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      isLive:
        now >= row.starts_at.getTime() - JOIN_WINDOW_BEFORE_MINUTES * 60_000 &&
        now <= row.ends_at.getTime() + JOIN_WINDOW_AFTER_MINUTES * 60_000,
      joinUrl: null, // Issued on demand by `join()`.
      recordingUrl: row.recording_url,
    }));
  }

  /**
   * Issues a signed, single-click join URL.
   *
   * Access is re-checked here rather than at listing time so a link cannot be
   * shared: the URL is generated per user, per request.
   */
  async join(
    user: AuthenticatedUser,
    sessionId: string,
  ): Promise<{ joinUrl: string; provider: LiveClassProvider; isModerator: boolean }> {
    const session = await this.database.db
      .selectFrom('live_sessions')
      .selectAll()
      .where('id', '=', sessionId)
      .executeTakeFirst();
    if (!session) throw new NotFoundException('Live session not found');

    await this.access.assertCourseAccess(user, session.course_id);

    const now = Date.now();
    const opensAt = session.starts_at.getTime() - JOIN_WINDOW_BEFORE_MINUTES * 60_000;
    const closesAt = session.ends_at.getTime() + JOIN_WINDOW_AFTER_MINUTES * 60_000;

    const isModerator = await this.isModerator(user, session.course_id);

    // Moderators may open the room early; students cannot.
    if (!isModerator && now < opensAt) {
      throw new ForbiddenException(
        `The room opens ${JOIN_WINDOW_BEFORE_MINUTES} minutes before the class starts`,
      );
    }
    if (now > closesAt) {
      throw new ForbiddenException('This session has ended');
    }

    if (session.provider === LiveClassProvider.BIG_BLUE_BUTTON) {
      const meetingId = session.external_room_id ?? `session-${session.id}`;

      // Re-create if the meeting is not running (BBB drops empty meetings).
      const running = await this.bbb.isMeetingRunning(meetingId);
      if (!running) {
        const durationMinutes = Math.ceil(
          (session.ends_at.getTime() - session.starts_at.getTime()) / 60_000,
        );
        await this.bbb.createMeeting({
          meetingId,
          name: session.title,
          moderatorPw: session.moderator_pw ?? 'mod',
          attendeePw: session.attendee_pw ?? 'att',
          durationMinutes,
        });
      }

      const joinUrl = this.bbb.buildJoinUrl({
        meetingId,
        fullName: user.fullName,
        password: isModerator
          ? (session.moderator_pw ?? 'mod')
          : (session.attendee_pw ?? 'att'),
        userId: user.id,
        isModerator,
      });

      return { joinUrl, provider: LiveClassProvider.BIG_BLUE_BUTTON, isModerator };
    }

    const joinUrl = await this.adobe.buildJoinUrl({
      roomUrlPath: session.external_room_id ?? '',
      login: user.email ?? `${user.phone}@institutes.local`,
      isModerator,
    });
    return { joinUrl, provider: LiveClassProvider.ADOBE_CONNECT, isModerator };
  }

  /** Pulls the recording URL from the provider once a session has finished. */
  async refreshRecording(user: AuthenticatedUser, sessionId: string) {
    const session = await this.database.db
      .selectFrom('live_sessions')
      .selectAll()
      .where('id', '=', sessionId)
      .executeTakeFirst();
    if (!session) throw new NotFoundException('Live session not found');
    await this.access.assertCanManageCourse(user, session.course_id);

    if (session.provider !== LiveClassProvider.BIG_BLUE_BUTTON) {
      throw new BadRequestException(
        'Recording lookup is only automated for BigBlueButton sessions',
      );
    }

    const url = await this.bbb.getRecordingUrl(
      session.external_room_id ?? `session-${session.id}`,
    );
    if (!url) return { recordingUrl: null, message: 'No recording is available yet' };

    await this.database.db
      .updateTable('live_sessions')
      .set({ recording_url: url })
      .where('id', '=', sessionId)
      .execute();

    return { recordingUrl: url, message: 'Recording linked' };
  }

  async deleteSession(user: AuthenticatedUser, sessionId: string) {
    const session = await this.database.db
      .selectFrom('live_sessions')
      .select(['id', 'course_id'])
      .where('id', '=', sessionId)
      .executeTakeFirst();
    if (!session) throw new NotFoundException('Live session not found');
    await this.access.assertCanManageCourse(user, session.course_id);

    await this.database.db
      .deleteFrom('live_sessions')
      .where('id', '=', sessionId)
      .execute();
    return { success: true };
  }

  /** Upcoming sessions across everything the student is enrolled in. */
  async myUpcoming(user: AuthenticatedUser): Promise<LiveSessionInfo[]> {
    const rows = await this.database.db
      .selectFrom('live_sessions as ls')
      .innerJoin('enrollments as e', 'e.course_id', 'ls.course_id')
      .selectAll('ls')
      .where('e.student_id', '=', user.id)
      .where('e.status', '=', 'ACTIVE')
      .where('ls.ends_at', '>', new Date())
      .orderBy('ls.starts_at', 'asc')
      .limit(50)
      .execute();

    const now = Date.now();
    return rows.map((row) => ({
      id: row.id,
      courseId: row.course_id,
      provider: row.provider as LiveClassProvider,
      title: row.title,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      isLive:
        now >= row.starts_at.getTime() - JOIN_WINDOW_BEFORE_MINUTES * 60_000 &&
        now <= row.ends_at.getTime() + JOIN_WINDOW_AFTER_MINUTES * 60_000,
      joinUrl: null,
      recordingUrl: row.recording_url,
    }));
  }

  private async isModerator(
    user: AuthenticatedUser,
    courseId: string,
  ): Promise<boolean> {
    if (user.role === UserRole.SUPER_ADMIN) return true;
    const row = await this.database.db
      .selectFrom('courses as c')
      .innerJoin('institute_members as m', 'm.institute_id', 'c.institute_id')
      .select('m.id')
      .where('c.id', '=', courseId)
      .where('m.user_id', '=', user.id)
      .executeTakeFirst();
    if (row) return true;

    // An instructor linked to the course is also a moderator.
    const instructor = await this.database.db
      .selectFrom('course_instructors as ci')
      .innerJoin('instructors as i', 'i.id', 'ci.instructor_id')
      .select('i.id')
      .where('ci.course_id', '=', courseId)
      .where('i.user_id', '=', user.id)
      .executeTakeFirst();
    return Boolean(instructor);
  }
}
