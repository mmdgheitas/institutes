import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@institutes/shared';
import { IS_PUBLIC_KEY, ROLES_KEY, type AuthenticatedRequest } from '../decorators';

/**
 * Role check that runs after `JwtAuthGuard`.
 * SUPER_ADMIN implicitly satisfies every role requirement.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Authentication required');
    if (user.role === UserRole.SUPER_ADMIN) return true;

    if (!required.includes(user.role)) {
      throw new ForbiddenException(
        `This action requires one of the following roles: ${required.join(', ')}`,
      );
    }
    return true;
  }
}
