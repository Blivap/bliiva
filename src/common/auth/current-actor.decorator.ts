import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { SupportActor } from './support-actor.js';
import type { SupportRequest } from './support-auth.guard.js';

export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SupportActor => {
    const request = context.switchToHttp().getRequest<SupportRequest>();
    if (!request.supportActor) {
      throw new UnauthorizedException('User credentials are required.');
    }
    return request.supportActor;
  },
);
