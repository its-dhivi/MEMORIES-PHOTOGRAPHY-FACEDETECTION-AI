import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import {
  AuditActorType,
  JobType,
  PhotoStatus,
  Prisma,
  StudioRole,
  UploadStatus,
} from '@prisma/client';
import type { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { StudioAccessService } from '../auth/studio-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../infrastructure/storage.service';
import type {
  ListPhotosDto,
  UploadCompleteDto,
  UploadInitDto,
  UploadPartUrlDto,
} from './photos.dto';

const WRITE_ROLES = [StudioRole.OWNER, StudioRole.ADMIN, StudioRole.PHOTOGRAPHER];
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/x-canon-cr2': 'cr2',
  'image/x-canon-cr3': 'cr3',
  'image/x-nikon-nef': 'nef',
  'image/x-sony-arw': 'arw',
  'image/x-adobe-dng': 'dng',
  'image/x-fuji-raf': 'raf',
};
const RAW_EXTENSIONS: Record<string, string> = {
  cr2: 'image/x-canon-cr2',
  cr3: 'image/x-canon-cr3',
  nef: 'image/x-nikon-nef',
  arw: 'image/x-sony-arw',
  dng: 'image/x-adobe-dng',
  raf: 'image/x-fuji-raf',
};

@Injectable()
export class PhotosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: StudioAccessService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    @InjectQueue('thumbnail-generation') private readonly thumbnails: Queue,
    @InjectQueue('photo-processing') private readonly processing: Queue,
    @InjectQueue('photo-deletion') private readonly deletions: Queue,
  ) {}

  async list(userId: string, eventId: string, input: ListPhotosDto) {
    await this.access.requireEventAccess(userId, eventId);
    const where: Prisma.PhotoWhereInput = {
      eventId,
      deletedAt: null,
      ...(input.status ? { status: input.status } : {}),
    };
    const [total, photos] = await this.prisma.$transaction([
      this.prisma.photo.count({ where }),
      this.prisma.photo.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        select: {
          id: true,
          originalFilename: true,
          mimeType: true,
          byteSize: true,
          width: true,
          height: true,
          status: true,
          failureCode: true,
          failureMessage: true,
          createdAt: true,
          processedAt: true,
          faceCount: true,
          skippedFaceCount: true,
          modelVersion: true,
          processingDurationMs: true,
          originalKey: true,
          thumbnailKey: true,
          previewKey: true,
        },
      }),
    ]);
    return {
      items: await Promise.all(
        photos.map(async (photo) => ({
          ...photo,
          byteSize: Number(photo.byteSize),
          originalKey: undefined,
          thumbnailKey: undefined,
          previewKey: undefined,
          thumbnailUrl: photo.thumbnailKey
            ? await this.storage.signedReadUrl(photo.thumbnailKey)
            : null,
          previewUrl: photo.previewKey
            ? await this.storage.signedReadUrl(photo.previewKey)
            : await this.storage.signedReadUrl(photo.originalKey, false),
        })),
      ),
      page: input.page,
      pageSize: input.pageSize,
      total,
      totalPages: Math.ceil(total / input.pageSize),
    };
  }

  async initialize(userId: string, eventId: string, input: UploadInitDto) {
    const { studioId } = await this.access.requireEventAccess(userId, eventId, WRITE_ROLES);
    const maxBytes = this.config.get<number>('MAX_ORIGINAL_PHOTO_BYTES', 524_288_000);
    if (input.byteSize > maxBytes)
      throw new PayloadTooLargeException('Photograph exceeds upload limit');
    const filenameExtension = input.filename.split('.').pop()?.toLowerCase() ?? '';
    const mimeType =
      input.mimeType === 'application/octet-stream'
        ? RAW_EXTENSIONS[filenameExtension]
        : input.mimeType;
    const extension = mimeType ? MIME_EXTENSIONS[mimeType] : undefined;
    if (!mimeType || !extension) throw new BadRequestException('Unsupported photograph format');

    const duplicate = await this.prisma.photo.findFirst({
      where: { eventId, sha256: input.sha256, deletedAt: null },
      select: { id: true, originalFilename: true },
    });
    if (duplicate)
      return { duplicate: true, photoId: duplicate.id, filename: duplicate.originalFilename };

    const existing = await this.prisma.uploadSession.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
      if (existing.eventId !== eventId || existing.requestedById !== userId) {
        throw new ConflictException('Idempotency key is already in use');
      }
      if (existing.status === UploadStatus.COMPLETED) {
        return { duplicate: true, photoId: existing.photoId };
      }
      return this.uploadAuthorization(existing);
    }

    const [storage, pending] = await Promise.all([
      this.prisma.photo.aggregate({
        where: { event: { studioId }, deletedAt: null },
        _sum: { byteSize: true },
      }),
      this.prisma.uploadSession.aggregate({
        where: { event: { studioId }, status: UploadStatus.PENDING, expiresAt: { gt: new Date() } },
        _sum: { byteSize: true },
      }),
    ]);
    const used = Number(storage._sum.byteSize ?? 0n) + Number(pending._sum.byteSize ?? 0n);
    const quota = this.config.get<number>('STUDIO_STORAGE_QUOTA_BYTES', 536_870_912_000);
    if (used + input.byteSize > quota)
      throw new PayloadTooLargeException('Studio storage quota exceeded');

    const objectKey = `studios/${studioId}/events/${eventId}/originals/${randomUUID()}.${extension}`;
    let session;
    try {
      session = await this.prisma.uploadSession.create({
        data: {
          eventId,
          requestedById: userId,
          objectKey,
          originalFilename: input.filename,
          mimeType,
          byteSize: BigInt(input.byteSize),
          sha256: input.sha256,
          idempotencyKey: input.idempotencyKey,
          expiresAt: new Date(
            Date.now() + this.config.get<number>('UPLOAD_SESSION_TTL_SECONDS', 3600) * 1000,
          ),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This photograph is already being uploaded');
      }
      throw error;
    }
    const threshold = this.config.get<number>('MULTIPART_UPLOAD_THRESHOLD_BYTES', 33_554_432);
    if (input.byteSize >= threshold) {
      const uploadId = await this.storage.initializeMultipartUpload({
        key: session.objectKey,
        mimeType: session.mimeType,
        sha256Hex: session.sha256,
      });
      const partSize = this.config.get<number>('MULTIPART_PART_SIZE_BYTES', 16_777_216);
      const multipart = await this.prisma.uploadSession.update({
        where: { id: session.id },
        data: { uploadMode: 'MULTIPART', multipartUploadId: uploadId, partSize },
      });
      return this.uploadAuthorization(multipart);
    }
    return this.uploadAuthorization(session);
  }

  async complete(userId: string, eventId: string, input: UploadCompleteDto) {
    const { studioId } = await this.access.requireEventAccess(userId, eventId, WRITE_ROLES);
    const session = await this.prisma.uploadSession.findFirst({
      where: { id: input.uploadSessionId, eventId },
    });
    if (!session) throw new NotFoundException('Upload session not found');
    if (session.status === UploadStatus.COMPLETED && session.photoId) {
      return { photoId: session.photoId, queued: true, idempotent: true };
    }
    if (session.status !== UploadStatus.PENDING || session.expiresAt <= new Date()) {
      throw new ConflictException('Upload session is no longer active');
    }
    if (session.uploadMode === 'MULTIPART') {
      if (!session.multipartUploadId || !input.parts?.length)
        throw new BadRequestException('Multipart completion requires uploaded parts');
      const stored = await this.storage.listUploadedParts(
        session.objectKey,
        session.multipartUploadId,
      );
      const supplied = [...input.parts].sort((a, b) => a.partNumber - b.partNumber);
      if (
        stored.length !== supplied.length ||
        supplied.some((part, index) => {
          const actual = stored[index];
          return !actual || actual.partNumber !== part.partNumber || actual.etag !== part.etag;
        })
      )
        throw new BadRequestException('Multipart upload parts could not be verified');
      await this.storage.completeMultipartUpload({
        key: session.objectKey,
        uploadId: session.multipartUploadId,
        parts: supplied,
      });
    }

    let head;
    try {
      head = await this.storage.headOriginal(session.objectKey);
    } catch {
      throw new BadRequestException('Uploaded object could not be verified');
    }
    if (Number(head.ContentLength) !== Number(session.byteSize)) {
      throw new BadRequestException('Uploaded object size does not match authorization');
    }
    if (head.ContentType !== session.mimeType || head.Metadata?.sha256 !== session.sha256) {
      throw new BadRequestException('Uploaded object metadata does not match authorization');
    }
    const expectedChecksum = Buffer.from(session.sha256, 'hex').toString('base64');
    if (
      session.uploadMode === 'SINGLE' &&
      head.ChecksumSHA256 &&
      head.ChecksumSHA256 !== expectedChecksum
    ) {
      throw new BadRequestException('Uploaded object checksum does not match');
    }
    const prefix = await this.storage.originalPrefix(session.objectKey);
    if (!this.matchesMagicBytes(prefix, session.mimeType)) {
      await this.storage.deleteObjects([{ key: session.objectKey, derivative: false }]);
      await this.prisma.uploadSession.update({
        where: { id: session.id },
        data: { status: UploadStatus.FAILED, failureCode: 'INVALID_MAGIC_BYTES' },
      });
      throw new BadRequestException('Uploaded file content is not a supported image');
    }

    let result;
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const photo = await tx.photo.create({
          data: {
            eventId,
            originalKey: session.objectKey,
            originalFilename: session.originalFilename,
            mimeType: session.mimeType,
            byteSize: session.byteSize,
            sha256: session.sha256,
            originalFormat: session.objectKey.split('.').pop()?.toUpperCase() ?? null,
            status: PhotoStatus.UPLOADED,
          },
        });
        const thumbnailJob = await tx.processingJob.create({
          data: {
            eventId,
            photoId: photo.id,
            type: JobType.THUMBNAIL_GENERATE,
            idempotencyKey: `thumbnail:${photo.id}`,
            payload: { photoId: photo.id },
          },
        });
        const aiJob = await tx.processingJob.create({
          data: {
            eventId,
            photoId: photo.id,
            type: JobType.PHOTO_PROCESS,
            idempotencyKey: `photo-process:${photo.id}`,
            payload: { photoId: photo.id, eventId },
            maxAttempts: this.config.get<number>('FACE_PROCESSING_MAX_RETRIES', 5),
          },
        });
        await tx.uploadSession.update({
          where: { id: session.id },
          data: { status: UploadStatus.COMPLETED, completedAt: new Date(), photoId: photo.id },
        });
        await tx.auditLog.create({
          data: {
            studioId,
            eventId,
            userId,
            actorType: AuditActorType.USER,
            action: 'photo.upload_completed',
            resourceType: 'Photo',
            resourceId: photo.id,
          },
        });
        return { photo, thumbnailJob, aiJob };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const photo = await this.prisma.photo.findFirst({
          where: { eventId, sha256: session.sha256, deletedAt: null },
        });
        if (photo)
          return {
            photoId: photo.id,
            queued: photo.status !== PhotoStatus.UPLOADED,
            duplicate: true,
          };
      }
      throw error;
    }

    try {
      const queueJob = await this.thumbnails.add(
        'generate-derivatives',
        {
          photoId: result.photo.id,
          processingJobId: result.thumbnailJob.id,
          aiJobId: result.aiJob.id,
        },
        { jobId: result.thumbnailJob.id },
      );
      await this.prisma.$transaction([
        this.prisma.processingJob.update({
          where: { id: result.thumbnailJob.id },
          data: { queueJobId: String(queueJob.id) },
        }),
        this.prisma.photo.update({
          where: { id: result.photo.id },
          data: { status: PhotoStatus.QUEUED },
        }),
      ]);
      return { photoId: result.photo.id, queued: true };
    } catch {
      return { photoId: result.photo.id, queued: false, queueUnavailable: true };
    }
  }

  async partUrl(userId: string, eventId: string, input: UploadPartUrlDto) {
    await this.access.requireEventAccess(userId, eventId, WRITE_ROLES);
    const session = await this.prisma.uploadSession.findFirst({
      where: {
        id: input.uploadSessionId,
        eventId,
        requestedById: userId,
        status: UploadStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
    });
    if (!session?.multipartUploadId || session.uploadMode !== 'MULTIPART')
      throw new NotFoundException('Multipart upload session not found');
    const partCount = Math.ceil(Number(session.byteSize) / session.partSize!);
    if (input.partNumber > partCount)
      throw new BadRequestException('Part number exceeds the authorized file size');
    return {
      partNumber: input.partNumber,
      uploadUrl: await this.storage.createPartUploadUrl({
        key: session.objectKey,
        uploadId: session.multipartUploadId,
        partNumber: input.partNumber,
        checksumBase64: input.checksumSHA256,
      }),
      headers: { 'x-amz-checksum-sha256': input.checksumSHA256 },
      expiresAt: session.expiresAt,
    };
  }

  async uploadState(userId: string, eventId: string, sessionId: string) {
    await this.access.requireEventAccess(userId, eventId, WRITE_ROLES);
    const session = await this.prisma.uploadSession.findFirst({
      where: { id: sessionId, eventId, requestedById: userId },
    });
    if (!session) throw new NotFoundException('Upload session not found');
    const parts =
      session.uploadMode === 'MULTIPART' && session.multipartUploadId
        ? await this.storage.listUploadedParts(session.objectKey, session.multipartUploadId)
        : [];
    return {
      uploadSessionId: session.id,
      status: session.status,
      uploadMode: session.uploadMode,
      partSize: session.partSize,
      byteSize: Number(session.byteSize),
      sha256: session.sha256,
      expiresAt: session.expiresAt,
      parts,
    };
  }

  async cancelUpload(userId: string, eventId: string, sessionId: string): Promise<void> {
    await this.access.requireEventAccess(userId, eventId, WRITE_ROLES);
    const session = await this.prisma.uploadSession.findFirst({
      where: { id: sessionId, eventId, requestedById: userId },
    });
    if (!session || session.status === UploadStatus.CANCELLED) return;
    if (session.status === UploadStatus.COMPLETED)
      throw new ConflictException('Completed uploads cannot be cancelled');
    if (session.multipartUploadId)
      await this.storage.abortMultipartUpload(session.objectKey, session.multipartUploadId);
    else await this.storage.deleteObjects([{ key: session.objectKey, derivative: false }]);
    await this.prisma.uploadSession.update({
      where: { id: session.id },
      data: { status: UploadStatus.CANCELLED },
    });
  }

  async remove(userId: string, photoId: string): Promise<void> {
    const photo = await this.prisma.photo.findUnique({ where: { id: photoId } });
    if (!photo) return;
    const { studioId } = await this.access.requireEventAccess(userId, photo.eventId, WRITE_ROLES);
    if (photo.deletedAt) return;
    const job = await this.prisma.$transaction(async (tx) => {
      await tx.photo.update({
        where: { id: photoId },
        data: { status: PhotoStatus.DELETED, deletedAt: new Date() },
      });
      const deletion = await tx.processingJob.upsert({
        where: { idempotencyKey: `photo-delete:${photoId}` },
        create: {
          eventId: photo.eventId,
          photoId,
          type: JobType.PHOTO_DELETE,
          idempotencyKey: `photo-delete:${photoId}`,
          payload: { photoId },
        },
        update: {},
      });
      await tx.auditLog.create({
        data: {
          studioId,
          eventId: photo.eventId,
          userId,
          actorType: AuditActorType.USER,
          action: 'photo.deletion_requested',
          resourceType: 'Photo',
          resourceId: photoId,
        },
      });
      return deletion;
    });
    await this.deletions.add(
      'delete-photo',
      { photoId, processingJobId: job.id },
      { jobId: job.id },
    );
  }

  async reprocess(userId: string, photoId: string) {
    const photo = await this.prisma.photo.findUnique({ where: { id: photoId } });
    if (!photo || photo.deletedAt) throw new NotFoundException('Photograph not found');
    await this.access.requireEventAccess(userId, photo.eventId, WRITE_ROLES);
    const type = photo.thumbnailKey ? JobType.PHOTO_PROCESS : JobType.THUMBNAIL_GENERATE;
    const job = await this.prisma.processingJob.findFirst({
      where: { photoId, type },
      orderBy: { createdAt: 'desc' },
    });
    if (!job) throw new NotFoundException('Processing job not found');
    await this.prisma.$transaction([
      this.prisma.processingJob.update({
        where: { id: job.id },
        data: { status: 'PENDING', error: Prisma.JsonNull, completedAt: null },
      }),
      this.prisma.photo.update({
        where: { id: photoId },
        data: { status: PhotoStatus.QUEUED, failureCode: null, failureMessage: null },
      }),
    ]);
    const queue = type === JobType.PHOTO_PROCESS ? this.processing : this.thumbnails;
    await queue.add(
      type === JobType.PHOTO_PROCESS ? 'process-photo' : 'generate-derivatives',
      { photoId, eventId: photo.eventId, processingJobId: job.id },
      {
        jobId: `${job.id}-${Date.now()}`,
        attempts: job.maxAttempts,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
    return { jobId: job.id, queued: true };
  }

  private async uploadAuthorization(session: {
    id: string;
    objectKey: string;
    mimeType: string;
    sha256: string;
    expiresAt: Date;
    uploadMode?: string;
    multipartUploadId?: string | null;
    partSize?: number | null;
  }) {
    const checksumBase64 = Buffer.from(session.sha256, 'hex').toString('base64');
    return {
      duplicate: false,
      uploadSessionId: session.id,
      uploadMode: session.uploadMode ?? 'SINGLE',
      partSize: session.partSize ?? undefined,
      ...(session.uploadMode === 'MULTIPART'
        ? {}
        : {
            uploadUrl: await this.storage.createUploadUrl({
              key: session.objectKey,
              mimeType: session.mimeType,
              sha256Hex: session.sha256,
              checksumBase64,
            }),
            headers: {
              'Content-Type': session.mimeType,
              'x-amz-checksum-sha256': checksumBase64,
              'x-amz-meta-sha256': session.sha256,
            },
          }),
      expiresAt: session.expiresAt,
    };
  }

  private matchesMagicBytes(bytes: Uint8Array, mimeType: string): boolean {
    if (mimeType === 'image/jpeg')
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (mimeType === 'image/png') {
      return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
        (value, index) => bytes[index] === value,
      );
    }
    if (mimeType === 'image/webp') {
      return (
        String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
        String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
      );
    }
    if (mimeType === 'image/x-fuji-raf')
      return new TextDecoder().decode(bytes.slice(0, 16)).startsWith('FUJIFILMCCD-RAW');
    if (mimeType === 'image/x-canon-cr3')
      return new TextDecoder().decode(bytes.slice(4, 12)).includes('ftypcrx');
    if (
      ['image/x-canon-cr2', 'image/x-nikon-nef', 'image/x-sony-arw', 'image/x-adobe-dng'].includes(
        mimeType,
      )
    ) {
      const tiff =
        (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) ||
        (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a);
      return tiff;
    }
    return false;
  }
}
