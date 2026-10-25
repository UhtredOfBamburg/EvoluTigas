import { GoogleGenAI } from '@google/genai';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import {
  ALL_KNOWN_TYPES,
  MULTIMODAL_TYPES,
  buildPrompt,
  buildTranscritorPrompt,
  buildFieldDetectionPrompt,
  buildAutoFieldDetectionPrompt,
  buildFormAutoFillPrompt,
} from '../../server/prompts';

export const SHARED_BUILTIN_KEY_STORAGE = 'evolutigas_global_builtin_gemini_key_v1';

let lastHealthyGeminiModel: string | null = null;
let lastHealthyGeminiTs = 0;
const HEALTHY_CACHE_TTL_MS = 10 * 60 * 1000;
const BLOCKED_MODEL_TTL_MS = 15 * 60 * 1000;
const blockedModelsMap = new Map<string, number>();

function isModelTemporarilyBlocked(model: string): boolean {
  const ts = blockedModelsMap.get(model);
  if (!ts) return false;
  if (Date.now() - ts > BLOCKED_MODEL_TTL_MS) {
    blockedModelsMap.delete(model);
    return false;
  }
  return true;
}

function markModelTemporarilyBlocked(model: string) {
  blockedModelsMap.set(model, Date.now());
}

function withModelTimeout<T>(promise: Promise<T>, ms: number, modelName: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout after ${ms}ms on ${modelName}`));
    }, ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

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

const JSON_RESPONSE_TYPES = new Set([
  'detectar-campos-pdf',
  'auto-detectar-campos-pdf',
  'preencher-formulario-ia',
  'interpretar-condutas',
]);

export interface SanitizedImage {
  mimeType: string;
  data: string;
}

export function sanitizeInlineData(item: any): SanitizedImage | null {
  if (!item || typeof item !== 'object') return null;
  let data = typeof item.data === 'string' ? item.data : '';
  let detectedMime = item.mimeType && typeof item.mimeType === 'string' ? item.mimeType.trim() : '';
  if (data.startsWith('data:')) {
    const match = data.match(/^data:([^;]+);base64,(.+)$/s);
    if (match) {
      if (!detectedMime) detectedMime = match[1];
      data = match[2];
    }
  } else if (data.includes(',')) {
    data = data.split(',')[1];
  }
  data = data.replace(/\s+/g, '');
  if (!data || data.length < 16) return null;

  let mimeType = detectedMime || 'image/jpeg';
  if (
    mimeType === 'image/heic' ||
    mimeType === 'image/heif' ||
    mimeType === 'application/octet-stream'
  ) {
    mimeType = 'image/jpeg';
  }
  return { mimeType, data };
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

  try {
    const viteKey = (import.meta as any)?.env?.VITE_GEMINI_API_KEY;
    if (typeof viteKey === 'string' && viteKey.trim()) {
      return viteKey.trim();
    }
  } catch {
    // ignore
  }

  try {
    const procKey = typeof process !== 'undefined' ? (process as any)?.env?.GEMINI_API_KEY : '';
    if (typeof procKey === 'string' && procKey.trim()) {
      return procKey.trim();
    }
  } catch {
    // ignore
  }

  return '';
}

function resolveGeminiCandidateModels(preferredModel?: string): string[] {
  const pref = (preferredModel || '').trim();
  const normalized =
    pref === 'gemini-2.5-pro' || pref === 'argon'
      ? 'gemini-4-argon'
      : pref === 'gemini-2.5-flash' || pref === 'gemini-2.0-flash' || !pref
      ? 'gemini-3.8-flash'
      : pref === 'gemini-2.5-flash-lite'
      ? 'gemini-3.1-flash-lite'
      : pref;

  const isHealthyCacheValid =
    lastHealthyGeminiModel && Date.now() - lastHealthyGeminiTs < HEALTHY_CACHE_TTL_MS;

  const rawList = Array.from(
    new Set([
      ...(isHealthyCacheValid && lastHealthyGeminiModel ? [lastHealthyGeminiModel] : []),
      normalized,
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-flash-lite-latest',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
      'gemini-4-argon',
    ])
  );

  const healthy = rawList.filter((m) => !isModelTemporarilyBlocked(m));
  const blocked = rawList.filter((m) => isModelTemporarilyBlocked(m));
  return [...healthy, ...blocked];
}

function resolveChatGptCandidateModels(preferredModel?: string): string[] {
  const pref = (preferredModel || '').trim() || 'gpt-5.6-sol';
  return Array.from(
    new Set([pref, 'gpt-5.6-sol', 'gpt-5', 'o3', 'gpt-4o', 'gpt-4o-mini'])
  );
}

function resolveClaudeCandidateModels(preferredModel?: string): string[] {
  const pref = (preferredModel || '').trim() || 'claude-opus-5-5';
  return Array.from(
    new Set([
      pref,
      'claude-opus-5-5',
      'claude-sonnet-4-5',
      'claude-3-7-sonnet-latest',
      'claude-3-5-sonnet-latest',
      'claude-3-5-haiku-latest',
    ])
  );
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
      const response = await withModelTimeout(
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
        lastHealthyGeminiModel = modelName;
        lastHealthyGeminiTs = Date.now();
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

export async function generateWithChatGptClient(
  apiKey: string,
  model: string | undefined,
  promptText: string,
  images: SanitizedImage[],
  isJsonResponse: boolean
): Promise<string> {
  const candidateModels = resolveChatGptCandidateModels(model);

  const contentParts: any[] = [];
  for (const img of images) {
    contentParts.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.mimeType};base64,${img.data}`,
      },
    });
  }
  contentParts.push({
    type: 'text',
    text: isJsonResponse
      ? `${promptText}\n\nIMPORTANTE: Retorne EXCLUSIVAMENTE um JSON válido.`
      : promptText,
  });

  let lastErrorMsg = '';

  for (const candidate of candidateModels) {
    const isReasoningModel = candidate.startsWith('o1') || candidate.startsWith('o3');
    const body: Record<string, any> = {
      model: candidate,
      messages: [
        {
          role: 'user',
          content: images.length > 0 ? contentParts : contentParts[0].text,
        },
      ],
      ...(isReasoningModel ? {} : { temperature: isJsonResponse ? 0.1 : 0.25 }),
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = await response.json();
      return data?.choices?.[0]?.message?.content || '';
    }

    let errText = '';
    let errCode = '';
    try {
      const errJson = await response.json();
      errText = errJson?.error?.message || '';
      errCode = errJson?.error?.code || '';
    } catch {
      errText = await response.text();
    }
    lastErrorMsg = errText;

    const isModelUnavailable =
      response.status === 404 ||
      errCode === 'model_not_found' ||
      errText.toLowerCase().includes('model') ||
      errText.toLowerCase().includes('does not exist');

    if (!isModelUnavailable) {
      break;
    }
  }

  throw new Error(
    lastErrorMsg
      ? `Erro no ChatGPT (OpenAI): ${lastErrorMsg}`
      : 'Erro na conexão com ChatGPT. Verifique sua chave nas configurações de IA.'
  );
}

