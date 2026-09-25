// ============================================================
// Provenance event types for Day 2
// ============================================================

export type ProvenanceEventType =
  | 'MANUFACTURED'
  | 'CERTIFIED'
  | 'SHIPPED'
  | 'RECEIVED'
  | 'TRANSFERRED'
  | 'ASSEMBLED';

// Base event — every event has at minimum these fields
export interface ProvenanceEventBase {
  eventType: ProvenanceEventType;
  timestamp: string;   // ISO 8601
  actor: string;       // identity who performed the action
  txId?: string;
}

export interface ManufacturedEvent extends ProvenanceEventBase {
  eventType: 'MANUFACTURED';
  manufacturer: string;
  location: string;
}

export interface CertifiedEvent extends ProvenanceEventBase {
  eventType: 'CERTIFIED';
  certificateID: string;
  certificationDate: string;
  complianceReference: string;
}

export interface ShippedEvent extends ProvenanceEventBase {
  eventType: 'SHIPPED';
  transporter: string;
  from: string;
  to: string;
  shipmentID: string;
  shipmentDate: string;
}

export interface ReceivedEvent extends ProvenanceEventBase {
  eventType: 'RECEIVED';
  warehouse: string;
  location: string;
  receivedDate: string;
}

export interface TransferredEvent extends ProvenanceEventBase {
  eventType: 'TRANSFERRED';
  from: string;
  to: string;
  location: string;
  transferDate: string;
}

export interface AssembledEvent extends ProvenanceEventBase {
  eventType: 'ASSEMBLED';
  assembler: string;
  assemblyID: string;
  location: string;
}

export type ProvenanceEvent =
  | ManufacturedEvent
  | CertifiedEvent
  | ShippedEvent
  | ReceivedEvent
  | TransferredEvent
  | AssembledEvent;

// Ordered lifecycle stages for the timeline visualization
export const LIFECYCLE_STAGES: ProvenanceEventType[] = [
  'MANUFACTURED',
  'CERTIFIED',
  'SHIPPED',
  'RECEIVED',
  'TRANSFERRED',
  'ASSEMBLED',
];

export type LifecycleStageState = 'completed' | 'current' | 'pending';

export function getStageState(
  stage: ProvenanceEventType,
  currentStatus: string
): LifecycleStageState {
  const currentIndex = LIFECYCLE_STAGES.indexOf(currentStatus as ProvenanceEventType);
  const stageIndex   = LIFECYCLE_STAGES.indexOf(stage);
  if (currentIndex === -1) return stageIndex === 0 ? 'pending' : 'pending';
  if (stageIndex < currentIndex)  return 'completed';
  if (stageIndex === currentIndex) return 'current';
  return 'pending';
}
