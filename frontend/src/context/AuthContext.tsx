import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import {
  authenticateWithGoogle,
  type GoogleAuthUser,
} from '../services/authService';

interface GoogleCredentialResponse {
  credential: string;
}

interface AuthContextValue {
  user: GoogleAuthUser | null;
  fabricIdentity: string | null;
  idToken: string | null;
  loading: boolean;
  authenticated: boolean;
  authError: string | null;
  loginContainerRef: (element: HTMLDivElement | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_WORKSPACE_DOMAIN = 'btech.christuniversity.in';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GoogleAuthUser | null>(null);
  const [fabricIdentity, setFabricIdentity] = useState<string | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginElement, setLoginElement] =
    useState<HTMLDivElement | null>(null);

  const handleGoogleCredential = useCallback(
    async ({ credential }: GoogleCredentialResponse) => {
      setLoading(true);
      setAuthError(null);

      try {
        const result = await authenticateWithGoogle(credential);

        setUser(result.user);
        setFabricIdentity(result.fabricIdentity);
        setIdToken(credential);
      } catch (error) {
        setUser(null);
        setFabricIdentity(null);
        setIdToken(null);

        const message =
          error instanceof Error
            ? error.message
            : 'Google authentication failed.';

        setAuthError(message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loginContainerRef = useCallback(
    (element: HTMLDivElement | null) => {
      setLoginElement(element);
    },
    []
  );

  /*
   * Google Identity Services loads asynchronously.
   * Wait until window.google is available, then render the button.
   */
  useEffect(() => {
    if (!loginElement || !GOOGLE_CLIENT_ID) {
      return;
    }

    let cancelled = false;

    const renderGoogleButton = () => {
      if (cancelled || !window.google) {
        return false;
      }

      loginElement.replaceChildren();

      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        hd: GOOGLE_WORKSPACE_DOMAIN,
        auto_select: false,
      });

      window.google.accounts.id.renderButton(loginElement, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width: 280,
      });

      return true;
    };

    if (renderGoogleButton()) {
      return;
    }

    const interval = window.setInterval(() => {
      if (renderGoogleButton()) {
        window.clearInterval(interval);
        window.clearTimeout(timeout);
      }
    }, 100);

    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);

      if (!window.google && !cancelled) {
        setAuthError(
          'Google Sign-In could not be loaded. Check your internet connection and reload the page.'
        );
      }
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [loginElement, handleGoogleCredential]);

  const logout = useCallback(() => {
    if (window.google) {
      window.google.accounts.id.disableAutoSelect();
    }

    setUser(null);
    setFabricIdentity(null);
    setIdToken(null);
    setAuthError(null);
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setAuthError('Google client ID is not configured.');
    }

    setLoading(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        fabricIdentity,
        idToken,
        loading,
        authenticated: Boolean(user && fabricIdentity && idToken),
        authError,
        loginContainerRef,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }

  return context;
}