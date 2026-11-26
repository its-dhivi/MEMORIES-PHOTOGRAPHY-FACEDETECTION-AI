import type { EventsService } from '../events/events.service';
import type { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('scopes every overview aggregate to the authenticated studio', async () => {
    const eventCount = jest.fn();
    const photoAggregate = jest.fn();
    const photoCount = jest.fn();
    const jobCount = jest.fn();
    const searchCount = jest.fn();
    const prisma = {
      event: { count: eventCount },
      photo: { aggregate: photoAggregate, count: photoCount },
      processingJob: { count: jobCount },
      photoSearch: { count: searchCount },
      $transaction: jest
        .fn()
        .mockResolvedValue([2, 1, 0, { _count: 3, _sum: { byteSize: 1200n } }, 2, 1, 0, 0]),
    } as unknown as PrismaService;
    const service = new DashboardService(prisma, {} as EventsService);

    await service.overview('studio-a');

    expect(eventCount).toHaveBeenCalledWith({
      where: { studioId: 'studio-a', deletedAt: null },
    });
    expect(photoAggregate).toHaveBeenCalledWith({
      where: { event: { studioId: 'studio-a', deletedAt: null }, deletedAt: null },
      _count: true,
      _sum: { byteSize: true },
    });
    expect(jobCount).toHaveBeenCalledWith({
      where: {
        event: { studioId: 'studio-a', deletedAt: null },
        status: { in: ['FAILED', 'DEAD_LETTER'] },
      },
    });
    expect(searchCount).toHaveBeenCalledWith({
      where: { event: { studioId: 'studio-a', deletedAt: null } },
    });
  });
});
