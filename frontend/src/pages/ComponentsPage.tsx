import { Fragment, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ROLE_PERMISSIONS } from '../types/identity';
import { useToast } from '../context/ToastContext';
import { useComponentSearch, useRegistration } from '../hooks/useComponent';
import { useLifecycleAction } from '../hooks/useLifecycleAction';
import type { ComponentStatus } from '../types/component';
import type { RegisterComponentPayload } from '../types/component';
import type { ComponentTypeConfig } from '../types/componentType';
import type { LocationConfig } from '../types/location';

interface ComponentsPageProps {
  onViewProvenance?: (componentID: string) => void;
}
import { getComponentTypes } from '../services/componentTypeService';
import { getLocations } from '../services/locationService';
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
              <Fragment key={f.label}>
                <span className="confirm-detail-label">{f.label}</span>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                  {f.value}
                </span>
              </Fragment>
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

function Field({ id, label, type = 'text', value, onChange, placeholder, disabled, readOnly, required = true }: {
  id: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
  disabled?: boolean; readOnly?: boolean; required?: boolean;
}) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>
        {label}{required && <span className="form-required" aria-hidden="true"> *</span>}
      </label>
      <input id={id} type={type} className={`form-input${type === 'text' && id.includes('id') ? ' mono' : ''}`}
        value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        disabled={disabled} readOnly={readOnly} required={required} />
    </div>
  );
}

// ── Action forms ───────────────────────────────────────────────
function buildShipmentIdPreview(
  componentID: string,
  shipmentDate: string,
  fromCode: string,
  toCode: string
): string {
  const match = componentID.trim().toUpperCase().match(/^BMS-([A-Z]{4})-(\\d{2})/);
  if (!match || !shipmentDate || !fromCode || !toCode) {
    return '';
  }

  const [, typeCode, componentNumber] = match;
  const [year, month, day] = shipmentDate.split('-');
  if (!year || !month || !day) {
    return '';
  }

  return `SHIP-${typeCode}-${componentNumber}${day}${month}${year.slice(-2)}-${fromCode}-${toCode}`;
}


type ActionTab = 'register' | 'certify' | 'ship' | 'receive' | 'transfer' | 'assemble';

