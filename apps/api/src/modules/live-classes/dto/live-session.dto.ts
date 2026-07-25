import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LiveClassProvider } from '@institutes/shared';

export class CreateLiveSessionDto {
  @ApiProperty({ example: 'Unit 4 — Speaking practice' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: '2026-08-01T15:30:00.000Z' })
  @IsDateString()
  startsAt!: string;

  @ApiProperty({ example: '2026-08-01T17:00:00.000Z' })
  @IsDateString()
  endsAt!: string;

  @ApiPropertyOptional({ enum: LiveClassProvider, default: LiveClassProvider.BIG_BLUE_BUTTON })
  @IsOptional()
  @IsEnum(LiveClassProvider)
  provider?: LiveClassProvider;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  instructorId?: string;
}
