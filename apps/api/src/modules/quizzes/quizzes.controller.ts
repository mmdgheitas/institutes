import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../../packages/shared/src/index';
import {
  Auth,
  ClientIp,
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators';
import { QuizzesService } from './quizzes.service';
import {
  CreateQuizDto,
  GradeAttemptDto,
  SyncAttemptDto,
  UpdateQuizDto,
} from './dto/quiz.dto';

@ApiTags('quizzes')
@Controller()
export class QuizzesController {
  constructor(private readonly quizzes: QuizzesService) {}

  /* -------------------------------------------------------- authoring -- */

  @Auth(UserRole.INSTITUTE_ADMIN, UserRole.TEACHER)
  @Post('courses/:courseId/quizzes')
  @ApiOperation({ summary: 'Create a quiz with its questions' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: CreateQuizDto,
  ) {
    return this.quizzes.createQuiz(user, courseId, dto);
  }

  @Auth()
  @Get('courses/:courseId/quizzes')
  @ApiOperation({ summary: 'Quizzes of a course (drafts visible to staff only)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.quizzes.listQuizzes(user, courseId);
  }

  @Auth(UserRole.INSTITUTE_ADMIN, UserRole.TEACHER)
  @Get('quizzes/:quizId/authoring')
  @ApiOperation({ summary: 'Quiz with the answer key (staff only)' })
  authoring(
    @CurrentUser() user: AuthenticatedUser,
    @Param('quizId', ParseUUIDPipe) quizId: string,
  ) {
    return this.quizzes.getQuizForAuthoring(user, quizId);
  }

  @Auth(UserRole.INSTITUTE_ADMIN, UserRole.TEACHER)
  @Patch('quizzes/:quizId')
  @ApiOperation({ summary: 'Update a quiz' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('quizId', ParseUUIDPipe) quizId: string,
    @Body() dto: UpdateQuizDto,
  ) {
    return this.quizzes.updateQuiz(user, quizId, dto);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Delete('quizzes/:quizId')
  @ApiOperation({ summary: 'Delete a quiz' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('quizId', ParseUUIDPipe) quizId: string,
  ) {
    return this.quizzes.deleteQuiz(user, quizId);
  }

  /* --------------------------------------------------------- attempts -- */

  @Auth()
  @Post('quizzes/:quizId/attempts')
  @ApiOperation({
    summary: 'Start or resume an attempt',
    description:
      'The deadline is fixed server-side. Question and option order are ' +
      'randomised once per attempt and persisted, so reloading gains nothing.',
  })
  start(
    @CurrentUser() user: AuthenticatedUser,
    @Param('quizId', ParseUUIDPipe) quizId: string,
    @ClientIp() ip: string,
  ) {
    return this.quizzes.startAttempt(user, quizId, ip);
  }

  @Auth()
  @Get('attempts/:attemptId')
  @ApiOperation({ summary: 'Current attempt state (for resuming after a drop-out)' })
  getAttempt(
    @CurrentUser() user: AuthenticatedUser,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return this.quizzes.getAttempt(user, attemptId);
  }

  @Auth()
  @Post('attempts/:attemptId/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Push buffered answers (supports offline batches)',
    description:
      'Answers are accepted only when newer than the stored copy, so a queue ' +
      'flushed after reconnecting cannot overwrite fresher work.',
  })
  sync(
    @CurrentUser() user: AuthenticatedUser,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() dto: SyncAttemptDto,
  ) {
    return this.quizzes.syncAttempt(user, attemptId, dto);
  }

  @Auth()
  @Post('attempts/:attemptId/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit an attempt and receive the auto-graded result' })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return this.quizzes.submitAttempt(user, attemptId);
  }

  @Auth()
  @Get('attempts/:attemptId/result')
  @ApiOperation({ summary: 'Score breakdown for an attempt' })
  result(
    @CurrentUser() user: AuthenticatedUser,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
  ) {
    return this.quizzes.getResult(user, attemptId);
  }

  /* --------------------------------------------------------- grading --- */

  @Auth(UserRole.INSTITUTE_ADMIN, UserRole.TEACHER)
  @Get('quizzes/:quizId/attempts')
  @ApiOperation({ summary: 'Attempts awaiting or completed grading' })
  attempts(
    @CurrentUser() user: AuthenticatedUser,
    @Param('quizId', ParseUUIDPipe) quizId: string,
  ) {
    return this.quizzes.listAttemptsForGrading(user, quizId);
  }

  @Auth(UserRole.INSTITUTE_ADMIN, UserRole.TEACHER)
  @Post('attempts/:attemptId/grade')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Grade essay / file answers and finalise the score' })
  grade(
    @CurrentUser() user: AuthenticatedUser,
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() dto: GradeAttemptDto,
  ) {
    return this.quizzes.gradeAttempt(user, attemptId, dto);
  }
}
