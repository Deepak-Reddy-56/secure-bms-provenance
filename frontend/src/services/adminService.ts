import { api } from './api';

export type AdminRole =
  | 'MANUFACTURER'
  | 'CERTIFIER'
  | 'TRANSPORTER'
  | 'WAREHOUSE'
  | 'ASSEMBLER'
  | 'AUDITOR';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  fabricIdentity: string;
  googleSub: string | null;
  active: boolean;
}

interface UsersResponse {
  users: AdminUser[];
}

interface UserResponse {
  user: AdminUser;
}

export const ADMIN_ROLES: AdminRole[] = [
  'MANUFACTURER',
  'CERTIFIER',
  'TRANSPORTER',
  'WAREHOUSE',
  'ASSEMBLER',
  'AUDITOR',
];

export async function getAdminUsers(signal?: AbortSignal): Promise<AdminUser[]> {
  const response = await api.get<UsersResponse>('/api/admin/users', signal);
  return response.users;
}

export async function createAdminUser(
  payload: { email: string; name: string; role: AdminRole },
  signal?: AbortSignal
): Promise<AdminUser> {
  const response = await api.post<UserResponse>('/api/admin/users', payload, signal);
  return response.user;
}

export async function updateAdminUserRole(
  userId: string,
  role: AdminRole,
  signal?: AbortSignal
): Promise<AdminUser> {
  const encoded = encodeURIComponent(userId);
  const response = await api.put<UserResponse>(
    `/api/admin/users/${encoded}/role`,
    { role },
    signal
  );
  return response.user;
}

export async function updateAdminUserStatus(
  userId: string,
  active: boolean,
  signal?: AbortSignal
): Promise<AdminUser> {
  const encoded = encodeURIComponent(userId);
  const response = await api.put<UserResponse>(
    `/api/admin/users/${encoded}/status`,
    { active },
    signal
  );
  return response.user;
}

export async function deleteAdminUser(
  userId: string,
  signal?: AbortSignal
): Promise<AdminUser> {
  const encoded = encodeURIComponent(userId);
  const response = await api.delete<UserResponse>(
    `/api/admin/users/${encoded}`,
    signal
  );
  return response.user;
}
