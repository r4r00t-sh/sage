import axios from 'axios';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Direct one-click download (latest release must have asset efmp-android.apk from workflow). */
export const ANDROID_APK_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_ANDROID_APK_URL ||
  'https://github.com/r4r00t-sh/eFMP/releases/latest/download/efmp-android.apk';

/** GitHub latest release page (for login page download dropdown). */
export const GITHUB_RELEASES_URL =
  process.env.NEXT_PUBLIC_GITHUB_RELEASES_URL ||
  'https://github.com/r4r00t-sh/eFMP/releases/latest';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests; for FormData let browser set Content-Type (with boundary)
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// On 401, clear token and redirect to login (e.g. expired or invalid token)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined' && error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      const path = window.location.pathname || '';
      if (!path.startsWith('/login')) {
        window.location.href = `/login?redirect=${encodeURIComponent(path)}`;
      }
    }
    return Promise.reject(error);
  },
);

export default api;

