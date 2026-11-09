import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import {
  isGuestSession,
  isObjectIdString,
  parseRoles,
  SUPPORT_ACCESS_TOKEN_HEADER,
  SUPPORT_API_KEY_HEADER,
  SUPPORT_GUEST_HEADER,
  SUPPORT_ROLES_HEADER,
  SUPPORT_USER_ID_HEADER,
  SupportRole,
  type SupportActor,
} from './support-actor.js';
import { verifyHs256Jwt } from './jwt-hs256.js';

export interface SupportRequest extends Request {
  supportActor?: SupportActor;
}

function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function secretsMatch(provided: string, expected: string): boolean {
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  if (left.length === 0 || left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

@Injectable()
export class SupportAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<SupportRequest>();
    const actor = this.resolveActor(request);
    request.supportActor = actor;
    return true;
  }

  private resolveActor(request: SupportRequest): SupportActor {
    const configuredKey = this.config.get<string>('serviceAuth.apiKey', '');
    const nodeEnv = this.config.get<string>('nodeEnv', 'development');
    const providedKey = headerValue(request.headers[SUPPORT_API_KEY_HEADER]);

    if (nodeEnv === 'production' && !configuredKey) {
      throw new UnauthorizedException('Support service is not configured.');
    }
    if (configuredKey && !secretsMatch(providedKey, configuredKey)) {
      throw new UnauthorizedException('Invalid support service credentials.');
    }
    if (!configuredKey && nodeEnv !== 'test' && nodeEnv !== 'development') {
      throw new UnauthorizedException('Invalid support service credentials.');
    }

    const jwtSecret = this.config.get<string>('serviceAuth.userJwtSecret', '');
    const authorization = headerValue(request.headers.authorization);

    if (jwtSecret) {
      if (authorization.toLowerCase().startsWith('bearer ')) {
        return this.actorFromJwt(
          authorization.slice(7).trim(),
          jwtSecret,
          request,
        );
      }
      return this.guestActor(request);
    }

    return this.actorFromTrustedHeaders(request);
  }

  private actorFromJwt(
    token: string,
    secret: string,
    request: SupportRequest,
  ): SupportActor {
    const payload = verifyHs256Jwt(token, secret);
    if (!payload || !isObjectIdString(payload.sub)) {
      throw new UnauthorizedException('Invalid user credentials.');
    }
    const roles = parseRoles(payload.roles);
    return {
      userId: payload.sub,
      guestSessionId: null,
      roles: roles.length > 0 ? roles : [SupportRole.User],
      isAuthenticated: true,
      accessToken: this.accessTokenOf(request, token),
    };
  }

  private guestActor(request: SupportRequest): SupportActor {
    const guestSessionId = headerValue(request.headers[SUPPORT_GUEST_HEADER]);
    if (!isGuestSession(guestSessionId)) {
      throw new UnauthorizedException('User credentials are required.');
    }
    return {
      userId: null,
      guestSessionId,
      roles: [SupportRole.User],
      isAuthenticated: false,
      accessToken: null,
    };
  }

  private actorFromTrustedHeaders(request: SupportRequest): SupportActor {
    const userId = headerValue(request.headers[SUPPORT_USER_ID_HEADER]);
    const guestSessionId = headerValue(request.headers[SUPPORT_GUEST_HEADER]);
    const roles = parseRoles(
      headerValue(request.headers[SUPPORT_ROLES_HEADER]),
    );

    if (userId) {
      if (!isObjectIdString(userId)) {
        throw new UnauthorizedException('Invalid user credentials.');
      }
      return {
        userId,
        guestSessionId: null,
        roles: roles.length > 0 ? roles : [SupportRole.User],
        isAuthenticated: true,
        accessToken: this.accessTokenOf(request),
      };
    }

    if (!isGuestSession(guestSessionId)) {
      throw new UnauthorizedException('User credentials are required.');
    }

    return {
      userId: null,
      guestSessionId,
      roles: [SupportRole.User],
      isAuthenticated: false,
      accessToken: null,
    };
  }

  private accessTokenOf(
    request: SupportRequest,
    fallbackBearer?: string,
  ): string | null {
    const forwarded = headerValue(request.headers[SUPPORT_ACCESS_TOKEN_HEADER]);
    if (forwarded) return forwarded;
    return fallbackBearer ?? null;
  }
}
