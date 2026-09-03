import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import type { PageResponseDto } from '../../../common/dto/page-response.dto';
import { NewsService } from '../news.service';
import {
  PublicNewsQueryDto,
  type NewsResponse,
  type NewsSummaryResponse,
} from './dto/news.dto';

@Controller('public/news')
export class PublicNewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  findPublished(
    @Query() query: PublicNewsQueryDto,
  ): Promise<PageResponseDto<NewsSummaryResponse>> {
    return this.news.findPublished(
      query.page,
      Math.min(query.size, 50),
      query.category,
      query.keyword,
    );
  }

  @Get(':slug')
  async getBySlug(@Param('slug') slug: string): Promise<ApiResponseDto<NewsResponse>> {
    return new ApiResponseDto({
      result: await this.news.getPublishedBySlug(slug),
    });
  }

  @Post(':slug/view')
  async recordView(@Param('slug') slug: string): Promise<ApiResponseDto<{ views: number }>> {
    return new ApiResponseDto({ result: await this.news.recordView(slug) });
  }
}
