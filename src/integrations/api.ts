/**
 * API client for the .NET backend at VITE_API_BASE_URL (default http://localhost:5000).
 * Automatically attaches the JWT from the auth token getter when set.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000";

let tokenGetter: (() => string | null) | null = null;

/** Set by AuthContext so all API requests include the JWT when the user is logged in. */
export function setApiTokenGetter(getter: (() => string | null) | null) {
  tokenGetter = getter;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function request<T>(
  path: string,
  options?: {
    method?: HttpMethod;
    body?: unknown;
    token?: string | null;
  }
): Promise<T> {
  const token = options?.token ?? tokenGetter?.() ?? null;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text) as { message?: string };
      if (json.message) message = json.message;
    } catch {
      // use raw text
    }
    throw new Error(message || `API ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export { API_BASE_URL };
