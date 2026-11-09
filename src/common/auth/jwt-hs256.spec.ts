import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyHs256Jwt } from './jwt-hs256.js';

function token(
  payload: Record<string, unknown>,
  secret = 'secret',
  alg = 'HS256',
) {
  const header = Buffer.from(JSON.stringify({ alg, typ: 'JWT' })).toString(
    'base64url',
  );
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

describe('HS256 user tokens', () => {
  it('accepts a signed token and rejects none, bad signatures, and expiry', () => {
    const good = token({
      sub: '64b000000000000000000001',
      roles: ['user'],
    });
    expect(verifyHs256Jwt(good, 'secret')?.sub).toBe(
      '64b000000000000000000001',
    );
    expect(verifyHs256Jwt(good, 'other')).toBeNull();

    const noneHeader = Buffer.from(JSON.stringify({ alg: 'none' })).toString(
      'base64url',
    );
    const body = Buffer.from(
      JSON.stringify({ sub: '64b000000000000000000001' }),
    ).toString('base64url');
    expect(verifyHs256Jwt(`${noneHeader}.${body}.`, 'secret')).toBeNull();

    const expired = token({
      sub: '64b000000000000000000001',
      exp: 1,
    });
    expect(verifyHs256Jwt(expired, 'secret')).toBeNull();
  });
});
