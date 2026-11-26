import { Injectable } from '@nestjs/common';
import { JobStatus, PhotoStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  async overview(studioId: string) {
    const eventWhere = { studioId, deletedAt: null };
    const photoWhere = { event: eventWhere, deletedAt: null };
    const [
      totalEvents,
      activeEvents,
      completedEvents,
      photos,
      awaiting,
      ready,
      failedJobs,
      searches,
    ] = await this.prisma.$transaction([
      this.prisma.event.count({ where: eventWhere }),
      this.prisma.event.count({ where: { ...eventWhere, status: 'ACTIVE' } }),
      this.prisma.event.count({ where: { ...eventWhere, status: 'EXPIRED' } }),
      this.prisma.photo.aggregate({ where: photoWhere, _count: true, _sum: { byteSize: true } }),
      this.prisma.photo.count({
        where: {
          ...photoWhere,
          status: { in: [PhotoStatus.UPLOADED, PhotoStatus.QUEUED, PhotoStatus.PROCESSING] },
        },
      }),
      this.prisma.photo.count({ where: { ...photoWhere, status: PhotoStatus.READY } }),
      this.prisma.processingJob.count({
        where: { event: eventWhere, status: { in: [JobStatus.FAILED, JobStatus.DEAD_LETTER] } },
      }),
      this.prisma.photoSearch.count({ where: { event: eventWhere } }),
    ]);
    return {
      totalEvents,
      activeEvents,
      completedEvents,
      totalPhotos: photos._count,
      storageBytes: Number(photos._sum.byteSize ?? 0n),
      awaitingProcessing: awaiting,
      processedPhotos: ready,
      failedJobs,
      guestSearches: searches,
    };
  }

  recentEvents(studioId: string) {
    return this.events.list(studioId, { page: 1, pageSize: 5, sort: 'desc' });
  }

  async analytics(studioId: string) {
    const events = await this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>(Prisma.sql`
      SELECT date_trunc('day', "createdAt") AS day, count(*)::bigint AS count
      FROM "Event"
      WHERE "studioId" = ${studioId}::uuid AND "deletedAt" IS NULL
      GROUP BY 1 ORDER BY 1 DESC LIMIT 90
    `);
    const photos = await this.prisma.$queryRaw<
      Array<{ day: Date; count: bigint; bytes: bigint }>
    >(Prisma.sql`
      SELECT date_trunc('day', p."createdAt") AS day,
             count(*)::bigint AS count,
             coalesce(sum(p."byteSize"), 0)::bigint AS bytes
      FROM "Photo" p
      JOIN "Event" e ON e.id = p."eventId"
      WHERE e."studioId" = ${studioId}::uuid AND p."deletedAt" IS NULL AND e."deletedAt" IS NULL
      GROUP BY 1 ORDER BY 1 DESC LIMIT 90
    `);
    const processing = await this.prisma.processingJob.groupBy({
      by: ['status'],
      where: { event: { studioId, deletedAt: null } },
      _count: true,
    });
    const byEvent = await this.prisma.event.findMany({
      where: { studioId, deletedAt: null },
      orderBy: { eventDate: 'desc' },
      take: 25,
      select: {
        id: true,
        title: true,
        eventDate: true,
        _count: { select: { photos: { where: { deletedAt: null } } } },
      },
    });
    const storageByEvent = byEvent.length
      ? await this.prisma.photo.groupBy({
          by: ['eventId'],
          where: { eventId: { in: byEvent.map((event) => event.id) }, deletedAt: null },
          _sum: { byteSize: true },
        })
      : [];
    return {
      eventsOverTime: events.reverse().map((row) => ({ date: row.day, count: Number(row.count) })),
      photosOverTime: photos
        .reverse()
        .map((row) => ({ date: row.day, count: Number(row.count), bytes: Number(row.bytes) })),
      processing: Object.fromEntries(processing.map((row) => [row.status, row._count])),
      events: byEvent.map((event) => ({
        id: event.id,
        title: event.title,
        eventDate: event.eventDate,
        photoCount: event._count.photos,
        storageBytes: Number(
          storageByEvent.find((storage) => storage.eventId === event.id)?._sum.byteSize ?? 0n,
        ),
      })),
    };
  }
}
