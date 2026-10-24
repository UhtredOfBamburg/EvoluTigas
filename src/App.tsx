/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import { ToastProvider } from '@/hooks/useToast';
import { UserProvider } from '@/contexts/UserContext';
import { AuthGate } from '@/components/AuthGate';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

// Lazy load route pages to dramatically reduce initial bundle size and speed up page load
const Dashboard = lazy(() => import('./pages/Dashboard'));
const EnfermariaList = lazy(() => import('./pages/Enfermaria/EnfermariaList'));
const PatientDetails = lazy(() => import('./pages/Enfermaria/PatientDetails'));
const PatientNew = lazy(() => import('./pages/Enfermaria/PatientNew'));
const Ambulatorio = lazy(() => import('./pages/Ambulatorio'));
const Formularios = lazy(() => import('./pages/Formularios'));
const CriarFormulario = lazy(() => import('./pages/formularios/CriarFormulario'));
const TranscritorExames = lazy(() => import('./pages/TranscritorExames'));
const Calculadoras = lazy(() => import('./pages/Calculadoras'));
const AiTools = lazy(() => import('./pages/AiTools'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[300px] w-full text-teal-600">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        <span className="text-xs font-medium text-slate-500">Carregando módulo...</span>
      </div>
    </div>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <UserProvider>
        <AuthGate>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Page><Dashboard /></Page>} />
                <Route path="enfermaria" element={<Page><EnfermariaList /></Page>} />
                <Route path="enfermaria/novo" element={<Page><PatientNew /></Page>} />
                <Route path="enfermaria/paciente/:id" element={<Page><PatientDetails /></Page>} />
                <Route path="ambulatorio" element={<Page><Ambulatorio /></Page>} />
                <Route path="formularios" element={<Page><Formularios /></Page>} />
                <Route path="formularios/meus" element={<Page><Formularios /></Page>} />
                <Route path="formularios/novo" element={<Page><CriarFormulario /></Page>} />
                <Route path="transcritor" element={<Page><TranscritorExames /></Page>} />
                <Route path="calculadoras" element={<Page><Calculadoras /></Page>} />
                <Route path="ai-tools" element={<Page><AiTools /></Page>} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthGate>
      </UserProvider>
    </ToastProvider>
  );
}

