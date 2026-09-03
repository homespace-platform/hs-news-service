import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AdminGuard } from '../src/modules/authentication/presentation/guards/admin.guard';
import { GatewayAuthenticationGuard } from '../src/modules/authentication/presentation/guards/gateway-authentication.guard';
import { MediaService } from '../src/modules/media/media.service';
import { MediaController } from '../src/modules/media/presentation/media.controller';

describe('MediaController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        GatewayAuthenticationGuard,
        AdminGuard,
        {
          provide: MediaService,
          useValue: {
            createUpload: async () => ({
              storageId: 'asset-1',
              uploadUrl: 'https://upload.example/asset-1',
              method: 'PUT',
              objectKey: 'news/asset-1.webp',
              expiresAt: new Date('2026-09-03T00:10:00Z'),
            }),
          },
        },
      ],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('creates a news-owned upload for an admin', async () => {
    await request(app.getHttpServer())
      .post('/admin/news/media/uploads')
      .set('X-User-Id', 'admin-1')
      .set('X-User-Role', 'ADMIN')
      .send({ fileName: 'cover.webp', contentType: 'image/webp', size: 1024 })
      .expect(201)
      .expect({
        code: 1000,
        message: 'Upload URL created',
        result: {
          storageId: 'asset-1',
          uploadUrl: 'https://upload.example/asset-1',
          method: 'PUT',
          objectKey: 'news/asset-1.webp',
          expiresAt: '2026-09-03T00:10:00.000Z',
        },
      });
  });

  it('rejects a non-admin', () =>
    request(app.getHttpServer())
      .post('/admin/news/media/uploads')
      .set('X-User-Id', 'user-1')
      .set('X-User-Role', 'USER')
      .send({ fileName: 'cover.webp', contentType: 'image/webp', size: 1024 })
      .expect(403));

  afterEach(async () => app.close());
});
