import React, { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, Button, Label, Input, Textarea } from '@/components/ui';
import { SelectField, ToggleButtons, MultiSelectButtons } from '@/components/FormControls';
import { AiOutputPanel } from '@/components/AiOutputPanel';
import {
  ArrowLeft,
  Loader2,
  Copy,
  Download,
  FileText,
  CheckCircle2,
  Clock,
  ClipboardPlus,
  Trash2,
  Sparkles,
  FileCheck,
  Bed,
  AlertTriangle,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useAiGenerate } from '@/hooks/useAiGenerate';
import { useToast } from '@/hooks/useToast';
import { useLocalStorage, readScopedLocalStorage, writeScopedLocalStorage } from '@/hooks/useLocalStorage';
import { useEnfermariaPatients, calculateDaysInterned } from '@/hooks/useEnfermariaPatients';
import { copyToClipboard } from '@/lib/utils';
import { GoogleDocsConnector } from '@/components/GoogleDocsConnector';
import type { GoogleDocExtracted } from '@/lib/googleDocs';
import {
  PhysicalExamSection,
  DEFAULT_PHYSICAL_EXAM_DATA,
  computeImcFromWeightHeight,
} from '@/components/PhysicalExamSection';

interface HistoryEntry {
  id: string;
  date: string;
  text: string;
  type?: 'evolucao' | 'admissao' | 'alta';
}

