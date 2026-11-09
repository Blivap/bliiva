import { createHmac, timingSafeEqual } from 'node:crypto';

export interface VerifiedJwtPayload {
  sub: string;
  roles: string[];
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

/**
 * Verifies an HS256 JWT with Node's crypto. Rejects any other alg, including `none`.
 */
export function verifyHs256Jwt(
  token: string,
  secret: string,
  nowMs = Date.now(),
): VerifiedJwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

  let header: { alg?: string };
  try {
    header = JSON.parse(decodeBase64Url(encodedHeader).toString('utf8')) as {
      alg?: string;
    };
  } catch {
    return null;
  }
  if (header.alg !== 'HS256') return null;

  const expected = createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  let actual: Buffer;
  try {
    actual = decodeBase64Url(encodedSignature);
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(
      decodeBase64Url(encodedPayload).toString('utf8'),
    ) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (typeof payload.exp === 'number' && payload.exp * 1000 <= nowMs) {
    return null;
  }

  const subject =
    typeof payload.sub === 'string'
      ? payload.sub
      : typeof payload.userId === 'string'
        ? payload.userId
        : null;
  if (!subject) return null;

  const roles = Array.isArray(payload.roles)
    ? payload.roles.filter((role): role is string => typeof role === 'string')
    : [];

  return { sub: subject, roles };
}
