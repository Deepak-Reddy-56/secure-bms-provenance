import { api } from './api';

export interface GoogleAuthUser {
  email: string | null;
  name: string | null;
  picture: string | null;
}

export interface GoogleAuthResponse {
  authenticated: boolean;
  user: GoogleAuthUser;
  fabricIdentity: string;
}

export interface GoogleProvisioningResponse {
  error: string;
  provisioningRequired: true;
  sub: string;
  email: string | null;
  name: string | null;
}

export async function authenticateWithGoogle(
  idToken: string
): Promise<GoogleAuthResponse> {
  return api.post<GoogleAuthResponse>(
    '/api/auth/google',
    { idToken }
  );
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