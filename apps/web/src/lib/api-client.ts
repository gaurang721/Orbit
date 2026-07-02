import type { ApiResponse } from '@fbclone/types';
import { useAuthStore } from '@/stores/auth-store';

const API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'}/api/v1`;

export class ApiClientError extends Error {
  code: string;
  status: number;
  details?: Record<string, string[]>;
  constructor(status: number, code: string, message: string, details?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip attaching the access token (used by refresh itself). */
  skipAuth?: boolean;
  /** Internal flag to prevent infinite refresh loops. */
  _retry?: boolean;
}

// Coalesce concurrent refreshes into a single network call.
let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        const json = (await res.json()) as ApiResponse<{
          user: import('@fbclone/types').CurrentUser;
          accessToken: string;
          expiresIn: number;
        }>;
        if (!res.ok || !json.success) {
          useAuthStore.getState().clear();
          return false;
        }
        useAuthStore.getState().setAuth(json.data.user, json.data.accessToken);
        return true;
      } catch {
        useAuthStore.getState().clear();
        return false;
      } finally {
        // Clear after the microtask so concurrent callers share this result.
        setTimeout(() => (refreshPromise = null), 0);
      }
    })();
  }
  return refreshPromise;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, _retry, headers, ...rest } = options;
  const token = useAuthStore.getState().accessToken;
  // FormData (file uploads) must be sent as-is so the browser sets the
  // multipart boundary; JSON bodies are stringified.
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token && !skipAuth ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : isForm ? (body as BodyInit) : JSON.stringify(body),
  });

  // 204 No Content
  if (res.status === 204) return undefined as T;

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;

  if (!res.ok || !json || !json.success) {
    const code = json && !json.success ? json.error.code : 'UNKNOWN';
    // On an expired/invalid token, refresh once and retry transparently.
    if (
      !skipAuth &&
      !_retry &&
      (res.status === 401 || code === 'TOKEN_EXPIRED' || code === 'UNAUTHORIZED')
    ) {
      const refreshed = await attemptRefresh();
      if (refreshed) return apiRequest<T>(path, { ...options, _retry: true });
    }
    const message = json && !json.success ? json.error.message : `Request failed (${res.status})`;
    const details = json && !json.success ? json.error.details : undefined;
    throw new ApiClientError(res.status, code, message, details);
  }

  return json.data;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
  refresh: attemptRefresh,
};
