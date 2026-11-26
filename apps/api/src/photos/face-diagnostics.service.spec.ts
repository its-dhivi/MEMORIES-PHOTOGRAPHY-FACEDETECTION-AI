import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AiService } from '../ai/ai.service';
import type { StudioAccessService } from '../auth/studio-access.service';
import type { StorageService } from '../infrastructure/storage.service';
import type { PrismaService } from '../prisma/prisma.service';
import { FaceDiagnosticsService } from './face-diagnostics.service';

describe('FaceDiagnosticsService', () => {
  it('denies diagnostics before reading a photograph from another event', async () => {
    const findFirst = jest.fn();
    const prisma = { photo: { findFirst } } as unknown as PrismaService;
    const access = {
      requireEventAccess: jest.fn().mockRejectedValue(new ForbiddenException()),
    } as unknown as StudioAccessService;
    const service = new FaceDiagnosticsService(
      prisma,
      access,
      {} as StorageService,
      {} as AiService,
      {} as ConfigService,
    );
    await expect(service.inspect('user', 'other-event', 'photo')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(findFirst).toHaveBeenCalledTimes(0);
  });

  it('rejects a low-score probe even when an embedding exists', async () => {
    const prisma = {
      photo: {
        findFirst: jest.fn().mockResolvedValue({
          status: 'READY',
          event: {
            settings: {
              similarityThreshold: 0.64,
            },
          },
        }),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ similarity: 0.5 }]),
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    const access = {
      requireEventAccess: jest.fn().mockResolvedValue({ studioId: 'studio' }),
    } as unknown as StudioAccessService;
    const ai = {
      embedSelfie: jest.fn().mockResolvedValue({
        modelVersion: 'auraface-v1',
        preprocessingVersion: 'auraface-rgb-112-v1',
        faces: [{ embedding: Array(512).fill(0.1) }],
      }),
    } as unknown as AiService;
    const config = { get: jest.fn().mockReturnValue(1000) } as unknown as ConfigService;
    const service = new FaceDiagnosticsService(prisma, access, {} as StorageService, ai, config);
    const result = await service.probe('user', 'event', 'photo', {
      buffer: Buffer.from('selfie'),
      mimetype: 'image/jpeg',
      originalname: 'test.jpg',
    });
    expect(result).toMatchObject({ accepted: false, reason: 'SIMILARITY_REJECTION' });
  });

  it('reports retrieval filtering when the expected photo falls beyond the candidate cap', async () => {
    const prisma = {
      photo: {
        findFirst: jest.fn().mockResolvedValue({
          status: 'READY',
          event: {
            settings: {
              similarityThreshold: 0.64,
            },
          },
        }),
      },
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ similarity: 0.8 }])
        .mockResolvedValueOnce([{ preceding: 1000n }]),
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    } as unknown as PrismaService;
    const access = {
      requireEventAccess: jest.fn().mockResolvedValue({ studioId: 'studio' }),
    } as unknown as StudioAccessService;
    const ai = {
      embedSelfie: jest.fn().mockResolvedValue({
        modelVersion: 'auraface-v1',
        preprocessingVersion: 'auraface-rgb-112-v1',
        faces: [{ embedding: Array(512).fill(0.1) }],
      }),
    } as unknown as AiService;
    const config = { get: jest.fn().mockReturnValue(100) } as unknown as ConfigService;
    const service = new FaceDiagnosticsService(prisma, access, {} as StorageService, ai, config);
    const result = await service.probe('user', 'event', 'photo', {
      buffer: Buffer.from('selfie'),
      mimetype: 'image/jpeg',
      originalname: 'test.jpg',
    });
    expect(result).toMatchObject({
      accepted: false,
      reason: 'CANDIDATE_LIMIT',
      candidateRank: 1001,
    });
  });
});
