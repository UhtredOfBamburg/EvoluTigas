import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Stethoscope,
  FileText,
  Calculator,
  Bot,
  Menu,
  Activity,
  ScanText,
  X,
  User,
  LogOut,
  Share2,
  Sparkles,
  Search,
  Moon,
  Sun,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/contexts/UserContext';
import { GlobalModals, getProviderLabel } from '@/components/ExternalAiModal';
import { PWAInstallButton, OfflineIndicator } from '@/components/PWAInstallButton';
import { GlobalCommandPalette } from '@/components/GlobalCommandPalette';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [nightMode, setNightMode] = useLocalStorage<boolean>('evolutigas_night_mode_v1', false);

  const location = useLocation();
  const {
    currentUser,
    logout,
    dailyLimit,
    remainingToday,
    setIsShareModalOpen,
    setIsAiModalOpen,
  } = useUser();

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle('night-shift', Boolean(nightMode));
  }, [nightMode]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const activeProvider = currentUser?.aiConnections?.activeProvider || 'builtin';
  const activeAiLabel =
    activeProvider === 'builtin'
      ? `IA Grátis (${remainingToday}/${dailyLimit})`
      : `${getProviderLabel(activeProvider)} Ativo`;

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Menu Inicial' },
    { to: '/enfermaria', icon: Activity, label: 'Enfermaria' },
    { to: '/ambulatorio', icon: Stethoscope, label: 'Ambulatório' },
    { to: '/formularios', icon: FileText, label: 'Central de Formulários' },
    { to: '/transcritor', icon: ScanText, label: 'Transcritor de Exames' },
    { to: '/calculadoras', icon: Calculator, label: 'Calculadoras & DVA' },
    { to: '/ai-tools', icon: Bot, label: 'Ferramentas AI' },
  ];

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="h-14 flex items-center justify-between px-5 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2 text-teal-600 font-bold text-lg">
            <Activity className="w-5 h-5" />
            <span>EvoluTigas</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setNightMode((prev) => !prev)}
              title={nightMode ? 'Ativar Modo Claro' : 'Ativar Modo Plantão Noturno'}
              className="p-1.5 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-slate-100 transition-colors"
            >
              {nightMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              className="md:hidden p-1 text-slate-500 hover:text-slate-700"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Active Classmate Account & Connected AI Status */}
        {currentUser && (
          <div className="px-3 pt-2.5 pb-2.5 border-b border-slate-100 bg-slate-50/60 space-y-2 shrink-0">
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0">
                  {currentUser.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{currentUser.name}</p>
                  <p className="text-[10px] text-teal-700 font-medium truncate">Espaço Individual</p>
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                title="Trocar de conta ou sair"
                className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Global Search Trigger (Ctrl+K) */}
            <button
              type="button"
              onClick={() => setIsCommandOpen(true)}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 transition-colors"
              title="Buscar leito, paciente, droga ou calculadora (Ctrl+K)"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Search className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="truncate">Buscar leito ou calc...</span>
              </span>
              <kbd className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                Ctrl+K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => setIsAiModalOpen(true)}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-white hover:bg-teal-50 text-teal-900 border border-teal-200 transition-colors shadow-2xs"
              title="Conectar com Claude, ChatGPT ou Gemini"
            >
              <span className="flex items-center gap-1.5 truncate">
                <Sparkles className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span className="truncate">{activeAiLabel}</span>
              </span>
              <span className="text-[10px] font-bold text-teal-600 shrink-0">Trocar IA</span>
            </button>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-2.5 px-3 space-y-1 custom-scrollbar">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200 space-y-2 shrink-0">
          <button
            type="button"
            onClick={() => setNightMode((prev) => !prev)}
            className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200/70 text-slate-700 transition-colors"
          >
            <span className="flex items-center gap-2">
              {nightMode ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>{nightMode ? 'Modo Plantão Noturno' : 'Modo Claro (Diurno)'}</span>
            </span>
            <span className="text-[10px] font-semibold text-teal-600">Alternar</span>
          </button>

          <PWAInstallButton />
          <button
            type="button"
            onClick={() => setIsShareModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white shadow-xs transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            Compartilhar com a Turma
          </button>
          <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
            <span>&copy; {new Date().getFullYear()} EvoluTigas</span>
            {currentUser && (
              <button
                type="button"
                onClick={logout}
                className="text-slate-500 hover:text-teal-700 font-medium hover:underline"
              >
                Trocar conta
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden h-13 shrink-0 bg-white border-b border-slate-200 flex items-center px-3 justify-between gap-2">
          <div className="flex items-center gap-1.5 text-teal-600 font-bold text-base shrink-0">
            <Activity className="w-5 h-5 shrink-0" />
            <span>EvoluTigas</span>
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <button
              type="button"
              onClick={() => setIsCommandOpen(true)}
              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md shrink-0"
              aria-label="Buscar leito ou calculadora"
            >
              <Search className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setNightMode((prev) => !prev)}
              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md shrink-0"
              aria-label="Alternar modo noturno"
            >
              {nightMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
            <PWAInstallButton compact />
            {currentUser && (
              <button
                type="button"
                onClick={() => setIsAiModalOpen(true)}
                className="flex items-center gap-1 px-2 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 text-xs font-medium whitespace-nowrap shrink-0"
              >
                <User className="w-3 h-3 text-teal-600 shrink-0" />
                <span className="max-w-[68px] truncate">{currentUser.name}</span>
              </button>
            )}
            <button
              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-md shrink-0"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6">
          <Outlet />
        </div>
      </main>

      {/* Offline Banner */}
      <OfflineIndicator />

      {/* Global Search Palette (Ctrl+K) */}
      <GlobalCommandPalette isOpen={isCommandOpen} onClose={() => setIsCommandOpen(false)} />

      {/* Global Modals (Connect Claude/ChatGPT/Gemini & Share with Classmates) */}
      <GlobalModals />
    </div>
  );
}

