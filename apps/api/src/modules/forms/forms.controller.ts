import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../packages/shared/src/index';
import {
  Auth,
  ClientIp,
  CurrentUser,
  Public,
  UserAgent,
  type AuthenticatedUser,
} from '../../common/decorators';
import { FormsService } from './forms.service';
import { CrmService } from '../crm/crm.service';
import {
  CreateFormDto,
  CreateTimeSlotsDto,
  SubmitFormDto,
  UpdateFormDto,
  UpdateLeadStatusDto,
} from './dto/form.dto';

class AssignCourseDto {
  @ApiPropertyOptional()
  @IsUUID()
  courseId!: string;
}

class AddNoteDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(2000)
  note!: string;
}

class BoardQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;
}

@ApiTags('forms & leads')
@Controller()
export class FormsController {
  constructor(
    private readonly forms: FormsService,
    private readonly crm: CrmService,
  ) {}

  /* -------------------------------------------------- form authoring -- */

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Post('institutes/:instituteId/forms')
  @ApiOperation({ summary: 'Create a dynamic pre-registration form' })
  createForm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('instituteId', ParseUUIDPipe) instituteId: string,
    @Body() dto: CreateFormDto,
  ) {
    return this.forms.createForm(user, instituteId, dto);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Get('institutes/:instituteId/forms')
  @ApiOperation({ summary: 'List an institute’s forms' })
  listForms(
    @CurrentUser() user: AuthenticatedUser,
    @Param('instituteId', ParseUUIDPipe) instituteId: string,
  ) {
    return this.forms.listForms(user, instituteId);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Patch('forms/:formId')
  @ApiOperation({ summary: 'Update a form schema' })
  updateForm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('formId', ParseUUIDPipe) formId: string,
    @Body() dto: UpdateFormDto,
  ) {
    return this.forms.updateForm(user, formId, dto);
  }

  @Public()
  @Get('forms/:formId')
  @ApiOperation({ summary: 'Public form schema for the pre-registration wizard' })
  getPublicForm(@Param('formId', ParseUUIDPipe) formId: string) {
    return this.forms.getPublicForm(formId);
  }

  /* ---------------------------------------------------- submissions --- */

  @Auth(UserRole.STUDENT, UserRole.TEACHER, UserRole.INSTITUTE_ADMIN)
  @Post('forms/:formId/submit')
  @ApiOperation({
    summary: 'Submit a pre-registration',
    description:
      'Validated server-side with the same shared validator the client uses. ' +
      'Records contract acceptance with timestamp, IP and user agent.',
  })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('formId', ParseUUIDPipe) formId: string,
    @Body() dto: SubmitFormDto,
    @ClientIp() ip: string,
    @UserAgent() userAgent: string | null,
  ) {
    return this.forms.submit(user, formId, dto, { ip, userAgent });
  }

  @Auth()
  @Get('me/submissions')
  @ApiOperation({ summary: 'Pre-registrations submitted by the current user' })
  mySubmissions(@CurrentUser() user: AuthenticatedUser) {
    return this.forms.mySubmissions(user);
  }

  /* ----------------------------------------------------- time slots --- */

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Post('institutes/:instituteId/slots')
  @ApiOperation({ summary: 'Publish assessment / interview time slots' })
  createSlots(
    @CurrentUser() user: AuthenticatedUser,
    @Param('instituteId', ParseUUIDPipe) instituteId: string,
    @Body() dto: CreateTimeSlotsDto,
  ) {
    return this.forms.createSlots(user, instituteId, dto);
  }

  @Public()
  @Get('institutes/:instituteId/slots')
  @ApiOperation({ summary: 'Bookable slots for the storefront calendar' })
  listSlots(
    @Param('instituteId', ParseUUIDPipe) instituteId: string,
    @Query('courseId') courseId?: string,
  ) {
    return this.forms.listAvailableSlots(instituteId, courseId);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Post('slots/:slotId/cancel')
  @ApiOperation({ summary: 'Cancel a time slot and its bookings' })
  cancelSlot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slotId', ParseUUIDPipe) slotId: string,
  ) {
    return this.forms.cancelSlot(user, slotId);
  }

  /* ------------------------------------------------------ lead CRM ---- */

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Get('institutes/:instituteId/leads/board')
  @ApiOperation({ summary: 'Kanban board of leads grouped by status' })
  board(
    @CurrentUser() user: AuthenticatedUser,
    @Param('instituteId', ParseUUIDPipe) instituteId: string,
    @Query() query: BoardQueryDto,
  ) {
    return this.crm.getBoard(user, instituteId, {
      courseId: query.courseId,
      search: query.search,
    });
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Get('institutes/:instituteId/stats')
  @ApiOperation({ summary: 'Dashboard headline statistics' })
  stats(
    @CurrentUser() user: AuthenticatedUser,
    @Param('instituteId', ParseUUIDPipe) instituteId: string,
  ) {
    return this.crm.getStats(user, instituteId);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Get('leads/:submissionId')
  @ApiOperation({ summary: 'Lead detail with full activity timeline' })
  lead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
  ) {
    return this.crm.getLead(user, submissionId);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Patch('leads/:submissionId/status')
  @ApiOperation({
    summary: 'Move a lead between Kanban columns',
    description:
      'Moving to ENROLLED atomically creates the enrollment and the revenue / ' +
      'commission wallet transactions.',
  })
  updateLeadStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    return this.crm.updateStatus(user, submissionId, dto);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Patch('leads/:submissionId/course')
  @ApiOperation({ summary: 'Assign the course a lead is applying for' })
  assignCourse(
    @CurrentUser() user: AuthenticatedUser,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: AssignCourseDto,
  ) {
    return this.crm.assignCourse(user, submissionId, dto.courseId);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Post('leads/:submissionId/notes')
  @ApiOperation({ summary: 'Append a note to the lead timeline' })
  addNote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Body() dto: AddNoteDto,
  ) {
    return this.crm.addNote(user, submissionId, dto.note);
  }
}
