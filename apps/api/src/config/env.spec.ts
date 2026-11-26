import { validateEnvironment } from './env';

const valid = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/database',
  WEB_ORIGIN: 'http://localhost:3000',
  REDIS_URL: 'redis://localhost:6379',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_PUBLIC_ENDPOINT: 'http://localhost:9000',
  PUBLIC_APP_URL: 'http://localhost:3000',
  S3_REGION: 'us-east-1',
  S3_ACCESS_KEY: 'access-key',
  S3_SECRET_KEY: 'secret-key',
  S3_BUCKET_ORIGINALS: 'originals',
  S3_BUCKET_DERIVATIVES: 'derivatives',
  AI_SERVICE_URL: 'http://localhost:8000',
  AI_INTERNAL_TOKEN: 'a'.repeat(32),
  JWT_ACCESS_SECRET: 'b'.repeat(32),
  JWT_REFRESH_SECRET: 'c'.repeat(32),
  COOKIE_SECRET: 'd'.repeat(32),
  PASSWORD_RESET_PEPPER: 'e'.repeat(32),
};
describe('environment validation', () => {
  it('accepts a complete environment', () =>
    expect(validateEnvironment(valid)).toMatchObject(valid));
  it('rejects short secrets', () =>
    expect(() => validateEnvironment({ ...valid, JWT_ACCESS_SECRET: 'short' })).toThrow(
      'Environment validation failed',
    ));
});
