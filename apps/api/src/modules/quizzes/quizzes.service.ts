import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AttemptStatus,
  QuestionType,
  UserRole,
  type QuizAnswerValue,
  type QuizAttemptState,
  type QuizQuestionPublic,
  type QuizResult,
  type QuizSummary,
  type QuizSyncResponse,
} from '../../packages/shared/src/index';
import { DatabaseService } from '../../db/database.service';
import { InstituteAccessService } from '../institutes/institute-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { AuthenticatedUser } from '../../common/decorators';
import type { QuizOptionsJson } from '../../db/schema';
import {
  gradeAnswer,
  seededShuffle,
  summarizeAttempt,
  type GradableQuestion,
} from './quiz-grading';
import type {
  CreateQuestionDto,
  CreateQuizDto,
  GradeAttemptDto,
  SyncAttemptDto,
  UpdateQuizDto,
} from './dto/quiz.dto';

/** Grace period allowed for network latency when accepting a late submission. */
const SUBMIT_GRACE_SECONDS = 10;

@Injectable()
export class QuizzesService {
  private readonly logger = new Logger(QuizzesService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly access: InstituteAccessService,
    private readonly notifications: NotificationsService,
  ) {}

  /* ------------------------------------------------------- authoring --- */

  async createQuiz(user: AuthenticatedUser, courseId: string, dto: CreateQuizDto) {
    await this.access.assertCanManageCourse(user, courseId);
    this.assertWindowValid(dto.opensAt, dto.closesAt);
    if (dto.passingScore != null && dto.maxScore != null && dto.passingScore > dto.maxScore) {
      throw new BadRequestException('passingScore cannot exceed maxScore');
    }

    return this.database.transaction(async (trx) => {
      const quiz = await trx
        .insertInto('quizzes')
        .values({
          course_id: courseId,
          title: dto.title,
          description: dto.description ?? null,
          time_limit_seconds: dto.timeLimitSeconds ?? 1800,
          max_score: dto.maxScore ?? 100,
          passing_score: dto.passingScore ?? 50,
          shuffle_questions: dto.shuffleQuestions ?? true,
          shuffle_options: dto.shuffleOptions ?? true,
          anti_cheat_enabled: dto.antiCheatEnabled ?? true,
          max_focus_losses: dto.maxFocusLosses ?? 3,
          attempts_allowed: dto.attemptsAllowed ?? 1,
          opens_at: dto.opensAt ? new Date(dto.opensAt) : null,
          closes_at: dto.closesAt ? new Date(dto.closesAt) : null,
          is_published: dto.isPublished ?? false,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      if (dto.questions?.length) {
        const rows = dto.questions.map((question, index) =>
          this.buildQuestionRow(quiz.id, question, index),
        );
        await trx.insertInto('quiz_questions').values(rows).execute();
      }

      return quiz;
    });
  }

  async updateQuiz(user: AuthenticatedUser, quizId: string, dto: UpdateQuizDto) {
    await this.access.assertCanManageQuiz(user, quizId);
    this.assertWindowValid(dto.opensAt, dto.closesAt);

    // Changing the question set while people are mid-exam would corrupt scores.
    if (dto.questions) {
      const live = await this.database.db
        .selectFrom('quiz_attempts')
        .select('id')
        .where('quiz_id', '=', quizId)
        .where('status', '=', AttemptStatus.IN_PROGRESS)
        .executeTakeFirst();
      if (live) {
        throw new BadRequestException(
          'Questions cannot be edited while an attempt is in progress',
        );
      }
    }

    const patch: Record<string, unknown> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.timeLimitSeconds !== undefined) patch.time_limit_seconds = dto.timeLimitSeconds;
    if (dto.maxScore !== undefined) patch.max_score = dto.maxScore;
    if (dto.passingScore !== undefined) patch.passing_score = dto.passingScore;
    if (dto.shuffleQuestions !== undefined) patch.shuffle_questions = dto.shuffleQuestions;
    if (dto.shuffleOptions !== undefined) patch.shuffle_options = dto.shuffleOptions;
    if (dto.antiCheatEnabled !== undefined) patch.anti_cheat_enabled = dto.antiCheatEnabled;
    if (dto.maxFocusLosses !== undefined) patch.max_focus_losses = dto.maxFocusLosses;
    if (dto.attemptsAllowed !== undefined) patch.attempts_allowed = dto.attemptsAllowed;
    if (dto.opensAt !== undefined) patch.opens_at = new Date(dto.opensAt);
    if (dto.closesAt !== undefined) patch.closes_at = new Date(dto.closesAt);
    if (dto.isPublished !== undefined) patch.is_published = dto.isPublished;

    return this.database.transaction(async (trx) => {
      if (Object.keys(patch).length > 0) {
        await trx
          .updateTable('quizzes')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .set(patch as any)
          .where('id', '=', quizId)
          .execute();
      }

      if (dto.questions) {
        await trx.deleteFrom('quiz_questions').where('quiz_id', '=', quizId).execute();
        if (dto.questions.length > 0) {
          await trx
            .insertInto('quiz_questions')
            .values(
              dto.questions.map((question, index) =>
                this.buildQuestionRow(quizId, question, index),
              ),
            )
            .execute();
        }
      }

      return trx
        .selectFrom('quizzes')
        .selectAll()
        .where('id', '=', quizId)
        .executeTakeFirstOrThrow();
    });
  }

  /** Authoring view — includes the answer key. */
  async getQuizForAuthoring(user: AuthenticatedUser, quizId: string) {
    await this.access.assertCanManageQuiz(user, quizId);
    const quiz = await this.database.db
      .selectFrom('quizzes')
      .selectAll()
      .where('id', '=', quizId)
      .executeTakeFirstOrThrow();

    const questions = await this.database.db
      .selectFrom('quiz_questions')
      .selectAll()
      .where('quiz_id', '=', quizId)
      .orderBy('position')
      .execute();

    return {
      ...this.toSummary(quiz, questions.length),
      questions: questions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        points: q.points,
        options: (q.options ?? []) as QuizOptionsJson,
        correctOptionIds: q.correct_option_ids,
        correctText: q.correct_text,
        explanation: q.explanation,
        allowedMimeTypes: q.allowed_mime_types,
        position: q.position,
      })),
    };
  }

  async listQuizzes(user: AuthenticatedUser, courseId: string): Promise<QuizSummary[]> {
    await this.access.assertCourseAccess(user, courseId);

    const isStaff = await this.isStaffOfCourse(user, courseId);
    let query = this.database.db
      .selectFrom('quizzes as q')
      .leftJoin('quiz_questions as qq', 'qq.quiz_id', 'q.id')
      .selectAll('q')
      .select((eb) => eb.fn.count<number>('qq.id').as('question_count'))
      .where('q.course_id', '=', courseId)
      .groupBy('q.id');

    if (!isStaff) query = query.where('q.is_published', '=', true);

    const rows = await query.orderBy('q.created_at', 'desc').execute();
    return rows.map((row) => this.toSummary(row, Number(row.question_count)));
  }

  async deleteQuiz(user: AuthenticatedUser, quizId: string) {
    await this.access.assertCanManageQuiz(user, quizId);
    await this.database.db.deleteFrom('quizzes').where('id', '=', quizId).execute();
    return { success: true };
  }

  /* ------------------------------------------------------- attempts ---- */

  /**
   * Starts (or resumes) an attempt.
   *
   * The deadline is computed and stored server-side; the client only renders a
   * countdown derived from `expiresAt`. Question and option order are
   * randomized once and persisted so a refresh is not an advantage.
   */
  async startAttempt(
    user: AuthenticatedUser,
    quizId: string,
    ip: string,
  ): Promise<QuizAttemptState> {
    const quiz = await this.database.db
      .selectFrom('quizzes')
      .selectAll()
      .where('id', '=', quizId)
      .executeTakeFirst();
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (!quiz.is_published) throw new ForbiddenException('This quiz is not published yet');

    await this.access.assertCourseAccess(user, quiz.course_id);

    const now = new Date();
    if (quiz.opens_at && now < quiz.opens_at) {
      throw new ForbiddenException(
        `This quiz opens at ${quiz.opens_at.toISOString()}`,
      );
    }
    if (quiz.closes_at && now > quiz.closes_at) {
      throw new ForbiddenException('This quiz has closed');
    }

    // Resume an in-progress attempt if one is still within its time limit.
    const existing = await this.database.db
      .selectFrom('quiz_attempts')
      .selectAll()
      .where('quiz_id', '=', quizId)
      .where('student_id', '=', user.id)
      .where('status', '=', AttemptStatus.IN_PROGRESS)
      .executeTakeFirst();

    if (existing) {
      if (existing.expires_at <= now) {
        await this.finalizeAttempt(existing.id, AttemptStatus.AUTO_SUBMITTED);
        throw new ForbiddenException('Your previous attempt expired and was submitted');
      }
      return this.buildAttemptState(existing.id);
    }

    const usedAttempts = await this.database.db
      .selectFrom('quiz_attempts')
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .where('quiz_id', '=', quizId)
      .where('student_id', '=', user.id)
      .where('status', '!=', AttemptStatus.VOIDED)
      .executeTakeFirstOrThrow();

    if (Number(usedAttempts.count) >= quiz.attempts_allowed) {
      throw new ForbiddenException(
        `You have used all ${quiz.attempts_allowed} permitted attempt(s)`,
      );
    }

    const questions = await this.database.db
      .selectFrom('quiz_questions')
      .selectAll()
      .where('quiz_id', '=', quizId)
      .orderBy('position')
      .execute();

    if (questions.length === 0) {
      throw new BadRequestException('This quiz has no questions yet');
    }

    const attemptSeed = randomUUID();
    const orderedIds = quiz.shuffle_questions
      ? seededShuffle(
          questions.map((q) => q.id),
          attemptSeed,
        )
      : questions.map((q) => q.id);

    const optionOrder: Record<string, string[]> = {};
    if (quiz.shuffle_options) {
      for (const question of questions) {
        const options = (question.options ?? []) as QuizOptionsJson;
        if (options.length > 1) {
          optionOrder[question.id] = seededShuffle(
            options.map((o) => o.id),
            `${attemptSeed}:${question.id}`,
          );
        }
      }
    }

    // Never let an attempt outlive the quiz close time.
    let expiresAt = new Date(now.getTime() + quiz.time_limit_seconds * 1000);
    if (quiz.closes_at && expiresAt > quiz.closes_at) expiresAt = quiz.closes_at;

    const attempt = await this.database.db
      .insertInto('quiz_attempts')
      .values({
        quiz_id: quizId,
        student_id: user.id,
        status: AttemptStatus.IN_PROGRESS,
        started_at: now,
        expires_at: expiresAt,
        max_score: quiz.max_score,
        question_order: orderedIds,
        option_order: JSON.stringify(optionOrder),
        ip_address: ip.slice(0, 64),
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    return this.buildAttemptState(attempt.id);
  }

  async getAttempt(user: AuthenticatedUser, attemptId: string): Promise<QuizAttemptState> {
    const attempt = await this.requireOwnAttempt(user, attemptId);
    return this.buildAttemptState(attempt.id);
  }

  /**
   * Persists answers coming from the Flutter/web client, including batches
   * queued while offline.
   *
   * Conflict rule: an incoming answer wins only when its `clientUpdatedAt` is
   * newer than the stored one — so a stale offline queue can never overwrite a
   * more recent online edit.
   */
  async syncAttempt(
    user: AuthenticatedUser,
    attemptId: string,
    dto: SyncAttemptDto,
  ): Promise<QuizSyncResponse> {
    const attempt = await this.requireOwnAttempt(user, attemptId);
    const now = new Date();

    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      // Late offline flush after submission: accept nothing, report the state.
      return {
        attemptId,
        syncVersion: attempt.sync_version,
        secondsRemaining: 0,
        status: attempt.status as QuizSyncResponse['status'],
        accepted: [],
        rejected: dto.answers.map((a) => ({
          questionId: a.questionId,
          reason: 'ATTEMPT_CLOSED',
        })),
      };
    }

    const expired = attempt.expires_at.getTime() + SUBMIT_GRACE_SECONDS * 1000 < now.getTime();
    if (expired) {
      await this.finalizeAttempt(attemptId, AttemptStatus.AUTO_SUBMITTED);
      return {
        attemptId,
        syncVersion: attempt.sync_version + 1,
        secondsRemaining: 0,
        status: AttemptStatus.AUTO_SUBMITTED,
        accepted: [],
        rejected: dto.answers.map((a) => ({ questionId: a.questionId, reason: 'EXPIRED' })),
      };
    }

    const quiz = await this.database.db
      .selectFrom('quizzes')
      .select(['anti_cheat_enabled', 'max_focus_losses'])
      .where('id', '=', attempt.quiz_id)
      .executeTakeFirstOrThrow();

    const validQuestionIds = new Set(attempt.question_order);
    const accepted: string[] = [];
    const rejected: { questionId: string; reason: string }[] = [];

    await this.database.transaction(async (trx) => {
      for (const incoming of dto.answers) {
        if (!validQuestionIds.has(incoming.questionId)) {
          rejected.push({ questionId: incoming.questionId, reason: 'UNKNOWN_QUESTION' });
          continue;
        }

        const value = this.parseAnswerValue(incoming.value);
        if (!value) {
          rejected.push({ questionId: incoming.questionId, reason: 'MALFORMED_VALUE' });
          continue;
        }

        const clientUpdatedAt = new Date(incoming.clientUpdatedAt);
        if (Number.isNaN(clientUpdatedAt.getTime())) {
          rejected.push({ questionId: incoming.questionId, reason: 'BAD_TIMESTAMP' });
          continue;
        }

        const current = await trx
          .selectFrom('quiz_answers')
          .select(['id', 'client_updated_at'])
          .where('attempt_id', '=', attemptId)
          .where('question_id', '=', incoming.questionId)
          .executeTakeFirst();

        if (current && current.client_updated_at >= clientUpdatedAt) {
          rejected.push({ questionId: incoming.questionId, reason: 'STALE' });
          continue;
        }

        if (current) {
          await trx
            .updateTable('quiz_answers')
            .set({
              value: JSON.stringify(value),
              client_updated_at: clientUpdatedAt,
            })
            .where('id', '=', current.id)
            .execute();
        } else {
          await trx
            .insertInto('quiz_answers')
            .values({
              attempt_id: attemptId,
              question_id: incoming.questionId,
              value: JSON.stringify(value),
              client_updated_at: clientUpdatedAt,
            })
            .execute();
        }
        accepted.push(incoming.questionId);
      }

      const focusLosses =
        dto.focusLossCount != null
          ? Math.max(attempt.focus_loss_count, dto.focusLossCount)
          : attempt.focus_loss_count;

      await trx
        .updateTable('quiz_attempts')
        .set({
          sync_version: attempt.sync_version + 1,
          focus_loss_count: focusLosses,
        })
        .where('id', '=', attemptId)
        .execute();
    });

    const focusLosses =
      dto.focusLossCount != null
        ? Math.max(attempt.focus_loss_count, dto.focusLossCount)
        : attempt.focus_loss_count;

    // Anti-cheat: too many focus losses ends the attempt immediately.
    if (quiz.anti_cheat_enabled && focusLosses > quiz.max_focus_losses) {
      await this.finalizeAttempt(attemptId, AttemptStatus.AUTO_SUBMITTED, {
        reason: 'FOCUS_LOSS_LIMIT',
      });
      return {
        attemptId,
        syncVersion: attempt.sync_version + 1,
        secondsRemaining: 0,
        status: AttemptStatus.AUTO_SUBMITTED,
        accepted,
        rejected,
      };
    }

    return {
      attemptId,
      syncVersion: attempt.sync_version + 1,
      secondsRemaining: Math.max(
        0,
        Math.floor((attempt.expires_at.getTime() - now.getTime()) / 1000),
      ),
      status: AttemptStatus.IN_PROGRESS,
      accepted,
      rejected,
    };
  }

  async submitAttempt(user: AuthenticatedUser, attemptId: string): Promise<QuizResult> {
    const attempt = await this.requireOwnAttempt(user, attemptId);
    if (attempt.status !== AttemptStatus.IN_PROGRESS) {
      return this.getResult(user, attemptId);
    }

    const now = Date.now();
    const late = attempt.expires_at.getTime() + SUBMIT_GRACE_SECONDS * 1000 < now;
    await this.finalizeAttempt(
      attemptId,
      late ? AttemptStatus.AUTO_SUBMITTED : AttemptStatus.SUBMITTED,
    );
    return this.getResult(user, attemptId);
  }

  /**
   * Grades and closes an attempt. Called by the student, by the expiry cron and
   * by the anti-cheat rule — hence idempotent.
   */
  async finalizeAttempt(
    attemptId: string,
    status: AttemptStatus,
    meta: { reason?: string } = {},
  ): Promise<void> {
    await this.database.transaction(async (trx) => {
      const attempt = await trx
        .selectFrom('quiz_attempts')
        .selectAll()
        .where('id', '=', attemptId)
        .forUpdate()
        .executeTakeFirst();
      if (!attempt || attempt.status !== AttemptStatus.IN_PROGRESS) return;

      const quiz = await trx
        .selectFrom('quizzes')
        .select(['max_score', 'course_id', 'title'])
        .where('id', '=', attempt.quiz_id)
        .executeTakeFirstOrThrow();

      const questions = await trx
        .selectFrom('quiz_questions')
        .selectAll()
        .where('quiz_id', '=', attempt.quiz_id)
        .execute();

      const answers = await trx
        .selectFrom('quiz_answers')
        .selectAll()
        .where('attempt_id', '=', attemptId)
        .execute();

      const answerByQuestion = new Map(
        answers.map((a) => [a.question_id, this.parseAnswerValue(a.value)]),
      );

      const gradable: GradableQuestion[] = questions.map((q) => ({
        id: q.id,
        type: q.type as QuestionType,
        points: q.points,
        correctOptionIds: q.correct_option_ids,
        correctText: q.correct_text,
      }));

      const graded = gradable.map((question) =>
        gradeAnswer(question, answerByQuestion.get(question.id) ?? undefined),
      );

      for (const result of graded) {
        const existing = answers.find((a) => a.question_id === result.questionId);
        if (existing) {
          await trx
            .updateTable('quiz_answers')
            .set({
              awarded_points: result.awardedPoints,
              is_correct: result.isCorrect,
              needs_manual_grade: result.needsManualGrade,
            })
            .where('id', '=', existing.id)
            .execute();
        } else if (!result.needsManualGrade) {
          // Record the zero so the breakdown is complete.
          await trx
            .insertInto('quiz_answers')
            .values({
              attempt_id: attemptId,
              question_id: result.questionId,
              value: JSON.stringify({ type: 'TEXT', text: '' }),
              awarded_points: 0,
              is_correct: false,
              needs_manual_grade: false,
              client_updated_at: new Date(),
            })
            .execute();
        }
      }

      const summary = summarizeAttempt(gradable, graded, quiz.max_score);

      await trx
        .updateTable('quiz_attempts')
        .set({
          status: summary.fullyGraded ? AttemptStatus.GRADED : status,
          submitted_at: new Date(),
          graded_at: summary.fullyGraded ? new Date() : null,
          score: summary.scaledScore,
          sync_version: attempt.sync_version + 1,
        })
        .where('id', '=', attemptId)
        .execute();

      if (meta.reason) {
        this.logger.warn(`Attempt ${attemptId} auto-submitted: ${meta.reason}`);
      }
    });
  }

  async getResult(user: AuthenticatedUser, attemptId: string): Promise<QuizResult> {
    const attempt = await this.database.db
      .selectFrom('quiz_attempts')
      .selectAll()
      .where('id', '=', attemptId)
      .executeTakeFirst();
    if (!attempt) throw new NotFoundException('Attempt not found');

    const quiz = await this.database.db
      .selectFrom('quizzes')
      .select(['id', 'course_id', 'max_score', 'passing_score'])
      .where('id', '=', attempt.quiz_id)
      .executeTakeFirstOrThrow();

    if (attempt.student_id !== user.id) {
      // Staff may inspect any attempt of their own course.
      await this.access.assertCanManageCourse(user, quiz.course_id);
    }

    const rows = await this.database.db
      .selectFrom('quiz_questions as q')
      .leftJoin('quiz_answers as a', (join) =>
        join.onRef('a.question_id', '=', 'q.id').on('a.attempt_id', '=', attemptId),
      )
      .select([
        'q.id',
        'q.prompt',
        'q.points',
        'a.awarded_points',
        'a.is_correct',
        'a.needs_manual_grade',
        'a.feedback',
      ])
      .where('q.quiz_id', '=', attempt.quiz_id)
      .orderBy('q.position')
      .execute();

    const autoGradedPoints = rows.reduce(
      (sum, row) => sum + (row.needs_manual_grade ? 0 : (row.awarded_points ?? 0)),
      0,
    );
    const pendingManualPoints = rows.reduce(
      (sum, row) =>
        sum + (row.needs_manual_grade && row.awarded_points == null ? row.points : 0),
      0,
    );

    return {
      attemptId,
      status: attempt.status as AttemptStatus,
      score: attempt.score ?? 0,
      maxScore: quiz.max_score,
      passed: (attempt.score ?? 0) >= quiz.passing_score,
      autoGradedPoints: Number(autoGradedPoints.toFixed(2)),
      pendingManualPoints: Number(pendingManualPoints.toFixed(2)),
      submittedAt: attempt.submitted_at ? attempt.submitted_at.toISOString() : null,
      gradedAt: attempt.graded_at ? attempt.graded_at.toISOString() : null,
      breakdown: rows.map((row) => ({
        questionId: row.id,
        prompt: row.prompt,
        points: row.points,
        awarded: row.awarded_points,
        isCorrect: row.is_correct,
        needsManualGrading: row.needs_manual_grade ?? false,
        feedback: row.feedback,
      })),
    };
  }

  /* -------------------------------------------------- manual grading --- */

  async listAttemptsForGrading(user: AuthenticatedUser, quizId: string) {
    await this.access.assertCanManageQuiz(user, quizId);
    return this.database.db
      .selectFrom('quiz_attempts as a')
      .innerJoin('users as u', 'u.id', 'a.student_id')
      .leftJoin('quiz_answers as ans', (join) =>
        join.onRef('ans.attempt_id', '=', 'a.id').on('ans.needs_manual_grade', '=', true),
      )
      .select([
        'a.id',
        'a.status',
        'a.score',
        'a.max_score',
        'a.submitted_at',
        'a.focus_loss_count',
        'u.full_name',
        'u.phone',
        (eb) => eb.fn.count<number>('ans.id').as('pending_manual'),
      ])
      .where('a.quiz_id', '=', quizId)
      .where('a.status', '!=', AttemptStatus.IN_PROGRESS)
      .groupBy(['a.id', 'u.full_name', 'u.phone'])
      .orderBy('a.submitted_at', 'desc')
      .execute();
  }

  /** Teacher grades essay / file answers; recomputes and closes the attempt. */
  async gradeAttempt(user: AuthenticatedUser, attemptId: string, dto: GradeAttemptDto) {
    const attempt = await this.database.db
      .selectFrom('quiz_attempts')
      .selectAll()
      .where('id', '=', attemptId)
      .executeTakeFirst();
    if (!attempt) throw new NotFoundException('Attempt not found');
    await this.access.assertCanManageQuiz(user, attempt.quiz_id);

    if (attempt.status === AttemptStatus.IN_PROGRESS) {
      throw new BadRequestException('This attempt has not been submitted yet');
    }

    const questions = await this.database.db
      .selectFrom('quiz_questions')
      .selectAll()
      .where('quiz_id', '=', attempt.quiz_id)
      .execute();
    const questionById = new Map(questions.map((q) => [q.id, q]));

    for (const grade of dto.grades) {
      const question = questionById.get(grade.questionId);
      if (!question) {
        throw new BadRequestException(`Question ${grade.questionId} is not in this quiz`);
      }
      if (grade.awardedPoints > question.points) {
        throw new BadRequestException(
          `Awarded points for "${question.prompt.slice(0, 40)}" exceed the maximum of ${question.points}`,
        );
      }
    }

    await this.database.transaction(async (trx) => {
      for (const grade of dto.grades) {
        const question = questionById.get(grade.questionId)!;
        const existing = await trx
          .selectFrom('quiz_answers')
          .select('id')
          .where('attempt_id', '=', attemptId)
          .where('question_id', '=', grade.questionId)
          .executeTakeFirst();

        if (existing) {
          await trx
            .updateTable('quiz_answers')
            .set({
              awarded_points: grade.awardedPoints,
              is_correct: grade.awardedPoints >= question.points,
              needs_manual_grade: false,
              feedback: grade.feedback ?? null,
            })
            .where('id', '=', existing.id)
            .execute();
        } else {
          await trx
            .insertInto('quiz_answers')
            .values({
              attempt_id: attemptId,
              question_id: grade.questionId,
              value: JSON.stringify({ type: 'TEXT', text: '' }),
              awarded_points: grade.awardedPoints,
              is_correct: grade.awardedPoints >= question.points,
              needs_manual_grade: false,
              feedback: grade.feedback ?? null,
              client_updated_at: new Date(),
            })
            .execute();
        }
      }

      const answers = await trx
        .selectFrom('quiz_answers')
        .selectAll()
        .where('attempt_id', '=', attemptId)
        .execute();

      const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
      const awarded = answers.reduce((sum, a) => sum + (a.awarded_points ?? 0), 0);
      const stillPending = answers.some((a) => a.needs_manual_grade);
      const scaled =
        totalPoints > 0 ? Number(((awarded * attempt.max_score) / totalPoints).toFixed(2)) : 0;

      await trx
        .updateTable('quiz_attempts')
        .set({
          score: scaled,
          status: stillPending ? attempt.status : AttemptStatus.GRADED,
          graded_at: stillPending ? null : new Date(),
          graded_by_id: user.id,
        })
        .where('id', '=', attemptId)
        .execute();
    });

    await this.notifications.create({
      userId: attempt.student_id,
      title: 'Your quiz has been graded',
      body: 'Open the course page to see your score and feedback.',
      kind: 'QUIZ_GRADED',
    });

    return this.getResult(user, attemptId);
  }

  /** Cron entry point: force-submit every attempt past its deadline. */
  async expireOverdueAttempts(): Promise<number> {
    const overdue = await this.database.db
      .selectFrom('quiz_attempts')
      .select('id')
      .where('status', '=', AttemptStatus.IN_PROGRESS)
      .where('expires_at', '<', new Date())
      .limit(500)
      .execute();

    for (const attempt of overdue) {
      try {
        await this.finalizeAttempt(attempt.id, AttemptStatus.AUTO_SUBMITTED, {
          reason: 'TIME_LIMIT',
        });
      } catch (error) {
        this.logger.error(
          `Failed to auto-submit attempt ${attempt.id}: ${(error as Error).message}`,
        );
      }
    }
    return overdue.length;
  }

  /* --------------------------------------------------------- helpers --- */

  private async requireOwnAttempt(user: AuthenticatedUser, attemptId: string) {
    const attempt = await this.database.db
      .selectFrom('quiz_attempts')
      .selectAll()
      .where('id', '=', attemptId)
      .executeTakeFirst();
    if (!attempt) throw new NotFoundException('Attempt not found');
    if (attempt.student_id !== user.id) {
      throw new ForbiddenException('This attempt belongs to another student');
    }
    return attempt;
  }

  /** Builds the student-facing attempt state (no answer keys, ordered per attempt). */
  private async buildAttemptState(attemptId: string): Promise<QuizAttemptState> {
    const attempt = await this.database.db
      .selectFrom('quiz_attempts')
      .selectAll()
      .where('id', '=', attemptId)
      .executeTakeFirstOrThrow();

    const questions = await this.database.db
      .selectFrom('quiz_questions')
      .selectAll()
      .where('quiz_id', '=', attempt.quiz_id)
      .execute();

    const optionOrder = (attempt.option_order ?? {}) as Record<string, string[]>;
    const byId = new Map(questions.map((q) => [q.id, q]));

    const ordered: QuizQuestionPublic[] = attempt.question_order
      .map((id, index): QuizQuestionPublic | null => {
        const question = byId.get(id);
        if (!question) return null;

        let options = (question.options ?? []) as QuizOptionsJson;
        const order = optionOrder[question.id];
        if (order?.length) {
          const optionById = new Map(options.map((o) => [o.id, o]));
          options = order
            .map((optionId) => optionById.get(optionId))
            .filter((o): o is { id: string; text: string } => Boolean(o));
        }

        return {
          id: question.id,
          type: question.type as QuestionType,
          prompt: question.prompt,
          points: question.points,
          options,
          allowedMimeTypes: question.allowed_mime_types,
          position: index,
        };
      })
      .filter((q): q is QuizQuestionPublic => q !== null);

    const answers = await this.database.db
      .selectFrom('quiz_answers')
      .select(['question_id', 'value'])
      .where('attempt_id', '=', attemptId)
      .execute();

    const answerMap: Record<string, QuizAnswerValue> = {};
    for (const answer of answers) {
      const parsed = this.parseAnswerValue(answer.value);
      if (parsed) answerMap[answer.question_id] = parsed;
    }

    return {
      attemptId: attempt.id,
      quizId: attempt.quiz_id,
      status: attempt.status as AttemptStatus,
      startedAt: attempt.started_at.toISOString(),
      expiresAt: attempt.expires_at.toISOString(),
      secondsRemaining: Math.max(
        0,
        Math.floor((attempt.expires_at.getTime() - Date.now()) / 1000),
      ),
      questions: ordered,
      answers: answerMap,
      focusLossCount: attempt.focus_loss_count,
      score: attempt.score,
      maxScore: attempt.max_score,
      syncVersion: attempt.sync_version,
    };
  }

  /** Narrows untrusted JSON into the QuizAnswerValue union. */
  private parseAnswerValue(raw: unknown): QuizAnswerValue | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const value = raw as Record<string, unknown>;

    if (value.type === 'CHOICE') {
      if (!Array.isArray(value.optionIds)) return null;
      const optionIds = value.optionIds.filter((id): id is string => typeof id === 'string');
      return { type: 'CHOICE', optionIds };
    }
    if (value.type === 'TEXT') {
      if (typeof value.text !== 'string') return null;
      return { type: 'TEXT', text: value.text.slice(0, 20_000) };
    }
    if (value.type === 'FILE') {
      if (typeof value.mediaId !== 'string' || typeof value.fileName !== 'string') {
        return null;
      }
      return { type: 'FILE', mediaId: value.mediaId, fileName: value.fileName };
    }
    return null;
  }

  private buildQuestionRow(quizId: string, dto: CreateQuestionDto, index: number) {
    const needsOptions =
      dto.type === QuestionType.MULTIPLE_CHOICE ||
      dto.type === QuestionType.MULTI_SELECT ||
      dto.type === QuestionType.TRUE_FALSE;

    let options: QuizOptionsJson = (dto.options ?? []).map((option) => ({
      id: option.id ?? randomUUID(),
      text: option.text,
    }));

    if (dto.type === QuestionType.TRUE_FALSE && options.length === 0) {
      options = [
        { id: randomUUID(), text: 'True' },
        { id: randomUUID(), text: 'False' },
      ];
    }

    if (needsOptions && options.length < 2) {
      throw new BadRequestException(
        `Question "${dto.prompt.slice(0, 40)}" needs at least two options`,
      );
    }

    // The answer key may reference option ids or positional indexes.
    const optionIds = options.map((o) => o.id);
    const correctOptionIds = (dto.correctOptionIds ?? [])
      .map((ref) => {
        if (optionIds.includes(ref)) return ref;
        const index = Number.parseInt(ref, 10);
        return Number.isInteger(index) && index >= 0 && index < optionIds.length
          ? optionIds[index]
          : null;
      })
      .filter((id): id is string => id !== null);

    if (needsOptions && correctOptionIds.length === 0) {
      throw new BadRequestException(
        `Question "${dto.prompt.slice(0, 40)}" needs at least one correct option`,
      );
    }
    if (
      (dto.type === QuestionType.MULTIPLE_CHOICE || dto.type === QuestionType.TRUE_FALSE) &&
      correctOptionIds.length !== 1
    ) {
      throw new BadRequestException(
        `Question "${dto.prompt.slice(0, 40)}" must have exactly one correct option`,
      );
    }

    return {
      quiz_id: quizId,
      type: dto.type,
      prompt: dto.prompt,
      points: dto.points ?? 1,
      options: JSON.stringify(options),
      correct_option_ids: correctOptionIds,
      correct_text: dto.correctText ?? null,
      explanation: dto.explanation ?? null,
      allowed_mime_types: dto.allowedMimeTypes ?? [],
      position: dto.position ?? index,
    };
  }

  private toSummary(
    quiz: {
      id: string;
      course_id: string;
      title: string;
      description: string | null;
      time_limit_seconds: number;
      max_score: number;
      passing_score: number;
      shuffle_questions: boolean;
      shuffle_options: boolean;
      anti_cheat_enabled: boolean;
      max_focus_losses: number;
      attempts_allowed: number;
      opens_at: Date | null;
      closes_at: Date | null;
      is_published: boolean;
    },
    questionCount: number,
  ): QuizSummary {
    return {
      id: quiz.id,
      courseId: quiz.course_id,
      title: quiz.title,
      description: quiz.description,
      timeLimitSeconds: quiz.time_limit_seconds,
      maxScore: quiz.max_score,
      passingScore: quiz.passing_score,
      questionCount,
      shuffleQuestions: quiz.shuffle_questions,
      shuffleOptions: quiz.shuffle_options,
      antiCheatEnabled: quiz.anti_cheat_enabled,
      maxFocusLosses: quiz.max_focus_losses,
      attemptsAllowed: quiz.attempts_allowed,
      opensAt: quiz.opens_at ? quiz.opens_at.toISOString() : null,
      closesAt: quiz.closes_at ? quiz.closes_at.toISOString() : null,
      isPublished: quiz.is_published,
    };
  }

  private assertWindowValid(opensAt?: string, closesAt?: string): void {
    if (opensAt && closesAt && new Date(opensAt) >= new Date(closesAt)) {
      throw new BadRequestException('closesAt must be after opensAt');
    }
  }

  private async isStaffOfCourse(
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
    return Boolean(row);
  }
}
