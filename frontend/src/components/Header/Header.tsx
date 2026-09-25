import type { NetworkStatus } from '../../types/component';
import './Header.css';

interface HeaderProps {
  networkStatus: NetworkStatus;
}

const ProvenanceIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="none"
    aria-hidden="true"
  >
    {/* Abstract chain-link / provenance icon */}
    <rect x="2" y="8" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <rect x="13" y="8" width="5" height="4" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <line x1="7" y1="10" x2="13" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="10" cy="4" r="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <circle cx="10" cy="16" r="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
    <line x1="10" y1="6" x2="10" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="10" y1="12" x2="10" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const statusLabels: Record<NetworkStatus, string> = {
  connected:    'Connected',
  connecting:   'Connecting…',
  disconnected: 'Disconnected',
};

export function Header({ networkStatus }: HeaderProps) {
  return (
    <header className="header" role="banner">
      <div className="header-inner">
        {/* Brand */}
        <div className="header-brand">
          <div className="header-logo" aria-hidden="true">
            <ProvenanceIcon />
          </div>
          <div className="header-text">
            <div className="header-product-name">Component Provenance</div>
            <div className="header-product-subtitle">
              Secure Blockchain-Based Component Verification
            </div>
          </div>
        </div>

        {/* Network status */}
        <div
          className="network-status-pill"
          aria-label={`Fabric network status: ${statusLabels[networkStatus]}`}
        >
          <span className="network-status-label">Fabric Network</span>
          <div className="network-status-row">
            <span
              className={`status-dot ${networkStatus}`}
              role="img"
              aria-label={statusLabels[networkStatus]}
            />
            <span className={`network-status-text ${networkStatus}`}>
              {statusLabels[networkStatus]}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
