import { ConflictException } from '@nestjs/common';
import { Prisma, StudioRole } from '@prisma/client';
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

  it('restricts the guest matching switch and threshold to owners and administrators', async () => {
    const settings = {
      eventId: 'event',
      accessEnabled: false,
      accessPinHash: null,
      similarityThreshold: 0.64,
      faceMatchingEnabled: true,
    };
    const eventSettings = {
      update: jest.fn((input: { where: { eventId: string }; data: Record<string, unknown> }) => {
        void input;
        return Promise.resolve(settings);
      }),
      findUnique: jest.fn().mockResolvedValue(settings),
    };
    const photoSearch = { updateMany: jest.fn().mockResolvedValue({ count: 2 }) };
    const guestDownloadJob = { updateMany: jest.fn().mockResolvedValue({ count: 1 }) };
    const access = { requireEventAccess: jest.fn().mockResolvedValue({ studioId: 'studio' }) };
    const prisma = {
      eventSettings,
      photoSearch,
      guestDownloadJob,
      auditLog: { create: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn().mockResolvedValue([]),
    } as unknown as PrismaService;
    const service = new EventsService(
      prisma,
      access as unknown as StudioAccessService,
      {} as StorageService,
      {} as ConfigService,
      {} as Queue,
    );
    await service.updateSettings('owner', 'event', {
      faceMatchingEnabled: false,
      similarityThreshold: 0.7,
    });
    expect(access.requireEventAccess).toHaveBeenNthCalledWith(1, 'owner', 'event', [
      StudioRole.OWNER,
      StudioRole.ADMIN,
    ]);
    expect(eventSettings.update.mock.calls[0]?.[0].data).toMatchObject({
      faceMatchingEnabled: false,
      similarityThreshold: 0.7,
    });
    expect(photoSearch.updateMany).toHaveBeenCalled();
    expect(guestDownloadJob.updateMany).toHaveBeenCalled();
  });
});
