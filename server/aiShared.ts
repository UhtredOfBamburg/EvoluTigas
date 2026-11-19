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

export interface LiveGeminiModelOption {
  value: string;
  label: string;
  description?: string;
  isAlias?: boolean;
}

export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';

export const FALLBACK_GEMINI_MODELS: LiveGeminiModelOption[] = [
  {
    value: 'gemini-flash-latest',
    label: 'Gemini Flash Latest (Sempre o mais atual — Recomendado)',
    isAlias: true,
  },
  {
    value: 'gemini-flash-lite-latest',
    label: 'Gemini Flash Lite Latest (Mais rápido e leve — Recomendado)',
    isAlias: true,
  },
  {
    value: 'gemini-4-hydrogen',
    label: 'Gemini 4 Hydrogen (Nova geração — Compatível com plano gratuito)',
  },
  {
    value: 'gemini-pro-latest',
    label: 'Gemini Pro Latest (Sempre o mais avançado — Pode exigir billing)',
    isAlias: true,
  },
];

const NON_CLINICAL_MODEL_REGEX =
  /(-tts|-image|image-preview|nano-banana|lyria|embedding|robotics|computer-use|deep-research|antigravity|-live|native-audio|bisheng|pro-vision)/i;

const DEPRECATED_MODEL_REGEX =
  /^gemini-(1\.0|1\.5|2\.0|3\.1-pro|3\.8-flash)/i;

export function normalizeGeminiModelId(preferredModel?: string): string {
  const pref = (preferredModel || '').trim();
  if (!pref) return DEFAULT_GEMINI_MODEL;

  const lower = pref.toLowerCase();
  if (
    lower === 'flash' ||
    lower === 'gemini-2.0-flash' ||
    lower === 'gemini-2.5-flash' ||
    lower === 'gemini-3.8-flash'
  ) {
    return 'gemini-flash-latest';
  }
  if (
    lower === 'flash-lite' ||
    lower === 'gemini-2.0-flash-lite' ||
    lower === 'gemini-2.5-flash-lite' ||
    lower === 'gemini-3.1-flash-lite'
  ) {
    return 'gemini-flash-lite-latest';
  }
  if (
    lower === 'pro' ||
    lower === 'gemini-2.5-pro' ||
    lower === 'gemini-3.1-pro' ||
    lower === 'argon'
  ) {
    return 'gemini-pro-latest';
  }
  return pref;
}

function parseGeminiVersionScore(id: string): number {
  if (id === 'gemini-flash-latest') return 10000;
  if (id === 'gemini-flash-lite-latest') return 9900;
  if (id === 'gemini-pro-latest') return 9800;

  const numMatch = id.match(/^gemini-(\d+(?:\.\d+)?)/i);
  const major = numMatch ? parseFloat(numMatch[1]) * 100 : 100;
  let bonus = 0;
  if (id.includes('hydrogen')) bonus += 60;
  if (id.includes('flash-lite') || id.includes('lite')) bonus += 50;
  else if (id.includes('flash')) bonus += 55;
  if (id.includes('neon')) bonus += 40;
  if (id.includes('carbon')) bonus += 35;
  if (id.includes('argon')) bonus += 30;
  if (id.includes('pro')) bonus += 25;
  if (id.includes('preview') || id.includes('exp')) bonus -= 20;
  if (id.endsWith('-latest')) bonus += 15;
  return major + bonus;
}

export function formatGeminiModelLabel(id: string, displayName?: string): string {
  if (id === 'gemini-flash-latest') {
    return 'Gemini Flash Latest (Sempre atualizado — Recomendado grátis)';
  }
  if (id === 'gemini-flash-lite-latest') {
    return 'Gemini Flash Lite Latest (Mais rápido e leve — Grátis)';
  }
  if (id === 'gemini-pro-latest') {
    return 'Gemini Pro Latest (Sempre o mais avançado — Pode exigir billing)';
  }

  const baseName =
    displayName && displayName.trim()
      ? displayName.trim()
      : id
          .split('-')
          .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
          .join(' ');

  if (id.includes('hydrogen') || id.includes('flash')) {
    return baseName.includes(id) ? baseName : `${baseName} (${id})`;
  }
  if (id.includes('pro') || id.includes('argon') || id.includes('carbon') || id.includes('neon')) {
    return `${baseName} (${id} — Pode exigir billing)`;
  }
  return `${baseName} (${id})`;
}

