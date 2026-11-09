export const SUPPORT_API_KEY_HEADER = 'x-support-api-key';
export const SUPPORT_USER_ID_HEADER = 'x-support-user-id';
export const SUPPORT_ROLES_HEADER = 'x-support-roles';
export const SUPPORT_GUEST_HEADER = 'x-support-guest-session';
export const SUPPORT_ACCESS_TOKEN_HEADER = 'x-support-access-token';

export const SupportRole = {
  User: 'user',
  Agent: 'agent',
  Supervisor: 'supervisor',
  Administrator: 'administrator',
} as const;

export type SupportRoleName = (typeof SupportRole)[keyof typeof SupportRole];

const ROLE_SET = new Set<string>(Object.values(SupportRole));

export interface SupportActor {
  userId: string | null;
  guestSessionId: string | null;
  roles: SupportRoleName[];
  isAuthenticated: boolean;
  /** Blivap user JWT for ownership-enforced outbound calls. Never logged. */
  accessToken: string | null;
}

export function isStaff(actor: SupportActor): boolean {
  return actor.roles.some(
    (role) =>
      role === SupportRole.Agent ||
      role === SupportRole.Supervisor ||
      role === SupportRole.Administrator,
  );
}

export function isAdmin(actor: SupportActor): boolean {
  return (
    actor.roles.includes(SupportRole.Administrator) ||
    actor.roles.includes(SupportRole.Supervisor)
  );
}

export function parseRoles(value: unknown): SupportRoleName[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  const roles: SupportRoleName[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const role = entry.trim().toLowerCase();
    if (ROLE_SET.has(role) && !roles.includes(role as SupportRoleName)) {
      roles.push(role as SupportRoleName);
    }
  }
  return roles;
}

export function isObjectIdString(value: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(value);
}

export function isGuestSession(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/.test(value);
}
