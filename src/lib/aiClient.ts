import { GoogleGenAI } from '@google/genai';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import {
  SanitizedImage,
  prepareAiRequestContent,
  finalizeAiOutput,
  resolveGeminiCandidateModels,
  markModelTemporarilyBlocked,
  markModelHealthy,
  withTimeout,
  generateWithChatGpt,
  generateWithClaude,
} from '../../server/aiShared';

export const SHARED_BUILTIN_KEY_STORAGE = 'evolutigas_global_builtin_gemini_key_v1';

export type { SanitizedImage };
export { sanitizeInlineData } from '../../server/aiShared';

export function reportClientErrorToCloud(context: string, err: unknown, extra?: Record<string, any>) {
  try {
    const msg = err instanceof Error ? err.message : String(err || '');
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
    setDoc(
      doc(db, 'formTemplates', 'system_error_telemetry'),
      {
        lastUpdated: new Date().toISOString(),
        lastError: {
          timestamp: new Date().toISOString(),
          context,
          message: msg.slice(0, 600),
          userAgent: ua.slice(0, 200),
          ...(extra || {}),
        },
      },
      { merge: true }
    ).catch(() => {});
  } catch {
    // ignore telemetry errors
  }
}

export function getBuiltinGeminiApiKey(): string {
  try {
    if (typeof window !== 'undefined') {
      const sharedKey = window.localStorage.getItem(SHARED_BUILTIN_KEY_STORAGE);
      if (sharedKey && sharedKey.trim()) {
        return sharedKey.trim();
      }
    }
  } catch {
    // ignore storage errors
  }
  return '';
}

export async function generateWithGeminiClient(
  apiKey: string,
  promptText: string,
  images: SanitizedImage[],
  isJsonResponse: boolean,
  preferredModel?: string
): Promise<string> {
  const aiClient = new GoogleGenAI({ apiKey: apiKey.trim() });
  const candidates = resolveGeminiCandidateModels(preferredModel);

  const contents =
    images.length > 0
      ? [
          {
            role: 'user',
            parts: [...images.map((img) => ({ inlineData: img })), { text: promptText }],
          },
        ]
      : promptText;

  let firstError: any = null;

  for (const modelName of candidates) {
    const baseConfig: Record<string, any> = {
      temperature: isJsonResponse ? 0.1 : 0.25,
    };
    if (isJsonResponse) {
      baseConfig.responseMimeType = 'application/json';
    }

    try {
      const response = await withTimeout(
        aiClient.models.generateContent({
          model: modelName,
          contents,
          config: baseConfig,
        }),
        22000,
        modelName
      );

      const resultText =
        response.text ||
        response.candidates?.[0]?.content?.parts
          ?.map((p) => (p as any).text)
          .filter(Boolean)
          .join('\n') ||
        '';

      if (resultText.trim()) {
        markModelHealthy(modelName);
        return resultText;
      }
    } catch (err: any) {
      if (!firstError) firstError = err;
      markModelTemporarilyBlocked(modelName);
      const msg = String(err?.message || err || '');
      console.warn(`[AI Client] Gemini model "${modelName}" failed:`, msg);
      if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
        break;
      }
    }
  }

  reportClientErrorToCloud('generateWithGeminiClient', firstError, { preferredModel });
  throw firstError || new Error('Não foi possível gerar resposta com o Google Gemini.');
}

async function testViaBackend(
  provider: 'claude' | 'chatgpt' | 'gemini',
  apiKey: string,
  model?: string
): Promise<{ ok: boolean; sample?: string; error?: string } | null> {
  try {
    const res = await fetch('/api/test-ai-provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, apiKey, model }),
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    const data = await res.json();
    if (res.ok && data.ok) {
      return { ok: true, sample: data.sample };
    }
    if (data.error) {
      return { ok: false, error: data.error };
    }
  } catch {
    // ignore backend fallback network error
  }
  return null;
}

export async function testAiProviderDirect(
  provider: 'claude' | 'chatgpt' | 'gemini',
  apiKey: string,
  model?: string
): Promise<{ ok: boolean; sample?: string; error?: string }> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    return { ok: false, error: 'Insira a chave de acesso para testar a conexão.' };
  }

  try {
    if (provider === 'chatgpt') {
      const reply = await generateWithChatGpt(
        cleanKey,
        model,
        'Responda apenas com a palavra: CONECTADO',
        [],
        false
      );
      return { ok: true, sample: reply.trim().slice(0, 60) };
    }

    if (provider === 'claude') {
      const reply = await generateWithClaude(
        cleanKey,
        model,
        'Responda apenas com a palavra: CONECTADO',
        [],
        false,
        true
      );
      return { ok: true, sample: reply.trim().slice(0, 60) };
    }

    if (provider === 'gemini') {
      const reply = await generateWithGeminiClient(
        cleanKey,
        'Responda apenas com a palavra: CONECTADO',
        [],
        false,
        model
      );
      return { ok: true, sample: reply.trim().slice(0, 60) };
    }
  } catch (directErr: any) {
    const backendResult = await testViaBackend(provider, cleanKey, model);
    if (backendResult) return backendResult;

    return {
      ok: false,
      error:
        directErr?.message ||
        'Não foi possível conectar com este provedor. Verifique se a chave está correta.',
    };
  }

  return { ok: false, error: 'Provedor de IA inválido.' };
}

