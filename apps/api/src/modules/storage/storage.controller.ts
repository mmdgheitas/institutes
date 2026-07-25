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
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@institutes/shared';
import { Auth, CurrentUser, type AuthenticatedUser } from '../../common/decorators';
import { MaterialsService } from './materials.service';
import { StorageService } from './storage.service';
import {
  CreateMaterialDto,
  PresignRequestDto,
  ReorderGalleryDto,
} from './dto/storage.dto';

@ApiTags('storage & materials')
@Controller()
export class StorageController {
  constructor(
    private readonly storage: StorageService,
    private readonly materials: MaterialsService,
  ) {}

  @Auth()
  @Post('uploads/presign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get a presigned PUT URL for direct-to-S3 upload',
    description:
      'The API never proxies media bytes. Upload with PUT to the returned URL ' +
      'using exactly the headers provided, then call /uploads/:mediaId/confirm.',
  })
  presign(@CurrentUser() user: AuthenticatedUser, @Body() dto: PresignRequestDto) {
    return this.storage.createPresignedUpload(user, dto);
  }

  @Auth()
  @Post('uploads/:mediaId/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm an upload; verifies the object exists in the bucket',
  })
  confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
  ) {
    return this.storage.confirmUpload(user, mediaId);
  }

  @Auth()
  @Delete('media/:mediaId')
  @ApiOperation({ summary: 'Delete a media object and its record' })
  deleteMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
  ) {
    return this.storage.deleteMedia(user, mediaId);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Get('institutes/:instituteId/media')
  @ApiOperation({ summary: 'Media library of an institute' })
  listMedia(
    @CurrentUser() user: AuthenticatedUser,
    @Param('instituteId', ParseUUIDPipe) instituteId: string,
    @Query('purpose') purpose?: string,
  ) {
    return this.storage.listInstituteMedia(user, instituteId, purpose);
  }

  @Auth(UserRole.INSTITUTE_ADMIN)
  @Post('institutes/:instituteId/media/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder gallery assets' })
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('instituteId', ParseUUIDPipe) instituteId: string,
    @Body() dto: ReorderGalleryDto,
  ) {
    return this.storage.reorderGallery(user, instituteId, dto.order);
  }

  /* ------------------------------------------------------- materials --- */

  @Auth(UserRole.INSTITUTE_ADMIN, UserRole.TEACHER)
  @Post('courses/:courseId/materials')
  @ApiOperation({ summary: 'Attach an uploaded file as course material' })
  createMaterial(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: CreateMaterialDto,
  ) {
    return this.materials.create(user, courseId, dto);
  }

  @Auth()
  @Get('courses/:courseId/materials')
  @ApiOperation({ summary: 'Course materials (enrolled students and staff)' })
  listMaterials(
    @CurrentUser() user: AuthenticatedUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.materials.listForCourse(user, courseId);
  }

  @Auth()
  @Get('materials/:materialId/download')
  @ApiOperation({
    summary: 'Short-lived presigned download URL (15 minutes)',
  })
  download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('materialId', ParseUUIDPipe) materialId: string,
  ) {
    return this.materials.getDownloadUrl(user, materialId);
  }

  @Auth(UserRole.INSTITUTE_ADMIN, UserRole.TEACHER)
  @Delete('materials/:materialId')
  @ApiOperation({ summary: 'Remove a course material' })
  removeMaterial(
    @CurrentUser() user: AuthenticatedUser,
    @Param('materialId', ParseUUIDPipe) materialId: string,
  ) {
    return this.materials.remove(user, materialId);
  }
}
