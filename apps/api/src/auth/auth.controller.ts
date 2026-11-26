import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { ForgotPasswordDto, LoginDto, ResetPasswordDto } from './auth.dto';
import type { AuthenticatedUser } from './auth.types';
import { Public } from './public.decorator';

@ApiTags('authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() input: LoginDto, @Res({ passthrough: true }) response: Response) {
    return this.auth.login(input.email, input.password, response);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    return this.auth.refresh(
      (request.cookies as Record<string, string | undefined> | undefined)?.refresh_token,
      response,
    );
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(
      (request.cookies as Record<string, string | undefined> | undefined)?.refresh_token,
      response,
    );
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(202)
  forgotPassword(@Body() input: ForgotPasswordDto) {
    return this.auth.forgotPassword(input.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(204)
  async resetPassword(@Body() input: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(input.token, input.password);
  }

  @Get('me')
  @ApiCookieAuth('access-token')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }
}
