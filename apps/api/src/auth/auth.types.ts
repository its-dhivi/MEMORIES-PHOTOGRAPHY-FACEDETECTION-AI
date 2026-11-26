import type { PlatformRole, StudioRole } from '@prisma/client';
export interface AccessClaims {
  sub: string;
  email: string;
  platformRole: PlatformRole;
  type: 'access';
}
export interface RefreshClaims {
  sub: string;
  sid: string;
  family: string;
  type: 'refresh';
}
export interface AuthenticatedUser {
  id: string;
  email: string;
  platformRole: PlatformRole;
}
export interface MembershipView {
  studioId: string;
  studioName: string;
  role: StudioRole;
}
