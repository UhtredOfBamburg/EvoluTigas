import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, Button, Input, Label, Textarea } from '@/components/ui';
import {
  FileText,
  Download,
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  BookmarkCheck,
  RotateCcw,
  SlidersHorizontal,
  ImagePlus,
  X,
  Copy,
  Check,
  FolderKanban,
  Bed,
  Pencil,
  Calendar,
  ChevronDown,
} from 'lucide-react';
import { useFormTemplates } from '@/hooks/useFormTemplates';
import { useEnfermariaPatients } from '@/hooks/useEnfermariaPatients';
import { useAiGenerate } from '@/hooks/useAiGenerate';
import { useToast } from '@/hooks/useToast';
import {
  generateFilledPdf,
  downloadPdfBytes,
  formatMedicationsToText,
  formatDateBr,
  groupMirroredFields,
  isPrescriptionField,
  isRequestedExamsField,
  isDateField,
  ensureReceitaDateField,
  type VerticalAlignMode,
} from '@/lib/generateFilledPdf';
import { prepareFileInlineData } from '@/lib/fileToBase64';
import { PdfLiveViewer } from '@/components/formularios/PdfLiveViewer';
import { ExamSelectorBlock } from '@/components/formularios/ExamSelectorBlock';
import type { FormField, FormTemplate, MedicationItem } from '@/types/formTemplate';

const QUANTIDADE_SUGGESTIONS = [
  'CONTÍNUO',
  '1 CAIXA',
  '2 CAIXAS',
  '3 CAIXAS',
  '1 FRASCO',
  '2 FRASCOS',
  '30 COMPRIMIDOS',
  '60 COMPRIMIDOS',
  '90 COMPRIMIDOS',
  '1 TUBO',
  'USO ÚNICO',
];