export async function generateWithClaudeClient(
  apiKey: string,
  model: string | undefined,
  promptText: string,
  images: SanitizedImage[],
  isJsonResponse: boolean
): Promise<string> {
  const candidateModels = resolveClaudeCandidateModels(model);

  const contentBlocks: any[] = [];
  for (const img of images) {
    const allowedMedia = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const mediaType = allowedMedia.includes(img.mimeType) ? img.mimeType : 'image/jpeg';
    contentBlocks.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: img.data,
      },
    });
  }

  contentBlocks.push({
    type: 'text',
    text: isJsonResponse
      ? `${promptText}\n\nIMPORTANTE: Retorne EXCLUSIVAMENTE um JSON válido, sem markdown nem texto adicional.`
      : promptText,
  });

  let lastErrorMsg = '';

  for (const candidate of candidateModels) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: candidate,
        max_tokens: 4096,
        temperature: isJsonResponse ? 0.1 : 0.25,
        messages: [
          {
            role: 'user',
            content: contentBlocks,
          },
        ],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const blocks = Array.isArray(data?.content) ? data.content : [];
      return blocks
        .filter((b: any) => b.type === 'text' && typeof b.text === 'string')
        .map((b: any) => b.text)
        .join('\n');
    }

    let errText = '';
    let errType = '';
    try {
      const errJson = await response.json();
      errText = errJson?.error?.message || '';
      errType = errJson?.error?.type || '';
    } catch {
      errText = await response.text();
    }
    lastErrorMsg = errText;

    const isModelUnavailable =
      response.status === 404 ||
      errType === 'not_found_error' ||
      errText.toLowerCase().includes('model');

    if (!isModelUnavailable) {
      break;
    }
  }

  throw new Error(
    lastErrorMsg
      ? `Erro no Claude (Anthropic): ${lastErrorMsg}`
      : 'Erro na conexão com o Claude. Verifique sua chave nas configurações de IA.'
  );
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

  // First try direct browser connection (works on Netlify static, Vercel, local, etc.)
  try {
    if (provider === 'chatgpt') {
      const reply = await generateWithChatGptClient(
        cleanKey,
        model,
        'Responda apenas com a palavra: CONECTADO',
        [],
        false
      );
      return { ok: true, sample: reply.trim().slice(0, 60) };
    }

    if (provider === 'claude') {
      const reply = await generateWithClaudeClient(
        cleanKey,
        model,
        'Responda apenas com a palavra: CONECTADO',
        [],
        false
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
    // Fallback to backend route if available (e.g. if CORS blocked in a strict corporate network)
    try {
      const res = await fetch('/api/test-ai-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: cleanKey, model }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (res.ok && data.ok) {
          return { ok: true, sample: data.sample };
        }
        if (data.error) {
          return { ok: false, error: data.error };
        }
      }
    } catch {
      // Ignore fallback error and return direct error
    }

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
  const {
    type,
    formData,
    inlineData,
    inlineDatas,
    customPrompt,
    outputFormat,
    fieldLabels,
    alreadyFound,
    formFields,
    aiProviderConfig,
  } = payload;

  if (!ALL_KNOWN_TYPES.includes(type)) {
    throw new Error(`Tipo de geração inválido: ${type}`);
  }

  const isMultimodal = (MULTIMODAL_TYPES as readonly string[]).includes(type);
  const isJsonResponse = JSON_RESPONSE_TYPES.has(type);

  let promptText = '';
  const sanitizedImages: SanitizedImage[] = [];

  if (isMultimodal) {
    if (type === 'detectar-campos-pdf') {
      promptText = buildFieldDetectionPrompt(
        fieldLabels || [],
        Array.isArray(alreadyFound) ? alreadyFound : []
      );
    } else if (type === 'auto-detectar-campos-pdf') {
      promptText = buildAutoFieldDetectionPrompt();
    } else if (type === 'preencher-formulario-ia') {
      promptText = buildFormAutoFillPrompt(formFields || [], customPrompt);
    } else {
      promptText = buildTranscritorPrompt(customPrompt, outputFormat);
    }

    if (inlineData) {
      const sanitized = sanitizeInlineData(inlineData);
      if (sanitized) sanitizedImages.push(sanitized);
    }
    if (Array.isArray(inlineDatas)) {
      inlineDatas.forEach((item) => {
        const sanitized = sanitizeInlineData(item);
        if (sanitized) sanitizedImages.push(sanitized);
      });
    }
  } else {
    promptText = buildPrompt(type, formData);
  }

  const provider = aiProviderConfig?.provider || 'builtin';
  const userApiKey = typeof aiProviderConfig?.apiKey === 'string' ? aiProviderConfig.apiKey.trim() : '';
  const userModel = typeof aiProviderConfig?.model === 'string' ? aiProviderConfig.model.trim() : '';

  // 1. Direct Client Execution when key is available for external providers
  if (provider === 'chatgpt' && userApiKey) {
    const text = await generateWithChatGptClient(
      userApiKey,
      userModel,
      promptText,
      sanitizedImages,
      isJsonResponse
    );
    return { text, provider: 'chatgpt' };
  }

  if (provider === 'claude' && userApiKey) {
    const text = await generateWithClaudeClient(
      userApiKey,
      userModel,
      promptText,
      sanitizedImages,
      isJsonResponse
    );
    return { text, provider: 'claude' };
  }

  if (provider === 'gemini' && userApiKey) {
    const text = await generateWithGeminiClient(
      userApiKey,
      promptText,
      sanitizedImages,
      isJsonResponse,
      userModel
    );
    return { text, provider: 'gemini' };
  }

  // 2. Built-in provider: check if we have a shared/env Gemini key on the client
  const builtinKey = getBuiltinGeminiApiKey();
  if (builtinKey) {
    try {
      const text = await generateWithGeminiClient(
        builtinKey,
        promptText,
        sanitizedImages,
        isJsonResponse,
        userModel
      );
      return { text, provider: 'builtin' };
    } catch (clientErr) {
      console.warn('[AI Client] Builtin client key failed, trying server fallback:', clientErr);
    }
  }

  // 3. Fallback to backend /api/generate-evolucao (works in AI Studio container & Netlify Functions with server env var)
  const response = await fetch('/api/generate-evolucao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get('content-type') || '';
  const rawResponseText = await response.text();

  // If Netlify static redirect returned index.html instead of JSON API response:
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

  return { text: parsedBody.text, provider: parsedBody.provider || provider };
}
