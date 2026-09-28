import { useEffect } from 'react';
import type { Page } from '../components/AppShell/AppShell';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS, ROLE_PERMISSIONS } from '../types/identity';
import { useSystemOverview } from '../hooks/useComponent';

interface OverviewPageProps {
  onNavigate: (page: Page) => void;
}

export function OverviewPage({ onNavigate }: OverviewPageProps) {
  const { role, fabricIdentity } = useAuth();

  if (!role || !fabricIdentity) {
    throw new Error('OverviewPage requires an operational user.');
  }

  const permissions = ROLE_PERMISSIONS[role];
  const roleLabel = ROLE_LABELS[role];  const overview = useSystemOverview();

  useEffect(() => {
    overview.refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const primaryAction = () => {
    if (permissions.canRegister)  return { label: 'Register Component', page: 'components' as Page };
    if (permissions.canCertify)   return { label: 'Certify Component',  page: 'components' as Page };
    if (permissions.canShip)      return { label: 'Ship Component',      page: 'components' as Page };
    if (permissions.canReceive)   return { label: 'Receive Component',  page: 'components' as Page };
    if (permissions.canTransfer)  return { label: 'Transfer Custody', page: 'components' as Page };
    if (permissions.canAssemble)  return { label: 'Assemble Component', page: 'components' as Page };
    return { label: 'Verify Component', page: 'components' as Page };
  };

  const action = primaryAction();

  const kpis = [
    { label: 'Registered Components', value: overview.loading ? null : overview.registeredCount, sub: 'on the Fabric ledger' },
    { label: 'Assigned Role', value: roleLabel, sub: 'Authorized workflow' },
    { label: 'Fabric Identity', value: fabricIdentity, sub: 'Authenticated ledger identity', isMono: true },
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
            {kpi.value === null ? (
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
        <div className="panel" style={{ border: 'none' }}>
          <div className="panel-header">
            <span className="panel-title">Assigned Workflow</span>
          </div>
          <div className="panel-body">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
              You are signed in as <strong style={{ color: 'var(--text-primary)' }}>{roleLabel}</strong>.
            </p>
            <div style={{
              borderLeft: '3px solid var(--interactive)',
              paddingLeft: 'var(--space-4)',
            }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-placeholder)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                Authorized operation
              </div>
              <div style={{ fontSize: 'var(--text-lg)', color: 'var(--text-primary)', marginTop: 'var(--space-1)', fontWeight: 500 }}>
                {action.label}
              </div>
            </div>
          </div>
        </div>

        <div className="panel" style={{ border: 'none' }}>
          <div className="panel-header">
            <span className="panel-title">Primary Action</span>
          </div>
          <div className="panel-body">
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
              As <strong style={{ color: 'var(--text-primary)' }}>{fabricIdentity}</strong>, your primary workflow is component {action.label.toLowerCase()}.
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
