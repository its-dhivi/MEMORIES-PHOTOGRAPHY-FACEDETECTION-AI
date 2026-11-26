import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AiService } from '../ai/ai.service';
import type { StorageService } from '../infrastructure/storage.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { Queue } from 'bullmq';
import { GuestSearchService } from './guest-search.service';

const activeSession = {
  id: 'session-a',
  eventId: 'event-a',
  status: 'ACTIVE',
  expiresAt: new Date(Date.now() + 60_000),
  event: {
    id: 'event-a',
    publicSlug: 'event-a',
    status: 'ACTIVE',
    deletedAt: null,
    settings: {
      accessEnabled: true,
      accessExpiresAt: null,
      consentVersion: '1.0',
      similarityThreshold: 0.7,
      searchResultTtlMinutes: 60,
    },
  },
  consents: [],
};

function createService(prisma: object): GuestSearchService {
  const config = { getOrThrow: jest.fn().mockReturnValue('s'.repeat(32)) };
  return new GuestSearchService(
    prisma as PrismaService,
    {} as AiService,
    {} as StorageService,
    config as unknown as ConfigService,
    { add: jest.fn() } as unknown as Queue,
  );
}

describe('GuestSearchService authorization', () => {
  it('rejects a selfie search without current biometric consent', async () => {
    const prisma = { guestSession: { findUnique: jest.fn().mockResolvedValue(activeSession) } };
    const service = createService(prisma);
    await expect(
      service.search('event-a', 'opaque-token', {
        buffer: Buffer.from('selfie'),
        mimetype: 'image/jpeg',
        originalname: 'selfie.jpg',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('binds vector matching to the session event and compatible model version', async () => {
    const consented = {
      ...activeSession,
      consents: [{ type: 'BIOMETRIC_PROCESSING', withdrawnAt: null, version: '1.0' }],
    };
    const search = { id: 'search-a', expiresAt: new Date(Date.now() + 60_000) };
    const capturedQueries: unknown[] = [];
    const rawQuery = jest.fn((query: unknown) => {
      capturedQueries.push(query);
      return Promise.resolve([]);
    });
    const tx = {
      photoSearch: { update: jest.fn() },
      searchResult: { createMany: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      guestSession: {
        findUnique: jest.fn().mockResolvedValue(consented),
        update: jest.fn().mockResolvedValue(consented),
      },
      photoSearch: { create: jest.fn().mockResolvedValue(search), update: jest.fn() },
      $queryRaw: rawQuery,
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        Promise.resolve(callback(tx)),
      ),
    };
    const ai = {
      embedSelfie: jest.fn().mockResolvedValue({
        modelVersion: 'licensed-v1',
        faces: [{ embedding: Array.from({ length: 512 }, () => 0.01) }],
      }),
    };
    const config = {
      getOrThrow: jest.fn().mockReturnValue('s'.repeat(32)),
      get: jest.fn().mockReturnValue(100),
    };
    const service = new GuestSearchService(
      prisma as unknown as PrismaService,
      ai as unknown as AiService,
      {} as StorageService,
      config as unknown as ConfigService,
      { add: jest.fn() } as unknown as Queue,
    );

    await service.search('event-a', 'opaque-token', {
      buffer: Buffer.from('selfie'),
      mimetype: 'image/jpeg',
      originalname: 'selfie.jpg',
    });

    const query = capturedQueries[0] as { values: unknown[] };
    expect(query.values).toContain('event-a');
    expect(query.values).toContain('licensed-v1');
    expect(query.values).toContain(0.7);
  });

  it('does not return a search owned by another guest session', async () => {
    const prisma = {
      guestSession: {
        findUnique: jest.fn().mockResolvedValue(activeSession),
        update: jest.fn().mockResolvedValue(activeSession),
      },
      photoSearch: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = createService(prisma);
    await expect(service.status('someone-elses-search', 'opaque-token')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.photoSearch.findFirst).toHaveBeenCalledWith({
      where: { id: 'someone-elses-search', guestSessionId: 'session-a', eventId: 'event-a' },
      select: {
        id: true,
        status: true,
        failureCode: true,
        expiresAt: true,
        createdAt: true,
        completedAt: true,
      },
    });
  });

  it('denies a photo download when the photo is not an owned search result', async () => {
    const session = {
      ...activeSession,
      event: {
        ...activeSession.event,
        settings: { ...activeSession.event.settings, downloadsEnabled: true },
      },
      consents: [{ type: 'BIOMETRIC_PROCESSING', withdrawnAt: null, version: '1.0' }],
    };
    const prisma = {
      guestSession: {
        findUnique: jest.fn().mockResolvedValue(session),
        update: jest.fn().mockResolvedValue(session),
      },
      searchResult: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = createService(prisma);
    await expect(
      service.download('photo-from-another-search', 'owned-search', 'opaque-token'),
    ).rejects.toBeInstanceOf(NotFoundException);
    const call = (prisma.searchResult.findFirst.mock.calls as unknown[][])[0]?.[0] as {
      where: { photoId: string };
    };
    expect(call.where.photoId).toBe('photo-from-another-search');
  });

  it('denies downloads when the event setting is disabled', async () => {
    const session = {
      ...activeSession,
      event: {
        ...activeSession.event,
        settings: { ...activeSession.event.settings, downloadsEnabled: false },
      },
      consents: [{ type: 'BIOMETRIC_PROCESSING', withdrawnAt: null, version: '1.0' }],
    };
    const prisma = {
      guestSession: {
        findUnique: jest.fn().mockResolvedValue(session),
        update: jest.fn().mockResolvedValue(session),
      },
    };
    await expect(
      createService(prisma).download('photo-a', 'search-a', 'opaque-token'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
