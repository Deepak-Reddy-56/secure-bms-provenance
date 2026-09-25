import { useState, useEffect } from 'react';
import { IdentityProvider } from './context/IdentityContext';
import { ToastProvider } from './context/ToastContext';
import { AppShell } from './components/AppShell/AppShell';
import type { Page } from './components/AppShell/AppShell';
import { useNetworkStatus } from './hooks/useComponent';
import { OverviewPage }   from './pages/OverviewPage';
import { ComponentsPage } from './pages/ComponentsPage';
import { LifecyclePage }  from './pages/LifecyclePage';
import { ProvenancePage } from './pages/ProvenancePage';
import { AuditPage }      from './pages/AuditPage';
import { NetworkPage }    from './pages/NetworkPage';

const PAGE_TITLES: Record<Page, string> = {
  overview:    'Component Provenance',
  components:  'Component Verification',
  lifecycle:   'Component Lifecycle',
  provenance:  'Provenance History',
  audit:       'Audit Log',
  network:     'Network Status',
  settings:    'Settings',
};

function AppInner() {
  const [currentPage, setCurrentPage] = useState<Page>('overview');
  const { status, health, refresh } = useNetworkStatus();

  useEffect(() => {
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderPage = () => {
    switch (currentPage) {
      case 'overview':    return <OverviewPage   networkStatus={status} onNavigate={setCurrentPage} />;
      case 'components':  return <ComponentsPage />;
      case 'lifecycle':   return <LifecyclePage />;
      case 'provenance':  return <ProvenancePage />;
      case 'audit':       return <AuditPage />;
      case 'network':     return <NetworkPage networkStatus={status} health={health} />;
      case 'settings':    return <div className="empty-state"><p className="empty-state-title">Settings</p><p className="empty-state-desc">Configuration options for the provenance platform.</p></div>;
      default:            return null;
    }
  };

  return (
    <AppShell
      currentPage={currentPage}
      onNavigate={setCurrentPage}
      networkStatus={status}
      pageTitle={PAGE_TITLES[currentPage]}
    >
      {renderPage()}
    </AppShell>
  );
}

export default function App() {
  return (
    <IdentityProvider>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </IdentityProvider>
  );
}
