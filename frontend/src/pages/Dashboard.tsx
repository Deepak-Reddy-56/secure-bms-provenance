import { useEffect, useState, useCallback } from 'react';
import { useIdentity } from '../context/IdentityContext';
import { useRegistration, useComponentSearch, useSystemOverview } from '../hooks/useComponent';
import { useLifecycleAction, useProvenanceHistory } from '../hooks/useLifecycleAction';
import { Overview } from '../components/Overview/Overview';
import { ComponentRegistration } from '../components/ComponentRegistration/ComponentRegistration';
import { ComponentSearch } from '../components/ComponentSearch/ComponentSearch';
import { LifecycleTimeline } from '../components/LifecycleTimeline/LifecycleTimeline';
import { ProvenanceHistory } from '../components/ProvenanceHistory/ProvenanceHistory';
import { StatusBadge } from '../components/StatusBadge/StatusBadge';
import {
  CertifyForm, ShipForm, ReceiveForm, TransferForm, AssembleForm,
} from '../components/ActionForms/ActionForms';
import {
  certifyComponent, shipComponent, receiveComponent,
  transferCustody, assembleComponent,
} from '../services/componentService';
import type { NetworkStatus } from '../types/component';
import './Dashboard.css';

interface DashboardProps {
  networkStatus: NetworkStatus;
}

type ActiveTab = 'register' | 'certify' | 'ship' | 'receive' | 'transfer' | 'assemble';

