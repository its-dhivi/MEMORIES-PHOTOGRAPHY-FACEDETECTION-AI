import { Module } from '@nestjs/common';
import { PublicEventsController } from './public-events.controller';
import { PublicEventsService } from './public-events.service';
import { AiModule } from '../ai/ai.module';
import { GuestSearchController } from './guest-search.controller';
import { GuestSearchService } from './guest-search.service';
import { BullModule } from '@nestjs/bullmq';
import { GuestDownloadCleanupService, GuestDownloadProcessor } from './guest-download.processor';

@Module({
  imports: [AiModule, BullModule.registerQueue({ name: 'guest-downloads' })],
  controllers: [PublicEventsController, GuestSearchController],
  providers: [
    PublicEventsService,
    GuestSearchService,
    GuestDownloadProcessor,
    GuestDownloadCleanupService,
  ],
})
export class PublicModule {}
