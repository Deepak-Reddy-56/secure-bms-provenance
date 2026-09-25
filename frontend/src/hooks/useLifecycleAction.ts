import { useState, useRef, useCallback } from 'react';
import { ApiError } from '../types/api';
import type { ActionState, LifecycleActionResult } from '../types/component';
import type { ProvenanceEvent } from '../types/provenance';
import { getComponentHistory } from '../services/componentService';

// ── Generic lifecycle action hook ─────────────────────────────

interface UseLifecycleActionReturn {
  state: ActionState;
  result: LifecycleActionResult | null;
  errorMessage: string | null;
  isUnauthorized: boolean;
  isInvalidState: boolean;
  execute: (fn: (signal: AbortSignal) => Promise<LifecycleActionResult>) => Promise<void>;
  reset: () => void;
}

export function useLifecycleAction(): UseLifecycleActionReturn {
  const [state,          setState]          = useState<ActionState>('idle');
  const [result,         setResult]         = useState<LifecycleActionResult | null>(null);
  const [errorMessage,   setErrorMessage]   = useState<string | null>(null);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [isInvalidState, setIsInvalidState] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const execute = useCallback(async (
    fn: (signal: AbortSignal) => Promise<LifecycleActionResult>
  ) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setState('submitting');
    setResult(null);
    setErrorMessage(null);
    setIsUnauthorized(false);
    setIsInvalidState(false);

    try {
      const res = await fn(abortRef.current.signal);
      setResult(res);
      setState('success');
    } catch (err) {
      if (err instanceof ApiError) {
        const isAuth   = err.statusCode === 401 || err.statusCode === 403;
        const isState  = err.statusCode === 409;
        setIsUnauthorized(isAuth);
        setIsInvalidState(isState);
        setErrorMessage(humanizeError(err));
      } else if (err instanceof Error && err.name === 'AbortError') {
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
    setResult(null);
    setErrorMessage(null);
    setIsUnauthorized(false);
    setIsInvalidState(false);
  }, []);

  return { state, result, errorMessage, isUnauthorized, isInvalidState, execute, reset };
}

// ── Provenance history hook ────────────────────────────────────

interface UseProvenanceHistoryReturn {
  events: ProvenanceEvent[];
  loading: boolean;
  errorMessage: string | null;
  fetch: (componentID: string, identityId?: string) => Promise<void>;
  clear: () => void;
}

export function useProvenanceHistory(): UseProvenanceHistoryReturn {
  const [events,       setEvents]       = useState<ProvenanceEvent[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetch = useCallback(async (componentID: string, identityId?: string) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setErrorMessage(null);
    setEvents([]);

    try {
      const history = await getComponentHistory(componentID, abortRef.current.signal, identityId);
      setEvents(history);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      if (err instanceof ApiError) {
        setErrorMessage(humanizeError(err));
      } else {
        setErrorMessage('Failed to retrieve provenance history.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setEvents([]);
    setErrorMessage(null);
    setLoading(false);
  }, []);

  return { events, loading, errorMessage, fetch, clear };
}

// ── Error humaniser ───────────────────────────────────────────

function humanizeError(err: ApiError): string {
  const { statusCode, message } = err;

  // Already has a good message from the backend — use it
  if (message && message !== `Request failed with status ${statusCode}`) {
    return message;
  }

  switch (statusCode) {
    case 0:   return 'Unable to reach the provenance service. Check your connection.';
    case 400: return 'Validation error — please check your inputs.';
    case 401: return 'Authentication required. You are not logged in.';
    case 403: return 'You are not authorized to perform this operation.';
    case 404: return 'Component not found.';
    case 409: return 'This lifecycle operation is not valid for the component\'s current state.';
    case 500: return 'An internal server error occurred. Please try again later.';
    default:  return `Request failed (status ${statusCode}).`;
  }
}
