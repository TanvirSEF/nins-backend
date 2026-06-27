import type { Response } from 'express';
import type { ConfigService } from '@nestjs/config';

/** Name of the httpOnly refresh-token cookie. */
export const REFRESH_COOKIE_NAME = 'nins_refresh';

/**
 * Parse a "jwt/ms"-style duration string (`7d`, `15m`, `1h`, `30s`) into seconds.
 * Falls back to 7 days on anything unparseable so a misconfigured TTL can never
 * produce an absurdly short/long Redis entry.
 */
export function durationToSeconds(input: string | undefined): number {
  const DEFAULT = 7 * 24 * 60 * 60; // 7d
  if (!input) return DEFAULT;
  const match = /^(\d+)\s*(d|h|m|s)$/i.exec(input.trim());
  if (!match) return DEFAULT;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    d: 86400,
    h: 3600,
    m: 60,
    s: 1,
  };
  return value * multipliers[unit];
}

/** Cookie attributes for the refresh token. Same shape is reused to clear it. */
function refreshCookieOptions(config: ConfigService) {
  return {
    httpOnly: true,
    // Send only over HTTPS in production. In dev (http://localhost) Secure must
    // be off or the browser refuses to set the cookie.
    secure: config.get<string>('NODE_ENV') === 'production',
    sameSite: 'lax' as const,
    // The cookie is only ever read by /api/auth/* routes — scope it narrowly so it
    // isn't transmitted on every unrelated request.
    path: '/api/auth',
    domain: config.get<string>('COOKIE_DOMAIN') || undefined,
  };
}

export function setRefreshCookie(
  res: Response,
  token: string,
  config: ConfigService,
): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    ...refreshCookieOptions(config),
    maxAge: durationToSeconds(config.get<string>('JWT_REFRESH_EXPIRES_IN')) * 1000,
  });
}

export function clearRefreshCookie(res: Response, config: ConfigService): void {
  // clearCookie must use the same path/domain as setRefreshCookie, otherwise the
  // browser ignores it and the cookie lingers until expiry.
  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions(config));
}
