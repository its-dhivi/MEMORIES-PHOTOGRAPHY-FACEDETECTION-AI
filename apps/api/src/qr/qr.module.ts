import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';

@Module({ imports: [EventsModule], controllers: [QrController], providers: [QrService] })
export class QrModule {}
