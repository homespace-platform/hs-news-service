import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiResponseDto } from '../../../common/dto/api-response.dto';
import type { PageResponseDto } from '../../../common/dto/page-response.dto';
import type { UserContext } from '../../authentication/domain/user-context';
import { CurrentUser } from '../../authentication/presentation/decorators/current-user.decorator';
import { AdminGuard } from '../../authentication/presentation/guards/admin.guard';
import { GatewayAuthenticationGuard } from '../../authentication/presentation/guards/gateway-authentication.guard';
import { NewsService } from '../news.service';
import {
  NewsQueryDto,
  type NewsResponse,
  type NewsSummaryResponse,
  NewsUpsertDto,
} from './dto/news.dto';

@Controller('admin/news')
@UseGuards(GatewayAuthenticationGuard, AdminGuard)
export class NewsAdminController {
  constructor(private readonly news: NewsService) {}

  @Post()
  async create(
    @CurrentUser() user: UserContext,
    @Body() request: NewsUpsertDto,
  ): Promise<ApiResponseDto<NewsResponse>> {
    return new ApiResponseDto({
      message: 'News article created',
      result: await this.news.create(user, request),
    });
  }

  @Get()
  findAll(@Query() query: NewsQueryDto): Promise<PageResponseDto<NewsSummaryResponse>> {
    return this.news.findAdmin(
      query.page,
      query.size,
      query.status,
      query.category,
      query.keyword,
      query.sort,
    );
  }

  @Get(':newsId')
  async getById(@Param('newsId') newsId: string): Promise<ApiResponseDto<NewsResponse>> {
    return new ApiResponseDto({ result: await this.news.getAdmin(newsId) });
  }

  @Put(':newsId')
  async update(
    @CurrentUser() user: UserContext,
    @Param('newsId') newsId: string,
    @Body() request: NewsUpsertDto,
  ): Promise<ApiResponseDto<NewsResponse>> {
    return new ApiResponseDto({
      message: 'News article updated',
      result: await this.news.update(user, newsId, request),
    });
  }

  @Delete(':newsId')
  @HttpCode(200)
  async delete(@Param('newsId') newsId: string): Promise<ApiResponseDto<void>> {
    await this.news.delete(newsId);
    return new ApiResponseDto({ message: 'News article deleted' });
  }
}
