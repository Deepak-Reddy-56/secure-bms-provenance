import { useState, useId } from 'react';
import type { RegisterComponentPayload, RegistrationState, Component } from '../../types/component';
import './ComponentRegistration.css';

interface FormErrors {
  componentID?: string;
  componentType?: string;
  manufacturer?: string;
  manufactureDate?: string;
  location?: string;
}

interface ComponentRegistrationProps {
  state: RegistrationState;
  registeredComponent: Component | null;
  errorMessage: string | null;
  isDuplicate: boolean;
  onRegister: (payload: RegisterComponentPayload) => void;
  onReset: () => void;
}

const INITIAL_FORM: RegisterComponentPayload = {
  componentID:    '',
  componentType:  '',
  manufacturer:   '',
  manufactureDate: '',
  location:       '',
};

// Basic Component ID format validation: letters/digits/hyphens, min 3 chars
const COMPONENT_ID_RE = /^[A-Za-z0-9\-_]{3,64}$/;

function validate(form: RegisterComponentPayload): FormErrors {
  const errors: FormErrors = {};
  if (!form.componentID.trim()) {
    errors.componentID = 'Component ID is required.';
  } else if (!COMPONENT_ID_RE.test(form.componentID.trim())) {
    errors.componentID = 'Component ID must be 3–64 characters (letters, digits, hyphens).';
  }
  if (!form.componentType.trim()) {
    errors.componentType = 'Component type is required.';
  }
  if (!form.manufacturer.trim()) {
    errors.manufacturer = 'Manufacturer is required.';
  }
  if (!form.manufactureDate.trim()) {
    errors.manufactureDate = 'Manufacturing date is required.';
  }
  if (!form.location.trim()) {
    errors.location = 'Location is required.';
  }
  return errors;
}

const RegisterIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M8 1v6M5 4l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 10v3a1 1 0 001 1h10a1 1 0 001-1v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export function ComponentRegistration({
  state,
  registeredComponent,
  errorMessage,
  isDuplicate,
  onRegister,
  onReset,
}: ComponentRegistrationProps) {
  const [form, setForm] = useState<RegisterComponentPayload>(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const uid = useId();

  const isSubmitting = state === 'submitting';
  const isSuccess    = state === 'success';

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    // Clear the field error on user input
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    onRegister({
      componentID:    form.componentID.trim(),
      componentType:  form.componentType.trim(),
      manufacturer:   form.manufacturer.trim(),
      manufactureDate: form.manufactureDate.trim(),
      location:       form.location.trim(),
    });
  }

  function handleReset() {
    setForm(INITIAL_FORM);
    setErrors({});
    onReset();
  }

  // ── Success state ──────────────────────────────────────────
  if (isSuccess && registeredComponent) {
    return (
      <section className="registration-card" aria-label="Component registration">
        <div className="registration-card-header">
          <div className="registration-card-icon" aria-hidden="true">
            <RegisterIcon />
          </div>
          <div>
            <h2 className="card-title">Register Component</h2>
            <p className="card-subtitle">
              Register a newly manufactured component on the Hyperledger Fabric ledger.
            </p>
          </div>
        </div>

        <div className="registration-card-body">
          <div className="success-panel" role="status" aria-live="polite">
            <div className="success-panel-header">
              <span className="success-panel-icon" aria-hidden="true">✓</span>
              <div>
                <div className="success-panel-title">Component Registered</div>
                <div className="success-panel-id" aria-label={`Component ID: ${registeredComponent.componentID}`}>
                  {registeredComponent.componentID}
                </div>
              </div>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: '#8ee0a1', marginBottom: 'var(--space-3)' }}>
              {registeredComponent.componentID} has been successfully registered on the provenance ledger.
            </p>

            <div className="success-panel-meta">
              <div className="success-meta-item">
                <div className="success-meta-label">Component Type</div>
                <div className="success-meta-value">{registeredComponent.componentType}</div>
              </div>
              <div className="success-meta-item">
                <div className="success-meta-label">Manufacturer</div>
                <div className="success-meta-value">{registeredComponent.manufacturer}</div>
              </div>
              <div className="success-meta-item">
                <div className="success-meta-label">Manufacturing Date</div>
                <div className="success-meta-value">{registeredComponent.manufactureDate}</div>
              </div>
              <div className="success-meta-item">
                <div className="success-meta-label">Location</div>
                <div className="success-meta-value">{registeredComponent.location}</div>
              </div>
              <div className="success-meta-item">
                <div className="success-meta-label">Status</div>
                <div className="success-meta-value status-badge">
                  <span className="status-dot connected" aria-hidden="true" />
                  {registeredComponent.status}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn register-another-btn mt-4"
            onClick={handleReset}
          >
            Register Another Component
          </button>
        </div>
      </section>
    );
  }

  // ── Form state ─────────────────────────────────────────────
  return (
    <section className="registration-card" aria-label="Component registration">
      <div className="registration-card-header">
        <div className="registration-card-icon" aria-hidden="true">
          <RegisterIcon />
        </div>
        <div>
          <h2 className="card-title">Register Component</h2>
          <p className="card-subtitle">
            Register a newly manufactured component on the Hyperledger Fabric ledger.
          </p>
        </div>
      </div>

      <div className="registration-card-body">
        <form
          className="registration-form"
          onSubmit={handleSubmit}
          noValidate
          aria-label="Component registration form"
        >
          <div className="registration-form-grid">
            {/* Component ID */}
            <div className="form-group full-width">
              <label className="form-label" htmlFor={`${uid}-componentID`}>
                Component ID <span className="required-mark" aria-hidden="true">*</span>
              </label>
              <input
                id={`${uid}-componentID`}
                name="componentID"
                type="text"
                className={`form-input mono ${errors.componentID ? 'is-invalid' : ''}`}
                placeholder="e.g. BMS-2026-001"
                value={form.componentID}
                onChange={handleChange}
                disabled={isSubmitting}
                autoComplete="off"
                aria-required="true"
                aria-describedby={errors.componentID ? `${uid}-componentID-err` : undefined}
                aria-invalid={!!errors.componentID}
              />
              {errors.componentID && (
                <span className="field-error" id={`${uid}-componentID-err`} role="alert">
                  {errors.componentID}
                </span>
              )}
            </div>

            {/* Component Type */}
            <div className="form-group">
              <label className="form-label" htmlFor={`${uid}-componentType`}>
                Component Type <span className="required-mark" aria-hidden="true">*</span>
              </label>
              <input
                id={`${uid}-componentType`}
                name="componentType"
                type="text"
                className={`form-input ${errors.componentType ? 'is-invalid' : ''}`}
                placeholder="e.g. BMS Controller"
                value={form.componentType}
                onChange={handleChange}
                disabled={isSubmitting}
                aria-required="true"
                aria-describedby={errors.componentType ? `${uid}-componentType-err` : undefined}
                aria-invalid={!!errors.componentType}
              />
              {errors.componentType && (
                <span className="field-error" id={`${uid}-componentType-err`} role="alert">
                  {errors.componentType}
                </span>
              )}
            </div>

            {/* Manufacturer */}
            <div className="form-group">
              <label className="form-label" htmlFor={`${uid}-manufacturer`}>
                Manufacturer <span className="required-mark" aria-hidden="true">*</span>
              </label>
              <input
                id={`${uid}-manufacturer`}
                name="manufacturer"
                type="text"
                className={`form-input ${errors.manufacturer ? 'is-invalid' : ''}`}
                placeholder="e.g. EVTech Manufacturing"
                value={form.manufacturer}
                onChange={handleChange}
                disabled={isSubmitting}
                aria-required="true"
                aria-describedby={errors.manufacturer ? `${uid}-manufacturer-err` : undefined}
                aria-invalid={!!errors.manufacturer}
              />
              {errors.manufacturer && (
                <span className="field-error" id={`${uid}-manufacturer-err`} role="alert">
                  {errors.manufacturer}
                </span>
              )}
            </div>

            {/* Manufacturing Date */}
            <div className="form-group">
              <label className="form-label" htmlFor={`${uid}-manufactureDate`}>
                Manufacturing Date <span className="required-mark" aria-hidden="true">*</span>
              </label>
              <input
                id={`${uid}-manufactureDate`}
                name="manufactureDate"
                type="date"
                className={`form-input ${errors.manufactureDate ? 'is-invalid' : ''}`}
                value={form.manufactureDate}
                onChange={handleChange}
                disabled={isSubmitting}
                aria-required="true"
                aria-describedby={errors.manufactureDate ? `${uid}-manufactureDate-err` : undefined}
                aria-invalid={!!errors.manufactureDate}
              />
              {errors.manufactureDate && (
                <span className="field-error" id={`${uid}-manufactureDate-err`} role="alert">
                  {errors.manufactureDate}
                </span>
              )}
            </div>

            {/* Location */}
            <div className="form-group">
              <label className="form-label" htmlFor={`${uid}-location`}>
                Location <span className="required-mark" aria-hidden="true">*</span>
              </label>
              <input
                id={`${uid}-location`}
                name="location"
                type="text"
                className={`form-input ${errors.location ? 'is-invalid' : ''}`}
                placeholder="e.g. Bengaluru"
                value={form.location}
                onChange={handleChange}
                disabled={isSubmitting}
                aria-required="true"
                aria-describedby={errors.location ? `${uid}-location-err` : undefined}
                aria-invalid={!!errors.location}
              />
              {errors.location && (
                <span className="field-error" id={`${uid}-location-err`} role="alert">
                  {errors.location}
                </span>
              )}
            </div>
          </div>

          {/* Submit row */}
          <div className="registration-submit-row">
            <button
              id="btn-register-component"
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Registering component…
                </>
              ) : (
                'Register Component'
              )}
            </button>
          </div>

          {/* Error feedback */}
          {state === 'error' && errorMessage && (
            <div
              className={`alert ${isDuplicate ? 'alert-warning' : 'alert-error'}`}
              role="alert"
              aria-live="assertive"
            >
              <span className="alert-icon" aria-hidden="true">
                {isDuplicate ? '⚠' : '✕'}
              </span>
              <div className="alert-body">
                <div className="alert-title">
                  {isDuplicate ? 'Component Already Exists' : 'Registration Failed'}
                </div>
                <div className="alert-message">{errorMessage}</div>
              </div>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
