import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import type {
  NewsBlockType,
  NewsCategory,
  NewsContentBlock,
  NewsMediaSnapshot,
  NewsStatus,
} from '../../persistence/news.schema';

export class NewsContentBlockDto {
  @IsIn(['PARAGRAPH', 'HEADING', 'QUOTE', 'IMAGE'])
  type!: NewsBlockType;

  @IsOptional()
  @IsString()
  @MaxLength(20000)
  text?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  storageObjectId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  altText?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  caption?: string | null;
}

export class NewsUpsertDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(255)
  slug!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  summary!: string;

  @IsIn(['MARKET', 'LEGAL', 'GUIDE', 'INVESTMENT', 'TREND'])
  category!: NewsCategory;

  @IsIn(['DRAFT', 'PUBLISHED'])
  status!: NewsStatus;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(36)
  thumbnailStorageObjectId?: string | null;

  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => NewsContentBlockDto)
  contentBlocks!: NewsContentBlockDto[];
}

export class NewsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  size = 10;

  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED'])
  status?: NewsStatus;

  @IsOptional()
  @IsIn(['MARKET', 'LEGAL', 'GUIDE', 'INVESTMENT', 'TREND'])
  category?: NewsCategory;

  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsString()
  sort = 'createdAt,desc';
}

export class PublicNewsQueryDto extends NewsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  size = 12;
}

export interface NewsResponse {
  id: string;
  title: string;
  slug: string;
  summary: string;
  category: NewsCategory;
  status: NewsStatus;
  featured: boolean;
  views: number;
  tags: string[];
  contentBlocks: NewsContentBlock[];
  thumbnailUrl: string | null;
  media: NewsMediaSnapshot[];
  authorId: string;
  authorName: string;
  publishedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type NewsSummaryResponse = Omit<
  NewsResponse,
  'contentBlocks' | 'media' | 'authorId' | 'updatedAt'
>;
