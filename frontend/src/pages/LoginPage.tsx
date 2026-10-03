import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const {
    loading,
    authError,
    loginContainerRef,
  } = useAuth();

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background: 'var(--bg-primary, #ffffff)',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '36px',
          borderRadius: '16px',
          border: '1px solid #ffffff',
          background: '#000000',
          textAlign: 'center',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 56,
            height: 56,
            margin: '0 auto 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
          }}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            width="56"
            height="56"
          >
            <rect x="1" y="6" width="5" height="4" rx="0.5" />
            <rect x="10" y="6" width="5" height="4" rx="0.5" />
            <line x1="6" y1="8" x2="10" y2="8" />
          </svg>
        </div>

        <h1
          style={{
            margin: 0,
            marginBottom: '10px',
            color: '#ffffff',
            fontWeight: 600,
          }}
        >
          Component Provenance
        </h1>

        <p
          style={{
            margin: 0,
            marginBottom: '28px',
            color: '#ffffff',
          }}
        >
          Sign in with your organization's Google Workspace account.
        </p>

        <div
          ref={loginContainerRef}
          style={{
            minHeight: '44px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        />

        {loading && (
          <p
            style={{
              marginTop: '18px',
              color: 'var(--text-secondary, #9aa4b2)',
            }}
          >
            Authenticating...
          </p>
        )}

        {authError && (
          <p
            style={{
              marginTop: '18px',
              color: 'var(--color-red-light, #ff6b6b)',
              lineHeight: 1.5,
            }}
          >
            {authError}
          </p>
        )}
      </section>
    </main>
  );
}