import { useCallback, useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { useUser, getActiveAiConnectionsFromStorage } from '@/contexts/UserContext';
import { executeAiGeneration, ExecuteAiPayload } from '@/lib/aiClient';

export type AiGenerateType =
  | 'evolucao'
  | 'admissao'
  | 'sumario-alta'
  | 'ambulatorio-chat'
  | 'adaptador-dados'
  | 'revisor-medico'
  | 'transcritor-exames'
  | 'conhecer-paciente'
  | 'organizar-hda'
  | 'gerar-exame-fisico'
  | 'passagem-caso'
  | 'interpretar-condutas'
  | 'detectar-campos-pdf'
  | 'auto-detectar-campos-pdf'
  | 'preencher-formulario-ia';

interface InlineData {
  mimeType: string;
  data: string;
}

export interface GenerateOptions {
  type: AiGenerateType;
  formData?: unknown;
  inlineData?: InlineData;
  inlineDatas?: InlineData[];
  customPrompt?: string;
  outputFormat?: string;
  fieldLabels?: string[];
  alreadyFound?: string[];
  formFields?: Array<{ id: string; label: string; type: string }>;
  parseJson?: boolean;
  errorMessage?: string;
}

function parseAiResultText<T>(rawText: string, parseJson?: boolean): T {
  if (!parseJson) {
    return rawText as unknown as T;
  }
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (arrayMatch && (!objMatch || arrayMatch.index! < objMatch.index!)) {
      return JSON.parse(arrayMatch[0]) as T;
    }
    if (objMatch) {
      return JSON.parse(objMatch[0]) as T;
    }
    throw new Error('Formato JSON inválido na resposta da IA.');
  }
}

export function useAiGenerate() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { remainingToday, incrementDailyUsage, setIsAiModalOpen } = useUser();

  const generate = useCallback(
    async <T = string,>(options: GenerateOptions): Promise<T | null> => {
      const aiConn = getActiveAiConnectionsFromStorage();
      const activeProvider = aiConn.activeProvider || 'builtin';

      let aiProviderConfig: { provider: string; apiKey?: string; model?: string } = {
        provider: 'builtin',
        model: aiConn.builtinModel || 'gemini-3.8-flash',
      };

      if (activeProvider === 'claude') {
        if (!aiConn.claudeKey?.trim()) {
          toast('Conecte sua chave do Claude (Anthropic) para usar o Claude diretamente.', 'info');
          setIsAiModalOpen(true);
          return null;
        }
        aiProviderConfig = {
          provider: 'claude',
          apiKey: aiConn.claudeKey.trim(),
          model: aiConn.claudeModel || 'claude-opus-5-5',
        };
      } else if (activeProvider === 'chatgpt') {
        if (!aiConn.chatgptKey?.trim()) {
          toast('Conecte sua chave do ChatGPT (OpenAI) para usar o ChatGPT diretamente.', 'info');
          setIsAiModalOpen(true);
          return null;
        }
        aiProviderConfig = {
          provider: 'chatgpt',
          apiKey: aiConn.chatgptKey.trim(),
          model: aiConn.chatgptModel || 'gpt-5.6-sol',
        };
      } else if (activeProvider === 'gemini') {
        if (!aiConn.geminiKey?.trim()) {
          toast('Conecte sua chave do Google Gemini para uso ilimitado.', 'info');
          setIsAiModalOpen(true);
          return null;
        }
        aiProviderConfig = {
          provider: 'gemini',
          apiKey: aiConn.geminiKey.trim(),
          model: aiConn.geminiModel || 'gemini-4-argon',
        };
      } else {
        if (remainingToday <= 0) {
          toast(
            'Sua cota diária gratuita (20/dia) terminou hoje. Conecte seu Claude, ChatGPT ou Gemini para continuar sem limites!',
            'info'
          );
          setIsAiModalOpen(true);
          return null;
        }
      }

      setLoading(true);
      try {
        const payload: ExecuteAiPayload = {
          type: options.type,
          aiProviderConfig,
        };
        if (options.inlineData) payload.inlineData = options.inlineData;
        if (options.inlineDatas) payload.inlineDatas = options.inlineDatas;
        if (options.formData !== undefined) payload.formData = options.formData;
        if (options.customPrompt !== undefined) payload.customPrompt = options.customPrompt;
        if (options.outputFormat !== undefined) payload.outputFormat = options.outputFormat;
        if (options.fieldLabels !== undefined) payload.fieldLabels = options.fieldLabels;
        if (options.alreadyFound !== undefined) payload.alreadyFound = options.alreadyFound;
        if (options.formFields !== undefined) payload.formFields = options.formFields;

        const data = await executeAiGeneration(payload);

        if (!data || typeof data.text !== 'string' || !data.text.trim()) {
          throw new Error(
            'Não foi possível concluir a leitura da resposta. Verifique sua conexão e tente novamente.'
          );
        }

        if (activeProvider === 'builtin') {
          incrementDailyUsage();
        }

        try {
          return parseAiResultText<T>(data.text, options.parseJson);
        } catch (parseErr) {
          console.error('Failed to parse AI response as JSON', parseErr, data.text);
          toast('A IA retornou um formato inesperado. Tente novamente.', 'error');
          return null;
        }
      } catch (err: any) {
        console.error('useAiGenerate error:', err);
        const rawMsg = err && typeof err.message === 'string' ? err.message : '';

        if (rawMsg.includes('MISSING_AI_KEY') || rawMsg.includes('Chave de IA não configurada')) {
          toast(
            'Conecte uma chave de IA (Gemini gratuito, Claude ou ChatGPT) para ativar as funções de IA.',
            'info'
          );
          setIsAiModalOpen(true);
          return null;
        }

        const isBrowserFetchOrSyntaxErr =
          !rawMsg ||
          rawMsg.startsWith('Request failed with status') ||
          rawMsg.includes('expected pattern') ||
          rawMsg.includes('Load failed') ||
          rawMsg.includes('Failed to fetch') ||
          rawMsg.includes('NetworkError') ||
          rawMsg.includes('JSON');

        const userMessage = !isBrowserFetchOrSyntaxErr
          ? rawMsg
          : options.errorMessage ||
            'Falha de conexão ao processar os arquivos. Tente novamente ou envie em lotes menores.';
        toast(userMessage, 'error');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast, remainingToday, incrementDailyUsage, setIsAiModalOpen]
  );

  return { generate, loading };
}
