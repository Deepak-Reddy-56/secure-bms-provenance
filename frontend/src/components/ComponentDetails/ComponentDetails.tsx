import type { Component } from '../../types/component';
import './ComponentDetails.css';

interface ComponentDetailsProps {
  component: Component;
}

function formatDate(dateStr: string): string {
  try {
    // Handle both ISO format (2026-09-24) and other formats
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function ComponentDetails({ component }: ComponentDetailsProps) {
  const isManufactured = component.status?.toUpperCase() === 'MANUFACTURED';

  return (
    <div className="details-panel" role="region" aria-label={`Component details for ${component.componentID}`}>
      {/* Header */}
      <div className="details-panel-header">
        <span className="details-panel-title">Component Details</span>
        <span className="details-panel-id" aria-label={`Component ID: ${component.componentID}`}>
          {component.componentID}
        </span>
      </div>

      {/* Fields */}
      <dl className="details-fields">
        <div className="detail-field">
          <dt className="detail-field-label">Component ID</dt>
          <dd className="detail-field-value mono">{component.componentID}</dd>
        </div>

        <div className="detail-field">
          <dt className="detail-field-label">Component Type</dt>
          <dd className="detail-field-value">{component.componentType}</dd>
        </div>

        <div className="detail-field">
          <dt className="detail-field-label">Manufacturer</dt>
          <dd className="detail-field-value">{component.manufacturer}</dd>
        </div>

        <div className="detail-field">
          <dt className="detail-field-label">Manufacturing Date</dt>
          <dd className="detail-field-value">{formatDate(component.manufactureDate)}</dd>
        </div>

        <div className="detail-field">
          <dt className="detail-field-label">Location</dt>
          <dd className="detail-field-value">{component.location}</dd>
        </div>

        <div className="detail-field">
          <dt className="detail-field-label">Status</dt>
          <dd className="detail-field-value">
            <div className={`detail-status ${isManufactured ? 'status-manufactured' : 'status-unknown'}`}>
              <span
                className={`status-dot ${isManufactured ? 'connected' : 'disconnected'}`}
                aria-hidden="true"
              />
              {component.status}
            </div>
          </dd>
        </div>
      </dl>

      {/* Ledger verified indicator */}
      <div className="details-verified-banner" aria-label="Ledger verified">
        <span aria-hidden="true">✓</span>
        Verified on Hyperledger Fabric Ledger
      </div>
    </div>
  );
}
