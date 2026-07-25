import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { FormFieldType, LeadStatus } from '../../../packages/shared/src/index';

export class FormFieldOptionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  label!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  value!: string;
}

export class FormFieldDto {
  @ApiProperty({ example: 'previous_level' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  key!: string;

  @ApiProperty({ example: 'Previous English level' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  label!: string;

  @ApiProperty({ enum: FormFieldType })
  @IsEnum(FormFieldType)
  type!: FormFieldType;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  placeholder?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  helpText?: string;

  @ApiPropertyOptional({ type: [FormFieldOptionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => FormFieldOptionDto)
  options?: FormFieldOptionDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minLength?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxLength?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  min?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  max?: number;

  @ApiPropertyOptional({ description: 'JavaScript-compatible regular expression' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  pattern?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  acceptedMimeTypes?: string[];

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxFileSizeMb?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

export class CreateFormDto {
  @ApiProperty({ example: 'IELTS pre-registration' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ type: [FormFieldDto] })
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => FormFieldDto)
  fields!: FormFieldDto[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresContract?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  contractText?: string;

  @ApiPropertyOptional({ default: false, description: 'Require SMS confirmation' })
  @IsOptional()
  @IsBoolean()
  requiresOtp?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateFormDto extends PartialType(CreateFormDto) {}

export class SubmitFormDto {
  @ApiPropertyOptional({ description: 'Course the applicant is interested in' })
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional({ description: 'Booked assessment/interview slot' })
  @IsOptional()
  @IsUUID()
  slotId?: string;

  @ApiProperty({
    description: 'Answers keyed by field key',
    example: { previous_level: 'intermediate', national_id: '0012345678' },
  })
  @IsObject()
  data!: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Required when the form has a contract' })
  @IsOptional()
  @IsBoolean()
  contractAccepted?: boolean;

  @ApiPropertyOptional({ description: 'Required when the form requires SMS confirmation' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  otpCode?: string;
}

export class UpdateLeadStatusDto {
  @ApiProperty({ enum: LeadStatus })
  @IsEnum(LeadStatus)
  status!: LeadStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ description: 'New index within the destination column' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

export class CreateTimeSlotsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiProperty({ type: [String], description: 'ISO start times' })
  @IsArray()
  @ArrayMaxSize(200)
  @IsDateString({}, { each: true })
  startTimes!: string[];

  @ApiProperty({ minimum: 5, maximum: 480, description: 'Slot length in minutes' })
  @Type(() => Number)
  @IsInt()
  @Min(5)
  durationMinutes!: number;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;
}
