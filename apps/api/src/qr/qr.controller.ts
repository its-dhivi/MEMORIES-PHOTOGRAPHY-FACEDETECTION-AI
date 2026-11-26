import { Controller, Get, Param } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { QrService } from './qr.service';

@ApiTags('QR codes')
@ApiCookieAuth('access-token')
@Controller('events')
export class QrController {
  constructor(private readonly qr: QrService) {}

  @Get(':id/qr')
  @ApiOperation({ summary: 'Generate branded event QR assets from the configured public URL' })
  generate(@CurrentUser() user: AuthenticatedUser, @Param('id') eventId: string) {
    return this.qr.generate(user.id, eventId);
  }
}
