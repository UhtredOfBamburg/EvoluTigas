import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { MULTIMODAL_TYPES } from "./server/prompts";
import {
  prepareAiRequestContent,
  finalizeAiOutput,
  resolveGeminiCandidateModels,
  markModelTemporarilyBlocked,
  markModelHealthy,
  withTimeout,
  generateWithChatGpt,
  generateWithClaude,
} from "./server/aiShared";

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

  app.post("/api/test-ai-provider", async (req, res) => {
    const { provider, apiKey: userKey, model } = req.body ?? {};
    const cleanKey = typeof userKey === "string" ? userKey.trim() : "";

    if (!cleanKey) {
      return res.status(400).json({ ok: false, error: "Insira a chave de acesso para testar a conexão." });
    }

    try {
      if (provider === "chatgpt") {
        const reply = await generateWithChatGpt(
          cleanKey,
          model || "gpt-5.6-sol",
          "Responda apenas com a palavra: CONECTADO",
          [],
          false
        );
        return res.json({ ok: true, provider: "chatgpt", sample: reply.trim().slice(0, 60) });
      }

      if (provider === "claude") {
        const reply = await generateWithClaude(
          cleanKey,
          model || "claude-opus-5-5",
          "Responda apenas com a palavra: CONECTADO",
          [],
          false,
          false
        );
        return res.json({ ok: true, provider: "claude", sample: reply.trim().slice(0, 60) });
      }

      if (provider === "gemini") {
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
          model || "gemini-4-argon"
        );
        const text = response.text || "CONECTADO";
        return res.json({ ok: true, provider: "gemini", sample: text.trim().slice(0, 60) });
      }

      return res.status(400).json({ ok: false, error: "Provedor de IA inválido." });
    } catch (err: any) {
      return res.status(400).json({
        ok: false,
        error: err?.message || "Não foi possível conectar com este provedor. Verifique sua chave.",
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

    try {
      if (provider === "chatgpt" && userApiKey) {
        const resultText = await generateWithChatGpt(
          userApiKey,
          userModel || "gpt-5.6-sol",
          promptText,
          sanitizedImages,
          isJsonResponse
        );
        return res.json({ text: finalizeAiOutput(type, resultText, outputFormat), provider: "chatgpt" });
      }

      if (provider === "claude" && userApiKey) {
        const resultText = await generateWithClaude(
          userApiKey,
          userModel || "claude-opus-5-5",
          promptText,
          sanitizedImages,
          isJsonResponse,
          false
        );
        return res.json({ text: finalizeAiOutput(type, resultText, outputFormat), provider: "claude" });
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
          error: "Chave de IA não configurada. Conecte seu Claude, ChatGPT ou Gemini no menu lateral.",
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
        userModel || undefined
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
    try {
      const rawInput = String(req.body?.docIdOrUrl || "").trim();
      const match =
        rawInput.match(/\/document\/d\/([a-zA-Z0-9-_]+)/) ||
        rawInput.match(/[?&]id=([a-zA-Z0-9-_]+)/);
      const docId = match?.[1] || (/^[a-zA-Z0-9-_]{15,}$/.test(rawInput) ? rawInput : null);

      if (!docId) {
        return res.status(400).json({
          error: "Link do Google Docs inválido. Cole o link completo (docs.google.com/document/d/...).",
        });
      }

      const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
      const response = await fetch(exportUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Evolutigas/1.0)",
        },
        redirect: "follow",
      });

      const finalUrl = response.url || "";
      if (
        !response.ok ||
        finalUrl.includes("accounts.google.com") ||
        finalUrl.includes("ServiceLogin")
      ) {
        return res.status(403).json({
          error:
            'Este documento está privado. No Google Docs, clique em "Compartilhar" -> "Qualquer pessoa com o link" (Leitor) e tente novamente.',
        });
      }

      const rawText = await response.text();
      if (rawText.trim().startsWith("<!DOCTYPE html") || rawText.trim().startsWith("<html")) {
        return res.status(403).json({
          error:
            'Este documento está restrito. No Google Docs, clique em "Compartilhar" e mude o acesso geral para "Qualquer pessoa com o link".',
        });
      }

      // Extract filename/title from Content-Disposition header if present
      let title = "Documento do Paciente";
      const disposition = response.headers.get("content-disposition") || "";
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const asciiMatch = disposition.match(/filename="([^"]+)"/i);
      if (utf8Match?.[1]) {
        try {
          title = decodeURIComponent(utf8Match[1]).replace(/\.txt$/i, "");
        } catch {
          title = utf8Match[1].replace(/\.txt$/i, "");
        }
      } else if (asciiMatch?.[1]) {
        title = asciiMatch[1].replace(/\.txt$/i, "");
      }

      const cleanText = rawText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

      return res.json({
        documentId: docId,
        title,
        text: cleanText,
        url: `https://docs.google.com/document/d/${docId}/edit`,
      });
    } catch (err: any) {
      console.error("Error fetching public Google Doc:", err);
      return res.status(500).json({
        error: "Erro ao acessar o link do Google Docs. Verifique se o link está correto.",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    app.get("/@vite/client", (_req, res) => {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  if (typeof document === "undefined") return;
  let style = sheetsMap.get(id) || document.querySelector(\`style[data-vite-dev-id="\${id}"]\`);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    document.head.appendChild(style);
  } else {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style && style.parentNode) {
    style.parentNode.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    accept() {},
    dispose() {},
    prune() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
    data: {}
  };
}
export function injectQuery(url) {
  return url;
}
export class ErrorOverlay extends HTMLElement {
  close() {}
}
`);
    });
    app.use((req, res, next) => {
      if (
        req.path === "/" ||
        req.path === "/index.html" ||
        req.path.startsWith("/src/") ||
        req.path.startsWith("/node_modules/.vite/") ||
        req.path.startsWith("/@")
      ) {
        delete req.headers["if-none-match"];
        delete req.headers["if-modified-since"];
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        const origSetHeader = res.setHeader.bind(res);
        res.setHeader = (name: string, value: any) => {
          if (name.toLowerCase() === "cache-control") {
            return origSetHeader("Cache-Control", "no-store, no-cache, must-revalidate");
          }
          return origSetHeader(name, value);
        };
      }
      next();
    });
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    const depsOptimizer = (vite as any).environments?.client?.depsOptimizer;
    if (depsOptimizer?.init) {
      await depsOptimizer.init().catch(() => {});
    }
    if (depsOptimizer?.scanProcessing) {
      await depsOptimizer.scanProcessing.catch(() => {});
    }
    await vite.warmupRequest("/src/main.tsx").catch(() => {});
    await vite.warmupRequest("/src/App.tsx").catch(() => {});
    await vite.warmupRequest("/src/hooks/useToast.tsx").catch(() => {});
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
