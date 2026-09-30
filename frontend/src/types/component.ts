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
  componentTypeId: string;
  manufacturer: string;
  manufactureDate: string;
  location: string;
}

export interface ComponentVerificationResult {
  verified: boolean;
  verificationStatus: 'COMPONENT VERIFIED' | 'COMPONENT NOT VERIFIED';
  component: Component | null;
  componentID?: string;
  idFormat: {
    valid: boolean;
    status: 'VALID' | 'INVALID_DATE' | 'LEGACY_OR_INVALID';
    message: string;
  };
  typeConfiguration: {
    id: string;
    name: string;
    code: string;
    componentNumber: string;
    active: boolean;
  } | null;
  typeConfigurationStatus:
    | 'REGISTERED'
    | 'UNKNOWN_TYPE_CODE'
    | 'TYPE_NUMBER_MISMATCH'
    | 'NOT_FOUND'
    | 'NOT_CHECKED';
  currentHolder: string | null;
  provenanceAvailable: boolean;
  provenanceEventCount: number;
  provenanceStatus:
    | 'PROVENANCE VALID'
    | 'PROVENANCE INVALID'
    | 'PROVENANCE UNAVAILABLE';
  provenanceCondition:
    | 'VALID'
    | 'INCOMPLETE'
    | 'INCONSISTENT'
    | 'UNAVAILABLE';
}

// ── Day 2 lifecycle action payloads ─────────────────────────

export interface CertifyComponentPayload {
  certificationDate: string;
  complianceReference: string;
}

export interface ShipComponentPayload {
  fromLocationId: string;
  toLocationId: string;
  shipmentDate: string;
}

export interface ReceiveComponentPayload {
  location: string;
  receivedDate: string;
}

export interface TransferCustodyPayload {
  to: string;
  location: string;
  transferDate: string;
}

export interface AssembleComponentPayload {
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

