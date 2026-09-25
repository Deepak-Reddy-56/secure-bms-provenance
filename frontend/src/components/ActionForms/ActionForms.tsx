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

import { useState } from 'react';
import type { ReactNode } from 'react';
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
import './ActionForms.css';

// ── Shared sub-components ────────────────────────────────────

function FormField({
  id, label, type = 'text', value, onChange, placeholder, disabled, required = true,
}: {
  id: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string;
  disabled?: boolean; required?: boolean;
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
  identityId: string;
  onReset: () => void;
}

export function TxResultPanel({
  state, result, errorMessage, isUnauthorized, isInvalidState,
  operation, identityId, onReset,
}: TxResultPanelProps) {
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
            <span className="tx-result-value mono">{identityId}</span>
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
              <span className="tx-result-value mono">{identityId}</span>
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
  operation, identityId, onReset,
}: {
  title: ReactNode;
  children: ReactNode;
  state: ActionState;
  result: LifecycleActionResult | null;
  errorMessage: string | null;
  isUnauthorized: boolean;
  isInvalidState: boolean;
  operation: string;
  identityId: string;
  onReset: () => void;
}) {
  const hasResult = state === 'success' || state === 'error';
  return (
    <div className="action-panel">
      {hasResult ? (
        <TxResultPanel
          state={state} result={result} errorMessage={errorMessage}
          isUnauthorized={isUnauthorized} isInvalidState={isInvalidState}
          operation={operation} identityId={identityId} onReset={onReset}
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

// ── 1. CertifyForm ────────────────────────────────────────────

interface CertifyFormProps {
  componentID: string;
  identityId: string;
  state: ActionState;
  result: LifecycleActionResult | null;
  errorMessage: string | null;
  isUnauthorized: boolean;
  isInvalidState: boolean;
  onSubmit: (payload: CertifyComponentPayload) => void;
  onReset: () => void;
}

export function CertifyForm({
  componentID, identityId, state, result, errorMessage,
  isUnauthorized, isInvalidState, onSubmit, onReset,
}: CertifyFormProps) {
  const today = new Date().toISOString().split('T')[0];
  const [certificateID,       setCertificateID]       = useState('');
  const [certificationDate,   setCertificationDate]   = useState(today);
  const [complianceReference, setComplianceReference] = useState('');

  const isSubmitting = state === 'submitting';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ certificateID, certificationDate, complianceReference });
  };

  return (
    <ActionFormWrapper
      title={null} state={state} result={result} errorMessage={errorMessage}
      isUnauthorized={isUnauthorized} isInvalidState={isInvalidState}
      operation="Component Certification" identityId={identityId} onReset={onReset}
    >
      <form className="action-form" onSubmit={handleSubmit} aria-label="Certify component form">
        <div className="action-form-grid">
          <FormField id="cert-component-id" label="Component ID" value={componentID} onChange={() => {}} disabled />
          <FormField id="cert-certificate-id" label="Certificate ID" value={certificateID}
            onChange={setCertificateID} placeholder="CERT-BMS-001" disabled={isSubmitting} />
          <FormField id="cert-date" label="Certification Date" type="date" value={certificationDate}
            onChange={setCertificationDate} disabled={isSubmitting} />
          <FormField id="cert-compliance" label="Compliance Reference" value={complianceReference}
            onChange={setComplianceReference} placeholder="ISO/EV-BMS-001" disabled={isSubmitting} />
        </div>
        <div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || !certificateID || !complianceReference}
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
  identityId: string;
  state: ActionState;
  result: LifecycleActionResult | null;
  errorMessage: string | null;
  isUnauthorized: boolean;
  isInvalidState: boolean;
  onSubmit: (payload: ShipComponentPayload) => void;
  onReset: () => void;
}

export function ShipForm({
  componentID, identityId, state, result, errorMessage,
  isUnauthorized, isInvalidState, onSubmit, onReset,
}: ShipFormProps) {
  const today = new Date().toISOString().split('T')[0];
  const [transporter,   setTransporter]   = useState(identityId);
  const [from,          setFrom]          = useState('');
  const [to,            setTo]            = useState('');
  const [shipmentID,    setShipmentID]    = useState('');
  const [shipmentDate,  setShipmentDate]  = useState(today);

  const isSubmitting = state === 'submitting';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ transporter, from, to, shipmentID, shipmentDate });
  };

  return (
    <ActionFormWrapper
      title={null} state={state} result={result} errorMessage={errorMessage}
      isUnauthorized={isUnauthorized} isInvalidState={isInvalidState}
      operation="Component Shipment" identityId={identityId} onReset={onReset}
    >
      <form className="action-form" onSubmit={handleSubmit} aria-label="Ship component form">
        <div className="action-form-grid">
          <FormField id="ship-component-id" label="Component ID"  value={componentID}  onChange={() => {}} disabled />
          <FormField id="ship-transporter"  label="Transporter"   value={transporter}  onChange={setTransporter}  disabled={isSubmitting} />
          <FormField id="ship-from"         label="From Location" value={from}         onChange={setFrom}         placeholder="Bengaluru" disabled={isSubmitting} />
          <FormField id="ship-to"           label="To Location"   value={to}           onChange={setTo}           placeholder="Mysuru" disabled={isSubmitting} />
          <FormField id="ship-id"           label="Shipment ID"   value={shipmentID}   onChange={setShipmentID}   placeholder="SHIP-001" disabled={isSubmitting} />
          <FormField id="ship-date"         label="Shipment Date" type="date" value={shipmentDate} onChange={setShipmentDate} disabled={isSubmitting} />
        </div>
        <div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting || !from || !to || !shipmentID}
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
  identityId: string;
  state: ActionState;
  result: LifecycleActionResult | null;
  errorMessage: string | null;
  isUnauthorized: boolean;
  isInvalidState: boolean;
  onSubmit: (payload: ReceiveComponentPayload) => void;
  onReset: () => void;
}

