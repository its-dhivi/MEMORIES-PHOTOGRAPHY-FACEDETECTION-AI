import { Global, Module } from '@nestjs/common';
import { StudioContextService } from './studio-context.service';

@Global()
@Module({ providers: [StudioContextService], exports: [StudioContextService] })
export class CommonModule {}
