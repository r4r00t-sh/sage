import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  username: string;
  email?: string;
  name: string;
  /** @deprecated use roles */
  role?: string;
  roles?: string[];
  departmentId?: string;
  divisionId?: string;
  avatarKey?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', token);
        }
        set({ user, token });
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
        }
        set({ user: null, token: null });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);

interface PointsState {
  points: number;
  setPoints: (points: number) => void;
}

export const usePointsStore = create<PointsState>((set) => ({
  points: 1000,
  setPoints: (points) => set({ points }),
}));

// Notification Store
interface Notification {
  id: string;
  type: 'file' | 'chat' | 'system' | 'user';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Notification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  setNotifications: (notifications: Notification[]) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    })),
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
      unreadCount: state.notifications.find((n) => n.id === id && !n.read)
        ? state.unreadCount - 1
        : state.unreadCount,
    })),
  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.read).length,
    }),
}));

// User Preferences Store
interface UserPreferences {
  defaultView: 'list' | 'grid';
  itemsPerPage: number;
  emailNotifications: boolean;
  pushNotifications: boolean;
  soundEnabled: boolean;
}

interface PreferencesState {
  preferences: UserPreferences;
  updatePreferences: (preferences: Partial<UserPreferences>) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      preferences: {
        defaultView: 'list',
        itemsPerPage: 10,
        emailNotifications: true,
        pushNotifications: true,
        soundEnabled: true,
      },
      updatePreferences: (newPreferences) =>
        set((state) => ({
          preferences: { ...state.preferences, ...newPreferences },
        })),
    }),
    {
      name: 'user-preferences',
    }
  )
);

// Recent Files Store
interface RecentFile {
  id: string;
  fileNumber: string;
  subject: string;
  accessedAt: string;
}

interface RecentFilesState {
  recentFiles: RecentFile[];
  addRecentFile: (file: RecentFile) => void;
}

export const useRecentFilesStore = create<RecentFilesState>()(
  persist(
    (set) => ({
      recentFiles: [],
      addRecentFile: (file) =>
        set((state) => {
          const filtered = state.recentFiles.filter((f) => f.id !== file.id);
          return {
            recentFiles: [file, ...filtered].slice(0, 10), // Keep last 10
          };
        }),
    }),
    {
      name: 'recent-files',
    }
  )
);

// Locale (language) store: 'en' | 'ml'. When 'ml', Manjari font is applied app-wide.
export type Locale = 'en' | 'ml';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'en',
      setLocale: (locale) => {
        set({ locale });
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-locale', locale);
          document.documentElement.lang = locale === 'ml' ? 'ml' : 'en';
        }
      },
    }),
    { name: 'locale-storage' }
  )
);

