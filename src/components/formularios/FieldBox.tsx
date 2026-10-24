import React, { useCallback, useRef, useState } from 'react';
import { X, GripVertical } from 'lucide-react';
import type { FormField } from '@/types/formTemplate';

interface FieldBoxProps {
  field: FormField;
  index?: number;
  containerWidthPx: number;
  containerHeightPx: number;
  onChange: (patch: Partial<FormField>) => void;
  onRemove?: () => void;
  active: boolean;
  onActivate: () => void;
}

const MIN_NORM = 0.012;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function FieldBox({
  field,
  index,
  containerWidthPx,
  containerHeightPx,
  onChange,
  onRemove,
  active,
  onActivate,
}: FieldBoxProps) {
  const [mode, setMode] = useState<'idle' | 'drag' | 'resize'>('idle');
  const startRef = useRef({ mouseX: 0, mouseY: 0, xNorm: 0, yNorm: 0, wNorm: 0, hNorm: 0 });

  const startDrag = (e: React.PointerEvent, nextMode: 'drag' | 'resize') => {
    e.stopPropagation();
    onActivate();
    (e.target as Element).setPointerCapture(e.pointerId);
    startRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      xNorm: field.xNorm,
      yNorm: field.yNorm,
      wNorm: field.wNorm,
      hNorm: field.hNorm,
    };
    setMode(nextMode);
  };

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (mode === 'idle') return;
      const dxNorm = (e.clientX - startRef.current.mouseX) / containerWidthPx;
      const dyNorm = (e.clientY - startRef.current.mouseY) / containerHeightPx;

      if (mode === 'drag') {
        const xNorm = clamp(startRef.current.xNorm + dxNorm, 0, 1 - field.wNorm);
        const yNorm = clamp(startRef.current.yNorm + dyNorm, 0, 1 - field.hNorm);
        onChange({ xNorm, yNorm });
      } else if (mode === 'resize') {
        const wNorm = clamp(startRef.current.wNorm + dxNorm, MIN_NORM, 1 - field.xNorm);
        const hNorm = clamp(startRef.current.hNorm + dyNorm, MIN_NORM, 1 - field.yNorm);
        onChange({ wNorm, hNorm });
      }
    },
    [mode, containerWidthPx, containerHeightPx, field.wNorm, field.hNorm, field.xNorm, field.yNorm, onChange]
  );

  const stopDrag = () => setMode('idle');

  const isPrescription = field.type === 'prescription';
  const isCheckbox = field.type === 'checkbox';

  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation();
        onActivate();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDrag}
      style={{
        position: 'absolute',
        left: field.xNorm * containerWidthPx,
        top: field.yNorm * containerHeightPx,
        width: field.wNorm * containerWidthPx,
        height: field.hNorm * containerHeightPx,
      }}
      className={`group border-2 rounded-xs flex items-start transition-colors ${
        active
          ? 'border-teal-600 bg-teal-500/20 z-20 shadow-sm'
          : isPrescription
          ? 'border-emerald-500/80 bg-emerald-500/10 hover:border-emerald-600 z-10'
          : isCheckbox
          ? 'border-amber-500/80 bg-amber-500/15 hover:border-amber-600 z-10'
          : 'border-indigo-500/75 bg-indigo-500/10 hover:border-indigo-600 z-10'
      }`}
    >
      <div
        onPointerDown={(e) => startDrag(e, 'drag')}
        className={`cursor-move text-[9.5px] leading-none flex items-center gap-0.5 rounded-br px-1 py-0.5 truncate max-w-full select-none font-medium ${
          active ? 'bg-teal-700 text-white' : 'bg-white/95 text-slate-800 border-b border-r border-slate-200'
        }`}
        title={`${field.label} (${field.fontSize || 9}pt)`}
      >
        <GripVertical className="w-2.5 h-2.5 shrink-0 opacity-75" />
        {typeof index === 'number' && <span className="font-bold mr-0.5">{index + 1}.</span>}
        <span className="truncate">{field.label}</span>
      </div>

      {onRemove && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
          title="Remover campo"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}

      <div
        onPointerDown={(e) => startDrag(e, 'resize')}
        className={`absolute bottom-0 right-0 w-3 h-3 rounded-tl cursor-se-resize ${
          active ? 'bg-teal-600 opacity-100' : 'bg-indigo-600 opacity-0 group-hover:opacity-100'
        }`}
        title="Arraste para redimensionar"
      />
    </div>
  );
}
