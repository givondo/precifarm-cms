export const OFFLINE_ERROR =
  "Could not reach the server. Check that the dev server is running on port 3002.";

export async function readJson<T = Record<string, unknown>>(res: Response): Promise<T> {
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}

type ApiErrorBody = {
  error?: { message?: string; code?: string };
};

export function getApiErrorMessage(json: ApiErrorBody, fallback: string): string {
  return json.error?.message ?? fallback;
}

export async function apiFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  return fetch(input, { credentials: "same-origin", ...init });
}
