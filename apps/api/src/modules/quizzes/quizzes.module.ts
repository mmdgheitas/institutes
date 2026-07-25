import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { QuizExpiryTask } from './quiz-expiry.task';
import { QuizzesController } from './quizzes.controller';
import { QuizzesService } from './quizzes.service';

@Module({
  imports: [NotificationsModule],
  controllers: [QuizzesController],
  providers: [QuizzesService, QuizExpiryTask],
  exports: [QuizzesService],
})
export class QuizzesModule {}
