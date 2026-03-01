import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/** Safe storage for persist: no-ops on server (SSR) and never throws. */
const safeStorage = {
  getItem: (name: string): string | null => {
    try {
      return typeof window === 'undefined' ? null : localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      if (typeof window !== 'undefined') localStorage.setItem(name, value);
    } catch {
      // ignore
    }
  },
  removeItem: (name: string): void => {
    try {
      if (typeof window !== 'undefined') localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};


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
  mustChangePassword?: boolean;
  profileCompletedAt?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  lastVisitedPath: string | null;
  setAuth: (user: User, token: string) => void;
  setLastVisitedPath: (path: string) => void;
  clearLastVisitedPath: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      lastVisitedPath: null,
      setAuth: (user, token) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', token);
        }
        set({ user, token });
      },
      setLastVisitedPath: (path: string) => {
        // Don't store login/logout pages or public routes
        const publicRoutes = ['/login', '/logout', '/docs'];
        if (!publicRoutes.some(route => path.startsWith(route))) {
          set({ lastVisitedPath: path });
        }
      },
      clearLastVisitedPath: () => {
        set({ lastVisitedPath: null });
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
        }
        // Keep lastVisitedPath for next login
        set({ user: null, token: null });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => safeStorage),
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
      storage: createJSONStorage(() => safeStorage),
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
      storage: createJSONStorage(() => safeStorage),
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
    {
      name: 'locale-storage',
      storage: createJSONStorage(() => safeStorage),
    }
  )
);

// SAGE Req 4: Open chat sidebar with a user (for clickable usernames → DM)
interface ChatState {
  isChatOpen: boolean;
  openChatWithUserId: string | null;
  openChatWith: (userId: string) => void;
  setChatOpen: (open: boolean) => void;
  clearOpenChatWithUserId: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  isChatOpen: false,
  openChatWithUserId: null,
  openChatWith: (userId) => set({ isChatOpen: true, openChatWithUserId: userId }),
  setChatOpen: (open) => set({ isChatOpen: open, ...(open ? {} : { openChatWithUserId: null }) }),
  clearOpenChatWithUserId: () => set({ openChatWithUserId: null }),
}));

