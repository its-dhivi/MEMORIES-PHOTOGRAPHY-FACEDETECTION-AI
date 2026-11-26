import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditActorType, Prisma, StudioRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { AiService } from '../ai/ai.service';
import { StudioAccessService } from '../auth/studio-access.service';
import { StorageService } from '../infrastructure/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import type { UploadedSelfie } from '../public/guest-search.service';

interface MatchRow {
  photoId: string;
  similarity: number;
  previewKey: string | null;
  filename: string;
}

@Injectable()
export class PrivateMatchingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StudioAccessService,
    private readonly ai: AiService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  async search(userId: string, eventId: string, selfie: UploadedSelfie, consent: boolean) {
    const { studioId } = await this.access.requireEventAccess(userId, eventId, [
      StudioRole.OWNER,
      StudioRole.ADMIN,
    ]);
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, studioId, deletedAt: null },
      select: { id: true, settings: { select: { similarityThreshold: true } } },
    });
    if (!event) throw new NotFoundException('Event is unavailable');
    if (!consent) throw new BadRequestException('Explicit selfie processing consent is required');
    if (!selfie?.buffer?.length) throw new BadRequestException('A selfie is required');
    if (selfie.buffer.length > 15 * 1024 * 1024)
      throw new BadRequestException('Selfie exceeds 15 MiB');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selfie.mimetype)) {
      throw new BadRequestException('Use a JPEG, PNG, or WebP selfie image');
    }
    const bytes = selfie.buffer;
    const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png =
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const webp =
      bytes.length >= 12 &&
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP';
    if (!jpeg && !png && !webp)
      throw new BadRequestException('Selfie content does not match a supported image format');

    // The submitted image is held only in request memory and is never persisted.
    const analysis = await this.ai.embedSelfie(selfie.buffer, selfie.mimetype, 'private-selfie');
    const embedding = analysis.faces.find((face) => face.embedding)?.embedding;
    if (!embedding) throw new BadRequestException('Selfie did not contain a usable face');
    const threshold = Number(event.settings?.similarityThreshold ?? 0.64);
    const limit = this.config.get<number>('FACE_MATCH_MAX_RESULTS', 1000);
    const vector = `[${embedding.join(',')}]`;
    const matches = await this.prisma.$queryRaw<MatchRow[]>(Prisma.sql`
      SELECT ranked."photoId", ranked.similarity::double precision AS similarity,
             ranked."previewKey", ranked.filename
      FROM (
        SELECT fe."photoId", MAX(1 - (fe.embedding <=> ${vector}::vector)) AS similarity,
               p."previewKey", p."originalFilename" AS filename
        FROM "FaceEmbedding" fe
        JOIN "Photo" p ON p.id = fe."photoId" AND p."eventId" = ${eventId}::uuid
        WHERE fe."eventId" = ${eventId}::uuid
          AND fe."modelVersion" = ${analysis.modelVersion}
          AND fe."preprocessingVersion" = ${analysis.preprocessingVersion}
          AND fe."qualityStatus" = 'ACCEPTED'
          AND p."deletedAt" IS NULL AND p.status = 'READY'
        GROUP BY fe."photoId", p."previewKey", p."originalFilename"
      ) ranked
      WHERE ranked.similarity >= ${threshold}
      ORDER BY ranked.similarity DESC, ranked."photoId" ASC
      LIMIT ${limit}
    `);
    await this.prisma.auditLog.create({
      data: {
        studioId,
        eventId,
        userId,
        actorType: AuditActorType.USER,
        action: 'event.private_face_search_completed',
        resourceType: 'Event',
        resourceId: eventId,
        metadata: {
          resultCount: matches.length,
          modelVersion: analysis.modelVersion,
          consent: true,
        },
      },
    });
    return {
      status: 'COMPLETED',
      threshold,
      results: await Promise.all(
        matches.map(async (match) => ({
          photoId: match.photoId,
          filename: match.filename,
          similarity: match.similarity,
          previewUrl: match.previewKey ? await this.storage.signedReadUrl(match.previewKey) : null,
        })),
      ),
    };
  }
}
