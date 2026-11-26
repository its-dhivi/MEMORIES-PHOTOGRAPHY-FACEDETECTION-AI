import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UploadInitDto } from './photos.dto';

describe('professional import validation', () => {
  it('accepts a 500 MiB RAW upload request', async () => {
    const input = plainToInstance(UploadInitDto, {
      filename: 'DSC_0001.NEF',
      mimeType: 'image/x-nikon-nef',
      byteSize: 524_288_000,
      sha256: 'a'.repeat(64),
      idempotencyKey: 'professional-import-0001',
    });
    expect(await validate(input)).toHaveLength(0);
  });

  it('rejects unrecognized upload types', async () => {
    const input = plainToInstance(UploadInitDto, {
      filename: 'payload.exe',
      mimeType: 'application/x-msdownload',
      byteSize: 1,
      sha256: 'a'.repeat(64),
      idempotencyKey: 'professional-import-0002',
    });
    expect((await validate(input)).length).toBeGreaterThan(0);
  });
});
