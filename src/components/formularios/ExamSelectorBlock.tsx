import React, { useMemo, useState } from 'react';
import { Textarea } from '@/components/ui';
import { ListFilter, Info, Plus, Check, Search, X } from 'lucide-react';

export interface ExamShortcutGroup {
  id: string;
  label: string;
  items: string[];
}

export interface ExamCategory {
  category: string;
  items: string[];
}

export const EXAM_SHORTCUT_GROUPS: ExamShortcutGroup[] = [
  {
    id: 'funcao_renal',
    label: 'Função Renal',
    items: ['UREIA', 'ÁCIDO ÚRICO', 'CREATININA', 'SÓDIO', 'POTÁSSIO', 'EAS'],
  },
  {
    id: 'funcao_hepatica',
    label: 'Função Hepática',
    items: [
      'TAP',
      'TGO',
      'TGP',
      'FOSFATASE ALCALINA',
      'GAMA GT',
      'BILIRRUBINAS TOTAIS E FRAÇÕES',
      'ALBUMINA',
      'PROTEÍNAS TOTAIS',
      'LDH',
    ],
  },
  {
    id: 'funcao_metabolica',
    label: 'Função Metabólica',
    items: [
      'HEMOGRAMA',
      'TAP',
      'GLICEMIA DE JEJUM',
      'TGO',
      'TGP',
      'FOSFATASE ALCALINA',
      'GAMA GT',
      'BILIRRUBINAS TOTAIS E FRAÇÕES',
      'ALBUMINA',
      'PROTEÍNAS TOTAIS',
      'LDH',
      'LIPIDOGRAMA',
      'HBA1C',
      '25-HIDROXIVITAMINA D',
      'VITAMINA B12',
      'TSH',
      'T4L',
      'EAS',
    ],
  },
  {
    id: 'pre_operatorio',
    label: 'Pré-Operatório',
    items: [
      'HEMOGRAMA',
      'COAGULOGRAMA',
      'GLICEMIA DE JEJUM',
      'UREIA',
      'CREATININA',
      'EAS',
      'ECG DE 12 DERIVAÇÕES',
    ],
  },
  {
    id: 'cardio_hipertensao',
    label: 'Cardio/Hipertensão',
    items: [
      'HEMOGRAMA',
      'GLICEMIA DE JEJUM',
      'UREIA',
      'ÁCIDO ÚRICO',
      'CREATININA',
      'SÓDIO',
      'POTÁSSIO',
      'LIPIDOGRAMA',
      'HBA1C',
    ],
  },
  {
    id: 'sorologias',
    label: 'Sorologias',
    items: [
      'HIV 1 E 2',
      'HBSAG',
      'ANTI-HBS',
      'ANTI-HBC TOTAL',
      'ANTI-HBC IGM',
      'HBEAG',
      'ANTI-HBE',
      'ANTI-HCV',
      'VDRL',
    ],
  },
  {
    id: 'pre_natal',
    label: 'Pré-Natal',
    items: [
      'HEMOGRAMA',
      'TIPAGEM SANGUÍNEA E FATOR RH',
      'COOMBS INDIRETO',
      'GLICEMIA DE JEJUM',
      'TOTG 75G',
      'HIV 1 E 2',
      'HBSAG',
      'ANTI-HCV',
      'VDRL',
      'TOXOPLASMOSE IGG E IGM',
      'RUBÉOLA IGG E IGM',
      'CITOMEGALOVÍRUS IGG E IGM',
      'TSH',
      'T4L',
      'EAS',
      'UROCULTURA',
    ],
  },
];

