import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { jest } from '@jest/globals';
import { ErrorCode } from '../../common/constants/error-code.constant';
import { AppException } from '../../common/exceptions/app.exception';
import { MediaService } from './media.service';

const configValues: Record<string, unknown> = {
  AWS_REGION: 'ap-southeast-1',
  AWS_S3_BUCKET: 'homespace-news-test',
  AWS_S3_UPLOAD_URL_DURATION_SECONDS: 600,
};

function config(): ConfigService {
  return {
    getOrThrow: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;
}

describe('MediaService', () => {
  it('rejects files that are not supported news images', async () => {
    const model = { create: jest.fn() };
    const service = new MediaService(
      model as never,
      config(),
      new S3Client({
        region: 'ap-southeast-1',
        credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
      }),
    );

    await expect(
      service.createUpload('admin-1', {
        fileName: 'payload.svg',
        contentType: 'image/svg+xml',
        size: 100,
      }),
    ).rejects.toMatchObject({ definition: ErrorCode.NEWS_INVALID_MEDIA });
    expect(model.create).not.toHaveBeenCalled();
  });

  it('marks an uploaded object ready only when S3 metadata matches', async () => {
    const asset = {
      _id: 'asset-1',
      ownerId: 'admin-1',
      bucketName: 'homespace-news-test',
      objectKey: 'news/admin-1/asset-1.webp',
      contentType: 'image/webp',
      sizeBytes: 1024,
      status: 'PENDING',
      save: jest.fn(async function (this: { status: string }) {
        return this;
      }),
    };
    const model = {
      findById: jest.fn(() => ({ exec: async () => asset })),
    };
    const s3 = { send: jest.fn(async () => ({ ContentLength: 1024, ContentType: 'image/webp' })) };
    const service = new MediaService(model as never, config(), s3 as never);

    const result = await service.completeUpload('admin-1', 'asset-1');

    expect(result.status).toBe('READY');
    expect(asset.status).toBe('READY');
    expect(asset.save).toHaveBeenCalledTimes(1);
  });

  it('rejects media owned by another user when resolving article assets', async () => {
    const model = {
      find: jest.fn(() => ({
        lean: () => ({
          exec: async () => [
            {
              _id: 'asset-1',
              ownerId: 'another-user',
              status: 'READY',
              bucketName: 'homespace-news-test',
              objectKey: 'news/another-user/asset-1.webp',
              contentType: 'image/webp',
              sizeBytes: 100,
            },
          ],
        }),
      })),
    };
    const service = new MediaService(model as never, config(), { send: jest.fn() } as never);

    await expect(
      service.resolveReadyOwnedAssets('admin-1', ['asset-1']),
    ).rejects.toEqual(new AppException(ErrorCode.NEWS_MEDIA_FORBIDDEN));
  });
});
