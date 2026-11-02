import { useState, useId } from 'react';
import type { SearchState } from '../../types/component';
import type { Component } from '../../types/component';
import { ComponentDetails } from '../ComponentDetails/ComponentDetails';
import './ComponentSearch.css';

interface ComponentSearchProps {
  state: SearchState;
  component: Component | null;
  errorMessage: string | null;
  onSearch: (componentID: string) => void;
  onClear: () => void;
}

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.5" />
    <line x1="9.5" y1="9.5" x2="13.5" y2="13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export function ComponentSearch({
  state,
  component,
  errorMessage,
  onSearch,
  onClear,
}: ComponentSearchProps) {
  const [inputValue, setInputValue] = useState('');
  const uid = useId();
  const isSearching = state === 'searching';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    onSearch(trimmed);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputValue(e.target.value);
    // If we had results and the user clears the input, reset
    if (!e.target.value.trim() && state !== 'idle') {
      onClear();
    }
  }

  return (
    <section className="search-card" aria-label="Verify component">
      <div className="search-card-header">
        <div className="search-card-icon" aria-hidden="true">
          <SearchIcon />
        </div>
        <div>
          <h2 className="card-title">Verify Component</h2>
          <p className="card-subtitle">
            Retrieve a component from the Hyperledger Fabric ledger using its unique component ID.
          </p>
        </div>
      </div>

      <div className="search-card-body">
        <form onSubmit={handleSubmit} aria-label="Component verification form" noValidate>
          <div className="search-input-row">
            <div className="form-group">
              <label className="form-label" htmlFor={`${uid}-search-input`}>
                Component ID
              </label>
              <input
                id={`${uid}-search-input`}
                type="text"
                className="form-input mono"
                placeholder="Enter component ID (e.g. BMS-2026-001)"
                value={inputValue}
                onChange={handleInputChange}
                disabled={isSearching}
                autoComplete="off"
                aria-label="Component ID to verify"
              />
            </div>

            <button
              id="btn-verify-component"
              type="submit"
              className="btn btn-secondary"
              disabled={isSearching || !inputValue.trim()}
              aria-busy={isSearching}
              style={{ marginBottom: '0', alignSelf: 'flex-end' }}
            >
              {isSearching ? (
                <>
                  <span className="spinner" aria-hidden="true" />
                  Searching ledger…
                </>
              ) : (
                <>
                  <SearchIcon />
                  Verify Component
                </>
              )}
            </button>
          </div>
        </form>

        {/* Result area */}
        <div className="search-result-area" aria-live="polite">
          {state === 'idle' && (
            <div className="search-idle-hint">
              <SearchIcon />
              Enter a component ID above to retrieve its provenance record from the ledger.
            </div>
          )}

          {state === 'found' && component && (
            <ComponentDetails component={component} />
          )}

          {state === 'not_found' && (
            <div className="not-found-panel" role="alert">
              <span className="not-found-icon" aria-hidden="true">○</span>
              <div>
                <div className="not-found-title">Component Not Found</div>
                <div className="not-found-msg">
                  No component with ID{' '}
                  <code className="mono">{inputValue.trim()}</code> was found on the provenance ledger.
                </div>
              </div>
            </div>
          )}

          {state === 'error' && (
            <div className="search-error-panel" role="alert">
              <span style={{ fontSize: 'var(--text-lg)', flexShrink: 0 }} aria-hidden="true">✕</span>
              <div>
                <div className="search-error-title">Unable to Verify Component</div>
                <div className="search-error-msg">
                  {errorMessage || 'Unable to communicate with the provenance service. Please check the network connection and try again.'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
