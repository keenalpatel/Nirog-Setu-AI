'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LanguageCode } from './types';

interface AppState {
  language: LanguageCode;
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  notifications: Notification[];
  setLanguage: (lang: LanguageCode) => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'emergency';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      language: 'hi' as LanguageCode,
      sidebarOpen: true,
      theme: 'system',
      notifications: [],
      setLanguage: (language) => set({ language }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setTheme: (theme) => set({ theme }),
      addNotification: (notification) =>
        set((state) => ({
          notifications: [
            {
              ...notification,
              id: crypto.randomUUID(),
              timestamp: new Date().toISOString(),
              read: false,
            },
            ...state.notifications,
          ].slice(0, 50), // Keep last 50 notifications
        })),
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),
      clearNotifications: () => set({ notifications: [] }),
    }),
    {
      name: 'nirog-setu-storage',
      partialize: (state) => ({
        language: state.language,
        theme: state.theme,
      }),
    }
  )
);
