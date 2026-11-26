import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditActorType, Prisma, StudioRole } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { StudioAccessService } from '../auth/studio-access.service';
import { StorageService } from '../infrastructure/storage.service';
import { PrismaService } from '../prisma/prisma.service';
import type { UploadedSelfie } from '../public/guest-search.service';

const DIAGNOSTIC_ROLES = [StudioRole.OWNER, StudioRole.ADMIN, StudioRole.PHOTOGRAPHER];

@Injectable()
export class FaceDiagnosticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StudioAccessService,
    private readonly storage: StorageService,
    private readonly ai: AiService,
    private readonly config: ConfigService,
  ) {}

  private async authorizedPhoto(userId: string, eventId: string, photoId: string) {
    const { studioId } = await this.access.requireEventAccess(userId, eventId, DIAGNOSTIC_ROLES);
    const photo = await this.prisma.photo.findFirst({
      where: { id: photoId, eventId, deletedAt: null },
      include: { event: { include: { settings: true } } },
    });
    if (!photo) throw new NotFoundException('Photograph is unavailable');
    return { photo, studioId };
  }

  async inspect(userId: string, eventId: string, photoId: string) {
    const { photo, studioId } = await this.authorizedPhoto(userId, eventId, photoId);
    const indexed = await this.prisma.faceEmbedding.findMany({
      where: { photoId, eventId },
      select: {
        faceIndex: true,
        modelVersion: true,
        preprocessingVersion: true,
        qualityStatus: true,
      },
      orderBy: { faceIndex: 'asc' },
    });
    const image = photo.aiInputKey ? await this.storage.readDerivative(photo.aiInputKey) : null;
    const observation = image
      ? await this.ai.diagnosePhoto(image, 'image/jpeg', `${photoId}-diagnostic.jpg`)
      : null;
    await this.prisma.auditLog.create({
      data: {
        studioId,
        eventId,
        userId,
        actorType: AuditActorType.USER,
        action: 'face_diagnostics.viewed',
        resourceType: 'Photo',
        resourceId: photoId,
      },
    });
    return {
      photoId,
      filename: photo.originalFilename,
      status: photo.status,
      failureCode: photo.failureCode,
      derivativeStatus: photo.derivativeStatus,
      modelVersion: photo.modelVersion,
      detectionVersion: photo.detectionVersion,
      indexedFaces: indexed,
      observation,
      previewUrl: photo.previewKey ? await this.storage.signedReadUrl(photo.previewKey) : null,
      originalUrl: await this.storage.signedReadUrl(photo.originalKey, false),
      reason: !image
        ? 'DERIVATIVE_MISSING'
        : observation?.faces.length === 0
          ? 'DETECTION_FAILURE'
          : observation?.faces.every((face) => face.embeddingStatus !== 'GENERATED')
            ? 'QUALITY_REJECTION'
            : indexed.length === 0
              ? 'INDEXING_FAILURE'
              : null,
    };
  }

  async probe(userId: string, eventId: string, photoId: string, selfie: UploadedSelfie) {
    const { photo, studioId } = await this.authorizedPhoto(userId, eventId, photoId);
    if (!selfie?.buffer?.length) throw new BadRequestException('A test selfie is required');
    const analysis = await this.ai.embedSelfie(selfie.buffer, selfie.mimetype, selfie.originalname);
    const embedding = analysis.faces[0]?.embedding;
    if (!embedding) throw new BadRequestException('The test selfie has no usable face');
    const vector = `[${embedding.join(',')}]`;
    const matches = await this.prisma.$queryRaw<{ similarity: number | null }[]>(Prisma.sql`
      SELECT MAX(1 - (fe.embedding <=> ${vector}::vector))::double precision AS similarity
      FROM "FaceEmbedding" fe
      WHERE fe."eventId" = ${eventId}::uuid
        AND fe."photoId" = ${photoId}::uuid
        AND fe."modelVersion" = ${analysis.modelVersion}
        AND fe."preprocessingVersion" = ${analysis.preprocessingVersion}
        AND fe."qualityStatus" = 'ACCEPTED'
    `);
    const similarity = matches[0]?.similarity ?? null;
    const threshold = Number(photo.event.settings?.similarityThreshold ?? 0.64);
    const resultLimit = this.config.get<number>('FACE_MATCH_MAX_RESULTS', 1000);
    const approved =
      Boolean(photo.event.settings?.matchingApprovedAt) &&
      photo.event.settings?.matchingModelVersion === analysis.modelVersion &&
      photo.event.settings?.matchingPreprocessingVersion === analysis.preprocessingVersion;
    let candidateRank: number | null = null;
    if (photo.status === 'READY' && approved && similarity !== null && similarity >= threshold) {
      const rankRows = await this.prisma.$queryRaw<{ preceding: bigint }[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS preceding FROM (
          SELECT fe."photoId", MAX(1 - (fe.embedding <=> ${vector}::vector)) AS score
          FROM "FaceEmbedding" fe JOIN "Photo" p ON p.id = fe."photoId"
          WHERE fe."eventId" = ${eventId}::uuid
            AND p."eventId" = ${eventId}::uuid
            AND fe."modelVersion" = ${analysis.modelVersion}
            AND fe."preprocessingVersion" = ${analysis.preprocessingVersion}
            AND fe."qualityStatus" = 'ACCEPTED'
            AND p."deletedAt" IS NULL AND p.status = 'READY'
          GROUP BY fe."photoId"
        ) ranked
        WHERE ranked.score > ${similarity}
          OR (ranked.score = ${similarity} AND ranked."photoId" < ${photoId}::uuid)
      `);
      candidateRank = Number(rankRows[0]?.preceding ?? 0n) + 1;
    }
    const accepted =
      photo.status === 'READY' &&
      approved &&
      similarity !== null &&
      similarity >= threshold &&
      candidateRank !== null &&
      candidateRank <= resultLimit;
    const reason =
      photo.status !== 'READY'
        ? 'INDEXING_FAILURE'
        : similarity === null
          ? 'NO_COMPATIBLE_EMBEDDING'
          : !approved
            ? 'MATCHING_NOT_APPROVED'
            : similarity < threshold
              ? 'SIMILARITY_REJECTION'
              : candidateRank !== null && candidateRank > resultLimit
                ? 'CANDIDATE_LIMIT'
                : 'ACCEPTED';
    await this.prisma.auditLog.create({
      data: {
        studioId,
        eventId,
        userId,
        actorType: AuditActorType.USER,
        action: 'face_diagnostics.probed',
        resourceType: 'Photo',
        resourceId: photoId,
        metadata: { reason, modelVersion: analysis.modelVersion },
      },
    });
    return {
      photoId,
      similarity,
      threshold,
      accepted,
      reason,
      modelVersion: analysis.modelVersion,
      preprocessingVersion: analysis.preprocessingVersion,
      candidateRank,
      resultLimit,
    };
  }
}
