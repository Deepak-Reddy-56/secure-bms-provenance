import { useState } from 'react';
import { useIdentity } from '../context/IdentityContext';
import { useToast } from '../context/ToastContext';
import { useComponentSearch, useRegistration } from '../hooks/useComponent';
import { useLifecycleAction } from '../hooks/useLifecycleAction';
import type { ComponentStatus } from '../types/component';
import type { RegisterComponentPayload } from '../types/component';
import {
  certifyComponent, shipComponent, receiveComponent,
  transferCustody, assembleComponent,
} from '../services/componentService';

// ── Status badge ───────────────────────────────────────────────

function StatusBadge({ status }: { status: ComponentStatus }) {
  const labels: Record<string, string> = {
    MANUFACTURED: 'Manufactured', CERTIFIED: 'Certified', SHIPPED: 'Shipped',
    RECEIVED: 'Received', TRANSFERRED: 'Transferred', ASSEMBLED: 'Assembled',
  };
  return (
    <span className={`status-badge ${status}`} aria-label={`Status: ${labels[status] ?? status}`}>
      <span className={`status-dot ${status}`} aria-hidden="true" />
      {labels[status] ?? status}
    </span>
  );
}

// ── Confirmation modal ─────────────────────────────────────────

interface ConfirmModalProps {
  title: string;
  componentID: string;
  actor: string;
  fromStatus?: string;
  toStatus?: string;
  fields: { label: string; value: string }[];
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function ConfirmModal({ title, componentID, actor, fromStatus, toStatus, fields, onConfirm, onCancel, loading }: ConfirmModalProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title" id="modal-title">{title}</h2>
          <button className="modal-close" onClick={onCancel} aria-label="Close" disabled={loading}>×</button>
        </div>
        <div className="modal-body">
          <div className="confirm-detail-grid" style={{ marginBottom: 'var(--space-5)' }}>
            <span className="confirm-detail-label">Component</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 'var(--text-sm)' }}>{componentID}</span>
            <span className="confirm-detail-label">Actor</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>{actor}</span>
            {fields.map(f => (
              <>
                <span key={f.label + '-l'} className="confirm-detail-label">{f.label}</span>
                <span key={f.label + '-v'} style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>{f.value}</span>
              </>
            ))}
          </div>
          {fromStatus && toStatus && (
            <div className="confirm-transition">
              <StatusBadge status={fromStatus as ComponentStatus} />
              <span className="confirm-transition-arrow">→</span>
              <StatusBadge status={toStatus as ComponentStatus} />
            </div>
          )}
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: 'var(--space-3)' }}>
            This action will be recorded permanently on the Hyperledger Fabric ledger and cannot be undone.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading}
            id="btn-confirm-action"
          >
            {loading ? <><span className="spinner spinner-sm spinner-white" aria-hidden="true" /> Submitting…</> : `Confirm ${title}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Form field helper ─────────────────────────────────────────

function Field({ id, label, type = 'text', value, onChange, placeholder, disabled, required = true }: {
  id: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
  disabled?: boolean; required?: boolean;
}) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>
        {label}{required && <span className="form-required" aria-hidden="true"> *</span>}
      </label>
      <input id={id} type={type} className={`form-input${type === 'text' && id.includes('id') ? ' mono' : ''}`}
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        disabled={disabled} required={required} />
    </div>
  );
}

// ── Action forms ───────────────────────────────────────────────

type ActionTab = 'register' | 'certify' | 'ship' | 'receive' | 'transfer' | 'assemble';

export function ComponentsPage() {
  const { identity, permissions } = useIdentity();
  const { addToast } = useToast();
  const search      = useComponentSearch();
  const registration = useRegistration();
  const action       = useLifecycleAction();

  const [searchInput,  setSearchInput]  = useState('');
  const [activeTab,    setActiveTab]    = useState<ActionTab>(
    permissions.canRegister ? 'register' :
    permissions.canCertify  ? 'certify'  :
    permissions.canShip     ? 'ship'     :
    permissions.canReceive  ? 'receive'  :
    permissions.canAssemble ? 'assemble' : 'register'
  );
  const [confirmData,  setConfirmData]  = useState<null | (() => void)>(null);
  const [confirmProps, setConfirmProps] = useState<Omit<ConfirmModalProps, 'onConfirm' | 'onCancel' | 'loading'> | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const activeID = search.component?.componentID ?? '';

  // Register form state
  const [reg, setReg] = useState<RegisterComponentPayload>({
    componentID: '', componentType: '', manufacturer: '', manufactureDate: today, location: '',
  });

  // Certify form state
  const [cert, setCert] = useState({ certificateID: '', certificationDate: today, complianceReference: '' });

  // Ship form state
  const [ship, setShip] = useState({ transporter: identity.id, from: '', to: '', shipmentID: '', shipmentDate: today });

  // Receive form state
  const [recv, setRecv] = useState({ warehouse: identity.id, location: '', receivedDate: today });

  // Transfer form state
  const [xfr, setXfr] = useState({ from: identity.id, to: '', location: '', transferDate: today });

  // Assemble form state
  const [assy, setAssy] = useState({ assembler: identity.id, assemblyID: '', location: '' });

  const handleSearch = () => {
    if (searchInput.trim()) search.search(searchInput.trim(), identity.id);
  };

  const openConfirm = (props: Omit<ConfirmModalProps, 'onConfirm' | 'onCancel' | 'loading'>, fn: () => void) => {
    setConfirmProps(props);
    setConfirmData(() => fn);
  };

  const runConfirmed = async () => {
    if (!confirmData || !confirmProps) return;
    const fn = confirmData;
    setConfirmData(null);
    setConfirmProps(null);
    await fn();
  };

  const handleSuccess = (msg: string) => {
    addToast(msg, 'success');
    if (activeID) search.search(activeID, identity.id); // refresh component
  };

  // ── Tab definitions ───────────────────────────────────────────

  const tabs: { id: ActionTab; label: string; allowed: boolean }[] = ([
    { id: 'register' as ActionTab, label: 'Register',         allowed: permissions.canRegister  },
    { id: 'certify' as ActionTab,  label: 'Certify',           allowed: permissions.canCertify   },
    { id: 'ship' as ActionTab,     label: 'Ship',              allowed: permissions.canShip      },
    { id: 'receive' as ActionTab,  label: 'Receive',           allowed: permissions.canReceive   },
    { id: 'transfer' as ActionTab, label: 'Transfer Custody',  allowed: permissions.canTransfer  },
    { id: 'assemble' as ActionTab, label: 'Assemble',          allowed: permissions.canAssemble  },
  ] as const).filter(t => t.allowed);

  const isAuditor = identity.role === 'AUDITOR';

  return (
    <div>
      {/* ── Search / Verify ── */}
      <div className="verify-area">
        <p className="section-heading">Component Verification</p>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
          Search the Fabric ledger using a component identifier.
        </p>
        <div className="verify-input-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label" htmlFor="verify-input">Component ID</label>
            <input
              id="verify-input"
              type="text"
              className="form-input mono"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="e.g. BMS-2026-001"
              onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
              disabled={search.state === 'searching'}
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSearch}
            disabled={!searchInput.trim() || search.state === 'searching'}
            style={{ height: 40, marginTop: 20 }}
            id="btn-verify-component"
          >
            {search.state === 'searching' ? (
              <><span className="spinner spinner-sm spinner-white" aria-hidden="true" /> Verifying…</>
            ) : 'Verify'}
          </button>
          {search.component && (
            <button className="btn btn-ghost" style={{ height: 40, marginTop: 20 }} onClick={search.clear}>
              Clear
            </button>
          )}
        </div>

        {/* Search result */}
        {search.state === 'found' && search.component && (
          <div className="verify-result" role="region" aria-label="Component details">
            <div className="verify-result-header">
              <div>
                <div className="verify-result-id">{search.component.componentID}</div>
                <div className="verify-result-type">{search.component.componentType}</div>
              </div>
              <StatusBadge status={search.component.status} />
            </div>
            <div className="verify-result-grid">
              {[
                { label: 'Manufacturer',       value: search.component.manufacturer },
                { label: 'Manufacturing Date', value: search.component.manufactureDate },
                { label: 'Location',           value: search.component.location },
                { label: 'Current Status',     value: search.component.status },
              ].map(cell => (
                <div key={cell.label} className="verify-result-cell">
                  <div className="verify-result-cell-label">{cell.label}</div>
                  <div className="verify-result-cell-value">{cell.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {search.state === 'not_found' && (
          <div className="alert alert-error" role="alert" style={{ marginTop: 'var(--space-3)' }}>
            <span className="alert-icon">✕</span>
            <div className="alert-body">
              <div className="alert-title">Component Not Found</div>
              <div className="alert-message">{searchInput} could not be located in the provenance ledger.</div>
            </div>
          </div>
        )}

        {search.state === 'error' && search.errorMessage && (
          <div className="alert alert-error" role="alert" style={{ marginTop: 'var(--space-3)' }}>
            <span className="alert-icon">✕</span>
            <div className="alert-body">
              <div className="alert-title">Verification Failed</div>
              <div className="alert-message">{search.errorMessage}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Role Actions ── */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Role Actions</span>
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
            {identity.id} · {identity.role}
          </span>
        </div>

        {isAuditor ? (
          <div className="panel-body">
            <div className="auditor-banner" role="note">
              <span className="auditor-banner-icon" aria-hidden="true">🔍</span>
              <div>
                <div className="auditor-banner-title">Auditor Mode — Read Only</div>
                <div className="auditor-banner-subtitle">
                  Use the verification area above to inspect component state. No state-changing operations are available to this identity.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Tab bar */}
            {tabs.length > 0 && (
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-subtle)' }} role="tablist">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    style={{
                      padding: 'var(--space-3) var(--space-5)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase' as const,
                      border: 'none',
                      borderBottom: activeTab === tab.id ? '2px solid var(--text-primary)' : '2px solid transparent',
                      background: 'transparent',
                      color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 100ms',
                      marginBottom: -1,
                    }}
                    onClick={() => { setActiveTab(tab.id); action.reset(); }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            <div className="panel-body">
              {/* Success result */}
              {action.state === 'success' && action.result && (
                <div className="tx-success" style={{ marginBottom: 'var(--space-5)' }} role="status">
                  <div className="tx-success-header">
                    <span aria-hidden="true">✓</span> Transaction Successful
                  </div>
                  <div className="tx-grid">
                    <div>
                      <div className="tx-field-label">Component</div>
                      <div className="tx-field-value mono">{action.result.component.componentID}</div>
                    </div>
                    <div>
                      <div className="tx-field-label">New Status</div>
                      <StatusBadge status={action.result.component.status} />
                    </div>
                    <div>
                      <div className="tx-field-label">Actor</div>
                      <div className="tx-field-value mono">{identity.id}</div>
                    </div>
                    {action.result.txId && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div className="tx-field-label">Transaction ID</div>
                        <div className="tx-field-value mono" style={{ fontSize: 10, wordBreak: 'break-all' }}>{action.result.txId}</div>
                      </div>
                    )}
                  </div>
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-4)' }} onClick={action.reset}>
                    Perform Another Operation
                  </button>
                </div>
              )}

              {/* Error result */}
              {action.state === 'error' && (
                <div className="tx-error" style={{ marginBottom: 'var(--space-5)' }} role="alert">
                  <div className="tx-error-header">
                    <span aria-hidden="true">✕</span>
                    {action.isUnauthorized ? 'Unauthorized Action' : action.isInvalidState ? 'Invalid Lifecycle State' : 'Operation Failed'}
                  </div>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                    {action.errorMessage}
                  </p>
                  {action.isUnauthorized && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      Identity: {identity.id} · Role: {identity.role}
                    </div>
                  )}
                  <button className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-3)' }} onClick={action.reset}>
                    Dismiss
                  </button>
                </div>
              )}

              {/* Action forms — only show if not showing result */}
              {action.state !== 'success' && (
                <>
                  {/* ── Register ── */}
                  {activeTab === 'register' && permissions.canRegister && (
                    <div>
                      {registration.state === 'success' && registration.registeredComponent ? (
                        <div className="tx-success" role="status">
                          <div className="tx-success-header"><span>✓</span> Component Registered</div>
                          <div className="tx-grid">
                            <div><div className="tx-field-label">Component ID</div>
                              <div className="tx-field-value mono">{registration.registeredComponent.componentID}</div></div>
                            <div><div className="tx-field-label">Status</div>
                              <StatusBadge status="MANUFACTURED" /></div>
                            <div><div className="tx-field-label">Manufacturer</div>
                              <div className="tx-field-value">{registration.registeredComponent.manufacturer}</div></div>
                            <div><div className="tx-field-label">Type</div>
                              <div className="tx-field-value">{registration.registeredComponent.componentType}</div></div>
                          </div>
                          <button className="btn btn-secondary btn-sm" style={{ marginTop: 'var(--space-4)' }}
                            onClick={() => { registration.reset(); setReg({ componentID: '', componentType: '', manufacturer: '', manufactureDate: today, location: '' }); }}>
                            Register Another
                          </button>
                        </div>
                      ) : (
                        <form onSubmit={e => {
                          e.preventDefault();
                          if (!reg.componentID || !reg.componentType || !reg.manufacturer || !reg.location) return;
                          registration.register({
                            componentID: reg.componentID.trim(), componentType: reg.componentType.trim(),
                            manufacturer: reg.manufacturer.trim(), manufactureDate: reg.manufactureDate, location: reg.location.trim(),
                          });
                        }}>
                          <div className="form-grid">
                            <div className="form-group full-width">
                              <label className="form-label" htmlFor="reg-id">Component ID <span className="form-required">*</span></label>
                              <input id="reg-id" type="text" className="form-input mono" value={reg.componentID}
                                onChange={e => setReg(p => ({ ...p, componentID: e.target.value }))}
                                placeholder="e.g. BMS-2026-001" disabled={registration.state === 'submitting'} />
                            </div>
                            <Field id="reg-type" label="Component Type" value={reg.componentType}
                              onChange={v => setReg(p => ({ ...p, componentType: v }))} placeholder="e.g. BMS Controller"
                              disabled={registration.state === 'submitting'} />
                            <Field id="reg-mfr" label="Manufacturer" value={reg.manufacturer}
                              onChange={v => setReg(p => ({ ...p, manufacturer: v }))} placeholder="e.g. EVTech Manufacturing"
                              disabled={registration.state === 'submitting'} />
                            <Field id="reg-date" label="Manufacturing Date" type="date" value={reg.manufactureDate}
                              onChange={v => setReg(p => ({ ...p, manufactureDate: v }))}
                              disabled={registration.state === 'submitting'} />
                            <Field id="reg-loc" label="Location" value={reg.location}
                              onChange={v => setReg(p => ({ ...p, location: v }))} placeholder="e.g. Bengaluru"
                              disabled={registration.state === 'submitting'} />
                          </div>
                          {registration.state === 'error' && registration.errorMessage && (
                            <div className="alert alert-error" role="alert" style={{ marginTop: 'var(--space-4)' }}>
                              <span className="alert-icon">{registration.isDuplicate ? '⚠' : '✕'}</span>
                              <div className="alert-body">
                                <div className="alert-title">{registration.isDuplicate ? 'Component Already Exists' : 'Registration Failed'}</div>
                                <div className="alert-message">{registration.errorMessage}</div>
                              </div>
                            </div>
                          )}
                          <div style={{ marginTop: 'var(--space-5)' }}>
                            <button type="submit" className="btn btn-primary" id="btn-register"
                              disabled={registration.state === 'submitting' || !reg.componentID || !reg.componentType || !reg.manufacturer || !reg.location}>
                              {registration.state === 'submitting' ?
                                <><span className="spinner spinner-sm spinner-white" /> Registering…</> : 'Register Component'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  {/* ── Certify ── */}
                  {activeTab === 'certify' && permissions.canCertify && (
                    <form onSubmit={e => { e.preventDefault();
                      if (!activeID) { addToast('Search for a component first', 'warning'); return; }
                      openConfirm({
                        title: 'Certify Component', componentID: activeID, actor: identity.id,
                        fromStatus: 'MANUFACTURED', toStatus: 'CERTIFIED',
                        fields: [{ label: 'Certificate ID', value: cert.certificateID }, { label: 'Compliance', value: cert.complianceReference }],
                      }, () => action.execute(sig => certifyComponent(activeID, cert, sig, identity.id))
                        .then(() => handleSuccess(`Component ${activeID} certified successfully`)));
                    }}>
                      <div className="form-grid">
                        <div className="form-group full-width">
                          <label className="form-label">Component ID</label>
                          <input className="form-input mono" value={activeID || searchInput} disabled
                            placeholder="Search for a component above first" />
                        </div>
                        <Field id="cert-id" label="Certificate ID" value={cert.certificateID}
                          onChange={v => setCert(p => ({ ...p, certificateID: v }))} placeholder="CERT-BMS-001" />
                        <Field id="cert-date" label="Certification Date" type="date" value={cert.certificationDate}
                          onChange={v => setCert(p => ({ ...p, certificationDate: v }))} />
                        <Field id="cert-comp" label="Compliance Reference" value={cert.complianceReference}
                          onChange={v => setCert(p => ({ ...p, complianceReference: v }))} placeholder="ISO/EV-BMS-001" />
                      </div>
                      <div style={{ marginTop: 'var(--space-5)' }}>
                        <button type="submit" className="btn btn-primary" id="btn-certify"
                          disabled={!cert.certificateID || !cert.complianceReference}>
                          Certify Component
                        </button>
                      </div>
                    </form>
                  )}

                  {/* ── Ship ── */}
                  {activeTab === 'ship' && permissions.canShip && (
                    <form onSubmit={e => { e.preventDefault();
                      if (!activeID) { addToast('Search for a component first', 'warning'); return; }
                      openConfirm({
                        title: 'Ship Component', componentID: activeID, actor: identity.id,
                        fromStatus: 'CERTIFIED', toStatus: 'SHIPPED',
                        fields: [{ label: 'From', value: ship.from }, { label: 'To', value: ship.to }, { label: 'Shipment ID', value: ship.shipmentID }],
                      }, () => action.execute(sig => shipComponent(activeID, ship, sig, identity.id))
                        .then(() => handleSuccess(`Component ${activeID} shipped`)));
                    }}>
                      <div className="form-grid">
                        <div className="form-group full-width">
                          <label className="form-label">Component ID</label>
                          <input className="form-input mono" value={activeID || searchInput} disabled placeholder="Search for a component above first" />
                        </div>
                        <Field id="ship-trnsp" label="Transporter" value={ship.transporter} onChange={v => setShip(p => ({ ...p, transporter: v }))} />
                        <Field id="ship-from" label="From Location" value={ship.from} onChange={v => setShip(p => ({ ...p, from: v }))} placeholder="Bengaluru" />
                        <Field id="ship-to" label="To Location" value={ship.to} onChange={v => setShip(p => ({ ...p, to: v }))} placeholder="Mysuru" />
                        <Field id="ship-sid" label="Shipment ID" value={ship.shipmentID} onChange={v => setShip(p => ({ ...p, shipmentID: v }))} placeholder="SHIP-001" />
                        <Field id="ship-date" label="Shipment Date" type="date" value={ship.shipmentDate} onChange={v => setShip(p => ({ ...p, shipmentDate: v }))} />
                      </div>
                      <div style={{ marginTop: 'var(--space-5)' }}>
                        <button type="submit" className="btn btn-primary" id="btn-ship" disabled={!ship.from || !ship.to || !ship.shipmentID}>
                          Ship Component
                        </button>
                      </div>
                    </form>
                  )}

                  {/* ── Receive ── */}
                  {activeTab === 'receive' && permissions.canReceive && (
                    <form onSubmit={e => { e.preventDefault();
                      if (!activeID) { addToast('Search for a component first', 'warning'); return; }
                      openConfirm({
                        title: 'Receive Component', componentID: activeID, actor: identity.id,
                        fromStatus: 'SHIPPED', toStatus: 'RECEIVED',
                        fields: [{ label: 'Warehouse', value: recv.warehouse }, { label: 'Location', value: recv.location }],
                      }, () => action.execute(sig => receiveComponent(activeID, recv, sig, identity.id))
                        .then(() => handleSuccess(`Component ${activeID} received`)));
                    }}>
                      <div className="form-grid">
                        <div className="form-group full-width">
                          <label className="form-label">Component ID</label>
                          <input className="form-input mono" value={activeID || searchInput} disabled placeholder="Search for a component above first" />
                        </div>
                        <Field id="recv-wh" label="Warehouse" value={recv.warehouse} onChange={v => setRecv(p => ({ ...p, warehouse: v }))} />
                        <Field id="recv-loc" label="Location" value={recv.location} onChange={v => setRecv(p => ({ ...p, location: v }))} placeholder="Mysuru" />
                        <Field id="recv-date" label="Received Date" type="date" value={recv.receivedDate} onChange={v => setRecv(p => ({ ...p, receivedDate: v }))} />
                      </div>
                      <div style={{ marginTop: 'var(--space-5)' }}>
                        <button type="submit" className="btn btn-primary" id="btn-receive" disabled={!recv.location}>Receive Component</button>
                      </div>
                    </form>
                  )}

                  {/* ── Transfer ── */}
                  {activeTab === 'transfer' && permissions.canTransfer && (
                    <form onSubmit={e => { e.preventDefault();
                      if (!activeID) { addToast('Search for a component first', 'warning'); return; }
                      openConfirm({
                        title: 'Transfer Custody', componentID: activeID, actor: identity.id,
                        fromStatus: 'RECEIVED', toStatus: 'TRANSFERRED',
                        fields: [{ label: 'From', value: xfr.from }, { label: 'To', value: xfr.to }, { label: 'Location', value: xfr.location }],
                      }, () => action.execute(sig => transferCustody(activeID, xfr, sig, identity.id))
                        .then(() => handleSuccess(`Custody transferred for ${activeID}`)));
                    }}>
                      <div className="form-grid">
                        <div className="form-group full-width">
                          <label className="form-label">Component ID</label>
                          <input className="form-input mono" value={activeID || searchInput} disabled placeholder="Search for a component above first" />
                        </div>
                        <Field id="xfr-from" label="From" value={xfr.from} onChange={v => setXfr(p => ({ ...p, from: v }))} />
                        <Field id="xfr-to" label="To" value={xfr.to} onChange={v => setXfr(p => ({ ...p, to: v }))} placeholder="assembler1" />
                        <Field id="xfr-loc" label="Location" value={xfr.location} onChange={v => setXfr(p => ({ ...p, location: v }))} placeholder="Mysuru" />
                        <Field id="xfr-date" label="Transfer Date" type="date" value={xfr.transferDate} onChange={v => setXfr(p => ({ ...p, transferDate: v }))} />
                      </div>
                      <div style={{ marginTop: 'var(--space-5)' }}>
                        <button type="submit" className="btn btn-primary" id="btn-transfer" disabled={!xfr.to || !xfr.location}>Transfer Custody</button>
                      </div>
                    </form>
                  )}

                  {/* ── Assemble ── */}
                  {activeTab === 'assemble' && permissions.canAssemble && (
                    <form onSubmit={e => { e.preventDefault();
                      if (!activeID) { addToast('Search for a component first', 'warning'); return; }
                      openConfirm({
                        title: 'Assemble Component', componentID: activeID, actor: identity.id,
                        fromStatus: 'TRANSFERRED', toStatus: 'ASSEMBLED',
                        fields: [{ label: 'Assembler', value: assy.assembler }, { label: 'Assembly ID', value: assy.assemblyID }, { label: 'Location', value: assy.location }],
                      }, () => action.execute(sig => assembleComponent(activeID, assy, sig, identity.id))
                        .then(() => handleSuccess(`Component ${activeID} assembled`)));
                    }}>
                      <div className="form-grid">
                        <div className="form-group full-width">
                          <label className="form-label">Component ID</label>
                          <input className="form-input mono" value={activeID || searchInput} disabled placeholder="Search for a component above first" />
                        </div>
                        <Field id="assy-asmblr" label="Assembler" value={assy.assembler} onChange={v => setAssy(p => ({ ...p, assembler: v }))} />
                        <Field id="assy-id" label="Assembly ID" value={assy.assemblyID} onChange={v => setAssy(p => ({ ...p, assemblyID: v }))} placeholder="ASSY-001" />
                        <Field id="assy-loc" label="Location" value={assy.location} onChange={v => setAssy(p => ({ ...p, location: v }))} placeholder="Mysuru" />
                      </div>
                      <div style={{ marginTop: 'var(--space-5)' }}>
                        <button type="submit" className="btn btn-primary" id="btn-assemble" disabled={!assy.assemblyID || !assy.location}>Assemble Component</button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Confirmation modal ── */}
      {confirmProps && (
        <ConfirmModal
          {...confirmProps}
          onConfirm={runConfirmed}
          onCancel={() => { setConfirmData(null); setConfirmProps(null); }}
          loading={action.state === 'submitting'}
        />
      )}
    </div>
  );
}