export interface ExecuteAiPayload {
  type: string;
  formData?: unknown;
  inlineData?: { mimeType: string; data: string };
  inlineDatas?: Array<{ mimeType: string; data: string }>;
  customPrompt?: string;
  outputFormat?: string;
  fieldLabels?: string[];
  alreadyFound?: string[];
  formFields?: Array<{ id: string; label: string; type: string }>;
  aiProviderConfig: {
    provider: string;
    apiKey?: string;
    model?: string;
  };
}

export async function executeAiGeneration(
  payload: ExecuteAiPayload
): Promise<{ text: string; provider: string }> {
  const { type, outputFormat, aiProviderConfig } = payload;
  const { promptText, sanitizedImages, isJsonResponse } = prepareAiRequestContent(payload);

  const provider = aiProviderConfig?.provider || 'builtin';
  const userApiKey = typeof aiProviderConfig?.apiKey === 'string' ? aiProviderConfig.apiKey.trim() : '';
  const userModel = typeof aiProviderConfig?.model === 'string' ? aiProviderConfig.model.trim() : '';

  // 1. Direct browser execution when user supplies a personal key (avoids 10s serverless timeout on Netlify)
  if (provider === 'chatgpt' && userApiKey) {
    const text = await generateWithChatGpt(userApiKey, userModel, promptText, sanitizedImages, isJsonResponse);
    return { text: finalizeAiOutput(type, text, outputFormat), provider: 'chatgpt' };
  }

  if (provider === 'claude' && userApiKey) {
    const text = await generateWithClaude(
      userApiKey,
      userModel,
      promptText,
      sanitizedImages,
      isJsonResponse,
      true
    );
    return { text: finalizeAiOutput(type, text, outputFormat), provider: 'claude' };
  }

  if (provider === 'gemini' && userApiKey) {
    try {
      const text = await generateWithGeminiClient(
        userApiKey,
        promptText,
        sanitizedImages,
        isJsonResponse,
        userModel
      );
      return { text: finalizeAiOutput(type, text, outputFormat), provider: 'gemini' };
    } catch (directErr: any) {
      const msg = String(directErr?.message || '');
      if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
        throw directErr;
      }
      console.warn('[AI Client] Direct Gemini call failed, trying backend fallback:', msg);
    }
  }

  // 2. Builtin provider with shared class key saved in Firestore/localStorage
  const sharedKey = getBuiltinGeminiApiKey();
  if (provider === 'builtin' && sharedKey) {
    try {
      const text = await generateWithGeminiClient(
        sharedKey,
        promptText,
        sanitizedImages,
        isJsonResponse,
        userModel
      );
      return { text: finalizeAiOutput(type, text, outputFormat), provider: 'builtin' };
    } catch (directErr: any) {
      console.warn('[AI Client] Builtin direct Gemini call failed, trying backend fallback:', directErr?.message);
    }
  }

  // 3. Backend fallback (/api/generate-evolucao for AI Studio server env key or restricted corporate networks)
  const effectivePayload: ExecuteAiPayload = {
    ...payload,
    aiProviderConfig: {
      ...payload.aiProviderConfig,
      provider,
      apiKey: userApiKey || (provider === 'builtin' && sharedKey ? sharedKey : undefined),
    },
  };

  const response = await fetch('/api/generate-evolucao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(effectivePayload),
  });

  const contentType = response.headers.get('content-type') || '';
  const rawResponseText = await response.text();

  if (
    contentType.includes('text/html') ||
    rawResponseText.trim().startsWith('<!DOCTYPE') ||
    rawResponseText.trim().startsWith('<html')
  ) {
    throw new Error(
      'MISSING_AI_KEY: Para usar a IA no site publicado, conecte sua chave gratuita do Google Gemini, Claude ou ChatGPT no botão "Conectar IA", ou ative a Chave da Turma.'
    );
  }

  let parsedBody: any = null;
  if (rawResponseText) {
    try {
      parsedBody = JSON.parse(rawResponseText);
    } catch {
      parsedBody = null;
    }
  }

  if (!response.ok) {
    const serverErrorMsg =
      parsedBody && typeof parsedBody.error === 'string' ? parsedBody.error : '';
    if (response.status === 413) {
      throw new Error(
        'O arquivo enviado é muito grande. Tente enviar arquivos menores ou em menor quantidade.'
      );
    }
    if (serverErrorMsg) {
      throw new Error(serverErrorMsg);
    }
    throw new Error(`Erro ao comunicar com o servidor de IA (status ${response.status}).`);
  }

  if (!parsedBody || typeof parsedBody.text !== 'string' || !parsedBody.text.trim()) {
    throw new Error(
      'Não foi possível concluir a leitura da resposta da IA. Verifique sua conexão e tente novamente.'
    );
  }

  return {
    text: finalizeAiOutput(type, parsedBody.text, outputFormat),
    provider: parsedBody.provider || provider,
  };
}
