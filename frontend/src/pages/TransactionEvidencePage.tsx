import { useState } from 'react';
import { useProvenanceHistory } from '../hooks/useLifecycleAction';
import type { ProvenanceEvent } from '../types/provenance';

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function TransactionEvidenceTable({ events }: { events: ProvenanceEvent[] }) {
  return (
    <div className="panel-body flush">
      <table className="data-table" aria-label="Fabric transaction evidence">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Lifecycle Event</th>
            <th>Transaction ID</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event, index) => (
            <tr key={`fabric-tx-${event.eventType}-${index}`}>
              <td className="col-mono">{formatDate(event.timestamp)}</td>
              <td>
                <span style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  {event.eventType}
                </span>
              </td>
              <td className="col-mono" style={{
                fontSize: 'var(--text-xs)',
                wordBreak: 'break-all',
              }}>
                {event.txId || 'Not available'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TransactionEvidencePage() {
  const [searchInput, setSearchInput] = useState('');
  const [loadedID, setLoadedID] = useState('');
  const history = useProvenanceHistory();

  const handleLoad = () => {
    const componentID = searchInput.trim();
    if (!componentID) return;

    setLoadedID(componentID);
    void history.fetch(componentID);
  };

  const transactionCount = history.events.filter(event => Boolean(event.txId)).length;

  return (
    <div>
      <div className="page-heading">
        <h1>Fabric Transaction Evidence</h1>
        <p>
          Read-only transaction evidence associated with a component's
          blockchain-recorded lifecycle events.
        </p>
      </div>

      <div style={{
        display: 'flex',
        gap: 'var(--space-3)',
        alignItems: 'flex-end',
        marginBottom: 'var(--space-6)',
      }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label className="form-label" htmlFor="transaction-evidence-search">
            Component ID
          </label>
          <input
            id="transaction-evidence-search"
            type="text"
            className="form-input mono"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleLoad();
            }}
            placeholder="e.g. BMS-2026-001"
          />
        </div>

        <button
          className="btn btn-primary"
          style={{ height: 40, marginTop: 20 }}
          disabled={!searchInput.trim() || history.loading}
          onClick={handleLoad}
          id="btn-load-transaction-evidence"
        >
          {history.loading
            ? <><span className="spinner spinner-sm spinner-white" /> Loading…</>
            : 'Load Evidence'}
        </button>

        {history.events.length > 0 && (
          <button
            className="btn btn-ghost"
            style={{ height: 40, marginTop: 20 }}
            onClick={history.clear}
          >
            Clear
          </button>
        )}
      </div>

      <div className="panel">
        {loadedID && (
          <div className="panel-header">
            <div>
              <span className="panel-title">
                Transaction Evidence — {loadedID}
              </span>
              <div style={{
                marginTop: 'var(--space-1)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
              }}>
                Transaction IDs captured from the component history returned by Hyperledger Fabric.
              </div>
            </div>
            {history.events.length > 0 && (
              <span style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
              }}>
                {transactionCount} / {history.events.length} transactions
              </span>
            )}
          </div>
        )}

        {history.loading && (
          <div className="loading-row" role="status" aria-live="polite">
            <span className="spinner" aria-hidden="true" />
            Querying transaction evidence from the Fabric ledger…
          </div>
        )}

        {history.errorMessage && (
          <div className="panel-body">
            <div className="alert alert-error" role="alert">
              <span className="alert-icon">✕</span>
              <div className="alert-body">
                <div className="alert-title">Failed to Load Evidence</div>
                <div className="alert-message">{history.errorMessage}</div>
              </div>
            </div>
          </div>
        )}

        {!history.loading && !history.errorMessage && history.events.length === 0 && !loadedID && (
          <div className="empty-state">
            <p className="empty-state-title">No component loaded</p>
            <p className="empty-state-desc">
              Enter a component ID to display its Fabric transaction evidence.
            </p>
          </div>
        )}

        {!history.loading && !history.errorMessage && history.events.length === 0 && loadedID && (
          <div className="empty-state">
            <p className="empty-state-title">No transaction evidence</p>
            <p className="empty-state-desc">
              No provenance transactions were returned for {loadedID}.
            </p>
          </div>
        )}

        {history.events.length > 0 && (
          <TransactionEvidenceTable events={history.events} />
        )}
      </div>
    </div>
  );
}
