import type { NetworkStatus } from '../../types/component';
import './Overview.css';

interface OverviewProps {
  registeredCount: number | null;
  networkStatus: NetworkStatus;
  loading?: boolean;
}

const networkLabel: Record<NetworkStatus, string> = {
  connected:    'Connected',
  connecting:   'Connecting…',
  disconnected: 'Disconnected',
};

export function Overview({ registeredCount, networkStatus, loading }: OverviewProps) {
  return (
    <section className="overview-section" aria-label="System overview">
      <p className="overview-section-title">System Overview</p>

      <div className="overview-grid">
        {/* Registered components metric */}
        <div className="overview-card">
          <span className="overview-card-label">Registered Components</span>
          {loading ? (
            <span className="overview-card-value muted">—</span>
          ) : registeredCount !== null ? (
            <span className="overview-card-value">{registeredCount}</span>
          ) : (
            <span className="overview-card-value muted">—</span>
          )}
          <span className="overview-card-sub">on the Fabric ledger</span>
        </div>

        {/* Fabric network status */}
        <div className="overview-card">
          <span className="overview-card-label">Fabric Network</span>
          <div className={`overview-network-status ${networkStatus}`}>
            <span className={`status-dot ${networkStatus}`} aria-hidden="true" />
            {networkLabel[networkStatus]}
          </div>
          <span className="overview-card-sub">Channel: mychannel</span>
        </div>

        {/* Day 1 scope */}
        <div className="overview-card">
          <span className="overview-card-label">Day 1 Scope</span>
          <div className="overview-card-value muted" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, lineHeight: 1.4 }}>
            Component<br />Registration
          </div>
          <span className="overview-card-sub">Manufacturer → Ledger</span>
        </div>
      </div>
    </section>
  );
}
