import { UnauthorizedException } from '@nestjs/common';
import type { BlivapCallContext } from '../../../integrations/blivap/blivap.types.js';
import type { SupportActor } from '../../../common/auth/support-actor.js';

export function requireBlivapContext(actor: SupportActor): BlivapCallContext {
  if (!actor.isAuthenticated || !actor.userId) {
    throw new UnauthorizedException('Please sign in to continue.');
  }
  if (!actor.accessToken) {
    throw new UnauthorizedException(
      'Open support from the signed-in app and try again.',
    );
  }
  return { userId: actor.userId, accessToken: actor.accessToken };
}
