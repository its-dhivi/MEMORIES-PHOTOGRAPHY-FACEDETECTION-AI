import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AccessTokenStrategy } from './access-token.strategy';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { StudioAccessService } from './studio-access.service';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, AccessTokenStrategy, StudioAccessService],
  exports: [StudioAccessService],
})
export class AuthModule {}
