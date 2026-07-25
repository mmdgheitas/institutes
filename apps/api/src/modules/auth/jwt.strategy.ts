import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { UserRole } from '../../packages/shared/src/index';
import type { AppConfig } from '../../config/configuration';
import { DatabaseService } from '../../db/database.service';
import type { AuthenticatedUser } from '../../common/decorators';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  phone: string;
  /** Institute ids the user administers — embedded to avoid a query per request. */
  inst: string[];
  type: 'access';
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService<AppConfig, true>,
    private readonly database: DatabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('jwt', { infer: true }).accessSecret,
    });
  }

  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Re-read the user so that deactivation and role changes take effect
    // immediately rather than at token expiry.
    const user = await this.database.db
      .selectFrom('users')
      .select(['id', 'role', 'phone', 'email', 'full_name', 'is_active'])
      .where('id', '=', payload.sub)
      .executeTakeFirst();

    if (!user) throw new UnauthorizedException('Account no longer exists');
    if (!user.is_active) throw new UnauthorizedException('Account is deactivated');

    return {
      id: user.id,
      role: user.role as UserRole,
      phone: user.phone,
      email: user.email,
      fullName: user.full_name,
      instituteIds: payload.inst ?? [],
    };
  }
}
