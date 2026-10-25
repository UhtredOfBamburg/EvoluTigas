import { GoogleGenAI } from '@google/genai';
import {
  ALL_KNOWN_TYPES,
  MULTIMODAL_TYPES,
  buildPrompt,
  buildTranscritorPrompt,
  buildFieldDetectionPrompt,
  buildAutoFieldDetectionPrompt,
  buildFormAutoFillPrompt,
} from '../../server/prompts';

const JSON_RESPONSE_TYPES = new Set([
  'detectar-campos-pdf',
  'auto-detectar-campos-pdf',
  'preencher-formulario-ia',
  'interpretar-condutas',
]);

function sanitizeInlineData(item: any) {
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

function resolveGeminiCandidateModels(preferredModel?: string): string[] {
  const pref = (preferredModel || '').trim();
  if (pref === 'gemini-4-argon' || pref === 'gemini-2.5-pro' || pref === 'argon') {
    return ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-flash-latest'];
  }
  if (pref === 'gemini-3.1-flash-lite' || pref === 'gemini-2.5-flash-lite') {
    return ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-flash-latest'];
  }
  if (pref === 'gemini-3.8-flash' || pref === 'gemini-2.5-flash' || !pref) {
    return ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];
  }
  return Array.from(new Set([pref, 'gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.0-flash']));
}

