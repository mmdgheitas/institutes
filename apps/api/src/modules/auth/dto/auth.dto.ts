import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole, normalizeMobile } from '../../../packages/shared/src/index';

const MOBILE_REGEX = /^09\d{9}$/;
const toMobile = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? normalizeMobile(value) : value;

export class RequestOtpDto {
  @ApiProperty({ example: '09121234567', description: 'Iranian mobile number' })
  @Transform(toMobile)
  @Matches(MOBILE_REGEX, { message: 'phone must be a valid Iranian mobile number' })
  phone!: string;

  @ApiPropertyOptional({ enum: ['LOGIN', 'REGISTER', 'SUBMISSION'], default: 'LOGIN' })
  @IsOptional()
  @IsEnum(['LOGIN', 'REGISTER', 'SUBMISSION'])
  purpose: 'LOGIN' | 'REGISTER' | 'SUBMISSION' = 'LOGIN';
}

export class VerifyOtpDto {
  @ApiProperty({ example: '09121234567' })
  @Transform(toMobile)
  @Matches(MOBILE_REGEX, { message: 'phone must be a valid Iranian mobile number' })
  phone!: string;

  @ApiProperty({ example: '11111', minLength: 4, maxLength: 8 })
  @IsString()
  @Length(4, 8)
  code!: string;

  @ApiPropertyOptional({
    description: 'Required when the phone number has no account yet',
    example: 'Sara Ahmadi',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;
}

export class RegisterDto {
  @ApiProperty({ example: '09121234567' })
  @Transform(toMobile)
  @Matches(MOBILE_REGEX, { message: 'phone must be a valid Iranian mobile number' })
  phone!: string;

  @ApiProperty({ example: 'Sara Ahmadi' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName!: string;

  @ApiProperty({ example: 'Str0ngPass', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiPropertyOptional({ example: 'sara@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional({ enum: [UserRole.STUDENT, UserRole.INSTITUTE_ADMIN] })
  @IsOptional()
  @IsEnum([UserRole.STUDENT, UserRole.INSTITUTE_ADMIN])
  role?: typeof UserRole.STUDENT | typeof UserRole.INSTITUTE_ADMIN;
}

export class LoginDto {
  @ApiProperty({ example: '09121234567' })
  @Transform(toMobile)
  @Matches(MOBILE_REGEX, { message: 'phone must be a valid Iranian mobile number' })
  phone!: string;

  @ApiProperty({ example: 'Str0ngPass' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;
}
