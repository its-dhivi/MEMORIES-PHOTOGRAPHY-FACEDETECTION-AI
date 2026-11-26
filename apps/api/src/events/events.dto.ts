import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsObject,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { EventStatus, EventType } from '@prisma/client';

export class ListEventsDto {
  @IsOptional() @IsString() @Length(1, 100) search?: string;
  @IsOptional() @IsEnum(EventStatus) status?: EventStatus;
  @IsOptional() @IsEnum(EventType) type?: EventType;
  @IsOptional() @IsIn(['asc', 'desc']) sort: 'asc' | 'desc' = 'desc';
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 20;
}

export class CreateEventDto {
  @IsString() @Length(1, 180) title!: string;
  @IsEnum(EventType) type!: EventType;
  @IsOptional() @IsString() @Length(0, 5000) description?: string;
  @IsDateString() eventDate!: string;
  @IsOptional() @IsString() @Length(0, 240) location?: string;
  @IsString()
  @Length(3, 120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must contain lowercase words and hyphens',
  })
  publicSlug!: string;
}

export class UpdateEventDto {
  @IsOptional() @IsString() @Length(1, 180) title?: string;
  @IsOptional() @IsEnum(EventType) type?: EventType;
  @IsOptional() @IsString() @Length(0, 5000) description?: string;
  @IsOptional() @IsDateString() eventDate?: string;
  @IsOptional() @IsString() @Length(0, 240) location?: string;
  @IsOptional() @IsEnum(EventStatus) status?: EventStatus;
  @IsOptional() @IsUUID() coverPhotoId?: string;
  @IsOptional()
  @IsString()
  @Length(3, 120)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  publicSlug?: string;
}

export class UpdateEventSettingsDto {
  @IsOptional() @IsBoolean() accessEnabled?: boolean;
  @IsOptional() @IsString() @Length(4, 32) accessPin?: string;
  @IsOptional() @IsBoolean() clearAccessPin?: boolean;
  @IsOptional() @IsDateString() accessExpiresAt?: string;
  @IsOptional() @IsBoolean() downloadsEnabled?: boolean;
  @IsOptional() @IsBoolean() downloadAllEnabled?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650) retentionDays?: number;
}

export class ApproveMatchingDto {
  @IsNumber() @Min(0) @Max(1) threshold!: number;
  @IsString() @Length(1, 80) modelVersion!: string;
  @IsString() @Length(1, 80) preprocessingVersion!: string;
  @IsString() @Length(1, 120) source!: string;
  @IsObject() evaluationResults!: Record<string, unknown>;
  @IsOptional() @IsString() @Length(64, 64) evidenceSignature?: string;
}
