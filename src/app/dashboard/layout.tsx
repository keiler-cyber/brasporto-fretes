'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { LayoutDashboard, Upload, LogOut } from 'lucide-react';

const NAV = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Nova Cotação', href: '/upload', icon: Upload },
];

const VERSION = '26.06.18';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const name = user?.email?.split('@')[0] ?? '';
  const initials = name.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen" style={{
      backgroundImage: 'url(/port-bg.png)',
      backgroundSize: 'cover',
      backgroundAttachment: 'fixed',
      backgroundPosition: 'center',
    }}>
      <div className="min-h-screen" style={{ background: 'rgba(240,248,251,0.93)' }}>

        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-20 shadow-lg" style={{ background: '#002b38' }}>
          <div className="max-w-7xl mx-auto px-8 py-3.5 flex items-center gap-5">

            {/* Logo */}
            <img
              src="/brasporto-logo.png"
              alt="Brasporto"
              className="h-11 w-auto object-contain flex-shrink-0"
              style={{ filter: 'brightness(0) invert(1)', maxWidth: '180px' }}
            />

            <div className="w-px h-8 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }} />

            {/* System name */}
            <div className="flex-shrink-0">
              <p className="text-sm font-semibold text-white leading-tight">Comparador de Fretes</p>
              <p className="text-[11px]" style={{ color: '#7dd3e8' }}>Air · FCL · LCL</p>
            </div>

            {/* Nav */}
            <nav className="flex items-center gap-1 ml-4">
              {NAV.map(({ label, href, icon: Icon }) => {
                const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
                return (
                  <button
                    key={label}
                    onClick={() => router.push(href)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
                    style={{
                      color: active ? 'white' : 'rgba(255,255,255,0.6)',
                      background: active ? 'rgba(74,155,170,0.35)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {label}
                  </button>
                );
              })}
            </nav>

            {/* Right */}
            <div className="ml-auto flex items-center gap-4">
              <span className="text-xs font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>v{VERSION}</span>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                  style={{ background: '#4A9BAA' }}>
                  {initials}
                </div>
                <span className="text-sm capitalize" style={{ color: 'rgba(255,255,255,0.7)' }}>{name}</span>
                <button
                  onClick={async () => { await logout(); router.push('/'); }}
                  title="Sair"
                  className="transition ml-1"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#f87171'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)'; }}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          <div className="h-0.5" style={{ background: 'linear-gradient(90deg,rgba(74,155,170,0.3),#4A9BAA,rgba(74,155,170,0.3))' }} />
        </header>

        <main className="max-w-7xl mx-auto px-8 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
