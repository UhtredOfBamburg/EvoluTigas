import {
  ALL_KNOWN_TYPES,
  MULTIMODAL_TYPES,
  buildPrompt,
  buildTranscritorPrompt,
  postProcessTranscritorOutput,
  buildFieldDetectionPrompt,
  buildAutoFieldDetectionPrompt,
  buildFormAutoFillPrompt,
} from './prompts';

export const JSON_RESPONSE_TYPES = new Set([
  'detectar-campos-pdf',
  'auto-detectar-campos-pdf',
  'preencher-formulario-ia',
  'interpretar-condutas',
]);

export interface SanitizedImage {
  mimeType: string;
  data: string;
}

const HEALTHY_CACHE_TTL_MS = 10 * 60 * 1000;
const BLOCKED_MODEL_TTL_MS = 15 * 60 * 1000;

let lastHealthyGeminiModel: string | null = null;
let lastHealthyGeminiTs = 0;
const blockedModelsMap = new Map<string, number>();

export function isModelTemporarilyBlocked(model: string): boolean {
  const ts = blockedModelsMap.get(model);
  if (!ts) return false;
  if (Date.now() - ts > BLOCKED_MODEL_TTL_MS) {
    blockedModelsMap.delete(model);
    return false;
  }
  return true;
}

export function markModelTemporarilyBlocked(model: string): void {
  blockedModelsMap.set(model, Date.now());
}

export function markModelHealthy(model: string): void {
  lastHealthyGeminiModel = model;
  lastHealthyGeminiTs = Date.now();
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout after ${ms}ms on ${label}`));
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

export function resolveGeminiCandidateModels(preferredModel?: string): string[] {
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

export function resolveChatGptCandidateModels(preferredModel?: string): string[] {
  const pref = (preferredModel || '').trim() || 'gpt-5.6-sol';
  return Array.from(new Set([pref, 'gpt-5.6-sol', 'gpt-5', 'o3', 'gpt-4o', 'gpt-4o-mini']));
}

export function resolveClaudeCandidateModels(preferredModel?: string): string[] {
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

export interface AiPromptBuildOptions {
  type: string;
  formData?: unknown;
  inlineData?: any;
  inlineDatas?: any[];
  customPrompt?: string;
  outputFormat?: string;
  fieldLabels?: string[];
  alreadyFound?: string[];
  formFields?: Array<{ id: string; label: string; type: string }>;
}

export function prepareAiRequestContent(opts: AiPromptBuildOptions): {
  promptText: string;
  sanitizedImages: SanitizedImage[];
  isJsonResponse: boolean;
} {
  if (typeof opts.type !== 'string' || !ALL_KNOWN_TYPES.includes(opts.type)) {
    throw new Error(`Invalid or missing "type". Expected one of: ${ALL_KNOWN_TYPES.join(', ')}.`);
  }

  const isMultimodal = (MULTIMODAL_TYPES as readonly string[]).includes(opts.type);
  const isJsonResponse = JSON_RESPONSE_TYPES.has(opts.type);

  let promptText = '';
  const sanitizedImages: SanitizedImage[] = [];

  if (isMultimodal) {
    if (opts.type === 'detectar-campos-pdf') {
      promptText = buildFieldDetectionPrompt(
        opts.fieldLabels || [],
        Array.isArray(opts.alreadyFound) ? opts.alreadyFound : []
      );
    } else if (opts.type === 'auto-detectar-campos-pdf') {
      promptText = buildAutoFieldDetectionPrompt();
    } else if (opts.type === 'preencher-formulario-ia') {
      promptText = buildFormAutoFillPrompt(opts.formFields || [], opts.customPrompt);
    } else {
      promptText = buildTranscritorPrompt(opts.customPrompt, opts.outputFormat);
    }

    if (opts.inlineData) {
      const sanitized = sanitizeInlineData(opts.inlineData);
      if (sanitized) sanitizedImages.push(sanitized);
    }
    if (Array.isArray(opts.inlineDatas)) {
      opts.inlineDatas.forEach((item) => {
        const sanitized = sanitizeInlineData(item);
        if (sanitized) sanitizedImages.push(sanitized);
      });
    }
  } else {
    promptText = buildPrompt(opts.type, opts.formData);
  }

  return { promptText, sanitizedImages, isJsonResponse };
}

export function finalizeAiOutput(type: string, rawText: string, outputFormat?: string): string {
  return type === 'transcritor-exames' ? postProcessTranscritorOutput(rawText, outputFormat) : rawText;
}

export async function generateWithChatGpt(
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

export async function generateWithClaude(
  apiKey: string,
  model: string | undefined,
  promptText: string,
  images: SanitizedImage[],
  isJsonResponse: boolean,
  isBrowser = false
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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey.trim(),
      'anthropic-version': '2023-06-01',
    };
    if (isBrowser) {
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
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
