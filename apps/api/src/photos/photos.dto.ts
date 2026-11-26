import { Type } from 'class-transformer';
import {
  IsEnum,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PhotoStatus } from '@prisma/client';

export class ListPhotosDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 40;
  @IsOptional() @IsEnum(PhotoStatus) status?: PhotoStatus;
}

export class UploadInitDto {
  @IsString() @Length(1, 255) filename!: string;
  @IsString()
  @IsIn([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/x-canon-cr2',
    'image/x-canon-cr3',
    'image/x-nikon-nef',
    'image/x-sony-arw',
    'image/x-adobe-dng',
    'image/x-fuji-raf',
    'application/octet-stream',
  ])
  mimeType!: string;
  @Type(() => Number) @IsInt() @Min(1) byteSize!: number;
  @IsString() @Matches(/^[a-f0-9]{64}$/) sha256!: string;
  @IsString() @Length(8, 128) idempotencyKey!: string;
}

export class UploadCompleteDto {
  @IsString() @Length(8, 128) uploadSessionId!: string;
  @IsOptional() @IsArray() parts?: CompletedUploadPartDto[];
}

export class CompletedUploadPartDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) partNumber!: number;
  @IsString() @Length(1, 200) etag!: string;
  @IsOptional() @IsString() @Length(44, 44) checksumSHA256?: string;
}

export class UploadPartUrlDto {
  @IsUUID() uploadSessionId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(10000) partNumber!: number;
  @IsString() @Length(44, 44) checksumSHA256!: string;
}
