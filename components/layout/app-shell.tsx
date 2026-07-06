'use client';

import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Sidebar, TopBar } from '@/components/layout/sidebar-nav';
import { Loader2 } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Pages that don't need the admin shell
  const noShellPages = ['/', '/login', '/chat'];
  if (noShellPages.includes(pathname)) {
    return <>{children}</>;
  }

  // Admin pages - with sidebar (only for admin users)
  if (user?.role === 'admin') {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto scrollbar-thin">
            {children}
          </main>
        </div>
      </div>
    );
  }

  // Fallback for non-admin users trying to access admin pages
  return <>{children}</>;
}
