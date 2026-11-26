import { ForbiddenException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { CsrfMiddleware } from './csrf.middleware';

function request(overrides: Partial<Request>): Request {
  return { method: 'POST', cookies: {}, header: jest.fn(), ...overrides } as unknown as Request;
}
describe('CsrfMiddleware', () => {
  const middleware = new CsrfMiddleware();
  const response = {} as Response;
  const next: NextFunction = jest.fn();
  it('allows unauthenticated login-style requests', () => {
    middleware.use(request({}), response, next);
    expect(next).toHaveBeenCalled();
  });
  it('rejects authenticated mutations without a matching header', () => {
    expect(() =>
      middleware.use(
        request({ cookies: { access_token: 'jwt', csrf_token: 'token' } }),
        response,
        next,
      ),
    ).toThrow(ForbiddenException);
  });
});
