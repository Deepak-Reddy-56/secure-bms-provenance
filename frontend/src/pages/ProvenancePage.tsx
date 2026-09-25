import { useState } from 'react';
import { useIdentity } from '../context/IdentityContext';
import { useProvenanceHistory } from '../hooks/useLifecycleAction';
import type { ProvenanceEvent } from '../types/provenance';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

const EVENT_ICONS: Record<string, string> = {
  MANUFACTURED: 'M', CERTIFIED: '✓', SHIPPED: '→',
  RECEIVED: '↓', TRANSFERRED: '⇄', ASSEMBLED: '⚙',
};

function EventCard({ event }: { event: ProvenanceEvent }) {
  const [expanded, setExpanded] = useState(false);

  const fields: { label: string; value: string }[] = [];

  if (event.eventType === 'MANUFACTURED') {
    fields.push({ label: 'Manufacturer', value: (event as any).manufacturer });
    fields.push({ label: 'Location',     value: (event as any).location });
  } else if (event.eventType === 'CERTIFIED') {
    fields.push({ label: 'Actor',       value: (event as any).actor });
    fields.push({ label: 'Certificate', value: (event as any).certificateID });
    fields.push({ label: 'Compliance',  value: (event as any).complianceReference });
    fields.push({ label: 'Date',        value: formatDate((event as any).certificationDate) });
  } else if (event.eventType === 'SHIPPED') {
    fields.push({ label: 'Transporter', value: (event as any).transporter });
    fields.push({ label: 'From',        value: (event as any).from });
    fields.push({ label: 'To',          value: (event as any).to });
    fields.push({ label: 'Shipment ID', value: (event as any).shipmentID });
  } else if (event.eventType === 'RECEIVED') {
    fields.push({ label: 'Warehouse',   value: (event as any).warehouse });
    fields.push({ label: 'Location',    value: (event as any).location });
    fields.push({ label: 'Date',        value: formatDate((event as any).receivedDate) });
  } else if (event.eventType === 'TRANSFERRED') {
    fields.push({ label: 'From',     value: (event as any).from });
    fields.push({ label: 'To',       value: (event as any).to });
    fields.push({ label: 'Location', value: (event as any).location });
  } else if (event.eventType === 'ASSEMBLED') {
    fields.push({ label: 'Assembler',   value: (event as any).actor || (event as any).assembler });
    fields.push({ label: 'Assembly ID', value: (event as any).assemblyID });
    fields.push({ label: 'Location',    value: (event as any).location });
  }

  return (
    <div
      className={`prov-event${expanded ? ' expanded' : ''}`}
      onClick={() => setExpanded(e => !e)}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpanded(x => !x); }}
      aria-expanded={expanded}
      aria-label={`${event.eventType} event on ${formatDate(event.timestamp)}`}
    >
      <div className={`prov-event-dot ${event.eventType}`} aria-hidden="true">
        {EVENT_ICONS[event.eventType] ?? '·'}
      </div>
      <div className="prov-event-content">
        <div className="prov-event-header">
          <span className={`prov-event-type ${event.eventType}`}>{event.eventType}</span>
          <span className="prov-event-date">{formatDate(event.timestamp)}</span>
        </div>
        {fields.length > 0 && (
          <div className="prov-event-fields">
            {fields.slice(0, expanded ? fields.length : Math.min(2, fields.length)).map(f => (
              <div key={f.label}>
                <div className="prov-event-field-label">{f.label}</div>
                <div className="prov-event-field-value">{f.value}</div>
              </div>
            ))}
          </div>
        )}
        {expanded && event.txId && (
          <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--border-subtle)' }}>
            <div className="prov-event-field-label">Transaction ID</div>
            <div className="prov-event-txid">{event.txId}</div>
          </div>
        )}
        <div style={{ marginTop: 'var(--space-2)', fontSize: 10, color: 'var(--text-placeholder)' }}>
          {expanded ? 'Click to collapse' : 'Click to expand'}
        </div>
      </div>
    </div>
  );
}

export function ProvenancePage() {
  const { identity } = useIdentity();
  const [searchInput, setSearchInput] = useState('');
  const [loadedID,    setLoadedID]    = useState('');
  const history = useProvenanceHistory();

  const handleLoad = () => {
    if (!searchInput.trim()) return;
    setLoadedID(searchInput.trim());
    history.fetch(searchInput.trim(), identity.id);
  };

  return (
    <div>
      <div className="page-heading">
        <h1>Provenance History</h1>
        <p>Full audit trail of a component's blockchain-recorded lifecycle events.</p>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 'var(--space-8)' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label" htmlFor="prov-search">Component ID</label>
          <input id="prov-search" type="text" className="form-input mono"
            value={searchInput} onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleLoad(); }}
            placeholder="e.g. BMS-2026-001" />
        </div>
        <button className="btn btn-primary" style={{ height: 40, marginTop: 20 }}
          disabled={!searchInput.trim() || history.loading}
          onClick={handleLoad} id="btn-load-provenance">
          {history.loading ? <><span className="spinner spinner-sm spinner-white" /> Loading…</> : 'Load History'}
        </button>
        {history.events.length > 0 && (
          <button className="btn btn-ghost" style={{ height: 40, marginTop: 20 }} onClick={history.clear}>Clear</button>
        )}
      </div>

      {/* Timeline panel */}
      <div className="panel">
        {loadedID && (
          <div className="panel-header">
            <span className="panel-title">Provenance — {loadedID}</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              {history.events.length > 0 ? `${history.events.length} events` : ''}
            </span>
          </div>
        )}

        <div className="panel-body">
          {history.loading && (
            <div className="loading-row" role="status" aria-live="polite">
              <span className="spinner" aria-hidden="true" />
              Querying provenance ledger…
            </div>
          )}

          {history.errorMessage && (
            <div className="alert alert-error" role="alert">
              <span className="alert-icon">✕</span>
              <div className="alert-body">
                <div className="alert-title">Failed to Load History</div>
                <div className="alert-message">{history.errorMessage}</div>
              </div>
            </div>
          )}

          {!history.loading && !history.errorMessage && history.events.length === 0 && !loadedID && (
            <div className="empty-state">
              <p className="empty-state-title">No component loaded</p>
              <p className="empty-state-desc">Enter a component ID above to load its provenance trail from the Fabric ledger.</p>
            </div>
          )}

          {!history.loading && !history.errorMessage && history.events.length === 0 && loadedID && (
            <div className="empty-state">
              <p className="empty-state-title">No provenance events</p>
              <p className="empty-state-desc">No events have been recorded for {loadedID}.</p>
            </div>
          )}

          {history.events.length > 0 && (
            <div className="prov-timeline" aria-label="Provenance timeline">
              {history.events.map((event, idx) => (
                <EventCard key={`${event.eventType}-${idx}`} event={event} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
