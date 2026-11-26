import { Controller, Get, Headers } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { StudioContextService } from '../common/studio-context.service';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiCookieAuth('access-token')
@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboard: DashboardService,
    private readonly studios: StudioContextService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Return tenant-scoped dashboard totals' })
  async overview(@CurrentUser() user: AuthenticatedUser, @Headers('x-studio-id') studio?: string) {
    const membership = await this.studios.resolve(user.id, studio);
    return this.dashboard.overview(membership.studioId);
  }

  @Get('recent-events')
  @ApiOperation({ summary: 'Return recent tenant-scoped events' })
  async recent(@CurrentUser() user: AuthenticatedUser, @Headers('x-studio-id') studio?: string) {
    const membership = await this.studios.resolve(user.id, studio);
    return this.dashboard.recentEvents(membership.studioId);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Return efficient PostgreSQL dashboard aggregates' })
  async analytics(@CurrentUser() user: AuthenticatedUser, @Headers('x-studio-id') studio?: string) {
    const membership = await this.studios.resolve(user.id, studio);
    return this.dashboard.analytics(membership.studioId);
  }
}
