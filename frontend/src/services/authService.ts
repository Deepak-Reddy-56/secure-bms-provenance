import { api } from './api';
import type { UserRole } from '../types/identity';

export interface GoogleAuthUser {
  email: string | null;
  name: string | null;
  picture: string | null;
}

export interface GoogleAuthResponse {
  authenticated: boolean;
  user: GoogleAuthUser;
  role: UserRole | null;
  fabricIdentity: string | null;
  isAdmin: boolean;
}

export interface GoogleProvisioningResponse {
  error: string;
  provisioningRequired: true;
  sub: string;
  email: string | null;
  name: string | null;
}

export interface CurrentSessionResponse {
  authenticated: boolean;
  user: GoogleAuthUser;
  role: UserRole | null;
  fabricIdentity: string | null;
  isAdmin: boolean;
}

export async function authenticateWithGoogle(
  idToken: string
): Promise<GoogleAuthResponse> {
  return api.post<GoogleAuthResponse>(
    '/api/auth/google',
    { idToken }
  );
}

export async function getCurrentSession(): Promise<CurrentSessionResponse> {
  return api.get<CurrentSessionResponse>('/api/auth/me');
}

export async function logoutFromServer(): Promise<void> {
  await api.post('/api/auth/logout', {});
}

export function isProvisioningResponse(
  value: unknown
): value is GoogleProvisioningResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const data = value as Record<string, unknown>;

  return (
    data.provisioningRequired === true &&
    typeof data.sub === 'string'
  );
}
