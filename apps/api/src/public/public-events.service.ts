import { Injectable, NotFoundException } from '@nestjs/common';
import { EventStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../infrastructure/storage.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class PublicEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly ai: AiService,
  ) {}

  async get(slug: string) {
    const event = await this.prisma.event.findFirst({
      where: { publicSlug: slug, deletedAt: null },
      select: {
        title: true,
        type: true,
        description: true,
        eventDate: true,
        location: true,
        status: true,
        publicSlug: true,
        studio: { select: { name: true } },
        settings: {
          select: {
            accessEnabled: true,
            accessExpiresAt: true,
            accessPinHash: true,
            consentVersion: true,
            matchingApprovedAt: true,
            matchingModelVersion: true,
            matchingPreprocessingVersion: true,
          },
        },
        coverPhoto: { select: { previewKey: true, thumbnailKey: true } },
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    const now = new Date();
    const available =
      event.status === EventStatus.ACTIVE &&
      Boolean(event.settings?.accessEnabled) &&
      (!event.settings?.accessExpiresAt || event.settings.accessExpiresAt > now);
    const coverKey = event.coverPhoto?.previewKey ?? event.coverPhoto?.thumbnailKey;
    const model = await this.ai.readiness();
    const approved =
      Boolean(event.settings?.matchingApprovedAt) &&
      event.settings?.matchingModelVersion === model.modelVersion &&
      event.settings?.matchingPreprocessingVersion === model.preprocessingVersion;
    return {
      title: event.title,
      type: event.type,
      description: event.description,
      eventDate: event.eventDate,
      location: event.location,
      studioName: event.studio.name,
      coverUrl: coverKey ? await this.storage.signedReadUrl(coverKey) : null,
      available,
      pinRequired: Boolean(event.settings?.accessPinHash),
      finderAvailable: available && model.ready && approved,
      consentVersion: event.settings?.consentVersion,
      finderMessage:
        available && model.ready && approved
          ? 'Face matching is available after creating an event-scoped session and granting consent.'
          : available
            ? model.ready
              ? 'Face matching is awaiting a validated event threshold and administrator approval.'
              : 'Face matching is temporarily unavailable while the recognition model is offline.'
            : 'Photo finding is not currently available for this event.',
    };
  }
}
