import 'reflect-metadata';
import { validateEnvironment } from './environment.validation';

const requiredConfig = {
  MONGODB_URI: 'mongodb://database.example/homespace_news',
  AWS_REGION: 'ap-southeast-1',
  AWS_S3_BUCKET: 'homespace-news',
  KAFKA_BROKERS: 'localhost:9092',
};

describe('validateEnvironment', () => {
  it('fails fast when MONGODB_URI is missing', () => {
    expect(() => validateEnvironment({})).toThrow(
      'Invalid environment configuration',
    );
  });

  it('converts the dotenv port value to a number', () => {
    const config = validateEnvironment({
      ...requiredConfig,
      PORT: '8083',
      KAFKA_NEWS_TOPIC: 'custom.news.events.v1',
      AWS_S3_UPLOAD_URL_DURATION_SECONDS: '900',
    });

    expect(config.PORT).toBe(8083);
    expect(config.KAFKA_NEWS_TOPIC).toBe('custom.news.events.v1');
    expect(config.AWS_S3_UPLOAD_URL_DURATION_SECONDS).toBe(900);
  });

  it('defaults to the news source topic without reusing the notification topic', () => {
    const config = validateEnvironment({
      ...requiredConfig,
      KAFKA_EVENTS_TOPIC: 'homespace.notification.events.v1',
    });

    expect(config.KAFKA_NEWS_TOPIC).toBe('homespace.news.events.v1');
  });

  it.each(['', ' ', '.', '..', 'invalid/topic', 'a'.repeat(250)])(
    'rejects an invalid news topic %p',
    (topic) => {
      expect(() => validateEnvironment({
        ...requiredConfig,
        KAFKA_NEWS_TOPIC: topic,
      })).toThrow('KAFKA_NEWS_TOPIC');
    },
  );
});
