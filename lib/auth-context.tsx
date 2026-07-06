'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export type UserRole = 'admin' | 'user' | null;

export interface User {
  email: string;
  role: 'admin' | 'user';
  name: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Hardcoded credentials
const USERS: Record<string, { password: string; role: 'admin' | 'user'; name: string }> = {
  'niha132@gmail.com': { password: '8998856741', role: 'user', name: 'Niha' },
  'keenal143@gmail.com': { password: '8998996741', role: 'admin', name: 'Keenal' },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Check for stored user on mount
    const storedUser = localStorage.getItem('nirog_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('nirog_user');
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isLoading) return;

    // Public paths that don't require authentication
    const publicPaths = ['/', '/login'];
    const isPublicPath = publicPaths.includes(pathname);

    // Admin-only pages (dashboard and sub-pages)
    const isAdminPath = pathname.startsWith('/dashboard') ||
                        pathname.startsWith('/screenings') ||
                        pathname.startsWith('/patients') ||
                        pathname.startsWith('/emergencies') ||
                        pathname.startsWith('/analytics') ||
                        pathname.startsWith('/asha-workers') ||
                        pathname.startsWith('/hospitals') ||
                        pathname.startsWith('/agents') ||
                        pathname.startsWith('/test-chat');

    if (!user && !isPublicPath) {
      // Not logged in and trying to access protected page
      router.push('/login');
    } else if (user) {
      if (pathname === '/login') {
        // Already logged in, redirect from login
        router.push(user.role === 'admin' ? '/dashboard' : '/chat');
      } else if (user.role === 'user' && isAdminPath) {
        // User trying to access admin pages
        router.push('/chat');
      }
    }
  }, [user, isLoading, pathname, router]);

  const login = (email: string, password: string): { success: boolean; error?: string } => {
    const normalizedEmail = email.toLowerCase().trim();
    const userData = USERS[normalizedEmail];

    if (!userData) {
      return { success: false, error: 'User not found' };
    }

    if (userData.password !== password) {
      return { success: false, error: 'Invalid password' };
    }

    const newUser: User = {
      email: normalizedEmail,
      role: userData.role,
      name: userData.name,
    };

    setUser(newUser);
    localStorage.setItem('nirog_user', JSON.stringify(newUser));

    // Redirect based on role
    if (userData.role === 'admin') {
      router.push('/dashboard');
    } else {
      router.push('/chat');
    }

    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('nirog_user');
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
