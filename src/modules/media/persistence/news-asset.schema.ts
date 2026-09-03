import { randomUUID } from 'node:crypto';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type NewsAssetStatus = 'PENDING' | 'READY' | 'REJECTED';

@Schema({ collection: 'news_assets', timestamps: true, versionKey: false })
export class NewsAsset {
  @Prop({ type: String, default: randomUUID })
  _id!: string;

  @Prop({ required: true })
  originalName!: string;

  @Prop({ required: true, unique: true })
  objectKey!: string;

  @Prop({ required: true })
  bucketName!: string;

  @Prop({ required: true })
  contentType!: string;

  @Prop({ required: true })
  sizeBytes!: number;

  @Prop()
  checksum?: string;

  @Prop({ required: true })
  ownerId!: string;

  @Prop({ required: true, enum: ['PENDING', 'READY', 'REJECTED'] })
  status!: NewsAssetStatus;

  createdAt?: Date;
  updatedAt?: Date;
}

export type NewsAssetDocument = HydratedDocument<NewsAsset>;
export const NewsAssetSchema = SchemaFactory.createForClass(NewsAsset);
