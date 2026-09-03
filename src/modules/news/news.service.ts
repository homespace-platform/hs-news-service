import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { ErrorCode } from '../../common/constants/error-code.constant';
import { PageResponseDto } from '../../common/dto/page-response.dto';
import { AppException } from '../../common/exceptions/app.exception';
import type { UserContext } from '../authentication/domain/user-context';
import { MediaService } from '../media/media.service';
import type { NewsAssetResponse } from '../media/presentation/dto/media.dto';
import {
  NEWS_ARTICLE_MODEL,
  type NewsArticle,
  type NewsArticleDocument,
  type NewsCategory,
  type NewsContentBlock,
  type NewsMediaSnapshot,
  type NewsStatus,
} from './persistence/news.schema';
import type {
  NewsResponse,
  NewsSummaryResponse,
  NewsUpsertDto,
} from './presentation/dto/news.dto';

const ADMIN_SORT_FIELDS = new Set(['createdAt', 'publishedAt', 'title']);
type NewsFilter = Record<string, unknown>;

@Injectable()
export class NewsService {
  constructor(
    @InjectModel(NEWS_ARTICLE_MODEL)
    private readonly articles: Model<NewsArticle>,
    private readonly media: MediaService,
  ) {}

  async create(user: UserContext, request: NewsUpsertDto): Promise<NewsResponse> {
    const slug = request.slug.trim().toLowerCase();
    await this.requireAvailableSlug(slug);
    this.validateContent(request);
    const { contentBlocks, media } = await this.resolveContent(
      user.userId,
      request,
    );

    try {
      const article = await this.articles.create({
        _id: randomUUID(),
        title: request.title.trim(),
        slug,
        summary: request.summary.trim(),
        category: request.category,
        status: request.status,
        featured: request.featured === true,
        tags: this.normalizeTags(request.tags),
        contentBlocks,
        media,
        authorId: user.userId,
        authorName: user.name?.trim() || user.email?.trim() || 'Admin',
        publishedAt: request.status === 'PUBLISHED' ? new Date() : null,
        active: true,
      });
      return this.toResponse(article);
    } catch (error) {
      if (this.isDuplicateKey(error)) {
        throw new AppException(ErrorCode.NEWS_SLUG_EXISTS);
      }
      throw error;
    }
  }

  async getPublishedBySlug(slug: string): Promise<NewsResponse> {
    const article = await this.articles
      .findOne({
        slug: slug.trim().toLowerCase(),
        status: 'PUBLISHED',
        active: true,
      })
      .exec();
    return this.toResponse(this.requireArticle(article));
  }

  async recordView(slug: string): Promise<{ views: number }> {
    const article = await this.articles
      .findOneAndUpdate(
        {
          slug: slug.trim().toLowerCase(),
          status: 'PUBLISHED',
          active: true,
        },
        { $inc: { views: 1 } },
        { new: true },
      )
      .exec();
    return { views: this.requireArticle(article).views ?? 0 };
  }

  async getAdmin(newsId: string): Promise<NewsResponse> {
    const article = await this.articles
      .findOne({ _id: newsId, active: true })
      .exec();
    return this.toResponse(this.requireArticle(article));
  }

  async findPublished(
    page = 1,
    size = 12,
    category?: NewsCategory,
    keyword?: string,
  ): Promise<PageResponseDto<NewsSummaryResponse>> {
    const filter: NewsFilter = {
      active: true,
      status: 'PUBLISHED',
      ...(category ? { category } : {}),
      ...this.keywordFilter(keyword),
    };
    return this.findPage(
      filter,
      Math.max(page, 1),
      Math.min(Math.max(size, 1), 50),
      { featured: -1, publishedAt: -1 },
    );
  }

  async findAdmin(
    page = 1,
    size = 10,
    status?: NewsStatus,
    category?: NewsCategory,
    keyword?: string,
    sort = 'createdAt,desc',
  ): Promise<PageResponseDto<NewsSummaryResponse>> {
    const filter: NewsFilter = {
      active: true,
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...this.keywordFilter(keyword),
    };
    const [requestedField, requestedDirection] = sort.split(',', 2);
    const field = ADMIN_SORT_FIELDS.has(requestedField)
      ? requestedField
      : 'createdAt';
    return this.findPage(
      filter,
      Math.max(page, 1),
      Math.min(Math.max(size, 1), 100),
      { [field]: requestedDirection?.toLowerCase() === 'asc' ? 1 : -1 },
    );
  }

  async update(
    user: UserContext,
    newsId: string,
    request: NewsUpsertDto,
  ): Promise<NewsResponse> {
    const article = this.requireArticle(
      await this.articles.findOne({ _id: newsId, active: true }).exec(),
    );
    const slug = request.slug.trim().toLowerCase();
    await this.requireAvailableSlug(slug, newsId);
    this.validateContent(request);
    const resolved = await this.resolveContent(user.userId, request);

    article.title = request.title.trim();
    article.slug = slug;
    article.summary = request.summary.trim();
    article.category = request.category;
    article.status = request.status;
    article.featured = request.featured === true;
    article.tags = this.normalizeTags(request.tags);
    article.contentBlocks = resolved.contentBlocks;
    article.media = resolved.media;
    article.publishedAt =
      request.status === 'PUBLISHED'
        ? article.publishedAt ?? new Date()
        : null;
    try {
      return this.toResponse(await article.save());
    } catch (error) {
      if (this.isDuplicateKey(error)) {
        throw new AppException(ErrorCode.NEWS_SLUG_EXISTS);
      }
      throw error;
    }
  }

