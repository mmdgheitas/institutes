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
import { Auth, CurrentUser, type AuthenticatedUser } from '../../common/decorators';
import { InstitutesService } from './institutes.service';
import {
  CreateInstituteDto,
  CreateInstructorDto,
  CreateReviewDto,
  ReplyReviewDto,
  ReviewVerificationDto,
  SubmitVerificationDto,
  UpdateInstituteDto,
  UpdateInstructorDto,
} from './dto/institute.dto';

@ApiTags('institutes')
@Controller('institutes')
export class InstitutesController {
  constructor(private readonly institutes: InstitutesService) {}

  @Auth(UserRole.STUDENT, UserRole.INSTITUTE_ADMIN)
  @Post()
  @ApiOperation({ summary: 'Register a new institute (caller becomes owner)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInstituteDto) {
    return this.institutes.create(user, dto);
  }

  @Auth(UserRole.INSTITUTE_ADMIN, UserRole.TEACHER)
  @Get('mine')
  @ApiOperation({ summary: 'Institutes the current user belongs to' })
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.institutes.listMine(user);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Get(':id/manage')
  @ApiOperation({ summary: 'Full institute record for the dashboard' })
  getManaged(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.institutes.getManaged(user, id);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Patch(':id')
  @ApiOperation({ summary: 'Update institute details' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInstituteDto,
  ) {
    return this.institutes.update(user, id, dto);
  }

  /* ------------------------------------------------------ verification -- */

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Post(':id/verification')
  @ApiOperation({ summary: 'Submit an official licence document for the blue tick' })
  submitVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitVerificationDto,
  ) {
    return this.institutes.submitVerification(user, id, dto);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Get(':id/verification')
  @ApiOperation({ summary: 'Verification documents and their review status' })
  listVerification(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.institutes.listVerificationDocuments(user, id);
  }

  @Auth(UserRole.SUPER_ADMIN)
  @Get('admin/verification/pending')
  @ApiOperation({ summary: 'Verification queue (super admin)' })
  pendingVerifications() {
    return this.institutes.listPendingVerifications();
  }

  @Auth(UserRole.SUPER_ADMIN)
  @Post('admin/verification/:documentId')
  @ApiOperation({ summary: 'Approve or reject a verification document' })
  reviewVerification(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: ReviewVerificationDto,
  ) {
    return this.institutes.reviewVerification(documentId, dto);
  }

  /* ------------------------------------------------------- instructors -- */

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Post(':id/instructors')
  @ApiOperation({ summary: 'Add an instructor' })
  createInstructor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateInstructorDto,
  ) {
    return this.institutes.createInstructor(user, id, dto);
  }

  @Auth(UserRole.INSTITUTE_ADMIN, UserRole.TEACHER)
  @Get(':id/instructors')
  @ApiOperation({ summary: 'List instructors of an institute' })
  listInstructors(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.institutes.listInstructors(user, id);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Patch('instructors/:instructorId')
  @ApiOperation({ summary: 'Update an instructor profile' })
  updateInstructor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('instructorId', ParseUUIDPipe) instructorId: string,
    @Body() dto: UpdateInstructorDto,
  ) {
    return this.institutes.updateInstructor(user, instructorId, dto);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Delete('instructors/:instructorId')
  @ApiOperation({ summary: 'Deactivate an instructor' })
  deleteInstructor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('instructorId', ParseUUIDPipe) instructorId: string,
  ) {
    return this.institutes.deleteInstructor(user, instructorId);
  }

  /* ----------------------------------------------------------- reviews -- */

  @Auth(UserRole.STUDENT)
  @Post(':id/reviews')
  @ApiOperation({ summary: 'Leave a review (enrolled students only)' })
  createReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.institutes.createReview(user, id, dto);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Post('reviews/:reviewId/reply')
  @ApiOperation({ summary: 'Reply publicly to a review' })
  replyReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: ReplyReviewDto,
  ) {
    return this.institutes.replyToReview(user, reviewId, dto);
  }
}
