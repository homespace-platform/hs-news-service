import { jest } from '@jest/globals';
import { ErrorCode } from '../../common/constants/error-code.constant';
import { NewsService } from './news.service';
import type { NewsUpsertDto } from './presentation/dto/news.dto';

const publishedRequest: NewsUpsertDto = {
  title: 'Thị trường hôm nay',
  slug: 'thi-truong-hom-nay',
  summary: 'Tóm tắt thị trường bất động sản.',
  category: 'MARKET',
  status: 'PUBLISHED',
  featured: true,
  tags: ['thị trường', 'bất động sản'],
  thumbnailStorageObjectId: 'thumbnail-1',
  contentBlocks: [
    { type: 'HEADING', text: 'Tổng quan' },
    {
      type: 'IMAGE',
      storageObjectId: 'content-1',
      altText: 'Biểu đồ',
      caption: 'Số liệu tháng này',
    },
    { type: 'PARAGRAPH', text: 'Nội dung bài viết.' },
  ],
};

const resolvedAssets = [
  {
    id: 'thumbnail-1',
    originalName: 'thumbnail.webp',
    contentType: 'image/webp',
    sizeBytes: 100,
    ownerId: 'admin-1',
    status: 'READY',
    url: 'https://cdn.example/thumbnail.webp',
  },
  {
    id: 'content-1',
    originalName: 'content.webp',
    contentType: 'image/webp',
    sizeBytes: 100,
    ownerId: 'admin-1',
    status: 'READY',
    url: 'https://cdn.example/content.webp',
  },
];

function document(values: Record<string, unknown>) {
  return {
    ...values,
    save: jest.fn(async function (this: Record<string, unknown>) {
      return this;
    }),
  };
}

