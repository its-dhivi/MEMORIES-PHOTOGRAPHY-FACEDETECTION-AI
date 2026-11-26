import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { JobStatus } from '@prisma/client';

export class ListProcessingJobsDto {
  @Type(() => Number) @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize = 30;
  @IsOptional() @IsEnum(JobStatus) status?: JobStatus;
  @IsOptional() @IsUUID() eventId?: string;
}
