import { plainToInstance, Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 8083;

  @IsString()
  SERVICE_NAME = 'hs-news-service';

  @IsString()
  @IsNotEmpty()
  MONGODB_URI!: string;

  @IsUrl({ require_tld: false })
  EUREKA_CLIENT_SERVICE_URL = 'http://localhost:8761/eureka';

  @IsString()
  EUREKA_INSTANCE_HOSTNAME = 'localhost';

  @IsString()
  @IsNotEmpty()
  AWS_REGION!: string;

  @IsString()
  @IsNotEmpty()
  AWS_S3_BUCKET!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3600)
  AWS_S3_UPLOAD_URL_DURATION_SECONDS = 600;
}

export function validateEnvironment(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration: ${errors.toString()}`);
  }

  return validated;
}
