import { GoogleGenAI } from '@google/genai';
import { fetchPublicGoogleDoc } from '../../server/googleDocsShared';
import {
  prepareAiRequestContent,
  finalizeAiOutput,
  resolveGeminiCandidateModels,
  markModelTemporarilyBlocked,
  markModelHealthy,
  withTimeout,
  fetchGeminiModelsFromGoogle,
  DEFAULT_GEMINI_MODEL,
  FALLBACK_GEMINI_MODELS,
} from '../../server/aiShared';

async function generateWithGeminiFallback(
  aiClient: GoogleGenAI,
  contents: any,
  isJsonResponse: boolean,
  preferredModel?: string,
  dynamicModels?: string[]
) {
  let lastError: any = null;
  const candidates = resolveGeminiCandidateModels(preferredModel, dynamicModels);

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
        8500,
        modelName
      );
      markModelHealthy(modelName);
      return response;
    } catch (err: any) {
      lastError = err;
      markModelTemporarilyBlocked(modelName);
      const msg = String(err?.message || err || '');
      if (msg.includes('API_KEY_INVALID') || msg.includes('API key not valid')) {
        break;
      }
    }
  }

  throw lastError || new Error('Não foi possível gerar resposta com o Gemini.');
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

  // 0. /api/ai-models
  if (pathStr.endsWith('/ai-models')) {
    const userKey = typeof body?.apiKey === 'string' ? body.apiKey.trim() : '';
    const activeKey = userKey || process.env.GEMINI_API_KEY || '';
    if (!activeKey) {
      return jsonResponse(200, { models: FALLBACK_GEMINI_MODELS, source: 'fallback' });
    }
    try {
      const models = await fetchGeminiModelsFromGoogle(activeKey);
      return jsonResponse(200, { models, source: 'google' });
    } catch {
      return jsonResponse(200, { models: FALLBACK_GEMINI_MODELS, source: 'fallback' });
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
      if (provider === 'gemini' || provider === 'builtin') {
        const customGemini = new GoogleGenAI({
          apiKey: cleanKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });
        const response = await generateWithGeminiFallback(
          customGemini,
          'Responda apenas com a palavra: CONECTADO',
          false,
          model || DEFAULT_GEMINI_MODEL
        );
        const text = response.text || 'CONECTADO';
        return jsonResponse(200, { ok: true, provider: 'gemini', sample: text.trim().slice(0, 60) });
      }

      return jsonResponse(400, { ok: false, error: 'Apenas o Google Gemini está disponível.' });
    } catch (err: any) {
      return jsonResponse(400, {
        ok: false,
        error: err?.message || 'Não foi possível conectar com o Google Gemini. Verifique sua chave.',
      });
    }
  }

  // 2. /api/google-doc-public
  if (pathStr.endsWith('/google-doc-public')) {
    const result = await fetchPublicGoogleDoc(body?.docIdOrUrl);
    if ('error' in result) {
      return jsonResponse(result.status, { error: result.error });
    }
    return jsonResponse(200, result.data);
  }

  // 3. /api/generate-evolucao
  if (pathStr.endsWith('/generate-evolucao')) {
    const { type, outputFormat, aiProviderConfig } = body;

    let prepared;
    try {
      prepared = prepareAiRequestContent(body);
    } catch (err: any) {
      return jsonResponse(400, { error: err?.message || 'Requisição inválida.' });
    }

    const { promptText, sanitizedImages, isJsonResponse } = prepared;
    const provider = aiProviderConfig?.provider || 'builtin';
    const userApiKey = typeof aiProviderConfig?.apiKey === 'string' ? aiProviderConfig.apiKey.trim() : '';
    const userModel = typeof aiProviderConfig?.model === 'string' ? aiProviderConfig.model.trim() : '';
    const dynamicModels = Array.isArray(aiProviderConfig?.dynamicModels)
      ? aiProviderConfig.dynamicModels
      : undefined;

    try {
      if (provider === 'chatgpt' || provider === 'claude') {
        return jsonResponse(400, {
          error:
            'Apenas Google Gemini está disponível. Atualize a página e selecione Google Gemini ou IA Integrada.',
        });
      }

      const envKey = process.env.GEMINI_API_KEY || '';
      const activeKey = provider === 'gemini' && userApiKey ? userApiKey : envKey || userApiKey;

      if (!activeKey) {
        return jsonResponse(500, {
          error:
            'MISSING_AI_KEY: Conecte sua chave do Google Gemini no botão "Conectar IA", ou ative a Chave da Turma.',
        });
      }

      const activeGeminiClient = new GoogleGenAI({
        apiKey: activeKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
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
        userModel || undefined,
        dynamicModels
      );

      const resultText =
        response.text ||
        response.candidates?.[0]?.content?.parts
          ?.map((p) => (p as any).text)
          .filter(Boolean)
          .join('\n') ||
        '';
      return jsonResponse(200, {
        text: finalizeAiOutput(type, resultText, outputFormat),
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
