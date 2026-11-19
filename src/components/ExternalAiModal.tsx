import React, { useState, useEffect, useCallback } from 'react';
import {
  useUser,
  AiChatProvider,
  AiConnectionsState,
  DEFAULT_AI_CONNECTIONS,
} from '@/contexts/UserContext';
import { Button, Textarea, Input, Label } from '@/components/ui';
import {
  Copy,
  Check,
  Sparkles,
  X,
  Bot,
  Share2,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  ExternalLink,
  KeyRound,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import {
  testAiProviderDirect,
  fetchLiveGeminiModels,
  getCachedLiveGeminiModels,
  LiveGeminiModelOption,
} from '@/lib/aiClient';
import { DEFAULT_GEMINI_MODEL } from '../../server/aiShared';

const GOOGLE_AI_STUDIO_API_KEY_URL = 'https://aistudio.google.com/apikey';

function getDefaultShareUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const origin = window.location.origin;
    if (origin.includes('ais-dev-')) {
      return origin.replace('ais-dev-', 'ais-pre-');
    }
    return origin;
  }
  return 'https://ais-pre-udbnqqvyacc4t5tlx4i7yz-168094059850.us-west2.run.app';
}

export function getProviderLabel(provider: AiChatProvider): string {
  switch (provider) {
    case 'gemini':
      return 'Google Gemini';
    default:
      return 'IA Integrada (Grátis)';
  }
}

