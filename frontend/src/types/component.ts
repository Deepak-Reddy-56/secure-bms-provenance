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

export type ComponentStatus = 'MANUFACTURED' | string;

export interface RegisterComponentPayload {
  componentID: string;
  componentType: string;
  manufacturer: string;
  manufactureDate: string;
  location: string;
}

export type RegistrationState = 'idle' | 'submitting' | 'success' | 'error';
export type SearchState = 'idle' | 'searching' | 'found' | 'not_found' | 'error';

export type NetworkStatus = 'connected' | 'connecting' | 'disconnected';

export interface SystemOverview {
  registeredCount: number | null;
  networkStatus: NetworkStatus;
}
