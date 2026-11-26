import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import type { Readable } from 'node:stream';

@Injectable()
export class StorageService {
  readonly client: S3Client;
  private readonly browserClient: S3Client;
  readonly originalsBucket: string;
  readonly derivativesBucket: string;

  constructor(config: ConfigService) {
    this.originalsBucket = config.getOrThrow<string>('S3_BUCKET_ORIGINALS');
    this.derivativesBucket = config.getOrThrow<string>('S3_BUCKET_DERIVATIVES');
    const endpoint = config.get<string>('S3_ENDPOINT');
    const options = {
      region: config.getOrThrow<string>('S3_REGION'),
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      credentials: {
        accessKeyId: config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow<string>('S3_SECRET_KEY'),
      },
    };
    this.client = new S3Client(options);
    this.browserClient = new S3Client({
      ...options,
      endpoint: config.getOrThrow<string>('S3_PUBLIC_ENDPOINT'),
      forcePathStyle: true,
    });
    this.urlTtlSeconds = config.get<number>('PRESIGNED_URL_TTL_SECONDS', 900);
  }

  private readonly urlTtlSeconds: number;

  async createUploadUrl(input: {
    key: string;
    mimeType: string;
    sha256Hex: string;
    checksumBase64: string;
  }): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.originalsBucket,
      Key: input.key,
      ContentType: input.mimeType,
      ChecksumSHA256: input.checksumBase64,
      Metadata: { sha256: input.sha256Hex },
    });
    return getSignedUrl(this.browserClient, command, {
      expiresIn: this.urlTtlSeconds,
      // S3-compatible servers such as RustFS reject request headers that were
      // not part of the signature. Keep these values as signed headers instead
      // of allowing the AWS presigner to hoist them into the query string.
      signableHeaders: new Set(['content-type', 'x-amz-checksum-sha256', 'x-amz-meta-sha256']),
      unhoistableHeaders: new Set(['x-amz-checksum-sha256', 'x-amz-meta-sha256']),
    });
  }

  async initializeMultipartUpload(input: {
    key: string;
    mimeType: string;
    sha256Hex: string;
  }): Promise<string> {
    const result = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.originalsBucket,
        Key: input.key,
        ContentType: input.mimeType,
        Metadata: { sha256: input.sha256Hex },
        ChecksumAlgorithm: 'SHA256',
      }),
    );
    if (!result.UploadId) throw new Error('Storage did not create a multipart upload');
    return result.UploadId;
  }

  async createPartUploadUrl(input: {
    key: string;
    uploadId: string;
    partNumber: number;
    checksumBase64: string;
  }): Promise<string> {
    return getSignedUrl(
      this.browserClient,
      new UploadPartCommand({
        Bucket: this.originalsBucket,
        Key: input.key,
        UploadId: input.uploadId,
        PartNumber: input.partNumber,
        ChecksumSHA256: input.checksumBase64,
      }),
      {
        expiresIn: this.urlTtlSeconds,
        signableHeaders: new Set(['x-amz-checksum-sha256']),
        unhoistableHeaders: new Set(['x-amz-checksum-sha256']),
      },
    );
  }

  async listUploadedParts(key: string, uploadId: string) {
    const result = await this.client.send(
      new ListPartsCommand({ Bucket: this.originalsBucket, Key: key, UploadId: uploadId }),
    );
    return (result.Parts ?? []).map((part) => ({
      partNumber: part.PartNumber!,
      etag: part.ETag!,
      size: part.Size ?? 0,
      checksumSHA256: part.ChecksumSHA256,
    }));
  }

  async completeMultipartUpload(input: {
    key: string;
    uploadId: string;
    parts: Array<{ partNumber: number; etag: string; checksumSHA256?: string }>;
  }): Promise<void> {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.originalsBucket,
        Key: input.key,
        UploadId: input.uploadId,
        MultipartUpload: {
          Parts: input.parts.map((part) => ({
            PartNumber: part.partNumber,
            ETag: part.etag,
            ChecksumSHA256: part.checksumSHA256,
          })),
        },
      }),
    );
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.originalsBucket,
        Key: key,
        UploadId: uploadId,
      }),
    );
  }

  async headOriginal(key: string) {
    return this.client.send(
      new HeadObjectCommand({
        Bucket: this.originalsBucket,
        Key: key,
        ChecksumMode: 'ENABLED',
      }),
    );
  }

  async originalPrefix(key: string, bytes = 32): Promise<Uint8Array> {
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: this.originalsBucket,
        Key: key,
        Range: `bytes=0-${bytes - 1}`,
      }),
    );
    if (!result.Body) return new Uint8Array();
    return result.Body.transformToByteArray();
  }

  async readOriginal(key: string): Promise<Uint8Array> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.originalsBucket, Key: key }),
    );
    if (!result.Body) throw new Error('Object body is missing');
    return result.Body.transformToByteArray();
  }

  async readDerivative(key: string): Promise<Uint8Array> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.derivativesBucket, Key: key }),
    );
    if (!result.Body) throw new Error('Derivative body is missing');
    return result.Body.transformToByteArray();
  }

  async originalStream(key: string): Promise<Readable> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.originalsBucket, Key: key }),
    );
    if (!result.Body || typeof (result.Body as Readable).pipe !== 'function')
      throw new Error('Object body is not a readable stream');
    return result.Body as Readable;
  }

  async putDerivative(key: string, body: Uint8Array, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.derivativesBucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'private, max-age=3600',
      }),
    );
  }

  async signedReadUrl(key: string, derivative = true): Promise<string> {
    return getSignedUrl(
      this.browserClient,
      new GetObjectCommand({
        Bucket: derivative ? this.derivativesBucket : this.originalsBucket,
        Key: key,
      }),
      { expiresIn: this.urlTtlSeconds },
    );
  }

  async signedDownloadUrl(key: string, filename: string): Promise<string> {
    const safeName = filename.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 160);
    return getSignedUrl(
      this.browserClient,
      new GetObjectCommand({
        Bucket: this.originalsBucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${safeName}"`,
      }),
      { expiresIn: Math.min(this.urlTtlSeconds, 120) },
    );
  }

  async signedDerivativeDownloadUrl(key: string, filename: string): Promise<string> {
    const safeName = filename.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 160);
    return getSignedUrl(
      this.browserClient,
      new GetObjectCommand({
        Bucket: this.derivativesBucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${safeName}"`,
      }),
      { expiresIn: Math.min(this.urlTtlSeconds, 120) },
    );
  }

  async putDerivativeStream(key: string, body: Readable, contentType: string): Promise<void> {
    await new Upload({
      client: this.client,
      params: {
        Bucket: this.derivativesBucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'private, no-store',
      },
      queueSize: 2,
      partSize: 5 * 1024 * 1024,
    }).done();
  }

  async deleteObjects(keys: Array<{ key: string; derivative: boolean }>): Promise<void> {
    for (const derivative of [false, true]) {
      const selected = keys.filter((item) => item.derivative === derivative);
      if (!selected.length) continue;
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: derivative ? this.derivativesBucket : this.originalsBucket,
          Delete: { Objects: selected.map((item) => ({ Key: item.key })), Quiet: true },
        }),
      );
    }
  }
}
