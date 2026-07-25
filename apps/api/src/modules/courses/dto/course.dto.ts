import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CourseLevel, CourseType } from '../../../packages/shared/src/index';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CourseSessionDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: '0 = Sunday' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ example: '17:30' })
  @Matches(TIME_REGEX, { message: 'startTime must be HH:mm' })
  startTime!: string;

  @ApiProperty({ example: '19:00' })
  @Matches(TIME_REGEX, { message: 'endTime must be HH:mm' })
  endTime!: string;

  @ApiPropertyOptional({ example: 'Room 2' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  room?: string | null;
}

export class CreateCourseDto {
  @ApiProperty({ example: 'IELTS Intensive — Band 7+' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @ApiPropertyOptional({ enum: CourseType, default: CourseType.IN_PERSON })
  @IsOptional()
  @IsEnum(CourseType)
  type?: CourseType;

  @ApiPropertyOptional({ enum: CourseLevel, default: CourseLevel.ALL_LEVELS })
  @IsOptional()
  @IsEnum(CourseLevel)
  level?: CourseLevel;

  @ApiProperty({ example: 12500000, description: 'Price before discount' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({ default: 'IRR' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  durationHours?: number;

  @ApiPropertyOptional({ minimum: 1, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ type: [CourseSessionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(14)
  @ValidateNested({ each: true })
  @Type(() => CourseSessionDto)
  sessions?: CourseSessionDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  instructorIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateCourseDto extends PartialType(CreateCourseDto) {}

export class CreateClassroomDto {
  @ApiProperty({ example: 'Room A' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ minimum: 1, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;
}

export class CreateTimetableEntryDto {
  @ApiProperty()
  @IsUUID()
  courseId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  classroomId?: string;

  @ApiProperty({ minimum: 0, maximum: 6 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ example: '17:30' })
  @Matches(TIME_REGEX, { message: 'startTime must be HH:mm' })
  startTime!: string;

  @ApiProperty({ example: '19:00' })
  @Matches(TIME_REGEX, { message: 'endTime must be HH:mm' })
  endTime!: string;
}
