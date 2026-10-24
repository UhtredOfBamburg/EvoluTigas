import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, Button, Input } from '@/components/ui';
import {
  Search,
  Plus,
  User,
  Bed,
  Clock,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ClipboardList,
  Copy,
  Download,
  X,
  CheckSquare,
  Square,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEnfermariaPatients, calculateDaysInterned } from '@/hooks/useEnfermariaPatients';
import { useToast } from '@/hooks/useToast';
import { readScopedLocalStorage } from '@/hooks/useLocalStorage';
import { copyToClipboard } from '@/lib/utils';
import { jsPDF } from 'jspdf';

export default function Enfermaria() {
  const navigate = useNavigate();
  const {
    patients,
    updatePatient,
    deletePatient,
    addPendencia,
    togglePendencia,
    removePendencia,
  } = useEnfermariaPatients();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'internado' | 'alta' | 'todos'>('internado');
  const [newPendenciaInputs, setNewPendenciaInputs] = useState<Record<string, string>>({});
  const [expandedPendencias, setExpandedPendencias] = useState<Record<string, boolean>>({});
  const [isPassagemOpen, setIsPassagemOpen] = useState(false);

  const filtered = patients.filter((p) => {
    const matchesStatus = statusFilter === 'todos' ? true : p.status === statusFilter;
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(q) ||
      p.bed.toLowerCase().includes(q) ||
      p.diagnosis.toLowerCase().includes(q) ||
      (p.prontuario || '').toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const internados = patients.filter((p) => p.status === 'internado');
  const internadosCount = internados.length;
  const altaCount = patients.filter((p) => p.status === 'alta').length;

  const passagemTexto = useMemo(() => {
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    if (internados.length === 0) {
      return `PASSAGEM DE PLANTÃO — ENFERMARIA (${dataHoje})\n\nNenhum paciente internado no momento.`;
    }

    const blocos = internados.map((p, idx) => {
      const dih = calculateDaysInterned(p.admissionDate);
      const pendAbertas = (p.pendencias || []).filter((item) => !item.done);
      const pendConcluidas = (p.pendencias || []).filter((item) => item.done);

      let lastEvolResumo = '';
      try {
        const parsed = readScopedLocalStorage<Array<{ text?: string }>>(`historico_paciente_${p.id}`, []);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.text) {
          const firstLine = String(parsed[0].text)
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean)
            .slice(0, 3)
            .join(' | ');
          lastEvolResumo = firstLine.slice(0, 240);
        }
      } catch {
        // ignore storage parse error
      }

      const lines = [
        `${idx + 1}. *${p.bed}* — *${p.name}* (${p.age}a, ${p.sex})${p.prontuario ? ` [Pront: ${p.prontuario}]` : ''}`,
        `   • DIH: ${dih}º dia | HD: ${p.diagnosis}`,
        p.comorbidades ? `   • Antecedentes: ${p.comorbidades}` : '',
        p.antibioticos ? `   • ATB: ${p.antibioticos}` : '',
        p.dispositivos ? `   • Dispositivos: ${p.dispositivos}` : '',
        p.alergias && p.alergias !== 'Nega alergias' ? `   • ⚠️ ALERGIA: ${p.alergias}` : '',
        lastEvolResumo ? `   • Último registro: ${lastEvolResumo}` : '',
        pendAbertas.length > 0
          ? `   • Pendências do plantão (${pendAbertas.length}):\n` +
            pendAbertas.map((item) => `      [ ] ${item.text}`).join('\n')
          : '   • Pendências: Sem pendências abertas',
        pendConcluidas.length > 0
          ? `   • Concluídas hoje: ${pendConcluidas.map((i) => i.text).join('; ')}`
          : '',
      ].filter(Boolean);

      return lines.join('\n');
    });

    return [
      `📋 *PASSAGEM DE PLANTÃO / VISITA DE ENFERMARIA* — ${dataHoje}`,
      `Total de leitos ativos: ${internados.length}`,
      `--------------------------------------------------`,
      blocos.join('\n\n--------------------------------------------------\n\n'),
    ].join('\n');
  }, [internados]);

  const handleCopyPassagem = async () => {
    await copyToClipboard(passagemTexto);
    toast('Passagem de plantão copiada! Pronta para colar no WhatsApp.', 'success');
  };

  const handleDownloadPassagemPdf = () => {
    const doc = new jsPDF();
    const dataHoje = new Date().toLocaleString('pt-BR');
    doc.setFontSize(14);
    doc.text('Folha de Passagem de Plantao e Visita - Enfermaria', 105, 16, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Gerado em: ${dataHoje} | Leitos ocupados: ${internados.length}`, 15, 24);
    doc.line(15, 27, 195, 27);

    const cleanText = passagemTexto.replace(/\*/g, '').replace(/📋|⚠️/g, '');
    doc.setFontSize(9.5);
    const splitText = doc.splitTextToSize(cleanText, 180);
    let y = 34;
    for (let i = 0; i < splitText.length; i++) {
      if (y > 280) {
        doc.addPage();
        y = 18;
      }
      doc.text(splitText[i], 15, y);
      y += 5;
    }
    doc.save(`Passagem_Plantao_Enfermaria_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast('PDF da passagem de plantão baixado!', 'success');
  };

  const handleAddPendenciaSubmit = (patientId: string) => {
    const text = (newPendenciaInputs[patientId] || '').trim();
    if (!text) return;
    addPendencia(patientId, text);
    setNewPendenciaInputs((prev) => ({ ...prev, [patientId]: '' }));
    toast('Pendência adicionada ao leito.', 'success');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Enfermaria</h1>
          <p className="text-slate-500 mt-1 text-sm">
            Gerencie os pacientes internados, evoluções diárias, checklist de pendências e passagem de plantão.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => setIsPassagemOpen(true)}
            className="border-teal-200 text-teal-800 hover:bg-teal-50"
          >
            <ClipboardList className="w-4 h-4 mr-2 text-teal-600" />
            Passagem de Plantão ({internadosCount})
          </Button>
          <Button onClick={() => navigate('/enfermaria/novo')} className="bg-teal-600 hover:bg-teal-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Novo Paciente
          </Button>
        </div>
      </div>

      {/* Modal de Passagem de Plantão Geral */}
      {isPassagemOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-teal-600" />
                  Passagem de Plantão Geral — Todos os Leitos Internados
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Resumo consolidado com leito, DIH, diagnóstico, ATB, dispositivos e pendências abertas.
                </p>
              </div>
              <button
                onClick={() => setIsPassagemOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              <pre className="text-xs font-mono whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border border-slate-200 text-slate-800 leading-relaxed">
                {passagemTexto}
              </pre>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setIsPassagemOpen(false)}>
                Fechar
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPassagemPdf}>
                <Download className="w-4 h-4 mr-1.5 text-teal-600" />
                Baixar Folha em PDF
              </Button>
              <Button
                size="sm"
                onClick={handleCopyPassagem}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                <Copy className="w-4 h-4 mr-1.5" />
                Copiar para WhatsApp
              </Button>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-4 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nome, leito, prontuário ou diagnóstico..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
              <button
                onClick={() => setStatusFilter('internado')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === 'internado'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Internados ({internadosCount})
              </button>
              <button
                onClick={() => setStatusFilter('alta')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === 'alta'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Alta ({altaCount})
              </button>
              <button
                onClick={() => setStatusFilter('todos')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === 'todos'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({patients.length})
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {filtered.map((patient) => {
              const dih = calculateDaysInterned(patient.admissionDate);
              const pendencias = patient.pendencias || [];
              const openPendenciasCount = pendencias.filter((item) => !item.done).length;
              const isPendenciaOpen = expandedPendencias[patient.id] ?? openPendenciasCount > 0;

              return (
                <div
                  key={patient.id}
                  className="p-4 hover:bg-slate-50/70 transition-colors space-y-3"
                >
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer gap-4"
                    onClick={() => navigate(`/enfermaria/paciente/${patient.id}`)}
                  >
                    <div className="flex items-start gap-4">
                      <div className="p-2.5 bg-teal-50 text-teal-600 rounded-full shrink-0 mt-0.5">
                        <User className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-900">{patient.name}</h3>
                          <span className="text-xs text-slate-500">
                            {patient.age} anos · {patient.sex}
                            {patient.prontuario ? ` · Pront: ${patient.prontuario}` : ''}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center font-medium text-teal-700">
                            <Bed className="w-3.5 h-3.5 mr-1" /> {patient.bed}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">DIH: {dih}º dia</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium text-slate-800">HD: {patient.diagnosis}</span>
                        </div>
                        {(patient.antibioticos || (patient.alergias && patient.alergias !== 'Nega alergias')) && (
                          <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap pt-0.5">
                            {patient.antibioticos && <span>ATB: {patient.antibioticos}</span>}
                            {patient.alergias && patient.alergias !== 'Nega alergias' && (
                              <span className="text-amber-700 font-medium inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> Alergia: {patient.alergias}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                      <div className="text-xs text-slate-400 flex items-center">
                        <Clock className="w-3 h-3 mr-1" />
                        Última atualização: {patient.lastUpdate}
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-8 text-xs ${
                            openPendenciasCount > 0
                              ? 'text-amber-700 hover:text-amber-800 bg-amber-50/70'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                          onClick={() =>
                            setExpandedPendencias((prev) => ({
                              ...prev,
                              [patient.id]: !isPendenciaOpen,
                            }))
                          }
                        >
                          <CheckSquare className="w-3.5 h-3.5 mr-1" />
                          Pendências ({openPendenciasCount})
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-slate-500 hover:text-teal-700"
                          onClick={() => {
                            const nextStatus = patient.status === 'internado' ? 'alta' : 'internado';
                            updatePatient(patient.id, { status: nextStatus });
                            toast(
                              nextStatus === 'alta'
                                ? `Paciente ${patient.name} movido para Alta.`
                                : `Paciente ${patient.name} reativado na Enfermaria.`,
                              'info'
                            );
                          }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          {patient.status === 'internado' ? 'Dar Alta' : 'Reinternar'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-600"
                          title="Remover paciente"
                          onClick={() => {
                            deletePatient(patient.id);
                            toast(`Paciente ${patient.name} removido.`, 'info');
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => navigate(`/enfermaria/paciente/${patient.id}`)}
                        >
                          Abrir Prontuário
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Checklist rápido de pendências por leito */}
                  {isPendenciaOpen && (
                    <div
                      className="ml-0 sm:ml-14 p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          Checklist de Pendências do Leito ({openPendenciasCount} em aberto)
                        </span>
                      </div>

                      {pendencias.length > 0 && (
                        <div className="space-y-1.5">
                          {pendencias.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-2 text-xs bg-white px-2.5 py-1.5 rounded border border-slate-200/70"
                            >
                              <button
                                type="button"
                                onClick={() => togglePendencia(patient.id, item.id)}
                                className="flex items-center gap-2 text-left flex-1"
                              >
                                {item.done ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                )}
                                <span
                                  className={
                                    item.done ? 'line-through text-slate-400' : 'text-slate-700 font-medium'
                                  }
                                >
                                  {item.text}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => removePendencia(patient.id, item.id)}
                                className="text-slate-300 hover:text-red-500 p-0.5"
                                title="Excluir pendência"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <Input
                          placeholder="Nova pendência (ex: Cobrar cultura, pedir parecer da Cardio, agendar TC)..."
                          className="h-8 text-xs bg-white"
                          value={newPendenciaInputs[patient.id] || ''}
                          onChange={(e) =>
                            setNewPendenciaInputs((prev) => ({
                              ...prev,
                              [patient.id]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddPendenciaSubmit(patient.id);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs shrink-0 bg-white"
                          onClick={() => handleAddPendenciaSubmit(patient.id)}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="p-10 text-center text-slate-500">
                Nenhum paciente encontrado neste filtro.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