export const EXAM_CATEGORIES: ExamCategory[] = [
  {
    category: 'Hematologia',
    items: [
      'HEMOGRAMA',
      'COAGULOGRAMA',
      'TAP',
      'TTPA',
      'CONTAGEM DE PLAQUETAS',
      'RETICULÓCITOS',
      'D-DÍMERO',
      'FIBRINOGÊNIO',
      'TIPAGEM SANGUÍNEA E FATOR RH',
      'COOMBS INDIRETO',
    ],
  },
  {
    category: 'Bioquímica',
    items: [
      'GLICEMIA DE JEJUM',
      'GLICEMIA PÓS-PRANDIAL',
      'UREIA',
      'ÁCIDO ÚRICO',
      'CREATININA',
      'TGO',
      'TGP',
      'FOSFATASE ALCALINA',
      'GAMA GT',
      'PROTEINOGRAMA',
      'BILIRRUBINAS TOTAIS E FRAÇÕES',
      'ALBUMINA',
      'PROTEÍNAS TOTAIS',
      'LDH',
      'AMILASE',
      'LIPASE',
    ],
  },
  {
    category: 'Eletrólitos',
    items: ['SÓDIO', 'POTÁSSIO', 'FÓSFORO', 'CÁLCIO TOTAL', 'CLORO', 'MAGNÉSIO'],
  },
  {
    category: 'Lipídeos / Metabólico',
    items: [
      'LIPIDOGRAMA',
      'HBA1C',
      '25-HIDROXIVITAMINA D',
      'VITAMINA B12',
      'ÁCIDO FÓLICO',
      'COLESTEROL TOTAL',
      'LDL',
      'HDL',
      'TRIGLICERÍDEOS',
      'INSULINA DE JEJUM',
      'TOTG 75G',
    ],
  },
  {
    category: 'Sorologias / Infecciosas',
    items: [
      'HIV 1 E 2',
      'HBSAG',
      'ANTI-HBS',
      'ANTI-HBC TOTAL',
      'ANTI-HBC IGM',
      'HBEAG',
      'ANTI-HBE',
      'ANTI-HCV',
      'VDRL',
      'TOXOPLASMOSE IGG E IGM',
      'RUBÉOLA IGG E IGM',
      'CITOMEGALOVÍRUS IGG E IGM',
    ],
  },
  {
    category: 'Hormônios / Tireoide',
    items: [
      'TSH',
      'T4L',
      'T3 TOTAL',
      'ANTI TPO',
      'ANTI TIREOGLOBULINA',
      'TIREOGLOBULINA',
      'TRAB',
      'SHBG',
      'GH',
      'IGF-1',
      'CORTISOL DAS 08:00',
      'ACTH',
      'FSH',
      'LH',
      'ESTRADIOL',
      'TESTOSTERONA TOTAL',
      'TESTOSTERONA LIVRE CALCULADA',
      'PTH',
      'PSA',
    ],
  },
  {
    category: 'Inflamação / Imuno',
    items: [
      'FERRITINA',
      'ÍNDICE DE SATURAÇÃO DE TRANSFERRINA',
      'PCR (PROTEÍNA C-REATIVA)',
      'VHS',
      'PROCALCITONINA',
      'FAN',
      'FATOR REUMATOIDE',
      'COMPLEMENTO C3/C4',
    ],
  },
  {
    category: 'Urina / Fezes',
    items: [
      'EAS',
      'UROCULTURA',
      'MICROALBUMINÚRIA DE 24 HORAS',
      'ALBUMINA NA AMOSTRA ISOLADA DE URINA',
      'CREATININA NA AMOSTRA ISOLADA DE URINA',
      'CÁLCIO NA URINA DE 24 HORAS',
      'FÓSFORO NA URINA DE 24 HORAS',
      'PARASITOLÓGICO DE FEZES',
      'PROTEINÚRIA DE 24H',
      'CREATINÚRIA 24H',
    ],
  },
  {
    category: 'Cardiologia',
    items: [
      'ECG DE 12 DERIVAÇÕES',
      'TROPONINA',
      'CK-MB',
      'PRO-BNP / NT-PROBNP',
      'ECOCARDIOGRAMA TRANSTORÁCICO',
      'HOLTER 24H',
      'MAPA 24H',
      'TESTE ERGOMÉTRICO',
    ],
  },
  {
    category: 'Imagem',
    items: [
      'RAIO-X DE TÓRAX (PA)',
      'ECOGRAFIA ABDOMINAL TOTAL',
      'TC DE TÓRAX SEM CONTRASTE',
      'TC DE ABDÔMEN COM CONTRASTE',
      'RM DE CRÂNIO',
      'DENSITOMETRIA ÓSSEA',
      'MAMOGRAFIA BILATERAL',
    ],
  },
];

export function cleanExamName(str: string): string {
  return str
    .replace(/^\s*(?:\d+\s*[.)\-–—:]\s*|[-•*]\s*)/, '')
    .trim();
}

