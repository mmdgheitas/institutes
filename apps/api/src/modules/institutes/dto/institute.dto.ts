import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { VerificationStatus } from '@institutes/shared';

export class CreateInstituteDto {
  @ApiProperty({ example: 'Pardis Language Academy' })
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ example: 'IELTS and Business English since 2004' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string;

  @ApiProperty({ example: 'No. 12, Valiasr St, Tehran' })
  @IsString()
  @MinLength(5)
  @MaxLength(400)
  address!: string;

  @ApiProperty({ example: 'Tehran' })
  @IsString()
  @MaxLength(80)
  city!: string;

  @ApiPropertyOptional({ example: 'Tehran' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  province?: string;

  @ApiProperty({ example: 35.7219 })
  @Type(() => Number)
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: 51.3347 })
  @Type(() => Number)
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional({ example: '02188776655' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  @ApiPropertyOptional({ type: [String], example: ['ielts', 'toefl'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({ type: [String], example: ['parking', 'wifi'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Category ids' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ example: { saturday: '09:00-20:00' } })
  @IsOptional()
  @IsObject()
  workingHours?: Record<string, string>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  freePreRegistration?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverImageUrl?: string;
}

export class UpdateInstituteDto extends PartialType(CreateInstituteDto) {
  @ApiPropertyOptional({ description: 'Publish or unpublish the storefront' })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class SubmitVerificationDto {
  @ApiProperty({ example: 'BUSINESS_LICENSE' })
  @IsString()
  @MaxLength(60)
  docType!: string;

  @ApiProperty({ description: 'Media id of the uploaded document' })
  @IsUUID()
  mediaId!: string;
}

export class ReviewVerificationDto {
  @ApiProperty({ enum: [VerificationStatus.VERIFIED, VerificationStatus.REJECTED] })
  @IsEnum([VerificationStatus.VERIFIED, VerificationStatus.REJECTED])
  status!: typeof VerificationStatus.VERIFIED | typeof VerificationStatus.REJECTED;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class CreateInstructorDto {
  @ApiProperty({ example: 'Dr. Nima Rasouli' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiPropertyOptional({ example: 'Cambridge CELTA, 12 years teaching IELTS' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  headline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 70 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(70)
  yearsOfExperience?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  specialties?: string[];

  @ApiPropertyOptional({ description: 'Link the instructor to an existing user account' })
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class UpdateInstructorDto extends PartialType(CreateInstructorDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  body!: string;

  @ApiPropertyOptional({ description: 'Media id of a short video testimonial' })
  @IsOptional()
  @IsUUID()
  videoMediaId?: string;
}

export class ReplyReviewDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  reply!: string;
}
