import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QuizzesService } from './quizzes.service';

/**
 * Server-side strict countdown enforcement.
 *
 * Clients render a countdown from `expiresAt`, but the authoritative cut-off is
 * this job: every 30 seconds it force-submits and grades any attempt whose
 * deadline has passed, even if the student closed the browser or lost network.
 */
@Injectable()
export class QuizExpiryTask {
  private readonly logger = new Logger(QuizExpiryTask.name);
  private running = false;

  constructor(private readonly quizzes: QuizzesService) {}

  @Cron(CronExpression.EVERY_30_SECONDS, { name: 'expire-quiz-attempts' })
  async handleExpiredAttempts(): Promise<void> {
    // Guard against overlapping runs on a slow database.
    if (this.running) return;
    this.running = true;
    try {
      const count = await this.quizzes.expireOverdueAttempts();
      if (count > 0) {
        this.logger.log(`Auto-submitted ${count} expired quiz attempt(s)`);
      }
    } catch (error) {
      this.logger.error(`Expiry sweep failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }
}
