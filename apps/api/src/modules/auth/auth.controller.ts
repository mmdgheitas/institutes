import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthResponse, SessionUser } from '../../packages/shared/src/index';
import {
  Auth,
  ClientIp,
  CurrentUser,
  Public,
  UserAgent,
  type AuthenticatedUser,
} from '../../common/decorators';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  RequestOtpDto,
  UpdateProfileDto,
  VerifyOtpDto,
} from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send a login/registration OTP over SMS' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify an OTP and receive a token pair' })
  verifyOtp(
    @Body() dto: VerifyOtpDto,
    @ClientIp() ip: string,
    @UserAgent() userAgent: string | null,
  ): Promise<AuthResponse> {
    return this.authService.verifyOtp(dto, { ip, userAgent: userAgent ?? undefined });
  }

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Create an account with a password' })
  register(
    @Body() dto: RegisterDto,
    @ClientIp() ip: string,
    @UserAgent() userAgent: string | null,
  ): Promise<AuthResponse> {
    return this.authService.register(dto, { ip, userAgent: userAgent ?? undefined });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Sign in with phone and password' })
  login(
    @Body() dto: LoginDto,
    @ClientIp() ip: string,
    @UserAgent() userAgent: string | null,
  ): Promise<AuthResponse> {
    return this.authService.login(dto, { ip, userAgent: userAgent ?? undefined });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token for a new token pair' })
  refresh(
    @Body() dto: RefreshTokenDto,
    @ClientIp() ip: string,
    @UserAgent() userAgent: string | null,
  ): Promise<AuthResponse> {
    return this.authService.refresh(dto.refreshToken, {
      ip,
      userAgent: userAgent ?? undefined,
    });
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a single refresh token' })
  logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Auth()
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke every session for the current user' })
  logoutAll(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.logoutAll(user.id);
  }

  @Auth()
  @Get('me')
  @ApiOperation({ summary: 'Current user profile' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<SessionUser> {
    return this.authService.getProfile(user.id);
  }

  @Auth()
  @Patch('me')
  @ApiOperation({ summary: 'Update the current user profile' })
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<SessionUser> {
    return this.authService.updateProfile(user.id, dto);
  }
}