export function filterAndSortGeminiModels(rawModels: any[]): LiveGeminiModelOption[] {
  const seen = new Map<string, LiveGeminiModelOption>();

  for (const raw of rawModels || []) {
    if (!raw || typeof raw.name !== 'string') continue;
    const methods: string[] = Array.isArray(raw.supportedGenerationMethods)
      ? raw.supportedGenerationMethods
      : [];
    if (!methods.includes('generateContent')) continue;

    const id = raw.name.replace(/^models\//, '').trim();
    if (!id.startsWith('gemini-')) continue;
    if (NON_CLINICAL_MODEL_REGEX.test(id)) continue;
    if (DEPRECATED_MODEL_REGEX.test(id)) continue;
    if (/\b(?:exp|experimental)\b/i.test(id)) continue;

    const textMeta = `${raw.displayName || ''} ${raw.description || ''}`;
    if (/\b(deprecated|discontinued|shut down|retired)\b/i.test(textMeta)) continue;

    seen.set(id, {
      value: id,
      label: formatGeminiModelLabel(id, raw.displayName),
      description: typeof raw.description === 'string' ? raw.description : undefined,
      isAlias: id.endsWith('-latest'),
    });
  }

  // Ensure rolling aliases exist at the top even if omitted or custom-ordered
  for (const fallback of FALLBACK_GEMINI_MODELS) {
    if (!seen.has(fallback.value) && fallback.isAlias) {
      seen.set(fallback.value, fallback);
    }
  }

  return Array.from(seen.values()).sort((a, b) => {
    const scoreDiff = parseGeminiVersionScore(b.value) - parseGeminiVersionScore(a.value);
    if (scoreDiff !== 0) return scoreDiff;
    return a.value.localeCompare(b.value);
  });
}

export function resolveGeminiCandidateModels(
  preferredModel?: string,
  dynamicModels?: string[]
): string[] {
  const normalized = normalizeGeminiModelId(preferredModel);

  const isHealthyCacheValid =
    lastHealthyGeminiModel && Date.now() - lastHealthyGeminiTs < HEALTHY_CACHE_TTL_MS;

  const cleanedDynamic = (dynamicModels || [])
    .map((m) => (m || '').trim())
    .filter((m) => m && !NON_CLINICAL_MODEL_REGEX.test(m) && !DEPRECATED_MODEL_REGEX.test(m));

  const isHeavyTier = (m: string) =>
    /pro|argon|carbon|neon/i.test(m);
  const fastDynamic = cleanedDynamic.filter((m) => !isHeavyTier(m));
  const heavyDynamic = cleanedDynamic.filter((m) => isHeavyTier(m));

  const rawList = Array.from(
    new Set([
      normalized,
      ...(isHealthyCacheValid && lastHealthyGeminiModel ? [lastHealthyGeminiModel] : []),
      'gemini-flash-lite-latest',
      'gemini-flash-latest',
      ...fastDynamic,
      'gemini-4-hydrogen',
      ...heavyDynamic,
      'gemini-pro-latest',
    ])
  );

  const healthy = rawList.filter((m) => !isModelTemporarilyBlocked(m));
  const blocked = rawList.filter((m) => isModelTemporarilyBlocked(m));
  return [...healthy, ...blocked];
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

export async function fetchGeminiModelsFromGoogle(apiKey: string): Promise<LiveGeminiModelOption[]> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) return [...FALLBACK_GEMINI_MODELS];

  const response = await withTimeout(
    fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=100&key=${encodeURIComponent(cleanKey)}`),
    8000,
    'list-gemini-models'
  );

  if (!response.ok) {
    let errText = '';
    try {
      const errJson: any = await response.json();
      errText = errJson?.error?.message || '';
    } catch {
      errText = await response.text();
    }
    throw new Error(errText || `HTTP ${response.status} ao listar modelos Gemini.`);
  }

  const json: any = await response.json();
  const filtered = filterAndSortGeminiModels(Array.isArray(json?.models) ? json.models : []);
  return filtered.length > 0 ? filtered : [...FALLBACK_GEMINI_MODELS];
}
