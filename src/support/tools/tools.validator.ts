import type { SupportActionDefinition } from '../actions/actions.types.js';

const IDENTITY_KEYS = new Set([
  'userid',
  'user_id',
  'accountid',
  'account_id',
  'sub',
]);

export function validateToolArguments(
  definition: SupportActionDefinition,
  args: Record<string, unknown>,
):
  | { ok: true; params: Record<string, string> }
  | { ok: false; message: string } {
  const allowed = new Set(
    definition.parameters.map((parameter) => parameter.name),
  );
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(args)) {
    if (IDENTITY_KEYS.has(key.toLowerCase())) continue;
    if (!allowed.has(key)) {
      return { ok: false, message: `Unexpected argument: ${key}.` };
    }
    if (typeof value === 'string') {
      params[key] = value.trim();
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      params[key] = String(value);
    } else if (value != null) {
      return { ok: false, message: `${key} must be a string.` };
    }
  }
  const missing = definition.parameters.filter(
    (parameter) => parameter.required && !params[parameter.name],
  );
  if (missing.length > 0) {
    return {
      ok: false,
      message: `Missing ${missing.map((parameter) => parameter.name).join(', ')}.`,
    };
  }
  return { ok: true, params };
}
