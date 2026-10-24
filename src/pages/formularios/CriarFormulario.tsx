import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@/components/ui';
import { PdfPageCanvas } from '@/components/formularios/PdfPageCanvas';
import { FieldBox } from '@/components/formularios/FieldBox';
import {
  UploadCloud,
  Plus,
  X,
  Sparkles,
  Loader2,
  Save,
  ArrowLeft,
  FileText,
  Wand2,
  MousePointerClick,
  Trash2,
  Copy,
} from 'lucide-react';
import { fileToBase64, dataUrlToBase64 } from '@/lib/fileToBase64';
import { renderAllPages, RenderedPage } from '@/lib/pdfRender';
import { cleanViaLabel, getCanonicalFieldInfo } from '@/lib/generateFilledPdf';
import { useAiGenerate } from '@/hooks/useAiGenerate';
import { useToast } from '@/hooks/useToast';
import { useFormTemplates } from '@/hooks/useFormTemplates';
import type { FieldType, FormField, FormTemplate } from '@/types/formTemplate';

interface FieldDraft {
  id: string;
  label: string;
  type: FieldType;
}

interface DetectedField {
  label: string;
  type?: FieldType;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
}

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Texto curto (1 linha)' },
  { value: 'textarea', label: 'Texto longo (múltiplas linhas)' },
  { value: 'prescription', label: 'Bloco de Prescrição (Receita Padrão)' },
  { value: 'date', label: 'Data (DD/MM/AAAA)' },
  { value: 'checkbox', label: 'Caixa de marcação [X]' },
];

const CATEGORY_OPTIONS: { value: NonNullable<FormTemplate['category']>; label: string }[] = [
  { value: 'guia', label: 'Guia Hospitalar / SUS (AIH, APAC, LME)' },
  { value: 'receita', label: 'Receituário Médico (Segue modelo padrão de Receita)' },
  { value: 'atestado', label: 'Atestado / Declaração' },
  { value: 'exames', label: 'Solicitação de Exames' },
  { value: 'outro', label: 'Outro Documento' },
];

const clamp01 = (v: number, max = 0.97) => Math.min(max, Math.max(0, Number.isFinite(v) ? v : 0));

function normalizeFieldType(rawType?: string, label = ''): FieldType {
  const lowerLabel = label.toLowerCase();
  if (rawType === 'prescription' || lowerLabel.includes('prescri')) return 'prescription';
  if (rawType === 'checkbox') return 'checkbox';
  if (rawType === 'date' || lowerLabel.includes('data')) return 'date';
  if (
    rawType === 'textarea' ||
    lowerLabel.includes('exame') ||
    lowerLabel.includes('justificativa') ||
    lowerLabel.includes('sintomas') ||
    lowerLabel.includes('observa') ||
    lowerLabel.includes('provas') ||
    lowerLabel.includes('resumo')
  ) {
    return 'textarea';
  }
  return 'text';
}

