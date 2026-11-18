import { GoogleGenAI } from '@google/genai';
import {
  prepareAiRequestContent,
  finalizeAiOutput,
  resolveGeminiCandidateModels,
  markModelTemporarilyBlocked,
  markModelHealthy,
  withTimeout,
  generateWithChatGpt,
  generateWithClaude,
} from '../../server/aiShared';

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
          model || 'gpt-5.6-sol',
          'Responda apenas com a palavra: CONECTADO',
          [],
          false
        );
        return jsonResponse(200, { ok: true, provider: 'chatgpt', sample: reply.trim().slice(0, 60) });
      }

      if (provider === 'claude') {
        const reply = await generateWithClaude(
          cleanKey,
          model || 'claude-opus-5-5',
          'Responda apenas com a palavra: CONECTADO',
          [],
          false,
          false
        );
        return jsonResponse(200, { ok: true, provider: 'claude', sample: reply.trim().slice(0, 60) });
      }

      if (provider === 'gemini') {
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
          model || 'gemini-3.8-flash'
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

    try {
      if (provider === 'chatgpt' && userApiKey) {
        const resultText = await generateWithChatGpt(
          userApiKey,
          userModel || 'gpt-5.6-sol',
          promptText,
          sanitizedImages,
          isJsonResponse
        );
        return jsonResponse(200, { text: finalizeAiOutput(type, resultText, outputFormat), provider: 'chatgpt' });
      }

      if (provider === 'claude' && userApiKey) {
        const resultText = await generateWithClaude(
          userApiKey,
          userModel || 'claude-opus-5-5',
          promptText,
          sanitizedImages,
          isJsonResponse,
          false
        );
        return jsonResponse(200, { text: finalizeAiOutput(type, resultText, outputFormat), provider: 'claude' });
      }

      const envKey = process.env.GEMINI_API_KEY || '';
      const activeKey = provider === 'gemini' && userApiKey ? userApiKey : envKey || userApiKey;

      if (!activeKey) {
        return jsonResponse(500, {
          error:
            'MISSING_AI_KEY: Conecte sua chave do Claude, ChatGPT ou Gemini no botão "Conectar IA", ou ative a Chave da Turma.',
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
