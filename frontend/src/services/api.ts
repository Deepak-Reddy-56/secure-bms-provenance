import { ApiError } from '../types/api';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    signal,
  };

  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }

  const url = `${BASE_URL}${path}`;

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (err) {
    // Network-level failure (no response received)
    throw new ApiError(
      'Unable to communicate with the provenance service. Please check the network connection and try again.',
      0
    );
  }

  // Parse body regardless of status to capture error messages
  let parsed: unknown;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    parsed = await response.json();
  } else {
    const text = await response.text();
    parsed = { message: text };
  }

  if (!response.ok) {
    const errorObj = parsed as Record<string, unknown>;
    const message =
      (typeof errorObj?.message === 'string' ? errorObj.message : null) ||
      (typeof errorObj?.error === 'string' ? errorObj.error : null) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return parsed as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', signal }),

  post: <T>(path: string, body: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'POST', body, signal }),
};
