import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, Button, Textarea, Input, Label } from '@/components/ui';
import { Camera, Type, Loader2, Copy, ArrowRight, Sparkles, ShieldCheck, FileCheck, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAiGenerate } from '@/hooks/useAiGenerate';
import { useToast } from '@/hooks/useToast';
import { copyToClipboard } from '@/lib/utils';

export default function AiTools() {
  const { generate } = useAiGenerate();
  const { toast } = useToast();

  // 1. Adaptador State
  const [rawData, setRawData] = useState('');
  const [adaptStyle, setAdaptStyle] = useState('Evolução SOAP');
  const [adaptedData, setAdaptedData] = useState('');
  const [isAdapting, setIsAdapting] = useState(false);

  // 2. Revisor Médico State
  const [reviewInput, setReviewInput] = useState('');
  const [reviewGoal, setReviewGoal] = useState('Aprimorar terminologia semiológica e clareza');
  const [reviewedData, setReviewedData] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

  // 3. Gerador Rápido de Sumário de Alta
  const [altaNome, setAltaNome] = useState('');
  const [altaDiag, setAltaDiag] = useState('');
  const [altaResumo, setAltaResumo] = useState('');
  const [altaPrescricao, setAltaPrescricao] = useState('');
  const [altaResult, setAltaResult] = useState('');
  const [isGeneratingAlta, setIsGeneratingAlta] = useState(false);

  const handleAdapt = async () => {
    if (!rawData.trim()) return;
    setIsAdapting(true);
    const text = await generate<string>({
      type: 'adaptador-dados',
      formData: { texto: rawData, estilo: adaptStyle },
      errorMessage: 'Erro ao adaptar dados. Tente novamente.',
    });
    if (text) setAdaptedData(text);
    setIsAdapting(false);
  };

  const handleReview = async () => {
    if (!reviewInput.trim()) return;
    setIsReviewing(true);
    const text = await generate<string>({
      type: 'revisor-medico',
      formData: { texto: reviewInput, objetivo: reviewGoal },
      errorMessage: 'Erro ao revisar texto médico. Tente novamente.',
    });
    if (text) setReviewedData(text);
    setIsReviewing(false);
  };

  const handleQuickAlta = async () => {
    if (!altaResumo.trim() && !altaDiag.trim()) return;
    setIsGeneratingAlta(true);
    const text = await generate<string>({
      type: 'sumario-alta',
      formData: {
        nome: altaNome || 'Paciente',
        diagnosticoAlta: altaDiag,
        resumoInternacao: altaResumo,
        prescricaoAlta: altaPrescricao,
      },
      errorMessage: 'Erro ao gerar sumário de alta.',
    });
    if (text) setAltaResult(text);
    setIsGeneratingAlta(false);
  };

  const copy = async (text: string) => {
    await copyToClipboard(text);
    toast('Copiado para a área de transferência!', 'success');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Estúdio de Redação Médica & IA</h1>
          <p className="text-slate-500 mt-1">
            Utilitários clínicos avançados para estruturar rascunhos, revisar terminologia semiológica e gerar documentos.
          </p>
        </div>
        <Link to="/transcritor">
          <Button className="bg-teal-600 hover:bg-teal-700 text-white">
            <Camera className="w-4 h-4 mr-2" /> Abrir Transcritor de Exames <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Adaptador de Rascunhos */}
        <Card className="hover:border-indigo-200 transition-colors flex flex-col">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Type className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Adaptador de Rascunhos Clínicos</CardTitle>
                <p className="text-xs text-slate-500">
                  Transforma anotações rápidas e abreviadas em evolução estruturada.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 flex-1 flex flex-col space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Formato de Saída Desejado</Label>
              <select
                value={adaptStyle}
                onChange={(e) => setAdaptStyle(e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500"
              >
                <option value="Evolução SOAP (Subjetivo, Objetivo, Avaliação, Plano)">Evolução SOAP</option>
                <option value="Evolução Linear de Enfermaria">Evolução Linear de Enfermaria</option>
                <option value="Anamnese e Exame Físico Estruturados">Anamnese e Exame Físico Estruturados</option>
                <option value="Resposta de Parecer / Interconsulta Médica">Parecer / Interconsulta Médica</option>
                <option value="Resumo de Caso para Passagem de Plantão">Passagem de Plantão (SBAR)</option>
              </select>
            </div>

            {!adaptedData ? (
              <>
                <Textarea
                  placeholder="Ex: pct 45a fem dor abd qid ha 2 dias + febre 38.5 e nauseas. beg corada hidratada pa 130x80 fc 98 abd plano doloroso fid db+ murphy-. solicito tc abd e lab."
                  className="flex-1 min-h-[170px] resize-none font-mono text-sm"
                  value={rawData}
                  onChange={(e) => setRawData(e.target.value)}
                />
                <Button
                  onClick={handleAdapt}
                  disabled={isAdapting || !rawData.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white w-full"
                >
                  {isAdapting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Estruturando Texto...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" /> Adaptar e Estruturar Texto
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="flex-1 flex flex-col space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-indigo-700">{adaptStyle}</span>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => copy(adaptedData)}>
                      <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAdaptedData('');
                      }}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Voltar
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={adaptedData}
                  onChange={(e) => setAdaptedData(e.target.value)}
                  className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm flex-1 min-h-[210px] font-sans leading-relaxed"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Revisor e Aprimorador Médico */}
        <Card className="hover:border-teal-200 transition-colors flex flex-col">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Revisor Semiológico & Médico-Legal</CardTitle>
                <p className="text-xs text-slate-500">
                  Refina a redação clínica, expande siglas e melhora a precisão técnica.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 flex-1 flex flex-col space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-600">Objetivo da Revisão</Label>
              <select
                value={reviewGoal}
                onChange={(e) => setReviewGoal(e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500"
              >
                <option value="Aprimorar terminologia semiológica e clareza">
                  Aprimorar terminologia semiológica e clareza
                </option>
                <option value="Expandir todas as siglas e abreviações para redação formal">
                  Expandir siglas para redação formal completa
                </option>
                <option value="Tornar o texto mais enxuto, direto e conciso">
                  Tornar o texto mais enxuto e conciso
                </option>
                <option value="Reforçar segurança documental e médico-legal (justificativa de condutas e orientações)">
                  Reforçar segurança documental / médico-legal
                </option>
                <option value="Traduzir termos técnicos para linguagem clara de orientação ao paciente">
                  Traduzir para linguagem acessível ao paciente
                </option>
              </select>
            </div>

            {!reviewedData ? (
              <>
                <Textarea
                  placeholder="Cole aqui o texto da sua evolução, justificativa de AIH, laudo ou orientação para refinar..."
                  className="flex-1 min-h-[170px] resize-none text-sm"
                  value={reviewInput}
                  onChange={(e) => setReviewInput(e.target.value)}
                />
                <Button
                  onClick={handleReview}
                  disabled={isReviewing || !reviewInput.trim()}
                  className="bg-teal-600 hover:bg-teal-700 text-white w-full"
                >
                  {isReviewing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Revisando Texto...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 mr-2" /> Revisar e Aprimorar Redação
                    </>
                  )}
                </Button>
              </>
            ) : (
              <div className="flex-1 flex flex-col space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold text-teal-700">Texto Revisado</span>
                  <div className="flex gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => copy(reviewedData)}>
                      <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setReviewedData('')}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Voltar
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={reviewedData}
                  onChange={(e) => setReviewedData(e.target.value)}
                  className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm flex-1 min-h-[210px] font-sans leading-relaxed"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. Gerador Rápido de Sumário e Orientações de Alta */}
      <Card>
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Gerador Rápido de Sumário e Orientações de Alta</CardTitle>
              <p className="text-xs text-slate-500">
                Gere rapidamente o sumário de alta hospitalar e as orientações de sinais de alarme para entregar ao paciente.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Nome do Paciente</Label>
                  <Input
                    placeholder="Ex: Maria Aparecida"
                    value={altaNome}
                    onChange={(e) => setAltaNome(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Diagnóstico Principal</Label>
                  <Input
                    placeholder="Ex: Colecistite Aguda Calculosa (PO Colecistectomia VLP)"
                    value={altaDiag}
                    onChange={(e) => setAltaDiag(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Resumo da Internação / Procedimentos</Label>
                <Textarea
                  placeholder="Ex: Submetida a colecistectomia videolaparoscópica sem intercorrências em 21/10, boa evolução em PO1..."
                  className="min-h-[80px] text-sm"
                  value={altaResumo}
                  onChange={(e) => setAltaResumo(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Medicações para Casa / Cuidados</Label>
                <Textarea
                  placeholder="Ex: Dipirona 1g 6/6h se dor, Cetoprofeno 100mg 12/12h por 3 dias, retorno no ambulatório de cirurgia em 15 dias..."
                  className="min-h-[70px] text-sm"
                  value={altaPrescricao}
                  onChange={(e) => setAltaPrescricao(e.target.value)}
                />
              </div>
              <Button
                onClick={handleQuickAlta}
                disabled={isGeneratingAlta || (!altaResumo.trim() && !altaDiag.trim())}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isGeneratingAlta ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando Sumário de Alta...
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4 mr-2" /> Gerar Sumário de Alta
                  </>
                )}
              </Button>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex flex-col min-h-[280px]">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Documento de Alta Gerado
                </span>
                {altaResult && (
                  <Button variant="outline" size="sm" onClick={() => copy(altaResult)} className="bg-white h-7 text-xs">
                    <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar
                  </Button>
                )}
              </div>
              {altaResult ? (
                <Textarea
                  value={altaResult}
                  onChange={(e) => setAltaResult(e.target.value)}
                  className="flex-1 min-h-[240px] bg-white text-sm leading-relaxed font-sans"
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center">
                  <FileCheck className="w-10 h-10 mb-2 opacity-25" />
                  <p className="text-sm max-w-xs">
                    Preencha os dados ao lado para gerar o sumário técnico e as orientações de alta para o paciente.
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
