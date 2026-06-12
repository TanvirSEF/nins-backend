import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsString, validateSync } from 'class-validator';

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
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, {
    ...config,
    PORT: config.PORT ? Number(config.PORT) : 3000,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const messages = errors.map((err) => Object.values(err.constraints || {}).join(', ')).join('; ');
    throw new Error(`Environment validation failed: ${messages}`);
  }

  return validatedConfig;
}
