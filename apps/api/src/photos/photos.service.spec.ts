import { PayloadTooLargeException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { StudioAccessService } from '../auth/studio-access.service';
import type { StorageService } from '../infrastructure/storage.service';
import type { PrismaService } from '../prisma/prisma.service';
import { PhotosService } from './photos.service';

describe('PhotosService upload authorization', () => {
  const queue = {} as Queue;
  it('checks event authorization before creating an upload session', async () => {
    const access = {
      requireEventAccess: jest.fn().mockRejectedValue(new Error('denied')),
    } as unknown as StudioAccessService;
    const service = new PhotosService(
      {} as PrismaService,
      access,
      {} as StorageService,
      { get: jest.fn() } as unknown as ConfigService,
      queue,
      queue,
      queue,
    );
    await expect(
      service.initialize('user-b', 'event-a', {
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        byteSize: 1000,
        sha256: 'a'.repeat(64),
        idempotencyKey: 'request-123',
      }),
    ).rejects.toThrow('denied');
  });

  it('rejects files above the configured size limit', async () => {
    const access = {
      requireEventAccess: jest.fn().mockResolvedValue({ studioId: 'studio-a' }),
    } as unknown as StudioAccessService;
    const config = { get: jest.fn().mockReturnValue(100) } as unknown as ConfigService;
    const service = new PhotosService(
      {} as PrismaService,
      access,
      {} as StorageService,
      config,
      queue,
      queue,
      queue,
    );
    await expect(
      service.initialize('user-a', 'event-a', {
        filename: 'large.jpg',
        mimeType: 'image/jpeg',
        byteSize: 101,
        sha256: 'b'.repeat(64),
        idempotencyKey: 'request-456',
      }),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });
});
