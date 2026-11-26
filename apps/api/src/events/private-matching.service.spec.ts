import { ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { StudioAccessService } from '../auth/studio-access.service';
import type { AiService } from '../ai/ai.service';
import type { StorageService } from '../infrastructure/storage.service';
import type { ConfigService } from '@nestjs/config';
import { PrivateMatchingService } from './private-matching.service';

describe('PrivateMatchingService', () => {
  it('requires event owner or administrator access before processing a selfie', async () => {
    const access = { requireEventAccess: jest.fn().mockRejectedValue(new ForbiddenException()) };
    const ai = { embedSelfie: jest.fn() };
    const service = new PrivateMatchingService(
      {} as PrismaService,
      access as unknown as StudioAccessService,
      ai as unknown as AiService,
      {} as StorageService,
      {} as ConfigService,
    );
    await expect(
      service.search(
        'user-b',
        'event-a',
        {
          buffer: Buffer.from([0xff, 0xd8, 0xff]),
          mimetype: 'image/jpeg',
          originalname: 'selfie.jpg',
        },
        true,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ai.embedSelfie).not.toHaveBeenCalled();
  });

  it('queries only the authorized event and returns private previews without persisting a search', async () => {
    const access = { requireEventAccess: jest.fn().mockResolvedValue({ studioId: 'studio-a' }) };
    let capturedSql: Prisma.Sql | undefined;
    const query = jest.fn((sql: Prisma.Sql) => {
      capturedSql = sql;
      return Promise.resolve([
        {
          photoId: 'photo-a',
          similarity: 0.82,
          previewKey: 'events/a/preview.jpg',
          filename: 'photo.jpg',
        },
      ]);
    });
    const audit = jest.fn().mockResolvedValue({});
    const prisma = {
      event: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ id: 'event-a', settings: { similarityThreshold: 0.64 } }),
      },
      $queryRaw: query,
      auditLog: { create: audit },
      photoSearch: { create: jest.fn() },
    };
    const ai = {
      embedSelfie: jest.fn().mockResolvedValue({
        modelVersion: 'sface-v1',
        preprocessingVersion: 'sface-preprocess-v1',
        faces: [{ embedding: Array.from({ length: 512 }, () => 0.01) }],
      }),
    };
    const storage = { signedReadUrl: jest.fn().mockResolvedValue('https://storage.test/preview') };
    const service = new PrivateMatchingService(
      prisma as unknown as PrismaService,
      access as unknown as StudioAccessService,
      ai as unknown as AiService,
      storage as unknown as StorageService,
      { get: jest.fn().mockReturnValue(100) } as unknown as ConfigService,
    );
    const result = await service.search(
      'owner-a',
      'event-a',
      {
        buffer: Buffer.from([0xff, 0xd8, 0xff]),
        mimetype: 'image/jpeg',
        originalname: 'private.jpg',
      },
      true,
    );
    expect(capturedSql?.values).toContain('event-a');
    expect(capturedSql?.values).toContain('sface-v1');
    expect(result.results[0]).toMatchObject({
      photoId: 'photo-a',
      previewUrl: 'https://storage.test/preview',
    });
    expect(audit).toHaveBeenCalledTimes(1);
    expect(prisma.photoSearch.create).not.toHaveBeenCalled();
  });
});
