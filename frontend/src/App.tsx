import { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AppShell } from './components/AppShell/AppShell';
import type { Page } from './components/AppShell/AppShell';
import { useNetworkStatus } from './hooks/useComponent';
import { OverviewPage } from './pages/OverviewPage';
import { ComponentsPage } from './pages/ComponentsPage';
import { LifecyclePage } from './pages/LifecyclePage';
import { ProvenancePage } from './pages/ProvenancePage';
import { AuditPage } from './pages/AuditPage';
import { NetworkPage } from './pages/NetworkPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';
import type { UserRole } from './types/identity';

const OPERATIONAL_PAGES: Page[] = [
  'overview',
  'components',
  'lifecycle',
  'provenance',
];

const ROLE_PAGES: Record<UserRole, Page[]> = {
  MANUFACTURER: OPERATIONAL_PAGES,
  CERTIFIER: OPERATIONAL_PAGES,
  TRANSPORTER: OPERATIONAL_PAGES,
  WAREHOUSE: OPERATIONAL_PAGES,
  ASSEMBLER: OPERATIONAL_PAGES,
  AUDITOR: [...OPERATIONAL_PAGES, 'audit'],
};

function canAccessPage(page: Page, role: UserRole | null, isAdmin: boolean): boolean {
  if (isAdmin) {
    return page === 'settings' || page === 'network';
  }

  return Boolean(role && ROLE_PAGES[role].includes(page));
}

const PAGE_TITLES: Record<Page, string> = {
  overview: 'Component Provenance',
  components: 'Component Verification',
  lifecycle: 'Component Lifecycle',
  provenance: 'Provenance History',
  audit: 'Audit Log',
  network: 'Network Status',
  settings: 'Administration',
};

function AppInner() {
  const { role, isAdmin } = useAuth();
  const defaultPage: Page = isAdmin ? 'settings' : 'overview';
  const [currentPage, setCurrentPage] = useState<Page>(defaultPage);

  const { status, health, refresh } = useNetworkStatus(isAdmin);

  const navigate = (page: Page) => {
    if (canAccessPage(page, role, isAdmin)) {
      setCurrentPage(page);
    }
  };

  useEffect(() => {
    if (!canAccessPage(currentPage, role, isAdmin)) {
      setCurrentPage(defaultPage);
    }
  }, [currentPage, role, isAdmin, defaultPage]);

  useEffect(() => {
    if (isAdmin) {
      void refresh();
    }
  }, [isAdmin, refresh]);

  const renderPage = () => {
    switch (currentPage) {
      case 'overview':
        return (
          <OverviewPage
            networkStatus={status}
            onNavigate={navigate}
          />
        );

      case 'components':
        return <ComponentsPage />;

      case 'lifecycle':
        return <LifecyclePage />;

      case 'provenance':
        return <ProvenancePage />;

      case 'audit':
        return <AuditPage />;

      case 'network':
        return (
          <NetworkPage
            networkStatus={status}
            health={health}
          />
        );

      case 'settings':
        return <SettingsPage />;

      default:
        return null;
    }
  };

  return (
    <AppShell
      currentPage={currentPage}
      onNavigate={navigate}
      networkStatus={status}
      pageTitle={PAGE_TITLES[currentPage]}
    >
      {renderPage()}
    </AppShell>
  );
}

function AuthGate() {
  const {
    authenticated,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <p>Loading authentication...</p>
      </main>
    );
  }

  if (!authenticated) {
    return <LoginPage />;
  }

  return <AppInner />;
}

export default function App() {
  return (
    <ToastProvider>
      <AuthGate />
    </ToastProvider>
  );
}