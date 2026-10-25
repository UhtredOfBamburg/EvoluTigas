import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import {
  ALL_KNOWN_TYPES,
  MULTIMODAL_TYPES,
  buildPrompt,
  buildTranscritorPrompt,
  buildFieldDetectionPrompt,
  buildAutoFieldDetectionPrompt,
  buildFormAutoFillPrompt,
} from "./server/prompts";

const MODEL_CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-2.0-flash",
];

const JSON_RESPONSE_TYPES = new Set([
  "detectar-campos-pdf",
  "auto-detectar-campos-pdf",
  "preencher-formulario-ia",
  "interpretar-condutas",
]);

function sanitizeInlineData(item: any) {
  if (!item || typeof item !== "object") return null;
  let data = typeof item.data === "string" ? item.data : "";
  let detectedMime = item.mimeType && typeof item.mimeType === "string" ? item.mimeType.trim() : "";
  if (data.startsWith("data:")) {
    const match = data.match(/^data:([^;]+);base64,(.+)$/s);
    if (match) {
      if (!detectedMime) detectedMime = match[1];
      data = match[2];
    }
  } else if (data.includes(",")) {
    data = data.split(",")[1];
  }
  data = data.replace(/\s+/g, "");
  if (!data || data.length < 16) return null;

  let mimeType = detectedMime || "image/jpeg";
  if (mimeType === "image/heic" || mimeType === "image/heif" || mimeType === "application/octet-stream") {
    mimeType = "image/jpeg";
  }
  return { mimeType, data };
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
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

async function generateWithGeminiFallback(
  aiClient: GoogleGenAI,
  contents: any,
  isJsonResponse: boolean,
  preferredModel?: string,
  isCustomGeminiKey?: boolean
) {
  let lastError: any = null;
  const normalizedPreferred =
    preferredModel === "gemini-2.5-pro" || preferredModel === "argon" || preferredModel === "gemini-4-argon"
      ? "gemini-2.5-pro"
      : preferredModel === "gemini-2.5-flash" || preferredModel === "gemini-3.8-flash"
      ? "gemini-2.5-flash"
      : preferredModel === "gemini-3.1-flash-lite"
      ? "gemini-2.5-flash-lite"
      : preferredModel;

  let candidates: string[];
  if (normalizedPreferred) {
    candidates = [
      normalizedPreferred,
      ...MODEL_CANDIDATES.filter((m) => m !== normalizedPreferred),
    ];
  } else {
    candidates = [...MODEL_CANDIDATES];
  }

  for (const modelName of candidates) {
    const baseConfig: Record<string, any> = {
      temperature: isJsonResponse ? 0.1 : 0.25,
    };
    if (isJsonResponse) {
      baseConfig.responseMimeType = "application/json";
    }

    try {
      return await withTimeout(
        aiClient.models.generateContent({
          model: modelName,
          contents,
          config: baseConfig,
        }),
        28000,
        modelName
      );
    } catch (err: any) {
      lastError = err;
      const msg = String(err?.message || err || "");
      console.warn(`[AI] Model "${modelName}" failed (${msg.slice(0, 140)}).`);
    }
  }

  throw lastError || new Error("Não foi possível gerar resposta com o Gemini.");
}

async function generateWithChatGpt(
  apiKey: string,
  model: string,
  promptText: string,
  images: Array<{ mimeType: string; data: string }>,
  isJsonResponse: boolean
): Promise<string> {
  const requestedModel = model || "gpt-5.6-sol";
  const candidateModels = Array.from(
    new Set([requestedModel, "gpt-4o", "gpt-4o-mini"])
  );

  const contentParts: any[] = [];
  for (const img of images) {
    contentParts.push({
      type: "image_url",
      image_url: {
        url: `data:${img.mimeType};base64,${img.data}`,
      },
    });
  }
  contentParts.push({
    type: "text",
    text: isJsonResponse
      ? `${promptText}\n\nIMPORTANTE: Retorne EXCLUSIVAMENTE um JSON válido.`
      : promptText,
  });

  let lastErrorMsg = "";

  for (const candidate of candidateModels) {
    const isReasoningModel = candidate.startsWith("o1") || candidate.startsWith("o3");
    const body: Record<string, any> = {
      model: candidate,
      messages: [
        {
          role: "user",
          content: images.length > 0 ? contentParts : contentParts[0].text,
        },
      ],
      ...(isReasoningModel ? {} : { temperature: isJsonResponse ? 0.1 : 0.25 }),
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = await response.json();
      return data?.choices?.[0]?.message?.content || "";
    }

    let errText = "";
    let errCode = "";
    try {
      const errJson = await response.json();
      errText = errJson?.error?.message || "";
      errCode = errJson?.error?.code || "";
    } catch {
      errText = await response.text();
    }
    lastErrorMsg = errText;

    const isModelUnavailable =
      response.status === 404 ||
      errCode === "model_not_found" ||
      errText.toLowerCase().includes("model") ||
      errText.toLowerCase().includes("does not exist");

    if (!isModelUnavailable) {
      break;
    }
  }

  throw new Error(
    lastErrorMsg
      ? `Erro no ChatGPT (OpenAI): ${lastErrorMsg}`
      : "Erro na conexão com ChatGPT. Verifique sua chave nas configurações de IA."
  );
}

async function generateWithClaude(
  apiKey: string,
  model: string,
  promptText: string,
  images: Array<{ mimeType: string; data: string }>,
  isJsonResponse: boolean
): Promise<string> {
  const requestedModel = model || "claude-opus-5-5";
  const candidateModels = Array.from(
    new Set([
      requestedModel,
      "claude-3-7-sonnet-latest",
      "claude-3-5-sonnet-latest",
      "claude-3-5-haiku-latest",
    ])
  );

  const contentBlocks: any[] = [];
  for (const img of images) {
    const allowedMedia = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    const mediaType = allowedMedia.includes(img.mimeType) ? img.mimeType : "image/jpeg";
    contentBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: img.data,
      },
    });
  }

  contentBlocks.push({
    type: "text",
    text: isJsonResponse
      ? `${promptText}\n\nIMPORTANTE: Retorne EXCLUSIVAMENTE um JSON válido, sem markdown nem texto adicional.`
      : promptText,
  });

  let lastErrorMsg = "";

  for (const candidate of candidateModels) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.trim(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: candidate,
        max_tokens: 4096,
        temperature: isJsonResponse ? 0.1 : 0.25,
        messages: [
          {
            role: "user",
            content: contentBlocks,
          },
        ],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const blocks = Array.isArray(data?.content) ? data.content : [];
      return blocks
        .filter((b: any) => b.type === "text" && typeof b.text === "string")
        .map((b: any) => b.text)
        .join("\n");
    }

    let errText = "";
    let errType = "";
    try {
      const errJson = await response.json();
      errText = errJson?.error?.message || "";
      errType = errJson?.error?.type || "";
    } catch {
      errText = await response.text();
    }
    lastErrorMsg = errText;

    const isModelUnavailable =
      response.status === 404 ||
      errType === "not_found_error" ||
      errText.toLowerCase().includes("model");

    if (!isModelUnavailable) {
      break;
    }
  }

  throw new Error(
    lastErrorMsg
      ? `Erro no Claude (Anthropic): ${lastErrorMsg}`
      : "Erro na conexão com o Claude. Verifique sua chave nas configurações de IA."
  );
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
          false
        );
        return res.json({ ok: true, provider: "claude", sample: reply.trim().slice(0, 60) });
      }

      if (provider === "gemini") {
        const customGemini = new GoogleGenAI({ apiKey: cleanKey });
        const response = await generateWithGeminiFallback(
          customGemini,
          "Responda apenas com a palavra: CONECTADO",
          false,
          model || "gemini-4-argon",
          true
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
      alreadyFound,
      formFields,
      aiProviderConfig,
    } = req.body ?? {};

    if (typeof type !== "string" || !ALL_KNOWN_TYPES.includes(type)) {
      return res.status(400).json({
        error: `Invalid or missing "type". Expected one of: ${ALL_KNOWN_TYPES.join(", ")}.`,
      });
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

    const isJsonResponse = JSON_RESPONSE_TYPES.has(type);

    let promptText = "";
    const sanitizedImages: Array<{ mimeType: string; data: string }> = [];

    if (isMultimodal) {
      if (type === "detectar-campos-pdf") {
        promptText = buildFieldDetectionPrompt(fieldLabels, Array.isArray(alreadyFound) ? alreadyFound : []);
      } else if (type === "auto-detectar-campos-pdf") {
        promptText = buildAutoFieldDetectionPrompt();
      } else if (type === "preencher-formulario-ia") {
        promptText = buildFormAutoFillPrompt(formFields, customPrompt);
      } else {
        promptText = buildTranscritorPrompt(customPrompt, outputFormat);
      }

      if (inlineData) {
        const sanitized = sanitizeInlineData(inlineData);
        if (sanitized) sanitizedImages.push(sanitized);
      }
      if (Array.isArray(inlineDatas)) {
        inlineDatas.forEach((data) => {
          const sanitized = sanitizeInlineData(data);
          if (sanitized) sanitizedImages.push(sanitized);
        });
      }
    } else {
      promptText = buildPrompt(type, formData);
    }

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
        return res.json({ text: resultText, provider: "chatgpt" });
      }

      if (provider === "claude" && userApiKey) {
        const resultText = await generateWithClaude(
          userApiKey,
          userModel || "claude-opus-5-5",
          promptText,
          sanitizedImages,
          isJsonResponse
        );
        return res.json({ text: resultText, provider: "claude" });
      }

      const isCustomGemini = Boolean(provider === "gemini" && userApiKey);
      const activeGeminiClient = isCustomGemini
        ? new GoogleGenAI({ apiKey: userApiKey })
        : defaultAi;

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
        userModel || undefined,
        isCustomGemini
      );

      const resultText =
        response.text ||
        response.candidates?.[0]?.content?.parts
          ?.map((p) => (p as any).text)
          .filter(Boolean)
          .join("\n") ||
        "";
      return res.json({ text: resultText, provider: provider === "gemini" ? "gemini" : "builtin" });
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
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