export function ComponentsPage({ onViewProvenance }: ComponentsPageProps) {
  const { role, fabricIdentity } = useAuth();

  if (!role || !fabricIdentity) {
    throw new Error('ComponentsPage requires an operational user.');
  }

  const permissions = ROLE_PERMISSIONS[role];  const { addToast } = useToast();
  const search = useComponentSearch();
  const registration = useRegistration();
  const action = useLifecycleAction();

  const [searchInput, setSearchInput] = useState('');
  const [activeTab, setActiveTab] = useState<ActionTab>(
    permissions.canRegister ? 'register' :
      permissions.canCertify ? 'certify' :
        permissions.canShip ? 'ship' :
          permissions.canReceive ? 'receive' :
            permissions.canAssemble ? 'assemble' : 'register'
  );
  const [confirmData, setConfirmData] = useState<null | (() => void)>(null);
  const [confirmProps, setConfirmProps] = useState<Omit<ConfirmModalProps, 'onConfirm' | 'onCancel' | 'loading'> | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const activeID = search.component?.componentID ?? '';

  // Register form state
  const [reg, setReg] = useState<RegisterComponentPayload>({
    componentTypeId: '', manufacturer: '', manufactureDate: today, location: '',
  });

  const [componentTypes, setComponentTypes] = useState<ComponentTypeConfig[]>([]);
  const [componentTypesLoading, setComponentTypesLoading] = useState(false);
  const [componentTypesError, setComponentTypesError] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationConfig[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsError, setLocationsError] = useState<string | null>(null);

  useEffect(() => {
    if (!permissions.canRegister) {
      return;
    }

    let cancelled = false;

    setComponentTypesLoading(true);
    setComponentTypesError(null);

    void getComponentTypes()
      .then(types => {
        if (!cancelled) {
          setComponentTypes(types);
          setReg(current => ({
            ...current,
            componentTypeId: current.componentTypeId || types[0]?.id || '',
          }));
        }
      })
      .catch(err => {
        if (!cancelled) {
          setComponentTypesError(
            err instanceof Error
              ? err.message
              : 'Unable to load configured component types.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setComponentTypesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [permissions.canRegister]);

  useEffect(() => {
    if (!permissions.canShip) {
      return;
    }

    let cancelled = false;

    setLocationsLoading(true);
    setLocationsError(null);

    void getLocations()
      .then(items => {
        if (cancelled) return;
        setLocations(items);

        const currentComponentLocation = search.component?.location?.trim().toLowerCase();
        const matchingOrigin = items.find(
          item => item.name.trim().toLowerCase() === currentComponentLocation
        );

        setShip(current => ({
          ...current,
          fromLocationId: current.fromLocationId || matchingOrigin?.id || '',
          toLocationId: current.toLocationId || '',
        }));
      })
      .catch(err => {
        if (!cancelled) {
          setLocationsError(
            err instanceof Error
              ? err.message
              : 'Unable to load configured locations.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLocationsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [permissions.canShip, search.component?.location]);

  // Certify form state
  const [cert, setCert] = useState({ certificationDate: today, complianceReference: '' });

  // Ship form state
  const [ship, setShip] = useState({ fromLocationId: '', toLocationId: '', shipmentDate: today });

  // Receive form state
  const [recv, setRecv] = useState({ location: '', receivedDate: today });

  // Transfer form state
  const [xfr, setXfr] = useState({ to: '', location: '', transferDate: today });

  // Assemble form state
  const [assy, setAssy] = useState({ assemblyID: '', location: '' });

  const handleSearch = () => {
    if (searchInput.trim()) search.search(searchInput.trim());
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
    if (activeID) search.search(activeID); // refresh component
  };

  // ── Tab definitions ───────────────────────────────────────────

  const tabs: { id: ActionTab; label: string; allowed: boolean }[] = ([
    { id: 'register' as ActionTab, label: 'Register', allowed: permissions.canRegister },
    { id: 'certify' as ActionTab, label: 'Certify', allowed: permissions.canCertify },
    { id: 'ship' as ActionTab, label: 'Ship', allowed: permissions.canShip },
    { id: 'receive' as ActionTab, label: 'Receive', allowed: permissions.canReceive },
    { id: 'transfer' as ActionTab, label: 'Transfer Custody', allowed: permissions.canTransfer },
    { id: 'assemble' as ActionTab, label: 'Assemble', allowed: permissions.canAssemble },
  ] as const).filter(t => t.allowed);

  const isAuditor = role === 'AUDITOR';

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
              placeholder="e.g. BMS-MOTH-01300926001"
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
        {search.state === 'found' && search.component && search.verification && (
          <div className="verify-result" role="region" aria-label="Component verification result">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                marginBottom: 'var(--space-4)',
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--success)',
              }}
            >
              <span aria-hidden="true">✓</span>
              {search.verification.verificationStatus}
            </div>
            <div className="verify-result-header">
              <div>
                <div className="verify-result-id">{search.component.componentID}</div>
                <div className="verify-result-type">{search.component.componentType}</div>
              </div>
              <StatusBadge status={search.component.status} />
            </div>
            <div className="verify-result-grid">
              {[
                { label: 'Manufacturer', value: search.component.manufacturer },
                { label: 'Manufacturing Date', value: search.component.manufactureDate },
                { label: 'Location', value: search.component.location },
                { label: 'Current Status', value: search.component.status },
                {
                  label: 'Current Holder',
                  value: search.verification.currentHolder || 'Not recorded',
                },
                {
                  label: 'Verification Status',
                  value: search.verification.verificationStatus,
                },
                {
                  label: 'Provenance Status',
                  value: search.verification.provenanceStatus,
                },
                {
                  label: 'ID Format',
                  value: search.verification.idFormat.valid ? 'Valid' : 'Legacy / Non-standard',
                },
                {
                  label: 'Type Configuration',
                  value:
                    search.verification.typeConfigurationStatus === 'REGISTERED'
                      ? 'Registered'
                      : search.verification.typeConfigurationStatus === 'TYPE_NUMBER_MISMATCH'
                        ? 'Code / number mismatch'
                        : search.verification.idFormat.valid
                          ? 'Not registered'
                          : 'Not applicable to legacy ID',
                },
                {
                  label: 'Provenance',
                  value: search.verification.provenanceAvailable
                    ? `${search.verification.provenanceEventCount} ledger record${search.verification.provenanceEventCount === 1 ? '' : 's'} available`
                    : 'No history returned',
                },
              ].map(cell => (
                <div key={cell.label} className="verify-result-cell">
                  <div className="verify-result-cell-label">{cell.label}</div>
                  <div className="verify-result-cell-value">{cell.value}</div>
                </div>
              ))}
            </div>
            {onViewProvenance && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  padding: 'var(--space-4) var(--space-6)',
                  borderTop: '1px solid var(--border-subtle)',
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => onViewProvenance(search.component!.componentID)}
                >
                  View Provenance
                </button>
              </div>
            )}
          </div>
        )}

        {search.state === 'not_found' && (
          <div className="alert alert-error" role="alert" style={{ marginTop: 'var(--space-3)' }}>
            <span className="alert-icon">✕</span>
            <div className="alert-body">
              <div className="alert-title">Component Not Verified</div>
              <div className="alert-message">
                {search.errorMessage || `${searchInput} could not be verified against the provenance ledger.`}
              </div>
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
            {fabricIdentity} · {role}
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
                      <div className="tx-field-value mono">{fabricIdentity}</div>
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
                    {action.errorMessage === 'Component already assembled.'
  ? 'Component Already Assembled'
  : action.isUnauthorized
    ? 'Unauthorized Action'
    : action.isInvalidState
      ? 'Invalid Lifecycle State'
      : 'Operation Failed'}
                  </div>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                    {action.errorMessage}
                  </p>
                  {action.isUnauthorized && (
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      Identity: {fabricIdentity} · Role: {role}
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
                            <div>
                              <div className="tx-field-label">Component ID</div>
                              <div className="tx-field-value mono">{registration.registeredComponent.componentID}</div>
                            </div>
                            <div>
                              <div className="tx-field-label">Status</div>
                              <StatusBadge status="MANUFACTURED" />
                            </div>
                            <div>
                              <div className="tx-field-label">Manufacturer</div>
                              <div className="tx-field-value">{registration.registeredComponent.manufacturer}</div>
                            </div>
                            <div>
                              <div className="tx-field-label">Type</div>
                              <div className="tx-field-value">{registration.registeredComponent.componentType}</div>
                            </div>
                          </div>
                          <p style={{ marginTop: 'var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                            The Component ID was generated by the server from the administrator-configured type code, component number, manufacture date and next available serial.
                          </p>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ marginTop: 'var(--space-4)' }}
                            onClick={() => {
                              registration.reset();
                              setReg({
                                componentTypeId: componentTypes[0]?.id || '',
                                manufacturer: '',
                                manufactureDate: today,
                                location: '',
                              });
                            }}
                          >
                            Register Another
                          </button>
                        </div>
                      ) : (
                        <form onSubmit={e => {
                          e.preventDefault();

                          if (
                            !reg.componentTypeId ||
                            !reg.manufacturer.trim() ||
                            !reg.manufactureDate ||
                            !reg.location.trim()
                          ) {
                            return;
                          }

                          registration.register({
                            componentTypeId: reg.componentTypeId,
                            manufacturer: reg.manufacturer.trim(),
                            manufactureDate: reg.manufactureDate,
                            location: reg.location.trim(),
                          });
                        }}>
                          <div className="form-grid">
                            <div className="form-group full-width">
                              <label className="form-label" htmlFor="reg-type">
                                Component Type <span className="form-required">*</span>
                              </label>
                              <select
                                id="reg-type"
                                className="form-input"
                                value={reg.componentTypeId}
                                onChange={e => setReg(p => ({ ...p, componentTypeId: e.target.value }))}
                                disabled={registration.state === 'submitting' || componentTypesLoading}
                                required
                              >
                                <option value="">
                                  {componentTypesLoading ? 'Loading component types…' : 'Select component type'}
                                </option>
                                {componentTypes.map(type => (
                                  <option key={type.id} value={type.id}>
                                    {type.name} · {type.code} · {type.componentNumber}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {reg.componentTypeId && (
                              <div className="form-group full-width">
                                <div
                                  style={{
                                    padding: 'var(--space-4)',
                                    border: '1px solid var(--border-subtle)',
                                    background: 'var(--bg-ui)',
                                  }}
                                >
                                  <div style={{
                                    fontSize: 'var(--text-xs)',
                                    fontWeight: 700,
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase',
                                    color: 'var(--text-secondary)',
                                    marginBottom: 'var(--space-2)',
                                  }}>
                                    Component ID Rule
                                  </div>
                                  <div style={{
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: 'var(--text-sm)',
                                    color: 'var(--text-primary)',
                                  }}>
                                    BMS-{componentTypes.find(type => type.id === reg.componentTypeId)?.code ?? 'TYPE'}-{componentTypes.find(type => type.id === reg.componentTypeId)?.componentNumber ?? '00'}[DDMMYY][SERIAL]
                                  </div>
                                  <div style={{
                                    marginTop: 'var(--space-2)',
                                    fontSize: 'var(--text-xs)',
                                    color: 'var(--text-secondary)',
                                  }}>
                                    The serial is assigned automatically starting at 001. The ID is generated after registration and cannot be entered manually.
                                  </div>
                                </div>
                              </div>
                            )}

                            <Field
                              id="reg-mfr"
                              label="Manufacturer"
                              value={reg.manufacturer}
                              onChange={v => setReg(p => ({ ...p, manufacturer: v }))}
                              placeholder="e.g. EVTech Manufacturing"
                              disabled={registration.state === 'submitting'}
                            />
                            <Field
                              id="reg-date"
                              label="Manufacturing Date"
                              type="date"
                              value={reg.manufactureDate}
                              onChange={v => setReg(p => ({ ...p, manufactureDate: v }))}
                              disabled={registration.state === 'submitting'}
                            />
                            <Field
                              id="reg-loc"
                              label="Location"
                              value={reg.location}
                              onChange={v => setReg(p => ({ ...p, location: v }))}
                              placeholder="e.g. Bengaluru"
                              disabled={registration.state === 'submitting'}
                            />
                          </div>

                          {componentTypesError && (
                            <div className="alert alert-error" role="alert" style={{ marginTop: 'var(--space-4)' }}>
                              <span className="alert-icon">✕</span>
                              <div className="alert-body">
                                <div className="alert-title">Component Types Unavailable</div>
                                <div className="alert-message">{componentTypesError}</div>
                              </div>
                            </div>
                          )}

                          {componentTypes.length === 0 && !componentTypesLoading && !componentTypesError && (
                            <div className="alert alert-warning" role="status" style={{ marginTop: 'var(--space-4)' }}>
                              <span className="alert-icon">!</span>
                              <div className="alert-body">
                                <div className="alert-title">No Component Types Configured</div>
                                <div className="alert-message">
                                  An administrator must add and activate at least one component type before components can be registered.
                                </div>
                              </div>
                            </div>
                          )}

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
                            <button
                              type="submit"
                              className="btn btn-primary"
                              id="btn-register"
                              disabled={
                                registration.state === 'submitting' ||
                                componentTypes.length === 0 ||
                                !reg.componentTypeId ||
                                !reg.manufacturer.trim() ||
                                !reg.manufactureDate ||
                                !reg.location.trim()
                              }
                            >
                              {registration.state === 'submitting'
                                ? <><span className="spinner spinner-sm spinner-white" /> Registering…</>
                                : 'Register Component'}
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  {/* ── Certify ── */}
                  {activeTab === 'certify' && permissions.canCertify && (
                    <form onSubmit={e => {
                      e.preventDefault();
                      if (!activeID) { addToast('Search for a component first', 'warning'); return; }
                      const currentStatus = search.component?.status;

                      if (currentStatus !== 'MANUFACTURED') {
                        addToast('Component must be in MANUFACTURED status before certification', 'warning');
                        return;
                      }

                      const generatedCertificateID = `CERT-${activeID}`;

                      openConfirm({
                        title: 'Certify Component', componentID: activeID, actor: fabricIdentity,
                        fromStatus: 'MANUFACTURED', toStatus: 'CERTIFIED',
                        fields: [
                          { label: 'Certificate ID', value: generatedCertificateID },
                          { label: 'Compliance', value: cert.complianceReference },
                        ],
                      }, () => action.execute(sig => certifyComponent(activeID, cert, sig))
                        .then( success => {if (success){handleSuccess(`Component ${activeID} certified successfully`);
                      }
                    }));
                    }}>
                      <div className="form-grid">
                        <div className="form-group full-width">
                          <label className="form-label">Component ID</label>
                          <input className="form-input mono" value={activeID || searchInput} disabled
                            placeholder="Search for a component above first" />
                        </div>
                        <div className="form-group full-width">
                          <label className="form-label" htmlFor="cert-generated-id">
                            Certificate ID
                          </label>
                          <input
                            id="cert-generated-id"
                            type="text"
                            className="form-input mono"
                            value={activeID ? `CERT-${activeID}` : ''}
                            placeholder="Generated automatically from Component ID"
                            readOnly
                          />
                          <div style={{
                            marginTop: 'var(--space-2)',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--text-secondary)',
                          }}>
                            Generated automatically as CERT-&#123;Component ID&#125; and cannot be entered manually.
                          </div>
                        </div>
                        <Field id="cert-date" label="Certification Date" type="date" value={cert.certificationDate}
                          onChange={v => setCert(p => ({ ...p, certificationDate: v }))} />
                        <Field id="cert-comp" label="Compliance Reference" value={cert.complianceReference}
                          onChange={v => setCert(p => ({ ...p, complianceReference: v }))} placeholder="ISO/EV-BMS-001" />
                      </div>
                      <div style={{ marginTop: 'var(--space-5)' }}>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          id="btn-certify"
                          disabled={
                            !search.component ||
                            search.component.status !== 'MANUFACTURED' ||
                            !cert.certificationDate ||
                            !cert.complianceReference.trim()
                          }
                        >
                          Certify Component
                        </button>
                      </div>
                    </form>
                  )}

                  {/* ── Ship ── */}
                  {activeTab === 'ship' && permissions.canShip && (
                    <form onSubmit={e => {
                      e.preventDefault();
                      if (!activeID) { addToast('Search for a component first', 'warning'); return; }

                      const fromLocation = locations.find(item => item.id === ship.fromLocationId);
                      const toLocation = locations.find(item => item.id === ship.toLocationId);

                      if (!fromLocation || !toLocation) {
                        addToast('Select valid origin and destination locations.', 'warning');
                        return;
                      }

                      const shipmentID = buildShipmentIdPreview(
                        activeID,
                        ship.shipmentDate,
                        fromLocation.code,
                        toLocation.code
                      );

                      openConfirm({
                        title: 'Ship Component', componentID: activeID, actor: fabricIdentity,
                        fromStatus: 'CERTIFIED', toStatus: 'SHIPPED',
                        fields: [
                          { label: 'Component', value: search.component?.componentType || activeID },
                          { label: 'Shipment ID', value: shipmentID },
                          { label: 'From', value: fromLocation.name + ' (' + fromLocation.code + ')' },
                          { label: 'To', value: toLocation.name + ' (' + toLocation.code + ')' },
                          { label: 'Shipment Date', value: ship.shipmentDate },
                        ],
                      }, () => action.execute(sig => shipComponent(activeID, ship, sig))
                        .then(success => {if(success){handleSuccess(`Component ${activeID} shipped`);
                        }
                      }));
                    }}>

                      <div className="form-grid">
                        <div className="form-group full-width">
                          <label className="form-label">Component ID</label>
                          <input className="form-input mono" value={activeID || searchInput} disabled placeholder="Search for a component above first" />
                        </div>
                        <Field id="ship-trnsp" label="Transporter" value={fabricIdentity} onChange={() => {}} readOnly />
                        <div className="form-group">
                          <label className="form-label" htmlFor="ship-from">From Location <span className="form-required">*</span></label>
                          <select
                            id="ship-from"
                            className="form-input"
                            value={ship.fromLocationId}
                            onChange={e => setShip(p => ({ ...p, fromLocationId: e.target.value }))}
                            disabled={locationsLoading}
                            required
                          >
                            <option value="">
                              {locationsLoading ? 'Loading locations…' : 'Select origin'}
                            </option>
                            {locations.map(location => (
                              <option key={location.id} value={location.id}>
                                {location.name} · {location.code} · {location.pincode}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="ship-to">To Location <span className="form-required">*</span></label>
                          <select
                            id="ship-to"
                            className="form-input"
                            value={ship.toLocationId}
                            onChange={e => setShip(p => ({ ...p, toLocationId: e.target.value }))}
                            disabled={locationsLoading}
                            required
                          >
                            <option value="">
                              {locationsLoading ? 'Loading locations…' : 'Select destination'}
                            </option>
                            {locations.map(location => (
                              <option key={location.id} value={location.id}>
                                {location.name} · {location.code} · {location.pincode}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group full-width">
                          <label className="form-label" htmlFor="ship-sid">Shipment ID</label>
                          <input
                            id="ship-sid"
                            type="text"
                            className="form-input mono"
                            value={
                              (() => {
                                const fromLocation = locations.find(item => item.id === ship.fromLocationId);
                                const toLocation = locations.find(item => item.id === ship.toLocationId);
                                return buildShipmentIdPreview(
                                  activeID,
                                  ship.shipmentDate,
                                  fromLocation?.code || '',
                                  toLocation?.code || ''
                                );
                              })()
                            }
                            placeholder="Generated from component, route and shipment date"
                            readOnly
                          />
                          <div style={{
                            marginTop: 'var(--space-2)',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--text-secondary)',
                          }}>
                            Generated automatically. Format: SHIP-&#123;TYPE4&#125;-&#123;NUMBER2&#125;&#123;DDMMYY&#125;-&#123;FROM&#125;-&#123;TO&#125;.
                          </div>
                        </div>
                        <Field id="ship-date" label="Shipment Date" type="date" value={ship.shipmentDate} onChange={v => setShip(p => ({ ...p, shipmentDate: v }))} />
                      </div>
                      {locationsError && (
                        <div className="alert alert-error" role="alert" style={{ marginTop: 'var(--space-4)' }}>
                          <span className="alert-icon">✕</span>
                          <div className="alert-body">
                            <div className="alert-title">Locations Unavailable</div>
                            <div className="alert-message">{locationsError}</div>
                          </div>
                        </div>
                      )}
                      <div style={{ marginTop: 'var(--space-5)' }}>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          id="btn-ship"
                          disabled={
                            !ship.fromLocationId ||
                            !ship.toLocationId ||
                            ship.fromLocationId === ship.toLocationId ||
                            !ship.shipmentDate ||
                            locationsLoading ||
                            locations.length < 2
                          }
                        >
                          Ship Component
                        </button>
                      </div>
                    </form>
                  )}

                  {/* ── Receive ── */}
                  {activeTab === 'receive' && permissions.canReceive && (
                    <form onSubmit={e => {
                      e.preventDefault();
                      if (!activeID) { addToast('Search for a component first', 'warning'); return; }
                      openConfirm({
                        title: 'Receive Component', componentID: activeID, actor: fabricIdentity,
                        fromStatus: 'SHIPPED', toStatus: 'RECEIVED',
                        fields: [{ label: 'Warehouse', value: fabricIdentity }, { label: 'Location', value: recv.location }],
                      }, () => action.execute(sig => receiveComponent(activeID, recv, sig))
                        .then(success => { if(success){handleSuccess(`Component ${activeID} received`);
                      }
                    }));

                    }}>
                      <div className="form-grid">
                        <div className="form-group full-width">
                          <label className="form-label">Component ID</label>
                          <input className="form-input mono" value={activeID || searchInput} disabled placeholder="Search for a component above first" />
                        </div>
                        <Field id="recv-wh" label="Warehouse" value={fabricIdentity} onChange={() => {}} readOnly />
                        <Field id="recv-loc" label="Location" value={recv.location} onChange={v => setRecv(p => ({ ...p, location: v }))} placeholder="Mysuru" />
                        <Field id="recv-date" label="Received Date" type="date" value={recv.receivedDate} onChange={v => setRecv(p => ({ ...p, receivedDate: v }))} />
                      </div>
                      <div style={{ marginTop: 'var(--space-5)' }}>
                        <button type="submit" className="btn btn-primary" id="btn-receive" disabled={!recv.location || !search.component ||
  search.component.status !== 'SHIPPED'}>Receive Component</button>
                      </div>
                    </form>
                  )}

                  {/* ── Transfer ── */}
                  {activeTab === 'transfer' && permissions.canTransfer && (
                    <form onSubmit={e => {
                      e.preventDefault();
                      if (!activeID) { addToast('Search for a component first', 'warning'); return; }
                      openConfirm({
                        title: 'Transfer Custody', componentID: activeID, actor: fabricIdentity,
                        fromStatus: 'RECEIVED', toStatus: 'TRANSFERRED',
                        fields: [{ label: 'From', value: fabricIdentity }, { label: 'To', value: xfr.to }, { label: 'Location', value: xfr.location }],
                      }, () => action.execute(sig => transferCustody(activeID, xfr, sig))
                        .then(success => {if(success){handleSuccess(`Custody transferred for ${activeID}`);
                      }
                    }));
                    }}>
                      <div className="form-grid">
                        <div className="form-group full-width">
                          <label className="form-label">Component ID</label>
                          <input className="form-input mono" value={activeID || searchInput} disabled placeholder="Search for a component above first" />
                        </div>
                        <Field id="xfr-from" label="From" value={fabricIdentity} onChange={() => {}} readOnly />
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
                    <form onSubmit={e => {
                      e.preventDefault();
                      if (!activeID) { addToast('Search for a component first', 'warning'); return; }
                      openConfirm({
                        title: 'Assemble Component', componentID: activeID, actor: fabricIdentity,
                        fromStatus: 'TRANSFERRED', toStatus: 'ASSEMBLED',
                        fields: [{ label: 'Assembler', value: fabricIdentity }, { label: 'Assembly ID', value: assy.assemblyID }, { label: 'Location', value: assy.location }],
                      }, () => action.execute(sig => assembleComponent(activeID, assy, sig))
                        .then(success => {if(success) {handleSuccess(`Component ${activeID} assembled`);
                      }
                    }));
                    }}>
                      <div className="form-grid">
                        <div className="form-group full-width">
                          <label className="form-label">Component ID</label>
                          <input className="form-input mono" value={activeID || searchInput} disabled placeholder="Search for a component above first" />
                        </div>
                        <Field id="assy-asmblr" label="Assembler" value={fabricIdentity} onChange={() => {}} readOnly />
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
