import axios from 'axios';

/** Message from Nest/axios error bodies for toasts and alerts. */
export function apiErrorMessage(err: unknown, fallback = 'An error occurred'): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data;
    if (d && typeof d === 'object' && 'message' in d) {
      const m = (d as { message?: unknown }).message;
      if (typeof m === 'string' && m.trim()) return m;
    }
    if (typeof err.message === 'string' && err.message) return err.message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
