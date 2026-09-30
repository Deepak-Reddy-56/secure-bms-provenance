import { useEffect, useState, useId } from 'react';
import type { RegisterComponentPayload, RegistrationState, Component } from '../../types/component';
import type { ComponentTypeConfig } from '../../types/componentType';
import { getComponentTypes } from '../../services/componentTypeService';
import './ComponentRegistration.css';

interface FormErrors {
  componentTypeId?: string;
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
  componentTypeId: '',
  manufacturer: '',
  manufactureDate: '',
  location: '',
};

function validate(form: RegisterComponentPayload): FormErrors {
  const errors: FormErrors = {};
  if (!form.componentTypeId.trim()) {
    errors.componentTypeId = 'Component type is required.';
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
  const [componentTypes, setComponentTypes] = useState<ComponentTypeConfig[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [typesError, setTypesError] = useState<string | null>(null);
  const uid = useId();

  useEffect(() => {
    let cancelled = false;

    void getComponentTypes()
      .then(types => {
        if (cancelled) return;
        setComponentTypes(types);
        setForm(current => ({
          ...current,
          componentTypeId: current.componentTypeId || types[0]?.id || '',
        }));
      })
      .catch(err => {
        if (!cancelled) {
          setTypesError(
            err instanceof Error
              ? err.message
              : 'Unable to load configured component types.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setTypesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const selectedType = componentTypes.find(
    type => type.id === form.componentTypeId
  );

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
      componentTypeId: form.componentTypeId.trim(),
      manufacturer: form.manufacturer.trim(),
      manufactureDate: form.manufactureDate.trim(),
      location: form.location.trim(),
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
            {/* Component Type */}
            <div className="form-group full-width">
              <label className="form-label" htmlFor={`${uid}-componentType`}>
                Component Type <span className="required-mark" aria-hidden="true">*</span>
              </label>
              <select
                id={`${uid}-componentType`}
                name="componentTypeId"
                className={`form-input ${errors.componentTypeId ? 'is-invalid' : ''}`}
                value={form.componentTypeId}
                onChange={e => {
                  const value = e.target.value;
                  setForm(prev => ({ ...prev, componentTypeId: value }));
                  if (errors.componentTypeId) {
                    setErrors(prev => ({ ...prev, componentTypeId: undefined }));
                  }
                }}
                disabled={isSubmitting || typesLoading}
                required
                aria-required="true"
              >
                <option value="">
                  {typesLoading ? 'Loading component types…' : 'Select component type'}
                </option>
                {componentTypes.map(type => (
                  <option key={type.id} value={type.id}>
                    {type.name} · {type.code} · {type.componentNumber}
                  </option>
                ))}
              </select>
              {errors.componentTypeId && (
                <span className="field-error" role="alert">
                  {errors.componentTypeId}
                </span>
              )}
            </div>

            {selectedType && (
              <div className="form-group full-width">
                <div className="registration-id-preview">
                  <div className="success-meta-label">Generated Component ID</div>
                  <div className="success-panel-id">
                    BMS-{selectedType.code}-{selectedType.componentNumber}{form.manufactureDate
                      ? `${form.manufactureDate.slice(8, 10)}${form.manufactureDate.slice(5, 7)}${form.manufactureDate.slice(2, 4)}`
                      : 'DDMMYY'}001
                  </div>
                  <div className="success-meta-label" style={{ marginTop: 'var(--space-2)' }}>
                    Serial is assigned automatically from 001. The server determines the next available serial at registration time.
                  </div>
                </div>
              </div>
            )}

            {typesError && (
              <div className="alert alert-error full-width" role="alert">
                <span className="alert-icon" aria-hidden="true">✕</span>
                <div className="alert-body">
                  <div className="alert-title">Component Types Unavailable</div>
                  <div className="alert-message">{typesError}</div>
                </div>
              </div>
            )}

            {componentTypes.length === 0 && !typesLoading && !typesError && (
              <div className="alert alert-warning full-width" role="status">
                <span className="alert-icon" aria-hidden="true">!</span>
                <div className="alert-body">
                  <div className="alert-title">No Component Types Configured</div>
                  <div className="alert-message">
                    Ask an administrator to configure an active component type before registering a component.
                  </div>
                </div>
              </div>
            )}

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
