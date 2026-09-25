import { useState } from 'react';
import type { ReactNode } from 'react';
import { useIdentity, ALL_IDENTITIES } from '../../context/IdentityContext';
import type { NetworkStatus } from '../../types/component';
import './AppShell.css';

// ── Nav page types ────────────────────────────────────────────
export type Page =
  | 'overview'
  | 'components'
  | 'lifecycle'
  | 'provenance'
  | 'audit'
  | 'network'
  | 'settings';

interface AppShellProps {
  children: ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  networkStatus: NetworkStatus;
  pageTitle: string;
}

const PAGE_LABELS: Record<Page, string> = {
  overview:    'Overview',
  components:  'Components',
  lifecycle:   'Lifecycle',
  provenance:  'Provenance',
  audit:       'Audit Log',
  network:     'Network',
  settings:    'Settings',
};

const NETWORK_LABELS: Record<NetworkStatus, string> = {
  connected:    'Connected',
  connecting:   'Connecting',
  disconnected: 'Offline',
};

// ── SVG Icons ─────────────────────────────────────────────────
const icons: Record<string, ReactNode> = {
  overview: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="6" height="6" rx="0.5" />
      <rect x="9" y="1" width="6" height="6" rx="0.5" />
      <rect x="1" y="9" width="6" height="6" rx="0.5" />
      <rect x="9" y="9" width="6" height="6" rx="0.5" />
    </svg>
  ),
  components: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 1L14 4.5V11.5L8 15L2 11.5V4.5L8 1Z" />
      <path d="M8 1v14M2 4.5l6 3.5 6-3.5" />
    </svg>
  ),
  lifecycle: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="2.5" cy="8" r="1.5" />
      <circle cx="8" cy="8" r="1.5" />
      <circle cx="13.5" cy="8" r="1.5" />
      <line x1="4" y1="8" x2="6.5" y2="8" />
      <line x1="9.5" y1="8" x2="12" y2="8" />
    </svg>
  ),
  provenance: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="3" r="2" />
      <circle cx="3" cy="13" r="2" />
      <circle cx="13" cy="13" r="2" />
      <line x1="8" y1="5" x2="3" y2="11" />
      <line x1="8" y1="5" x2="13" y2="11" />
    </svg>
  ),
  audit: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="1" width="12" height="14" rx="1" />
      <line x1="5" y1="5" x2="11" y2="5" />
      <line x1="5" y1="8" x2="11" y2="8" />
      <line x1="5" y1="11" x2="8" y2="11" />
    </svg>
  ),
  network: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="2.5" />
      <line x1="8" y1="2" x2="8" y2="5.5" />
      <line x1="8" y1="10.5" x2="8" y2="14" />
      <line x1="2" y1="8" x2="5.5" y2="8" />
      <line x1="10.5" y1="8" x2="14" y2="8" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41" />
    </svg>
  ),
  chain: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="6" width="5" height="4" rx="0.5" />
      <rect x="10" y="6" width="5" height="4" rx="0.5" />
      <line x1="6" y1="8" x2="10" y2="8" />
    </svg>
  ),
  chevronLeft: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M10 4L6 8l4 4" strokeLinecap="round" />
    </svg>
  ),
  chevronRight: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M6 4l4 4-4 4" strokeLinecap="round" />
    </svg>
  ),
};

const NAV_ITEMS: { id: Page; label: string }[] = [
  { id: 'overview',   label: 'Overview'   },
  { id: 'components', label: 'Components' },
  { id: 'lifecycle',  label: 'Lifecycle'  },
  { id: 'provenance', label: 'Provenance' },
  { id: 'audit',      label: 'Audit Log'  },
  { id: 'network',    label: 'Network'    },
];

export function AppShell({ children, currentPage, onNavigate, networkStatus, pageTitle }: AppShellProps) {
  const { identity, setIdentityById, roleLabel } = useIdentity();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="app-shell">
      {/* ── Sidebar ── */}
      <nav className={`sidebar${collapsed ? ' collapsed' : ''}`} aria-label="Main navigation">
        {/* Brand */}
        <div className="sidebar-brand">
          <span className="sidebar-brand-icon">{icons.chain}</span>
          {!collapsed && (
            <div className="sidebar-brand-text">
              <div className="sidebar-brand-name">Component Provenance</div>
              <div className="sidebar-brand-sub">Secure Component Traceability</div>
            </div>
          )}
        </div>

        {/* Toggle button */}
        <button
          className="sidebar-toggle"
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? icons.chevronRight : icons.chevronLeft}
        </button>

        {/* Navigation */}
        <div className="sidebar-nav" role="list">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              role="listitem"
              className={`sidebar-nav-item${currentPage === item.id ? ' active' : ''}`}
              onClick={() => onNavigate(item.id)}
              aria-current={currentPage === item.id ? 'page' : undefined}
              title={collapsed ? PAGE_LABELS[item.id] : undefined}
            >
              <span className="sidebar-nav-icon">{icons[item.id]}</span>
              {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
            </button>
          ))}
        </div>

        {/* Footer: identity + network */}
        <div className="sidebar-footer">
          {!collapsed && (
            <div className="sidebar-identity">
              <span className="sidebar-identity-label">Current Identity</span>
              <span className="sidebar-identity-id">{identity.id}</span>
              <span className="sidebar-identity-role">{roleLabel}</span>
            </div>
          )}
          <div className="sidebar-network">
            <div className={`sidebar-network-dot ${networkStatus}`} aria-hidden="true" />
            {!collapsed && (
              <span className="sidebar-network-text">
                Fabric · {NETWORK_LABELS[networkStatus]}
              </span>
            )}
          </div>
        </div>
      </nav>

      {/* ── Main area ── */}
      <div className={`main-area${collapsed ? ' sidebar-collapsed' : ''}`}>
        {/* Top header */}
        <header className="top-header" role="banner">
          <h1 className="top-header-title">{pageTitle}</h1>

          <div className="top-header-right">
            {/* Development identity selector */}
            <div className="header-identity" aria-label="Development identity selector">
              <span className="header-identity-label">Identity</span>
              <select
                id="header-identity-select"
                className="header-identity-select"
                value={identity.id}
                onChange={e => setIdentityById(e.target.value)}
                aria-label="Select development identity"
              >
                {ALL_IDENTITIES.map(i => (
                  <option key={i.id} value={i.id}>{i.id}</option>
                ))}
              </select>
              <span
                className={`header-role-badge ${identity.role}`}
                aria-label={`Role: ${roleLabel}`}
              >
                {roleLabel}
              </span>
            </div>

            {/* Network status */}
            <div
              className="header-network"
              aria-label={`Fabric network: ${NETWORK_LABELS[networkStatus]}`}
              tabIndex={0}
              role="status"
            >
              <span className={`network-dot ${networkStatus}`} aria-hidden="true" />
              <span className={`header-network-text ${networkStatus}`}>
                {NETWORK_LABELS[networkStatus]}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main id="main-content" className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}
