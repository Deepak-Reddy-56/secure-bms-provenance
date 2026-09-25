import { useEffect } from 'react';
import { Overview } from '../components/Overview/Overview';
import { ComponentRegistration } from '../components/ComponentRegistration/ComponentRegistration';
import { ComponentSearch } from '../components/ComponentSearch/ComponentSearch';
import { ProvenanceTimeline } from '../components/ProvenanceTimeline/ProvenanceTimeline';
import { LedgerInformation } from '../components/LedgerInformation/LedgerInformation';
import {
  useRegistration,
  useComponentSearch,
  useSystemOverview,
} from '../hooks/useComponent';
import type { NetworkStatus } from '../types/component';
import './Dashboard.css';

interface DashboardProps {
  networkStatus: NetworkStatus;
}

export function Dashboard({ networkStatus }: DashboardProps) {
  const registration  = useRegistration();
  const search        = useComponentSearch();
  const overview      = useSystemOverview();

  // Fetch the registered count on mount
  useEffect(() => {
    overview.refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // After successful registration, refresh the overview count
  useEffect(() => {
    if (registration.state === 'success') {
      overview.refresh();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registration.state]);

  return (
    <main className="page-content" id="main-content">
      {/* System Overview */}
      <Overview
        registeredCount={overview.registeredCount}
        networkStatus={networkStatus}
        loading={overview.loading}
      />

      <div className="dashboard-grid">
        {/* Main content column */}
        <div className="dashboard-main">
          <ComponentRegistration
            state={registration.state}
            registeredComponent={registration.registeredComponent}
            errorMessage={registration.errorMessage}
            isDuplicate={registration.isDuplicate}
            onRegister={registration.register}
            onReset={registration.reset}
          />

          <ComponentSearch
            state={search.state}
            component={search.component}
            errorMessage={search.errorMessage}
            onSearch={search.search}
            onClear={search.clear}
          />
        </div>

        {/* Sidebar */}
        <aside className="dashboard-sidebar" aria-label="Ledger and provenance information">
          <ProvenanceTimeline />
          <LedgerInformation
            txId={registration.registeredComponent?.txId ?? null}
          />
        </aside>
      </div>
    </main>
  );
}
