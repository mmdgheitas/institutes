import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@institutes/shared';
import { Auth, CurrentUser, type AuthenticatedUser } from '../../common/decorators';
import { LiveClassesService } from './live-classes.service';
import { CreateLiveSessionDto } from './dto/live-session.dto';

@ApiTags('live classes')
@Controller()
export class LiveClassesController {
  constructor(private readonly live: LiveClassesService) {}

  @Auth(UserRole.INSTITUTE_ADMIN, UserRole.TEACHER)
  @Post('courses/:courseId/live-sessions')
  @ApiOperation({ summary: 'Schedule a live class and provision the remote room' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: CreateLiveSessionDto,
  ) {
    return this.live.createSession(user, courseId, dto);
  }

  @Auth()
  @Get('courses/:courseId/live-sessions')
  @ApiOperation({ summary: 'Live sessions of a course' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.live.listForCourse(user, courseId);
  }

  @Auth()
  @Get('me/live-sessions')
  @ApiOperation({ summary: 'Upcoming live classes for the current student' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.live.myUpcoming(user);
  }

  @Auth()
  @Post('live-sessions/:sessionId/join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'One-click SSO join URL',
    description:
      'Returns a per-user signed URL (BBB checksum or Adobe Connect session). ' +
      'The link is generated on demand and cannot be reused by another account.',
  })
  join(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.live.join(user, sessionId);
  }

  @Auth(UserRole.INSTITUTE_ADMIN, UserRole.TEACHER)
  @Post('live-sessions/:sessionId/recording')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fetch and store the session recording URL' })
  recording(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.live.refreshRecording(user, sessionId);
  }

  @Auth(UserRole.INSTITUTE_ADMIN, UserRole.TEACHER)
  @Delete('live-sessions/:sessionId')
  @ApiOperation({ summary: 'Cancel a scheduled live class' })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.live.deleteSession(user, sessionId);
  }
}
