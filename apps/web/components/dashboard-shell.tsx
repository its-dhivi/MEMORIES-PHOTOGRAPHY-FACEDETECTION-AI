'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  BarChart3,
  CalendarDays,
  Images,
  LayoutGrid,
  LogOut,
  Menu,
  Plus,
  Settings,
  UploadCloud,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { authApi } from '@/lib/api';

const navigation = [
  { href: '/dashboard', label: 'Today', icon: LayoutGrid },
  { href: '/dashboard/events', label: 'Events', icon: CalendarDays },
  { href: '/dashboard/photographs', label: 'Library', icon: Images },
  { href: '/dashboard/processing', label: 'Activity', icon: UploadCloud },
  { href: '/dashboard/analytics', label: 'Insights', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Studio', icon: Settings },
];

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const reduced = useReducedMotion();
  const [menuOpen, setMenuOpen] = useState(false);
  const me = useQuery({ queryKey: ['auth', 'me'], queryFn: authApi.me });
  const logout = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => router.replace('/login'),
  });
  useEffect(() => {
    if (me.isError) router.replace('/login');
  }, [me.isError, router]);

  if (me.isLoading)
    return (
      <div className="min-h-screen bg-[#faf9f6] p-6" aria-label="Loading dashboard">
        <div className="shimmer h-16 rounded-2xl" />
        <div className="shimmer mt-6 h-[70vh] rounded-3xl" />
      </div>
    );
  if (!me.data) return null;
  const studio = me.data.memberships[0];
  const active = navigation.find((item) =>
    item.href === '/dashboard' ? pathname === item.href : pathname.startsWith(item.href),
  );
  const isSelected = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href);

  return (
    <div className="dashboard-theme min-h-screen bg-[#faf9f6] text-[#252522] lg:grid lg:grid-cols-[92px_1fr]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[92px] flex-col items-center border-r border-[#e8e4dd] bg-white py-6 lg:flex">
        <Link
          href="/dashboard"
          aria-label="Memories Photography home"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#252522] font-serif text-2xl text-white"
        >
          M
        </Link>
        <nav className="mt-14 flex flex-1 flex-col gap-3" aria-label="Primary navigation">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition ${isSelected(item.href) ? 'bg-[#252522] text-white' : 'text-[#817c74] hover:bg-[#f3f0eb] hover:text-[#252522]'}`}
            >
              <item.icon size={19} strokeWidth={1.7} />
            </Link>
          ))}
        </nav>
        <button
          onClick={() => logout.mutate()}
          aria-label="Sign out"
          title="Sign out"
          className="flex h-12 w-12 items-center justify-center rounded-full text-[#817c74] hover:bg-[#f3f0eb] hover:text-[#252522]"
        >
          <LogOut size={18} />
        </button>
      </aside>

      <div className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-30 border-b border-[#e8e4dd] bg-[#faf9f6]/95 backdrop-blur-xl">
          <div className="mx-auto flex h-[76px] max-w-[1540px] items-center justify-between px-4 sm:px-8 lg:px-12">
            <div className="flex min-w-0 items-center gap-3">
              <button
                onClick={() => setMenuOpen(true)}
                aria-label="Open navigation"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ded9d1] bg-white lg:hidden"
              >
                <Menu size={19} />
              </button>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold uppercase tracking-[.18em] text-[#9b8a74]">
                  {studio?.studioName ?? 'Memories Photography'}
                </p>
                <p className="truncate text-sm text-[#68645e]">{active?.label ?? 'Workspace'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/events/new"
                className="hidden min-h-11 items-center gap-2 rounded-full bg-[#252522] px-5 text-sm font-medium text-white sm:inline-flex"
              >
                <Plus size={17} /> New event
              </Link>
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ded9d1] bg-white text-sm font-semibold">
                {me.data.displayName.slice(0, 2).toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              className="fixed inset-0 z-50 lg:hidden"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button
                className="absolute inset-0 bg-[#252522]/35"
                aria-label="Close navigation"
                onClick={() => setMenuOpen(false)}
              />
              <motion.aside
                className="absolute inset-y-0 left-0 w-[min(88vw,340px)] bg-[#faf9f6] p-6 shadow-2xl"
                initial={reduced ? false : { x: -40 }}
                animate={{ x: 0 }}
                exit={{ x: -40 }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-serif text-2xl font-semibold">Memories Photography</p>
                    <p className="mt-1 text-xs uppercase tracking-[.2em] text-[#a58b68]">
                      Studio workspace
                    </p>
                  </div>
                  <button
                    onClick={() => setMenuOpen(false)}
                    aria-label="Close menu"
                    className="p-2"
                  >
                    <X size={20} />
                  </button>
                </div>
                <nav className="mt-10 space-y-1" aria-label="Studio navigation">
                  {navigation.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={`flex min-h-12 items-center gap-3 rounded-full px-4 text-sm ${isSelected(item.href) ? 'bg-[#252522] text-white' : 'text-[#68645e] hover:bg-[#eeeae4]'}`}
                    >
                      <item.icon size={18} />
                      {item.label}
                    </Link>
                  ))}
                </nav>
                <button
                  onClick={() => logout.mutate()}
                  className="mt-10 flex items-center gap-3 px-4 text-sm text-[#68645e]"
                >
                  <LogOut size={18} /> Sign out
                </button>
              </motion.aside>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.main
          key={pathname}
          className="mx-auto max-w-[1540px] px-4 pb-28 pt-6 sm:px-8 sm:pt-10 lg:px-12 lg:pb-12"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
        >
          {children}
        </motion.main>

        <nav
          className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-40 flex h-16 items-center justify-around rounded-full border border-[#e1dcd4] bg-white/95 px-2 shadow-[0_14px_45px_rgba(50,42,33,.16)] backdrop-blur-xl lg:hidden"
          aria-label="Mobile navigation"
        >
          {navigation.slice(0, 5).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={`flex h-12 w-12 items-center justify-center rounded-full ${isSelected(item.href) ? 'bg-[#252522] text-white' : 'text-[#77746e]'}`}
            >
              <item.icon size={18} />
            </Link>
          ))}
          <Link
            href="/dashboard/events/new"
            aria-label="Create event"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#a58b68] text-white"
          >
            <Plus size={20} />
          </Link>
        </nav>
      </div>
    </div>
  );
}