  async delete(newsId: string): Promise<void> {
    const article = this.requireArticle(
      await this.articles.findOne({ _id: newsId, active: true }).exec(),
    );
    article.active = false;
    // ponytail: uploaded assets are retained; add an orphan cleanup job when storage cost matters.
    await article.save();
  }

  private async findPage(
    filter: NewsFilter,
    page: number,
    size: number,
    sort: Record<string, 1 | -1>,
  ): Promise<PageResponseDto<NewsSummaryResponse>> {
    const [articles, total] = await Promise.all([
      this.articles
        .find(filter)
        .sort(sort)
        .skip((page - 1) * size)
        .limit(size)
        .lean()
        .exec(),
      this.articles.countDocuments(filter).exec(),
    ]);
    return new PageResponseDto(
      articles.map((article) => this.toSummary(article)),
      page,
      size,
      total,
    );
  }

  private async requireAvailableSlug(slug: string, newsId?: string) {
    const match = await this.articles.exists({
      slug,
      active: true,
      ...(newsId ? { _id: { $ne: newsId } } : {}),
    });
    if (match) throw new AppException(ErrorCode.NEWS_SLUG_EXISTS);
  }

  private validateContent(request: NewsUpsertDto): void {
    if (!Array.isArray(request.contentBlocks)) {
      throw new AppException(ErrorCode.NEWS_INVALID_CONTENT);
    }
    for (const block of request.contentBlocks) {
      if (block.type === 'IMAGE' && !block.storageObjectId?.trim()) {
        throw new AppException(ErrorCode.NEWS_INVALID_MEDIA);
      }
    }
    if (request.status !== 'PUBLISHED') return;
    const hasContent = request.contentBlocks.some((block) =>
      block.type === 'IMAGE'
        ? Boolean(block.storageObjectId?.trim())
        : Boolean(block.text?.trim()),
    );
    if (!request.thumbnailStorageObjectId?.trim() || !hasContent) {
      throw new AppException(ErrorCode.NEWS_INVALID_CONTENT);
    }
  }

  private async resolveContent(ownerId: string, request: NewsUpsertDto) {
    const thumbnailId = request.thumbnailStorageObjectId?.trim() || null;
    const imageBlocks = request.contentBlocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => block.type === 'IMAGE');
    const ids = [
      ...(thumbnailId ? [thumbnailId] : []),
      ...imageBlocks.map(({ block }) => block.storageObjectId!.trim()),
    ];
    const assets = await this.media.resolveReadyOwnedAssets(ownerId, ids);
    const byId = new Map(assets.map((asset) => [asset.id, asset]));
    const media: NewsMediaSnapshot[] = [];
    if (thumbnailId) {
      media.push(this.mediaSnapshot(byId.get(thumbnailId)!, 'THUMBNAIL', 0));
    }
    for (const { block, index } of imageBlocks) {
      const id = block.storageObjectId!.trim();
      media.push(
        this.mediaSnapshot(
          byId.get(id)!,
          'CONTENT',
          index,
          this.normalize(block.altText),
          this.normalize(block.caption),
        ),
      );
    }
    return {
      contentBlocks: request.contentBlocks.map<NewsContentBlock>((block) => ({
        type: block.type,
        text: this.normalize(block.text),
        storageObjectId: this.normalize(block.storageObjectId),
        altText: this.normalize(block.altText),
        caption: this.normalize(block.caption),
      })),
      media,
    };
  }

  private mediaSnapshot(
    asset: NewsAssetResponse,
    role: 'THUMBNAIL' | 'CONTENT',
    sortOrder: number,
    altText: string | null = null,
    caption: string | null = null,
  ): NewsMediaSnapshot {
    return {
      id: randomUUID(),
      storageObjectId: asset.id,
      role,
      sortOrder,
      altText,
      caption,
      url: asset.url,
    };
  }

  private keywordFilter(keyword?: string): NewsFilter {
    if (!keyword?.trim()) return {};
    const value = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(value, 'i');
    return { $or: [{ title: expression }, { summary: expression }] };
  }

  private normalizeTags(tags?: string[]): string[] {
    return [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
  }

  private normalize(value?: string | null): string | null {
    return value?.trim() || null;
  }

  private requireArticle(
    article: NewsArticleDocument | NewsArticle | null,
  ): NewsArticleDocument {
    if (!article) throw new AppException(ErrorCode.NEWS_NOT_FOUND);
    return article as NewsArticleDocument;
  }

  private toResponse(article: NewsArticle): NewsResponse {
    return {
      id: article._id,
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      category: article.category,
      status: article.status,
      featured: article.featured,
      views: article.views ?? 0,
      tags: article.tags,
      contentBlocks: article.contentBlocks,
      thumbnailUrl:
        article.media.find((item) => item.role === 'THUMBNAIL')?.url ?? null,
      media: article.media,
      authorId: article.authorId,
      authorName: article.authorName,
      publishedAt: article.publishedAt,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    };
  }

  private toSummary(article: NewsArticle): NewsSummaryResponse {
    const response = this.toResponse(article);
    return {
      id: response.id,
      title: response.title,
      slug: response.slug,
      summary: response.summary,
      category: response.category,
      status: response.status,
      featured: response.featured,
      views: response.views,
      tags: response.tags,
      thumbnailUrl: response.thumbnailUrl,
      authorName: response.authorName,
      publishedAt: response.publishedAt,
      createdAt: response.createdAt,
    };
  }

  private isDuplicateKey(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
  }
}
