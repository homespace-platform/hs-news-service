import { S3Client } from '@aws-sdk/client-s3';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthenticationModule } from '../authentication/authentication.module';
import { MediaService } from './media.service';
import {
  NewsAsset,
  NewsAssetSchema,
} from './persistence/news-asset.schema';
import { MediaController } from './presentation/media.controller';

@Module({
  imports: [
    AuthenticationModule,
    MongooseModule.forFeature([
      { name: NewsAsset.name, schema: NewsAssetSchema },
    ]),
  ],
  controllers: [MediaController],
  providers: [
    MediaService,
    {
      provide: S3Client,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new S3Client({ region: config.getOrThrow<string>('AWS_REGION') }),
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
