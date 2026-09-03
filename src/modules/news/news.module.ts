import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthenticationModule } from '../authentication/authentication.module';
import { MediaModule } from '../media/media.module';
import { NewsService } from './news.service';
import {
  NEWS_ARTICLE_MODEL,
  NewsArticleSchema,
} from './persistence/news.schema';
import { NewsAdminController } from './presentation/news-admin.controller';
import { PublicNewsController } from './presentation/public-news.controller';

@Module({
  imports: [
    AuthenticationModule,
    MediaModule,
    MongooseModule.forFeature([
      { name: NEWS_ARTICLE_MODEL, schema: NewsArticleSchema },
    ]),
  ],
  controllers: [NewsAdminController, PublicNewsController],
  providers: [NewsService],
})
export class NewsModule {}