export default function PatientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getPatientById, updatePatient } = useEnfermariaPatients();
  const patient = getPatientById(id);

  const [activeTab, setActiveTab] = useState<'evolucao' | 'admissao' | 'alta' | 'historico'>('evolucao');
  const [history, setHistory] = useLocalStorage<HistoryEntry[]>(`historico_paciente_${id}`, []);
  const [compactMode, setCompactMode] = useLocalStorage<boolean>('evolutigas_compact_forms_v1', true);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string>('');
  const { toast } = useToast();

  const patientName = patient?.name || (id === '1' ? 'João Silva Oliveira' : id === '2' ? 'Maria Santos Souza' : 'Paciente');
  const patientBed = patient?.bed || 'Leito 12A';
  const patientDiagnosis = patient?.diagnosis || 'Pneumonia Adquirida na Comunidade';
  const dih = calculateDaysInterned(patient?.admissionDate);

  const [formData, setFormData] = useState({
    // 1. Estado Atual
    local: 'Enfermaria',
    acompanhante: 'Desacompanhado',
    consciencia: 'Acordado',
    orientacao: 'Lúcido',
    respiratorio: 'Eupneico',
    suporteO2: 'Ar ambiente',
    suporteO2Fluxo: '',
    desconfortoResp: 'Sem sinais',
    hemodinamica: 'Estável',
    dva: 'Sem DVA',
    dvaDetalhe: '',

    // 2. Relato do Período
    statusQueixa: 'Nega queixas',
    subjetivoLivre: '',
    sonoQualidade: 'Boa noite de sono',
    sonoTipo: 'Reparador',
    sonoObs: '',
    dietaVia: 'VO',
    dietaAceitacao: 'Boa',
    dietaObs: '',
    diureseVol: 'Preservada',
    diureseAspecto: 'Amarelo claro (normal)',
    diureseDebito: '',
    diureseObs: '',
    evacuacaoFreq: 'Presente no período',
    evacuacaoObs: '',
    deambulacaoStatus: 'Deambulou',
    deambulacaoObs: '',
    dor: 'Ausente',
    dorDetalhe: '',
    outrasQueixas: [] as string[],
    intercorrencias: 'Sem intercorrências',
    intercorrenciasDetalhe: '',

    // 3. Exame Físico (compartilhado)
    ...DEFAULT_PHYSICAL_EXAM_DATA,

    // 4. Exames, Impressão e Conduta
    antibioticosEmUso: patient?.antibioticos || '',
    dispositivosEmUso: patient?.dispositivos || '',
    examesRecentes: '',
    impressaoClinica: 'Paciente hemodinamicamente estável, afebril, com boa evolução clínica nas últimas 24h.',
    condutaPlano: '- Manter prescrição médica otimizada;\n- Fisioterapia motora e respiratória;\n- Profilaxia de TEV e úlcera de estresse;\n- Vigilância clínica e laboratorial.',
  });

  const computedImc = useMemo(
    () => computeImcFromWeightHeight(formData.peso, formData.altura),
    [formData.peso, formData.altura]
  );

  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleQueixa = (q: string) => {
    setFormData((prev) => {
      const exists = prev.outrasQueixas.includes(q);
      if (exists) return { ...prev, outrasQueixas: prev.outrasQueixas.filter((x) => x !== q) };
      return { ...prev, outrasQueixas: [...prev.outrasQueixas, q] };
    });
  };

  const { generate } = useAiGenerate();

  const patientInfoPayload = useMemo(
    () => ({
      name: patientName,
      age: patient?.age,
      sex: patient?.sex,
      bed: patientBed,
      dih: `${dih}º DIH`,
      diagnosis: patientDiagnosis,
      comorbidades: patient?.comorbidades,
      alergias: patient?.alergias,
      antibioticos: formData.antibioticosEmUso || patient?.antibioticos,
      dispositivos: formData.dispositivosEmUso || patient?.dispositivos,
      admissionDate: patient?.admissionDate,
    }),
    [patientName, patient, patientBed, dih, patientDiagnosis, formData.antibioticosEmUso, formData.dispositivosEmUso]
  );

  const handleGenerate = async () => {
    setIsGenerating(true);
    const text = await generate<string>({
      type: 'evolucao',
      formData: {
        ...formData,
        imc: computedImc,
        patientInfo: patientInfoPayload,
      },
      errorMessage: 'Erro ao gerar evolução. Tente novamente.',
    });
    if (text) setGeneratedText(text);
    setIsGenerating(false);
  };

  const handleCopy = async (textToCopy: string) => {
    await copyToClipboard(textToCopy);
    toast('Texto copiado para a área de transferência!', 'success');
  };

  const exportDocumentPdf = (title: string, content: string, filenamePrefix: string) => {
    const doc = new jsPDF();
    doc.setFontSize(15);
    doc.text(title, 105, 18, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Paciente: ${patientName} | Leito: ${patientBed}`, 20, 30);
    doc.text(`HD: ${patientDiagnosis} | Data: ${new Date().toLocaleString('pt-BR')}`, 20, 36);
    doc.line(20, 40, 190, 40);
    doc.setFontSize(10.5);
    const splitText = doc.splitTextToSize(content, 170);
    let y = 48;
    for (let i = 0; i < splitText.length; i++) {
      if (y > 275) {
        doc.addPage();
        y = 20;
      }
      doc.text(splitText[i], 20, y);
      y += 5.5;
    }
    doc.save(`${filenamePrefix}_${patientName.replace(/\s+/g, '_')}.pdf`);
  };

  const saveEntryToHistory = (text: string, type: 'evolucao' | 'admissao' | 'alta', label: string) => {
    if (!text) return;
    const nowStr = new Date().toLocaleString('pt-BR');
    const newEntry: HistoryEntry = {
      id: Date.now().toString(),
      date: nowStr,
      text,
      type,
    };
    setHistory((prev) => [newEntry, ...prev]);
    if (id) {
      updatePatient(id, {
        lastUpdate: `Hoje, ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        antibioticos: formData.antibioticosEmUso || patient?.antibioticos,
        dispositivos: formData.dispositivosEmUso || patient?.dispositivos,
      });
    }
    toast(`${label} salva no histórico do paciente!`, 'success');
  };

  const handleImportFromGoogleDoc = async (extracted: GoogleDocExtracted, autoProcessFields = false) => {
    const docText = extracted.text;
    if (!docText.trim()) {
      toast('O documento selecionado no Google Docs está vazio.', 'error');
      return;
    }

    setGeneratedText(docText);
    const nowStr = new Date().toLocaleString('pt-BR');
    const newEntry: HistoryEntry = {
      id: Date.now().toString(),
      date: `${nowStr} (Google Docs: ${extracted.title})`,
      text: docText,
      type: 'evolucao',
    };
    setHistory((prev) => [newEntry, ...prev]);

    if (id) {
      updatePatient(id, {
        lastUpdate: `Docs, ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
        googleDoc: {
          docId: extracted.documentId,
          title: extracted.title,
          url: extracted.url,
          lastSyncedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        },
      });
    }

    if (autoProcessFields) {
      setFormData((prev) => ({
        ...prev,
        subjetivoLivre: docText.slice(0, 600),
        impressaoClinica: `Evolução importada do Google Doc "${extracted.title}".`,
      }));
      setAdmissaoData((prev) => ({
        ...prev,
        hdaTexto: prev.hdaTexto || docText,
      }));
      toast(`Evolução importada de "${extracted.title}", salva no histórico e conectada aos campos!`, 'success');
    } else {
      toast(`Evolução importada do Google Doc "${extracted.title}" com sucesso!`, 'success');
    }
  };

  // --- Admissão ---
  const [admissaoData, setAdmissaoData] = useState({
    qp: '',
    hdaDuracao: '',
    hdaCaracteristicas: [] as string[],
    hdaTexto: '',
    appComorbidades: [] as string[],
    appOutros: patient?.comorbidades || '',
    medicacoesUso: '',
    alergias: patient?.alergias && patient.alergias !== 'Nega alergias' ? 'Alergia medicamentosa' : 'Nega alergias',
    alergiasDetalhe: patient?.alergias && patient.alergias !== 'Nega alergias' ? patient.alergias : '',
    historiaFamiliar: '',
    tabagismo: 'Não tabagista',
    etilismo: 'Não etilista',
    atividadeFisica: 'Sedentário',
    efPa: '120x80',
    efFc: '76',
    efFr: '16',
    efTemp: '36.6',
    efSpo2: '98',
    efGeral: 'Sem alterações',
    efGeralObs: '',
    efCv: 'Sem alterações',
    efCvObs: '',
    efResp: 'Sem alterações',
    efRespObs: '',
    efAbd: 'Sem alterações',
    efAbdObs: '',
    efNeuro: 'Sem alterações',
    efNeuroObs: '',
    examesAdmissao: '',
    hipoteseDiagnostica: patientDiagnosis,
    condutaAdmissao: '- Internação em leito de enfermaria;\n- Dieta conforme aceitação;\n- Hidratação venosa e sintomáticos;\n- Solicito rotina laboratorial de entrada.',
  });
  const [admissaoGeneratedText, setAdmissaoGeneratedText] = useState('');
  const [isGeneratingAdmissao, setIsGeneratingAdmissao] = useState(false);

  const handleAdmissaoChange = (field: string, value: any) => {
    setAdmissaoData((prev) => ({ ...prev, [field]: value }));
  };

  const handleGenerateAdmissao = async () => {
    setIsGeneratingAdmissao(true);
    const text = await generate<string>({
      type: 'admissao',
      formData: {
        ...admissaoData,
        patientInfo: patientInfoPayload,
      },
      errorMessage: 'Erro ao gerar nota de admissão. Tente novamente.',
    });
    if (text) setAdmissaoGeneratedText(text);
    setIsGeneratingAdmissao(false);
  };

  // --- Sumário de Alta ---
  const [altaData, setAltaData] = useState({
    diagnosticoAlta: patientDiagnosis,
    comorbidades: patient?.comorbidades || '',
    resumoInternacao: `Paciente admitido em ${patient?.admissionDate ? patient.admissionDate.split('-').reverse().join('/') : 'enfermaria'} por quadro de ${patientDiagnosis}. Recebeu tratamento clínico e suporte multidisciplinar (${patient?.antibioticos || 'terapia instituída'}), evoluindo com resolução clínica, estabilidade hemodinâmica e melhora laboratorial.`,
    examesRelevantes: '',
    condicaoAlta: 'Bom estado geral, lúcido e orientado, afebril há mais de 48h, eupneico em ar ambiente, boa aceitação da via oral.',
    prescricaoAlta: '1. Manter medicações de uso contínuo habituais;\n2. Dipirona 500mg VO 6/6h se dor ou febre.',
    orientacoesAlta: '- Retorno ambulatorial em 7 a 14 dias com exames de controle;\n- Retornar imediatamente ao Pronto-Socorro em caso de febre persistente, falta de ar, dor intensa ou piora do estado geral.',
  });
  const [altaGeneratedText, setAltaGeneratedText] = useState('');
  const [isGeneratingAlta, setIsGeneratingAlta] = useState(false);

  const handleGenerateAlta = async () => {
    setIsGeneratingAlta(true);
    const text = await generate<string>({
      type: 'sumario-alta',
      formData: {
        ...altaData,
        patientInfo: patientInfoPayload,
      },
      errorMessage: 'Erro ao gerar sumário de alta. Tente novamente.',
    });
    if (text) setAltaGeneratedText(text);
    setIsGeneratingAlta(false);
  };

  const queixasOpcoes = [
    'Febre',
    'Tosse',
    'Náusea',
    'Vômitos',
    'Tontura',
    'Cefaleia',
    'Dispneia',
    'Palpitações',
    'Edema',
    'Lipotímia',
    'Alteração urinária',
    'Outras',
  ];

  const draftReadyRef = React.useRef(false);

  // Auto-load & Auto-save continuous draft per patient (scoped per user & synced to cloud)
  useEffect(() => {
    if (!id) return;
    draftReadyRef.current = false;
    const draftKey = `rascunho_enfermaria_v1_${id}`;
    const applyDraft = () => {
      const parsed = readScopedLocalStorage<any>(draftKey, null);
      if (parsed) {
        if (parsed.formData) setFormData((prev) => ({ ...prev, ...parsed.formData }));
        if (parsed.generatedText !== undefined) setGeneratedText(parsed.generatedText);
        if (parsed.admissaoData) setAdmissaoData((prev) => ({ ...prev, ...parsed.admissaoData }));
        if (parsed.admissaoGeneratedText !== undefined) setAdmissaoGeneratedText(parsed.admissaoGeneratedText);
        if (parsed.altaData) setAltaData((prev) => ({ ...prev, ...parsed.altaData }));
        if (parsed.altaGeneratedText !== undefined) setAltaGeneratedText(parsed.altaGeneratedText);
        if (parsed.savedAt) setLastAutoSavedAt(parsed.savedAt);
      }
    };
    applyDraft();
    const timer = setTimeout(() => {
      draftReadyRef.current = true;
    }, 100);

    const onStorageSync = (e: Event) => {
      const custom = e as CustomEvent<{ rawKey?: string }>;
      if (custom.detail?.rawKey === draftKey) {
        applyDraft();
      }
    };
    window.addEventListener('evolutigas-storage-sync', onStorageSync);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('evolutigas-storage-sync', onStorageSync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!id || !draftReadyRef.current) return;
    const timer = setTimeout(() => {
      const nowTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      writeScopedLocalStorage(
        `rascunho_enfermaria_v1_${id}`,
        {
          formData,
          generatedText,
          admissaoData,
          admissaoGeneratedText,
          altaData,
          altaGeneratedText,
          savedAt: nowTime,
        },
        true
      );
      setLastAutoSavedAt(nowTime);
    }, 600);
    return () => clearTimeout(timer);
  }, [id, formData, generatedText, admissaoData, admissaoGeneratedText, altaData, altaGeneratedText]);


  return (
    <div className={`space-y-4 max-w-5xl mx-auto pb-20 ${compactMode ? 'compact-clinical-form' : ''}`}>
      {/* Header do Paciente */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/enfermaria')} className="mt-0.5 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{patientName}</h1>
              {patient?.age ? (
                <span className="text-xs text-slate-500">
                  {patient.age} anos · {patient.sex} {patient.prontuario ? `· Pront: ${patient.prontuario}` : ''}
                </span>
              ) : null}
              {lastAutoSavedAt && (
                <span className="text-[11px] text-teal-700 font-medium">
                  · Rascunho auto-salvo às {lastAutoSavedAt}
                </span>
              )}
            </div>
            <div className="text-xs text-slate-600 flex items-center gap-2 flex-wrap mt-1">
              <span className="font-semibold text-teal-700 inline-flex items-center">
                <Bed className="w-3.5 h-3.5 mr-1" /> {patientBed}
              </span>
              <span aria-hidden="true">·</span>
              <span>{dih}º DIH</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-slate-800">HD: {patientDiagnosis}</span>
              {patient?.alergias && patient.alergias !== 'Nega alergias' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-700 font-semibold inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Alergia: {patient.alergias}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap self-end md:self-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCompactMode((prev) => !prev)}
            className="h-8 text-xs border-slate-200 text-slate-600 hover:bg-slate-100"
            title="Alternar densidade dos campos da ficha clínica"
          >
            {compactMode ? (
              <>
                <Maximize2 className="w-3.5 h-3.5 mr-1 text-teal-600" /> Modo Padrão
              </>
            ) : (
              <>
                <Minimize2 className="w-3.5 h-3.5 mr-1 text-teal-600" /> Modo Compacto
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-teal-200 text-teal-800 hover:bg-teal-50"
            onClick={() =>
              navigate('/formularios', {
                state: {
                  formType: 'receita',
                  patientName,
                  prescricao: altaData.prescricaoAlta,
                },
              })
            }
          >
            <FileText className="w-3.5 h-3.5 mr-1 text-teal-600" /> Receita
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-teal-200 text-teal-800 hover:bg-teal-50"
            onClick={() =>
              navigate('/formularios', {
                state: {
                  formType: 'exames',
                  patientName,
                  indicacaoClinica: patientDiagnosis,
                },
              })
            }
          >
            <FileText className="w-3.5 h-3.5 mr-1 text-teal-600" /> Exames
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-teal-200 text-teal-800 hover:bg-teal-50"
            onClick={() =>
              navigate('/formularios', {
                state: {
                  formType: 'atestado',
                  patientName,
                },
              })
            }
          >
            <FileText className="w-3.5 h-3.5 mr-1 text-teal-600" /> Atestado
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-teal-200 text-teal-800 hover:bg-teal-50"
            onClick={() =>
              navigate('/formularios', {
                state: {
                  formType: 'aih',
                  patientName,
                  indicacaoClinica: patientDiagnosis,
                },
              })
            }
          >
            <FileText className="w-3.5 h-3.5 mr-1 text-teal-600" /> AIH
          </Button>
        </div>
      </div>

      {/* Conector Google Docs da Enfermaria */}
      <GoogleDocsConnector
        mode="enfermaria"
        patientName={patientName}
        linkedDoc={patient?.googleDoc || null}
        onUpdateLinkedDoc={(doc) => {
          if (id) {
            updatePatient(id, { googleDoc: doc });
          }
        }}
        onImportText={handleImportFromGoogleDoc}
        exportText={
          activeTab === 'admissao'
            ? admissaoGeneratedText
            : activeTab === 'alta'
            ? altaGeneratedText
            : generatedText || history[0]?.text || ''
        }
        exportDefaultTitle={`Evolução Enfermaria - ${patientName} (${patientBed})`}
      />

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'evolucao'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('evolucao')}
        >
          Evolução Diária
        </button>
        <button
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'admissao'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('admissao')}
        >
          Nota de Admissão
        </button>
        <button
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'alta'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('alta')}
        >
          Sumário de Alta
        </button>
        <button
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'historico'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
          onClick={() => setActiveTab('historico')}
        >
          Histórico ({history.length})
        </button>
      </div>

      {activeTab === 'evolucao' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6 h-[820px] overflow-y-auto pr-2 custom-scrollbar">
            {history.length > 0 && (
              <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs text-teal-900">
                  <span className="font-semibold">Último registro salvo:</span> {history[0].date}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs bg-white border-teal-300 text-teal-800 hover:bg-teal-100 shrink-0"
                  onClick={() => {
                    setGeneratedText(history[0].text);
                    toast('Última evolução carregada no editor ao lado para atualização do dia!', 'success');
                  }}
                >
                  <Clock className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
                  Puxar Última Evolução como Base
                </Button>
              </div>
            )}
            {/* 1. Estado Atual */}
            <Card>
              <CardHeader className="py-3 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-base">Parte 1 — Estado Atual e Dispositivos</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <SelectField
                    label="Local"
                    value={formData.local}
                    onChange={(v: string) => handleInputChange('local', v)}
                    options={['Enfermaria', 'UTI', 'Semi-intensiva', 'Pronto-Socorro', 'Outro']}
                  />
                  <SelectField
                    label="Acompanhante"
                    value={formData.acompanhante}
                    onChange={(v: string) => handleInputChange('acompanhante', v)}
                    options={['Desacompanhado', 'Acompanhado']}
                  />
                  <SelectField
                    label="Estado de consciência"
                    value={formData.consciencia}
                    onChange={(v: string) => handleInputChange('consciencia', v)}
                    options={['Acordado', 'Sonolento', 'Torporoso', 'Sedado']}
                  />
                  <SelectField
                    label="Orientação"
                    value={formData.orientacao}
                    onChange={(v: string) => handleInputChange('orientacao', v)}
                    options={['Lúcido', 'Confuso', 'Desorientado']}
                  />
                  <SelectField
                    label="Padrão respiratório"
                    value={formData.respiratorio}
                    onChange={(v: string) => handleInputChange('respiratorio', v)}
                    options={['Eupneico', 'Taquipneico', 'Dispneico', 'Bradipneico']}
                  />
                  <div>
                    <SelectField
                      label="Suporte de O₂"
                      value={formData.suporteO2}
                      onChange={(v: string) => handleInputChange('suporteO2', v)}
                      options={['Ar ambiente', 'Cateter Nasal', 'Máscara', 'VNI', 'VMI']}
                    />
                    {formData.suporteO2 !== 'Ar ambiente' && (
                      <div className="mt-2">
                        <Input
                          placeholder="Fluxo / FiO2 (ex: 2 L/min)..."
                          className="h-8 text-xs"
                          value={formData.suporteO2Fluxo}
                          onChange={(e) => handleInputChange('suporteO2Fluxo', e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                  <SelectField
                    label="Desconforto respiratório"
                    value={formData.desconfortoResp}
                    onChange={(v: string) => handleInputChange('desconfortoResp', v)}
                    options={['Sem sinais', 'Com sinais']}
                  />
                  <SelectField
                    label="Hemodinâmica"
                    value={formData.hemodinamica}
                    onChange={(v: string) => handleInputChange('hemodinamica', v)}
                    options={['Estável', 'Instável']}
                  />
                  <div>
                    <SelectField
                      label="Drogas vasoativas"
                      value={formData.dva}
                      onChange={(v: string) => handleInputChange('dva', v)}
                      options={['Sem DVA', 'Com DVA']}
                    />
                    {formData.dva === 'Com DVA' && (
                      <Input
                        placeholder="Ex: Noradrenalina 4 ml/h"
                        className="h-8 text-xs mt-2"
                        value={formData.dvaDetalhe}
                        onChange={(e) => handleInputChange('dvaDetalhe', e.target.value)}
                      />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Antibióticos em Uso (com D0/D1...)</Label>
                    <Input
                      placeholder="Ex: Ceftriaxona 2g/dia (D4)"
                      className="h-8 text-xs"
                      value={formData.antibioticosEmUso}
                      onChange={(e) => handleInputChange('antibioticosEmUso', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Dispositivos Invasivos</Label>
                    <Input
                      placeholder="Ex: AVP em MSE, SVD"
                      className="h-8 text-xs"
                      value={formData.dispositivosEmUso}
                      onChange={(e) => handleInputChange('dispositivosEmUso', e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 2. Relato do Período */}
            <Card>
              <CardHeader className="py-3 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-base">Parte 2 — Subjetivo e Relato das 24h</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <SelectField
                  label="Evolução da Queixa Principal"
                  value={formData.statusQueixa}
                  onChange={(v: string) => handleInputChange('statusQueixa', v)}
                  options={['Nega queixas', 'Melhora', 'Estável', 'Piora']}
                />

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-500">Relato subjetivo adicional (opcional)</Label>
                  <Textarea
                    placeholder="Ex: Paciente refere melhora importante da dispneia, nega novos picos febris desde ontem..."
                    className="min-h-[60px] text-xs"
                    value={formData.subjetivoLivre}
                    onChange={(e) => handleInputChange('subjetivoLivre', e.target.value)}
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-lg space-y-3">
                  <h4 className="text-sm font-medium text-slate-700">Sono</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField
                      label="Qualidade"
                      value={formData.sonoQualidade}
                      onChange={(v: string) => handleInputChange('sonoQualidade', v)}
                      options={['Boa noite de sono', 'Sono regular', 'Sono ruim']}
                    />
                    <SelectField
                      label="Tipo"
                      value={formData.sonoTipo}
                      onChange={(v: string) => handleInputChange('sonoTipo', v)}
                      options={['Reparador', 'Fragmentado']}
                    />
                  </div>
                  <Input
                    placeholder="Observações sobre o sono"
                    className="h-8 text-xs"
                    value={formData.sonoObs}
                    onChange={(e) => handleInputChange('sonoObs', e.target.value)}
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-lg space-y-3">
                  <h4 className="text-sm font-medium text-slate-700">Dieta</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField
                      label="Via"
                      value={formData.dietaVia}
                      onChange={(v: string) => handleInputChange('dietaVia', v)}
                      options={['VO', 'Enteral (SNE)', 'Parenteral (NPT)', 'Zero/Jejum']}
                    />
                    <SelectField
                      label="Aceitação"
                      value={formData.dietaAceitacao}
                      onChange={(v: string) => handleInputChange('dietaAceitacao', v)}
                      options={['Boa', 'Parcial', 'Ruim']}
                    />
                  </div>
                  <Input
                    placeholder="Observações (náusea, vômito, hiporexia)"
                    className="h-8 text-xs"
                    value={formData.dietaObs}
                    onChange={(e) => handleInputChange('dietaObs', e.target.value)}
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-lg space-y-3">
                  <h4 className="text-sm font-medium text-slate-700">Diurese</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField
                      label="Volume"
                      value={formData.diureseVol}
                      onChange={(v: string) => handleInputChange('diureseVol', v)}
                      options={['Preservada', 'Aumentada/Poliúria', 'Oligúria', 'Anúria', 'SVD']}
                    />
                    <SelectField
                      label="Aspecto"
                      value={formData.diureseAspecto}
                      onChange={(v: string) => handleInputChange('diureseAspecto', v)}
                      options={['Amarelo claro (normal)', 'Clara/Transparente', 'Concentrada', 'Colúria', 'Hematúria']}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-slate-500">Débito 24h (mL) - opcional</Label>
                      <Input
                        placeholder="Ex: 1400"
                        className="h-8 text-xs"
                        type="number"
                        value={formData.diureseDebito}
                        onChange={(e) => handleInputChange('diureseDebito', e.target.value)}
                      />
                    </div>
                  </div>
                  <Input
                    placeholder="Observações da diurese..."
                    className="h-8 text-xs"
                    value={formData.diureseObs}
                    onChange={(e) => handleInputChange('diureseObs', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded-lg space-y-3">
                    <h4 className="text-sm font-medium text-slate-700">Evacuações</h4>
                    <SelectField
                      label="Frequência"
                      value={formData.evacuacaoFreq}
                      onChange={(v: string) => handleInputChange('evacuacaoFreq', v)}
                      options={['Presente no período', 'Ausente', 'Diarreia', 'Constipação']}
                    />
                    <Input
                      placeholder="Ex: ausente há 2 dias"
                      className="h-8 text-xs"
                      value={formData.evacuacaoObs}
                      onChange={(e) => handleInputChange('evacuacaoObs', e.target.value)}
                    />
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg space-y-3">
                    <h4 className="text-sm font-medium text-slate-700">Deambulação</h4>
                    <SelectField
                      label="Status"
                      value={formData.deambulacaoStatus}
                      onChange={(v: string) => handleInputChange('deambulacaoStatus', v)}
                      options={['Deambulou', 'Restrito ao leito', 'Deambulou com auxílio']}
                    />
                    <Input
                      placeholder="Observações"
                      className="h-8 text-xs"
                      value={formData.deambulacaoObs}
                      onChange={(e) => handleInputChange('deambulacaoObs', e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <SelectField
                      label="Dor"
                      value={formData.dor}
                      onChange={(v: string) => handleInputChange('dor', v)}
                      options={['Ausente', 'Presente']}
                    />
                    {formData.dor === 'Presente' && (
                      <Input
                        placeholder="Local e intensidade (EVA)..."
                        className="h-8 text-xs mt-2"
                        value={formData.dorDetalhe}
                        onChange={(e) => handleInputChange('dorDetalhe', e.target.value)}
                      />
                    )}
                  </div>
                  <div>
                    <SelectField
                      label="Intercorrências"
                      value={formData.intercorrencias}
                      onChange={(v: string) => handleInputChange('intercorrencias', v)}
                      options={['Sem intercorrências', 'Com intercorrências']}
                    />
                    {formData.intercorrencias === 'Com intercorrências' && (
                      <Input
                        placeholder="Descreva a intercorrência..."
                        className="h-8 text-xs mt-2"
                        value={formData.intercorrenciasDetalhe}
                        onChange={(e) => handleInputChange('intercorrenciasDetalhe', e.target.value)}
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-700">Outras Queixas (Marque as presentes)</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {queixasOpcoes.map((q) => (
                      <label key={q} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          checked={formData.outrasQueixas.includes(q)}
                          onChange={() => toggleQueixa(q)}
                        />
                        {q}
                      </label>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 3. Exame Físico */}
            <Card>
              <CardHeader className="py-3 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Parte 3 — Exame Físico</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      geralNormal: true,
                      acvNormal: true,
                      arNormal: true,
                      abdNormal: true,
                      mmiiNormal: true,
                      neuroNormal: true,
                    }))
                  }
                >
                  Marcar Todos Normais
                </Button>
              </CardHeader>
              <CardContent className="pt-4">
                <PhysicalExamSection data={formData} onChange={handleInputChange} showSsvvCard={true} />
              </CardContent>
            </Card>

            {/* 4. Exames, Impressão e Conduta */}
            <Card>
              <CardHeader className="py-3 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-base">Parte 4 — Exames, Impressão & Conduta</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Exames Complementares do Dia / Recentes</Label>
                  <Textarea
                    placeholder="Cole aqui exames transcritos (ex: >> LABS: HB 11,2 / LEUCO 8.400 / PCR 4,1...)"
                    className="min-h-[70px] text-xs font-mono"
                    value={formData.examesRecentes}
                    onChange={(e) => handleInputChange('examesRecentes', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Impressão / Avaliação Clínica</Label>
                  <Textarea
                    placeholder="Síntese da evolução do paciente..."
                    className="min-h-[65px] text-xs"
                    value={formData.impressaoClinica}
                    onChange={(e) => handleInputChange('impressaoClinica', e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Condutas / Plano Terapêutico</Label>
                  <Textarea
                    placeholder="- Manter antibioticoterapia (D4/D7)&#10;- Solicito novos exames laboratoriais amanhã..."
                    className="min-h-[85px] text-xs"
                    value={formData.condutaPlano}
                    onChange={(e) => handleInputChange('condutaPlano', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleGenerate} className="w-full py-6 text-base font-semibold bg-teal-600 hover:bg-teal-700" disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Sintetizando Evolução com IA...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" /> Gerar Evolução Médica Completa
                </>
              )}
            </Button>
          </div>

          <AiOutputPanel
            title="Evolução Diária Gerada"
            patientName={patientName}
            text={generatedText}
            onChange={setGeneratedText}
            loading={isGenerating}
            onCopy={() => handleCopy(generatedText)}
            onDownloadPdf={() => exportDocumentPdf('EVOLUÇÃO MÉDICA DIÁRIA', generatedText, 'Evolucao')}
            onSave={() => saveEntryToHistory(generatedText, 'evolucao', 'Evolução')}
            emptyLabel={
              <>
                Preencha os parâmetros ao lado e clique em
                <br />
                <strong>"Gerar Evolução Médica Completa"</strong>.
              </>
            }
          />
        </div>
      )}

      {activeTab === 'admissao' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6 h-[820px] overflow-y-auto pr-2 custom-scrollbar">
            {/* QP + HDA */}
            <Card>
              <CardHeader className="py-3 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-base">Queixa Principal (QP) e HDA</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div>
                  <Label className="text-xs text-slate-500 mb-1.5 block">Queixa principal</Label>
                  <Input
                    placeholder="Ex: dispneia e tosse produtiva há 4 dias"
                    value={admissaoData.qp}
                    onChange={(e) => handleAdmissaoChange('qp', e.target.value)}
                  />
                </div>
                <SelectField
                  label="Duração"
                  value={admissaoData.hdaDuracao}
                  onChange={(v: string) => handleAdmissaoChange('hdaDuracao', v)}
                  options={['', '< 24h', '2–3 dias', '4–7 dias', '1–2 semanas', '2–4 semanas', '> 1 mês', 'Crônico']}
                />
                <div>
                  <Label className="text-xs text-slate-500 mb-1.5 block">Características</Label>
                  <MultiSelectButtons
                    options={['Súbito', 'Insidioso', 'Progressivo', 'Intermitente', 'Contínuo', 'Em piora']}
                    value={admissaoData.hdaCaracteristicas}
                    onChange={(v: string[]) => handleAdmissaoChange('hdaCaracteristicas', v)}
                  />
                </div>
                <Textarea
                  placeholder="Relato livre da história da doença atual..."
                  className="min-h-[100px] text-sm"
                  value={admissaoData.hdaTexto}
                  onChange={(e) => handleAdmissaoChange('hdaTexto', e.target.value)}
                />
              </CardContent>
            </Card>

            {/* APP */}
            <Card>
              <CardHeader className="py-3 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-base">Antecedentes Pessoais Patológicos (APP)</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <MultiSelectButtons
                  options={[
                    'Nenhuma comorbidade',
                    'HAS',
                    'DM2',
                    'Dislipidemia',
                    'Cardiopatia',
                    'DPOC',
                    'Asma',
                    'Neoplasia',
                    'Doença renal crônica',
                    'Hipotireoidismo',
                  ]}
                  value={admissaoData.appComorbidades}
                  onChange={(v: string[]) => handleAdmissaoChange('appComorbidades', v)}
                  exclusiveOption="Nenhuma comorbidade"
                />
                <Input
                  placeholder="Outros antecedentes / cirurgias prévias..."
                  className="h-9 text-sm"
                  value={admissaoData.appOutros}
                  onChange={(e) => handleAdmissaoChange('appOutros', e.target.value)}
                />
              </CardContent>
            </Card>

            {/* Medicações e Alergias */}
            <Card>
              <CardHeader className="py-3 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-base">Medicações em Uso Contínuo e Alergias</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <Textarea
                  placeholder="Medicações de uso contínuo (nome, dose, posologia)..."
                  className="min-h-[70px] text-sm"
                  value={admissaoData.medicacoesUso}
                  onChange={(e) => handleAdmissaoChange('medicacoesUso', e.target.value)}
                />
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Alergias"
                    value={admissaoData.alergias}
                    onChange={(v: string) => handleAdmissaoChange('alergias', v)}
                    options={['Nega alergias', 'Alergia medicamentosa', 'Alergia alimentar', 'Outras alergias']}
                  />
                  {admissaoData.alergias !== 'Nega alergias' && (
                    <Input
                      placeholder="Qual(is)?"
                      className="h-9 text-sm mt-6"
                      value={admissaoData.alergiasDetalhe}
                      onChange={(e) => handleAdmissaoChange('alergiasDetalhe', e.target.value)}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* História Familiar e Hábitos */}
            <Card>
              <CardHeader className="py-3 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-base">História Familiar e Hábitos</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <Textarea
                  placeholder="Doenças relevantes em familiares de 1º grau..."
                  className="min-h-[60px] text-sm"
                  value={admissaoData.historiaFamiliar}
                  onChange={(e) => handleAdmissaoChange('historiaFamiliar', e.target.value)}
                />
                <div className="grid grid-cols-3 gap-3">
                  <SelectField
                    label="Tabagismo"
                    value={admissaoData.tabagismo}
                    onChange={(v: string) => handleAdmissaoChange('tabagismo', v)}
                    options={['Não tabagista', 'Tabagista', 'Ex-tabagista']}
                  />
                  <SelectField
                    label="Etilismo"
                    value={admissaoData.etilismo}
                    onChange={(v: string) => handleAdmissaoChange('etilismo', v)}
                    options={['Não etilista', 'Etilista social', 'Etilista']}
                  />
                  <SelectField
                    label="Atividade física"
                    value={admissaoData.atividadeFisica}
                    onChange={(v: string) => handleAdmissaoChange('atividadeFisica', v)}
                    options={['Sedentário', 'Ativo']}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Exame Físico + Conduta de Admissão */}
            <Card>
              <CardHeader className="py-3 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-base">Exame Físico, Hipóteses e Conduta Inicial</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="grid grid-cols-5 gap-2">
                  <Input placeholder="PA" className="h-8 text-xs" value={admissaoData.efPa} onChange={(e) => handleAdmissaoChange('efPa', e.target.value)} />
                  <Input placeholder="FC" className="h-8 text-xs" value={admissaoData.efFc} onChange={(e) => handleAdmissaoChange('efFc', e.target.value)} />
                  <Input placeholder="FR" className="h-8 text-xs" value={admissaoData.efFr} onChange={(e) => handleAdmissaoChange('efFr', e.target.value)} />
                  <Input placeholder="Tax" className="h-8 text-xs" value={admissaoData.efTemp} onChange={(e) => handleAdmissaoChange('efTemp', e.target.value)} />
                  <Input placeholder="SatO2" className="h-8 text-xs" value={admissaoData.efSpo2} onChange={(e) => handleAdmissaoChange('efSpo2', e.target.value)} />
                </div>
                {([
                  ['Estado geral', 'efGeral', 'efGeralObs'],
                  ['Cardiovascular', 'efCv', 'efCvObs'],
                  ['Respiratório', 'efResp', 'efRespObs'],
                  ['Abdominal', 'efAbd', 'efAbdObs'],
                  ['Neurológico', 'efNeuro', 'efNeuroObs'],
                ] as const).map(([label, field, obsField]) => (
                  <div key={field} className="p-3 bg-slate-50 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-teal-800">{label}</span>
                      <ToggleButtons
                        options={['Sem alterações', 'Alterado']}
                        value={(admissaoData as any)[field]}
                        onChange={(v: string) => handleAdmissaoChange(field, v)}
                      />
                    </div>
                    {(admissaoData as any)[field] === 'Alterado' && (
                      <Input
                        placeholder={`Descreva o achado ${label.toLowerCase()}...`}
                        className="h-8 text-xs"
                        value={(admissaoData as any)[obsField]}
                        onChange={(e) => handleAdmissaoChange(obsField, e.target.value)}
                      />
                    )}
                  </div>
                ))}

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <Label className="text-xs text-slate-600">Exames Complementares da Admissão</Label>
                  <Textarea
                    placeholder="Exames de entrada (laboratório, RX, TC, ECG)..."
                    className="min-h-[60px] text-xs font-mono"
                    value={admissaoData.examesAdmissao}
                    onChange={(e) => handleAdmissaoChange('examesAdmissao', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-600">Hipótese(s) Diagnóstica(s)</Label>
                  <Input
                    value={admissaoData.hipoteseDiagnostica}
                    onChange={(e) => handleAdmissaoChange('hipoteseDiagnostica', e.target.value)}
                    placeholder="Ex: 1. PAC grave | 2. HAS"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-slate-600">Conduta Inicial</Label>
                  <Textarea
                    className="min-h-[80px] text-xs"
                    value={admissaoData.condutaAdmissao}
                    onChange={(e) => handleAdmissaoChange('condutaAdmissao', e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleGenerateAdmissao} className="w-full py-6 text-base font-semibold bg-teal-600 hover:bg-teal-700" disabled={isGeneratingAdmissao}>
              {isGeneratingAdmissao ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processando Admissão com IA...
                </>
              ) : (
                <>
                  <ClipboardPlus className="mr-2 h-5 w-5" /> Gerar Nota de Admissão com IA
                </>
              )}
            </Button>
          </div>

          <AiOutputPanel
            title="Nota de Admissão Gerada"
            patientName={patientName}
            text={admissaoGeneratedText}
            onChange={setAdmissaoGeneratedText}
            loading={isGeneratingAdmissao}
            onCopy={() => handleCopy(admissaoGeneratedText)}
            onDownloadPdf={() => exportDocumentPdf('NOTA DE ADMISSÃO HOSPITALAR', admissaoGeneratedText, 'Admissao')}
            onSave={() => saveEntryToHistory(admissaoGeneratedText, 'admissao', 'Nota de admissão')}
            emptyLabel={
              <>
                Preencha os dados ao lado e clique em
                <br />
                <strong>"Gerar Nota de Admissão com IA"</strong>.
              </>
            }
          />
        </div>
      )}

      {activeTab === 'alta' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader className="py-3 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-base">Dados do Sumário de Alta Hospitalar</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Diagnóstico Principal na Alta</Label>
                  <Input
                    value={altaData.diagnosticoAlta}
                    onChange={(e) => setAltaData({ ...altaData, diagnosticoAlta: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Diagnósticos Secundários / Comorbidades</Label>
                  <Input
                    value={altaData.comorbidades}
                    onChange={(e) => setAltaData({ ...altaData, comorbidades: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Resumo da Internação e Tratamentos Realizados</Label>
                  <Textarea
                    className="min-h-[100px] text-sm"
                    value={altaData.resumoInternacao}
                    onChange={(e) => setAltaData({ ...altaData, resumoInternacao: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Exames Relevantes da Internação</Label>
                  <Textarea
                    placeholder="Ex: Labs de alta, culturas, TC de controle..."
                    className="min-h-[70px] text-xs font-mono"
                    value={altaData.examesRelevantes}
                    onChange={(e) => setAltaData({ ...altaData, examesRelevantes: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Condição Clínica na Saída</Label>
                  <Input
                    value={altaData.condicaoAlta}
                    onChange={(e) => setAltaData({ ...altaData, condicaoAlta: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Prescrição / Medicações para Casa</Label>
                  <Textarea
                    className="min-h-[85px] text-sm"
                    value={altaData.prescricaoAlta}
                    onChange={(e) => setAltaData({ ...altaData, prescricaoAlta: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-600">Orientações de Seguimento e Sinais de Alarme</Label>
                  <Textarea
                    className="min-h-[85px] text-sm"
                    value={altaData.orientacoesAlta}
                    onChange={(e) => setAltaData({ ...altaData, orientacoesAlta: e.target.value })}
                  />
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleGenerateAlta}
                className="flex-1 py-6 text-base font-semibold bg-teal-600 hover:bg-teal-700"
                disabled={isGeneratingAlta}
              >
                {isGeneratingAlta ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Gerando Sumário...
                  </>
                ) : (
                  <>
                    <FileCheck className="mr-2 h-5 w-5" /> Gerar Sumário de Alta com IA
                  </>
                )}
              </Button>
              {patient && patient.status === 'internado' && (
                <Button
                  variant="outline"
                  className="py-6 border-teal-200 text-teal-700 hover:bg-teal-50"
                  onClick={() => {
                    updatePatient(patient.id, { status: 'alta' });
                    toast(`Alta registrada para ${patient.name}!`, 'success');
                  }}
                >
                  <CheckCircle2 className="mr-2 h-5 w-5" /> Confirmar Alta no Leito
                </Button>
              )}
            </div>
          </div>

          <AiOutputPanel
            title="Sumário de Alta Gerado"
            patientName={patientName}
            text={altaGeneratedText}
            onChange={setAltaGeneratedText}
            loading={isGeneratingAlta}
            onCopy={() => handleCopy(altaGeneratedText)}
            onDownloadPdf={() => exportDocumentPdf('SUMÁRIO DE ALTA HOSPITALAR', altaGeneratedText, 'Sumario_Alta')}
            onSave={() => saveEntryToHistory(altaGeneratedText, 'alta', 'Sumário de alta')}
            emptyLabel={
              <>
                Preencha os dados ao lado e clique em
                <br />
                <strong>"Gerar Sumário de Alta com IA"</strong>.
              </>
            }
          />
        </div>
      )}

      {activeTab === 'historico' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Histórico de Documentos Salvos</h2>
          </div>
          {history.length === 0 ? (
            <div className="p-12 text-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
              <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <p>Nenhuma evolução, admissão ou alta salva no histórico para este paciente.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {history.map((entry) => (
                <Card key={entry.id} className="border-slate-200 shadow-sm overflow-hidden">
                  <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm text-slate-700 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-teal-600" />
                      <span>{entry.date}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-xs font-semibold text-teal-700">
                        {entry.type === 'admissao'
                          ? 'Nota de Admissão'
                          : entry.type === 'alta'
                          ? 'Sumário de Alta'
                          : 'Evolução Diária'}
                      </span>
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleCopy(entry.text)}>
                        <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          exportDocumentPdf(
                            entry.type === 'admissao'
                              ? 'NOTA DE ADMISSÃO'
                              : entry.type === 'alta'
                              ? 'SUMÁRIO DE ALTA'
                              : 'EVOLUÇÃO MÉDICA',
                            entry.text,
                            entry.type || 'Evolucao'
                          )
                        }
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" /> PDF
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-600"
                        onClick={() => {
                          setHistory((prev) => prev.filter((h) => h.id !== entry.id));
                          toast('Registro excluído do histórico.', 'info');
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    <div className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
                      {entry.text}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
