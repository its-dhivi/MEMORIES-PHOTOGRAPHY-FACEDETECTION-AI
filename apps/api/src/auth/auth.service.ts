import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PlatformRole } from '@prisma/client';
import * as argon2 from 'argon2';
import type { Response } from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AccessClaims, MembershipView, RefreshClaims } from './auth.types';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';
const CSRF_COOKIE = 'csrf_token';
const ARGON_OPTIONS: argon2.Options & { type: typeof argon2.argon2id } = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
};

@Injectable()
export class AuthService {
  private readonly dummyPasswordHash = argon2.hash(randomBytes(32), ARGON_OPTIONS);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string, response: Response) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    const passwordHash = user?.passwordHash ?? (await this.dummyPasswordHash);
    const passwordMatches = await argon2.verify(passwordHash, password);
    if (!user || user.disabledAt || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.issueSession(user.id, user.email, user.platformRole, response);
    return this.userView(user.id);
  }

  async refresh(rawToken: string | undefined, response: Response) {
    if (!rawToken) throw new UnauthorizedException('Refresh token required');
    let claims: RefreshClaims;
    try {
      claims = await this.jwt.verifyAsync<RefreshClaims>(rawToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      this.clearCookies(response);
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (claims.type !== 'refresh') throw new UnauthorizedException('Invalid refresh token');
    const tokenHash = this.hash(rawToken);
    const current = await this.prisma.refreshSession.findUnique({
      where: { id: claims.sid },
      include: { user: true },
    });
    if (
      !current ||
      current.tokenHash !== tokenHash ||
      current.expiresAt <= new Date() ||
      current.user.disabledAt
    ) {
      if (current?.revokedAt) {
        await this.prisma.refreshSession.updateMany({
          where: { familyId: claims.family, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      this.clearCookies(response);
      throw new UnauthorizedException('Refresh token expired or reused');
    }
    const nextId = randomUUID();
    const expiresAt = this.refreshExpiry();
    const nextClaims: RefreshClaims = {
      sub: current.userId,
      sid: nextId,
      family: current.familyId,
      type: 'refresh',
    };
    const nextToken = await this.signRefresh(nextClaims);
    await this.prisma.$transaction([
      this.prisma.refreshSession.update({
        where: { id: current.id },
        data: { revokedAt: new Date(), lastUsedAt: new Date(), replacedById: nextId },
      }),
      this.prisma.refreshSession.create({
        data: {
          id: nextId,
          userId: current.userId,
          familyId: current.familyId,
          tokenHash: this.hash(nextToken),
          expiresAt,
        },
      }),
    ]);
    await this.setTokens(
      current.user.id,
      current.user.email,
      current.user.platformRole,
      nextToken,
      response,
    );
    return this.userView(current.userId);
  }

  async logout(rawToken: string | undefined, response: Response): Promise<void> {
    if (rawToken) {
      try {
        const claims = await this.jwt.verifyAsync<RefreshClaims>(rawToken, {
          secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
          ignoreExpiration: true,
        });
        await this.prisma.refreshSession.updateMany({
          where: { id: claims.sid, tokenHash: this.hash(rawToken) },
          data: { revokedAt: new Date() },
        });
      } catch {
        /* cookie is cleared even when malformed */
      }
    }
    this.clearCookies(response);
  }

  async me(userId: string) {
    return this.userView(userId);
  }

  async forgotPassword(email: string): Promise<{ accepted: true; developmentToken?: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user || user.disabledAt) return { accepted: true };
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    const token = randomBytes(32).toString('base64url');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashReset(token),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    return this.config.get<string>('NODE_ENV') === 'development'
      ? { accepted: true, developmentToken: token }
      : { accepted: true };
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashReset(token) },
    });
    if (!record || record.usedAt || record.expiresAt <= new Date())
      throw new UnauthorizedException('Reset token is invalid or expired');
    const passwordHash = await argon2.hash(password, ARGON_OPTIONS);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshSession.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async issueSession(
    userId: string,
    email: string,
    platformRole: PlatformRole,
    response: Response,
  ): Promise<void> {
    const sessionId = randomUUID();
    const familyId = randomUUID();
    const claims: RefreshClaims = {
      sub: userId,
      sid: sessionId,
      family: familyId,
      type: 'refresh',
    };
    const refreshToken = await this.signRefresh(claims);
    await this.prisma.refreshSession.create({
      data: {
        id: sessionId,
        userId,
        familyId,
        tokenHash: this.hash(refreshToken),
        expiresAt: this.refreshExpiry(),
      },
    });
    await this.setTokens(userId, email, platformRole, refreshToken, response);
  }

  private async setTokens(
    userId: string,
    email: string,
    platformRole: PlatformRole,
    refreshToken: string,
    response: Response,
  ): Promise<void> {
    const accessClaims: AccessClaims = { sub: userId, email, platformRole, type: 'access' };
    const accessToken = await this.jwt.signAsync(accessClaims, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<number>('ACCESS_TOKEN_TTL_SECONDS', 900),
    });
    const secure = this.config.get<string>('NODE_ENV') === 'production';
    response.cookie(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: this.config.get<number>('ACCESS_TOKEN_TTL_SECONDS', 900) * 1000,
    });
    response.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: this.config.get<number>('REFRESH_TOKEN_TTL_SECONDS', 2592000) * 1000,
    });
    response.cookie(CSRF_COOKIE, randomBytes(24).toString('base64url'), {
      httpOnly: false,
      secure,
      sameSite: 'lax',
      path: '/',
    });
  }

  private clearCookies(response: Response): void {
    response.clearCookie(ACCESS_COOKIE, { path: '/' });
    response.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    response.clearCookie(CSRF_COOKIE, { path: '/' });
  }

  private async signRefresh(claims: RefreshClaims): Promise<string> {
    return this.jwt.signAsync(claims, {
      secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<number>('REFRESH_TOKEN_TTL_SECONDS', 2592000),
    });
  }
  private refreshExpiry(): Date {
    return new Date(
      Date.now() + this.config.get<number>('REFRESH_TOKEN_TTL_SECONDS', 2592000) * 1000,
    );
  }
  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
  private hashReset(value: string): string {
    return createHash('sha256')
      .update(value)
      .update(this.config.getOrThrow<string>('PASSWORD_RESET_PEPPER'))
      .digest('hex');
  }
  private async userView(userId: string): Promise<{
    id: string;
    email: string;
    displayName: string;
    platformRole: PlatformRole;
    memberships: MembershipView[];
  }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { memberships: { include: { studio: true } } },
    });
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      platformRole: user.platformRole,
      memberships: user.memberships.map((item) => ({
        studioId: item.studioId,
        studioName: item.studio.name,
        role: item.role,
      })),
    };
  }
}
