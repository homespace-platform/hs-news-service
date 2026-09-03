import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateNewsUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  fileName!: string;

  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25 * 1024 * 1024)
  size!: number;
}

export class CompleteNewsUploadDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  checksum?: string;
}

export interface CreateNewsUploadResponse {
  storageId: string;
  uploadUrl: string;
  method: 'PUT';
  objectKey: string;
  expiresAt: Date;
}

export interface NewsAssetResponse {
  id: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  checksum?: string;
  ownerId: string;
  status: string;
  url: string;
  createdAt?: Date;
  updatedAt?: Date;
}
