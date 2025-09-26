export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

const API_BASE = import.meta.env.VITE_BACKEND_BASE || "";
const API_KEY = import.meta.env.VITE_BACKEND_API_KEY;

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${path}`;
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (API_KEY) {
    headers.set("X-API-Key", API_KEY);
  }
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request failed: ${response.status} ${text}`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
