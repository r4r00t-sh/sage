import { useState, useEffect, useRef } from 'react';
import api, { API_BASE_URL as API_BASE } from '@/lib/api';

/**
 * Get avatar URL for img src when user has avatarKey.
 * Fetches with auth and returns object URL (revoked on unmount).
 */
export function useAvatarUrl(userId: string | undefined, avatarKey: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !avatarKey) {
      queueMicrotask(() => setUrl(null));
      return;
    }

    let cancelled = false;

    const fetchAvatar = async () => {
      try {
        const response = await api.get(`/users/${userId}/avatar`, {
          responseType: 'blob',
        });
        if (cancelled) return;
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }
        const objectUrl = URL.createObjectURL(response.data);
        objectUrlRef.current = objectUrl;
        setUrl(objectUrl);
      } catch {
        if (!cancelled) setUrl(null);
      }
    };

    fetchAvatar();

    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
    };
  }, [userId, avatarKey]);

  return url;
}

/**
 * Get the API URL for avatar (for use with fetch that includes auth)
 */
export function getAvatarApiUrl(userId: string): string {
  return `${API_BASE}/users/${userId}/avatar`;
}
