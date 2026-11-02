import { doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import {
  ALL_KNOWN_TYPES,
  MULTIMODAL_TYPES,
  buildPrompt,
  buildTranscritorPrompt,
  postProcessTranscritorOutput,
  buildFieldDetectionPrompt,
  buildAutoFieldDetectionPrompt,
  buildFormAutoFillPrompt,
} from '../../server/prompts';

export const SHARED_BUILTIN_KEY_STORAGE = 'evolutigas_global_builtin_gemini_key_v1';

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

  return '';
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

  if (provider === 'gemini') {
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
      return {
        ok: false,
        error: 'Não foi possível conectar com o Google Gemini. Verifique se a chave está correta.',
      };
    } catch (err: any) {
      return {
        ok: false,
        error:
          err?.message ||
          'Não foi possível conectar com o Google Gemini. Verifique sua conexão.',
      };
    }
  }

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
  } catch (directErr: any) {
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

  const finalizeText = (raw: string) =>
    type === 'transcritor-exames' ? postProcessTranscritorOutput(raw, outputFormat) : raw;

  // 1. Direct Client Execution when key is available for external non-Gemini providers
  if (provider === 'chatgpt' && userApiKey) {
    const text = await generateWithChatGptClient(
      userApiKey,
      userModel,
      promptText,
      sanitizedImages,
      isJsonResponse
    );
    return { text: finalizeText(text), provider: 'chatgpt' };
  }

  if (provider === 'claude' && userApiKey) {
    const text = await generateWithClaudeClient(
      userApiKey,
      userModel,
      promptText,
      sanitizedImages,
      isJsonResponse
    );
    return { text: finalizeText(text), provider: 'claude' };
  }

  // 2. Server-side execution for Gemini and Builtin AI via /api/generate-evolucao
  const sharedKey = getBuiltinGeminiApiKey();
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

  return { text: finalizeText(parsedBody.text), provider: parsedBody.provider || provider };
}
