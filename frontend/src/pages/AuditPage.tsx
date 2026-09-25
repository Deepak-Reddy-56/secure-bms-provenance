import { useState } from 'react';
import { useIdentity } from '../context/IdentityContext';
import { useProvenanceHistory } from '../hooks/useLifecycleAction';
import type { ProvenanceEvent } from '../types/provenance';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

const ROLE_FOR_EVENT: Record<string, string> = {
  MANUFACTURED: 'MANUFACTURER',
  CERTIFIED:    'CERTIFIER',
  SHIPPED:      'TRANSPORTER',
  RECEIVED:     'WAREHOUSE',
  TRANSFERRED:  'WAREHOUSE',
  ASSEMBLED:    'ASSEMBLER',
};

function eventActor(event: ProvenanceEvent): string {
  const e = event as any;
  return e.actor || e.manufacturer || e.transporter || e.warehouse || '—';
}

export function AuditPage() {
  const { identity } = useIdentity();
  const history = useProvenanceHistory();

  const [searchInput,    setSearchInput]    = useState('');
  const [loadedID,       setLoadedID]       = useState('');
  const [filterEvent,    setFilterEvent]    = useState('');
  const [filterRole,     setFilterRole]     = useState('');

  const handleLoad = () => {
    if (!searchInput.trim()) return;
    setLoadedID(searchInput.trim());
    history.fetch(searchInput.trim(), identity.id);
  };

  // Filter events
  const filteredEvents = history.events.filter(e => {
    if (filterEvent && e.eventType !== filterEvent) return false;
    if (filterRole  && ROLE_FOR_EVENT[e.eventType] !== filterRole) return false;
    return true;
  });

  const eventTypes = Array.from(new Set(history.events.map(e => e.eventType)));

  return (
    <div>
      <div className="page-heading">
        <h1>Audit Log</h1>
        <p>Immutable blockchain record of all provenance events. Query by component identifier.</p>
      </div>

      {/* Search + filters */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
            <label className="form-label" htmlFor="audit-search">Component ID</label>
            <input id="audit-search" type="text" className="form-input mono"
              value={searchInput} onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleLoad(); }}
              placeholder="e.g. BMS-2026-001" />
          </div>
          <button className="btn btn-primary" style={{ height: 40, marginTop: 20 }}
            disabled={!searchInput.trim() || history.loading} onClick={handleLoad} id="btn-audit-search">
            {history.loading ? <><span className="spinner spinner-sm spinner-white" /> Loading…</> : 'Query Ledger'}
          </button>
        </div>

        {history.events.length > 0 && (
          <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div className="audit-filter-group">
              <label className="audit-filter-label" htmlFor="filter-event">Filter by Event</label>
              <select id="filter-event" className="form-input" style={{ height: 32, width: 160 }}
                value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
                <option value="">All Events</option>
                {eventTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="audit-filter-group">
              <label className="audit-filter-label" htmlFor="filter-role">Filter by Role</label>
              <select id="filter-role" className="form-input" style={{ height: 32, width: 160 }}
                value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                <option value="">All Roles</option>
                {['MANUFACTURER','CERTIFIER','TRANSPORTER','WAREHOUSE','ASSEMBLER'].map(r =>
                  <option key={r} value={r}>{r}</option>
                )}
              </select>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 18 }}
              onClick={() => { setFilterEvent(''); setFilterRole(''); }}>
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Audit table */}
      <div className="panel">
        {loadedID && (
          <div className="panel-header">
            <span className="panel-title">Audit Trail — {loadedID}</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              {filteredEvents.length} record{filteredEvents.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {history.loading && (
          <div className="loading-row" role="status">
            <span className="spinner" /> Querying Fabric ledger…
          </div>
        )}

        {history.errorMessage && (
          <div className="panel-body">
            <div className="alert alert-error" role="alert">
              <span className="alert-icon">✕</span>
              <div className="alert-body">
                <div className="alert-title">Query Failed</div>
                <div className="alert-message">{history.errorMessage}</div>
              </div>
            </div>
          </div>
        )}

        {!history.loading && !history.errorMessage && filteredEvents.length === 0 && !loadedID && (
          <div className="empty-state">
            <p className="empty-state-title">No audit records loaded</p>
            <p className="empty-state-desc">Enter a component ID to query its audit trail from the Fabric ledger.</p>
          </div>
        )}

        {!history.loading && filteredEvents.length === 0 && loadedID && !history.errorMessage && (
          <div className="empty-state">
            <p className="empty-state-title">No matching records</p>
            <p className="empty-state-desc">No events found matching the current filters.</p>
          </div>
        )}

        {filteredEvents.length > 0 && (
          <div className="panel-body flush">
            <table className="data-table" aria-label="Audit log">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event</th>
                  <th>Component</th>
                  <th>Actor</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((event, idx) => (
                  <tr key={idx}>
                    <td className="col-mono">{formatDate(event.timestamp)}</td>
                    <td>
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {event.eventType}
                      </span>
                    </td>
                    <td className="col-mono">{loadedID}</td>
                    <td className="col-mono">{eventActor(event)}</td>
                    <td style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {ROLE_FOR_EVENT[event.eventType] ?? '—'}
                    </td>
                    <td>
                      <span className="audit-status SUCCESS">Success</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
