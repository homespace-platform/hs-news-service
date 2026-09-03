export const ErrorCode = {
  UNCATEGORIZED_EXCEPTION: {
    code: 9999,
    message: 'Uncategorized error',
    statusCode: 500,
  },
  UNAUTHENTICATED: {
    code: 1002,
    message: 'Unauthenticated',
    statusCode: 401,
  },
  UNAUTHORIZED: {
    code: 1003,
    message: 'You do not have permission',
    statusCode: 403,
  },
  ROUTE_NOT_FOUND: {
    code: 1012,
    message: 'Route not found',
    statusCode: 404,
  },
  NEWS_NOT_FOUND: {
    code: 5001,
    message: 'News article not found',
    statusCode: 404,
  },
  NEWS_SLUG_EXISTS: {
    code: 5002,
    message: 'News slug already exists',
    statusCode: 409,
  },
  NEWS_INVALID_CONTENT: {
    code: 5003,
    message: 'News content is invalid',
    statusCode: 400,
  },
  NEWS_INVALID_MEDIA: {
    code: 5004,
    message: 'News image is invalid',
    statusCode: 400,
  },
  NEWS_MEDIA_FORBIDDEN: {
    code: 5005,
    message: 'News image belongs to another user',
    statusCode: 403,
  },
  NEWS_STORAGE_PROVIDER_ERROR: {
    code: 5006,
    message: 'News storage provider is unavailable',
    statusCode: 503,
  },
} as const;

export type ErrorDefinition = (typeof ErrorCode)[keyof typeof ErrorCode];
