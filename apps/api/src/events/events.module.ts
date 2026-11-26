import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { AiModule } from '../ai/ai.module';
import { PrivateMatchingController } from './private-matching.controller';
import { PrivateMatchingService } from './private-matching.service';

@Module({
  imports: [AuthModule, AiModule, BullModule.registerQueue({ name: 'event-deletion' })],
  controllers: [EventsController, PrivateMatchingController],
  providers: [EventsService, PrivateMatchingService],
  exports: [EventsService],
})
export class EventsModule {}
