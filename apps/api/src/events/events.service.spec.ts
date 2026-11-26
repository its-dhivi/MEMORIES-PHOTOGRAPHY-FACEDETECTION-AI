import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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
});