async function generateWithGeminiFallback(
  aiClient: GoogleGenAI,
  contents: any,
  isJsonResponse: boolean,
  preferredModel?: string
) {
  let lastError: any = null;
  const candidates = resolveGeminiCandidateModels(preferredModel);

  for (const modelName of candidates) {
    const baseConfig: Record<string, any> = {
      temperature: isJsonResponse ? 0.1 : 0.25,
    };
    if (isJsonResponse) {
      baseConfig.responseMimeType = 'application/json';
    }

    try {
      return await aiClient.models.generateContent({
        model: modelName,
        contents,
        config: baseConfig,
      });
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error('Não foi possível gerar resposta com o Gemini.');
}

async function generateWithChatGpt(
  apiKey: string,
  model: string,
  promptText: string,
  images: Array<{ mimeType: string; data: string }>,
  isJsonResponse: boolean
): Promise<string> {
  const pref = (model || '').trim();
  const candidateModels =
    !pref || pref === 'gpt-5.6-sol' || pref === 'gpt-5' || pref === 'gpt-4.5-preview'
      ? ['gpt-4o', 'gpt-4o-mini']
      : Array.from(new Set([pref, 'gpt-4o', 'gpt-4o-mini']));

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

async function generateWithClaude(
  apiKey: string,
  model: string,
  promptText: string,
  images: Array<{ mimeType: string; data: string }>,
  isJsonResponse: boolean
): Promise<string> {
  const pref = (model || '').trim();
  const candidateModels =
    !pref || pref === 'claude-opus-5-5' || pref === 'claude-sonnet-4-5'
      ? [
          'claude-sonnet-4-20250514',
          'claude-3-7-sonnet-latest',
          'claude-3-5-sonnet-latest',
          'claude-3-5-haiku-latest',
        ]
      : Array.from(
          new Set([
            pref,
            'claude-sonnet-4-20250514',
            'claude-3-7-sonnet-latest',
            'claude-3-5-sonnet-latest',
            'claude-3-5-haiku-latest',
          ])
        );

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

function jsonResponse(statusCode: number, data: Record<string, any>) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(data),
  };
}

export async function handler(event: any) {
  const pathStr = String(event.path || '');
  let body: any = {};
  if (event.body) {
    try {
      const raw = event.isBase64Encoded
        ? Buffer.from(event.body, 'base64').toString('utf-8')
        : event.body;
      body = JSON.parse(raw);
    } catch {
      body = {};
    }
  }

  // 1. /api/test-ai-provider
  if (pathStr.endsWith('/test-ai-provider')) {
    const { provider, apiKey: userKey, model } = body;
    const cleanKey = typeof userKey === 'string' ? userKey.trim() : '';
    if (!cleanKey) {
      return jsonResponse(400, { ok: false, error: 'Insira a chave de acesso para testar a conexão.' });
    }

    try {
      if (provider === 'chatgpt') {
        const reply = await generateWithChatGpt(
          cleanKey,
          model || 'gpt-4o',
          'Responda apenas com a palavra: CONECTADO',
          [],
          false
        );
        return jsonResponse(200, { ok: true, provider: 'chatgpt', sample: reply.trim().slice(0, 60) });
      }

      if (provider === 'claude') {
        const reply = await generateWithClaude(
          cleanKey,
          model || 'claude-sonnet-4-20250514',
          'Responda apenas com a palavra: CONECTADO',
          [],
          false
        );
        return jsonResponse(200, { ok: true, provider: 'claude', sample: reply.trim().slice(0, 60) });
      }

      if (provider === 'gemini') {
        const customGemini = new GoogleGenAI({ apiKey: cleanKey });
        const response = await generateWithGeminiFallback(
          customGemini,
          'Responda apenas com a palavra: CONECTADO',
          false,
          model || 'gemini-2.5-flash'
        );
        const text = response.text || 'CONECTADO';
        return jsonResponse(200, { ok: true, provider: 'gemini', sample: text.trim().slice(0, 60) });
      }

      return jsonResponse(400, { ok: false, error: 'Provedor de IA inválido.' });
    } catch (err: any) {
      return jsonResponse(400, {
        ok: false,
        error: err?.message || 'Não foi possível conectar com este provedor. Verifique sua chave.',
      });
    }
  }

  // 2. /api/google-doc-public
  if (pathStr.endsWith('/google-doc-public')) {
    try {
      const rawInput = String(body?.docIdOrUrl || '').trim();
      const match =
        rawInput.match(/\/document\/d\/([a-zA-Z0-9-_]+)/) ||
        rawInput.match(/[?&]id=([a-zA-Z0-9-_]+)/);
      const docId = match?.[1] || (/^[a-zA-Z0-9-_]{15,}$/.test(rawInput) ? rawInput : null);

      if (!docId) {
        return jsonResponse(400, {
          error: 'Link do Google Docs inválido. Cole o link completo (docs.google.com/document/d/...).',
        });
      }

      const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
      const response = await fetch(exportUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Evolutigas/1.0)',
        },
        redirect: 'follow',
      });

      const finalUrl = response.url || '';
      if (
        !response.ok ||
        finalUrl.includes('accounts.google.com') ||
        finalUrl.includes('ServiceLogin')
      ) {
        return jsonResponse(403, {
          error:
            'Este documento está privado. No Google Docs, clique em "Compartilhar" -> "Qualquer pessoa com o link" (Leitor) e tente novamente.',
        });
      }

      const rawText = await response.text();
      if (rawText.trim().startsWith('<!DOCTYPE html') || rawText.trim().startsWith('<html')) {
        return jsonResponse(403, {
          error:
            'Este documento está restrito. No Google Docs, clique em "Compartilhar" e mude o acesso geral para "Qualquer pessoa com o link".',
        });
      }

      let title = 'Documento do Paciente';
      const disposition = response.headers.get('content-disposition') || '';
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const asciiMatch = disposition.match(/filename="([^"]+)"/i);
      if (utf8Match?.[1]) {
        try {
          title = decodeURIComponent(utf8Match[1]).replace(/\.txt$/i, '');
        } catch {
          title = utf8Match[1].replace(/\.txt$/i, '');
        }
      } else if (asciiMatch?.[1]) {
        title = asciiMatch[1].replace(/\.txt$/i, '');
      }

      const cleanText = rawText
        .replace(/^\uFEFF/, '')
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      return jsonResponse(200, {
        documentId: docId,
        title,
        text: cleanText,
        url: `https://docs.google.com/document/d/${docId}/edit`,
      });
    } catch {
      return jsonResponse(500, {
        error: 'Erro ao acessar o link do Google Docs. Verifique se o link está correto.',
      });
    }
  }

  // 3. /api/generate-evolucao
  if (pathStr.endsWith('/generate-evolucao')) {
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
    } = body;

    if (typeof type !== 'string' || !ALL_KNOWN_TYPES.includes(type)) {
      return jsonResponse(400, {
        error: `Invalid or missing "type". Expected one of: ${ALL_KNOWN_TYPES.join(', ')}.`,
      });
    }

    const isMultimodal = (MULTIMODAL_TYPES as readonly string[]).includes(type);
    const isJsonResponse = JSON_RESPONSE_TYPES.has(type);

    let promptText = '';
    const sanitizedImages: Array<{ mimeType: string; data: string }> = [];

    if (isMultimodal) {
      if (type === 'detectar-campos-pdf') {
        promptText = buildFieldDetectionPrompt(
          fieldLabels,
          Array.isArray(alreadyFound) ? alreadyFound : []
        );
      } else if (type === 'auto-detectar-campos-pdf') {
        promptText = buildAutoFieldDetectionPrompt();
      } else if (type === 'preencher-formulario-ia') {
        promptText = buildFormAutoFillPrompt(formFields, customPrompt);
      } else {
        promptText = buildTranscritorPrompt(customPrompt, outputFormat);
      }

      if (inlineData) {
        const sanitized = sanitizeInlineData(inlineData);
        if (sanitized) sanitizedImages.push(sanitized);
      }
      if (Array.isArray(inlineDatas)) {
        inlineDatas.forEach((data: any) => {
          const sanitized = sanitizeInlineData(data);
          if (sanitized) sanitizedImages.push(sanitized);
        });
      }
    } else {
      promptText = buildPrompt(type, formData);
    }

    const provider = aiProviderConfig?.provider || 'builtin';
    const userApiKey = typeof aiProviderConfig?.apiKey === 'string' ? aiProviderConfig.apiKey.trim() : '';
    const userModel = typeof aiProviderConfig?.model === 'string' ? aiProviderConfig.model.trim() : '';

    try {
      if (provider === 'chatgpt' && userApiKey) {
        const resultText = await generateWithChatGpt(
          userApiKey,
          userModel || 'gpt-4o',
          promptText,
          sanitizedImages,
          isJsonResponse
        );
        return jsonResponse(200, { text: resultText, provider: 'chatgpt' });
      }

      if (provider === 'claude' && userApiKey) {
        const resultText = await generateWithClaude(
          userApiKey,
          userModel || 'claude-sonnet-4-20250514',
          promptText,
          sanitizedImages,
          isJsonResponse
        );
        return jsonResponse(200, { text: resultText, provider: 'claude' });
      }

      const envKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
      const activeKey = provider === 'gemini' && userApiKey ? userApiKey : userApiKey || envKey;

      if (!activeKey) {
        return jsonResponse(500, {
          error:
            'MISSING_AI_KEY: Conecte sua chave do Claude, ChatGPT ou Gemini no botão "Conectar IA", ou ative a Chave da Turma.',
        });
      }

      const activeGeminiClient = new GoogleGenAI({ apiKey: activeKey });
      const geminiContents =
        sanitizedImages.length > 0
          ? [
              {
                role: 'user',
                parts: [
                  ...sanitizedImages.map((img) => ({ inlineData: img })),
                  { text: promptText },
                ],
              },
            ]
          : promptText;

      const response = await generateWithGeminiFallback(
        activeGeminiClient,
        geminiContents,
        isJsonResponse,
        userModel || undefined
      );

      const resultText =
        response.text ||
        response.candidates?.[0]?.content?.parts
          ?.map((p) => (p as any).text)
          .filter(Boolean)
          .join('\n') ||
        '';
      return jsonResponse(200, {
        text: resultText,
        provider: provider === 'gemini' ? 'gemini' : 'builtin',
      });
    } catch (error: any) {
      const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
      return jsonResponse(status, {
        error: error?.message || 'Erro ao processar solicitação com a IA.',
      });
    }
  }

  return jsonResponse(404, { error: 'Rota da API não encontrada.' });
}
