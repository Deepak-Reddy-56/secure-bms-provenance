import { useState, useRef, useCallback } from 'react';
import {
  registerComponent,
  getComponent,
  checkNetworkHealth,
  getSystemOverview,
} from '../services/componentService';
import type { Component, RegisterComponentPayload } from '../types/component';
import type { RegistrationState, SearchState, NetworkStatus } from '../types/component';
import { ApiError } from '../types/api';

// ─── Registration Hook ───────────────────────────────────────────────────────

interface UseRegistrationReturn {
  state: RegistrationState;
  registeredComponent: Component | null;
  errorMessage: string | null;
  isDuplicate: boolean;
  register: (payload: RegisterComponentPayload) => Promise<void>;
  reset: () => void;
}

export function useRegistration(): UseRegistrationReturn {
  const [state, setState] = useState<RegistrationState>('idle');
  const [registeredComponent, setRegisteredComponent] = useState<Component | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const register = useCallback(async (payload: RegisterComponentPayload) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setState('submitting');
    setErrorMessage(null);
    setIsDuplicate(false);
    setRegisteredComponent(null);

    try {
      const component = await registerComponent(payload, abortRef.current.signal);
      setRegisteredComponent(component);
      setState('success');
    } catch (err) {
      if (err instanceof ApiError) {
        setIsDuplicate(err.isConflict);
        setErrorMessage(err.message);
      } else if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled — stay in current state
        return;
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.');
      }
      setState('error');
    }
  }, []);

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setState('idle');
    setRegisteredComponent(null);
    setErrorMessage(null);
    setIsDuplicate(false);
  }, []);

  return { state, registeredComponent, errorMessage, isDuplicate, register, reset };
}

// ─── Component Search Hook ───────────────────────────────────────────────────

interface UseComponentSearchReturn {
  state: SearchState;
  component: Component | null;
  errorMessage: string | null;
  search: (componentID: string) => Promise<void>;
  clear: () => void;
}

export function useComponentSearch(): UseComponentSearchReturn {
  const [state, setState] = useState<SearchState>('idle');
  const [component, setComponent] = useState<Component | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (componentID: string) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setState('searching');
    setErrorMessage(null);
    setComponent(null);

    try {
      const found = await getComponent(componentID, abortRef.current.signal);
      setComponent(found);
      setState('found');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isNotFound) {
          setState('not_found');
        } else {
          setErrorMessage(err.message);
          setState('error');
        }
      } else if (err instanceof Error && err.name === 'AbortError') {
        return;
      } else {
        setErrorMessage('An unexpected error occurred. Please try again.');
        setState('error');
      }
    }
  }, []);

  const clear = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setState('idle');
    setComponent(null);
    setErrorMessage(null);
  }, []);

  return { state, component, errorMessage, search, clear };
}

// ─── Network Status Hook ─────────────────────────────────────────────────────

interface UseNetworkStatusReturn {
  status: NetworkStatus;
  refresh: () => void;
}

export function useNetworkStatus(): UseNetworkStatusReturn {
  const [status, setStatus] = useState<NetworkStatus>('connecting');

  const refresh = useCallback(async () => {
    setStatus('connecting');
    const ok = await checkNetworkHealth();
    setStatus(ok ? 'connected' : 'disconnected');
  }, []);

  return { status, refresh };
}

// ─── System Overview Hook ────────────────────────────────────────────────────

interface UseSystemOverviewReturn {
  registeredCount: number | null;
  loading: boolean;
  refresh: () => void;
}

export function useSystemOverview(): UseSystemOverviewReturn {
  const [registeredCount, setRegisteredCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const overview = await getSystemOverview();
    setRegisteredCount(overview?.registeredCount ?? null);
    setLoading(false);
  }, []);

  return { registeredCount, loading, refresh };
}
