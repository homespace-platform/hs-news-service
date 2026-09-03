import { jest } from '@jest/globals';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { NewsService } from '../src/modules/news/news.service';
import { PublicNewsController } from '../src/modules/news/presentation/public-news.controller';

describe('Public news routes (e2e)', () => {
  let app: INestApplication;
  const news = {
    findPublished: jest.fn(async () => ({
      code: 1000,
      result: [],
      page: 1,
      size: 12,
      totalElements: 0,
      totalPages: 0,
      hasMore: false,
    })),
    recordView: jest.fn(async () => ({ views: 1 })),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicNewsController],
      providers: [{ provide: NewsService, useValue: news }],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  afterAll(async () => app.close());

  it('keeps the public list default page size at 12', async () => {
    await request(app.getHttpServer()).get('/public/news').expect(200);

    expect(news.findPublished).toHaveBeenCalledWith(1, 12, undefined, undefined);
  });

  it('rejects public page sizes above 50', async () => {
    await request(app.getHttpServer()).get('/public/news?size=51').expect(400);
  });

  it('increments a published article when opened', async () => {
    await request(app.getHttpServer()).post('/public/news/tin-moi/view').expect(201);

    expect(news.recordView).toHaveBeenCalledWith('tin-moi');
  });
});
