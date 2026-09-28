import { api } from './api';
import type {
  Component,
  RegisterComponentPayload,
  CertifyComponentPayload,
  ShipComponentPayload,
  ReceiveComponentPayload,
  TransferCustodyPayload,
  AssembleComponentPayload,
  LifecycleActionResult,
} from '../types/component';
import type { ProvenanceEvent } from '../types/provenance';

// ── Day 1 operations ──────────────────────────────────────────

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

// ── Day 2 lifecycle operations ────────────────────────────────

/**
 * Certify a component. Calls POST /api/components/:id/certify
 */
export async function certifyComponent(
  componentID: string,
  payload: CertifyComponentPayload,
  signal?: AbortSignal
): Promise<LifecycleActionResult> {
  const encoded = encodeURIComponent(componentID.trim());
  return api.post<LifecycleActionResult>(
    `/api/components/${encoded}/certify`,
    payload,
    signal
  );
}

/**
 * Ship a component. Calls POST /api/components/:id/ship
 */
export async function shipComponent(
  componentID: string,
  payload: ShipComponentPayload,
  signal?: AbortSignal
): Promise<LifecycleActionResult> {
  const encoded = encodeURIComponent(componentID.trim());
  return api.post<LifecycleActionResult>(
    `/api/components/${encoded}/ship`,
    payload,
    signal
  );
}

/**
 * Receive a component. Calls POST /api/components/:id/receive
 */
export async function receiveComponent(
  componentID: string,
  payload: ReceiveComponentPayload,
  signal?: AbortSignal
): Promise<LifecycleActionResult> {
  const encoded = encodeURIComponent(componentID.trim());
  return api.post<LifecycleActionResult>(
    `/api/components/${encoded}/receive`,
    payload,
    signal
  );
}

/**
 * Transfer custody. Calls POST /api/components/:id/transfer
 */
export async function transferCustody(
  componentID: string,
  payload: TransferCustodyPayload,
  signal?: AbortSignal
): Promise<LifecycleActionResult> {
  const encoded = encodeURIComponent(componentID.trim());
  return api.post<LifecycleActionResult>(
    `/api/components/${encoded}/transfer`,
    payload,
    signal
  );
}

/**
 * Assemble a component. Calls POST /api/components/:id/assemble
 */
export async function assembleComponent(
  componentID: string,
  payload: AssembleComponentPayload,
  signal?: AbortSignal
): Promise<LifecycleActionResult> {
  const encoded = encodeURIComponent(componentID.trim());
  return api.post<LifecycleActionResult>(
    `/api/components/${encoded}/assemble`,
    payload,
    signal
  );
}

/**
 * Retrieve complete provenance history. Calls GET /api/components/:id/history
 */
export async function getComponentHistory(
  componentID: string,
  signal?: AbortSignal
): Promise<ProvenanceEvent[]> {
  const encoded = encodeURIComponent(componentID.trim());
  return api.get<ProvenanceEvent[]>(
    `/api/components/${encoded}/history`,
    signal
  );
}

// ── Utility operations ────────────────────────────────────────

/**
 * Fetch aggregate system overview. Gracefully returns null if endpoint missing.
 */
export async function getSystemOverview(
  signal?: AbortSignal
): Promise<{ registeredCount: number } | null> {
  try {
    return await api.get<{ registeredCount: number }>(
      '/api/overview',
      signal
    );
  } catch {
    return null;
  }
}

import type { FabricHealthResult } from '../types/component';

/**
 * Check the backend/Fabric network health via GET /api/health/fabric.
 */
export async function checkFabricHealth(signal?: AbortSignal): Promise<FabricHealthResult> {
  try {
    return await api.get<FabricHealthResult>('/api/health/fabric', signal);
  } catch (err) {
    return {
      connected: false,
      error: err instanceof Error ? err.message : 'Unable to connect to provenance backend service',
    };
  }
}

/**
 * Legacy boolean check.
 */
export async function checkNetworkHealth(signal?: AbortSignal): Promise<boolean> {
  const result = await checkFabricHealth(signal);
  return result.connected;
}

