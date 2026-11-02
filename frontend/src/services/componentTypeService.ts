import { api } from './api';
import type { ComponentTypeConfig } from '../types/componentType';

interface ComponentTypesResponse {
  componentTypes: ComponentTypeConfig[];
}

interface ComponentTypeResponse {
  componentType: ComponentTypeConfig;
}

export async function getComponentTypes(
  signal?: AbortSignal
): Promise<ComponentTypeConfig[]> {
  const response = await api.get<ComponentTypesResponse>(
    '/api/component-types',
    signal
  );
  return response.componentTypes;
}

export async function getAdminComponentTypes(
  signal?: AbortSignal
): Promise<ComponentTypeConfig[]> {
  const response = await api.get<ComponentTypesResponse>(
    '/api/admin/component-types',
    signal
  );
  return response.componentTypes;
}

export async function createAdminComponentType(
  payload: {
    name: string;
    code: string;
    componentNumber: string;
  },
  signal?: AbortSignal
): Promise<ComponentTypeConfig> {
  const response = await api.post<ComponentTypeResponse>(
    '/api/admin/component-types',
    payload,
    signal
  );
  return response.componentType;
}

export async function updateAdminComponentTypeStatus(
  id: string,
  active: boolean,
  signal?: AbortSignal
): Promise<ComponentTypeConfig> {
  const response = await api.put<ComponentTypeResponse>(
    `/api/admin/component-types/${encodeURIComponent(id)}/status`,
    { active },
    signal
  );
  return response.componentType;
}
