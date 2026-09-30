import { api } from './api';
import type { LocationConfig } from '../types/location';

export async function getLocations(
  signal?: AbortSignal
): Promise<LocationConfig[]> {
  const response = await api.get<{ locations: LocationConfig[] }>(
    '/api/locations',
    signal
  );

  return response.locations;
}

export async function getAdminLocations(
  signal?: AbortSignal
): Promise<LocationConfig[]> {
  const response = await api.get<{ locations: LocationConfig[] }>(
    '/api/admin/locations',
    signal
  );

  return response.locations;
}

export async function createAdminLocation(
  payload: { name: string; code: string; pincode: string },
  signal?: AbortSignal
): Promise<LocationConfig> {
  const response = await api.post<{ location: LocationConfig }>(
    '/api/admin/locations',
    payload,
    signal
  );

  return response.location;
}

export async function updateAdminLocationStatus(
  id: string,
  active: boolean,
  signal?: AbortSignal
): Promise<LocationConfig> {
  const response = await api.put<{ location: LocationConfig }>(
    '/api/admin/locations/' + encodeURIComponent(id) + '/status',
    { active },
    signal
  );

  return response.location;
}
