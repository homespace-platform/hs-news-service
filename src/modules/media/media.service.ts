import { randomUUID } from 'node:crypto';
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { ErrorCode } from '../../common/constants/error-code.constant';
import { AppException } from '../../common/exceptions/app.exception';
import {
  NewsAsset,
  type NewsAssetDocument,
} from './persistence/news-asset.schema';
import type {
  CreateNewsUploadDto,
  CreateNewsUploadResponse,
  NewsAssetResponse,
} from './presentation/dto/media.dto';

const MAX_IMAGE_SIZE = 25 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class MediaService {
  private readonly bucket: string;
  private readonly region: string;
  private readonly uploadUrlDuration: number;

  constructor(
    @InjectModel(NewsAsset.name)
    private readonly assets: Model<NewsAsset>,
    config: ConfigService,
    private readonly s3: S3Client,
  ) {
    this.bucket = config.getOrThrow<string>('AWS_S3_BUCKET');
    this.region = config.getOrThrow<string>('AWS_REGION');
    this.uploadUrlDuration = config.getOrThrow<number>(
      'AWS_S3_UPLOAD_URL_DURATION_SECONDS',
    );
  }

  async createUpload(
    ownerId: string,
    request: CreateNewsUploadDto,
  ): Promise<CreateNewsUploadResponse> {
    const contentType = request.contentType.trim().toLowerCase();
    const extension = IMAGE_EXTENSIONS[contentType];
    if (!extension || request.size < 1 || request.size > MAX_IMAGE_SIZE) {
      throw new AppException(ErrorCode.NEWS_INVALID_MEDIA);
    }

    const storageId = randomUUID();
    const objectKey = `news/${storageId}.${extension}`;
    await this.assets.create({
      _id: storageId,
      originalName: request.fileName.trim(),
      objectKey,
      bucketName: this.bucket,
      contentType,
      sizeBytes: request.size,
      ownerId,
      status: 'PENDING',
    });
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ContentType: contentType,
        ContentLength: request.size,
      }),
      { expiresIn: this.uploadUrlDuration },
    );

    return {
      storageId,
      uploadUrl,
      method: 'PUT',
      objectKey,
      expiresAt: new Date(Date.now() + this.uploadUrlDuration * 1000),
    };
  }

  async completeUpload(
    ownerId: string,
    storageId: string,
    checksum?: string,
  ): Promise<NewsAssetResponse> {
    const asset = await this.assets.findById(storageId).exec();
    this.requireOwner(asset, ownerId);
    if (asset.status === 'READY') return this.toResponse(asset);
    if (asset.status !== 'PENDING') {
      throw new AppException(ErrorCode.NEWS_INVALID_MEDIA);
    }

    try {
      const head = await this.s3.send(
        new HeadObjectCommand({
          Bucket: asset.bucketName,
          Key: asset.objectKey,
        }),
      );
      if (
        head.ContentLength !== asset.sizeBytes ||
        head.ContentType?.toLowerCase() !== asset.contentType
      ) {
        asset.status = 'REJECTED';
        await asset.save();
        throw new AppException(ErrorCode.NEWS_INVALID_MEDIA);
      }
      asset.checksum = checksum?.trim() || undefined;
      asset.status = 'READY';
      await asset.save();
      return this.toResponse(asset);
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException(ErrorCode.NEWS_STORAGE_PROVIDER_ERROR);
    }
  }

  async resolveReadyOwnedAssets(
    ownerId: string,
    storageIds: string[],
  ): Promise<NewsAssetResponse[]> {
    const uniqueIds = [...new Set(storageIds)];
    if (uniqueIds.length !== storageIds.length) {
      throw new AppException(ErrorCode.NEWS_INVALID_MEDIA);
    }
    if (uniqueIds.length === 0) return [];

    const found = await this.assets
      .find({ _id: { $in: uniqueIds } })
      .lean()
      .exec();
    const byId = new Map(found.map((asset) => [asset._id, asset]));
    return uniqueIds.map((id) => {
      const asset = byId.get(id);
      if (!asset) throw new AppException(ErrorCode.NEWS_INVALID_MEDIA);
      this.requireOwner(asset, ownerId);
      if (asset.status !== 'READY') {
        throw new AppException(ErrorCode.NEWS_INVALID_MEDIA);
      }
      return this.toResponse(asset);
    });
  }

  private requireOwner(
    asset: NewsAsset | NewsAssetDocument | null,
    ownerId: string,
  ): asserts asset is NewsAsset | NewsAssetDocument {
    if (!asset) throw new AppException(ErrorCode.NEWS_INVALID_MEDIA);
    if (asset.ownerId !== ownerId) {
      throw new AppException(ErrorCode.NEWS_MEDIA_FORBIDDEN);
    }
  }

  private toResponse(asset: NewsAsset | NewsAssetDocument): NewsAssetResponse {
    return {
      id: asset._id,
      originalName: asset.originalName,
      contentType: asset.contentType,
      sizeBytes: asset.sizeBytes,
      checksum: asset.checksum,
      ownerId: asset.ownerId,
      status: asset.status,
      url: `https://${asset.bucketName}.s3.${this.region}.amazonaws.com/${asset.objectKey}`,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
  }
}
