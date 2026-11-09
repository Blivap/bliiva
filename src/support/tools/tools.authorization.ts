import type { SupportActor } from '../../common/auth/support-actor.js';
import type { SupportActionDefinition } from '../actions/actions.types.js';

const IDENTITY_KEYS = ['userId', 'user_id', 'accountId', 'account_id', 'sub'];

export function authorizeToolCall(
  definition: SupportActionDefinition,
  actor: SupportActor,
  args: Record<string, unknown>,
):
  | { ok: true; args: Record<string, unknown> }
  | { ok: false; code: string; message: string } {
  for (const key of IDENTITY_KEYS) {
    const claimed = args[key];
    if (claimed == null || claimed === '') continue;
    const claimedId =
      typeof claimed === 'string' || typeof claimed === 'number'
        ? String(claimed)
        : null;
    if (claimedId == null || claimedId !== (actor.userId ?? '')) {
      return {
        ok: false,
        code: 'cross_user',
        message: 'I can only use the signed-in account.',
      };
    }
  }
  if (definition.requiresAuthentication && !actor.isAuthenticated) {
    return {
      ok: false,
      code: 'unauthenticated',
      message: 'Please sign in to continue.',
    };
  }
  for (const permission of definition.requiredPermissions) {
    if (!actor.roles.includes(permission as never)) {
      return {
        ok: false,
        code: 'forbidden',
        message: 'Permission denied.',
      };
    }
  }
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    if (!IDENTITY_KEYS.includes(key)) cleaned[key] = value;
  }
  return { ok: true, args: cleaned };
}
