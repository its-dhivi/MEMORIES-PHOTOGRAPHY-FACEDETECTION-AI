import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(request: Request, _response: Response, next: NextFunction): void {
    const cookies = request.cookies as Record<string, string | undefined> | undefined;
    if (SAFE_METHODS.has(request.method) || !cookies?.access_token) return next();
    const cookieToken = cookies.csrf_token;
    const headerToken = request.header('x-csrf-token');
    if (!cookieToken || !headerToken) throw new ForbiddenException('Invalid CSRF token');
    const left = Buffer.from(cookieToken);
    const right = Buffer.from(headerToken);
    if (left.length !== right.length || !timingSafeEqual(left, right))
      throw new ForbiddenException('Invalid CSRF token');
    next();
  }
}
