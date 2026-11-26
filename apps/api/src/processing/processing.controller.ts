import { Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { StudioContextService } from '../common/studio-context.service';
import { ListProcessingJobsDto } from './processing.dto';
import { ProcessingService } from './processing.service';

@ApiTags('processing')
@ApiCookieAuth('access-token')
@Controller('processing')
export class ProcessingController {
  constructor(
    private readonly processing: ProcessingService,
    private readonly studios: StudioContextService,
  ) {}

  @Get('jobs')
  @ApiOperation({ summary: 'List tenant-scoped processing jobs' })
  async jobs(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-studio-id') studio: string | undefined,
    @Query() query: ListProcessingJobsDto,
  ) {
    const membership = await this.studios.resolve(user.id, studio);
    return this.processing.list(membership.studioId, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Return queue counts and worker availability' })
  async stats(@CurrentUser() user: AuthenticatedUser, @Headers('x-studio-id') studio?: string) {
    const membership = await this.studios.resolve(user.id, studio);
    return this.processing.stats(membership.studioId);
  }

  @Post('jobs/:id/retry')
  @ApiOperation({ summary: 'Retry an authorized failed processing job' })
  retry(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.processing.retry(user.id, id);
  }

  @Post('events/:eventId/reindex')
  @ApiOperation({ summary: 'Queue incompatible event photographs for model reindexing' })
  reindex(@CurrentUser() user: AuthenticatedUser, @Param('eventId') eventId: string) {
    return this.processing.reindexEvent(user.id, eventId);
  }
}
