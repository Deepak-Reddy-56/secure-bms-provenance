import type { ProvenanceEvent, ManufacturedEvent, CertifiedEvent, ShippedEvent, ReceivedEvent, TransferredEvent, AssembledEvent } from '../../types/provenance';
import './ProvenanceHistory.css';

// ── Helpers ────────────────────────────────────────────────────

function formatDate(isoString: string): string {
  try {
    return new Date(isoString).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="event-field">
      <span className="event-field-label">{label}</span>
      <span className={`event-field-value${mono ? ' mono' : ''}`}>{value}</span>
    </div>
  );
}

// ── Per-event renderers ────────────────────────────────────────

function ManufacturedFields({ event }: { event: ManufacturedEvent }) {
  return (
    <div className="event-fields">
      <Field label="Manufacturer" value={event.manufacturer} />
      <Field label="Location"     value={event.location} />
    </div>
  );
}

function CertifiedFields({ event }: { event: CertifiedEvent }) {
  return (
    <div className="event-fields">
      <Field label="Actor"                value={event.actor} />
      <Field label="Certificate ID"       value={event.certificateID} />
      <Field label="Certification Date"   value={formatDate(event.certificationDate)} />
      <Field label="Compliance Reference" value={event.complianceReference} />
    </div>
  );
}

function ShippedFields({ event }: { event: ShippedEvent }) {
  return (
    <div className="event-fields">
      <Field label="Actor"         value={event.actor} />
      <Field label="Transporter"   value={event.transporter} />
      <Field label="From"          value={event.from} />
      <Field label="To"            value={event.to} />
      <Field label="Shipment ID"   value={event.shipmentID} />
      <Field label="Shipment Date" value={formatDate(event.shipmentDate)} />
    </div>
  );
}

function ReceivedFields({ event }: { event: ReceivedEvent }) {
  return (
    <div className="event-fields">
      <Field label="Actor"         value={event.actor} />
      <Field label="Warehouse"     value={event.warehouse} />
      <Field label="Location"      value={event.location} />
      <Field label="Received Date" value={formatDate(event.receivedDate)} />
    </div>
  );
}

function TransferredFields({ event }: { event: TransferredEvent }) {
  return (
    <div className="event-fields">
      <Field label="From"          value={event.from} />
      <Field label="To"            value={event.to} />
      <Field label="Location"      value={event.location} />
      <Field label="Transfer Date" value={formatDate(event.transferDate)} />
    </div>
  );
}

function AssembledFields({ event }: { event: AssembledEvent }) {
  return (
    <div className="event-fields">
      <Field label="Actor"       value={event.actor} />
      <Field label="Assembly ID" value={event.assemblyID} />
      <Field label="Location"    value={event.location} />
    </div>
  );
}

// ── Single event card ─────────────────────────────────────────

const EVENT_ICONS: Record<string, string> = {
  MANUFACTURED: '🏭',
  CERTIFIED:    '✓',
  SHIPPED:      '→',
  RECEIVED:     '↓',
  TRANSFERRED:  '⇄',
  ASSEMBLED:    '⚙',
};

interface ProvenanceEventCardProps {
  event: ProvenanceEvent;
}

export function ProvenanceEventCard({ event }: ProvenanceEventCardProps) {
  return (
    <article className="event-card" aria-label={`${event.eventType} event`}>
      <div className="event-card-header">
        <div className={`event-type-label ${event.eventType}`}>
          <span aria-hidden="true">{EVENT_ICONS[event.eventType] ?? '·'}</span>
          {event.eventType}
        </div>
        <time className="event-timestamp" dateTime={event.timestamp}>
          {formatDate(event.timestamp)}
        </time>
      </div>

      {event.eventType === 'MANUFACTURED' && <ManufacturedFields event={event} />}
      {event.eventType === 'CERTIFIED'    && <CertifiedFields    event={event} />}
      {event.eventType === 'SHIPPED'      && <ShippedFields      event={event} />}
      {event.eventType === 'RECEIVED'     && <ReceivedFields     event={event} />}
      {event.eventType === 'TRANSFERRED'  && <TransferredFields  event={event} />}
      {event.eventType === 'ASSEMBLED'    && <AssembledFields    event={event} />}

      {event.txId && (
        <div className="event-txid">
          <span className="event-txid-label">Transaction ID</span>
          <span className="event-txid-value">{event.txId}</span>
        </div>
      )}
    </article>
  );
}

// ── History list ──────────────────────────────────────────────

interface ProvenanceHistoryProps {
  events: ProvenanceEvent[];
  loading: boolean;
  errorMessage: string | null;
}

export function ProvenanceHistory({ events, loading, errorMessage }: ProvenanceHistoryProps) {
  if (loading) {
    return (
      <div className="history-loading" role="status" aria-live="polite">
        <span className="spinner" aria-hidden="true" />
        Retrieving provenance…
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="alert alert-error" role="alert">
        {errorMessage}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <p className="history-empty" aria-label="No provenance events">
        No provenance history available for this component.
      </p>
    );
  }

  return (
    <div className="provenance-history">
      <p className="history-count">{events.length} event{events.length !== 1 ? 's' : ''} recorded</p>
      {events.map((event, idx) => (
        <ProvenanceEventCard key={`${event.eventType}-${idx}`} event={event} />
      ))}
    </div>
  );
}
