/**
 * All Day 2 lifecycle action forms:
 *  - CertifyForm
 *  - ShipForm
 *  - ReceiveForm
 *  - TransferForm
 *  - AssembleForm
 *
 * Each form:
 *  1. Takes `onSubmit` callback + state props
 *  2. Does basic client-side validation
 *  3. Shows loading/success/error states
 *  4. Never fakes success — all data comes from the backend response
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { ReactNode } from 'react';
import type { LocationConfig } from '../../types/location';
import { getLocations } from '../../services/locationService';
import type {
  CertifyComponentPayload,
  ShipComponentPayload,
  ReceiveComponentPayload,
  TransferCustodyPayload,
  AssembleComponentPayload,
  ActionState,
  LifecycleActionResult,
} from '../../types/component';
import { StatusBadge } from '../StatusBadge/StatusBadge';
import './ActionFoms.css';

// ── Shared sub-components ────────────────────────────────────

function FormField({
  id, label, type = 'text', value, onChange, placeholder, disabled, readOnly = false, required = true,
}: {
  id: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
  disabled?: boolean; readOnly?: boolean; required?: boolean;
}) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>
        {label}{required && <span className="form-required" aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        className="form-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        aria-required={required}
      />
    </div>
  );
}

interface TxResultPanelProps {
  state: ActionState;
  result: LifecycleActionResult | null;
  errorMessage: string | null;
  isUnauthorized: boolean;
  isInvalidState: boolean;
  operation: string;
  onReset: () => void;
}

export function TxResultPanel({
  state, result, errorMessage, isUnauthorized, isInvalidState,
  operation, onReset,
}: TxResultPanelProps) {
  const { fabricIdentity } = useAuth();
  const actor = fabricIdentity ?? 'Unavailable';

  if (state === 'success' && result) {
    return (
      <div className="tx-result success" role="alert" aria-live="polite">
        <div className="tx-result-header">
          <span aria-hidden="true">✓</span> Transaction Successful
        </div>
        <div className="tx-result-fields">
          <div className="tx-result-field">
            <span className="tx-result-label">Operation</span>
            <span className="tx-result-value">{operation}</span>
          </div>
          <div className="tx-result-field">
            <span className="tx-result-label">Component</span>
            <span className="tx-result-value mono">{result.component.componentID}</span>
          </div>
          <div className="tx-result-field">
            <span className="tx-result-label">Actor</span>
            <span className="tx-result-value mono">{actor}</span>
          </div>
          <div className="tx-result-field">
            <span className="tx-result-label">New Status</span>
            <StatusBadge status={result.component.status} />
          </div>
          {result.txId && (
            <div className="tx-result-field" style={{ gridColumn: '1 / -1' }}>
              <span className="tx-result-label">Transaction ID</span>
              <span className="tx-result-value mono">{result.txId}</span>
            </div>
          )}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onReset}>
          Perform another operation
        </button>
      </div>
    );
  }

  if (state === 'error') {
    if (isUnauthorized) {
      return (
        <div className="tx-result error" role="alert" aria-live="assertive">
          <div className="tx-result-header"><span aria-hidden="true">✗</span> Action Rejected</div>
          <div className="tx-result-fields">
            <div className="tx-result-field">
              <span className="tx-result-label">Identity</span>
              <span className="tx-result-value mono">{actor}</span>
            </div>
            <div className="tx-result-field">
              <span className="tx-result-label">Reason</span>
              <span className="tx-result-value">{errorMessage ?? 'Unauthorized role.'}</span>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onReset}>Dismiss</button>
        </div>
      );
    }
    if (isInvalidState) {
      return (
        <div className="tx-result error" role="alert" aria-live="assertive">
          <div className="tx-result-header"><span aria-hidden="true">✗</span> Invalid Component State</div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '0' }}>
            {errorMessage ?? 'This lifecycle operation is not valid for the component\'s current state.'}
          </p>
          <button className="btn btn-secondary btn-sm" onClick={onReset}>Dismiss</button>
        </div>
      );
    }
    return (
      <div className="tx-result error" role="alert" aria-live="assertive">
        <div className="tx-result-header"><span aria-hidden="true">✗</span> Operation Failed</div>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', margin: '0' }}>
          {errorMessage ?? 'An unexpected error occurred.'}
        </p>
        <button className="btn btn-secondary btn-sm" onClick={onReset}>Dismiss</button>
      </div>
    );
  }

  return null;
}

// ── Shared form wrapper ───────────────────────────────────────

function ActionFormWrapper({
  title, children, state, result, errorMessage, isUnauthorized, isInvalidState,
  operation, onReset,
}: {
  title: ReactNode;
  children: ReactNode;
  state: ActionState;
  result: LifecycleActionResult | null;
  errorMessage: string | null;
  isUnauthorized: boolean;
  isInvalidState: boolean;
  operation: string;
  onReset: () => void;
}) {
  const hasResult = state === 'success' || state === 'error';
  return (
    <div className="action-panel">
      {hasResult ? (
        <TxResultPanel
          state={state} result={result} errorMessage={errorMessage}
          isUnauthorized={isUnauthorized} isInvalidState={isInvalidState}
          operation={operation} onReset={onReset}
        />
      ) : (
        <>
          {title}
          {children}
        </>
      )}
    </div>
  );
}

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

// ── 1. CertifyForm ────────────────────────────────────────────

interface CertifyFormProps {
  componentID: string;
  state: ActionState;
  result: LifecycleActionResult | null;
  errorMessage: string | null;
  isUnauthorized: boolean;
  isInvalidState: boolean;
  onSubmit: (payload: CertifyComponentPayload) => void;
  onReset: () => void;
}

export function CertifyForm({
  componentID, state, result, errorMessage,
  isUnauthorized, isInvalidState, onSubmit, onReset,
}: CertifyFormProps) {
  const { fabricIdentity } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const [certificationDate,   setCertificationDate]   = useState(today);
  const [complianceReference, setComplianceReference] = useState('');

  const isSubmitting = state === 'submitting';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ certificationDate, complianceReference });
  };

  return (
    <ActionFormWrapper
      title={null} state={state} result={result} errorMessage={errorMessage}
      isUnauthorized={isUnauthorized} isInvalidState={isInvalidState}
      operation="Component Certification" onReset={onReset}
    >
      <form className="action-form" onSubmit={handleSubmit} aria-label="Certify component form">
        <div className="action-form-grid">
          <FormField id="cert-component-id" label="Component ID" value={componentID} onChange={() => {}} disabled />
          <FormField id="cert-certifier" label="Certifier" value={fabricIdentity ?? 'Unavailable'} onChange={() => {}} readOnly />
          <FormField
            id="cert-certificate-id"
            label="Certificate ID"
            value={componentID ? `CERT-${componentID}` : ''}
            onChange={() => {}}
            placeholder="Generated automatically from Component ID"
            disabled
          />
          <FormField id="cert-date" label="Certification Date" type="date" value={certificationDate}
            onChange={setCertificationDate} disabled={isSubmitting} />
          <FormField id="cert-compliance" label="Compliance Reference" value={complianceReference}
            onChange={setComplianceReference} placeholder="ISO/EV-BMS-001" disabled={isSubmitting} />
        </div>
        <div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || !componentID || !certificationDate || !complianceReference.trim()}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? 'Submitting transaction…' : 'Certify Component'}
          </button>
        </div>
      </form>
    </ActionFormWrapper>
  );
}

// ── 2. ShipForm ───────────────────────────────────────────────

interface ShipFormProps {
  componentID: string;
  state: ActionState;
  result: LifecycleActionResult | null;
  errorMessage: string | null;
  isUnauthorized: boolean;
  isInvalidState: boolean;
  onSubmit: (payload: ShipComponentPayload) => void;
  onReset: () => void;
}

export function ShipForm({
  componentID, state, result, errorMessage,
  isUnauthorized, isInvalidState, onSubmit, onReset,
}: ShipFormProps) {
  const { fabricIdentity } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const [fromLocationId, setFromLocationId] = useState('');
  const [toLocationId, setToLocationId] = useState('');
  const [shipmentDate, setShipmentDate] = useState(today);
  const [locations, setLocations] = useState<LocationConfig[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState<string | null>(null);

  const isSubmitting = state === 'submitting';

  useEffect(() => {
    let cancelled = false;

    void getLocations()
      .then(items => {
        if (cancelled) return;
        setLocations(items);

        // The exact component origin can be selected from the admin-configured registry.
        if (items.length > 0 && !fromLocationId) {
          setFromLocationId(items[0].id);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setLocationsError(
            err instanceof Error ? err.message : 'Unable to load configured locations.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLocationsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [componentID]);

  const fromLocation = locations.find(item => item.id === fromLocationId);
  const toLocation = locations.find(item => item.id === toLocationId);

  const shipmentID = buildShipmentIdPreview(
    componentID,
    shipmentDate,
    fromLocation?.code || '',
    toLocation?.code || ''
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fromLocationId || !toLocationId || fromLocationId === toLocationId) {
      return;
    }

    onSubmit({ fromLocationId, toLocationId, shipmentDate });
  };

  return (
    <ActionFormWrapper
      title={null} state={state} result={result} errorMessage={errorMessage}
      isUnauthorized={isUnauthorized} isInvalidState={isInvalidState}
      operation="Component Shipment" onReset={onReset}
    >
      <form className="action-form" onSubmit={handleSubmit} aria-label="Ship component form">
        <div className="action-form-grid">
          <FormField id="ship-component-id" label="Component ID" value={componentID} onChange={() => {}} disabled />
          <FormField id="ship-transporter" label="Transporter" value={fabricIdentity ?? 'Unavailable'} onChange={() => {}} readOnly />

          <div className="form-group">
            <label className="form-label" htmlFor="ship-from">From Location <span className="form-required">*</span></label>
            <select
              id="ship-from"
              className="form-input"
              value={fromLocationId}
              onChange={e => setFromLocationId(e.target.value)}
              disabled={isSubmitting || locationsLoading}
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
              value={toLocationId}
              onChange={e => setToLocationId(e.target.value)}
              disabled={isSubmitting || locationsLoading}
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

          <FormField
            id="ship-id"
            label="Shipment ID"
            value={shipmentID}
            onChange={() => {}}
            placeholder="Generated from component, route and shipment date"
            disabled
          />

          <FormField
            id="ship-date"
            label="Shipment Date"
            type="date"
            value={shipmentDate}
            onChange={setShipmentDate}
            disabled={isSubmitting}
          />
        </div>

        {locationsError && (
          <div className="alert alert-error" role="alert">{locationsError}</div>
        )}

        <div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={
              isSubmitting ||
              !fromLocationId ||
              !toLocationId ||
              fromLocationId === toLocationId ||
              !shipmentDate
            }
            aria-busy={isSubmitting}
          >
            {isSubmitting ? 'Submitting transaction…' : 'Ship Component'}
          </button>
        </div>
      </form>
    </ActionFormWrapper>
  );
}

// ── 3. ReceiveForm ────────────────────────────────────────────

interface ReceiveFormProps {
  componentID: string;
  state: ActionState;
  result: LifecycleActionResult | null;
  errorMessage: string | null;
  isUnauthorized: boolean;
  isInvalidState: boolean;
  onSubmit: (payload: ReceiveComponentPayload) => void;
  onReset: () => void;
}

export function ReceiveForm({
  componentID, state, result, errorMessage,
  isUnauthorized, isInvalidState, onSubmit, onReset,
}: ReceiveFormProps) {
  const { fabricIdentity } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const [location,      setLocation]      = useState('');
  const [receivedDate,  setReceivedDate]  = useState(today);

  const isSubmitting = state === 'submitting';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ location, receivedDate });
  };

  return (
    <ActionFormWrapper
      title={null} state={state} result={result} errorMessage={errorMessage}
      isUnauthorized={isUnauthorized} isInvalidState={isInvalidState}
      operation="Component Receipt" onReset={onReset}
    >
      <form className="action-form" onSubmit={handleSubmit} aria-label="Receive component form">
        <div className="action-form-grid">
          <FormField id="recv-component-id" label="Component ID"  value={componentID}  onChange={() => {}} disabled />
          <FormField id="recv-warehouse"    label="Warehouse"     value={fabricIdentity ?? 'Unavailable'} onChange={() => {}} readOnly />
          <FormField id="recv-location"     label="Location"      value={location}     onChange={setLocation}     placeholder="Mysuru" disabled={isSubmitting} />
          <FormField id="recv-date"         label="Received Date" type="date" value={receivedDate} onChange={setReceivedDate} disabled={isSubmitting} />
        </div>
        <div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || !location}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? 'Submitting transaction…' : 'Receive Component'}
          </button>
        </div>
      </form>
    </ActionFormWrapper>
  );
}

// ── 4. TransferForm ───────────────────────────────────────────

interface TransferFormProps {
  componentID: string;
  state: ActionState;
  result: LifecycleActionResult | null;
  errorMessage: string | null;
  isUnauthorized: boolean;
  isInvalidState: boolean;
  onSubmit: (payload: TransferCustodyPayload) => void;
  onReset: () => void;
}

export function TransferForm({
  componentID, state, result, errorMessage,
  isUnauthorized, isInvalidState, onSubmit, onReset,
}: TransferFormProps) {
  const { fabricIdentity } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const [to,            setTo]            = useState('');
  const [location,      setLocation]      = useState('');
  const [transferDate,  setTransferDate]  = useState(today);

  const isSubmitting = state === 'submitting';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ to, location, transferDate });
  };

  return (
    <ActionFormWrapper
      title={null} state={state} result={result} errorMessage={errorMessage}
      isUnauthorized={isUnauthorized} isInvalidState={isInvalidState}
      operation="Custody Transfer" onReset={onReset}
    >
      <form className="action-form" onSubmit={handleSubmit} aria-label="Transfer custody form">
        <div className="action-form-grid">
          <FormField id="xfr-component-id" label="Component ID"    value={componentID} onChange={() => {}} disabled />
          <FormField id="xfr-from"         label="From"            value={fabricIdentity ?? 'Unavailable'} onChange={() => {}} readOnly />
          <FormField id="xfr-to"           label="To"              value={to}          onChange={setTo}          placeholder="assembler1" disabled={isSubmitting} />
          <FormField id="xfr-location"     label="Location"        value={location}    onChange={setLocation}    placeholder="Mysuru" disabled={isSubmitting} />
          <FormField id="xfr-date"         label="Transfer Date"   type="date" value={transferDate} onChange={setTransferDate} disabled={isSubmitting} />
        </div>
        <div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || !to || !location}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? 'Submitting transaction…' : 'Transfer Custody'}
          </button>
        </div>
      </form>
    </ActionFormWrapper>
  );
}

// ── 5. AssembleForm ───────────────────────────────────────────

interface AssembleFormProps {
  componentID: string;
  state: ActionState;
  result: LifecycleActionResult | null;
  errorMessage: string | null;
  isUnauthorized: boolean;
  isInvalidState: boolean;
  onSubmit: (payload: AssembleComponentPayload) => void;
  onReset: () => void;
}

export function AssembleForm({
  componentID, state, result, errorMessage,
  isUnauthorized, isInvalidState, onSubmit, onReset,
}: AssembleFormProps) {
  const { fabricIdentity } = useAuth();
  const [assemblyID,  setAssemblyID]  = useState('');
  const [location,    setLocation]    = useState('');

  const isSubmitting = state === 'submitting';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ assemblyID, location });
  };

  return (
    <ActionFormWrapper
      title={null} state={state} result={result} errorMessage={errorMessage}
      isUnauthorized={isUnauthorized} isInvalidState={isInvalidState}
      operation="Component Assembly" onReset={onReset}
    >
      <form className="action-form" onSubmit={handleSubmit} aria-label="Assemble component form">
        <div className="action-form-grid">
          <FormField id="assy-component-id" label="Component ID" value={componentID} onChange={() => {}} disabled />
          <FormField id="assy-assembler"    label="Assembler"    value={fabricIdentity ?? 'Unavailable'} onChange={() => {}} readOnly />
          <FormField id="assy-id"           label="Assembly ID"  value={assemblyID}  onChange={setAssemblyID}  placeholder="ASSY-001" disabled={isSubmitting} />
          <FormField id="assy-location"     label="Location"     value={location}    onChange={setLocation}    placeholder="Mysuru" disabled={isSubmitting} />
        </div>
        <div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || !assemblyID || !location}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? 'Submitting transaction…' : 'Assemble Component'}
          </button>
        </div>
      </form>
    </ActionFormWrapper>
  );
}
