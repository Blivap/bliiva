import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { isAdmin, isStaff, type SupportActor } from './support-actor.js';
import type { SupportRequest } from './support-auth.guard.js';

function actorOf(context: ExecutionContext): SupportActor {
  const request = context.switchToHttp().getRequest<SupportRequest>();
  if (!request.supportActor) {
    throw new UnauthorizedException('User credentials are required.');
  }
  return request.supportActor;
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!isAdmin(actorOf(context))) {
      throw new ForbiddenException('Administrator access is required.');
    }
    return true;
  }
}

@Injectable()
export class StaffGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (!isStaff(actorOf(context))) {
      throw new ForbiddenException('Support staff access is required.');
    }
    return true;
  }
}
