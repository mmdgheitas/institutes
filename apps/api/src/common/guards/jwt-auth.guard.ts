import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators';

/**
 * Bearer-token guard that honours the `@Public()` decorator, so it can be
 * registered globally without annotating every open endpoint.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser>(err: unknown, user: TUser, info: unknown): TUser {
    if (err || !user) {
      const reason =
        info instanceof Error && info.name === 'TokenExpiredError'
          ? 'Access token has expired'
          : 'Authentication required';
      throw err instanceof Error ? err : new UnauthorizedException(reason);
    }
    return user;
  }
}

/**
 * Same as `JwtAuthGuard` but never rejects: it attaches `request.user` when a
 * valid token is present. Used by discovery endpoints that personalise results
 * (e.g. saved institutes) while remaining publicly accessible.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(_err: unknown, user: TUser): TUser | undefined {
    return user || undefined;
  }
}
