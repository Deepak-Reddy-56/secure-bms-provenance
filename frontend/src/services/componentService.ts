import { api } from './api';
import type { Component, RegisterComponentPayload } from '../types/component';

/**
 * Register a new component on the Hyperledger Fabric ledger.
 * Calls POST /api/components
 */
export async function registerComponent(
  payload: RegisterComponentPayload,
  signal?: AbortSignal
): Promise<Component> {
  return api.post<Component>('/api/components', payload, signal);
}

/**
 * Retrieve a component from the Hyperledger Fabric ledger by ID.
 * Calls GET /api/components/:componentID
 */
export async function getComponent(
  componentID: string,
  signal?: AbortSignal
): Promise<Component> {
  const encoded = encodeURIComponent(componentID.trim());
  return api.get<Component>(`/api/components/${encoded}`, signal);
}

/**
 * Fetch aggregate system overview data if supported by the backend.
 * Gracefully returns null if the endpoint does not exist.
 */
export async function getSystemOverview(
  signal?: AbortSignal
): Promise<{ registeredCount: number } | null> {
  try {
    return await api.get<{ registeredCount: number }>('/api/overview', signal);
  } catch {
    return null;
  }
}

/**
 * Check the backend/Fabric network health.
 * Returns true if connected, false otherwise.
 */
export async function checkNetworkHealth(
  signal?: AbortSignal
): Promise<boolean> {
  try {
    await api.get('/api/health', signal);
    return true;
  } catch {
    return false;
  }
}
