import React, { useEffect, useRef, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Printer,
  Maximize2,
  Loader2,
  ExternalLink,
  Share2,
  AlertCircle,
} from 'lucide-react';
import { openPdfDocumentBytes, getSafeCanvasScale, isIOSDevice } from '@/lib/pdfRender';
import { shareOrDownloadPdfBytes } from '@/lib/generateFilledPdf';

interface PdfLiveViewerProps {
  pdfBytes: Uint8Array | null;
  title?: string;
  onDownload?: () => void;
}

interface PageImage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Renders the real generated PDF bytes (from pdf-lib) using pdf.js inside a
 * universal PDF viewer frame (#323639 toolbar + #525659 backdrop).
 * Compatible with Chrome, Safari (macOS), and iOS/iPadOS (Safari & Chrome) inside sandboxed iframes.
 */
export function PdfLiveViewer({ pdfBytes, title = 'Documento.pdf', onDownload }: PdfLiveViewerProps) {
  const [pages, setPages] = useState<PageImage[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isIOS = isIOSDevice();

  useEffect(() => {
    if (!pdfBytes || pdfBytes.length === 0) return;

    let cancelled = false;
    let loadingTask: any = null;
    setIsRendering(true);
    setRenderError(null);

    (async () => {
      try {
        loadingTask = openPdfDocumentBytes(pdfBytes);
        const pdf = await loadingTask.promise;
        const renderedPages: PageImage[] = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          if (cancelled) return;

          const unscaled = page.getViewport({ scale: 1, rotation });
          const targetScale = getSafeCanvasScale(unscaled.width, unscaled.height, isIOS ? 1.5 : 1.75);
          const viewport = page.getViewport({ scale: targetScale, rotation });

          const canvas = document.createElement('canvas');
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
          if (cancelled) {
            canvas.width = 0;
            canvas.height = 0;
            return;
          }

          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          // Free iOS WebKit canvas backing memory immediately
          canvas.width = 0;
          canvas.height = 0;

          renderedPages.push({
            pageNumber: i,
            dataUrl,
            width: unscaled.width,
            height: unscaled.height,
          });
        }

        if (!cancelled) {
          setPages(renderedPages);
          if (currentPage > renderedPages.length) {
            setCurrentPage(1);
          }
        }
      } catch (err: any) {
        if (
          !cancelled &&
          err?.name !== 'RenderingCancelledException' &&
          !String(err?.message || '').includes('Worker was destroyed')
        ) {
          console.error('Error rendering live PDF bytes:', err);
          setRenderError('Não foi possível renderizar a prévia na tela.');
        }
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    })();

    return () => {
      cancelled = true;
      if (loadingTask) {
        loadingTask.destroy().catch(() => {});
      }
    };
  }, [pdfBytes, rotation, isIOS]);

  const handlePrint = () => {
    if (pages.length === 0) {
      onDownload?.();
      return;
    }

    // Use a hidden iframe first (works in Safari macOS & iOS AirPrint without popup blocker issues)
    try {
      const existingFrame = document.getElementById('pdf-print-iframe');
      if (existingFrame) existingFrame.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'pdf-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '1px';
      iframe.style.height = '1px';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';
      document.body.appendChild(iframe);

      const imgsHtml = pages
        .map(
          (p) =>
            `<div class="page">
               <img src="${p.dataUrl}" />
             </div>`
        )
        .join('');

      const doc = iframe.contentWindow?.document;
      if (doc && iframe.contentWindow) {
        doc.open();
        doc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>${title}</title>
              <style>
                @page { size: A4; margin: 0; }
                html, body { margin: 0; padding: 0; background: #fff; }
                .page { page-break-after: always; display: flex; justify-content: center; align-items: center; width: 100vw; height: 100vh; overflow: hidden; }
                .page:last-child { page-break-after: auto; }
                img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
              </style>
            </head>
            <body>${imgsHtml}</body>
          </html>
        `);
        doc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch {
            onDownload?.();
          }
        }, 350);
        return;
      }
    } catch {
      // Fallback to download/share if iframe printing is restricted
    }

    onDownload?.();
  };

  const handleOpenBlobInNewTab = () => {
    if (!pdfBytes) return;
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const handleNativeShare = async () => {
    if (!pdfBytes) return;
    await shareOrDownloadPdfBytes(pdfBytes, title);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (pages.length <= 1) return;
    const el = e.currentTarget;
    const ratio = el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight);
    const pageIdx = Math.min(pages.length, Math.max(1, Math.round(ratio * (pages.length - 1)) + 1));
    if (pageIdx !== currentPage) setCurrentPage(pageIdx);
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#525659] text-white select-none overflow-hidden rounded-xl">
      {/* Universal PDF Viewer Top Toolbar (Chrome / Safari / iOS compatible) */}
      <div className="min-h-11 bg-[#323639] px-2.5 sm:px-3 py-1.5 flex items-center justify-between gap-2 border-b border-black/30 shadow-xs shrink-0 z-10 flex-wrap">
        {/* Left: Document title */}
        <div className="flex items-center gap-2 min-w-0 max-w-[32%] sm:max-w-[35%]">
          <span className="text-xs font-medium text-slate-200 truncate" title={title}>
            {title}
          </span>
        </div>

        {/* Center: Page counter & Zoom controls */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <div className="flex items-center gap-1 bg-black/25 px-2 py-0.5 rounded text-xs font-mono text-slate-200">
            <span>{currentPage}</span>
            <span className="text-slate-400">/</span>
            <span>{Math.max(1, pages.length)}</span>
          </div>

          <div className="h-4 w-[1px] bg-white/15 mx-0.5 sm:mx-1" />

          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(50, z - 15))}
            className="p-1.5 rounded hover:bg-white/10 text-slate-200 transition-colors"
            title="Diminuir zoom"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="bg-black/25 px-1.5 sm:px-2 py-0.5 rounded text-[11px] font-mono min-w-[42px] text-center text-slate-200">
            {zoom}%
          </span>

          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(200, z + 15))}
            className="p-1.5 rounded hover:bg-white/10 text-slate-200 transition-colors"
            title="Aumentar zoom"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setZoom(100)}
            className="hidden sm:inline-flex p-1.5 rounded hover:bg-white/10 text-slate-200 transition-colors"
            title="Ajustar à largura (100%)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-1.5 rounded hover:bg-white/10 text-slate-200 transition-colors"
            title="Girar página"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Share (iOS), Download, Print & Open in New Tab */}
        <div className="flex items-center gap-1">
          {isRendering && <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-400 mr-1" />}
          {isIOS && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="p-1.5 rounded hover:bg-white/10 text-teal-300 transition-colors"
              title="Compartilhar / Salvar em Arquivos (iOS)"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={handleOpenBlobInNewTab}
            className="p-1.5 rounded hover:bg-white/10 text-slate-200 transition-colors"
            title="Abrir PDF em nova guia"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDownload}
            className="p-1.5 rounded hover:bg-white/10 text-slate-200 transition-colors"
            title="Baixar PDF"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="p-1.5 rounded hover:bg-white/10 text-slate-200 transition-colors"
            title="Imprimir PDF"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable Document Viewport */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto p-3 sm:p-6 flex flex-col items-center gap-5 [-webkit-overflow-scrolling:touch]"
      >
        {renderError ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-200 gap-3 text-center max-w-sm px-4">
            <AlertCircle className="w-7 h-7 text-amber-400" />
            <p className="text-xs text-slate-300">{renderError}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenBlobInNewTab}
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition-colors"
              >
                Abrir PDF
              </button>
              {onDownload && (
                <button
                  type="button"
                  onClick={onDownload}
                  className="px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors"
                >
                  Baixar PDF
                </button>
              )}
            </div>
          </div>
        ) : pages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-300 gap-2 text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
            Gerando prévia do PDF...
          </div>
        ) : (
          pages.map((p) => (
            <div
              key={p.pageNumber}
              style={{
                width: `${zoom}%`,
                maxWidth: `${(p.width * zoom) / 100}px`,
              }}
              className="bg-white shadow-[0_4px_18px_rgba(0,0,0,0.45)] transition-all duration-150 shrink-0"
            >
              <img
                src={p.dataUrl}
                alt={`Página ${p.pageNumber}`}
                className="block w-full h-auto"
                draggable={false}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
