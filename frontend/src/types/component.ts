// Component domain types for the BMS Provenance system

export interface Component {
  componentID: string;
  componentType: string;
  manufacturer: string;
  manufactureDate: string;
  location: string;
  status: ComponentStatus;
  /** Transaction ID returned by the backend after a successful registration */
  txId?: string;
}

/** Full Day 2 lifecycle status union */
export type ComponentStatus =
  | 'MANUFACTURED'
  | 'CERTIFIED'
  | 'SHIPPED'
  | 'RECEIVED'
  | 'TRANSFERRED'
  | 'ASSEMBLED';

// ── Day 1 payloads ──────────────────────────────────────────

export interface RegisterComponentPayload {
  componentID: string;
  componentType: string;
  manufacturer: string;
  manufactureDate: string;
  location: string;
}

// ── Day 2 lifecycle action payloads ─────────────────────────

export interface CertifyComponentPayload {
  certificateID: string;
  certificationDate: string;
  complianceReference: string;
}

export interface ShipComponentPayload {
  transporter: string;
  from: string;
  to: string;
  shipmentID: string;
  shipmentDate: string;
}

export interface ReceiveComponentPayload {
  warehouse: string;
  location: string;
  receivedDate: string;
}

export interface TransferCustodyPayload {
  from: string;
  to: string;
  location: string;
  transferDate: string;
}

export interface AssembleComponentPayload {
  assembler: string;
  assemblyID: string;
  location: string;
}

// ── Action result from any lifecycle operation ───────────────

export interface LifecycleActionResult {
  component: Component;
  txId?: string;
  message?: string;
}

// ── State machine types ──────────────────────────────────────

export type RegistrationState = 'idle' | 'submitting' | 'success' | 'error';
export type SearchState = 'idle' | 'searching' | 'found' | 'not_found' | 'error';
export type ActionState = 'idle' | 'submitting' | 'success' | 'error';

export type NetworkStatus = 'connected' | 'connecting' | 'disconnected';

export interface FabricHealthResult {
  connected: boolean;
  network?: string;
  chaincode?: string;
  identity?: string;
  error?: string;
  details?: {
    peer?: string;
    mspId?: string;
    orderer?: string;
    channel?: string;
    chaincode?: string;
  };
}

export interface SystemOverview {
  registeredCount: number | null;
  networkStatus: NetworkStatus;
}