export function Dashboard({ networkStatus }: DashboardProps) {
  const { identity, permissions } = useIdentity();
  const registration  = useRegistration();
  const search        = useComponentSearch();
  const overview      = useSystemOverview();
  const lifecycleAct  = useLifecycleAction();
  const history       = useProvenanceHistory();

  // Determine the default visible tab based on role
  const defaultTab = useCallback((): ActiveTab => {
    if (permissions.canRegister)  return 'register';
    if (permissions.canCertify)   return 'certify';
    if (permissions.canShip)      return 'ship';
    if (permissions.canReceive)   return 'receive';
    if (permissions.canTransfer)  return 'transfer';
    if (permissions.canAssemble)  return 'assemble';
    return 'register';
  }, [permissions]);

  const [activeTab, setActiveTab] = useState<ActiveTab>(defaultTab);

  // When identity changes, reset to the appropriate default tab
  useEffect(() => {
    setActiveTab(defaultTab());
    lifecycleAct.reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity.id]);

  // The "active component" — either freshly found via search or registered
  const activeComponent =
    search.state === 'found' ? search.component :
    registration.state === 'success' ? registration.registeredComponent :
    null;

  // Active component ID for action forms
  const activeComponentID = activeComponent?.componentID ?? '';

  // Fetch history whenever a component is successfully found/registered
  useEffect(() => {
    if (activeComponent?.componentID) {
      history.fetch(activeComponent.componentID, identity.id);
    } else {
      history.clear();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeComponent?.componentID]);

  // Refresh history and search after successful lifecycle action
  useEffect(() => {
    if (lifecycleAct.state === 'success' && activeComponentID) {
      // Re-fetch the component to get updated status
      search.search(activeComponentID);
      history.fetch(activeComponentID, identity.id);
      overview.refresh();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lifecycleAct.state]);

  useEffect(() => {
    overview.refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Build available tabs for the current role
  type TabDef = { id: ActiveTab; label: string; allowed: boolean };
  const allTabs: TabDef[] = [
    { id: 'register',  label: 'Register',         allowed: permissions.canRegister  },
    { id: 'certify',   label: 'Certify',           allowed: permissions.canCertify   },
    { id: 'ship',      label: 'Ship',              allowed: permissions.canShip      },
    { id: 'receive',   label: 'Receive',           allowed: permissions.canReceive   },
    { id: 'transfer',  label: 'Transfer Custody',  allowed: permissions.canTransfer  },
    { id: 'assemble',  label: 'Assemble',          allowed: permissions.canAssemble  },
  ];
  const tabs = allTabs.filter(t => t.allowed);

  const isAuditor = identity.role === 'AUDITOR';

  return (
    <main className="page-content" id="main-content">
      {/* System Overview */}
      <Overview
        registeredCount={overview.registeredCount}
        networkStatus={networkStatus}
        loading={overview.loading}
      />

      <div className="dashboard-grid">
        {/* ── Main column ─────────────────────────────── */}
        <div className="dashboard-main">

          {/* Component Search / Verify */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">Component Search &amp; Verification</span>
            </div>
            <div className="section-card-body">
              <ComponentSearch
                state={search.state}
                component={search.component}
                errorMessage={search.errorMessage}
                onSearch={(id) => search.search(id, identity.id)}
                onClear={search.clear}
              />
            </div>
          </div>

          {/* Role Actions — Auditor: read-only notice. Others: action tabs */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">Role Actions</span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                {identity.id} · {identity.role}
              </span>
            </div>
            <div className="section-card-body">
              {isAuditor ? (
                <div className="auditor-banner" role="note" aria-label="Auditor read-only mode">
                  <span className="auditor-banner-icon" aria-hidden="true">🔍</span>
                  <div className="auditor-banner-text">
                    <div className="auditor-banner-title">Auditor Mode</div>
                    <div className="auditor-banner-subtitle">
                      Read-only provenance verification — no state-changing operations available.
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Tab switcher — only show if role has multiple actions */}
                  {tabs.length > 1 && (
                    <div className="role-tabs" role="tablist" aria-label="Available role actions">
                      {tabs.map(tab => (
                        <button
                          key={tab.id}
                          role="tab"
                          aria-selected={activeTab === tab.id}
                          className={`role-tab${activeTab === tab.id ? ' active' : ''}`}
                          onClick={() => { setActiveTab(tab.id); lifecycleAct.reset(); }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Action panels */}
                  {activeTab === 'register' && permissions.canRegister && (
                    <ComponentRegistration
                      state={registration.state}
                      registeredComponent={registration.registeredComponent}
                      errorMessage={registration.errorMessage}
                      isDuplicate={registration.isDuplicate}
                      onRegister={(p) => registration.register(p)}
                      onReset={registration.reset}
                    />
                  )}

                  {activeTab === 'certify' && permissions.canCertify && (
                    <CertifyForm
                      componentID={activeComponentID}
                      identityId={identity.id}
                      state={lifecycleAct.state}
                      result={lifecycleAct.result}
                      errorMessage={lifecycleAct.errorMessage}
                      isUnauthorized={lifecycleAct.isUnauthorized}
                      isInvalidState={lifecycleAct.isInvalidState}
                      onSubmit={(p) => lifecycleAct.execute(
                        (signal) => certifyComponent(activeComponentID, p, signal, identity.id)
                      )}
                      onReset={lifecycleAct.reset}
                    />
                  )}

                  {activeTab === 'ship' && permissions.canShip && (
                    <ShipForm
                      componentID={activeComponentID}
                      identityId={identity.id}
                      state={lifecycleAct.state}
                      result={lifecycleAct.result}
                      errorMessage={lifecycleAct.errorMessage}
                      isUnauthorized={lifecycleAct.isUnauthorized}
                      isInvalidState={lifecycleAct.isInvalidState}
                      onSubmit={(p) => lifecycleAct.execute(
                        (signal) => shipComponent(activeComponentID, p, signal, identity.id)
                      )}
                      onReset={lifecycleAct.reset}
                    />
                  )}

                  {activeTab === 'receive' && permissions.canReceive && (
                    <ReceiveForm
                      componentID={activeComponentID}
                      identityId={identity.id}
                      state={lifecycleAct.state}
                      result={lifecycleAct.result}
                      errorMessage={lifecycleAct.errorMessage}
                      isUnauthorized={lifecycleAct.isUnauthorized}
                      isInvalidState={lifecycleAct.isInvalidState}
                      onSubmit={(p) => lifecycleAct.execute(
                        (signal) => receiveComponent(activeComponentID, p, signal, identity.id)
                      )}
                      onReset={lifecycleAct.reset}
                    />
                  )}

                  {activeTab === 'transfer' && permissions.canTransfer && (
                    <TransferForm
                      componentID={activeComponentID}
                      identityId={identity.id}
                      state={lifecycleAct.state}
                      result={lifecycleAct.result}
                      errorMessage={lifecycleAct.errorMessage}
                      isUnauthorized={lifecycleAct.isUnauthorized}
                      isInvalidState={lifecycleAct.isInvalidState}
                      onSubmit={(p) => lifecycleAct.execute(
                        (signal) => transferCustody(activeComponentID, p, signal, identity.id)
                      )}
                      onReset={lifecycleAct.reset}
                    />
                  )}

                  {activeTab === 'assemble' && permissions.canAssemble && (
                    <AssembleForm
                      componentID={activeComponentID}
                      identityId={identity.id}
                      state={lifecycleAct.state}
                      result={lifecycleAct.result}
                      errorMessage={lifecycleAct.errorMessage}
                      isUnauthorized={lifecycleAct.isUnauthorized}
                      isInvalidState={lifecycleAct.isInvalidState}
                      onSubmit={(p) => lifecycleAct.execute(
                        (signal) => assembleComponent(activeComponentID, p, signal, identity.id)
                      )}
                      onReset={lifecycleAct.reset}
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {/* Provenance History */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">Provenance History</span>
              {activeComponent && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  {activeComponent.componentID}
                </span>
              )}
            </div>
            <div className="section-card-body">
              {!activeComponent ? (
                <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                  Search for a component to view its provenance history.
                </p>
              ) : (
                <ProvenanceHistory
                  events={history.events}
                  loading={history.loading}
                  errorMessage={history.errorMessage}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────── */}
        <aside className="dashboard-sidebar" aria-label="Component details and lifecycle">

          {/* Component Details */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">Component Details</span>
            </div>
            <div className="section-card-body">
              {!activeComponent ? (
                <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>
                  No component loaded.
                </p>
              ) : (
                <div className="component-detail-grid">
                  <div className="component-detail-row">
                    <span className="component-detail-label">Component ID</span>
                    <span className="component-detail-value mono">{activeComponent.componentID}</span>
                  </div>
                  <div className="component-detail-row">
                    <span className="component-detail-label">Type</span>
                    <span className="component-detail-value">{activeComponent.componentType}</span>
                  </div>
                  <div className="component-detail-row">
                    <span className="component-detail-label">Manufacturer</span>
                    <span className="component-detail-value">{activeComponent.manufacturer}</span>
                  </div>
                  <div className="component-detail-row">
                    <span className="component-detail-label">Manufacture Date</span>
                    <span className="component-detail-value">{activeComponent.manufactureDate}</span>
                  </div>
                  <div className="component-detail-row">
                    <span className="component-detail-label">Location</span>
                    <span className="component-detail-value">{activeComponent.location}</span>
                  </div>
                  <div className="component-detail-row">
                    <span className="component-detail-label">Status</span>
                    <StatusBadge status={activeComponent.status} size="large" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Lifecycle Timeline */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">Lifecycle</span>
            </div>
            <div className="section-card-body">
              <LifecycleTimeline currentStatus={activeComponent?.status} />
            </div>
          </div>

          {/* Ledger info */}
          <div className="section-card">
            <div className="section-card-header">
              <span className="section-card-title">Ledger Information</span>
            </div>
            <div className="section-card-body">
              <div className="component-detail-grid">
                <div className="component-detail-row">
                  <span className="component-detail-label">Channel</span>
                  <span className="component-detail-value mono">mychannel</span>
                </div>
                <div className="component-detail-row">
                  <span className="component-detail-label">Chaincode</span>
                  <span className="component-detail-value mono">bmsprovenance</span>
                </div>
                {(registration.registeredComponent?.txId ?? lifecycleAct.result?.txId) && (
                  <div className="component-detail-row">
                    <span className="component-detail-label">Last Tx ID</span>
                    <span className="component-detail-value mono" style={{ wordBreak: 'break-all', fontSize: 'var(--text-xs)' }}>
                      {registration.registeredComponent?.txId ?? lifecycleAct.result?.txId}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
