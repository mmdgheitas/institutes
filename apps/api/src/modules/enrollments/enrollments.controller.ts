import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, Max, Min } from 'class-validator';
import { EnrollmentStatus, UserRole } from '../../packages/shared/src/index';
import { Auth, CurrentUser, type AuthenticatedUser } from '../../common/decorators';
import { EnrollmentsService } from './enrollments.service';

class UpdateEnrollmentStatusDto {
  @ApiPropertyOptional({ enum: EnrollmentStatus })
  @IsEnum(EnrollmentStatus)
  status!: EnrollmentStatus;
}

class UpdateProgressDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercent!: number;
}

@ApiTags('enrollments')
@Controller()
export class EnrollmentsController {
  constructor(private readonly enrollments: EnrollmentsService) {}

  @Auth()
  @Get('me/enrollments')
  @ApiOperation({ summary: 'Courses the current student is enrolled in' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.enrollments.listMine(user);
  }

  @Auth(UserRole.INSTITUTE_ADMIN, UserRole.TEACHER)
  @Get('courses/:courseId/enrollments')
  @ApiOperation({ summary: 'Class roster' })
  roster(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.enrollments.listForCourse(user, courseId);
  }

  @Auth(UserRole.INSTITUTE_ADMIN, UserRole.TEACHER)
  @Patch('enrollments/:enrollmentId/status')
  @ApiOperation({ summary: 'Change an enrollment status' })
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Body() dto: UpdateEnrollmentStatusDto,
  ) {
    return this.enrollments.updateStatus(user, enrollmentId, dto.status);
  }

  @Auth(UserRole.INSTITUTE_ADMIN, UserRole.TEACHER)
  @Patch('enrollments/:enrollmentId/progress')
  @ApiOperation({ summary: 'Record course progress' })
  updateProgress(
    @CurrentUser() user: AuthenticatedUser,
    @Param('enrollmentId', ParseUUIDPipe) enrollmentId: string,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.enrollments.updateProgress(user, enrollmentId, dto.progressPercent);
  }
}
