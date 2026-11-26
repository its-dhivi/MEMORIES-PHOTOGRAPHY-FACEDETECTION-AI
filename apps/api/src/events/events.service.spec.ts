import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac } from 'node:crypto';
import type { PrismaService } from '../prisma/prisma.service';
import type { StudioAccessService } from '../auth/studio-access.service';
import type { StorageService } from '../infrastructure/storage.service';
import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { EventsService } from './events.service';

describe('EventsService', () => {
  it('scopes event listing to the supplied studio', async () => {
    const countMock = jest.fn();
    const findManyMock = jest.fn();
    const prisma = {
      $transaction: jest.fn().mockResolvedValue([0, []]),
      event: { count: countMock, findMany: findManyMock },
    } as unknown as PrismaService;
    const service = new EventsService(
      prisma,
      {} as StudioAccessService,
      {} as StorageService,
      {} as ConfigService,
      {} as Queue,
    );
    await service.list('studio-a', { page: 1, pageSize: 20, sort: 'desc' });
    expect(countMock).toHaveBeenCalledWith({
      where: { studioId: 'studio-a', deletedAt: null },
    });
  });

  it('maps a database slug collision to a conflict response', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: '6.19.3',
    });
    const prisma = {
      event: { create: jest.fn().mockRejectedValue(error) },
    } as unknown as PrismaService;
    const service = new EventsService(
      prisma,
      {} as StudioAccessService,
      {} as StorageService,
      {} as ConfigService,
      {} as Queue,
    );
    await expect(
      service.create('user', 'studio', {
        title: 'Wedding',
        type: 'WEDDING',
        eventDate: '2026-11-20T12:00:00.000Z',
        publicSlug: 'wedding',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not approve a threshold with poor false-match evidence', async () => {
    const transaction = jest.fn();
    const prisma = {
      eventSettings: { findUnique: jest.fn().mockResolvedValue({ similarityThreshold: 0.64 }) },
      $transaction: transaction,
    } as unknown as PrismaService;
    const access = {
      requireEventAccess: jest.fn().mockResolvedValue({ studioId: 'studio' }),
    } as unknown as StudioAccessService;
    const config = {
      getOrThrow: jest.fn().mockReturnValue('auraface-v1'),
      get: jest.fn().mockReturnValue('auraface-rgb-112-v1'),
    } as unknown as ConfigService;
    const service = new EventsService(prisma, access, {} as StorageService, config, {} as Queue);
    await expect(
      service.approveMatching('owner', 'event', {
        threshold: 0.64,
        modelVersion: 'auraface-v1',
        preprocessingVersion: 'auraface-rgb-112-v1',
        source: 'consented-wedding-evaluation',
        evaluationResults: {
          true_positive: 38,
          false_positive: 136,
          true_negative: 10889,
          false_negative: 112,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).toHaveBeenCalledTimes(0);
  });

  it('rejects direct production approval without a trusted artifact signature', async () => {
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const transaction = jest.fn();
      const prisma = {
        eventSettings: { findUnique: jest.fn().mockResolvedValue({ similarityThreshold: 0.64 }) },
        $transaction: transaction,
      } as unknown as PrismaService;
      const access = {
        requireEventAccess: jest.fn().mockResolvedValue({ studioId: 'studio' }),
      } as unknown as StudioAccessService;
      const config = {
        getOrThrow: jest.fn((key: string) =>
          key === 'FACE_MODEL_VERSION' ? 'auraface-v1' : 'e'.repeat(64),
        ),
        get: jest.fn().mockReturnValue('auraface-rgb-112-v1'),
      } as unknown as ConfigService;
      const service = new EventsService(prisma, access, {} as StorageService, config, {} as Queue);
      await expect(
        service.approveMatching('owner', 'event', {
          threshold: 0.64,
          modelVersion: 'auraface-v1',
          preprocessingVersion: 'auraface-rgb-112-v1',
          source: 'representative-consented-events',
          evaluationResults: {
            events: 3,
            queries: 1000,
            photo_recall: 0.7,
            photo_precision_95pct_wilson_lower: 0.995,
            false_accept_rate_95pct_wilson: [0, 0],
          },
        }),
      ).rejects.toThrow('trusted signed evaluation artifact');
      expect(transaction).not.toHaveBeenCalled();
    } finally {
      if (previousEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnvironment;
    }
  });

  it('accepts only signed production gallery evidence that meets the enforced criteria', async () => {
    const previousEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const secret = 'e'.repeat(64);
      const evaluationResults = {
        events: 3,
        queries: 1000,
        photo_recall: 0.7,
        photo_precision_95pct_wilson_lower: 0.995,
        false_accept_rate_95pct_wilson: [0, 0],
      };
      const payload = {
        eventId: 'event',
        threshold: 0.64,
        modelVersion: 'auraface-v1',
        preprocessingVersion: 'auraface-rgb-112-v1',
        source: 'representative-consented-events',
        evaluationResults,
      };
      const canonicalize = (value: unknown): string => {
        if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
        if (value && typeof value === 'object') {
          const record = value as Record<string, unknown>;
          return `{${Object.keys(record)
            .sort()
            .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
            .join(',')}}`;
        }
        return JSON.stringify(value) ?? 'null';
      };
      const evidenceSignature = createHmac('sha256', secret)
        .update(canonicalize(payload))
        .digest('hex');
      const transaction = jest.fn().mockResolvedValue([]);
      const settings = {
        similarityThreshold: 0.64,
        accessPinHash: null,
        accessEnabled: false,
        downloadsEnabled: false,
        downloadAllEnabled: false,
        retentionDays: 90,
      };
      const prisma = {
        eventSettings: { findUnique: jest.fn().mockResolvedValue(settings), update: jest.fn() },
        photoSearch: { updateMany: jest.fn() },
        guestDownloadJob: { updateMany: jest.fn() },
        auditLog: { create: jest.fn() },
        $transaction: transaction,
      } as unknown as PrismaService;
      const access = {
        requireEventAccess: jest.fn().mockResolvedValue({ studioId: 'studio' }),
      } as unknown as StudioAccessService;
      const config = {
        getOrThrow: jest.fn((key: string) =>
          key === 'FACE_MODEL_VERSION' ? 'auraface-v1' : secret,
        ),
        get: jest.fn().mockReturnValue('auraface-rgb-112-v1'),
      } as unknown as ConfigService;
      const service = new EventsService(prisma, access, {} as StorageService, config, {} as Queue);

      await expect(
        service.approveMatching('owner', 'event', {
          ...payload,
          evidenceSignature,
        }),
      ).resolves.toMatchObject({ similarityThreshold: 0.64 });
      expect(transaction).toHaveBeenCalledTimes(1);
    } finally {
      if (previousEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousEnvironment;
    }
  });
});
