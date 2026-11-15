import { jest } from '@jest/globals';
import { NewsPublicationPublisher } from './news-publication.publisher';

const article = {
  _id: '92d9e84c-d329-4817-a211-ced335365431',
  slug: 'tin-moi',
  status: 'PUBLISHED',
  active: true,
  publishedAt: new Date('2026-11-15T00:00:00.000Z'),
  publicationEventId: 'news_92d9e84c-d329-4817-a211-ced335365431',
  publicationSentAt: null,
};

function publisher(send: (value: unknown) => Promise<unknown>) {
  const query = {
    sort: jest.fn(),
    limit: jest.fn(),
    lean: jest.fn(),
    exec: jest.fn(async () => [article]),
  };
  query.sort.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.lean.mockReturnValue(query);
  const update = { exec: jest.fn(async () => ({})) };
  const model = {
    find: jest.fn(() => query),
    updateOne: jest.fn(() => update),
  };
  const config = { getOrThrow: (key: string) => ({
    KAFKA_NEWS_TOPIC: 'homespace.news.events.v1',
    SERVICE_NAME: 'hs-news-service',
    KAFKA_BROKERS: 'localhost:9092',
  })[key] };
  const instance = new NewsPublicationPublisher(model as never, config as never);
  Object.defineProperty(instance, 'producer', {
    value: { connect: jest.fn(async () => {}), send: jest.fn(send) },
  });
  return { instance, model };
}

describe('NewsPublicationPublisher', () => {
  it('publishes the first publication and marks it delivered after Kafka acknowledges', async () => {
    const send = jest.fn(async () => ({}));
    const { instance, model } = publisher(send);

    await (instance as unknown as { publishPending(): Promise<void> }).publishPending();

    expect(send).toHaveBeenCalledWith({
      topic: 'homespace.news.events.v1',
      messages: [{
        key: article._id,
        value: JSON.stringify({
          eventId: article.publicationEventId,
          eventType: 'NEWS_PUBLISHED',
          version: 1,
          occurredAt: article.publishedAt.toISOString(),
          recipients: [],
          data: { newsId: article._id, slug: article.slug },
        }),
      }],
    });
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: article._id, publicationEventId: article.publicationEventId, publicationSentAt: null },
      { $set: { publicationSentAt: expect.any(Date) } },
    );
  });

  it('leaves publication pending when Kafka fails', async () => {
    const { instance, model } = publisher(async () => { throw new Error('broker down'); });

    await expect((instance as unknown as { publishPending(): Promise<void> }).publishPending()).rejects.toThrow('broker down');

    expect(model.updateOne).not.toHaveBeenCalled();
  });
});
