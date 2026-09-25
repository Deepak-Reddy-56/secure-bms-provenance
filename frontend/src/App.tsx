import { useEffect } from 'react';
import { useNetworkStatus } from './hooks/useComponent';
import { Header } from './components/Header/Header';
import { Footer } from './components/Footer/Footer';
import { Dashboard } from './pages/Dashboard';

export default function App() {
  // Network status is shared at the app level for the header indicator
  const { status, refresh } = useNetworkStatus();

  useEffect(() => {
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="app-layout">
      {/* Skip to content link for keyboard users */}
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          top: '-999px',
          left: '-999px',
          zIndex: 9999,
          background: 'var(--color-blue)',
          color: '#fff',
          padding: '8px 16px',
          borderRadius: '4px',
          fontWeight: 600,
        }}
        onFocus={e => { (e.target as HTMLAnchorElement).style.top = '8px'; (e.target as HTMLAnchorElement).style.left = '8px'; }}
        onBlur={e => { (e.target as HTMLAnchorElement).style.top = '-999px'; (e.target as HTMLAnchorElement).style.left = '-999px'; }}
      >
        Skip to main content
      </a>

      <Header networkStatus={status} />
      <Dashboard networkStatus={status} />
      <Footer />
    </div>
  );
}
