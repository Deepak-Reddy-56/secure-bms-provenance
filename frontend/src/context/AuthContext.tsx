import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { ReactNode } from 'react';

import type { UserRole } from '../types/identity';
import {
  authenticateWithGoogle,
  getCurrentSession,
  logoutFromServer,
  type GoogleAuthUser,
} from '../services/authService';
import { ApiError } from '../types/api';

interface GoogleCredentialResponse {
  credential: string;
}

interface AuthContextValue {
  user: GoogleAuthUser | null;
  role: UserRole | null;
  fabricIdentity: string | null;
  isAdmin: boolean;
  loading: boolean;
  authenticated: boolean;
  authError: string | null;
  loginContainerRef: (element: HTMLDivElement | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GoogleAuthUser | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [fabricIdentity, setFabricIdentity] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginElement, setLoginElement] =
    useState<HTMLDivElement | null>(null);

  const applySession = useCallback((session: {
    user: GoogleAuthUser;
    role: UserRole | null;
    fabricIdentity: string | null;
    isAdmin: boolean;
  }) => {
    setUser(session.user);
    setRole(session.role);
    setFabricIdentity(session.fabricIdentity);
    setIsAdmin(session.isAdmin);
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setRole(null);
    setFabricIdentity(null);
    setIsAdmin(false);
  }, []);

  const handleGoogleCredential = useCallback(
    async ({ credential }: GoogleCredentialResponse) => {
      setLoading(true);
      setAuthError(null);

      try {
        const result = await authenticateWithGoogle(credential);

        applySession(result);
      } catch (error) {
        clearSession();

        setAuthError(
          error instanceof Error
            ? error.message
            : 'Google authentication failed.'
        );
      } finally {
        setLoading(false);
      }
    },
    [applySession, clearSession]
  );

  const loginContainerRef = useCallback(
    (element: HTMLDivElement | null) => {
      setLoginElement(element);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        const session = await getCurrentSession();

        if (!cancelled) {
          applySession(session);
        }
      } catch (error) {
        if (!cancelled) {
          clearSession();

          if (!(error instanceof ApiError && error.statusCode === 401)) {
            setAuthError(
              error instanceof Error
                ? error.message
                : 'Unable to restore the current session.'
            );
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, [applySession, clearSession]);

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

  const logout = useCallback(async () => {
    try {
      await logoutFromServer();
    } catch {
      // Clear local state even when the server is unavailable.
    } finally {
      if (window.google) {
        window.google.accounts.id.disableAutoSelect();
      }

      clearSession();
      setAuthError(null);
    }
  }, [clearSession]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setAuthError('Google client ID is not configured.');
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        fabricIdentity,
        isAdmin,
        loading,
        authenticated: Boolean(user),
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