function FieldTypeSelect({
  value,
  onChange,
  label,
}: {
  value: FieldType;
  onChange: (v: FieldType) => void;
  label?: string;
}) {
  return (
    <div className="space-y-1">
      {label && <Label className="text-xs text-slate-500">{label}</Label>}
      <select
        className="w-full h-9 text-xs rounded-md border border-slate-200 bg-white px-2.5 shadow-xs focus:ring-teal-500 focus:border-teal-500"
        value={value}
        onChange={(e) => onChange(e.target.value as FieldType)}
      >
        {FIELD_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function CriarFormulario() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { generate } = useAiGenerate();
  const { templates, saveTemplate } = useFormTemplates();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editTemplateId = (location.state as any)?.editTemplateId as string | undefined;

  const [editingId, setEditingId] = useState<string | null>(editTemplateId || null);
  const [step, setStep] = useState<'upload' | 'fields' | 'ajustar'>('upload');
  const [templateName, setTemplateName] = useState('');
  const [category, setCategory] = useState<NonNullable<FormTemplate['category']>>('guia');
  const [pdfBase64, setPdfBase64] = useState('');
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

  const [showManualDrafts, setShowManualDrafts] = useState(false);
  const [fieldDrafts, setFieldDrafts] = useState<FieldDraft[]>([]);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftType, setDraftType] = useState<FieldType>('text');

  const [fields, setFields] = useState<FormField[]>([]);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectStatus, setDetectStatus] = useState('');

  // Load existing template if editing
  useEffect(() => {
    if (!editTemplateId) return;
    const existing = templates.find((t) => t.id === editTemplateId);
    if (!existing) return;

    let cancelled = false;
    setIsLoadingPdf(true);
    renderAllPages(existing.pdfBase64, 1.5)
      .then((rendered) => {
        if (cancelled) return;
        setEditingId(existing.id);
        setTemplateName(existing.name);
        setCategory(existing.category || 'outro');
        setPdfBase64(existing.pdfBase64);
        setPages(rendered);
        setFields(existing.fields);
        setActiveFieldId(existing.fields[0]?.id ?? null);
        setCurrentPage(0);
        setStep('ajustar');
      })
      .catch((err) => {
        console.error(err);
        toast('Erro ao abrir o PDF deste molde para edição.', 'error');
      })
      .finally(() => {
        if (!cancelled) setIsLoadingPdf(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editTemplateId, templates, toast]);

  // --- Step 1: upload ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast('Por favor, envie um arquivo PDF.', 'error');
      return;
    }
    setIsLoadingPdf(true);
    try {
      const base64 = await fileToBase64(file);
      const rendered = await renderAllPages(base64, 1.5);
      setPdfBase64(base64);
      setPages(rendered);
      const cleanName = file.name.replace(/\.pdf$/i, '');
      if (!templateName) setTemplateName(cleanName);
      if (cleanName.toLowerCase().includes('receit')) {
        setCategory('receita');
      } else if (cleanName.toLowerCase().includes('atestado')) {
        setCategory('atestado');
      } else if (cleanName.toLowerCase().includes('exame')) {
        setCategory('exames');
      } else {
        setCategory('guia');
      }
      toast(`PDF carregado (${rendered.length} página${rendered.length > 1 ? 's' : ''}).`, 'success');
      setStep('fields');
    } catch (err) {
      console.error(err);
      toast('Não foi possível ler este PDF. Verifique se o arquivo não está corrompido.', 'error');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // --- Step 2A: Automatic Full-Page AI Scan (Zero manual typing needed!) ---
  const runAutoDetectionAllPages = async () => {
    if (pages.length === 0) return;
    setIsDetecting(true);
    setDetectStatus(
      pages.length > 1
        ? `Mapeando automaticamente todas as ${pages.length} páginas em paralelo...`
        : 'Mapeando automaticamente todas as caixas e linhas da página...'
    );

    try {
      const pageResults = await Promise.all(
        pages.map(async (pageObj, p) => {
          const mimeMatch = pageObj.dataUrl.match(/^data:([^;]+);base64,/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
          const result = await generate<DetectedField[]>({
            type: 'auto-detectar-campos-pdf',
            inlineData: { mimeType, data: dataUrlToBase64(pageObj.dataUrl) },
            parseJson: true,
            errorMessage: `Não foi possível detectar automaticamente a página ${p + 1}.`,
          });
          return { p, result };
        })
      );

      const detectedAll: FormField[] = [];
      pageResults.forEach(({ p, result }) => {
        if (Array.isArray(result)) {
          result.forEach((r, idx) => {
            if (!r || !r.label) return;
            const cleanedLabel = cleanViaLabel(r.label.trim());
            const fType = normalizeFieldType(r.type, cleanedLabel);
            detectedAll.push({
              id: `f_${p}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
              label: cleanedLabel,
              type: fType,
              page: p,
              xNorm: clamp01(r.x),
              yNorm: clamp01(r.y),
              wNorm: clamp01(r.width || (fType === 'checkbox' ? 0.025 : 0.28), 1),
              hNorm: clamp01(r.height || (fType === 'textarea' ? 0.08 : 0.028), 1),
              fontSize: r.fontSize || (category === 'guia' ? 8 : 10),
            });
          });
        }
      });

      if (detectedAll.length === 0) {
        toast('Nenhum campo foi detectado automaticamente. Você pode adicionar caixas clicando na página.', 'info');
      } else {
        toast(`${detectedAll.length} campos detectados automaticamente! Ajuste ou adicione novos se desejar.`, 'success');
      }

      setFields(detectedAll);
      setActiveFieldId(detectedAll[0]?.id ?? null);
      setCurrentPage(0);
      setStep('ajustar');
    } finally {
      setIsDetecting(false);
      setDetectStatus('');
    }
  };

  // Re-run automatic AI detection on current page inside the visual editor
  const runAutoDetectionCurrentPage = async () => {
    const pageObj = pages[currentPage];
    if (!pageObj) return;
    setIsDetecting(true);
    setDetectStatus(`Analisando página ${currentPage + 1}...`);
    try {
      const mimeMatch = pageObj.dataUrl.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const result = await generate<DetectedField[]>({
        type: 'auto-detectar-campos-pdf',
        inlineData: { mimeType, data: dataUrlToBase64(pageObj.dataUrl) },
        parseJson: true,
      });

      if (Array.isArray(result) && result.length > 0) {
        const newPageFields: FormField[] = result
          .filter((r) => r && r.label)
          .map((r, idx) => {
            const cleanedLabel = cleanViaLabel(r.label.trim());
            const fType = normalizeFieldType(r.type, cleanedLabel);
            return {
              id: `f_${currentPage}_${Date.now()}_${idx}`,
              label: cleanedLabel,
              type: fType,
              page: currentPage,
              xNorm: clamp01(r.x),
              yNorm: clamp01(r.y),
              wNorm: clamp01(r.width || 0.25, 1),
              hNorm: clamp01(r.height || 0.028, 1),
              fontSize: r.fontSize || 8.5,
            };
          });

        setFields((prev) => [...prev.filter((f) => f.page !== currentPage), ...newPageFields]);
        setActiveFieldId(newPageFields[0]?.id ?? null);
        toast(`${newPageFields.length} campos mapeados na página ${currentPage + 1}.`, 'success');
      } else {
        toast('Nenhum campo adicional identificado nesta página.', 'info');
      }
    } finally {
      setIsDetecting(false);
      setDetectStatus('');
    }
  };

  // --- Step 2B: Manual list detection ---
  const addFieldDraft = () => {
    if (!draftLabel.trim()) return;
    setFieldDrafts((prev) => [
      ...prev,
      { id: `f${Date.now()}${Math.random().toString(36).slice(2, 6)}`, label: draftLabel.trim(), type: draftType },
    ]);
    setDraftLabel('');
    setDraftType('text');
  };

  const removeFieldDraft = (id: string) => {
    setFieldDrafts((prev) => prev.filter((f) => f.id !== id));
  };

  const runNamedDetection = async () => {
    if (fieldDrafts.length === 0) return;
    setIsDetecting(true);
    const found: FormField[] = [];
    const allLabels = fieldDrafts.map((f) => f.label);

    for (let p = 0; p < pages.length; p++) {
      if (found.length >= fieldDrafts.length) break;
      setDetectStatus(`Localizando campos na página ${p + 1} de ${pages.length}...`);

      const alreadyFound = found.map((f) => f.label);
      const mimeMatch = pages[p].dataUrl.match(/^data:([^;]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const result = await generate<DetectedField[]>({
        type: 'detectar-campos-pdf',
        inlineData: { mimeType, data: dataUrlToBase64(pages[p].dataUrl) },
        fieldLabels: allLabels,
        alreadyFound,
        parseJson: true,
        errorMessage: 'Erro ao detectar campos com IA nesta página.',
      });

      if (result) {
        for (const r of result) {
          const draft = fieldDrafts.find((fd) => fd.label === r.label && !found.some((f) => f.id === fd.id));
          if (!draft) continue;
          found.push({
            id: draft.id,
            label: draft.label,
            type: draft.type,
            page: p,
            xNorm: clamp01(r.x),
            yNorm: clamp01(r.y),
            wNorm: clamp01(r.width || 0.3, 1),
            hNorm: clamp01(r.height || 0.032, 1),
            fontSize: r.fontSize || 9,
          });
        }
      }
    }

    const missing = fieldDrafts.filter((fd) => !found.some((f) => f.id === fd.id));
    missing.forEach((fd, idx) => {
      found.push({
        id: fd.id,
        label: fd.label,
        type: fd.type,
        page: 0,
        xNorm: 0.05,
        yNorm: 0.05 + idx * 0.05,
        wNorm: 0.35,
        hNorm: 0.035,
        fontSize: 9,
      });
    });

    setFields(found);
    setActiveFieldId(found[0]?.id ?? null);
    setCurrentPage(found[0]?.page ?? 0);
    setIsDetecting(false);
    setDetectStatus('');
    setStep('ajustar');
  };

  // --- Step 3: adjust ---
  const updateField = (id: string, patch: Partial<FormField>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeField = (id: string) => {
    setFields((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (activeFieldId === id) {
        setActiveFieldId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const duplicateField = (field: FormField) => {
    const id = `f${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    // Keep the exact same label so that both boxes are linked as 1ª Via & 2ª Via!
    const canShiftRight = field.wNorm <= 0.48 && field.xNorm < 0.48;
    const copy: FormField = {
      ...field,
      id,
      label: field.label,
      xNorm: canShiftRight ? clamp01(field.xNorm + 0.5) : field.xNorm,
      yNorm: canShiftRight ? field.yNorm : clamp01(field.yNorm + 0.045),
    };
    setFields((prev) => [...prev, copy]);
    setActiveFieldId(id);
    toast(
      `2ª via do campo "${field.label}" criada! Campos com o mesmo nome são preenchidos juntos automaticamente.`,
      'info'
    );
  };

  const addManualFieldAt = (xNorm = 0.1, yNorm = 0.1, type: FieldType = 'text') => {
    const id = `f${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const newField: FormField = {
      id,
      label: type === 'prescription' ? 'Prescrição' : type === 'checkbox' ? 'Opção [X]' : `Campo ${fields.length + 1}`,
      type,
      page: currentPage,
      xNorm,
      yNorm,
      wNorm: type === 'checkbox' ? 0.025 : type === 'prescription' ? 0.8 : 0.28,
      hNorm: type === 'checkbox' ? 0.022 : type === 'prescription' ? 0.35 : type === 'textarea' ? 0.08 : 0.028,
      fontSize: category === 'guia' ? 8 : 10,
    };
    setFields((prev) => [...prev, newField]);
    setActiveFieldId(id);
  };

  const handleSave = async () => {
    if (!templateName.trim()) {
      toast('Dê um nome para este formulário antes de salvar.', 'error');
      return;
    }
    if (fields.length === 0) {
      toast('Adicione pelo menos um campo antes de salvar.', 'error');
      return;
    }

    // If category is 'receita' and there is no prescription field yet, mark any field named prescrição as prescription
    const normalizedFields = fields.map((f) => {
      if (category === 'receita' && f.label.toLowerCase().includes('prescri')) {
        return { ...f, type: 'prescription' as FieldType };
      }
      return f;
    });

    const savedId = editingId || `tpl_${Date.now()}`;
    await saveTemplate({
      id: savedId,
      name: templateName.trim(),
      category,
      pdfBase64,
      pages: pages.map((p) => ({ widthPts: p.widthPts, heightPts: p.heightPts })),
      fields: normalizedFields,
      createdAt: new Date().toISOString(),
    });
    toast('Molde PDF salvo com sucesso! Abrindo para preenchimento...', 'success');
    navigate('/formularios', { state: { selectedForm: savedId } });
  };

  const activeField = fields.find((f) => f.id === activeFieldId) || null;
  const fieldsOnCurrentPage = fields.filter((f) => f.page === currentPage);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/formularios')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {editingId ? `Editar Molde: ${templateName}` : 'Criar Novo Molde a partir de PDF'}
            </h1>
            <p className="text-slate-500 text-sm">
              Envie qualquer PDF (AIH, APAC, Receituário, Atestado). A IA detecta automaticamente todas as caixas de preenchimento e mantém o PDF original intacto.
            </p>
          </div>
        </div>
        {step === 'ajustar' && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={runAutoDetectionCurrentPage}
              disabled={isDetecting}
              className="border-teal-200 text-teal-700 hover:bg-teal-50"
            >
              {isDetecting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> {detectStatus || 'Analisando...'}
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 mr-2" /> Re-detectar Campos da Página com IA
                </>
              )}
            </Button>
            <Button onClick={handleSave} className="bg-teal-600 hover:bg-teal-700 text-white">
              <Save className="w-4 h-4 mr-2" /> Salvar e Abrir Formulário
            </Button>
          </div>
        )}
      </div>

      {step === 'upload' && (
        <Card className="border-dashed border-2 border-slate-300 bg-slate-50/50">
          <CardContent className="p-14 flex flex-col items-center justify-center text-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center shadow-xs">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div className="max-w-md space-y-1">
              <p className="font-semibold text-lg text-slate-900">Envie o PDF original em branco (AIH, APAC, Receita, Atestado)</p>
              <p className="text-sm text-slate-500">
                O PDF original será preservado integralmente. O sistema apenas estampa o texto preenchido por cima das caixas e linhas.
              </p>
            </div>
            <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoadingPdf}
              className="mt-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-5"
            >
              {isLoadingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processando páginas do PDF...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 mr-2" /> Escolher arquivo PDF
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'fields' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <Card>
            <CardHeader className="py-4 border-b border-slate-100">
              <CardTitle className="text-lg">Configuração e Mapeamento Automático</CardTitle>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-600 mb-1.5 block">Nome do Formulário *</Label>
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Ex: AIH Hospital das Clínicas / Receita HC"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-600 mb-1.5 block">Categoria do Documento</Label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full h-10 text-sm rounded-md border border-slate-200 bg-white px-3 shadow-xs focus:ring-teal-500 focus:border-teal-500"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="rounded-xl bg-teal-50/90 border border-teal-200 p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-teal-950 text-sm">
                      Detecção Total Automática por IA (Ideal para AIH, APAC e Receituários)
                    </h3>
                    <p className="text-xs text-teal-800 mt-0.5 leading-relaxed">
                      Você não precisa digitar os nomes dos campos um por um. A IA analisa a imagem do PDF, reconhece todas as caixas numeradas, linhas em branco e opções de marcar, e já posiciona tudo para você ajustar se quiser.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={runAutoDetectionAllPages}
                  disabled={isDetecting}
                  className="w-full py-5 bg-teal-600 hover:bg-teal-700 text-white font-semibold shadow-xs"
                >
                  {isDetecting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> {detectStatus || 'Mapeando todos os campos do PDF...'}
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" /> Detectar Todos os Campos Automaticamente com IA
                    </>
                  )}
                </Button>
              </div>

              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setShowManualDrafts((v) => !v)}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
                  >
                    {showManualDrafts
                      ? 'Ocultar lista manual de campos específicos'
                      : 'Ou informar lista específica de campos manualmente'}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (category === 'receita') {
                        setFields([
                          {
                            id: 'f_nome',
                            label: 'Nome do Paciente',
                            type: 'text',
                            page: 0,
                            xNorm: 0.16,
                            yNorm: 0.16,
                            wNorm: 0.72,
                            hNorm: 0.03,
                            fontSize: 10.5,
                          },
                          {
                            id: 'f_prescricao',
                            label: 'Prescrição',
                            type: 'prescription',
                            page: 0,
                            xNorm: 0.08,
                            yNorm: 0.24,
                            wNorm: 0.84,
                            hNorm: 0.52,
                            fontSize: 10,
                          },
                          {
                            id: 'f_data',
                            label: 'Data do Pedido',
                            type: 'date',
                            page: 0,
                            xNorm: 0.14,
                            yNorm: 0.84,
                            wNorm: 0.22,
                            hNorm: 0.03,
                            fontSize: 10,
                          },
                        ]);
                        setActiveFieldId('f_nome');
                      }
                      setStep('ajustar');
                    }}
                    className="text-xs text-slate-600"
                  >
                    Pular para Editor Visual Manual →
                  </Button>
                </div>

                {showManualDrafts && (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div className="flex gap-2">
                      <Input
                        value={draftLabel}
                        onChange={(e) => setDraftLabel(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFieldDraft())}
                        placeholder="Ex: Nome do paciente"
                        className="flex-1 bg-white"
                      />
                      <div className="w-48">
                        <FieldTypeSelect value={draftType} onChange={setDraftType} />
                      </div>
                      <Button onClick={addFieldDraft} size="icon" variant="outline">
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>

                    {fieldDrafts.length > 0 && (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {fieldDrafts.map((f) => (
                          <div
                            key={f.id}
                            className="flex items-center justify-between bg-white border border-slate-200 rounded-md px-3 py-1.5 text-xs"
                          >
                            <span className="font-medium text-slate-700">{f.label}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400">
                                {FIELD_TYPE_OPTIONS.find((o) => o.value === f.type)?.label}
                              </span>
                              <button onClick={() => removeFieldDraft(f.id)} className="text-slate-400 hover:text-red-600">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      onClick={runNamedDetection}
                      disabled={fieldDrafts.length === 0 || isDetecting}
                      variant="outline"
                      className="w-full"
                    >
                      Localizar apenas estes {fieldDrafts.length} campos
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col items-center gap-2">
            {pages[0] && <PdfPageCanvas dataUrl={pages[0].dataUrl} maxWidthPx={460} />}
            <span className="text-xs text-slate-400">
              Pré-visualização da Página 1 ({pages.length} página{pages.length > 1 ? 's' : ''} no total)
            </span>
          </div>
        </div>
      )}

      {step === 'ajustar' && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap bg-white border border-slate-200 rounded-lg px-4 py-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                {pages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentPage(idx)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      currentPage === idx
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Página {idx + 1} ({fields.filter((f) => f.page === idx).length})
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addManualFieldAt(0.08, 0.12, 'text')}
                  className="h-8 text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> + Caixa de Texto
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addManualFieldAt(0.08, 0.25, 'prescription')}
                  className="h-8 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> + Bloco Prescrição
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addManualFieldAt(0.15, 0.15, 'checkbox')}
                  className="h-8 text-xs text-amber-700 border-amber-200 hover:bg-amber-50"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> + Marcação [X]
                </Button>
              </div>
            </div>

            <div className="bg-slate-200/80 rounded-xl p-4 sm:p-6 flex justify-center overflow-auto border border-slate-300">
              {pages[currentPage] && (
                <PdfPageCanvas
                  dataUrl={pages[currentPage].dataUrl}
                  maxWidthPx={760}
                  onCanvasDoubleClick={(xNorm, yNorm) => addManualFieldAt(xNorm, yNorm, 'text')}
                >
                  {(w, h) =>
                    fieldsOnCurrentPage.map((f) => {
                      const globalIndex = fields.findIndex((item) => item.id === f.id);
                      return (
                        <FieldBox
                          key={f.id}
                          field={f}
                          index={globalIndex}
                          containerWidthPx={w}
                          containerHeightPx={h}
                          onChange={(patch) => updateField(f.id, patch)}
                          onRemove={() => removeField(f.id)}
                          active={f.id === activeFieldId}
                          onActivate={() => setActiveFieldId(f.id)}
                        />
                      );
                    })
                  }
                </PdfPageCanvas>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <MousePointerClick className="w-4 h-4 text-teal-600" />
              <span>
                <strong>Dica:</strong> Arraste qualquer caixa para mover, puxe o canto inferior direito para redimensionar, ou dê <strong>duplo-clique em qualquer lugar do PDF</strong> para criar uma caixa naquele ponto exato.
              </span>
            </div>
          </div>

          <div className="space-y-4 sticky top-4">
            <Card>
              <CardHeader className="py-3 border-b border-slate-100">
                <CardTitle className="text-sm">Dados do Molde</CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Nome do Formulário</Label>
                  <Input
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Categoria</Label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full h-8 text-xs rounded-md border border-slate-200 bg-white px-2"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            {activeField && (
              <Card className="border-teal-200 shadow-xs">
                <CardHeader className="py-2.5 px-3 bg-teal-50/60 border-b border-teal-100 flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-bold text-teal-900">
                    Propriedades do Campo Selecionado
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => duplicateField(activeField)}
                      className="p-1 text-slate-500 hover:text-teal-700 rounded"
                      title="Duplicar campo"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeField(activeField.id)}
                      className="p-1 text-slate-500 hover:text-red-600 rounded"
                      title="Excluir campo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </CardHeader>
                <CardContent className="p-3 space-y-3">
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Rótulo / Nome do Campo</Label>
                    <Input
                      value={activeField.label}
                      onChange={(e) => updateField(activeField.id, { label: e.target.value })}
                      className="h-8 text-xs"
                    />
                    <p className="text-[10px] text-teal-700 mt-1">
                      Dica 2 Vias: Caixas com o mesmo nome são unificadas em 1 só campo ao preencher.
                    </p>
                  </div>
                  <FieldTypeSelect
                    label="Tipo de Preenchimento"
                    value={activeField.type}
                    onChange={(v: FieldType) => updateField(activeField.id, { type: v })}
                  />
                  <div className="flex items-center justify-between pt-1">
                    <Label className="text-xs text-slate-500">Tamanho da Fonte Padrão</Label>
                    <div className="flex items-center border border-slate-200 rounded-md bg-white h-7 px-1">
                      <button
                        type="button"
                        onClick={() =>
                          updateField(activeField.id, {
                            fontSize: Math.max(5, Number(((activeField.fontSize || 9) - 0.5).toFixed(1))),
                          })
                        }
                        className="px-2 text-xs text-slate-600 hover:text-slate-900 font-bold"
                      >
                        −
                      </button>
                      <span className="text-xs font-mono tabular-nums px-2 text-slate-800">
                        {activeField.fontSize || 9} pt
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          updateField(activeField.id, {
                            fontSize: Math.min(24, Number(((activeField.fontSize || 9) + 0.5).toFixed(1))),
                          })
                        }
                        className="px-2 text-xs text-slate-600 hover:text-slate-900 font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="py-2.5 px-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-xs font-semibold">
                  Todos os Campos ({fields.length})
                </CardTitle>
                {fields.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setFields([]);
                      setActiveFieldId(null);
                    }}
                    className="text-[11px] text-red-600 hover:underline"
                  >
                    Limpar todos
                  </button>
                )}
              </CardHeader>
              <CardContent className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
                {fields.map((f, idx) => {
                  const canonicalKey = getCanonicalFieldInfo(f, { category } as any).key;
                  const sameViaCount = fields.filter(
                    (other) => getCanonicalFieldInfo(other, { category } as any).key === canonicalKey
                  ).length;

                  return (
                    <div
                      key={f.id}
                      onClick={() => {
                        setActiveFieldId(f.id);
                        setCurrentPage(f.page);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between cursor-pointer transition-colors ${
                        f.id === activeFieldId
                          ? 'bg-teal-50 border border-teal-200 text-teal-900 font-medium'
                          : 'hover:bg-slate-50 border border-transparent text-slate-600'
                      }`}
                    >
                      <span className="truncate flex items-center gap-1.5">
                        <span className="text-slate-400">{idx + 1}.</span>
                        <span className="truncate">{f.label}</span>
                        {sameViaCount > 1 && (
                          <span className="px-1.5 py-0.2 rounded bg-teal-100 text-teal-800 text-[9px] font-bold shrink-0">
                            {sameViaCount} vias
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-[10px] text-slate-400 font-mono">{f.fontSize || 9}pt</span>
                        <span className="text-[10px] text-slate-400">p.{f.page + 1}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeField(f.id);
                          }}
                          className="text-slate-300 hover:text-red-600"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Button onClick={handleSave} className="w-full py-5 bg-teal-600 hover:bg-teal-700 text-white font-semibold">
              <Save className="w-4 h-4 mr-2" /> Salvar Molde PDF
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