describe('NewsService', () => {
  it('creates a published article with owned ready media snapshots', async () => {
    const model = {
      exists: jest.fn(async () => null),
      create: jest.fn(async (value: Record<string, unknown>) =>
        document({
          ...value,
          createdAt: new Date('2026-09-03T00:00:00Z'),
          updatedAt: new Date('2026-09-03T00:00:00Z'),
        }),
      ),
    };
    const media = {
      resolveReadyOwnedAssets: jest.fn(async () => resolvedAssets),
    };
    const service = new NewsService(model as never, media as never);

    const response = await service.create(
      {
        userId: 'admin-1',
        email: 'admin@homespace.vn',
        name: 'Home Space Admin',
        role: 'ADMIN',
        authorities: [],
      },
      publishedRequest,
    );

    expect(response.slug).toBe('thi-truong-hom-nay');
    expect(response.status).toBe('PUBLISHED');
    expect(response.authorName).toBe('Home Space Admin');
    expect(response.publishedAt).toBeInstanceOf(Date);
    expect(response.thumbnailUrl).toBe('https://cdn.example/thumbnail.webp');
    expect(response.media).toHaveLength(2);
  });

  it('rejects a duplicate slug before resolving media', async () => {
    const model = { exists: jest.fn(async () => ({ _id: 'news-1' })) };
    const media = { resolveReadyOwnedAssets: jest.fn() };
    const service = new NewsService(model as never, media as never);

    await expect(
      service.create(
        { userId: 'admin-1', role: 'ADMIN', authorities: [] },
        publishedRequest,
      ),
    ).rejects.toMatchObject({ definition: ErrorCode.NEWS_SLUG_EXISTS });
    expect(media.resolveReadyOwnedAssets).not.toHaveBeenCalled();
  });

  it('requires a thumbnail before publishing', async () => {
    const model = { exists: jest.fn(async () => null) };
    const media = { resolveReadyOwnedAssets: jest.fn() };
    const service = new NewsService(model as never, media as never);

    await expect(
      service.create(
        { userId: 'admin-1', role: 'ADMIN', authorities: [] },
        { ...publishedRequest, thumbnailStorageObjectId: undefined },
      ),
    ).rejects.toMatchObject({ definition: ErrorCode.NEWS_INVALID_CONTENT });
    expect(media.resolveReadyOwnedAssets).not.toHaveBeenCalled();
  });

  it('does not expose a draft through the public detail query', async () => {
    const model = {
      findOne: jest.fn(() => ({ exec: async () => null })),
    };
    const service = new NewsService(model as never, {} as never);

    await expect(service.getPublishedBySlug('ban-nhap')).rejects.toMatchObject({
      definition: ErrorCode.NEWS_NOT_FOUND,
    });
    expect(model.findOne).toHaveBeenCalledWith({
      slug: 'ban-nhap',
      status: 'PUBLISHED',
      active: true,
    });
  });

  it('increments the published article view count atomically', async () => {
    const article = document({
      _id: 'news-1',
      slug: 'tin-moi',
      status: 'PUBLISHED',
      active: true,
      views: 5,
      media: [],
    });
    const query = { exec: jest.fn(async () => article) };
    const model = {
      findOneAndUpdate: jest.fn(() => query),
    };
    const service = new NewsService(model as never, {} as never);

    const response = await service.recordView('tin-moi');

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { slug: 'tin-moi', status: 'PUBLISHED', active: true },
      { $inc: { views: 1 } },
      { new: true },
    );
    expect(response).toEqual({ views: 5 });
  });

  it('returns the existing page envelope for published articles', async () => {
    const article = {
      _id: 'news-1',
      title: 'Tin mới',
      slug: 'tin-moi',
      summary: 'Tóm tắt',
      category: 'MARKET',
      status: 'PUBLISHED',
      featured: false,
      tags: [],
      media: [],
      authorName: 'Admin',
      publishedAt: new Date('2026-09-03T00:00:00Z'),
      createdAt: new Date('2026-09-03T00:00:00Z'),
    };
    const query = {
      sort: jest.fn(),
      skip: jest.fn(),
      limit: jest.fn(),
      lean: jest.fn(),
      exec: jest.fn(async () => [article]),
    };
    query.sort.mockReturnValue(query);
    query.skip.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    query.lean.mockReturnValue(query);
    const model = {
      find: jest.fn(() => query),
      countDocuments: jest.fn(() => ({ exec: async () => 1 })),
    };
    const service = new NewsService(model as never, {} as never);

    const response = await service.findPublished(1, 12);

    expect(response).toMatchObject({
      code: 1000,
      page: 1,
      size: 12,
      totalElements: 1,
      totalPages: 1,
      hasMore: false,
      result: [{ id: 'news-1', slug: 'tin-moi' }],
    });
  });

  it('sets the first publication timestamp and preserves it on later edits', async () => {
    const article = document({
      _id: 'news-1',
      ...publishedRequest,
      status: 'DRAFT',
      active: true,
      publishedAt: null,
      media: [],
      authorId: 'admin-1',
      authorName: 'Admin',
    });
    const model = {
      findOne: jest.fn(() => ({ exec: async () => article })),
      exists: jest.fn(async () => null),
    };
    const media = {
      resolveReadyOwnedAssets: jest.fn(async () => resolvedAssets),
    };
    const service = new NewsService(model as never, media as never);

    await service.update(
      { userId: 'admin-1', role: 'ADMIN', authorities: [] },
      'news-1',
      publishedRequest,
    );
    const firstPublishedAt = article.publishedAt;
    await service.update(
      { userId: 'admin-1', role: 'ADMIN', authorities: [] },
      'news-1',
      { ...publishedRequest, title: 'Tiêu đề mới' },
    );

    expect(firstPublishedAt).toBeInstanceOf(Date);
    expect(article.publishedAt).toBe(firstPublishedAt);
  });

  it('soft deletes an article', async () => {
    const article = document({ _id: 'news-1', active: true });
    const model = {
      findOne: jest.fn(() => ({ exec: async () => article })),
    };
    const service = new NewsService(model as never, {} as never);

    await service.delete('news-1');

    expect(article.active).toBe(false);
    expect(article.save).toHaveBeenCalledTimes(1);
  });
});
