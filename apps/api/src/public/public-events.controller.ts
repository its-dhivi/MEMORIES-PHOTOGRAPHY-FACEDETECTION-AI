import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { PublicEventsService } from './public-events.service';

@ApiTags('public events')
@Controller('public/events')
export class PublicEventsController {
  constructor(private readonly events: PublicEventsService) {}

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get safe public event landing-page metadata' })
  get(@Param('slug') slug: string) {
    return this.events.get(slug);
  }
}