function todayBr(): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function brDateToIso(br: string): string {
  const match = (br || '').trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function maskDateBrInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

export default function Formularios() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { generate } = useAiGenerate();
  const {
    templates,
    saveTemplate,
    deleteTemplate,
    clearAllTemplates,
    renameTemplate,
    getPresetsForForm,
    savePreset,
    deletePreset,
  } = useFormTemplates();

  const { patients } = useEnfermariaPatients();
  const internados = patients.filter((p) => p.status === 'internado');

  const locState = (location.state as any) || {};
  const rawInitialForm = (locState.selectedForm || locState.formType || templates[0]?.id || '') as string;

  const [formType, setFormType] = useState<string>(rawInitialForm);
  const [isManagingTemplates, setIsManagingTemplates] = useState<boolean>(
    location.pathname.endsWith('/meus') || Boolean(locState.openManage)
  );
  const [editingTplId, setEditingTplId] = useState<string | null>(null);
  const [editingTplName, setEditingTplName] = useState<string>('');

  const [activeTemplate, setActiveTemplate] = useState<FormTemplate | null>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState<boolean>(false);

  const [templateValues, setTemplateValues] = useState<Record<string, string>>({});
  const [fieldFontSizes, setFieldFontSizes] = useState<Record<string, number>>({});
  const [fieldAlignments, setFieldAlignments] = useState<Record<string, VerticalAlignMode>>({});
  const [prescricaoMode, setPrescricaoMode] = useState<'formulario' | 'livre'>('formulario');
  const [medications, setMedications] = useState<MedicationItem[]>([
    { id: '1', via: 'Oral', quantidade: 'CONTÍNUO', item: '', posologia: '' },
  ]);

  // Saved preset bar state
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [isSavingPreset, setIsSavingPreset] = useState<boolean>(false);
  const [presetNameInput, setPresetNameInput] = useState<string>('');

  // AI Auto-fill state
  const [showAiAutoFill, setShowAiAutoFill] = useState<boolean>(true);
  const [aiContextText, setAiContextText] = useState<string>('');
  const [aiScreenshot, setAiScreenshot] = useState<{ name: string; mimeType: string; data: string } | null>(null);
  const [isAutoFilling, setIsAutoFilling] = useState<boolean>(false);
  const aiImageInputRef = useRef<HTMLInputElement>(null);

  // Live PDF preview state
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Resolve activeTemplate from user templates (ensuring Receitas always have Data de Solicitação)
  useEffect(() => {
    const custom = templates.find((t) => t.id === formType);
    if (custom) {
      setActiveTemplate(ensureReceitaDateField(custom));
      setIsLoadingTemplate(false);
      return;
    }

    if (templates.length > 0 && (!formType || !templates.some((t) => t.id === formType))) {
      setFormType(templates[0].id);
      setActiveTemplate(ensureReceitaDateField(templates[0]));
      setIsLoadingTemplate(false);
      return;
    }

    setActiveTemplate(null);
    setPdfBytes(null);
    setIsLoadingTemplate(false);
  }, [formType, templates]);

  // Initialize default values & pre-populate from location.state when activeTemplate changes
  useEffect(() => {
    if (!activeTemplate) return;

    const initialSizes: Record<string, number> = {};
    const initialAligns: Record<string, VerticalAlignMode> = {};
    const initialValues: Record<string, string> = {};

    activeTemplate.fields.forEach((f) => {
      const lower = f.label.toLowerCase();
      const isReqDate = isDateField(f) && !lower.includes('nascimento');
      initialSizes[f.id] = f.fontSize || (isReqDate ? 12.06 : 10);
      initialAligns[f.id] = 'bottom';

      // Pre-fill from location.state if navigating from Ambulatório or Enfermaria
      if (locState.patientName && (lower.includes('paciente') || f.id === 'nome')) {
        initialValues[f.id] = locState.patientName;
      }
      if (locState.cid && lower.includes('cid')) {
        initialValues[f.id] = locState.cid;
      }
      if ((locState.dias || locState.diasAfastamento) && lower.includes('dias')) {
        initialValues[f.id] = String(locState.dias || locState.diasAfastamento);
      }
      if (locState.especialidade && lower.includes('especialidade')) {
        initialValues[f.id] = locState.especialidade;
      }
      if (locState.motivo && (lower.includes('motivo') || lower.includes('sintomas') || lower.includes('justificativa') || lower.includes('observa'))) {
        initialValues[f.id] = locState.motivo;
      }
      if (locState.indicacaoClinica && lower.includes('indica')) {
        initialValues[f.id] = locState.indicacaoClinica;
      }
      if (locState.examesSolicitados && isRequestedExamsField(f, activeTemplate)) {
        initialValues[f.id] = locState.examesSolicitados;
      }
      if (locState.prescricao && isPrescriptionField(f, activeTemplate)) {
        initialValues[f.id] = locState.prescricao;
      }
    });

    // If Atestado has patient name or days, build initial declaration text if empty
    if (activeTemplate.id === 'atestado' && !initialValues.textoAtestado) {
      const pName = initialValues.nome || '_____________________________________';
      const dias = initialValues.dias || '____';
      const cidPart = initialValues.cid ? ` (CID-10: ${initialValues.cid})` : '';
      initialValues.textoAtestado = `Atesto para os devidos fins que o(a) paciente ${pName} foi atendido(a) nesta unidade de saúde e necessita de ${dias} dia(s) de afastamento de suas atividades habituais por motivo de doença${cidPart}.`;
    }

    if (Array.isArray(locState.medications) && locState.medications.length > 0) {
      const mappedMeds: MedicationItem[] = locState.medications.map((m: any, i: number) => ({
        id: String(i + 1),
        via: m.via || 'Oral',
        quantidade: m.quantidade || 'CONTÍNUO',
        item: m.item || '',
        posologia: m.posologia || '',
      }));
      setMedications(mappedMeds);
      setPrescricaoMode('formulario');
      const prescField = activeTemplate.fields.find((f) => isPrescriptionField(f, activeTemplate));
      if (prescField) {
        initialValues[prescField.id] = formatMedicationsToText(mappedMeds);
      }
    } else if (locState.prescricao) {
      setPrescricaoMode('livre');
    }

    setFieldFontSizes(initialSizes);
    setFieldAlignments(initialAligns);
    setTemplateValues(initialValues);
    setSelectedPresetId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTemplate?.id]);

  // Keep prescription field synchronized when in 'formulario' mode
  useEffect(() => {
    if (!activeTemplate || prescricaoMode !== 'formulario') return;
    const prescFields = activeTemplate.fields.filter((f) => isPrescriptionField(f, activeTemplate));
    if (prescFields.length === 0) return;

    const formatted = formatMedicationsToText(medications);
    setTemplateValues((prev) => {
      const next = { ...prev };
      prescFields.forEach((pf) => {
        next[pf.id] = formatted;
      });
      return next;
    });
  }, [medications, prescricaoMode, activeTemplate]);

  // Auto-update Atestado body text when nome, dias, or cid change on the built-in atestado form
  useEffect(() => {
    if (activeTemplate?.id !== 'atestado') return;
    const pName = templateValues.nome || '_____________________________________';
    const dias = templateValues.dias || '____';
    const cidPart = templateValues.cid ? ` (CID-10: ${templateValues.cid})` : '';
    const autoText = `Atesto para os devidos fins que o(a) paciente ${pName} foi atendido(a) nesta unidade de saúde e necessita de ${dias} dia(s) de afastamento de suas atividades habituais por motivo de doença${cidPart}.`;
    setTemplateValues((prev) => ({ ...prev, textoAtestado: autoText }));
  }, [activeTemplate?.id, templateValues.nome, templateValues.dias, templateValues.cid]);

  // Real-time PDF generation into live viewer
  useEffect(() => {
    if (!activeTemplate) return;
    const timer = setTimeout(() => {
      generateFilledPdf(activeTemplate, templateValues, { fieldFontSizes, fieldAlignments })
        .then((bytes) => {
          setPdfBytes(bytes);
        })
        .catch((err) => {
          console.error('Error generating live PDF preview:', err);
        });
    }, 240);

    return () => clearTimeout(timer);
  }, [activeTemplate, templateValues, fieldFontSizes, fieldAlignments]);

  // Group fields across 1ª Via and 2ª Via so the user fills each field only once
  const fieldGroups = React.useMemo(
    () => (activeTemplate ? groupMirroredFields(activeTemplate.fields, activeTemplate) : []),
    [activeTemplate]
  );

  const setGroupValue = (groupFields: FormField[], val: string) => {
    setTemplateValues((prev) => {
      const next = { ...prev };
      groupFields.forEach((f) => {
        next[f.id] = val;
      });
      return next;
    });
  };

  const adjustGroupFontSize = (groupFields: FormField[], delta: number, defaultSize = 10) => {
    setFieldFontSizes((prev) => {
      const primaryId = groupFields[0]?.id;
      const current = (primaryId ? prev[primaryId] : undefined) ?? defaultSize;
      const nextSize = Math.max(5, Math.min(24, Number((current + delta).toFixed(2))));
      const next = { ...prev };
      groupFields.forEach((f) => {
        next[f.id] = nextSize;
      });
      return next;
    });
  };

  const setGroupAlignment = (groupFields: FormField[], align: VerticalAlignMode) => {
    setFieldAlignments((prev) => {
      const next = { ...prev };
      groupFields.forEach((f) => {
        next[f.id] = align;
      });
      return next;
    });
  };

  const handleClearForm = () => {
    if (!activeTemplate) return;
    setTemplateValues({});
    setMedications([{ id: '1', via: 'Oral', quantidade: 'CONTÍNUO', item: '', posologia: '' }]);
    setSelectedPresetId('');
    toast('Campos limpos.', 'info');
  };

  const handleSavePreset = () => {
    if (!activeTemplate) return;
    if (!presetNameInput.trim()) {
      toast('Digite um nome para o modelo de preenchimento.', 'error');
      return;
    }
    const id = `preset_${Date.now()}`;
    savePreset({
      id,
      formId: activeTemplate.id,
      name: presetNameInput.trim(),
      values: templateValues,
      medications,
      prescricaoMode,
      fieldFontSizes,
      createdAt: new Date().toISOString(),
    });
    setSelectedPresetId(id);
    setPresetNameInput('');
    setIsSavingPreset(false);
    toast('Modelo de preenchimento salvo! Reutilize quando quiser.', 'success');
  };

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (!presetId || !activeTemplate) return;
    const formPresets = getPresetsForForm(activeTemplate.id);
    const chosen = formPresets.find((p) => p.id === presetId);
    if (!chosen) return;

    setTemplateValues(chosen.values || {});
    if (chosen.medications && chosen.medications.length > 0) {
      setMedications(chosen.medications);
    }
    if (chosen.prescricaoMode) {
      setPrescricaoMode(chosen.prescricaoMode);
    }
    if (chosen.fieldFontSizes) {
      setFieldFontSizes((prev) => ({ ...prev, ...chosen.fieldFontSizes }));
    }
    toast(`Modelo "${chosen.name}" aplicado.`, 'success');
  };

  // Handle image upload or Ctrl+V paste into AI Auto-fill box
  const handleScreenshotFile = async (file: File) => {
    try {
      const inline = await prepareFileInlineData(file);
      setAiScreenshot({ name: file.name || 'print_cadastro.jpg', ...inline });
      toast('Imagem/print anexado para leitura por IA.', 'info');
    } catch (err) {
      console.error(err);
      toast('Não foi possível processar a imagem anexada.', 'error');
    }
  };

  const handleAiPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await handleScreenshotFile(file);
          return;
        }
      }
    }
  };

  const handlePullEnfermariaPatient = (patientId: string) => {
    if (!patientId || !activeTemplate) return;
    const chosen = patients.find((p) => p.id === patientId);
    if (!chosen) return;

    setTemplateValues((prev) => {
      const next = { ...prev };
      fieldGroups.forEach((g) => {
        const lower = g.label.toLowerCase();
        if (lower.includes('paciente') || g.primaryField.id === 'nome') {
          g.fields.forEach((f) => {
            next[f.id] = chosen.name;
          });
        }
        if (lower.includes('idade') && chosen.age) {
          g.fields.forEach((f) => {
            next[f.id] = `${chosen.age} anos`;
          });
        }
        if (lower.includes('leito') && chosen.bed) {
          g.fields.forEach((f) => {
            next[f.id] = chosen.bed;
          });
        }
        if (
          (lower.includes('indica') || lower.includes('hipótese') || lower.includes('diagnostico') || lower.includes('diagnóstico')) &&
          chosen.diagnosis
        ) {
          g.fields.forEach((f) => {
            next[f.id] = chosen.diagnosis;
          });
        }
      });
      return next;
    });

    setAiContextText(
      `Paciente: ${chosen.name}, ${chosen.age} anos, sexo ${chosen.sex}, internado no ${chosen.bed}.\nHipótese Diagnóstica: ${chosen.diagnosis}.\nComorbidades: ${chosen.comorbidades || 'Nega'}.\nAntibióticos/Medicações: ${chosen.antibioticos || 'N/A'}.`
    );
    toast(`Dados de ${chosen.name} conectados ao formulário!`, 'success');
  };

  const handleRunAiAutoFill = async () => {
    if (!activeTemplate) return;
    if (!aiContextText.trim() && !aiScreenshot) {
      toast('Cole o texto do prontuário/caso, selecione um paciente ou anexe um print primeiro.', 'error');
      return;
    }

    setIsAutoFilling(true);
    try {
      const result = await generate<{
        values?: Record<string, string>;
        medications?: Array<{ via?: string; quantidade?: string; item?: string; posologia?: string }>;
      }>({
        type: 'preencher-formulario-ia',
        formFields: fieldGroups.map((g) => ({
          id: g.primaryField.id,
          label: g.label,
          type: g.primaryField.type,
        })),
        customPrompt: aiContextText,
        inlineData: aiScreenshot ? { mimeType: aiScreenshot.mimeType, data: aiScreenshot.data } : undefined,
        parseJson: true,
        errorMessage: 'Não foi possível preencher automaticamente os campos com a IA.',
      });

      if (result) {
        if (result.values && typeof result.values === 'object') {
          setTemplateValues((prev) => {
            const next = { ...prev };
            Object.entries(result.values!).forEach(([k, v]) => {
              if (v !== undefined && v !== null && String(v).trim() !== '') {
                const strVal = String(v);
                next[k] = strVal;
                const matchingGroup = fieldGroups.find((g) => g.fields.some((f) => f.id === k));
                if (matchingGroup) {
                  matchingGroup.fields.forEach((f) => {
                    next[f.id] = strVal;
                  });
                }
              }
            });
            return next;
          });
        }
        if (Array.isArray(result.medications) && result.medications.length > 0) {
          const mapped: MedicationItem[] = result.medications.map((m, idx) => ({
            id: `${Date.now()}_${idx}`,
            via: m.via || 'Oral',
            quantidade: m.quantidade || 'CONTÍNUO',
            item: m.item || '',
            posologia: m.posologia || '',
          }));
          setMedications(mapped);
          setPrescricaoMode('formulario');
        }
        toast('Campos preenchidos automaticamente pela IA!', 'success');
      }
    } finally {
      setIsAutoFilling(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!activeTemplate) return;
    setIsGeneratingPdf(true);
    try {
      const bytes = await generateFilledPdf(activeTemplate, templateValues, {
        fieldFontSizes,
        fieldAlignments,
      });
      const patientLabel = templateValues.nome ? ` - ${templateValues.nome.slice(0, 30)}` : '';
      downloadPdfBytes(bytes, `${activeTemplate.name}${patientLabel}.pdf`);
      toast('PDF baixado com sucesso!', 'success');
    } catch (err) {
      console.error(err);
      toast('Erro ao gerar o PDF para download.', 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleCustomizeTemplateBoxes = async () => {
    if (!activeTemplate) return;
    const enriched = ensureReceitaDateField(activeTemplate);
    if (activeTemplate.isBuiltIn) {
      const copyId = `tpl_${activeTemplate.id}_${Date.now()}`;
      const copyTemplate: FormTemplate = {
        ...enriched,
        id: copyId,
        name: `${activeTemplate.name} (Personalizado)`,
        isBuiltIn: false,
        createdAt: new Date().toISOString(),
      };
      await saveTemplate(copyTemplate);
      navigate('/formularios/novo', { state: { editTemplateId: copyId } });
    } else {
      if (enriched.fields.length !== activeTemplate.fields.length) {
        await saveTemplate(enriched);
      }
      navigate('/formularios/novo', { state: { editTemplateId: activeTemplate.id } });
    }
  };

  const handleCopyAllText = () => {
    if (!activeTemplate) return;
    const summary = fieldGroups
      .map((g) => {
        const val = templateValues[g.primaryField.id];
        if (!val) return null;
        return `${g.label}: ${val}`;
      })
      .filter(Boolean)
      .join('\n');
    if (!summary) {
      toast('Nenhum campo preenchido para copiar.', 'info');
      return;
    }
    navigator.clipboard.writeText(summary);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 1800);
    toast('Conteúdo copiado para a área de transferência!', 'success');
  };

  const formPresets = activeTemplate ? getPresetsForForm(activeTemplate.id) : [];

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto pb-6">
      {/* Top Header & Form Selector Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {activeTemplate ? activeTemplate.name : 'Central de Formulários'}
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              Preenchimento inteligente sobre o PDF original com visualização nativa em tempo real.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {activeTemplate && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCustomizeTemplateBoxes}
                className="text-xs border-slate-200 text-slate-700 hover:bg-slate-100"
                title="Abrir editor visual para mover, redimensionar ou adicionar caixas neste PDF"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
                Ajustar Caixas no PDF
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsManagingTemplates((v) => !v)}
              className={`text-xs border-slate-200 ${
                isManagingTemplates
                  ? 'bg-teal-50 text-teal-800 border-teal-300'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5 mr-1.5 text-teal-600" />
              Gerenciar Moldes ({templates.length})
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/formularios/novo')}
              className="text-xs bg-teal-600 hover:bg-teal-700 text-white"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Importar Novo PDF
            </Button>
          </div>
        </div>

        {/* Painel Unificado: Gerenciar Meus Moldes PDF */}
        {isManagingTemplates && (
          <Card className="border-teal-200 bg-slate-50/70 shadow-2xs">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Gerenciar Meus Moldes PDF ({templates.length})
                  </h2>
                  <p className="text-xs text-slate-500">
                    Selecione um molde para preencher, renomeie, ajuste as caixas ou exclua moldes antigos sem sair desta tela.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {templates.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        clearAllTemplates();
                        setFormType('');
                        toast('Todos os moldes salvos foram removidos.', 'info');
                      }}
                      className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 bg-white"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Limpar Todos
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsManagingTemplates(false)}
                    className="h-7 text-xs text-slate-500"
                  >
                    <X className="w-3.5 h-3.5 mr-1" /> Fechar
                  </Button>
                </div>
              </div>

              {templates.length === 0 ? (
                <div className="p-4 rounded-lg bg-white border border-slate-200 text-center text-xs text-slate-500">
                  Nenhum molde PDF cadastrado ainda. Clique em <strong>Importar Novo PDF</strong> acima para mapear sua receita, pedido de exame, atestado ou AIH.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        setFormType(t.id);
                      }}
                      className={`p-3 rounded-lg border bg-white cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                        formType === t.id
                          ? 'border-teal-500 ring-1 ring-teal-500/30'
                          : 'border-slate-200 hover:border-teal-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        {editingTplId === t.id ? (
                          <input
                            autoFocus
                            value={editingTplName}
                            onChange={(e) => setEditingTplName(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.stopPropagation();
                                if (editingTplName.trim()) {
                                  renameTemplate(t.id, editingTplName.trim());
                                }
                                setEditingTplId(null);
                              } else if (e.key === 'Escape') {
                                e.stopPropagation();
                                setEditingTplId(null);
                              }
                            }}
                            onBlur={() => {
                              if (editingTplName.trim()) {
                                renameTemplate(t.id, editingTplName.trim());
                              }
                              setEditingTplId(null);
                            }}
                            className="w-full text-xs font-semibold text-slate-900 border-b border-teal-500 focus:outline-none bg-transparent"
                          />
                        ) : (
                          <span className="text-xs font-semibold text-slate-900 truncate">
                            {t.name}
                          </span>
                        )}
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() =>
                              navigate('/formularios/novo', { state: { editTemplateId: t.id } })
                            }
                            className="px-1.5 py-0.5 text-[11px] font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 rounded"
                            title="Ajustar caixas e campos no PDF"
                          >
                            Editar Caixas
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTplId(t.id);
                              setEditingTplName(t.name);
                            }}
                            className="p-1 text-slate-400 hover:text-teal-600"
                            title="Renomear molde"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              deleteTemplate(t.id);
                              toast(`"${t.name}" excluído.`, 'info');
                            }}
                            className="p-1 text-slate-400 hover:text-red-600"
                            title="Excluir molde"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {t.pages.length} pág. · {t.fields.length} campo(s) mapeado(s)
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Form Switcher Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5">

          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setFormType(t.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border flex items-center gap-1.5 ${
                formType === t.id
                  ? 'bg-teal-700 text-white border-teal-700 shadow-xs'
                  : 'bg-teal-50/60 text-teal-900 border-teal-200 hover:bg-teal-100/70'
              }`}
            >
              <FileText className="w-3 h-3" />
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split-Screen Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Form Controls, Saved Presets & AI Auto-Fill */}
        <div className="lg:col-span-6 space-y-4 lg:max-h-[calc(100vh-185px)] lg:overflow-y-auto pr-1">
          {/* 1. Saved Fill Presets Bar (Matching Reference Image 3) */}
          <Card className="border-slate-200 shadow-2xs">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex-1 min-w-[180px]">
                  <select
                    value={selectedPresetId}
                    onChange={(e) => handleSelectPreset(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">
                      Selecionar modelo ({formPresets.length} salvo{formPresets.length === 1 ? '' : 's'})
                    </option>
                    {formPresets.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSavingPreset((v) => !v)}
                  className="h-9 text-xs font-semibold text-teal-700 border-teal-300 bg-teal-50/50 hover:bg-teal-100/70"
                >
                  <BookmarkCheck className="w-3.5 h-3.5 mr-1.5" />
                  SALVAR MODELO
                </Button>

                {selectedPresetId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      deletePreset(selectedPresetId);
                      setSelectedPresetId('');
                      toast('Modelo removido.', 'info');
                    }}
                    className="h-9 text-xs text-red-600 border-red-200 hover:bg-red-50"
                    title="Excluir modelo selecionado"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearForm}
                  className="h-9 text-xs text-slate-600 border-slate-200 hover:bg-slate-100"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  LIMPAR
                </Button>
              </div>

              {isSavingPreset && (
                <div className="flex items-center gap-2 pt-2">
                  <Input
                    value={presetNameInput}
                    onChange={(e) => setPresetNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                    placeholder="Nome do modelo (ex: AIH Apendicectomia, Receita HAS...)"
                    className="h-8 text-xs flex-1"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleSavePreset} className="h-8 text-xs bg-teal-600 text-white">
                    Confirmar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsSavingPreset(false)}
                    className="h-8 text-xs"
                  >
                    Cancelar
                  </Button>
                </div>
              )}

              <p className="text-[11px] text-slate-400">
                Salve este preenchimento como modelo e reutilize depois com 1 clique.
              </p>
            </CardContent>
          </Card>

          {/* 2. AI Auto-Fill Card ("Preencher automático" — Matching Reference Images 2 & 3) */}
          {showAiAutoFill && (
            <div className="rounded-xl border border-teal-300/80 bg-teal-50/50 p-4 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-sm text-slate-900">Preencher automático</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-teal-700 font-medium">preenchimento inteligente por IA</span>
                  <button
                    type="button"
                    onClick={() => setShowAiAutoFill(false)}
                    className="text-slate-400 hover:text-slate-600"
                    title="Minimizar preenchimento automático"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <p className="text-xs text-slate-600">
                Cole o contexto (prontuário ou resumo do caso) ou cole/anexe um print da tela de cadastro e os campos deste formulário se preenchem sozinhos.
              </p>

              <Textarea
                value={aiContextText}
                onChange={(e) => setAiContextText(e.target.value)}
                onPaste={handleAiPaste}
                placeholder="Cole aqui a evolução/prontuário do paciente ou dê Ctrl+V em um print da tela de cadastro do hospital..."
                className="min-h-[68px] text-xs bg-white border-teal-200 focus-visible:ring-teal-500"
              />

              {aiScreenshot && (
                <div className="flex items-center justify-between bg-white border border-teal-200 rounded-lg px-3 py-1.5 text-xs">
                  <span className="text-teal-800 font-medium truncate">
                    Imagem anexada: {aiScreenshot.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAiScreenshot(null)}
                    className="text-slate-400 hover:text-red-600 ml-2"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
                <input
                  ref={aiImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleScreenshotFile(f);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => aiImageInputRef.current?.click()}
                  className="h-8 text-xs bg-white border-teal-200 text-teal-800 hover:bg-teal-100/50"
                >
                  <ImagePlus className="w-3.5 h-3.5 mr-1.5" />
                  Anexar Print da Tela
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleRunAiAutoFill}
                  disabled={isAutoFilling}
                  className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold px-4"
                >
                  {isAutoFilling ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Preenchendo campos...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Preencher Formulário com IA
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {!showAiAutoFill && (
            <button
              type="button"
              onClick={() => setShowAiAutoFill(true)}
              className="text-xs text-teal-700 font-medium hover:underline flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" /> Mostrar Preenchimento Automático por IA
            </button>
          )}

          {/* 3. Dynamic Form Fields List (Matching Reference Images 1, 2 & 3) */}
          <Card className="border-slate-200 shadow-2xs">
            <CardContent className="p-5 space-y-6">
              {isLoadingTemplate ? (
                <div className="py-12 flex items-center justify-center text-slate-400 gap-2 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin" /> Carregando estrutura do formulário...
                </div>
              ) : !activeTemplate ? (
                <div className="py-12 px-4 flex flex-col items-center text-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 max-w-md">
                    <h3 className="text-base font-bold text-slate-900">
                      Nenhuma receita ou formulário cadastrado ainda
                    </h3>
                    <p className="text-xs text-slate-500">
                      A central foi limpa. Clique abaixo para enviar o PDF oficial da sua receita, atestado, pedido de exames, AIH ou APAC e mapear os campos.
                    </p>
                  </div>
                  <Button
                    onClick={() => navigate('/formularios/novo')}
                    className="mt-1 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold"
                  >
                    <Plus className="w-4 h-4 mr-1.5" />
                    Importar Novo PDF Oficial
                  </Button>
                </div>
              ) : (
                fieldGroups.map((group) => {
                  const field = group.primaryField;
                  const groupFields = group.fields;
                  const currentVal =
                    groupFields.map((f) => templateValues[f.id]).find((v) => v !== undefined && v !== '') || '';
                  const currentPt = fieldFontSizes[field.id] ?? field.fontSize ?? 10;
                  const isPresc = isPrescriptionField(field, activeTemplate);
                  const isDate = isDateField(field);
                  const isBirthDate = isDate && group.label.toLowerCase().includes('nascimento');
                  const defaultFieldPt = isDate && !isBirthDate ? 12.06 : 10;
                  const effectivePt = fieldFontSizes[field.id] ?? field.fontSize ?? defaultFieldPt;
                  const currentAlign: VerticalAlignMode = fieldAlignments[field.id] || 'bottom';
                  const isExamList = isRequestedExamsField(field, activeTemplate);
                  const isSexoField =
                    group.label.toLowerCase().includes('sexo') && field.type !== 'checkbox';

                  return (
                    <div key={group.key} className="space-y-2.5">
                      {/* Field Header Row with Label + Multi-Via Badge + Per-Field Font Stepper (- 12.06 + pt) + Alignment Selector */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Label className="text-[11px] font-bold tracking-[0.14em] uppercase text-slate-500">
                            {group.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                          {groupFields.length > 1 && (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200"
                              title="Ao preencher este campo, o texto é inserido automaticamente nas duas vias do documento"
                            >
                              Preenche nas {groupFields.length} vias
                            </span>
                          )}
                        </div>

                        {field.type !== 'checkbox' && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex items-center border border-slate-200 rounded-full bg-white h-8 px-2.5 gap-2 shadow-2xs">
                              <button
                                type="button"
                                onClick={() => adjustGroupFontSize(groupFields, -0.5, field.fontSize || defaultFieldPt)}
                                className="text-slate-500 hover:text-slate-900 font-bold text-xs px-1 transition-colors"
                                title="Diminuir tamanho da fonte deste campo"
                              >
                                −
                              </button>
                              <span className="text-xs font-bold font-mono tabular-nums text-slate-800 min-w-[34px] text-center">
                                {effectivePt}
                              </span>
                              <button
                                type="button"
                                onClick={() => adjustGroupFontSize(groupFields, 0.5, field.fontSize || defaultFieldPt)}
                                className="text-slate-500 hover:text-slate-900 font-bold text-xs px-1 transition-colors"
                                title="Aumentar tamanho da fonte deste campo"
                              >
                                +
                              </button>
                              <span className="text-[11px] text-slate-400">pt</span>
                            </div>

                            <div
                              className="relative flex items-center border border-slate-200 rounded-full bg-white h-8 px-2.5 shadow-2xs"
                              title="Alinhamento vertical do texto dentro da caixa do PDF"
                            >
                              <select
                                value={currentAlign}
                                onChange={(e) =>
                                  setGroupAlignment(groupFields, e.target.value as VerticalAlignMode)
                                }
                                className="appearance-none bg-transparent pr-4 pl-0.5 text-[11px] font-semibold text-slate-700 focus:outline-none cursor-pointer"
                              >
                                <option value="bottom">▼</option>
                                <option value="middle">•</option>
                                <option value="top">▲</option>
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 text-slate-500 pointer-events-none absolute right-2" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* A. Standardized Prescription Block (Reference Image 1) */}
                      {isPresc ? (
                        <div className="space-y-3">
                          <div className="inline-flex items-center p-1 rounded-full bg-slate-100 border border-slate-200">
                            <button
                              type="button"
                              onClick={() => setPrescricaoMode('formulario')}
                              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                prescricaoMode === 'formulario'
                                  ? 'bg-white text-slate-900 shadow-xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Formulário
                            </button>
                            <button
                              type="button"
                              onClick={() => setPrescricaoMode('livre')}
                              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                prescricaoMode === 'livre'
                                  ? 'bg-white text-slate-900 shadow-xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Texto Livre
                            </button>
                          </div>

                          {prescricaoMode === 'livre' ? (
                            <Textarea
                              value={currentVal}
                              onChange={(e) => setGroupValue(groupFields, e.target.value)}
                              placeholder="Digite a prescrição livremente..."
                              className="min-h-[180px] text-sm rounded-xl border-slate-200"
                            />
                          ) : (
                            <div className="space-y-3">
                              <datalist id="quantidade-suggestions">
                                {QUANTIDADE_SUGGESTIONS.map((q) => (
                                  <option key={q} value={q} />
                                ))}
                              </datalist>

                              {medications.map((med, index) => (
                                <div
                                  key={med.id}
                                  className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/90 space-y-3 relative"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-slate-400">
                                      Medicamento #{index + 1}
                                    </span>
                                    {medications.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setMedications((prev) => prev.filter((m) => m.id !== med.id))
                                        }
                                        className="text-slate-400 hover:text-red-600 p-1"
                                        title="Remover medicamento"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                      <Label className="text-xs text-slate-600">Via:</Label>
                                      <select
                                        value={med.via}
                                        onChange={(e) => {
                                          const next = [...medications];
                                          next[index] = { ...next[index], via: e.target.value };
                                          setMedications(next);
                                        }}
                                        className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                                      >
                                        <option value="Oral">Oral</option>
                                        <option value="Sublingual">Sublingual</option>
                                        <option value="Intravenosa">Intravenosa</option>
                                        <option value="Intramuscular">Intramuscular</option>
                                        <option value="Subcutânea">Subcutânea</option>
                                        <option value="Tópica">Tópica</option>
                                        <option value="Inalatória">Inalatória</option>
                                        <option value="Nasal">Nasal</option>
                                        <option value="Oftálmica">Oftálmica</option>
                                        <option value="Uso Interno">Uso Interno</option>
                                        <option value="Uso Externo">Uso Externo</option>
                                      </select>
                                    </div>

                                    <div className="sm:col-span-2 space-y-1">
                                      <Label className="text-xs text-slate-600">Quantidade:</Label>
                                      <Input
                                        list="quantidade-suggestions"
                                        value={med.quantidade}
                                        onChange={(e) => {
                                          const next = [...medications];
                                          next[index] = { ...next[index], quantidade: e.target.value };
                                          setMedications(next);
                                        }}
                                        placeholder="CONTÍNUO, 1 CAIXA, 30 COMPRIMIDOS..."
                                        className="h-10 rounded-xl bg-white border-slate-200 text-sm"
                                      />
                                    </div>
                                  </div>

                                  <div className="space-y-1">
                                    <Label className="text-xs text-slate-600">Item (nome + dose):</Label>
                                    <Input
                                      value={med.item}
                                      onChange={(e) => {
                                        const next = [...medications];
                                        next[index] = { ...next[index], item: e.target.value };
                                        setMedications(next);
                                      }}
                                      placeholder="EX: ENALAPRIL 10MG"
                                      className="h-10 rounded-xl bg-white border-slate-200 text-sm"
                                    />
                                  </div>

                                  <div className="space-y-1">
                                    <Label className="text-xs text-slate-600">
                                      Forma de Utilização/Posologia:
                                    </Label>
                                    <Input
                                      value={med.posologia}
                                      onChange={(e) => {
                                        const next = [...medications];
                                        next[index] = { ...next[index], posologia: e.target.value };
                                        setMedications(next);
                                      }}
                                      placeholder="EX: 1.0.1 OU TOMAR 1 COMPRIMIDO DE 12/12H"
                                      className="h-10 rounded-xl bg-white border-slate-200 text-sm"
                                    />
                                    <p className="text-[11px] text-slate-400 pt-0.5">
                                      Enter pula linha · cada linha vira um tópico na receita
                                    </p>
                                  </div>
                                </div>
                              ))}

                              <Button
                                type="button"
                                variant="outline"
                                onClick={() =>
                                  setMedications((prev) => [
                                    ...prev,
                                    {
                                      id: `${Date.now()}`,
                                      via: 'Oral',
                                      quantidade: 'CONTÍNUO',
                                      item: '',
                                      posologia: '',
                                    },
                                  ])
                                }
                                className="rounded-xl text-indigo-600 border-indigo-200 hover:bg-indigo-50/60 text-xs font-semibold"
                              >
                                <Plus className="w-4 h-4 mr-1.5" /> Adicionar medicamento
                              </Button>

                              <p className="text-xs text-slate-400 pt-1">
                                Preencha os campos · a formatação para o PDF é automática
                              </p>
                            </div>
                          )}
                        </div>
                      ) : isDate ? (
                        /* B. Date Field with "DD/MM/AAAA", "Hoje" Quick Button & Calendar Picker (Matching Screenshot) */
                        <div className="relative flex items-center">
                          <Input
                            value={currentVal}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const nextVal = /^\d[\d/]*$/.test(raw) ? maskDateBrInput(raw) : raw;
                              setGroupValue(groupFields, nextVal);
                            }}
                            placeholder="DD/MM/AAAA"
                            className="h-12 rounded-2xl border-slate-200 bg-white pl-4 pr-28 text-sm text-slate-800 placeholder:text-slate-300"
                          />
                          <div className="absolute right-3 flex items-center gap-2">
                            {!isBirthDate && (
                              <button
                                type="button"
                                onClick={() => setGroupValue(groupFields, todayBr())}
                                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 text-slate-700 text-xs font-semibold transition-colors"
                                title="Preencher com a data de hoje"
                              >
                                Hoje
                              </button>
                            )}
                            <label
                              className="relative p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center"
                              title="Selecionar data no calendário"
                            >
                              <Calendar className="w-4 h-4 pointer-events-none" />
                              <input
                                type="date"
                                value={brDateToIso(currentVal)}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    setGroupValue(groupFields, formatDateBr(e.target.value));
                                  }
                                }}
                                onClick={(e) => {
                                  try {
                                    (e.currentTarget as any).showPicker?.();
                                  } catch {
                                    // fallback to native click
                                  }
                                }}
                                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                              />
                            </label>
                          </div>
                        </div>
                      ) : isSexoField ? (
                        /* C. Sexo Quick Toggle Buttons (Reference Image 3) */
                        <div className="flex items-center gap-2">
                          {['MASCULINO', 'FEMININO'].map((sx) => (
                            <button
                              key={sx}
                              type="button"
                              onClick={() => setGroupValue(groupFields, sx)}
                              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                                currentVal.toUpperCase() === sx || currentVal.toUpperCase() === sx[0]
                                  ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {sx}
                            </button>
                          ))}
                          <Input
                            value={currentVal}
                            onChange={(e) => setGroupValue(groupFields, e.target.value)}
                            placeholder="Ou digite..."
                            className="h-9 rounded-xl border-slate-200 text-xs flex-1"
                          />
                        </div>
                      ) : field.type === 'checkbox' ? (
                        /* D. Checkbox Field */
                        <label className="inline-flex items-center gap-2.5 text-sm text-slate-700 cursor-pointer select-none py-1">
                          <input
                            type="checkbox"
                            checked={currentVal === 'true'}
                            onChange={(e) => setGroupValue(groupFields, e.target.checked ? 'true' : '')}
                            className="w-4 h-4 rounded accent-teal-600"
                          />
                          <span>Marcar opção com "X" no documento</span>
                        </label>
                      ) : isExamList ? (
                        /* E. Requested Exams Field with Shortcut Pills & Clickable Categorized List */
                        <ExamSelectorBlock
                          value={currentVal}
                          onChange={(val) => setGroupValue(groupFields, val)}
                        />
                      ) : field.type === 'textarea' ? (
                        /* F. Multi-line Textarea */
                        <Textarea
                          value={currentVal}
                          onChange={(e) => setGroupValue(groupFields, e.target.value)}
                          placeholder={group.label}
                          className="min-h-[96px] rounded-xl border-slate-200 text-sm"
                        />
                      ) : (
                        /* G. Standard Single-line Input */
                        <Input
                          value={currentVal}
                          onChange={(e) => setGroupValue(groupFields, e.target.value)}
                          placeholder={group.label}
                          className="h-11 rounded-xl border-slate-200 text-sm"
                        />
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Native Browser PDF Viewer (Matching Reference Images 2 & 3) */}
        <div className="lg:col-span-6 sticky top-4 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col h-[calc(100vh-185px)] min-h-[600px]">
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs font-bold tracking-wider uppercase text-slate-600 flex items-center gap-2">
                <FileText className="w-4 h-4 text-teal-600" />
                PRÉVIA DO DOCUMENTO (PDF ORIGINAL + TEXTO)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyAllText}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
                >
                  {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedText ? 'Copiado' : 'Copiar texto'}
                </button>
                <Button
                  size="sm"
                  onClick={handleDownloadPdf}
                  disabled={isGeneratingPdf || !activeTemplate}
                  className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold"
                >
                  {isGeneratingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Baixar PDF
                </Button>
              </div>
            </div>

            {/* Native-style PDF Viewer Container (never blocked inside iframes) */}
            <div className="flex-1 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 relative">
              <PdfLiveViewer
                pdfBytes={pdfBytes}
                title={`${activeTemplate?.name || 'Documento'}.pdf`}
                onDownload={handleDownloadPdf}
              />
            </div>

            <div className="mt-3 rounded-xl bg-blue-50/90 border border-blue-200/80 px-4 py-2.5 text-xs text-blue-700 flex items-center justify-between gap-2">
              <span>
                O PDF é gerado em tempo real mantendo o documento original e sobrepondo o texto. Use a barra nativa acima para dar zoom, imprimir ou clique em <strong>"Baixar PDF"</strong>.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
