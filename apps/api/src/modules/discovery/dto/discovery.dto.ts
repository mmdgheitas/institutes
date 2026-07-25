import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** `?categories=a,b` and `?categories=a&categories=b` both produce string[]. */
const toStringArray = ({ value }: { value: unknown }): unknown => {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return value;
};

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
};

export class DiscoveryQueryDto {
  @ApiPropertyOptional({ description: 'Origin latitude for proximity search', example: 35.7219 })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ description: 'Origin longitude', example: 51.3347 })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ description: 'Search radius in meters', default: 5000, maximum: 200000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(100)
  @Max(200_000)
  radiusMeters?: number;

  @ApiPropertyOptional({
    description: 'Viewport filter as minLng,minLat,maxLng,maxLat',
    example: '51.2,35.6,51.5,35.8',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const parts = value.split(',').map((v) => Number.parseFloat(v.trim()));
    return parts.length === 4 && parts.every(Number.isFinite) ? parts : undefined;
  })
  @IsArray()
  bbox?: number[];

  @ApiPropertyOptional({ type: [String], example: ['languages', 'programming'] })
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({ type: [String], example: ['ielts', 'python'] })
  @IsOptional()
  @Transform(toStringArray)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({ description: 'Minimum average rating', example: 4.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ description: 'Only institutes offering online classes' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  hasOnline?: boolean;

  @ApiPropertyOptional({ description: 'Only institutes with an active discount' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  hasDiscount?: boolean;

  @ApiPropertyOptional({ description: 'Only institutes with free pre-registration' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  freePreRegistration?: boolean;

  @ApiPropertyOptional({ description: 'Only government-verified (blue tick) institutes' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  verifiedOnly?: boolean;

  @ApiPropertyOptional({ description: 'Maximum effective course price' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Free-text search over name, tagline and skills' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  query?: string;

  @ApiPropertyOptional({ enum: ['distance', 'rating', 'price', 'popularity'], default: 'distance' })
  @IsOptional()
  @IsIn(['distance', 'rating', 'price', 'popularity'])
  sort: 'distance' | 'rating' | 'price' | 'popularity' = 'distance';

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 24 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(200)
  pageSize: number = 24;
}

export class MapPinsQueryDto extends DiscoveryQueryDto {
  @ApiPropertyOptional({
    description: 'Max pins returned for the viewport (clustering happens client-side)',
    default: 500,
    maximum: 2000,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(2000)
  limit: number = 500;
}
