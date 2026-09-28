import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS } from '../../types/identity';
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
    <rect
      x="2"
      y="8"
      width="5"
      height="4"
      rx="1"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <rect
      x="13"
      y="8"
      width="5"
      height="4"
      rx="1"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <line
      x1="7"
      y1="10"
      x2="13"
      y2="10"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle
      cx="10"
      cy="4"
      r="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <circle
      cx="10"
      cy="16"
      r="2"
      stroke="currentColor"
      strokeWidth="1.5"
    />
    <line
      x1="10"
      y1="6"
      x2="10"
      y2="8"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <line
      x1="10"
      y1="12"
      x2="10"
      y2="14"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const statusLabels: Record<NetworkStatus, string> = {
  connected: 'Connected',
  connecting: 'Connecting…',
  disconnected: 'Disconnected',
};

export function Header({ networkStatus }: HeaderProps) {
  const { user, role, fabricIdentity, isAdmin } = useAuth();

  const roleLabel = isAdmin
    ? 'Administrator'
    : role
      ? ROLE_LABELS[role]
      : 'Unassigned';

  const identityLabel = isAdmin
    ? 'Application Admin'
    : fabricIdentity || 'Unassigned';

  return (
    <header className="header" role="banner">
      <div className="header-inner">
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

        <div className="header-right">
          <div className="header-identity-info">
            <div className="header-identity-row">
              <span className="header-identity-label">Account</span>
              <span className="header-identity-value">
                {user?.email || 'Authenticated account'}
              </span>
            </div>
            <div className="header-identity-row">
              <span className="header-identity-label">Identity</span>
              <span className="header-identity-value mono">
                {identityLabel}
              </span>
            </div>
            <div className="header-identity-row">
              <span className="header-identity-label">Role</span>
              <span className={`role-badge ${role || 'ADMIN'}`}>
                {roleLabel}
              </span>
            </div>
          </div>

          <div className="header-divider" aria-hidden="true" />

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
      </div>
    </header>
  );
}
