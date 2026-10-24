// Polyfills for Safari (macOS) & iOS WebKit compatibility with pdfjs-dist v6
if (typeof Promise !== 'undefined' && typeof (Promise as any).withResolvers !== 'function') {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

if (typeof URL !== 'undefined' && typeof (URL as any).parse !== 'function') {
  (URL as any).parse = function (url: string, base?: string) {
    try {
      return new URL(url, base);
    } catch {
      return null;
    }
  };
}

if (typeof Map !== 'undefined' && typeof (Map.prototype as any).getOrInsertComputed !== 'function') {
  (Map.prototype as any).getOrInsertComputed = function (key: any, callbackfn: (key: any) => any) {
    if (this.has(key)) return this.get(key);
    const val = callbackfn(key);
    this.set(key, val);
    return val;
  };
}

// @ts-ignore - Use legacy build for broad Safari / iOS WebKit support
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
// @ts-ignore - Populate globalThis.pdfjsWorker so Safari/iOS never fails on cross-origin/module Worker blocking
import * as pdfjsWorkerModule from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';

if (typeof globalThis !== 'undefined' && !(globalThis as any).pdfjsWorker) {
  (globalThis as any).pdfjsWorker = pdfjsWorkerModule;
}
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export { pdfjsLib };

/**
 * Detects iOS (iPhone, iPad, iPod) or iPadOS (MacIntel with touch points)
 */
export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

/**
 * Detects Safari browser (macOS or iOS)
 */
export function isSafariBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Android/i.test(ua);
}

export interface RenderedPage {
  dataUrl: string;
  widthPx: number;
  heightPx: number;
  /** Original page size in PDF points (1/72 inch) — needed for pdf-lib coordinate math later. */
  widthPts: number;
  heightPts: number;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64.includes(',') ? base64.split(',')[1] : base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Opens a PDF document from Uint8Array or base64 with Safari/iOS safe options
 * (disables OffscreenCanvas and eval in WebKit so rendering never blanks out).
 */
export function openPdfDocumentBytes(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes);
  return pdfjsLib.getDocument({
    data: copy,
    isOffscreenCanvasSupported: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
}

export async function loadPdfDocument(pdfBase64: string) {
  const bytes = base64ToUint8Array(pdfBase64);
  const loadingTask = openPdfDocumentBytes(bytes);
  const doc = await loadingTask.promise;
  return { doc, loadingTask };
}

export async function getPdfPageCount(pdfBase64: string): Promise<number> {
  const { doc, loadingTask } = await loadPdfDocument(pdfBase64);
  const count = doc.numPages;
  await loadingTask.destroy();
  return count;
}

/**
 * Computes a safe scale so that canvas dimensions never exceed iOS WebKit's strict canvas memory limits.
 */
export function getSafeCanvasScale(unscaledWidth: number, unscaledHeight: number, requestedScale: number): number {
  const maxDim = isIOSDevice() ? 2048 : 3200;
  const maxAllowedScale = Math.min(
    requestedScale,
    maxDim / Math.max(1, unscaledWidth),
    maxDim / Math.max(1, unscaledHeight)
  );
  return Math.max(0.75, maxAllowedScale);
}

async function renderLoadedPage(doc: any, pageNumber: number, scale: number): Promise<RenderedPage> {
  const page = await doc.getPage(pageNumber);
  const unscaledViewport = page.getViewport({ scale: 1 });
  const safeScale = getSafeCanvasScale(unscaledViewport.width, unscaledViewport.height, scale);
  const viewport = page.getViewport({ scale: safeScale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

  // Release iOS WebKit canvas memory immediately after extracting dataURL
  canvas.width = 0;
  canvas.height = 0;

  return {
    dataUrl,
    widthPx: viewport.width,
    heightPx: viewport.height,
    widthPts: unscaledViewport.width,
    heightPts: unscaledViewport.height,
  };
}

/**
 * Renders a single PDF page (1-indexed, matching pdfjs convention) to a compressed JPEG data URL.
 */
export async function renderPdfPage(pdfBase64: string, pageNumber: number, scale = 1.35): Promise<RenderedPage> {
  const { doc, loadingTask } = await loadPdfDocument(pdfBase64);
  try {
    return await renderLoadedPage(doc, pageNumber, scale);
  } finally {
    await loadingTask.destroy();
  }
}

export async function renderAllPages(pdfBase64: string, scale = 1.35): Promise<RenderedPage[]> {
  const { doc, loadingTask } = await loadPdfDocument(pdfBase64);
  try {
    const count = doc.numPages;
    const pages: RenderedPage[] = [];
    for (let i = 1; i <= count; i++) {
      pages.push(await renderLoadedPage(doc, i, scale));
    }
    return pages;
  } finally {
    await loadingTask.destroy();
  }
}
