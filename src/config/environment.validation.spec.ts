import 'reflect-metadata';
import { validateEnvironment } from './environment.validation';

describe('validateEnvironment', () => {
  it('fails fast when MONGODB_URI is missing', () => {
    expect(() => validateEnvironment({})).toThrow(
      'Invalid environment configuration',
    );
  });

  it('converts the dotenv port value to a number', () => {
    const config = validateEnvironment({
      PORT: '8083',
      MONGODB_URI: 'mongodb://database.example/homespace_news',
      AWS_REGION: 'ap-southeast-1',
      AWS_S3_BUCKET: 'homespace-news',
      AWS_S3_UPLOAD_URL_DURATION_SECONDS: '900',
    });

    expect(config.PORT).toBe(8083);
    expect(config.AWS_S3_UPLOAD_URL_DURATION_SECONDS).toBe(900);
  });
});
