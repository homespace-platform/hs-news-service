import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Kafka, logLevel, type Producer } from 'kafkajs';
import type { Model } from 'mongoose';
import {
  NEWS_ARTICLE_MODEL,
  type NewsArticle,
} from './persistence/news.schema';

@Injectable()
export class NewsPublicationPublisher implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(NewsPublicationPublisher.name);
  private readonly producer: Producer;
  private readonly topic: string;
  private timer?: ReturnType<typeof setInterval>;
  private drain?: Promise<void>;
  private connected = false;

  constructor(
    @InjectModel(NEWS_ARTICLE_MODEL)
    private readonly articles: Model<NewsArticle>,
    config: ConfigService,
  ) {
    this.topic = config.getOrThrow<string>('KAFKA_NEWS_TOPIC');
    this.producer = new Kafka({
      clientId: config.getOrThrow<string>('SERVICE_NAME'),
      brokers: config.getOrThrow<string>('KAFKA_BROKERS').split(',').map((broker) => broker.trim()),
      logLevel: logLevel.NOTHING,
    }).producer({ allowAutoTopicCreation: false });
  }

  onModuleInit(): void {
    this.timer = setInterval(() => void this.flush(), 5000);
    void this.flush();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.drain;
    if (this.connected) await this.producer.disconnect();
  }

  private flush(): Promise<void> {
    if (!this.drain) {
      this.drain = this.publishPending()
        .catch(() => {
          this.logger.warn('News publication delivery failed; retrying');
        })
        .finally(() => {
          this.drain = undefined;
        });
    }
    return this.drain;
  }

  private async publishPending(): Promise<void> {
    const articles = await this.articles.find({
      active: true,
      status: 'PUBLISHED',
      publicationEventId: { $type: 'string' },
      publicationSentAt: null,
    }).sort({ publishedAt: 1 }).limit(100).lean().exec();
    if (!articles.length) return;
    if (!this.connected) {
      await this.producer.connect();
      this.connected = true;
    }
    for (const article of articles) {
      await this.producer.send({
        topic: this.topic,
        messages: [{
          key: article._id,
          value: JSON.stringify({
            eventId: article.publicationEventId,
            eventType: 'NEWS_PUBLISHED',
            version: 1,
            occurredAt: article.publishedAt!.toISOString(),
            recipients: [],
            data: { newsId: article._id, slug: article.slug },
          }),
        }],
      });
      await this.articles.updateOne(
        { _id: article._id, publicationEventId: article.publicationEventId, publicationSentAt: null },
        { $set: { publicationSentAt: new Date() } },
      ).exec();
    }
  }
}
