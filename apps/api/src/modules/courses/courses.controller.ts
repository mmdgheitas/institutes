import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../../packages/shared/src/index';
import { Auth, CurrentUser, Public, type AuthenticatedUser } from '../../common/decorators';
import { CoursesService } from './courses.service';
import {
  CreateClassroomDto,
  CreateCourseDto,
  CreateTimetableEntryDto,
  UpdateCourseDto,
} from './dto/course.dto';

@ApiTags('courses')
@Controller()
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Public()
  @Get('courses/:id')
  @ApiOperation({ summary: 'Public course detail' })
  getPublic(@Param('id', ParseUUIDPipe) id: string) {
    return this.courses.getPublic(id);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Post('institutes/:instituteId/courses')
  @ApiOperation({ summary: 'Create a course' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('instituteId', ParseUUIDPipe) instituteId: string,
    @Body() dto: CreateCourseDto,
  ) {
    return this.courses.create(user, instituteId, dto);
  }

  @Auth(UserRole.INSTITUTE_ADMIN, UserRole.TEACHER)
  @Get('institutes/:instituteId/courses')
  @ApiOperation({ summary: 'List every course of an institute (including drafts)' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('instituteId', ParseUUIDPipe) instituteId: string,
  ) {
    return this.courses.listForInstitute(user, instituteId);
  }

  @Auth(UserRole.INSTITUTE_ADMIN, UserRole.TEACHER)
  @Get('me/courses')
  @ApiOperation({ summary: 'Courses the current user teaches or administers' })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.courses.listMine(user);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Patch('courses/:id')
  @ApiOperation({ summary: 'Update a course' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.courses.update(user, id, dto);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Delete('courses/:id')
  @ApiOperation({
    summary: 'Delete a course; unpublishes instead when students are enrolled',
  })
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.courses.remove(user, id);
  }

  /* -------------------------------------------------------- timetable -- */

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Post('institutes/:instituteId/classrooms')
  @ApiOperation({ summary: 'Create a classroom' })
  createClassroom(
    @CurrentUser() user: AuthenticatedUser,
    @Param('instituteId', ParseUUIDPipe) instituteId: string,
    @Body() dto: CreateClassroomDto,
  ) {
    return this.courses.createClassroom(user, instituteId, dto);
  }

  @Auth(UserRole.INSTITUTE_ADMIN, UserRole.TEACHER)
  @Get('institutes/:instituteId/classrooms')
  @ApiOperation({ summary: 'List classrooms' })
  listClassrooms(
    @CurrentUser() user: AuthenticatedUser,
    @Param('instituteId', ParseUUIDPipe) instituteId: string,
  ) {
    return this.courses.listClassrooms(user, instituteId);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Post('timetable')
  @ApiOperation({ summary: 'Add a timetable entry (rejects classroom clashes)' })
  addTimetableEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTimetableEntryDto,
  ) {
    return this.courses.addTimetableEntry(user, dto);
  }

  @Auth(UserRole.INSTITUTE_ADMIN, UserRole.TEACHER)
  @Get('institutes/:instituteId/timetable')
  @ApiOperation({ summary: 'Weekly timetable for the institute' })
  getTimetable(
    @CurrentUser() user: AuthenticatedUser,
    @Param('instituteId', ParseUUIDPipe) instituteId: string,
  ) {
    return this.courses.getTimetable(user, instituteId);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Delete('timetable/:entryId')
  @ApiOperation({ summary: 'Remove a timetable entry' })
  removeTimetableEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entryId', ParseUUIDPipe) entryId: string,
  ) {
    return this.courses.removeTimetableEntry(user, entryId);
  }
}
