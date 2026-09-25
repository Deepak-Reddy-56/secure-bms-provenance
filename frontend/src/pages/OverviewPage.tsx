import { useEffect } from 'react';
import type { NetworkStatus } from '../types/component';
import type { Page } from '../components/AppShell/AppShell';
import { useIdentity } from '../context/IdentityContext';
import { useSystemOverview } from '../hooks/useComponent';

interface OverviewPageProps {
  networkStatus: NetworkStatus;
  onNavigate: (page: Page) => void;
}

const NETWORK_LABELS: Record<NetworkStatus, string> = {
  connected:    'Connected',
  connecting:   'Connecting',
  disconnected: 'Offline',
};

export function OverviewPage({ networkStatus, onNavigate }: OverviewPageProps) {
  const { identity, permissions, roleLabel } = useIdentity();
  const overview = useSystemOverview();

  useEffect(() => {
    overview.refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const primaryAction = () => {
    if (permissions.canRegister)  return { label: 'Register Component', page: 'components' as Page };
    if (permissions.canCertify)   return { label: 'Certify Component',  page: 'components' as Page };
    if (permissions.canShip)      return { label: 'Ship Component',      page: 'components' as Page };
    if (permissions.canReceive)   return { label: 'Receive Component',  page: 'components' as Page };
    if (permissions.canAssemble)  return { label: 'Assemble Component', page: 'components' as Page };
    return { label: 'Verify Component', page: 'components' as Page };
  };

  const action = primaryAction();

  const kpis = [
    { label: 'Registered Components', value: overview.loading ? null : overview.registeredCount, sub: 'on the Fabric ledger' },
    { label: 'Fabric Network', value: NETWORK_LABELS[networkStatus], sub: 'Channel: mychannel', isStatus: true },
    { label: 'Chaincode', value: 'bmsprovenance', sub: 'Active deployment', isMono: true },
    { label: 'Current Identity', value: identity.id, sub: roleLabel, isMono: true },
  ];

  return (
    <div>
      {/* Page heading */}
      <div className="page-heading">
        <h1>Component Provenance</h1>
        <p>Ledger-backed component traceability — Hyperledger Fabric</p>
      </div>

      {/* KPI row */}
      <div className="kpi-row" role="region" aria-label="System metrics">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="kpi-card">
            <span className="kpi-label">{kpi.label}</span>
            {kpi.isStatus ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span className={`network-dot ${networkStatus}`} style={{ width: 8, height: 8 }} aria-hidden="true" />
                <span style={{ fontSize: 'var(--text-xl)', fontWeight: 300, color: 'var(--text-primary)' }}>
                  {kpi.value}
                </span>
              </div>
            ) : kpi.value === null ? (
              <span className="kpi-value muted">—</span>
            ) : (
              <span className={`kpi-value${kpi.isMono ? ' mono' : ''}`}
                style={kpi.isMono ? { fontSize: 'var(--text-lg)', fontWeight: 500 } : undefined}>
                {kpi.value}
              </span>
            )}
            <span className="kpi-sub">{kpi.sub}</span>
          </div>
        ))}
      </div>

      {/* Role context + primary action */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: 'var(--border-subtle)', marginBottom: 'var(--space-8)' }}>
        {/* Role panel */}
        <div className="panel" style={{ border: 'none' }}>
          <div className="panel-header">
            <span className="panel-title">Current Role — {roleLabel}</span>
          </div>
          <div className="panel-body">
            <div className="permission-list" aria-label="Role permissions">
              {[
                { label: 'Register Component',  allowed: permissions.canRegister  },
                { label: 'Certify Component',   allowed: permissions.canCertify   },
                { label: 'Ship Component',       allowed: permissions.canShip      },
                { label: 'Receive Component',   allowed: permissions.canReceive   },
                { label: 'Transfer Custody',    allowed: permissions.canTransfer  },
                { label: 'Assemble Component',  allowed: permissions.canAssemble  },
                { label: 'Verify Component',    allowed: true },
                { label: 'View Provenance',     allowed: true },
              ].map(p => (
                <div key={p.label} className="permission-item">
                  <span className={p.allowed ? 'permission-check' : 'permission-cross'} aria-hidden="true">
                    {p.allowed ? '✓' : '×'}
                  </span>
                  <span className={`permission-label${p.allowed ? '' : ' denied'}`}>{p.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Primary action panel */}
        <div className="panel" style={{ border: 'none' }}>
          <div className="panel-header">
            <span className="panel-title">Primary Action</span>
          </div>
          <div className="panel-body">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
              As <strong style={{ color: 'var(--text-primary)' }}>{identity.id}</strong>, your primary workflow is component {action.label.toLowerCase()}.
            </p>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => onNavigate(action.page)}
              id="btn-primary-action"
            >
              {action.label}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => onNavigate('provenance')}
              style={{ marginLeft: 'var(--space-3)' }}
            >
              View Provenance
            </button>
          </div>
        </div>
      </div>

      {/* Lifecycle overview */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Component Lifecycle</span>
          <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('lifecycle')}>
            View Details →
          </button>
        </div>
        <div className="panel-body">
          <div className="lifecycle-tracker" role="list" aria-label="Component lifecycle stages">
            {(['MANUFACTURED','CERTIFIED','SHIPPED','RECEIVED','TRANSFERRED','ASSEMBLED'] as const).map((stage, idx) => (
              <div key={stage} className="lifecycle-step pending" role="listitem">
                <div className="lifecycle-step-marker" aria-hidden="true">
                  {idx + 1}
                </div>
                <div className="lifecycle-step-label">{stage}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-placeholder)', marginTop: 'var(--space-4)' }}>
            Search for a component on the Components page to see its actual lifecycle state.
          </p>
        </div>
      </div>
    </div>
  );
}
