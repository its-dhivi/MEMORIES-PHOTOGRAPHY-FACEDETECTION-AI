import { ConfigService } from '@nestjs/config';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  it('signs every browser upload header required by S3-compatible storage', async () => {
    const values: Record<string, string | number> = {
      S3_ENDPOINT: 'http://minio:9000',
      S3_PUBLIC_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY: 'test-access-key',
      S3_SECRET_KEY: 'test-secret-key',
      S3_BUCKET_ORIGINALS: 'photo-originals',
      S3_BUCKET_DERIVATIVES: 'photo-derivatives',
      PRESIGNED_URL_TTL_SECONDS: 900,
    };
    const config = {
      get: <T>(key: string, fallback?: T) => (values[key] as T | undefined) ?? fallback,
      getOrThrow: <T>(key: string) => {
        const value = values[key];
        if (value === undefined) throw new Error(`Missing ${key}`);
        return value as T;
      },
    } as ConfigService;
    const storage = new StorageService(config);

    const url = new URL(
      await storage.createUploadUrl({
        key: 'studios/studio/events/event/photo.jpg',
        mimeType: 'image/jpeg',
        sha256Hex: '00'.repeat(32),
        checksumBase64: Buffer.alloc(32).toString('base64'),
      }),
    );

    expect(url.searchParams.get('X-Amz-SignedHeaders')?.split(';')).toEqual([
      'content-type',
      'host',
      'x-amz-checksum-sha256',
      'x-amz-meta-sha256',
    ]);
    expect(url.searchParams.has('x-amz-checksum-sha256')).toBe(false);
    expect(url.searchParams.has('x-amz-meta-sha256')).toBe(false);

    const partUrl = new URL(
      await storage.createPartUploadUrl({
        key: 'studios/studio/events/event/photo.raw',
        uploadId: 'multipart-upload-id',
        partNumber: 7,
        checksumBase64: Buffer.alloc(32, 1).toString('base64'),
      }),
    );
    expect(partUrl.searchParams.get('partNumber')).toBe('7');
    expect(partUrl.searchParams.get('uploadId')).toBe('multipart-upload-id');
    expect(partUrl.searchParams.get('X-Amz-SignedHeaders')?.split(';')).toEqual([
      'host',
      'x-amz-checksum-sha256',
    ]);
    expect(partUrl.searchParams.has('x-amz-checksum-sha256')).toBe(false);
  });
});
