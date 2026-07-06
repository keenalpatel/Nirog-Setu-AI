'use client';

import { useAuth } from '@/lib/auth-context';
import { Sidebar, TopBar } from '@/components/layout/sidebar-nav';
import { Loader2 } from 'lucide-react';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

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

  // Only render dashboard layout for admin users
  if (!user || user.role !== 'admin') {
    return null;
  }

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