export function GlobalModals() {
  const {
    currentUser,
    updateAiConnections,
    dailyLimit,
    remainingToday,
    isShareModalOpen,
    setIsShareModalOpen,
    isAiModalOpen,
    setIsAiModalOpen,
    sharedBuiltinKey,
    updateSharedBuiltinKey,
  } = useUser();
  const { toast } = useToast();

  const [formState, setFormState] = useState<AiConnectionsState>(DEFAULT_AI_CONNECTIONS);
  const [customModelMode, setCustomModelMode] = useState<{ builtin: boolean; gemini: boolean }>({
    builtin: false,
    gemini: false,
  });
  const [geminiModels, setGeminiModels] = useState<LiveGeminiModelOption[]>(
    () => getCachedLiveGeminiModels().models
  );
  const [modelsSource, setModelsSource] = useState<'google' | 'cache' | 'fallback'>(
    () => getCachedLiveGeminiModels().source
  );
  const [refreshingModels, setRefreshingModels] = useState(false);
  const [testingProvider, setTestingProvider] = useState<AiChatProvider | null>(null);
  const [testError, setTestError] = useState<string>('');
  const [sharedKeyInput, setSharedKeyInput] = useState<string>('');
  const [showSharedKeyConfig, setShowSharedKeyConfig] = useState<boolean>(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [copiedWhatsappMsg, setCopiedWhatsappMsg] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>(() => getDefaultShareUrl());

  const syncModelsList = useCallback(
    async (explicitKey?: string, force = false) => {
      setRefreshingModels(true);
      try {
        const keyToUse = (explicitKey || formState.geminiKey || sharedKeyInput || sharedBuiltinKey || '').trim();
        const res = await fetchLiveGeminiModels(keyToUse, force);
        setGeminiModels(res.models);
        setModelsSource(res.source);
        if (force && res.source === 'google') {
          toast(`Lista sincronizada com a Google (${res.models.length} modelos ativos).`, 'success');
        } else if (force && res.source !== 'google') {
          toast('Conecte ou cole uma chave do Google AI Studio para consultar novos modelos ao vivo.', 'info');
        }
      } finally {
        setRefreshingModels(false);
      }
    },
    [formState.geminiKey, sharedKeyInput, sharedBuiltinKey, toast]
  );

  useEffect(() => {
    if (currentUser && isAiModalOpen) {
      const conn = { ...DEFAULT_AI_CONNECTIONS, ...(currentUser.aiConnections || {}) };
      setFormState(conn);
      setSharedKeyInput(sharedBuiltinKey || '');
      setShowSharedKeyConfig(!sharedBuiltinKey);
      setTestError('');

      const cached = getCachedLiveGeminiModels();
      setGeminiModels(cached.models);
      setModelsSource(cached.source);
      setCustomModelMode({
        builtin: Boolean(conn.builtinModel && !cached.models.some((m) => m.value === conn.builtinModel)),
        gemini: Boolean(conn.geminiModel && !cached.models.some((m) => m.value === conn.geminiModel)),
      });

      const keyForSync = (conn.geminiKey || sharedBuiltinKey || '').trim();
      fetchLiveGeminiModels(keyForSync, false)
        .then((res) => {
          setGeminiModels(res.models);
          setModelsSource(res.source);
          setCustomModelMode({
            builtin: Boolean(conn.builtinModel && !res.models.some((m) => m.value === conn.builtinModel)),
            gemini: Boolean(conn.geminiModel && !res.models.some((m) => m.value === conn.geminiModel)),
          });
        })
        .catch(() => {});
    }
  }, [currentUser, isAiModalOpen, sharedBuiltinKey]);

  const handleTestAndSaveSharedBuiltin = async () => {
    setTestError('');
    const clean = (sharedKeyInput || '').trim();
    if (!clean) {
      setTestError('Cole uma chave gratuita do Google AI Studio (AIzaSy...) para ativar a IA Integrada.');
      return;
    }

    setTestingProvider('builtin');
    try {
      const result = await testAiProviderDirect('gemini', clean, formState.builtinModel || DEFAULT_GEMINI_MODEL);
      if (!result.ok) {
        setTestError(result.error || 'Chave inválida. Verifique se copiou a chave completa do Google AI Studio.');
        return;
      }

      await updateSharedBuiltinKey(clean);
      const nextState: AiConnectionsState = {
        ...formState,
        activeProvider: 'builtin',
      };
      setFormState(nextState);
      await updateAiConnections(nextState);
      setShowSharedKeyConfig(false);
      toast('IA Integrada (20 créditos grátis/dia) ativada para toda a turma!', 'success');
      setIsAiModalOpen(false);
    } catch {
      setTestError('Erro ao validar a chave. Verifique sua conexão e tente novamente.');
    } finally {
      setTestingProvider(null);
    }
  };

  const handleTestAndConnectGemini = async () => {
    setTestError('');
    const key = formState.geminiKey;
    const model = (formState.geminiModel || '').trim() || DEFAULT_GEMINI_MODEL;

    if (!key?.trim()) {
      setTestError('Cole sua chave de API do Google Gemini para conectar.');
      return;
    }

    setTestingProvider('gemini');
    try {
      const data = await testAiProviderDirect('gemini', key.trim(), model);
      if (!data.ok) {
        setTestError(data.error || 'Não foi possível conectar ao Google Gemini.');
        return;
      }

      const nextState: AiConnectionsState = {
        ...formState,
        activeProvider: 'gemini',
        geminiConnected: true,
        geminiModel: model,
      };
      setFormState(nextState);
      await updateAiConnections(nextState);
      toast(`Google Gemini (${model}) conectado e ativo!`, 'success');
      setIsAiModalOpen(false);
    } catch {
      setTestError('Erro de rede ao testar a conexão. Tente novamente.');
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSaveSelection = async () => {
    setTestError('');
    if (formState.activeProvider === 'gemini' && !formState.geminiKey?.trim()) {
      setTestError('Insira sua chave gratuita do Google AI Studio ou escolha a IA Integrada.');
      return;
    }
    await updateAiConnections(formState);
    toast(`IA ativa: ${getProviderLabel(formState.activeProvider)}`, 'success');
    setIsAiModalOpen(false);
  };

  const renderModelSelector = (target: 'builtin' | 'gemini') => {
    const selectedModel =
      target === 'builtin'
        ? formState.builtinModel || DEFAULT_GEMINI_MODEL
        : formState.geminiModel || DEFAULT_GEMINI_MODEL;
    const setSelectedModel = (val: string) =>
      setFormState((prev) =>
        target === 'builtin' ? { ...prev, builtinModel: val } : { ...prev, geminiModel: val }
      );
    const isCustom = customModelMode[target];
    const keyHint = target === 'gemini' ? formState.geminiKey : sharedKeyInput || sharedBuiltinKey;

    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Label className="text-xs font-semibold text-slate-700">Versão / Modelo Gemini</Label>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => syncModelsList(keyHint, true)}
              disabled={refreshingModels}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:underline disabled:opacity-50"
              title="Consultar modelos ativos diretamente na API da Google"
            >
              <RefreshCw className={`w-3 h-3 ${refreshingModels ? 'animate-spin' : ''}`} />
              Atualizar da Google
            </button>
            <button
              type="button"
              onClick={() => {
                const nextCustom = !isCustom;
                setCustomModelMode((prev) => ({ ...prev, [target]: nextCustom }));
                if (!nextCustom) {
                  setSelectedModel(geminiModels[0]?.value || DEFAULT_GEMINI_MODEL);
                }
              }}
              className="text-[11px] font-medium text-teal-700 hover:underline"
            >
              {isCustom ? 'Escolher da lista' : 'Digitar ID manual'}
            </button>
          </div>
        </div>
        {isCustom ? (
          <Input
            type="text"
            placeholder="Ex: gemini-flash-latest, gemini-4-hydrogen..."
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="h-9 text-xs font-mono bg-white"
          />
        ) : (
          <select
            value={
              geminiModels.some((m) => m.value === selectedModel)
                ? selectedModel
                : geminiModels[0]?.value || DEFAULT_GEMINI_MODEL
            }
            onChange={(e) => setSelectedModel(e.target.value)}
            className="w-full h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-800 font-medium"
          >
            {geminiModels.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        )}
        <p className="text-[10px] text-slate-500">
          {modelsSource === 'fallback'
            ? 'Usando ponteiros automáticos (-latest) + fallback inteligente caso algum modelo saia do ar.'
            : 'Lista sincronizada automaticamente com os modelos ativos da Google (ponteiros -latest nunca ficam desatualizados).'}
        </p>
      </div>
    );
  };

  const whatsappInviteText = `Pessoal, liberei o *EvoluTigas* para a nossa turma usar no internato/ambulatório! 🩺📋\n\n🔗 *Link de acesso:* ${shareUrl}\n\n✅ *Como entrar:* Basta digitar seu *Nome* (e uma senha se quiser) para criar seu espaço 100% individual.\n✅ *O que tem lá:* Evolução de Enfermaria, Admissão, Sumário de Alta, Ambulatório Inteligente, Receitas/Atestados/AIH em PDF (preenche 2 vias automático), Transcritor de Exames com VR e Calculadoras Médicas.\n✅ *IA Gratuita (Google Gemini):* Já vem com cota diária grátis e opção de conectar sua própria chave gratuita do Google AI Studio!`;

  return (
    <>
      {isAiModalOpen && currentUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Bot className="w-5 h-5 text-teal-400" />
                <div>
                  <h3 className="font-bold text-base">Configurar Google Gemini</h3>
                  <p className="text-xs text-slate-300">
                    Escolha a cota gratuita da turma ou conecte sua chave gratuita do Google AI Studio
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setIsAiModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {([
                  { id: 'builtin', label: 'IA Integrada (Cota da Turma)', sub: `Grátis (${remainingToday}/${dailyLimit} usos hoje)` },
                  { id: 'gemini', label: 'Meu Google Gemini', sub: 'Chave grátis individual (Google AI Studio)' },
                ] as const).map((item) => {
                  const isSelected = formState.activeProvider === item.id;
                  const isConn = item.id === 'gemini' && Boolean(formState.geminiKey?.trim()) && Boolean(formState.geminiConnected);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setFormState({ ...formState, activeProvider: item.id });
                        setTestError('');
                      }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-teal-600 bg-teal-50/70 ring-2 ring-teal-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Sparkles className="w-4 h-4 text-teal-600" />
                        {isSelected ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-600 text-white">ATIVO</span>
                        ) : isConn ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : null}
                      </div>
                      <div className="font-bold text-xs text-slate-900">{item.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{item.sub}</div>
                    </button>
                  );
                })}
              </div>

              {formState.activeProvider === 'builtin' && (
                <div className="p-5 rounded-xl bg-teal-50/60 border border-teal-200 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-teal-600" />
                      <h4 className="font-bold text-sm text-teal-950">IA Integrada do EvoluTigas (Gratuita)</h4>
                      {sharedBuiltinKey && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Ativa
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-teal-100 text-teal-800">
                      {remainingToday} de {dailyLimit} usos hoje
                    </span>
                  </div>
                  <p className="text-xs text-teal-900/80 leading-relaxed">
                    Pronta para uso imediato. Cada colega recebe <strong>{dailyLimit} gerações gratuitas por dia</strong> usando a chave compartilhada da turma com atualização automática dos modelos Google Gemini.
                  </p>

                  {renderModelSelector('builtin')}

                  <div className="pt-2 border-t border-teal-200/70 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setShowSharedKeyConfig((v) => !v)}
                        className="text-xs font-semibold text-teal-800 hover:text-teal-950 underline flex items-center gap-1"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-teal-700" />
                        {sharedBuiltinKey
                          ? 'Atualizar chave da cota gratuita da turma (20/dia)'
                          : 'Ativar chave gratuita da turma (20 usos/dia no Netlify)'}
                      </button>
                      <a
                        href={GOOGLE_AI_STUDIO_API_KEY_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 underline"
                      >
                        Gerar chave grátis no Google AI Studio <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    {showSharedKeyConfig && (
                      <div className="p-3 rounded-lg bg-white/90 border border-teal-200 space-y-2">
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Cole abaixo uma chave gratuita do Google AI Studio (<code>AIzaSy...</code>) para liberar os{' '}
                          <strong>{dailyLimit} créditos diários gratuitos</strong> automaticamente para a turma no Netlify:
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            type="password"
                            placeholder="AIzaSy..."
                            value={sharedKeyInput}
                            onChange={(e) => setSharedKeyInput(e.target.value)}
                            className="h-9 text-xs font-mono bg-white flex-1"
                          />
                          <Button
                            type="button"
                            size="sm"
                            disabled={testingProvider === 'builtin'}
                            onClick={handleTestAndSaveSharedBuiltin}
                            className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-9 shrink-0"
                          >
                            {testingProvider === 'builtin' ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                Testando...
                              </>
                            ) : (
                              <>
                                <Check className="w-3.5 h-3.5 mr-1.5" />
                                Testar e Ativar Cota Gratuita
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {formState.activeProvider === 'gemini' && (
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        Conectar sua Chave Grátis do Google Gemini
                        {formState.geminiConnected && formState.geminiKey?.trim() && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Conectado
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Tenha sua própria cota individual gratuita no Google AI Studio sem dividir os 20 usos/dia da turma.
                      </p>
                    </div>
                    <a
                      href={GOOGLE_AI_STUDIO_API_KEY_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 underline"
                    >
                      Gerar chave grátis no Google AI Studio <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="text-[11px] text-slate-600 bg-white/90 border border-slate-200/80 rounded-lg px-3 py-2.5 leading-relaxed space-y-1">
                    <p>
                      <strong>Como funciona na prática:</strong> acesse o{' '}
                      <a
                        href={GOOGLE_AI_STUDIO_API_KEY_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="text-teal-700 underline font-semibold"
                      >
                        Google AI Studio (aistudio.google.com/apikey)
                      </a>
                      , faça login com sua conta Google e clique em <em>Create API key</em> — leva 20 segundos e{' '}
                      <strong>não pede cartão de crédito</strong>.
                    </p>
                    <p>
                      O plano gratuito tem limite próprio de requisições/dia (ideal para seu uso individual) nos modelos{' '}
                      <strong>Flash / Flash Lite / Hydrogen</strong>. Modelos <strong>Pro / Argon</strong> em geral exigem conta com faturamento (billing) ativo no Google Cloud — se algum modelo sair do ar ou atingir cota, o EvoluTigas troca automaticamente para outro modelo ativo.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5 text-teal-600" />
                        Chave de API (Google AI Studio)
                      </Label>
                      <Input
                        type="password"
                        placeholder="AIzaSy..."
                        value={formState.geminiKey || ''}
                        onChange={(e) => {
                          setFormState({ ...formState, geminiKey: e.target.value, geminiConnected: false });
                        }}
                        className="h-9 text-xs font-mono bg-white"
                      />
                    </div>
                    {renderModelSelector('gemini')}
                  </div>

                  <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                    <span className="text-[11px] text-slate-500">
                      Sua chave fica salva na nuvem da sua conta individual (sincronizada em qualquer navegador ou dispositivo).
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      disabled={testingProvider === 'gemini'}
                      onClick={handleTestAndConnectGemini}
                      className="bg-teal-600 hover:bg-teal-700 text-white text-xs"
                    >
                      {testingProvider === 'gemini' ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Testando conexão...
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1.5" />
                          Testar e Conectar Google Gemini
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {testError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                  {testError}
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <Button variant="outline" onClick={() => setIsAiModalOpen(false)}>
                Fechar
              </Button>
              <Button onClick={handleSaveSelection} className="bg-teal-600 hover:bg-teal-700 text-white">
                Salvar IA Selecionada
              </Button>
            </div>
          </div>
        </div>
      )}

      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 bg-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5" />
                <h3 className="font-bold text-base">Compartilhar Site com os 15 Colegas da Turma</h3>
              </div>
              <button type="button" onClick={() => setIsShareModalOpen(false)} className="p-1 text-teal-100 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Link Público do Site (atualiza automaticamente ao publicar)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={shareUrl}
                    onChange={(e) => setShareUrl(e.target.value)}
                    className="h-10 text-xs font-mono bg-slate-50 text-slate-700"
                  />
                  <Button
                    type="button"
                    onClick={async () => {
                      await copyToClipboard(shareUrl);
                      setCopiedShareLink(true);
                      toast('Link público copiado!', 'success');
                      setTimeout(() => setCopiedShareLink(false), 2500);
                    }}
                    className="bg-teal-600 hover:bg-teal-700 text-white h-10 shrink-0"
                  >
                    {copiedShareLink ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                    {copiedShareLink ? 'Copiado' : 'Copiar Link'}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Convite Pronto para o Grupo do WhatsApp da Turma
                </Label>
                <Textarea readOnly value={whatsappInviteText} className="min-h-[140px] text-xs bg-slate-50 text-slate-700" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    await copyToClipboard(whatsappInviteText);
                    setCopiedWhatsappMsg(true);
                    toast('Mensagem copiada! Agora é só colar no grupo da turma.', 'success');
                    setTimeout(() => setCopiedWhatsappMsg(false), 2500);
                  }}
                  className="w-full border-teal-300 text-teal-800 hover:bg-teal-50 font-semibold text-xs h-10"
                >
                  <Copy className="w-4 h-4 mr-2 text-teal-600" />
                  {copiedWhatsappMsg ? 'Mensagem Copiada!' : 'Copiar Mensagem para o Grupo do WhatsApp'}
                </Button>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-slate-700 space-y-1.5">
                <div className="font-semibold text-emerald-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  100% Gratuito para Você e para os 15 Colegas (Sem Cartão / Sem Faturamento):
                </div>
                <p>• <strong>Zero custo de hospedagem:</strong> Usando o link acima, você não precisa ativar faturamento nem cadastrar cartão.</p>
                <p>• <strong>IA Gratuita inclusa:</strong> Cada colega tem <strong>{dailyLimit} gerações gratuitas por dia</strong> na IA integrada e também pode gerar uma chave gratuita própria do Google Gemini (sem cartão) se quiser uso ilimitado.</p>
                <p>• <strong>Privacidade total:</strong> Cada colega entra apenas com o <strong>Nome</strong> e tem seus pacientes e documentos <strong>100% separados</strong>.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