function normalizeExamLine(str: string): string {
  return cleanExamName(str)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatNumberedExamList(items: string[]): string {
  const cleaned = items.map(cleanExamName).filter(Boolean);
  return cleaned.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
}

interface ExamSelectorBlockProps {
  value: string;
  onChange: (newValue: string) => void;
}

export function ExamSelectorBlock({ value, onChange }: ExamSelectorBlockProps) {
  const [showClickableList, setShowClickableList] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewShortcutId, setPreviewShortcutId] = useState<string | null>(null);

  // Parse current lines in the textarea (cleaned of leading numbering)
  const currentLines = useMemo(() => {
    return (value || '')
      .split(/\r?\n/)
      .map(cleanExamName)
      .filter(Boolean);
  }, [value]);

  const normalizedSet = useMemo(() => {
    return new Set(currentLines.map(normalizeExamLine));
  }, [currentLines]);

  const isExamPresent = (exam: string): boolean => {
    return normalizedSet.has(normalizeExamLine(exam));
  };

  const isShortcutFullyActive = (group: ExamShortcutGroup): boolean => {
    return group.items.every((item) => isExamPresent(item));
  };

  const handleToggleSingleExam = (exam: string) => {
    const normTarget = normalizeExamLine(exam);
    if (normalizedSet.has(normTarget)) {
      const filtered = currentLines.filter((line) => normalizeExamLine(line) !== normTarget);
      onChange(formatNumberedExamList(filtered));
    } else {
      const next = [...currentLines, exam];
      onChange(formatNumberedExamList(next));
    }
  };

  const handleToggleShortcutGroup = (group: ExamShortcutGroup) => {
    const allPresent = isShortcutFullyActive(group);
    if (allPresent) {
      // Remove the exams of this group
      const groupNorms = new Set(group.items.map(normalizeExamLine));
      const filtered = currentLines.filter((line) => !groupNorms.has(normalizeExamLine(line)));
      onChange(formatNumberedExamList(filtered));
    } else {
      // Add any missing exam from this group, preserving order and avoiding duplicates
      const existingNorms = new Set(currentLines.map(normalizeExamLine));
      const next = [...currentLines];
      for (const item of group.items) {
        const norm = normalizeExamLine(item);
        if (!existingNorms.has(norm)) {
          next.push(item);
          existingNorms.add(norm);
        }
      }
      onChange(formatNumberedExamList(next));
    }
  };

  const filteredCategories = useMemo(() => {
    const q = normalizeExamLine(searchQuery);
    if (!q) return EXAM_CATEGORIES;
    return EXAM_CATEGORIES.map((cat) => ({
      category: cat.category,
      items: cat.items.filter(
        (item) =>
          normalizeExamLine(item).includes(q) ||
          normalizeExamLine(cat.category).includes(q)
      ),
    })).filter((cat) => cat.items.length > 0);
  }, [searchQuery]);

  const previewGroup = EXAM_SHORTCUT_GROUPS.find((g) => g.id === previewShortcutId) || null;

  return (
    <div className="space-y-3">
      {/* Top Helper Text + Toggle "Lista clicável" Button */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs italic text-slate-400">
          Digite diretamente ou use os atalhos e lista clicável abaixo
        </span>

        <button
          type="button"
          onClick={() => setShowClickableList((prev) => !prev)}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            showClickableList
              ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
              : 'bg-teal-50/70 text-teal-700 border-teal-200 hover:bg-teal-100/70'
          }`}
        >
          <ListFilter className="w-3.5 h-3.5" />
          <span>{showClickableList ? 'Fechar lista' : 'Lista clicável'}</span>
          {!showClickableList && currentLines.length > 0 && (
            <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-teal-600 text-white text-[10px] font-bold">
              {currentLines.length}
            </span>
          )}
        </button>
      </div>

      {/* Horizontal Scrollable Shortcut Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5">
        {EXAM_SHORTCUT_GROUPS.map((group) => {
          const active = isShortcutFullyActive(group);
          return (
            <div
              key={group.id}
              className={`inline-flex items-center rounded-full border text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                active
                  ? 'bg-rose-50 text-rose-700 border-rose-200 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-rose-200 hover:text-rose-600'
              }`}
            >
              <button
                type="button"
                onClick={() => handleToggleShortcutGroup(group)}
                className="pl-3.5 pr-2 py-1.5 flex items-center gap-1.5"
                title={`Inserir/remover pacote ${group.label}: ${group.items.join(', ')}`}
              >
                <span>{group.label}</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPreviewShortcutId((prev) => (prev === group.id ? null : group.id));
                }}
                className={`pr-2.5 pl-1 py-1.5 rounded-r-full transition-colors ${
                  active ? 'text-rose-500 hover:text-rose-700' : 'text-slate-400 hover:text-slate-600'
                }`}
                title={`Ver exames de ${group.label}`}
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Optional Info Popover showing which exams belong to the clicked shortcut */}
      {previewGroup && (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              Pacote {previewGroup.label} ({previewGroup.items.length} exames)
            </span>
            <button
              type="button"
              onClick={() => setPreviewShortcutId(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-slate-600 font-mono text-[11px] leading-relaxed">
            {previewGroup.items.join(' · ')}
          </p>
        </div>
      )}

      {/* Main Exams Textarea (1 exam per line) */}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={'Um exame por linha – ex: HEMOGRAMA\nCREATININA\nECG DE 12 DERIVAÇÕES...'}
        className="min-h-[145px] rounded-2xl border-slate-200 font-mono text-sm leading-relaxed tracking-wide p-3.5"
      />

      {/* Expandable Clickable Categorized List */}
      {showClickableList && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
          {/* Filter Input */}
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar lista por nome ou categoria..."
              className="w-full h-10 pl-10 pr-9 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 3-Column Categorized Exam List */}
          <div className="max-h-[420px] overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredCategories.map((cat) => (
              <div key={cat.category} className="space-y-2">
                <div className="border-b border-slate-100 pb-1.5">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    {cat.category}
                  </h4>
                </div>
                <div className="space-y-0.5">
                  {cat.items.map((exam) => {
                    const selected = isExamPresent(exam);
                    return (
                      <button
                        key={exam}
                        type="button"
                        onClick={() => handleToggleSingleExam(exam)}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors ${
                          selected
                            ? 'bg-teal-50 text-teal-800 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                        title={exam}
                      >
                        <span className="truncate">{exam}</span>
                        {selected ? (
                          <Check className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        ) : (
                          <Plus className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredCategories.length === 0 && (
              <div className="col-span-full py-6 text-center text-xs text-slate-400">
                Nenhum exame encontrado para "{searchQuery}".
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
