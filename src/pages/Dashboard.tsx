import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui';
import {
  Users,
  FileText,
  Activity,
  Bot,
  ChevronRight,
  Stethoscope,
  Bed,
  ScanText,
  Calculator,
  Plus,
  Share2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEnfermariaPatients, calculateDaysInterned } from '@/hooks/useEnfermariaPatients';
import { useFormTemplates } from '@/hooks/useFormTemplates';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useUser } from '@/contexts/UserContext';
import { getProviderLabel } from '@/components/ExternalAiModal';

export default function Dashboard() {
  const navigate = useNavigate();
  const { patients } = useEnfermariaPatients();
  const { templates } = useFormTemplates();
  const {
    currentUser,
    dailyLimit,
    remainingToday,
    setIsShareModalOpen,
    setIsAiModalOpen,
  } = useUser();
  const [ambulatorioPacientes] = useLocalStorage<any[]>('evolutigas_ambulatorio_pacientes_v1', []);
  const [savedTranscriptions] = useLocalStorage<any[]>('transcricoes_salvas', []);

  const internados = patients.filter((p) => p.status === 'internado');
  const openPendenciasTotal = internados.reduce(
    (acc, p) => acc + (p.pendencias || []).filter((item) => !item.done).length,
    0
  );
  const ambulatorioAtivos = ambulatorioPacientes.filter((p) => !p.archived);
  const activeProvider = currentUser?.aiConnections?.activeProvider || 'builtin';

  const stats = [
    {
      label: 'Meus Pacientes (Enfermaria)',
      value: String(internados.length),
      sub:
        openPendenciasTotal > 0
          ? `${openPendenciasTotal} pendência(s) aberta(s) no plantão`
          : `${patients.length} cadastrados na sua conta`,
      icon: Users,
      color: 'text-teal-600',
      to: '/enfermaria',
    },
    {
      label: 'Notas de Ambulatório',
      value: String(ambulatorioAtivos.length),
      sub: 'Atendimentos ativos na sua conta',
      icon: Stethoscope,
      color: 'text-blue-600',
      to: '/ambulatorio',
    },
    {
      label: 'Moldes & Transcrições',
      value: String(templates.length + savedTranscriptions.length),
      sub: `${templates.length} molde(s) próprio(s) · ${savedTranscriptions.length} transcrição(ões)`,
      icon: FileText,
      color: 'text-indigo-600',
      to: '/formularios',
    },
  ];

  const shortcuts = [
    {
      label: 'Enfermaria & Evolução',
      to: '/enfermaria',
      description: 'Evolução diária, checklist de pendências, Google Docs e passagem de plantão',
      icon: Activity,
    },
    {
      label: 'Ambulatório Inteligente',
      to: '/ambulatorio',
      description: 'Pré-consulta, HDA, exame físico, Google Docs, receitas e exames da consulta',
      icon: Stethoscope,
    },
    {
      label: 'Calculadoras & Guia DVA',
      to: '/calculadoras',
      description: 'CKD-EPI, Cockcroft-Gault, qSOFA, CURB-65, MELD-Na, Na+/Ca2+/AG e diluição de DVA',
      icon: Calculator,
    },
    {
      label: 'Transcritor & Formulários',
      to: '/transcritor',
      description: 'Extraia exames laboratoriais com (VR: XX) automático e gere receitas/AIH',
      icon: ScanText,
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Olá, {currentUser?.name || 'Colega'}!
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200">
              <ShieldCheck className="w-3.5 h-3.5" /> Espaço 100% Individual
            </span>
          </div>
          <p className="text-slate-500 mt-1 text-sm">
            Seus pacientes, evoluções e modelos de preenchimento ficam salvos exclusivamente na sua conta.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setIsShareModalOpen(true)}
            className="border-teal-200 text-teal-800 hover:bg-teal-50"
          >
            <Share2 className="w-4 h-4 mr-2 text-teal-600" /> Compartilhar com a Turma
          </Button>
          <Button variant="outline" onClick={() => navigate('/calculadoras')}>
            <Calculator className="w-4 h-4 mr-2" /> Calculadoras
          </Button>
          <Button onClick={() => navigate('/enfermaria/novo')} className="bg-teal-600 hover:bg-teal-700 text-white">
            <Plus className="w-4 h-4 mr-2" /> Admitir Paciente
          </Button>
        </div>
      </div>

      {/* Live Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <Card
            key={i}
            className="hover:border-teal-200 transition-colors cursor-pointer"
            onClick={() => navigate(stat.to)}
          >
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-400 mt-1">{stat.sub}</p>
              </div>
              <div className={`p-3 rounded-xl bg-slate-50 ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Access */}
      <div className="pt-2">
        <h2 className="text-lg font-semibold mb-3 text-slate-900">Módulos Principais</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {shortcuts.map((shortcut, i) => (
            <Card
              key={i}
              className="hover:border-teal-200 hover:shadow-md transition-all cursor-pointer group"
              onClick={() => navigate(shortcut.to)}
            >
              <CardContent className="p-5 flex flex-col h-full">
                <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center mb-3">
                  <shortcut.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-900 group-hover:text-teal-700 transition-colors">
                  {shortcut.label}
                </h3>
                <p className="text-xs text-slate-500 mt-1.5 flex-1 leading-relaxed">{shortcut.description}</p>
                <div className="mt-4 flex items-center text-xs font-semibold text-teal-600">
                  Acessar módulo <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Pacientes Internados Atualmente */}
      <Card>
        <CardHeader className="py-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-800">
            Meus Leitos Ocupados na Enfermaria ({internados.length})
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/enfermaria')} className="text-teal-600 text-xs">
            Ver todos <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {internados.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-400">
              Nenhum paciente internado na sua enfermaria no momento.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {internados.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/enfermaria/paciente/${p.id}`)}
                  className="p-4 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">{p.name}</span>
                      <span className="text-xs text-slate-500">
                        ({p.age}a, {p.sex})
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      <span className="font-medium text-teal-700 inline-flex items-center">
                        <Bed className="w-3 h-3 mr-1" /> {p.bed}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{calculateDaysInterned(p.admissionDate)}º DIH</span>
                      <span aria-hidden="true">·</span>
                      <span>HD: {p.diagnosis}</span>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 text-xs shrink-0">
                    Evoluir Paciente
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Connection Banner (Claude, ChatGPT, Gemini & Built-in) */}
      <Card className="bg-gradient-to-br from-teal-50 to-white border-teal-100">
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-teal-100 text-teal-700 rounded-full shrink-0">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-teal-900 text-base mb-1">
                IA Ativa: {getProviderLabel(activeProvider)}
                {activeProvider === 'builtin' ? ` (${remainingToday}/${dailyLimit} usos hoje)` : ''}
              </h3>
              <p className="text-teal-800/80 text-xs max-w-2xl leading-relaxed">
                Use a IA integrada gratuitamente ou conecte seu próprio <strong>Claude (Anthropic)</strong>, <strong>ChatGPT (OpenAI)</strong> ou <strong>Google Gemini</strong> para que todos os botões do aplicativo funcionem diretamente com a sua IA preferida.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setIsAiModalOpen(true)}
              className="border-teal-300 text-teal-800 bg-white hover:bg-teal-50"
            >
              <Sparkles className="w-4 h-4 mr-1.5 text-teal-600" /> Conectar Claude / ChatGPT / Gemini
            </Button>
            <Button
              onClick={() => navigate('/ai-tools')}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              Estúdio de Redação
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
