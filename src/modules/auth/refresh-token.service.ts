import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';
import { durationToSeconds } from '../../common/utils/cookies';

/** DI tokens kept local to the auth module (mirrors AppointmentModule's REDIS_CLIENT). */
export const AUTH_REDIS = 'AUTH_REDIS';
export const REFRESH_JWT = 'REFRESH_JWT';

export interface RefreshPayload {
  /** user id (mirrors the access-token `sub`). */
  sub: string;
  /** rotation family — all tokens minted from one login share this id. */
  family: string;
  /** unique id of this single token; changes on every rotation. */
  jti: string;
}

/**
 * Redis-backed refresh-token store implementing **rotation with reuse detection**.
 *
 * Lifecycle of a token:
 *  - issue()    → new family + jti, stored as `active` (TTL = refresh expiry).
 *  - verify()   → JWT check, then: `active` → valid · `used` → REUSE → revoke
 *                 the whole family · neither → expired/unknown.
 *  - rotate()   → retire the old jti (active→used), mint a fresh jti in the SAME
 *                 family, store it active. The presented cookie is invalidated.
 *
 * Reuse detection is the core defense: an attacker who steals a refresh token and
 * the legitimate user will both try to rotate it. Whoever rotates first wins; the
 * other's now-stale token lands in `used`, which trips a full-family revoke and
 * forces everyone (attacker included) to re-authenticate.
 */
@Injectable()
export class RefreshTokenService {
  private readonly ttl: number;
  private readonly scanCount = 100;

  constructor(
    @Inject(AUTH_REDIS) private readonly redis: Redis,
    @Inject(REFRESH_JWT) private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.ttl = durationToSeconds(config.get<string>('JWT_REFRESH_EXPIRES_IN'));
  }

  /** Issue the first refresh token of a new family (login/register). */
  async issue(userId: string): Promise<string> {
    const payload: RefreshPayload = {
      sub: userId,
      family: randomUUID(),
      jti: randomUUID(),
    };
    await this.markActive(payload);
    return this.jwt.sign(payload);
  }

  /** Verify signature/expiry AND enforce rotation/reuse rules against the store. */
  async verify(token: string): Promise<RefreshPayload> {
    let payload: RefreshPayload;
    try {
      payload = this.jwt.verify<RefreshPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (await this.redis.exists(this.activeKey(payload))) return payload;

    if (await this.redis.exists(this.usedKey(payload))) {
      // A previously-rotated token is being replayed → burn the whole family.
      await this.revokeFamily(payload.family);
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    throw new UnauthorizedException('Refresh token not recognized');
  }

  /** Retire the presented jti, mint a fresh jti in the same family, sign it. */
  async rotate(payload: RefreshPayload): Promise<string> {
    // Preserve the remaining TTL so a token refreshed near its expiry doesn't
    // silently get its lifetime extended.
    const remaining = await this.redis.ttl(this.activeKey(payload));
    const usedTtl = remaining > 0 ? remaining : this.ttl;

    await this.redis
      .multi()
      .del(this.activeKey(payload))
      .set(this.usedKey(payload), '1', 'EX', usedTtl)
      .exec();

    const next: RefreshPayload = {
      sub: payload.sub,
      family: payload.family,
      jti: randomUUID(),
    };
    await this.markActive(next);
    return this.jwt.sign(next);
  }

  /** Logout of one device: revoke only the current token (drop its active key). */
  async revoke(payload: RefreshPayload): Promise<void> {
    await this.redis.del(this.activeKey(payload));
  }

  /** Revoke every token in a family (reuse detection / force-everywhere logout). */
  async revokeFamily(family: string): Promise<void> {
    let cursor = '0';
    do {
      const [next, keys] = await this.redis.scan(
        cursor,
        'MATCH',
        this.familyPattern(family),
        'COUNT',
        this.scanCount,
      );
      cursor = next;
      if (keys.length) await this.redis.unlink(...keys);
    } while (cursor !== '0');
  }

  private async markActive(payload: RefreshPayload): Promise<void> {
    await this.redis.set(this.activeKey(payload), payload.sub, 'EX', this.ttl);
  }

  // ── key helpers ──────────────────────────────────────────────────────────
  private readonly keyspace = 'nins:refresh';
  private activeKey = (p: RefreshPayload) =>
    `${this.keyspace}:active:${p.family}:${p.jti}`;
  private usedKey = (p: RefreshPayload) =>
    `${this.keyspace}:used:${p.family}:${p.jti}`;
  private familyPattern = (family: string) =>
    `${this.keyspace}:*:${family}:*`;
}
