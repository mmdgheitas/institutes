import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { createHash, randomBytes, randomInt } from 'node:crypto';
import {
  UserRole,
  validatePassword,
  type AuthResponse,
  type SessionUser,
} from '../../packages/shared/src/index';
import type { AppConfig } from '../../config/configuration';
import { DatabaseService } from '../../db/database.service';
import { SmsService } from '../notifications/sms.service';
import type { AccessTokenPayload } from './jwt.strategy';
import type {
  LoginDto,
  RegisterDto,
  RequestOtpDto,
  UpdateProfileDto,
  VerifyOtpDto,
} from './dto/auth.dto';

const BCRYPT_ROUNDS = 12;

interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  jti: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly sms: SmsService,
  ) {}

  /* ------------------------------------------------------------- OTP --- */

  /**
   * Issues a one-time code. The plain code is never stored — only a SHA-256
   * hash — and previous unconsumed codes for the same phone/purpose are voided.
   */
  async requestOtp(dto: RequestOtpDto): Promise<{ sent: boolean; expiresInSeconds: number; devCode?: string }> {
    const otpConfig = this.config.get('otp', { infer: true });
    const now = new Date();

    // Basic anti-spam: at most one code per 60 seconds per phone.
    const recent = await this.database.db
      .selectFrom('otp_codes')
      .select('created_at')
      .where('phone', '=', dto.phone)
      .where('purpose', '=', dto.purpose)
      .where('created_at', '>', new Date(now.getTime() - 60_000))
      .executeTakeFirst();

    if (recent) {
      throw new BadRequestException(
        'A verification code was already sent. Please wait a minute before retrying.',
      );
    }

    const code = String(randomInt(0, 10 ** otpConfig.length)).padStart(
      otpConfig.length,
      '0',
    );
    const expiresAt = new Date(now.getTime() + otpConfig.ttlSeconds * 1000);

    await this.database.transaction(async (trx) => {
      await trx
        .updateTable('otp_codes')
        .set({ consumed_at: now })
        .where('phone', '=', dto.phone)
        .where('purpose', '=', dto.purpose)
        .where('consumed_at', 'is', null)
        .execute();

      await trx
        .insertInto('otp_codes')
        .values({
          phone: dto.phone,
          code_hash: this.hashCode(code),
          purpose: dto.purpose,
          expires_at: expiresAt,
        })
        .execute();
    });

    await this.sms.sendOtp(dto.phone, code);

    const isProduction = this.config.get('nodeEnv', { infer: true }) === 'production';
    return {
      sent: true,
      expiresInSeconds: otpConfig.ttlSeconds,
      // Surfacing the code outside production keeps local development friction-free.
      ...(isProduction ? {} : { devCode: code }),
    };
  }

  /** Verifies an OTP and logs the user in, creating the account on first use. */
  async verifyOtp(
    dto: VerifyOtpDto,
    meta: { ip?: string; userAgent?: string } = {},
  ): Promise<AuthResponse> {
    await this.consumeOtp(dto.phone, dto.code, 'LOGIN', 'REGISTER');

    let user = await this.database.db
      .selectFrom('users')
      .selectAll()
      .where('phone', '=', dto.phone)
      .executeTakeFirst();

    if (!user) {
      if (!dto.fullName) {
        throw new BadRequestException(
          'fullName is required to complete registration for a new phone number',
        );
      }
      user = await this.database.db
        .insertInto('users')
        .values({
          phone: dto.phone,
          full_name: dto.fullName,
          role: UserRole.STUDENT,
          phone_verified: true,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    } else if (!user.phone_verified) {
      await this.database.db
        .updateTable('users')
        .set({ phone_verified: true })
        .where('id', '=', user.id)
        .execute();
      user.phone_verified = true;
    }

    if (!user.is_active) throw new UnauthorizedException('Account is deactivated');

    return this.issueSession(user.id, meta);
  }

  /**
   * Validates an OTP for a non-login purpose (e.g. confirming a pre-registration
   * contract via SMS) without issuing tokens.
   */
  async assertOtpValid(phone: string, code: string, purpose: string): Promise<void> {
    await this.consumeOtp(phone, code, purpose);
  }

  private async consumeOtp(
    phone: string,
    code: string,
    ...purposes: string[]
  ): Promise<void> {
    const otpConfig = this.config.get('otp', { infer: true });

    // A configured dev code short-circuits verification outside production.
    if (otpConfig.devCode && code === otpConfig.devCode) {
      this.logger.warn(`Development OTP bypass used for ${phone}`);
      return;
    }

    const now = new Date();
    const record = await this.database.db
      .selectFrom('otp_codes')
      .selectAll()
      .where('phone', '=', phone)
      .where('purpose', 'in', purposes)
      .where('consumed_at', 'is', null)
      .orderBy('created_at', 'desc')
      .executeTakeFirst();

    if (!record) throw new BadRequestException('No verification code was requested');
    if (record.expires_at < now) {
      throw new BadRequestException('The verification code has expired');
    }
    if (record.attempts >= otpConfig.maxAttempts) {
      throw new BadRequestException('Too many incorrect attempts. Request a new code.');
    }

    if (record.code_hash !== this.hashCode(code)) {
      await this.database.db
        .updateTable('otp_codes')
        .set({ attempts: record.attempts + 1 })
        .where('id', '=', record.id)
        .execute();
      throw new BadRequestException('The verification code is incorrect');
    }

    await this.database.db
      .updateTable('otp_codes')
      .set({ consumed_at: now })
      .where('id', '=', record.id)
      .execute();
  }

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  /* -------------------------------------------------- password login --- */

  async register(
    dto: RegisterDto,
    meta: { ip?: string; userAgent?: string } = {},
  ): Promise<AuthResponse> {
    const passwordError = validatePassword(dto.password);
    if (passwordError) throw new BadRequestException(passwordError);

    const existing = await this.database.db
      .selectFrom('users')
      .select('id')
      .where((eb) =>
        eb.or([
          eb('phone', '=', dto.phone),
          ...(dto.email ? [eb('email', '=', dto.email.toLowerCase())] : []),
        ]),
      )
      .executeTakeFirst();

    if (existing) {
      throw new ConflictException('An account with this phone or email already exists');
    }

    const user = await this.database.db
      .insertInto('users')
      .values({
        phone: dto.phone,
        email: dto.email?.toLowerCase() ?? null,
        full_name: dto.fullName,
        password_hash: await hash(dto.password, BCRYPT_ROUNDS),
        role: dto.role ?? UserRole.STUDENT,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    return this.issueSession(user.id, meta);
  }

  async login(
    dto: LoginDto,
    meta: { ip?: string; userAgent?: string } = {},
  ): Promise<AuthResponse> {
    const user = await this.database.db
      .selectFrom('users')
      .select(['id', 'password_hash', 'is_active'])
      .where('phone', '=', dto.phone)
      .executeTakeFirst();

    // Constant-ish work factor whether or not the account exists.
    const hashToCheck =
      user?.password_hash ?? '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi';
    const passwordMatches = await compare(dto.password, hashToCheck);

    if (!user || !user.password_hash || !passwordMatches) {
      throw new UnauthorizedException('Incorrect phone number or password');
    }
    if (!user.is_active) throw new UnauthorizedException('Account is deactivated');

    return this.issueSession(user.id, meta);
  }

  /* ----------------------------------------------------------- tokens --- */

  async issueSession(
    userId: string,
    meta: { ip?: string; userAgent?: string } = {},
  ): Promise<AuthResponse> {
    const jwtConfig = this.config.get('jwt', { infer: true });

    const user = await this.database.db
      .selectFrom('users')
      .selectAll()
      .where('id', '=', userId)
      .executeTakeFirstOrThrow();

    const memberships = await this.database.db
      .selectFrom('institute_members')
      .select('institute_id')
      .where('user_id', '=', userId)
      .execute();

    const instituteIds = memberships.map((m) => m.institute_id);

    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      role: user.role as UserRole,
      phone: user.phone,
      inst: instituteIds,
      type: 'access',
    };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: jwtConfig.accessSecret,
      expiresIn: jwtConfig.accessTtlSeconds,
    });

    const jti = randomBytes(24).toString('hex');
    const refreshPayload: RefreshTokenPayload = { sub: user.id, type: 'refresh', jti };
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: jwtConfig.refreshSecret,
      expiresIn: jwtConfig.refreshTtlSeconds,
    });

    await this.database.db
      .insertInto('refresh_tokens')
      .values({
        user_id: user.id,
        token_hash: this.hashCode(refreshToken),
        expires_at: new Date(Date.now() + jwtConfig.refreshTtlSeconds * 1000),
        user_agent: meta.userAgent?.slice(0, 300) ?? null,
        ip_address: meta.ip?.slice(0, 64) ?? null,
      })
      .execute();

    await this.database.db
      .updateTable('users')
      .set({ last_login_at: new Date() })
      .where('id', '=', user.id)
      .execute();

    return {
      accessToken,
      refreshToken,
      expiresIn: jwtConfig.accessTtlSeconds,
      user: this.toSessionUser(
        {
          id: user.id,
          full_name: user.full_name,
          phone: user.phone,
          email: user.email,
          role: user.role as UserRole,
          avatar_url: user.avatar_url,
        },
        instituteIds[0] ?? null,
      ),
    };
  }

  /** Rotates a refresh token: the presented token is revoked and a new pair issued. */
  async refresh(
    refreshToken: string,
    meta: { ip?: string; userAgent?: string } = {},
  ): Promise<AuthResponse> {
    const jwtConfig = this.config.get('jwt', { infer: true });

    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: jwtConfig.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Refresh token is invalid');
    }

    const tokenHash = this.hashCode(refreshToken);
    const stored = await this.database.db
      .selectFrom('refresh_tokens')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .executeTakeFirst();

    if (!stored) throw new UnauthorizedException('Refresh token is not recognised');
    if (stored.revoked_at) {
      // Token reuse — revoke the whole family as a precaution.
      await this.database.db
        .updateTable('refresh_tokens')
        .set({ revoked_at: new Date() })
        .where('user_id', '=', stored.user_id)
        .where('revoked_at', 'is', null)
        .execute();
      throw new UnauthorizedException('Refresh token was already used. Please sign in again.');
    }
    if (stored.expires_at < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    await this.database.db
      .updateTable('refresh_tokens')
      .set({ revoked_at: new Date() })
      .where('id', '=', stored.id)
      .execute();

    return this.issueSession(stored.user_id, meta);
  }

  async logout(refreshToken: string): Promise<{ success: boolean }> {
    await this.database.db
      .updateTable('refresh_tokens')
      .set({ revoked_at: new Date() })
      .where('token_hash', '=', this.hashCode(refreshToken))
      .where('revoked_at', 'is', null)
      .execute();
    return { success: true };
  }

  async logoutAll(userId: string): Promise<{ success: boolean }> {
    await this.database.db
      .updateTable('refresh_tokens')
      .set({ revoked_at: new Date() })
      .where('user_id', '=', userId)
      .where('revoked_at', 'is', null)
      .execute();
    return { success: true };
  }

  /* ---------------------------------------------------------- profile --- */

  async getProfile(userId: string): Promise<SessionUser> {
    const user = await this.database.db
      .selectFrom('users')
      .select(['id', 'full_name', 'phone', 'email', 'role', 'avatar_url'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) throw new NotFoundException('User not found');

    const membership = await this.database.db
      .selectFrom('institute_members')
      .select('institute_id')
      .where('user_id', '=', userId)
      .executeTakeFirst();

    return this.toSessionUser(
      { ...user, role: user.role as UserRole },
      membership?.institute_id ?? null,
    );
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<SessionUser> {
    if (dto.email) {
      const clash = await this.database.db
        .selectFrom('users')
        .select('id')
        .where('email', '=', dto.email.toLowerCase())
        .where('id', '!=', userId)
        .executeTakeFirst();
      if (clash) throw new ConflictException('This email is already in use');
    }

    await this.database.db
      .updateTable('users')
      .set({
        ...(dto.fullName !== undefined ? { full_name: dto.fullName } : {}),
        ...(dto.email !== undefined ? { email: dto.email.toLowerCase() } : {}),
        ...(dto.avatarUrl !== undefined ? { avatar_url: dto.avatarUrl } : {}),
      })
      .where('id', '=', userId)
      .execute();

    return this.getProfile(userId);
  }

  private toSessionUser(
    user: {
      id: string;
      full_name: string;
      phone: string;
      email: string | null;
      role: UserRole;
      avatar_url: string | null;
    },
    instituteId: string | null,
  ): SessionUser {
    return {
      id: user.id,
      fullName: user.full_name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatar_url,
      instituteId,
    };
  }
}
