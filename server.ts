import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { MULTIMODAL_TYPES } from "./server/prompts";
import { fetchPublicGoogleDoc } from "./server/googleDocsShared";
import { searchLiveCnes } from "./server/cnesShared";
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
} from "./server/aiShared";

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
      baseConfig.responseMimeType = "application/json";
    }

    try {
      const response = await withTimeout(
        aiClient.models.generateContent({
          model: modelName,
          contents,
          config: baseConfig,
        }),
        28000,
        modelName
      );
      markModelHealthy(modelName);
      return response;
    } catch (err: any) {
      lastError = err;
      markModelTemporarilyBlocked(modelName);
      const msg = String(err?.message || err || "");
      console.warn(`[AI] Model "${modelName}" failed (${msg.slice(0, 140)}).`);
      if (msg.includes("API_KEY_INVALID") || msg.includes("API key not valid")) {
        break;
      }
    }
  }

  throw lastError || new Error("Não foi possível gerar resposta com o Gemini.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  const apiKey = process.env.GEMINI_API_KEY;
  const defaultAi = apiKey
    ? new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      })
    : null;

  app.post("/api/ai-models", async (req, res) => {
    const userKey = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
    const activeKey = userKey || apiKey || "";
    if (!activeKey) {
      return res.json({ models: FALLBACK_GEMINI_MODELS, source: "fallback" });
    }
    try {
      const models = await fetchGeminiModelsFromGoogle(activeKey);
      return res.json({ models, source: "google" });
    } catch {
      return res.json({ models: FALLBACK_GEMINI_MODELS, source: "fallback" });
    }
  });

  app.post("/api/test-ai-provider", async (req, res) => {
    const { provider, apiKey: userKey, model } = req.body ?? {};
    const cleanKey = typeof userKey === "string" ? userKey.trim() : "";

    if (!cleanKey) {
      return res.status(400).json({ ok: false, error: "Insira a chave de acesso para testar a conexão." });
    }

    try {
      if (provider === "gemini" || provider === "builtin") {
        const customGemini = new GoogleGenAI({
          apiKey: cleanKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });
        const response = await generateWithGeminiFallback(
          customGemini,
          "Responda apenas com a palavra: CONECTADO",
          false,
          model || DEFAULT_GEMINI_MODEL
        );
        const text = response.text || "CONECTADO";
        return res.json({ ok: true, provider: "gemini", sample: text.trim().slice(0, 60) });
      }

      return res.status(400).json({ ok: false, error: "Apenas o Google Gemini está disponível." });
    } catch (err: any) {
      return res.status(400).json({
        ok: false,
        error: err?.message || "Não foi possível conectar com o Google Gemini. Verifique sua chave.",
      });
    }
  });

  app.post("/api/generate-evolucao", async (req, res) => {
    const {
      type,
      formData,
      inlineData,
      inlineDatas,
      customPrompt,
      outputFormat,
      fieldLabels,
      formFields,
      aiProviderConfig,
    } = req.body ?? {};

    let prepared;
    try {
      prepared = prepareAiRequestContent(req.body ?? {});
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || "Invalid request payload." });
    }

    const isMultimodal = (MULTIMODAL_TYPES as readonly string[]).includes(type);
    if (!isMultimodal && formData === undefined) {
      return res.status(400).json({ error: `"formData" is required for type "${type}".` });
    }
    if (isMultimodal && !inlineData && !inlineDatas && !customPrompt) {
      return res.status(400).json({ error: `"inlineData", "inlineDatas" or "customPrompt" is required for type "${type}".` });
    }
    if (type === "detectar-campos-pdf" && (!Array.isArray(fieldLabels) || fieldLabels.length === 0)) {
      return res.status(400).json({ error: `"fieldLabels" (non-empty array) is required for type "detectar-campos-pdf".` });
    }
    if (type === "preencher-formulario-ia" && (!Array.isArray(formFields) || formFields.length === 0)) {
      return res.status(400).json({ error: `"formFields" (non-empty array) is required for type "preencher-formulario-ia".` });
    }

    const { promptText, sanitizedImages, isJsonResponse } = prepared;
    const provider = aiProviderConfig?.provider || "builtin";
    const userApiKey = typeof aiProviderConfig?.apiKey === "string" ? aiProviderConfig.apiKey.trim() : "";
    const userModel = typeof aiProviderConfig?.model === "string" ? aiProviderConfig.model.trim() : "";
    const dynamicModels = Array.isArray(aiProviderConfig?.dynamicModels)
      ? aiProviderConfig.dynamicModels
      : undefined;

    try {
      if (provider === "chatgpt" || provider === "claude") {
        return res.status(400).json({
          error: "Apenas Google Gemini está disponível. Atualize a página e selecione Google Gemini ou IA Integrada.",
        });
      }

      const isCustomGemini = Boolean(provider === "gemini" && userApiKey);
      const activeGeminiClient = isCustomGemini
        ? new GoogleGenAI({
            apiKey: userApiKey,
            httpOptions: {
              headers: {
                "User-Agent": "aistudio-build",
              },
            },
          })
        : defaultAi ||
          (userApiKey
            ? new GoogleGenAI({
                apiKey: userApiKey,
                httpOptions: {
                  headers: {
                    "User-Agent": "aistudio-build",
                  },
                },
              })
            : null);

      if (!activeGeminiClient) {
        return res.status(500).json({
          error: "Chave do Google Gemini não configurada. Conecte sua chave do Gemini ou ative a cota gratuita no menu lateral.",
        });
      }

      const geminiContents =
        sanitizedImages.length > 0
          ? [
              {
                role: "user",
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
          .join("\n") ||
        "";
      return res.json({
        text: finalizeAiOutput(type, resultText, outputFormat),
        provider: provider === "gemini" ? "gemini" : "builtin",
      });
    } catch (error: any) {
      console.error(`Error generating text for type "${type}" with provider "${provider}":`, error);
      const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
      let userFriendlyError =
        error?.message || "Erro ao processar solicitação com a IA. Tente novamente em instantes.";
      if (userFriendlyError.includes("ETIMEDOUT") || userFriendlyError.includes("fetch failed")) {
        userFriendlyError =
          "Tempo limite de conexão esgotado ao comunicar com o modelo. Tente enviar menos páginas/imagens por vez.";
      }
      res.status(status).json({
        error: userFriendlyError,
      });
    }
  });

  // Direct Google Docs link reader (works for any account including @discente.ufg.br without OAuth 403)
  app.post("/api/google-doc-public", async (req, res) => {
    const result = await fetchPublicGoogleDoc(req.body?.docIdOrUrl);
    if ("error" in result) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json(result.data);
  });

  // Official DATASUS CNES live lookup proxy (by CNES code or IBGE municipality)
  app.post("/api/cnes-search", async (req, res) => {
    try {
      const { cnes, codigoMunicipio6, queryText } = req.body ?? {};
      const items = await searchLiveCnes({ cnes, codigoMunicipio6, queryText });
      return res.json({ items });
    } catch {
      return res.json({ items: [] });
    }
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
