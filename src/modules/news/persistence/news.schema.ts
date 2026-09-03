import { randomUUID } from 'node:crypto';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';
import type { HydratedDocument } from 'mongoose';

export const NEWS_ARTICLE_MODEL = 'NewsArticle';
export type NewsCategory = 'MARKET' | 'LEGAL' | 'GUIDE' | 'INVESTMENT' | 'TREND';
export type NewsStatus = 'DRAFT' | 'PUBLISHED';
export type NewsBlockType = 'PARAGRAPH' | 'HEADING' | 'QUOTE' | 'IMAGE';
export type NewsMediaRole = 'THUMBNAIL' | 'CONTENT';

export interface NewsContentBlock {
  type: NewsBlockType;
  text: string | null;
  storageObjectId: string | null;
  altText: string | null;
  caption: string | null;
}

export interface NewsMediaSnapshot {
  id: string;
  storageObjectId: string;
  role: NewsMediaRole;
  sortOrder: number;
  altText: string | null;
  caption: string | null;
  url: string;
}

const contentBlockSchema = new MongooseSchema<NewsContentBlock>(
  {
    type: {
      type: String,
      enum: ['PARAGRAPH', 'HEADING', 'QUOTE', 'IMAGE'],
      required: true,
    },
    text: { type: String, default: null },
    storageObjectId: { type: String, default: null },
    altText: { type: String, default: null },
    caption: { type: String, default: null },
  },
  { _id: false },
);

const mediaSchema = new MongooseSchema<NewsMediaSnapshot>(
  {
    id: { type: String, required: true },
    storageObjectId: { type: String, required: true },
    role: { type: String, enum: ['THUMBNAIL', 'CONTENT'], required: true },
    sortOrder: { type: Number, required: true },
    altText: { type: String, default: null },
    caption: { type: String, default: null },
    url: { type: String, required: true },
  },
  { _id: false },
);

@Schema({ collection: 'news_articles', timestamps: true, versionKey: false })
export class NewsArticle {
  @Prop({ type: String, default: randomUUID })
  _id!: string;

  @Prop({ required: true, maxlength: 255 })
  title!: string;

  @Prop({ required: true, maxlength: 255 })
  slug!: string;

  @Prop({ required: true, maxlength: 1000 })
  summary!: string;

  @Prop({
    required: true,
    enum: ['MARKET', 'LEGAL', 'GUIDE', 'INVESTMENT', 'TREND'],
  })
  category!: NewsCategory;

  @Prop({ required: true, enum: ['DRAFT', 'PUBLISHED'] })
  status!: NewsStatus;

  @Prop({ default: false })
  featured!: boolean;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: [contentBlockSchema], default: [] })
  contentBlocks!: NewsContentBlock[];

  @Prop({ type: [mediaSchema], default: [] })
  media!: NewsMediaSnapshot[];

  @Prop({ required: true })
  authorId!: string;

  @Prop({ required: true })
  authorName!: string;

  @Prop({ type: Date, default: null })
  publishedAt!: Date | null;

  @Prop({ default: true })
  active!: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export type NewsArticleDocument = HydratedDocument<NewsArticle>;

export const NewsArticleSchema = SchemaFactory.createForClass(NewsArticle);

NewsArticleSchema.index({ slug: 1 }, { unique: true });
NewsArticleSchema.index({ active: 1, status: 1, publishedAt: -1 });
NewsArticleSchema.index({ active: 1, category: 1 });
