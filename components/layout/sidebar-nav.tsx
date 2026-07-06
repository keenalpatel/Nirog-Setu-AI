'use client';

import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import Image from 'next/image';
import {
  Activity,
  AlertTriangle,
  Bell,
  Calendar,
  ChevronDown,
  Heart,
  Home,
  Languages,
  LineChart,
  LogOut,
  MapPin,
  Menu,
  MessageSquare,
  Shield,
  Stethoscope,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { SUPPORTED_LANGUAGES } from '@/lib/types';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useAuth } from '@/lib/auth-context';

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: Home },
  { name: 'Screenings', href: '/screenings', icon: Stethoscope },
  { name: 'Patients', href: '/patients', icon: Users },
  { name: 'Emergencies', href: '/emergencies', icon: AlertTriangle },
  { name: 'Analytics', href: '/analytics', icon: LineChart },
  { name: 'ASHA Workers', href: '/asha-workers', icon: Heart },
  { name: 'Hospitals', href: '/hospitals', icon: MapPin },
  { name: 'Test Chat', href: '/test-chat', icon: MessageSquare },
];

const agentNavigation = [
  { name: 'Triage Agent', href: '/agents/triage', icon: Activity, color: 'text-emerald-500' },
  { name: 'Diagnose Agent', href: '/agents/diagnose', icon: Shield, color: 'text-blue-500' },
  { name: 'Emergency Agent', href: '/agents/emergency', icon: AlertTriangle, color: 'text-red-500' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen, language, setLanguage, notifications } = useAppStore();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <>
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-64 flex-col glass border-r border-white/10 transition-transform duration-300 lg:translate-x-0 lg:static lg:z-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-white/10">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center overflow-hidden shadow-lg">
              <Image src="/logo.jpeg" alt="Logo" width={32} height={32} className="object-contain p-0.5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-tight">Nirog-Setu <span className="text-indigo-400">AI</span></span>
              <span className="text-xs text-gray-500">Bridge to Health</span>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin">
          {/* Main Navigation */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-2">
              Main Menu
            </p>
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-indigo-500/20 text-white border border-indigo-500/30'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                  {item.name === 'Emergencies' && (
                    <Badge variant="destructive" className="ml-auto">
                      3
                    </Badge>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Agents Section */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-2">
              AI Agents
            </p>
            {agentNavigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-indigo-500/20 text-white border border-indigo-500/30'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <item.icon className={cn('h-5 w-5', item.color)} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t border-white/10 p-4 space-y-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Built for Bharat</span>
            <div className="flex items-center gap-1">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>System Online</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export function TopBar() {
  const { sidebarOpen, setSidebarOpen, language, setLanguage, notifications, addNotification, removeNotification } = useAppStore();
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-white/10 glass px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden text-gray-400 hover:text-white"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex-1" />

      {/* Language Selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Languages className="h-4 w-4" />
            <span className="hidden sm:inline">
              {SUPPORTED_LANGUAGES.find((l) => l.code === language)?.native || 'हिंदी'}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {SUPPORTED_LANGUAGES.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => setLanguage(lang.code as any)}
              className={language === lang.code ? 'bg-muted' : ''}
            >
              <span>{lang.native}</span>
              <span className="ml-2 text-muted-foreground">({lang.name})</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Theme Toggle */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="h-8 w-8">
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setTheme('light')}>Light</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('dark')}>Dark</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setTheme('system')}>System</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Notifications */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="relative h-8 w-8">
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                {unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <div className="flex items-center justify-between p-2 border-b">
            <span className="font-medium">Notifications</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => {}}
            >
              Clear all
            </Button>
          </div>
          <div className="max-h-64 overflow-y-auto scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No notifications
              </div>
            ) : (
              notifications.slice(0, 5).map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    'flex gap-3 p-3 hover:bg-muted cursor-pointer',
                    !n.read && 'bg-muted/50'
                  )}
                >
                  <div
                    className={cn(
                      'h-2 w-2 mt-1.5 rounded-full',
                      n.type === 'emergency' && 'bg-destructive',
                      n.type === 'warning' && 'bg-warning',
                      n.type === 'success' && 'bg-success',
                      n.type === 'info' && 'bg-primary'
                    )}
                  />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Profile */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-3 py-2 border-b">
            <p className="text-sm font-medium">{user?.name || 'User'}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <DropdownMenuItem onClick={logout} className="text-red-400 focus:text-red-400">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

function Sun({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function Moon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 21 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
