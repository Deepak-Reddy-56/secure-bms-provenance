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
        background: 'var(--bg-primary, #0b0f14)',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '36px',
          borderRadius: '16px',
          border: '1px solid var(--border-color, #2a313c)',
          background: 'var(--bg-secondary, #11161d)',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            margin: 0,
            marginBottom: '10px',
            color: 'var(--text-primary, #ffffff)',
          }}
        >
          Component Provenance
        </h1>

        <p
          style={{
            margin: 0,
            marginBottom: '28px',
            color: 'var(--text-secondary, #9aa4b2)',
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