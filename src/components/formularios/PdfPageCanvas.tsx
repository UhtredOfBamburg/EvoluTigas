import React, { useEffect, useRef, useState } from 'react';

interface PdfPageCanvasProps {
  dataUrl: string;
  maxWidthPx?: number;
  onSizeChange?: (widthPx: number, heightPx: number) => void;
  /** Called when the user double-clicks on an empty spot of the PDF page to create a new field at that exact normalized position. */
  onCanvasDoubleClick?: (xNorm: number, yNorm: number) => void;
  children?: (widthPx: number, heightPx: number) => React.ReactNode;
}

/**
 * Renders one PDF page image and reports back its *actually rendered* pixel size
 * (after CSS scaling), so overlays (form fields) can be positioned in sync using
 * normalized 0..1 coordinates regardless of zoom/container width.
 */
export function PdfPageCanvas({
  dataUrl,
  maxWidthPx = 760,
  onSizeChange,
  onCanvasDoubleClick,
  children,
}: PdfPageCanvasProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  const measure = () => {
    const el = imgRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (w && h) {
      setSize({ w, h });
      onSizeChange?.(w, h);
    }
  };

  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUrl]);

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onCanvasDoubleClick || !overlayRef.current || size.w <= 0 || size.h <= 0) return;
    if (e.target !== overlayRef.current) return; // Ignore double-clicks inside existing field boxes
    const rect = overlayRef.current.getBoundingClientRect();
    const xNorm = Math.max(0, Math.min(0.92, (e.clientX - rect.left) / size.w));
    const yNorm = Math.max(0, Math.min(0.95, (e.clientY - rect.top) / size.h));
    onCanvasDoubleClick(xNorm, yNorm);
  };

  return (
    <div
      className="relative inline-block bg-white shadow-sm border border-slate-300"
      style={{ maxWidth: maxWidthPx }}
    >
      <img
        ref={imgRef}
        src={dataUrl}
        alt="Página do formulário"
        className="block w-full h-auto select-none pointer-events-none"
        draggable={false}
        onLoad={measure}
      />
      {size.w > 0 && (
        <div
          ref={overlayRef}
          onDoubleClick={handleDoubleClick}
          className="absolute inset-0 cursor-crosshair"
          style={{ width: size.w, height: size.h }}
          title={onCanvasDoubleClick ? 'Dê duplo-clique em qualquer lugar vazio para criar um novo campo aqui' : undefined}
        >
          {children?.(size.w, size.h)}
        </div>
      )}
    </div>
  );
}
