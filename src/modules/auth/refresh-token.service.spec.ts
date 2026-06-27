import { UnauthorizedException } from '@nestjs/common';
import Redis from 'ioredis';
import { JwtService } from '@nestjs/jwt';
import { RefreshTokenService, RefreshPayload } from './refresh-token.service';

/**
 * Minimal in-memory Redis that implements just the surface the service uses.
 * Tracks expiry so TTL is honored; supports `multi().del().set().exec()` and
 * `scan(MATCH)` so rotation + reuse detection + family revocation are exercised.
 */
function createFakeRedis() {
  const store = new Map<string, { value: string; expiresAt: number }>();
  const now = () => Date.now();
  const globToRe = (glob: string) =>
    new RegExp('^' + glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');

  const fake = {
    async set(key: string, value: string, _mode?: string, ttlSeconds?: number) {
      store.set(key, {
        value,
        expiresAt: ttlSeconds ? now() + ttlSeconds * 1000 : Infinity,
      });
      return 'OK';
    },
    async exists(key: string) {
      const entry = store.get(key);
      return entry && entry.expiresAt > now() ? 1 : 0;
    },
    async del(key: string) {
      return store.delete(key) ? 1 : 0;
    },
    async unlink(...keys: string[]) {
      let n = 0;
      for (const k of keys) if (store.delete(k)) n++;
      return n;
    },
    async ttl(key: string) {
      const entry = store.get(key);
      if (!entry) return -2;
      if (entry.expiresAt === Infinity) return -1;
      return Math.max(1, Math.ceil((entry.expiresAt - now()) / 1000));
    },
    async scan(_cursor: string, _opt: string, pattern: string) {
      const re = globToRe(pattern);
      const keys = [...store.keys()].filter((k) => re.test(k));
      return ['0', keys] as [string, string[]];
    },
    multi() {
      const ops: Array<() => Promise<unknown>> = [];
      const chain = {
        del: (key: string) => {
          ops.push(() => fake.del(key));
          return chain;
        },
        set: (key: string, value: string, mode?: string, ttl?: number) => {
          ops.push(() => fake.set(key, value, mode, ttl));
          return chain;
        },
        exec: async () => {
          for (const op of ops) await op();
          return [];
        },
      };
      return chain;
    },
  };
  return fake;
}

function createFakeJwt() {
  return {
    sign(payload: RefreshPayload) {
      return `signed:${JSON.stringify(payload)}`;
    },
    verify<T>(token: string): T {
      if (typeof token !== 'string' || !token.startsWith('signed:')) {
        throw new Error('invalid signature');
      }
      return JSON.parse(token.slice('signed:'.length)) as T;
    },
  };
}

const fakeConfig = {
  get: (key: string) => (key === 'JWT_REFRESH_EXPIRES_IN' ? '7d' : undefined),
};

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;

  beforeEach(() => {
    service = new RefreshTokenService(
      createFakeRedis() as unknown as Redis,
      createFakeJwt() as unknown as JwtService,
      fakeConfig as any,
    );
  });

  it('issues a token that verifies as active', async () => {
    const token = await service.issue('user-1');
    const payload = await service.verify(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.family).toBeDefined();
    expect(payload.jti).toBeDefined();
  });

  it('rotates within the same family and retires the old jti', async () => {
    const token = await service.issue('user-1');
    const payload = await service.verify(token);

    const next = await service.rotate(payload);
    const nextPayload = await service.verify(next);

    expect(nextPayload.family).toBe(payload.family); // same family
    expect(nextPayload.jti).not.toBe(payload.jti); // new jti
  });

  it('detects reuse of a rotated token and revokes the whole family', async () => {
    const token = await service.issue('user-1');
    const payload = await service.verify(token);
    const next = await service.rotate(payload); // token is now stale

    // Replaying the old, already-rotated token trips reuse detection.
    await expect(service.verify(token)).rejects.toThrow(
      UnauthorizedException,
    );

    // …which revokes the family, so the legitimately-rotated token is dead too.
    await expect(service.verify(next)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token with a bad signature', async () => {
    await expect(service.verify('tampered')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a structurally-valid token that is not in the store', async () => {
    const orphan: RefreshPayload = {
      sub: 'user-1',
      family: 'nope',
      jti: 'nope',
    };
    await expect(
      service.verify(`signed:${JSON.stringify(orphan)}`),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('revoke() invalidates only the current token', async () => {
    const token = await service.issue('user-1');
    const payload = await service.verify(token);

    await service.revoke(payload);

    await expect(service.verify(token)).rejects.toThrow(UnauthorizedException);
  });
});
