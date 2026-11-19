import React, { useEffect, useRef, useState } from 'react';
import { Hash, Search, Loader2, X, Building2, MapPin, Stethoscope, FileSpreadsheet } from 'lucide-react';
import {
  searchCid10,
  searchCnes,
  searchMunicipios,
  searchSigtap,
  type Cid10Item,
  type CnesItem,
  type MunicipioIbgeItem,
  type SigtapItem,
} from '@/lib/susData';

export type SusAutocompleteKind = 'cnes' | 'municipio' | 'cid10' | 'sigtap';

interface SusAutocompleteInputProps {
  kind: SusAutocompleteKind;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Optional active CID-10 Principal code to surface compatible SIGTAP AIH procedures automatically. */
  relatedCidCode?: string;
  onSelectCnes?: (item: CnesItem) => void;
  onSelectMunicipio?: (item: MunicipioIbgeItem) => void;
  onSelectCid?: (item: Cid10Item) => void;
  onSelectSigtap?: (item: SigtapItem) => void;
}

type AnyOption =
  | { kind: 'cnes'; data: CnesItem }
  | { kind: 'municipio'; data: MunicipioIbgeItem }
  | { kind: 'cid10'; data: Cid10Item }
  | { kind: 'sigtap'; data: SigtapItem };

export function SusAutocompleteInput({
  kind,
  value,
  onChange,
  placeholder,
  relatedCidCode,
  onSelectCnes,
  onSelectMunicipio,
  onSelectCid,
  onSelectSigtap,
}: SusAutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<AnyOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const reqIdRef = useRef(0);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const currentReq = ++reqIdRef.current;
    const delay = kind === 'cnes' ? 180 : 90;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        let next: AnyOption[] = [];
        if (kind === 'cnes') {
          const items = await searchCnes(value, 14);
          next = items.map((data) => ({ kind: 'cnes', data }));
        } else if (kind === 'municipio') {
          const items = await searchMunicipios(value, 12);
          next = items.map((data) => ({ kind: 'municipio', data }));
        } else if (kind === 'cid10') {
          const items = await searchCid10(value, 16);
          next = items.map((data) => ({ kind: 'cid10', data }));
        } else if (kind === 'sigtap') {
          const items = await searchSigtap(value, {
            cidCode: relatedCidCode,
            prioritizeAih: true,
            limit: 18,
          });
          next = items.map((data) => ({ kind: 'sigtap', data }));
        }

        if (currentReq === reqIdRef.current) {
          setOptions(next);
          setActiveIdx(0);
        }
      } finally {
        if (currentReq === reqIdRef.current) {
          setLoading(false);
        }
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [kind, value, relatedCidCode, isOpen]);

  const handlePick = (opt: AnyOption) => {
    if (opt.kind === 'cnes') {
      onSelectCnes?.(opt.data);
    } else if (opt.kind === 'municipio') {
      onSelectMunicipio?.(opt.data);
    } else if (opt.kind === 'cid10') {
      onSelectCid?.(opt.data);
    } else if (opt.kind === 'sigtap') {
      onSelectSigtap?.(opt.data);
    }
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      if (e.key === 'ArrowDown') {
        setIsOpen(true);
      }
      return;
    }
    if (!isOpen || options.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((prev) => (prev + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((prev) => (prev - 1 + options.length) % options.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = options[activeIdx];
      if (chosen) handlePick(chosen);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const defaultPlaceholder =
    kind === 'cnes'
      ? 'Busca por CNES, nome ou município...'
      : kind === 'municipio'
      ? 'Busque o município ou código IBGE...'
      : kind === 'cid10'
      ? 'Busca por CID-10 ou diagnóstico...'
      : 'Busque pelo nome do procedimento ou código SIGTAP...';

  const iconEl =
    kind === 'cnes' ? (
      <Hash className="w-4 h-4 text-orange-500 shrink-0" />
    ) : kind === 'cid10' ? (
      <Hash className="w-4 h-4 text-emerald-600 shrink-0" />
    ) : (
      <Search className="w-4 h-4 text-blue-600 shrink-0" />
    );

  const ringClass =
    kind === 'cnes'
      ? 'focus-within:border-violet-400 focus-within:ring-violet-500/20'
      : kind === 'cid10'
      ? 'focus-within:border-emerald-400 focus-within:ring-emerald-500/20'
      : 'focus-within:border-blue-400 focus-within:ring-blue-500/20';

  const dropdownHeader =
    kind === 'sigtap' && !value.trim() && relatedCidCode && options.length > 0
      ? `Procedimentos AIH compatíveis com CID ${relatedCidCode} (SIGTAP oficial)`
      : kind === 'cnes' && !value.trim()
      ? 'Hospitais principais (GO) — digite CNES, nome ou município de qualquer estado'
      : kind === 'municipio' && !value.trim()
      ? 'Municípios frequentes — digite qualquer cidade do Brasil (IBGE)'
      : null;

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center gap-2.5 h-11 rounded-full border border-slate-200 bg-white px-4 shadow-2xs transition-all focus-within:ring-2 ${ringClass}`}
      >
        {iconEl}
        <input
          type="text"
          value={value}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || defaultPlaceholder}
          className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none border-0 shadow-none"
          autoComplete="off"
        />
        {loading && <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />}
        {!loading && value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(true);
            }}
            className="p-0.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
            title="Limpar campo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden max-h-72 overflow-y-auto custom-scrollbar">
          {dropdownHeader && (
            <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
              {kind === 'sigtap' ? (
                <FileSpreadsheet className="w-3.5 h-3.5 text-teal-600 shrink-0" />
              ) : kind === 'cnes' ? (
                <Building2 className="w-3.5 h-3.5 text-orange-500 shrink-0" />
              ) : (
                <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              )}
              <span>{dropdownHeader}</span>
            </div>
          )}

          {options.length === 0 ? (
            <div className="px-4 py-3.5 text-xs text-slate-500">
              {loading
                ? 'Consultando tabela oficial SUS...'
                : !value.trim()
                ? kind === 'cid10'
                  ? 'Digite o código CID-10 (ex: J18.9, K35) ou o nome da doença (ex: pneumonia, dengue)...'
                  : 'Digite o nome do procedimento (ex: pneumonia, apendicectomia) ou o código SIGTAP...'
                : 'Nenhum resultado encontrado. Você pode manter o texto digitado livremente.'}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {options.map((opt, idx) => {
                const isActive = idx === activeIdx;
                const key =
                  opt.kind === 'cnes'
                    ? opt.data.cnes
                    : opt.kind === 'municipio'
                    ? opt.data.ibge7
                    : opt.kind === 'cid10'
                    ? opt.data.rawCode
                    : opt.data.code;

                return (
                  <li key={`${opt.kind}-${key}-${idx}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handlePick(opt);
                      }}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`w-full text-left px-3.5 py-2.5 transition-colors flex items-start justify-between gap-2.5 ${
                        isActive ? 'bg-teal-50/80' : 'hover:bg-slate-50'
                      }`}
                    >
                      {opt.kind === 'cnes' && (
                        <>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 leading-snug">
                              {opt.data.nome}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {opt.data.municipio ? `${opt.data.municipio} · ${opt.data.uf}` : opt.data.uf || 'Brasil'}
                            </p>
                          </div>
                          <span className="shrink-0 font-mono tabular-nums text-[11px] font-bold px-2 py-0.5 rounded-md bg-orange-50 text-orange-700 border border-orange-200">
                            CNES {opt.data.cnes}
                          </span>
                        </>
                      )}

                      {opt.kind === 'municipio' && (
                        <>
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900">
                              {opt.data.nome}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              {opt.data.uf}
                            </span>
                          </div>
                          <span className="shrink-0 font-mono tabular-nums text-[11px] font-semibold text-slate-500">
                            IBGE {opt.data.ibge7}
                          </span>
                        </>
                      )}

                      {opt.kind === 'cid10' && (
                        <div className="flex items-start gap-2.5 min-w-0 w-full">
                          <span className="shrink-0 font-mono tabular-nums text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {opt.data.code}
                          </span>
                          <span className="text-xs text-slate-800 leading-snug">
                            {opt.data.description}
                          </span>
                        </div>
                      )}

                      {opt.kind === 'sigtap' && (
                        <div className="min-w-0 w-full space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono tabular-nums text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                              {opt.data.formattedCode}
                            </span>
                            {opt.data.compatibleWithCid && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Stethoscope className="w-2.5 h-2.5" /> Compatível c/ CID
                              </span>
                            )}
                            {opt.data.aihFlag === 1 && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                                AIH Principal
                              </span>
                            )}
                            {opt.data.aihFlag === 2 && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                AIH Especial/Sec.
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-slate-900 leading-snug">
                            {opt.data.name}
                          </p>
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