export function ReceiveForm({
  componentID, identityId, state, result, errorMessage,
  isUnauthorized, isInvalidState, onSubmit, onReset,
}: ReceiveFormProps) {
  const today = new Date().toISOString().split('T')[0];
  const [warehouse,     setWarehouse]     = useState(identityId);
  const [location,      setLocation]      = useState('');
  const [receivedDate,  setReceivedDate]  = useState(today);

  const isSubmitting = state === 'submitting';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ warehouse, location, receivedDate });
  };

  return (
    <ActionFormWrapper
      title={null} state={state} result={result} errorMessage={errorMessage}
      isUnauthorized={isUnauthorized} isInvalidState={isInvalidState}
      operation="Component Receipt" identityId={identityId} onReset={onReset}
    >
      <form className="action-form" onSubmit={handleSubmit} aria-label="Receive component form">
        <div className="action-form-grid">
          <FormField id="recv-component-id" label="Component ID"  value={componentID}  onChange={() => {}} disabled />
          <FormField id="recv-warehouse"    label="Warehouse"     value={warehouse}    onChange={setWarehouse}    disabled={isSubmitting} />
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
  identityId: string;
  state: ActionState;
  result: LifecycleActionResult | null;
  errorMessage: string | null;
  isUnauthorized: boolean;
  isInvalidState: boolean;
  onSubmit: (payload: TransferCustodyPayload) => void;
  onReset: () => void;
}

export function TransferForm({
  componentID, identityId, state, result, errorMessage,
  isUnauthorized, isInvalidState, onSubmit, onReset,
}: TransferFormProps) {
  const today = new Date().toISOString().split('T')[0];
  const [from,          setFrom]          = useState(identityId);
  const [to,            setTo]            = useState('');
  const [location,      setLocation]      = useState('');
  const [transferDate,  setTransferDate]  = useState(today);

  const isSubmitting = state === 'submitting';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ from, to, location, transferDate });
  };

  return (
    <ActionFormWrapper
      title={null} state={state} result={result} errorMessage={errorMessage}
      isUnauthorized={isUnauthorized} isInvalidState={isInvalidState}
      operation="Custody Transfer" identityId={identityId} onReset={onReset}
    >
      <form className="action-form" onSubmit={handleSubmit} aria-label="Transfer custody form">
        <div className="action-form-grid">
          <FormField id="xfr-component-id" label="Component ID"    value={componentID} onChange={() => {}} disabled />
          <FormField id="xfr-from"         label="From"            value={from}        onChange={setFrom}        disabled={isSubmitting} />
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
  identityId: string;
  state: ActionState;
  result: LifecycleActionResult | null;
  errorMessage: string | null;
  isUnauthorized: boolean;
  isInvalidState: boolean;
  onSubmit: (payload: AssembleComponentPayload) => void;
  onReset: () => void;
}

export function AssembleForm({
  componentID, identityId, state, result, errorMessage,
  isUnauthorized, isInvalidState, onSubmit, onReset,
}: AssembleFormProps) {
  const [assembler,   setAssembler]   = useState(identityId);
  const [assemblyID,  setAssemblyID]  = useState('');
  const [location,    setLocation]    = useState('');

  const isSubmitting = state === 'submitting';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ assembler, assemblyID, location });
  };

  return (
    <ActionFormWrapper
      title={null} state={state} result={result} errorMessage={errorMessage}
      isUnauthorized={isUnauthorized} isInvalidState={isInvalidState}
      operation="Component Assembly" identityId={identityId} onReset={onReset}
    >
      <form className="action-form" onSubmit={handleSubmit} aria-label="Assemble component form">
        <div className="action-form-grid">
          <FormField id="assy-component-id" label="Component ID" value={componentID} onChange={() => {}} disabled />
          <FormField id="assy-assembler"    label="Assembler"    value={assembler}   onChange={setAssembler}   disabled={isSubmitting} />
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
