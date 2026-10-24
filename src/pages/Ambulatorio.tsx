import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { SelectField, ToggleButtons, MultiSelectButtons, SectionCard } from '@/components/FormControls';

import { Card, CardContent, CardHeader, CardTitle, Button, Textarea, Input, Label } from '@/components/ui';
import { ArrowLeft, Loader2, Copy, FileText, CheckCircle2, User, ChevronRight, FilePlus2, Stethoscope, Plus, Bot, FolderOpen, RefreshCcw, FileImage, UploadCloud, Archive, Trash2, Download, Sparkles, ExternalLink, Minimize2, Maximize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { jsPDF } from 'jspdf';
import { useAiGenerate, AiGenerateType } from '@/hooks/useAiGenerate';
import { useToast } from '@/hooks/useToast';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { prepareFilesSequentially } from '@/lib/fileToBase64';
import { GoogleDocsConnector, LinkedGoogleDoc } from '@/components/GoogleDocsConnector';
import type { GoogleDocExtracted } from '@/lib/googleDocs';
import {
  PhysicalExamSection,
  DEFAULT_PHYSICAL_EXAM_DATA,
  formatPhysicalExamInstant,
  type PhysicalExamData,
} from '@/components/PhysicalExamSection';

interface InterpretedDoc {
  tipo: string;
  titulo: string;
  resumo?: string;
  especialidade?: string;
  motivo?: string;
  dias?: string;
  cid?: string;
  prescricaoTexto?: string;
  medications?: { via: string; item: string; quantidade: string; posologia: string }[];
}

interface AmbulatorioPatient {
  id: number;
  nome: string;
  hora: string;
  notas: string;
  archived?: boolean;
  googleDoc?: LinkedGoogleDoc | null;
  workspace?: {
    prontuarioAntigo?: string;
    conhecerPaciente?: string;
    hdaBruto?: string;
    hdaOrganizada?: string;
    exameFisicoGerado?: string;
    passagemCaso?: string;
    condutasBrutas?: string;
    documentos?: InterpretedDoc[];
    transcritorResponse?: string;
    chatInput?: string;
    chatResponse?: string;
    adaptadorInput?: string;
    adaptadorResponse?: string;
  };
}



const INITIAL_AMBULATORIO_PATIENTS: AmbulatorioPatient[] = [
  { id: 1, nome: 'WILTON DE SOUZA E SILVA', hora: '11:38', notas: '# AMBULATÓRIO DE ONCOLOGIA COLORRETAL - 19/06/26\nPaciente em seguimento pós-operatório de retossigmoidectomia.' },
  { id: 2, nome: 'LILIANE', hora: '11:25', notas: '# AMBULATÓRIO DE PROCTOLOGIA - 19/08/2026\nRetorno com resultado de colonoscopia.' },
  { id: 3, nome: 'PABLO', hora: '14:31', notas: '# AMBULATÓRIO PROCTOLOGIA ONCOLÓGICA - 30/01/2026' },
  { id: 4, nome: 'RAFAEL', hora: '09:20', notas: '# AMBULATÓRIO DE PROCTOLOGIA 19/06/2026' },
  { id: 5, nome: 'WASHINGTON', hora: '17:06', notas: '# AMBULATÓRIO DE PROCTOLOGIA 17/06/2026' },
  { id: 6, nome: 'JOANA', hora: '09:53', notas: '# AMBULATÓRIO DE COLOPROCTOLOGIA - 27/02/26' },
];

export default function Ambulatorio() {
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState<'list' | 'workspace'>('list');
  const [listTab, setListTab] = useState<'ativas' | 'arquivadas'>('ativas');
  const [selectedPatient, setSelectedPatient] = useState<AmbulatorioPatient | null>(null);
  const [compactMode, setCompactMode] = useLocalStorage<boolean>('evolutigas_compact_forms_v1', true);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string>('');

  const [pacientes, setPacientes] = useLocalStorage<AmbulatorioPatient[]>(
    'evolutigas_ambulatorio_pacientes_v1',
    INITIAL_AMBULATORIO_PATIENTS
  );

  // Workspace States
  const [prontuarioAntigo, setProntuarioAntigo] = useState('');
  const [conhecerPaciente, setConhecerPaciente] = useState('');
  const [loadingConhecer, setLoadingConhecer] = useState(false);

  const [hdaBruto, setHdaBruto] = useState('');
  const [hdaOrganizada, setHdaOrganizada] = useState('');
  const [loadingHda, setLoadingHda] = useState(false);

  // Exame físico form
  const [efFormData, setEfFormData] = useState<PhysicalExamData>(() => ({ ...DEFAULT_PHYSICAL_EXAM_DATA }));

  const handleEfInputChange = (field: string, value: any) => {
    setEfFormData((prev) => ({ ...prev, [field]: value }));
  };

  const [exameFisicoGerado, setExameFisicoGerado] = useState('');
  const [loadingEf, setLoadingEf] = useState(false);

  const [passagemCaso, setPassagemCaso] = useState('');
  const [loadingPassagem, setLoadingPassagem] = useState(false);

  const [condutasBrutas, setCondutasBrutas] = useState('');
  const [documentos, setDocumentos] = useState<InterpretedDoc[]>([]);
  const [loadingCondutas, setLoadingCondutas] = useState(false);

  const [chatInput, setChatInput] = useState('');
  const [chatResponse, setChatResponse] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);

  const [adaptadorInput, setAdaptadorInput] = useState('');
  const [adaptadorResponse, setAdaptadorResponse] = useState('');
  const [loadingAdaptador, setLoadingAdaptador] = useState(false);

  const [exameImages, setExameImages] = useState<{mimeType: string, data: string}[]>([]);
  const [transcritorResponse, setTranscritorResponse] = useState('');
  const [loadingTranscritor, setLoadingTranscritor] = useState(false);

  const { generate } = useAiGenerate();
  const { toast } = useToast();

  const openWorkspace = (p: AmbulatorioPatient) => {
    setSelectedPatient(p);
    setProntuarioAntigo(p.workspace?.prontuarioAntigo || p.notas || '');
    setConhecerPaciente(p.workspace?.conhecerPaciente || '');
    setHdaBruto(p.workspace?.hdaBruto || '');
    setHdaOrganizada(p.workspace?.hdaOrganizada || '');
    setExameFisicoGerado(p.workspace?.exameFisicoGerado || '');
    setPassagemCaso(p.workspace?.passagemCaso || '');
    setCondutasBrutas(p.workspace?.condutasBrutas || '');
    setDocumentos(p.workspace?.documentos || []);
    setTranscritorResponse(p.workspace?.transcritorResponse || '');
    setChatInput(p.workspace?.chatInput || '');
    setChatResponse(p.workspace?.chatResponse || '');
    setAdaptadorInput(p.workspace?.adaptadorInput || '');
    setAdaptadorResponse(p.workspace?.adaptadorResponse || '');
    setExameImages([]);
    setView('workspace');
  };

  const handleAddPatient = () => {
    const newPatient: AmbulatorioPatient = {
      id: Date.now(),
      nome: 'NOVO PACIENTE',
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      notas: `# CONSULTA AMBULATORIAL - ${new Date().toLocaleDateString('pt-BR')}`,
      archived: false,
    };
    setPacientes([newPatient, ...pacientes]);
    openWorkspace(newPatient);
  };

  const persistCurrentPatient = (overrideNotas?: string) => {
    if (!selectedPatient) return;
    const updated: AmbulatorioPatient = {
      ...selectedPatient,
      notas: overrideNotas !== undefined ? overrideNotas : selectedPatient.notas,
      workspace: {
        prontuarioAntigo,
        conhecerPaciente,
        hdaBruto,
        hdaOrganizada,
        exameFisicoGerado,
        passagemCaso,
        condutasBrutas,
        documentos,
        transcritorResponse,
        chatInput,
        chatResponse,
        adaptadorInput,
        adaptadorResponse,
      },
    };
    setSelectedPatient(updated);
    setPacientes(prev => prev.map(p => p.id === updated.id ? updated : p));
    setLastAutoSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
  };

  // Support opening a patient directly from Ctrl+K global search
  useEffect(() => {
    const openId = (location.state as any)?.openPatientId;
    if (openId !== undefined && openId !== null) {
      const target = pacientes.find((p) => String(p.id) === String(openId));
      if (target) {
        openWorkspace(target);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Continuous auto-save while editing in workspace
  useEffect(() => {
    if (view !== 'workspace' || !selectedPatient) return;
    const timer = setTimeout(() => {
      persistCurrentPatient();
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    view,
    selectedPatient?.nome,
    prontuarioAntigo,
    conhecerPaciente,
    hdaBruto,
    hdaOrganizada,
    exameFisicoGerado,
    passagemCaso,
    condutasBrutas,
    documentos,
    transcritorResponse,
    chatInput,
    chatResponse,
    adaptadorInput,
    adaptadorResponse,
  ]);

  const handleSaveAndExit = () => {
    persistCurrentPatient();
    toast('Atendimento salvo com sucesso!', 'success');
    setView('list');
  };

  const handleCompilarProntuario = () => {
    const sections: string[] = [
      `# ATENDIMENTO AMBULATORIAL — ${selectedPatient?.nome || 'PACIENTE'} (${new Date().toLocaleDateString('pt-BR')})`,
    ];
    if (hdaOrganizada) sections.push(`## HDA:\n${hdaOrganizada}`);
    else if (hdaBruto) sections.push(`## HDA:\n${hdaBruto}`);
    if (exameFisicoGerado) sections.push(`## EXAME FÍSICO:\n${exameFisicoGerado}`);
    if (transcritorResponse) sections.push(`## EXAMES COMPLEMENTARES:\n${transcritorResponse}`);
    if (condutasBrutas) sections.push(`## CONDUTA:\n${condutasBrutas}`);
    if (chatResponse && !hdaOrganizada && !condutasBrutas) sections.push(`## REGISTRO SOAP (CHAT CLÍNICO):\n${chatResponse}`);
    else if (adaptadorResponse && !hdaOrganizada) sections.push(`## EVOLUÇÃO ESTRUTURADA:\n${adaptadorResponse}`);
    const compiled = sections.join('\n\n');
    if (selectedPatient) {
      setSelectedPatient({ ...selectedPatient, notas: compiled });
      persistCurrentPatient(compiled);
      toast('Prontuário da consulta compilado e atualizado!', 'success');
    }
  };

  const handleGenerateAllFromChat = async () => {
    if (!chatInput.trim()) return;
    setLoadingChat(true);
    setLoadingHda(true);
    setLoadingCondutas(true);
    try {
      const [soapRes, hdaRes, docsRes] = await Promise.all([
        generate<string>({ type: 'ambulatorio-chat', formData: chatInput }),
        generate<string>({ type: 'organizar-hda', formData: chatInput }),
        generate<InterpretedDoc[]>({ type: 'interpretar-condutas', formData: chatInput, parseJson: true }),
      ]);
      if (soapRes) setChatResponse(soapRes);
      if (hdaRes) {
        setHdaBruto(prev => prev || chatInput);
        setHdaOrganizada(hdaRes);
      }
      if (Array.isArray(docsRes)) {
        setCondutasBrutas(prev => prev || chatInput);
        setDocumentos(docsRes);
      }
      toast('SOAP, HDA e Documentos da consulta gerados simultaneamente!', 'success');
    } finally {
      setLoadingChat(false);
      setLoadingHda(false);
      setLoadingCondutas(false);
    }
  };

  const handleImportFromGoogleDoc = async (extracted: GoogleDocExtracted, autoProcessAi = false) => {
    const docText = extracted.text;
    if (!docText.trim()) {
      toast('O documento selecionado no Google Docs está vazio.', 'error');
      return;
    }

    setProntuarioAntigo(docText);
    setHdaBruto(docText);
    setCondutasBrutas(docText);
    setChatInput(docText);

    const updatedName =
      selectedPatient?.nome &&
      selectedPatient.nome !== 'NOVO PACIENTE'
        ? selectedPatient.nome
        : extracted.title.replace(/^anamnese\s*[-–:]?\s*/i, '').replace(/^consulta\s*[-–:]?\s*/i, '').trim() || 'PACIENTE';

    const linked: LinkedGoogleDoc = {
      docId: extracted.documentId,
      title: extracted.title,
      url: extracted.url,
      lastSyncedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    };

    if (selectedPatient) {
      const updatedPatient: AmbulatorioPatient = {
        ...selectedPatient,
        nome: updatedName,
        notas: docText,
        googleDoc: linked,
        workspace: {
          ...selectedPatient.workspace,
          prontuarioAntigo: docText,
          hdaBruto: docText,
          condutasBrutas: docText,
          chatInput: docText,
        },
      };
      setSelectedPatient(updatedPatient);
      setPacientes((prev) => prev.map((p) => (p.id === updatedPatient.id ? updatedPatient : p)));
    }

    if (!autoProcessAi) {
      toast(`Texto puxado do Google Doc "${extracted.title}" com sucesso!`, 'success');
      return;
    }

    toast(`Puxando "${extracted.title}" e gerando HDA, Receitas e Pedidos de Exames...`, 'info');
    setLoadingChat(true);
    setLoadingHda(true);
    setLoadingCondutas(true);
    setLoadingConhecer(true);
    try {
      const [conhecerRes, hdaRes, docsRes, soapRes] = await Promise.all([
        generate<string>({ type: 'conhecer-paciente', formData: docText }),
        generate<string>({ type: 'organizar-hda', formData: docText }),
        generate<InterpretedDoc[]>({ type: 'interpretar-condutas', formData: docText, parseJson: true }),
        generate<string>({ type: 'ambulatorio-chat', formData: docText }),
      ]);
      if (conhecerRes) setConhecerPaciente(conhecerRes);
      if (hdaRes) setHdaOrganizada(hdaRes);
      if (Array.isArray(docsRes)) setDocumentos(docsRes);
      if (soapRes) setChatResponse(soapRes);
      toast('Anamnese importada do Google Docs com HDA, Resumo e Receitas/Exames gerados!', 'success');
    } finally {
      setLoadingConhecer(false);
      setLoadingHda(false);
      setLoadingCondutas(false);
      setLoadingChat(false);
    }
  };

  const handleOpenInFormularios = (doc: InterpretedDoc) => {
    persistCurrentPatient();
    const tipoNorm = (doc.tipo || '').toLowerCase();
    let selectedForm = 'receita_simples';
    if (tipoNorm.includes('control')) selectedForm = 'receita_controle';
    else if (tipoNorm.includes('exame')) selectedForm = 'pedido_exames';
    else if (tipoNorm.includes('encaminha')) selectedForm = 'encaminhamento';
    else if (tipoNorm.includes('atestado')) selectedForm = 'atestado';
    else if (tipoNorm.includes('aih')) selectedForm = 'aih';

    navigate('/formularios', {
      state: {
        selectedForm,
        patientName: selectedPatient?.nome || '',
        prescricao: doc.prescricaoTexto || condutasBrutas,
        examesSolicitados: doc.prescricaoTexto || condutasBrutas,
        medications: doc.medications,
        especialidade: doc.especialidade || '',
        motivo: doc.motivo || hdaOrganizada || '',
        indicacaoClinica: doc.motivo || '',
        dias: doc.dias || '3',
        cid: doc.cid || '',
      },
    });
  };

  const handleQuickDownloadDocPdf = (doc: InterpretedDoc) => {
    const pdf = new jsPDF();
    pdf.setFontSize(16);
    pdf.text((doc.tipo || 'DOCUMENTO MÉDICO').toUpperCase(), 105, 25, { align: 'center' });
    pdf.setFontSize(11);
    pdf.text(`Paciente: ${selectedPatient?.nome || '_________________________________'}`, 20, 42);
    pdf.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 155, 42);
    pdf.line(20, 46, 190, 46);

    let bodyText = doc.prescricaoTexto || '';
    if (!bodyText && Array.isArray(doc.medications) && doc.medications.length > 0) {
      bodyText = doc.medications
        .map((m, idx) => `${idx + 1}) ${m.item} (${m.quantidade})\n   ${m.posologia}`)
        .join('\n\n');
    }
    if (doc.especialidade) {
      bodyText = `Especialidade: ${doc.especialidade}\n\nMotivo / Indicação Clínica:\n${doc.motivo || ''}\n\n${bodyText}`;
    } else if (doc.motivo && !bodyText.includes(doc.motivo)) {
      bodyText = `${bodyText}\n\nIndicação / Motivo: ${doc.motivo}`;
    }

    pdf.setFontSize(11);
    const lines = pdf.splitTextToSize(bodyText.trim() || condutasBrutas, 170);
    pdf.text(lines, 20, 58);

    pdf.text('__________________________________', 105, 255, { align: 'center' });
    pdf.setFontSize(10);
    pdf.text('Assinatura e Carimbo Médico', 105, 262, { align: 'center' });
    pdf.save(`${(doc.titulo || doc.tipo || 'Documento').replace(/\s+/g, '_')}.pdf`);
    toast('PDF gerado com sucesso!', 'success');
  };

  const handleApi = async (type: string, data: any, setter: any, loadingSetter: any) => {
    loadingSetter(true);
    const isMultimodal = type === 'transcritor-exames';
    const isArray = Array.isArray(data);
    const result = await generate<any>({
      type: type as AiGenerateType,
      formData: isMultimodal ? undefined : data,
      inlineData: isMultimodal && !isArray ? data : undefined,
      inlineDatas: isMultimodal && isArray ? data : undefined,
      parseJson: type === 'interpretar-condutas',
    });
    if (result !== null) {
      setter(result);
    } else if (type === 'interpretar-condutas') {
      setter([]);
    }
    loadingSetter(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast('Copiado para área de transferência!', 'success');
  };

  if (view === 'workspace') {
    return (
      <div className={`space-y-4 max-w-5xl mx-auto pb-20 ${compactMode ? 'compact-clinical-form' : ''}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-4 rounded-lg shadow-sm border border-slate-200 sticky top-0 z-10 gap-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleSaveAndExit} className="hover:bg-slate-100">
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Button>
            <div>
              <input 
                className="text-xl font-bold tracking-tight text-slate-900 bg-transparent border-b border-transparent focus:border-teal-500 focus:outline-none p-0 hover:bg-slate-50 rounded"
                value={selectedPatient?.nome || ''}
                onChange={(e) => setSelectedPatient(selectedPatient ? {...selectedPatient, nome: e.target.value} : null)}
              />
              <p className="text-xs text-slate-500 font-medium flex items-center gap-2 mt-0.5 flex-wrap">
                <span>Atendimento Ambulatorial · Horário: {selectedPatient?.hora}</span>
                {lastAutoSavedAt && (
                  <span className="text-teal-700">· Rascunho auto-salvo às {lastAutoSavedAt}</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCompactMode((prev) => !prev)}
              className="text-slate-600 h-9 text-xs"
            >
              {compactMode ? (
                <>
                  <Maximize2 className="w-3.5 h-3.5 mr-1.5 text-teal-600" /> Modo Padrão
                </>
              ) : (
                <>
                  <Minimize2 className="w-3.5 h-3.5 mr-1.5 text-teal-600" /> Modo Compacto
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={handleCompilarProntuario} className="text-slate-700 h-9">
              <Sparkles className="w-4 h-4 mr-1.5 text-teal-600" /> Compilar Prontuário
            </Button>
            <Button variant="outline" onClick={handleSaveAndExit} className="text-teal-700 border-teal-200 bg-teal-50 hover:bg-teal-100 h-9 px-4 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 mr-2" /> Salvar e Sair
            </Button>
          </div>
        </div>

        {/* Conector Google Docs do Paciente */}
        <GoogleDocsConnector
          mode="ambulatorio"
          patientName={selectedPatient?.nome || 'Paciente'}
          linkedDoc={selectedPatient?.googleDoc || null}
          onUpdateLinkedDoc={(doc) => {
            if (!selectedPatient) return;
            const next = { ...selectedPatient, googleDoc: doc };
            setSelectedPatient(next);
            setPacientes((prev) => prev.map((p) => (p.id === next.id ? next : p)));
          }}
          onImportText={handleImportFromGoogleDoc}
          exportText={selectedPatient?.notas || ''}
          exportDefaultTitle={`Ambulatório - ${selectedPatient?.nome || 'Paciente'}`}
        />

        <div className="space-y-2">
          {/* 1. Conhecer Paciente */}
          <SectionCard title="Conhecer Paciente" defaultOpen={true}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 flex flex-col">
                <Label className="text-sm font-medium text-slate-700">Cole aqui o prontuário da última consulta:</Label>
                <Textarea 
                  className="flex-1 min-h-[300px] text-sm resize-none p-4 font-mono text-slate-600 bg-slate-50/50" 
                  placeholder="Ex: # AMBULATÓRIO DE ONCOLOGIA..."
                  value={prontuarioAntigo}
                  onChange={e => setProntuarioAntigo(e.target.value)}
                />
                <Button 
                  onClick={() => handleApi('conhecer-paciente', prontuarioAntigo, setConhecerPaciente, setLoadingConhecer)}
                  disabled={loadingConhecer || !prontuarioAntigo.trim()}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
                >
                  {loadingConhecer ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <User className="w-4 h-4 mr-2" />}
                  Conhecer Paciente
                </Button>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col shadow-inner">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Preparo de Pré-Consulta</h4>
                {conhecerPaciente ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar markdown-body prose prose-sm max-w-none prose-headings:text-teal-800 prose-headings:font-semibold prose-p:text-slate-700 prose-li:text-slate-700">
                      <ReactMarkdown>{conhecerPaciente}</ReactMarkdown>
                    </div>
                    <div className="flex justify-end mt-4 pt-4 border-t border-slate-200">
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(conhecerPaciente)} className="bg-white">
                        <Copy className="w-4 h-4 mr-2" /> Copiar Resumo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <User className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm text-center max-w-[250px]">O perfil clínico, comorbidades, pendências e MUC atualizado aparecerão aqui.</p>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* 2. HDA */}
          <SectionCard title="Escrever HDA">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 flex flex-col">
                <Label className="text-sm font-medium text-slate-700">Cole ou escreva aqui o relato bruto da HDA:</Label>
                <Textarea 
                  className="flex-1 min-h-[200px] text-sm resize-none p-4 font-mono text-slate-600 bg-slate-50/50" 
                  placeholder="Ex: pct refere pontadas no peito de vez em quando, piora de noite..."
                  value={hdaBruto}
                  onChange={e => setHdaBruto(e.target.value)}
                />
                <Button 
                  onClick={() => handleApi('organizar-hda', hdaBruto, setHdaOrganizada, setLoadingHda)}
                  disabled={loadingHda || !hdaBruto.trim()}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
                >
                  {loadingHda ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                  Organizar HDA
                </Button>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col shadow-inner">
                 <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">HDA Organizada</h4>
                {hdaOrganizada ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar markdown-body prose prose-sm max-w-none text-slate-800">
                      <ReactMarkdown>{hdaOrganizada}</ReactMarkdown>
                    </div>
                     <div className="flex justify-end mt-4 pt-4 border-t border-slate-200">
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(hdaOrganizada)} className="bg-white">
                        <Copy className="w-4 h-4 mr-2" /> Copiar HDA
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <FileText className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm text-center max-w-[250px]">A história clínica organizada em linguagem médica profissional aparecerá aqui.</p>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* 3. Exame Físico */}
          <SectionCard title="Exame Físico">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4 max-h-[540px] overflow-y-auto pr-2 custom-scrollbar">
                  <PhysicalExamSection data={efFormData} onChange={handleEfInputChange} showSsvvCard={true} />

                  <div className="pt-4 sticky bottom-0 bg-white pb-2 flex gap-2">
                    <Button
                      onClick={() => {
                        const text = formatPhysicalExamInstant(efFormData);
                        setExameFisicoGerado(text);
                        toast('Exame físico gerado instantaneamente!', 'success');
                      }}
                      className="flex-1 bg-teal-600 hover:bg-teal-700 text-white shadow-sm py-5 text-sm font-semibold"
                    >
                      <Stethoscope className="w-4 h-4 mr-2" />
                      Gerar Exame Físico (Instantâneo)
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleApi('gerar-exame-fisico', efFormData, setExameFisicoGerado, setLoadingEf)}
                      disabled={loadingEf}
                      className="border-teal-200 text-teal-700 hover:bg-teal-50 py-5 text-xs font-semibold"
                      title="Refinar texto corrido com IA"
                    >
                      {loadingEf ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                      Refinar IA
                    </Button>
                  </div>
                </div>
                
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col shadow-inner min-h-[300px]">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Texto Formatado</h4>
                  {exameFisicoGerado ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar text-sm text-slate-800 leading-relaxed font-sans whitespace-pre-line">
                        {exameFisicoGerado}
                      </div>
                      <div className="flex justify-end mt-4 pt-4 border-t border-slate-200">
                        <Button variant="outline" size="sm" onClick={() => copyToClipboard(exameFisicoGerado)} className="bg-white">
                          <Copy className="w-4 h-4 mr-2" /> Copiar Texto
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                      <Stethoscope className="w-10 h-10 mb-3 opacity-20" />
                      <p className="text-sm text-center max-w-[200px]">O exame físico estruturado em texto corrido aparecerá aqui.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* 4. Passagem de Caso */}
          <SectionCard title="Passagem de Casos">
            <div className="flex flex-col space-y-5">
               <p className="text-sm text-slate-500">Gere um resumo estruturado e focado para passar o caso na enfermaria ou para o preceptor, consolidando as informações da consulta.</p>
              <Button 
                onClick={() => handleApi('passagem-caso', { conhecerPaciente, hdaOrganizada, exameFisicoGerado }, setPassagemCaso, setLoadingPassagem)}
                disabled={loadingPassagem || (!conhecerPaciente && !hdaOrganizada)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white self-start shadow-sm"
              >
                {loadingPassagem ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FilePlus2 className="w-4 h-4 mr-2" />}
                Passar este caso
              </Button>
              {passagemCaso && (
                <div className="bg-indigo-50/50 border border-indigo-100 rounded-lg p-5 shadow-sm">
                  <div className="flex justify-between items-center mb-4 border-b border-indigo-100 pb-3">
                     <h4 className="text-sm font-semibold text-indigo-900">Passagem Estruturada</h4>
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(passagemCaso)} className="text-indigo-700 bg-white hover:bg-indigo-50 border-indigo-200">
                      <Copy className="w-4 h-4 mr-2" /> Copiar Resumo
                    </Button>
                  </div>
                  <div className="markdown-body prose prose-sm max-w-none text-indigo-950 prose-headings:text-indigo-900 prose-headings:font-semibold">
                    <ReactMarkdown>{passagemCaso}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* 5. Condutas */}
          <SectionCard title="Condutas">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 flex flex-col">
                <Label className="text-sm font-medium text-slate-700">Cole aqui as condutas que serão interpretadas:</Label>
                <Textarea 
                  className="flex-1 min-h-[200px] text-sm resize-none p-4 font-mono text-slate-600 bg-slate-50/50" 
                  placeholder="- AUMENTO AMIODARONA PARA 200MG 1x/dia&#10;- SUSPENDO MAREVAN&#10;- SOLICITO EXAMES PRE-OP&#10;- ENCAMINHO PARA CARDIOLOGISTA"
                  value={condutasBrutas}
                  onChange={e => setCondutasBrutas(e.target.value)}
                />
                <Button 
                  onClick={() => handleApi('interpretar-condutas', condutasBrutas, setDocumentos, setLoadingCondutas)}
                  disabled={loadingCondutas || !condutasBrutas.trim()}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
                >
                  {loadingCondutas ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
                  Interpretar Condutas
                </Button>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col shadow-inner min-h-[300px]">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2 flex items-center gap-2">
                   <FileText className="w-4 h-4" /> Documentos Identificados
                </h4>
                {documentos.length > 0 ? (
                  <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                    {documentos.map((doc, i) => (
                      <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between shadow-sm gap-3 hover:border-teal-200 transition-colors group">
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-slate-800">{doc.titulo}</span>
                            <span className="text-xs font-medium text-teal-700">{doc.tipo}</span>
                          </div>
                          {doc.resumo && (
                            <p className="text-xs text-slate-500 mt-1">{doc.resumo}</p>
                          )}
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => handleQuickDownloadDocPdf(doc)}
                          >
                            <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar PDF
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                            onClick={() => handleOpenInFormularios(doc)}
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir no Formulário
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <FolderOpen className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm text-center max-w-[250px]">As prescrições, atestados, pedidos de exames e encaminhamentos interpretados aparecerão aqui prontos para impressão.</p>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* 6. Chat Clínico Inteligente */}
          <SectionCard title="Chat Clínico Inteligente">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 flex flex-col">
                <Label className="text-sm font-medium text-slate-700">Descreva os sintomas ou dados brutos:</Label>
                <Textarea 
                  className="flex-1 min-h-[200px] text-sm resize-none p-4 font-mono text-slate-600 bg-slate-50/50" 
                  placeholder="Ex: paciente com dor de garganta há 3 dias, sem febre, tosse seca. orofaringe hiperemiada."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    onClick={() => handleApi('ambulatorio-chat', chatInput, setChatResponse, setLoadingChat)}
                    disabled={loadingChat || !chatInput.trim()}
                    className="flex-1 bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
                  >
                    {loadingChat ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bot className="w-4 h-4 mr-2" />}
                    Gerar SOAP Rápido
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleGenerateAllFromChat}
                    disabled={loadingChat || !chatInput.trim()}
                    className="border-teal-200 text-teal-700 hover:bg-teal-50 shadow-sm"
                    title="Gera simultaneamente o SOAP, a HDA Organizada e os Documentos/Receitas da consulta"
                  >
                    {loadingChat ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                    Preencher Consulta (HDA + Condutas)
                  </Button>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col shadow-inner min-h-[300px]">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Resposta Clínica (SOAP & Condutas)</h4>
                {chatResponse ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar markdown-body prose prose-sm max-w-none text-slate-800">
                      <ReactMarkdown>{chatResponse}</ReactMarkdown>
                    </div>
                    <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-200">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (!selectedPatient) return;
                          const nextNotas = `${selectedPatient.notas ? `${selectedPatient.notas}\n\n` : ''}${chatResponse}`;
                          setSelectedPatient({ ...selectedPatient, notas: nextNotas });
                          persistCurrentPatient(nextNotas);
                          toast('SOAP inserido no Prontuário Consolidado!', 'success');
                        }}
                        className="bg-white text-teal-700 border-teal-200 hover:bg-teal-50"
                      >
                        <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Inserir no Prontuário
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(chatResponse)} className="bg-white">
                        <Copy className="w-4 h-4 mr-2" /> Copiar Resposta
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <Bot className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm text-center max-w-[250px]">O resumo SOAP e sugestões de conduta aparecerão aqui.</p>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* 7. Adaptador de Dados */}
          <SectionCard title="Adaptador de Dados Brutos">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 flex flex-col">
                <Label className="text-sm font-medium text-slate-700">Rascunhos ou notas rápidas:</Label>
                <Textarea 
                  className="flex-1 min-h-[200px] text-sm resize-none p-4 font-mono text-slate-600 bg-slate-50/50" 
                  placeholder="Ex: pct sentindo mal, pressao alta, vou passar captopril"
                  value={adaptadorInput}
                  onChange={e => setAdaptadorInput(e.target.value)}
                />
                <Button 
                  onClick={() => handleApi('adaptador-dados', adaptadorInput, setAdaptadorResponse, setLoadingAdaptador)}
                  disabled={loadingAdaptador || !adaptadorInput.trim()}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
                >
                  {loadingAdaptador ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
                  Estruturar em Linguagem Médica
                </Button>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col shadow-inner min-h-[300px]">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Texto Profissional</h4>
                {adaptadorResponse ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar markdown-body prose prose-sm max-w-none text-slate-800">
                      <ReactMarkdown>{adaptadorResponse}</ReactMarkdown>
                    </div>
                    <div className="flex justify-end mt-4 pt-4 border-t border-slate-200">
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(adaptadorResponse)} className="bg-white">
                        <Copy className="w-4 h-4 mr-2" /> Copiar Texto
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <FileText className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm text-center max-w-[250px]">O texto reorganizado e com terminologia médica adequada aparecerá aqui.</p>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* 8. Transcritor de Exames */}
          <SectionCard title="Transcritor de Exames (Imagem para Texto)">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 flex flex-col">
                <Label className="text-sm font-medium text-slate-700">Faça upload da imagem do exame laboratorial ou laudo:</Label>
                
                <div className="flex-1 border-2 border-dashed border-slate-300 rounded-lg bg-slate-50/50 flex flex-col items-center justify-center p-6 relative">
                  <input 
                    type="file" 
                    accept="image/*,.pdf" 
                    multiple
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        const newImages = await prepareFilesSequentially(files);
                        setExameImages(newImages);
                      }
                    }}
                  />
                  {exameImages.length > 0 ? (
                    <div className="flex flex-col items-center">
                      <CheckCircle2 className="w-8 h-8 text-teal-500 mb-2" />
                      <p className="text-sm font-medium text-slate-700">{exameImages.length} arquivo(s) selecionado(s)</p>
                      <p className="text-xs text-slate-500 mt-1">Clique para trocar os arquivos</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-slate-400">
                      <UploadCloud className="w-10 h-10 mb-3" />
                      <p className="text-sm font-medium text-slate-600">Arraste as imagens ou clique para selecionar</p>
                      <p className="text-xs mt-1">Suporta JPG, PNG e PDF</p>
                    </div>
                  )}
                </div>

                <Button 
                  onClick={() => handleApi('transcritor-exames', exameImages, setTranscritorResponse, setLoadingTranscritor)}
                  disabled={loadingTranscritor || exameImages.length === 0}
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
                >
                  {loadingTranscritor ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileImage className="w-4 h-4 mr-2" />}
                  Transcrever Resultados
                </Button>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col shadow-inner min-h-[300px]">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-200 pb-2">Resultados Estruturados</h4>
                {transcritorResponse ? (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar markdown-body prose prose-sm max-w-none text-slate-800">
                      <ReactMarkdown>{transcritorResponse}</ReactMarkdown>
                    </div>
                    <div className="flex justify-end mt-4 pt-4 border-t border-slate-200">
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(transcritorResponse)} className="bg-white">
                        <Copy className="w-4 h-4 mr-2" /> Copiar Transcrição
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <FileImage className="w-10 h-10 mb-3 opacity-20" />
                    <p className="text-sm text-center max-w-[250px]">Os resultados dos exames transcritos e filtrados aparecerão aqui.</p>
                  </div>
                )}
              </div>
            </div>
          </SectionCard>

          {/* 9. Prontuário Consolidado da Consulta */}
          <SectionCard title="Prontuário Consolidado da Consulta" defaultOpen={true}>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  Edite livremente ou clique em <strong>Compilar Blocos</strong> para unir HDA, Exame Físico, Exames e Conduta em um único registro pronto para o prontuário eletrônico.
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={handleCompilarProntuario}>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5 text-teal-600" /> Compilar Blocos
                  </Button>
                  <Button
                    size="sm"
                    className="bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={() => copyToClipboard(selectedPatient?.notas || '')}
                  >
                    <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar Prontuário
                  </Button>
                </div>
              </div>
              <Textarea
                className="min-h-[240px] font-mono text-sm leading-relaxed text-slate-800 bg-slate-50/50"
                value={selectedPatient?.notas || ''}
                onChange={(e) =>
                  setSelectedPatient(selectedPatient ? { ...selectedPatient, notas: e.target.value } : null)
                }
                placeholder="O registro consolidado da consulta aparecerá aqui..."
              />
            </div>
          </SectionCard>

        </div>
      </div>
    );
  }

  const activePatients = pacientes.filter((p) => !p.archived);
  const archivedPatients = pacientes.filter((p) => p.archived);
  const visiblePatients = listTab === 'ativas' ? activePatients : archivedPatients;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Ambulatório</h1>
          <p className="text-slate-500 mt-1">
            {activePatients.length} atendimento(s) ativo(s) · {archivedPatients.length} arquivado(s)
          </p>
        </div>
        <Button onClick={handleAddPatient} className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm h-10 px-6">
          <Plus className="w-4 h-4 mr-2" /> Adicionar paciente
        </Button>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setListTab('ativas')}
          className={`px-6 py-3 text-sm font-semibold rounded-t-lg transition-colors ${
            listTab === 'ativas'
              ? 'text-teal-700 border-b-2 border-teal-600 bg-teal-50/50'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
          }`}
        >
          Ativas ({activePatients.length})
        </button>
        <button
          onClick={() => setListTab('arquivadas')}
          className={`px-6 py-3 text-sm font-semibold rounded-t-lg transition-colors ${
            listTab === 'arquivadas'
              ? 'text-teal-700 border-b-2 border-teal-600 bg-teal-50/50'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
          }`}
        >
          Arquivadas ({archivedPatients.length})
        </button>
      </div>

      {visiblePatients.length === 0 ? (
        <div className="p-12 text-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
          Nenhum paciente na aba de notas {listTab}.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {visiblePatients.map((p) => (
            <Card
              key={p.id}
              className="hover:shadow-md transition-all duration-200 border-slate-200 group flex flex-col h-[195px] bg-white cursor-pointer"
              onClick={() => openWorkspace(p)}
            >
              <CardHeader className="p-4 pb-3 border-b border-slate-50 flex-row justify-between items-start space-y-0">
                <span
                  className="text-xs font-bold px-2.5 py-1 bg-yellow-100 text-yellow-800 rounded-md line-clamp-1 max-w-[160px]"
                  title={p.nome}
                >
                  {p.nome}
                </span>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
                    {p.hora}
                  </span>
                  <button
                    title={p.archived ? 'Restaurar nota' : 'Arquivar nota'}
                    onClick={() => {
                      setPacientes((prev) =>
                        prev.map((item) => (item.id === p.id ? { ...item, archived: !item.archived } : item))
                      );
                      toast(p.archived ? 'Nota restaurada para Ativas.' : 'Nota arquivada.', 'info');
                    }}
                    className="p-1 text-slate-400 hover:text-teal-600 rounded"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  <button
                    title="Excluir nota"
                    onClick={() => {
                      setPacientes((prev) => prev.filter((item) => item.id !== p.id));
                      toast('Nota excluída.', 'info');
                    }}
                    className="p-1 text-slate-400 hover:text-red-600 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-4 flex-1 flex flex-col justify-between">
                <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed font-mono">{p.notas}</p>
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-center text-xs font-semibold text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  Abrir nota clínica <ChevronRight className="w-3 h-3 ml-1" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
