import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MediaKind } from '@institutes/shared';

const PURPOSES = [
  'INSTITUTE_GALLERY',
  'INSTITUTE_LOGO',
  'COURSE_MATERIAL',
  'SUBMISSION_ATTACHMENT',
  'QUIZ_ANSWER',
  'VERIFICATION_DOCUMENT',
  'REVIEW_VIDEO',
  'AVATAR',
] as const;

export class PresignRequestDto {
  @ApiProperty({ example: 'classroom-tour.mp4' })
  @IsString()
  @MaxLength(255)
  fileName!: string;

  @ApiProperty({ example: 'video/mp4' })
  @IsString()
  @MaxLength(120)
  mimeType!: string;

  @ApiProperty({ example: 15_728_640 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @ApiProperty({ enum: MediaKind })
  @IsEnum(MediaKind)
  kind!: MediaKind;

  @ApiProperty({ enum: PURPOSES })
  @IsEnum(PURPOSES)
  purpose!: (typeof PURPOSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  instituteId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courseId?: string;
}

export class ReorderItemDto {
  @ApiProperty()
  @IsUUID()
  mediaId!: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position!: number;
}

export class ReorderGalleryDto {
  @ApiProperty({ type: [ReorderItemDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  order!: ReorderItemDto[];
}

export class CreateMaterialDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ description: 'Media id of the already-uploaded file' })
  @IsUUID()
  mediaId!: string;

  @ApiPropertyOptional({ enum: MediaKind, default: MediaKind.DOCUMENT })
  @IsOptional()
  @IsEnum(MediaKind)
  kind?: MediaKind;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}
