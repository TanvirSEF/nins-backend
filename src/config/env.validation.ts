import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsString()
  MONGO_URI: string;

  @IsNumber()
  PORT: number = 3000;

  // Redis — optional, falls back to defaults
  @IsOptional()
  @IsString()
  REDIS_HOST: string = 'localhost';

  @IsOptional()
  @IsNumber()
  REDIS_PORT: number = 6379;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD: string = '';

  // JWT — access token (short-lived, sent as Bearer; held in client memory only).
  @IsString()
  JWT_SECRET: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_EXPIRES_IN: string = '15m';

  // JWT — refresh token (long-lived, httpOnly cookie; rotated + reuse-tracked in Redis).
  // Required: a refresh token must be signed with a distinct secret from the access token.
  @IsString()
  JWT_REFRESH_SECRET: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  // CORS — comma-separated allowed browser origins (e.g. "https://app.example.com").
  // When unset, the request origin is reflected (same-origin friendly). Set this to the
  // frontend origin(s) in production once that domain is finalized.
  @IsOptional()
  @IsString()
  CORS_ORIGINS: string;

  // Cookie domain for the refresh cookie. Omit (host-only cookie) when the frontend and
  // backend share an origin; set to ".zephlotech.com" only if they're on different subdomains.
  @IsOptional()
  @IsString()
  COOKIE_DOMAIN: string;

  // SSLCommerz Payment Gateway
  @IsString()
  SSLCOMMERZ_STORE_ID: string;

  @IsString()
  SSLCOMMERZ_STORE_PASSWORD: string;

  @IsOptional()
  @IsString()
  SSLCOMMERZ_IS_LIVE: string = 'false';

  @IsOptional()
  @IsString()
  APPOINTMENT_FEE: string = '50';

  @IsString()
  BACKEND_URL: string;

  // Frontend origin — payment callbacks redirect the browser here after SSLCommerz
  @IsOptional()
  @IsString()
  FRONTEND_URL: string = 'http://localhost:3000';

  // Email (Resend)
  @IsString()
  RESEND_API_KEY: string;

  @IsOptional()
  @IsString()
  MAIL_FROM: string = 'NINS Hospital <onboarding@resend.dev>';

  // Cloudflare R2 (file storage)
  @IsString()
  R2_ACCOUNT_ID: string;

  @IsString()
  R2_ACCESS_KEY_ID: string;

  @IsString()
  R2_SECRET_ACCESS_KEY: string;

  @IsString()
  R2_BUCKET_NAME: string;

  @IsOptional()
  @IsString()
  R2_PUBLIC_BASE_URL: string = '';

  // Backup
  @IsOptional()
  @IsString()
  BACKUP_RETENTION_DAYS: string = '30';

  @IsOptional()
  @IsString()
  BACKUP_CRON: string = '0 2 * * *';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, {
    ...config,
    PORT: config.PORT ? Number(config.PORT) : 3000,
    REDIS_PORT: config.REDIS_PORT ? Number(config.REDIS_PORT) : 6379,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((err) => Object.values(err.constraints || {}).join(', '))
      .join('; ');
    throw new Error(`Environment validation failed: ${messages}`);
  }

  return validatedConfig;
}
