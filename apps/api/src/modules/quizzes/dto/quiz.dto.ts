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
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { QuestionType } from '../../../packages/shared/src/index';

export class QuizOptionDto {
  @ApiPropertyOptional({ description: 'Stable id; generated when omitted' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  id?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text!: string;
}

export class CreateQuestionDto {
  @ApiProperty({ enum: QuestionType })
  @IsEnum(QuestionType)
  type!: QuestionType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  prompt!: string;

  @ApiPropertyOptional({ default: 1, minimum: 0.1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(1000)
  points?: number;

  @ApiPropertyOptional({ type: [QuizOptionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => QuizOptionDto)
  options?: QuizOptionDto[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Indexes (as strings) or ids of the correct options',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  correctOptionIds?: string[];

  @ApiPropertyOptional({ description: 'Accepted answers for SHORT_ANSWER, separated by |' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  correctText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  explanation?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  allowedMimeTypes?: string[];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;
}

export class CreateQuizDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ default: 1800, minimum: 30, maximum: 86400 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(30)
  @Max(86_400)
  timeLimitSeconds?: number;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxScore?: number;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  passingScore?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  shuffleQuestions?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  shuffleOptions?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  antiCheatEnabled?: boolean;

  @ApiPropertyOptional({ default: 3, description: 'Focus losses before the attempt is voided' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  maxFocusLosses?: number;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  attemptsAllowed?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  opensAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  closesAt?: string;

  @ApiPropertyOptional({ type: [CreateQuestionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions?: CreateQuestionDto[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateQuizDto extends PartialType(CreateQuizDto) {}

export class QuizAnswerInputDto {
  @ApiProperty()
  @IsUUID()
  questionId!: string;

  @ApiProperty({
    description:
      'One of { type: "CHOICE", optionIds } | { type: "TEXT", text } | { type: "FILE", mediaId, fileName }',
  })
  @IsObject()
  value!: Record<string, unknown>;

  @ApiProperty({ description: 'Client timestamp, used for offline conflict resolution' })
  @IsDateString()
  clientUpdatedAt!: string;
}

export class SyncAttemptDto {
  @ApiProperty({ type: [QuizAnswerInputDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerInputDto)
  answers!: QuizAnswerInputDto[];

  @ApiPropertyOptional({ description: 'Total window/app focus losses observed by the client' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  focusLossCount?: number;

  @ApiProperty({ description: 'Last sync version the client holds' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  syncVersion!: number;
}

export class GradeAnswerDto {
  @ApiProperty()
  @IsUUID()
  questionId!: string;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  awardedPoints!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;
}

export class GradeAttemptDto {
  @ApiProperty({ type: [GradeAnswerDto] })
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => GradeAnswerDto)
  grades!: GradeAnswerDto[];
}
