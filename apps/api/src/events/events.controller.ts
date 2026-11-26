import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { StudioContextService } from '../common/studio-context.service';
import {
  CreateEventDto,
  ListEventsDto,
  UpdateEventDto,
  UpdateEventSettingsDto,
} from './events.dto';
import { EventsService } from './events.service';

@ApiTags('events')
@ApiCookieAuth('access-token')
@Controller('events')
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly studios: StudioContextService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List studio events with filters and pagination' })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-studio-id') studioHeader: string | undefined,
    @Query() query: ListEventsDto,
  ) {
    const membership = await this.studios.resolve(user.id, studioHeader);
    return this.events.list(membership.studioId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create an event in the authenticated studio' })
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-studio-id') studioHeader: string | undefined,
    @Body() input: CreateEventDto,
  ) {
    const membership = await this.studios.resolve(user.id, studioHeader);
    return this.events.create(user.id, membership.studioId, input);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an authorized event workspace' })
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.events.get(user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update event information, status, slug, or cover' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: UpdateEventDto,
  ) {
    return this.events.update(user.id, id, input);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Request idempotent event deletion' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.events.remove(user.id, id);
  }

  @Get(':id/settings')
  @ApiOperation({ summary: 'Read event guest, download, and retention settings' })
  settings(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.events.getSettings(user.id, id);
  }

  @Patch(':id/settings')
  @ApiOperation({ summary: 'Update event guest, download, and retention settings' })
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() input: UpdateEventSettingsDto,
  ) {
    return this.events.updateSettings(user.id, id, input);
  }
}
