import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';

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

  // JWT
  @IsString()
  JWT_SECRET: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN: string = '7d';

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
