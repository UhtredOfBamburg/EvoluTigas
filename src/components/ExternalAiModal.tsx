import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { copyToClipboard } from '@/lib/utils';
import { useToast } from '@/hooks/useToast';
import { testAiProviderDirect } from '@/lib/aiClient';

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
    case 'claude':
      return 'Claude (Anthropic)';
    case 'chatgpt':
      return 'ChatGPT (OpenAI)';
    case 'gemini':
      return 'Google Gemini';
    default:
      return 'IA Integrada (Grátis)';
  }
}

const BUILTIN_MODELS = [
  { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Ultra rápido — Recomendado)' },
  { value: 'gemini-4-argon', label: 'Gemini Argon (Máximo raciocínio clínico e complexidade)' },
  { value: 'gemini-flash-latest', label: 'Gemini Flash Latest' },
  { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (Mais leve)' },
];

const PROVIDER_META = {
  claude: {
    title: 'Conectar com Claude (Anthropic)',
    desc: 'Evoluções, ambulatório, formulários e exames gerados diretamente pelo Claude (incluindo Opus 5.5).',
    link: 'https://console.anthropic.com/settings/keys',
    linkText: 'Obter chave no console da Anthropic',
    placeholder: 'sk-ant-api03-...',
    models: [
      { value: 'claude-opus-5-5', label: 'Claude Opus 5.5 (Máxima inteligência e raciocínio clínico)' },
      { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (Avançado e veloz)' },
      { value: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet (Extended Thinking)' },
      { value: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
      { value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku (Ultra rápido)' },
    ],
  },
  chatgpt: {
    title: 'Conectar com ChatGPT (OpenAI)',
    desc: 'Evoluções, ambulatório, formulários e exames gerados diretamente pelo ChatGPT (incluindo 5.6 Sol).',
    link: 'https://platform.openai.com/api-keys',
    linkText: 'Obter chave na plataforma OpenAI',
    placeholder: 'sk-proj-...',
    models: [
      { value: 'gpt-5.6-sol', label: 'ChatGPT 5.6 Sol (Última geração — Máxima capacidade)' },
      { value: 'gpt-5', label: 'GPT-5 (Raciocínio clínico avançado)' },
      { value: 'o3', label: 'OpenAI o3 (Raciocínio profundo)' },
      { value: 'gpt-4.5-preview', label: 'GPT-4.5 Preview' },
      { value: 'gpt-4o', label: 'GPT-4o (Multimodal avançado)' },
      { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Rápido e econômico)' },
    ],
  },
  gemini: {
    title: 'Conectar com Google Gemini (Ilimitado)',
    desc: 'Use sua chave de API oficial do Google Gemini para utilizar o Gemini Argon e 3.8 Flash sem limite diário.',
    link: 'https://ai.google.dev/',
    linkText: 'Obter chave oficial da API Google Gemini',
    placeholder: 'AIzaSy...',
    models: [
      { value: 'gemini-4-argon', label: 'Gemini Argon (Máxima capacidade e raciocínio complexo)' },
      { value: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Alta velocidade de última geração)' },
      { value: 'gemini-flash-latest', label: 'Gemini Flash Latest' },
      { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite (Ultra rápido)' },
    ],
  },
};

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
  const [customModelMode, setCustomModelMode] = useState<Record<string, boolean>>({});
  const [testingProvider, setTestingProvider] = useState<AiChatProvider | null>(null);
  const [testError, setTestError] = useState<string>('');
  const [sharedKeyInput, setSharedKeyInput] = useState<string>('');
  const [showSharedKeyConfig, setShowSharedKeyConfig] = useState<boolean>(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [copiedWhatsappMsg, setCopiedWhatsappMsg] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>(() => getDefaultShareUrl());

  useEffect(() => {
    if (currentUser && isAiModalOpen) {
      const conn = { ...DEFAULT_AI_CONNECTIONS, ...(currentUser.aiConnections || {}) };
      setFormState(conn);
      setSharedKeyInput(sharedBuiltinKey || '');
      setShowSharedKeyConfig(!sharedBuiltinKey);
      setTestError('');
      setCustomModelMode({
        claude: Boolean(
          conn.claudeModel && !PROVIDER_META.claude.models.some((m) => m.value === conn.claudeModel)
        ),
        chatgpt: Boolean(
          conn.chatgptModel && !PROVIDER_META.chatgpt.models.some((m) => m.value === conn.chatgptModel)
        ),
        gemini: Boolean(
          conn.geminiModel && !PROVIDER_META.gemini.models.some((m) => m.value === conn.geminiModel)
        ),
      });
    }
  }, [currentUser, isAiModalOpen, sharedBuiltinKey]);

  const activeExternal =
    formState.activeProvider !== 'builtin' ? formState.activeProvider : null;

  const getKeyFor = (p: 'claude' | 'chatgpt' | 'gemini') =>
    p === 'claude' ? formState.claudeKey : p === 'chatgpt' ? formState.chatgptKey : formState.geminiKey;

  const getModelFor = (p: 'claude' | 'chatgpt' | 'gemini') =>
    p === 'claude' ? formState.claudeModel : p === 'chatgpt' ? formState.chatgptModel : formState.geminiModel;

  const setModelFor = (p: 'claude' | 'chatgpt' | 'gemini', val: string) => {
    if (p === 'claude') setFormState((prev) => ({ ...prev, claudeModel: val }));
    else if (p === 'chatgpt') setFormState((prev) => ({ ...prev, chatgptModel: val }));
    else setFormState((prev) => ({ ...prev, geminiModel: val }));
  };

  const isConnectedFor = (p: 'claude' | 'chatgpt' | 'gemini') =>
    p === 'claude' ? formState.claudeConnected : p === 'chatgpt' ? formState.chatgptConnected : formState.geminiConnected;

  const handleTestAndSaveSharedBuiltin = async () => {
    setTestError('');
    const clean = (sharedKeyInput || '').trim();
    if (!clean) {
      setTestError('Cole uma chave gratuita do Google AI Studio (AIzaSy...) para ativar a IA Integrada.');
      return;
    }

    setTestingProvider('builtin');
    try {
      const result = await testAiProviderDirect('gemini', clean, formState.builtinModel || 'gemini-3.8-flash');
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

  const handleTestAndConnect = async (provider: 'claude' | 'chatgpt' | 'gemini') => {
    setTestError('');
    const key = getKeyFor(provider);
    const model = getModelFor(provider)?.trim() || PROVIDER_META[provider].models[0].value;

    if (!key?.trim()) {
      setTestError(`Cole sua chave de API do ${getProviderLabel(provider)} para conectar.`);
      return;
    }

    setTestingProvider(provider);
    try {
      const data = await testAiProviderDirect(provider, key.trim(), model);
      if (!data.ok) {
        setTestError(data.error || `Não foi possível conectar ao ${getProviderLabel(provider)}.`);
        return;
      }

      const nextState: AiConnectionsState = {
        ...formState,
        activeProvider: provider,
        ...(provider === 'claude' ? { claudeConnected: true, claudeModel: model } : {}),
        ...(provider === 'chatgpt' ? { chatgptConnected: true, chatgptModel: model } : {}),
        ...(provider === 'gemini' ? { geminiConnected: true, geminiModel: model } : {}),
      };
      setFormState(nextState);
      await updateAiConnections(nextState);
      toast(`${getProviderLabel(provider)} (${model}) conectado e ativo!`, 'success');
      setIsAiModalOpen(false);
    } catch {
      setTestError('Erro de rede ao testar a conexão. Tente novamente.');
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSaveSelection = async () => {
    setTestError('');
    if (activeExternal && !getKeyFor(activeExternal)?.trim()) {
      setTestError(`Insira sua chave do ${getProviderLabel(activeExternal)} ou escolha a IA Integrada.`);
      return;
    }
    await updateAiConnections(formState);
    toast(`IA ativa: ${getProviderLabel(formState.activeProvider)}`, 'success');
    setIsAiModalOpen(false);
  };

  const whatsappInviteText = `Pessoal, liberei o *EvoluTigas* para a nossa turma usar no internato/ambulatório! 🩺📋\n\n🔗 *Link de acesso:* ${shareUrl}\n\n✅ *Como entrar:* Basta digitar seu *Nome* (e uma senha se quiser) para criar seu espaço 100% individual.\n✅ *O que tem lá:* Evolução de Enfermaria, Admissão, Sumário de Alta, Ambulatório Inteligente, Receitas/Atestados/AIH em PDF (preenche 2 vias automático), Transcritor de Exames com VR e Calculadoras Médicas.\n✅ *IA Gratuita + Conexão com Claude Opus 5.5, ChatGPT 5.6 Sol e Gemini Argon/3.8 Flash:* Já vem com cota diária grátis e opção de conectar sua própria IA!`;

  return (
    <>
      {isAiModalOpen && currentUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Bot className="w-5 h-5 text-teal-400" />
                <div>
                  <h3 className="font-bold text-base">Conectar IA (Claude, ChatGPT e Gemini)</h3>
                  <p className="text-xs text-slate-300">
                    Escolha qual IA e versão responde diretamente nas evoluções, ambulatório, formulários e exames
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setIsAiModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {([
                  { id: 'builtin', label: 'IA Integrada', sub: `Grátis (${remainingToday}/${dailyLimit})` },
                  { id: 'claude', label: 'Claude', sub: 'Opus 5.5 / Sonnet' },
                  { id: 'chatgpt', label: 'ChatGPT', sub: '5.6 Sol / GPT-5 / 4o' },
                  { id: 'gemini', label: 'Gemini', sub: 'Argon / 3.8 Flash' },
                ] as const).map((item) => {
                  const isSelected = formState.activeProvider === item.id;
                  const isConn = item.id !== 'builtin' && isConnectedFor(item.id);
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
                    Pronta para uso imediato. Cada colega recebe <strong>{dailyLimit} gerações gratuitas por dia</strong> e já pode escolher entre o <strong>Gemini 3.8 Flash</strong> e o <strong>Gemini Argon</strong> abaixo:
                  </p>
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-xs font-semibold text-teal-950">Versão do Modelo da IA Integrada</Label>
                    <select
                      value={formState.builtinModel || 'gemini-3.8-flash'}
                      onChange={(e) => setFormState({ ...formState, builtinModel: e.target.value })}
                      className="w-full h-9 rounded-md border border-teal-300 bg-white px-2.5 text-xs text-slate-800 font-medium"
                    >
                      {BUILTIN_MODELS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

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
                        href="https://aistudio.google.com/apikey"
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

              {activeExternal && (
                <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                        {PROVIDER_META[activeExternal].title}
                        {isConnectedFor(activeExternal) && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> Conectado
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-600 mt-0.5">{PROVIDER_META[activeExternal].desc}</p>
                    </div>
                    <a
                      href={PROVIDER_META[activeExternal].link}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 underline"
                    >
                      {PROVIDER_META[activeExternal].linkText} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5 text-teal-600" />
                        Chave de API ({getProviderLabel(activeExternal)})
                      </Label>
                      <Input
                        type="password"
                        placeholder={PROVIDER_META[activeExternal].placeholder}
                        value={getKeyFor(activeExternal) || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (activeExternal === 'claude') {
                            setFormState({ ...formState, claudeKey: val, claudeConnected: false });
                          } else if (activeExternal === 'chatgpt') {
                            setFormState({ ...formState, chatgptKey: val, chatgptConnected: false });
                          } else {
                            setFormState({ ...formState, geminiKey: val, geminiConnected: false });
                          }
                        }}
                        className="h-9 text-xs font-mono bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-slate-700">Versão da IA / Modelo</Label>
                        <button
                          type="button"
                          onClick={() => {
                            const nextCustom = !customModelMode[activeExternal];
                            setCustomModelMode((prev) => ({ ...prev, [activeExternal]: nextCustom }));
                            if (!nextCustom) {
                              setModelFor(activeExternal, PROVIDER_META[activeExternal].models[0].value);
                            }
                          }}
                          className="text-[11px] font-medium text-teal-700 hover:underline"
                        >
                          {customModelMode[activeExternal] ? 'Escolher da lista' : 'Digitar ID manual'}
                        </button>
                      </div>
                      {customModelMode[activeExternal] ? (
                        <Input
                          type="text"
                          placeholder="Ex: claude-opus-5-5, gpt-5.6-sol, gemini-4-argon..."
                          value={getModelFor(activeExternal) || ''}
                          onChange={(e) => setModelFor(activeExternal, e.target.value)}
                          className="h-9 text-xs font-mono bg-white"
                        />
                      ) : (
                        <select
                          value={getModelFor(activeExternal) || PROVIDER_META[activeExternal].models[0].value}
                          onChange={(e) => setModelFor(activeExternal, e.target.value)}
                          className="w-full h-9 rounded-md border border-slate-300 bg-white px-2.5 text-xs text-slate-800 font-medium"
                        >
                          {PROVIDER_META[activeExternal].models.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
                    <span className="text-[11px] text-slate-500">
                      Sua chave fica salva exclusivamente no navegador da sua conta individual.
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      disabled={testingProvider === activeExternal}
                      onClick={() => handleTestAndConnect(activeExternal)}
                      className="bg-teal-600 hover:bg-teal-700 text-white text-xs"
                    >
                      {testingProvider === activeExternal ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          Testando conexão...
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1.5" />
                          Testar e Conectar {getProviderLabel(activeExternal)}
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
