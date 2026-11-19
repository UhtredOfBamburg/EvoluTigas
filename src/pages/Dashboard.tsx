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
  BookOpenCheck,
  ScanText,
  Calculator,
  Plus,
  Share2,
  Sparkles,
  AlertCircle,
  Calendar,
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

  const todayFormatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date());

  const stats = [
    {
      label: 'Leitos Ativos',
      value: String(internados.length),
      sub:
        openPendenciasTotal > 0
          ? `${openPendenciasTotal} pendência(s) em aberto`
          : `${patients.length} paciente(s) no histórico`,
      highlight: openPendenciasTotal > 0,
      icon: Users,
      iconBg: 'bg-teal-50 text-teal-700',
      to: '/enfermaria',
    },
    {
      label: 'Ambulatório',
      value: String(ambulatorioAtivos.length),
      sub: 'Consultas em andamento',
      highlight: false,
      icon: Stethoscope,
      iconBg: 'bg-blue-50 text-blue-700',
      to: '/ambulatorio',
    },
    {
      label: 'Moldes & Exames',
      value: String(templates.length + savedTranscriptions.length),
      sub: `${templates.length} molde(s) · ${savedTranscriptions.length} transcrição(ões)`,
      highlight: false,
      icon: FileText,
      iconBg: 'bg-indigo-50 text-indigo-700',
      to: '/formularios',
    },
  ];

  const modules = [
    {
      label: 'Enfermaria',
      to: '/enfermaria',
      description: 'Evolução diária, pendências e passagem de plantão',
      icon: Activity,
      tone: 'bg-teal-50 text-teal-700',
    },
    {
      label: 'Ambulatório',
      to: '/ambulatorio',
      description: 'Pré-consulta, HDA, exame físico e prescrição',
      icon: Stethoscope,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Guia de Prescrições',
      to: '/prescricoes',
      description: 'Condutas PS e receitas prontas com envio direto para Formulários',
      icon: BookOpenCheck,
      tone: 'bg-teal-50 text-teal-700',
    },
    {
      label: 'Transcritor de Exames',
      to: '/transcritor',
      description: 'Extrai exames com (VR) automático de fotos e PDFs',
      icon: ScanText,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'Central de Formulários',
      to: '/formularios',
      description: 'Receitas, atestados, AIH e moldes PDF em 2 vias',
      icon: FileText,
      tone: 'bg-indigo-50 text-indigo-700',
    },
    {
      label: 'Calculadoras & DVA',
      to: '/calculadoras',
      description: 'CKD-EPI, qSOFA, CURB-65, MELD-Na, eletrólitos e DVA',
      icon: Calculator,
      tone: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Estúdio de Redação IA',
      to: '/ai-tools',
      description: 'Adaptar rascunhos SOAP, revisar texto e sumário rápido',
      icon: Bot,
      tone: 'bg-purple-50 text-purple-700',
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header focado no plantão */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mb-1">
            <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            <span className="capitalize">{todayFormatted}</span>
            <span aria-hidden="true">·</span>
            <span className="text-teal-700 font-semibold">Espaço Individual</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 truncate">
            Olá, {currentUser?.name || 'Colega'}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/prescricoes')}
            className="h-9 text-xs sm:text-sm"
          >
            <BookOpenCheck className="w-4 h-4 mr-1.5 text-teal-600" /> Guia de Prescrições
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/transcritor')}
            className="h-9 text-xs sm:text-sm"
          >
            <ScanText className="w-4 h-4 mr-1.5 text-teal-600" /> Transcrever Exame
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/enfermaria/novo')}
            className="h-9 text-xs sm:text-sm bg-teal-600 hover:bg-teal-700 text-white"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Admitir Paciente
          </Button>
        </div>
      </div>

      {/* Live Shift Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {stats.map((stat, i) => (
          <Card
            key={i}
            className="hover:border-teal-300/80 transition-colors cursor-pointer"
            onClick={() => navigate(stat.to)}
          >
            <CardContent className="p-4 flex flex-col justify-between gap-2 h-full">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider leading-tight">
                  {stat.label}
                </p>
                <div className={`p-2 rounded-lg shrink-0 ${stat.iconBg}`}>
                  <stat.icon className="w-4 h-4" />
                </div>
              </div>
              <div>
                <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums leading-none">
                  {stat.value}
                </p>
                <p
                  className={`text-xs mt-1.5 leading-snug ${
                    stat.highlight ? 'text-amber-700 font-semibold' : 'text-slate-500'
                  }`}
                >
                  {stat.sub}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Prioridade #1 do Plantão: Leitos Ocupados & Pendências */}
      <Card>
        <CardHeader className="py-3.5 px-5 border-b border-slate-100 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Bed className="w-4 h-4 text-teal-600" />
            <CardTitle className="text-sm sm:text-base font-semibold text-slate-900">
              Meus Leitos na Enfermaria ({internados.length})
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/enfermaria')}
            className="text-teal-700 text-xs h-7 px-2"
          >
            Ver todos <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {internados.length === 0 ? (
            <div className="p-7 text-center space-y-3">
              <p className="text-sm text-slate-500">
                Nenhum paciente internado na sua enfermaria no momento.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/enfermaria/novo')}
                className="border-teal-200 text-teal-700 hover:bg-teal-50"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Admitir primeiro paciente
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {internados.slice(0, 6).map((p) => {
                const openCount = (p.pendencias || []).filter((item) => !item.done).length;
                return (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/enfermaria/paciente/${p.id}`)}
                    className="px-4 sm:px-5 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200/70 tabular-nums shrink-0">
                          <Bed className="w-3 h-3" /> {p.bed || 'S/ leito'}
                        </span>
                        <span className="font-semibold text-sm text-slate-900 truncate">
                          {p.name}
                        </span>
                        <span className="text-xs text-slate-500 tabular-nums">
                          {p.age}a · {p.sex}
                        </span>
                        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 tabular-nums">
                          {calculateDaysInterned(p.admissionDate)}º DIH
                        </span>
                        {openCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 tabular-nums">
                            <AlertCircle className="w-3 h-3" />
                            {openCount} pendência{openCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {p.diagnosis && (
                        <p className="text-xs text-slate-500 truncate">
                          <span className="font-medium text-slate-600">HD:</span> {p.diagnosis}
                        </p>
                      )}
                    </div>
                    <Button variant="outline" size="sm" className="h-8 text-xs shrink-0">
                      Evoluir
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acesso Rápido aos Módulos */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Módulos Clínicos
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {modules.map((mod, i) => (
            <Card
              key={i}
              className="hover:border-teal-300/80 hover:shadow-sm transition-all cursor-pointer group"
              onClick={() => navigate(mod.to)}
            >
              <CardContent className="p-4 flex flex-col h-full">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 ${mod.tone}`}>
                  <mod.icon className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-sm text-slate-900 group-hover:text-teal-700 transition-colors">
                  {mod.label}
                </h3>
                <p className="text-xs text-slate-500 mt-1 flex-1 leading-relaxed">
                  {mod.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Barra Compacta de Status do Google Gemini & Compartilhamento */}
      <Card>
        <CardContent className="p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                IA Ativa: {getProviderLabel(activeProvider)}
                {activeProvider === 'builtin' ? ` (${remainingToday}/${dailyLimit} usos hoje)` : ''}
              </p>
              <p className="text-xs text-slate-500">
                Modelos Google Gemini atualizados automaticamente via AI Studio.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAiModalOpen(true)}
              className="border-teal-200 text-teal-800 hover:bg-teal-50 text-xs"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-teal-600" /> Configurar Gemini
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsShareModalOpen(true)}
              className="text-xs"
            >
              <Share2 className="w-3.5 h-3.5 mr-1.5 text-slate-500" /> Compartilhar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
