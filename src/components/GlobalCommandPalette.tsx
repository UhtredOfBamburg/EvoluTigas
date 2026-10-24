import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Bed,
  Stethoscope,
  Calculator,
  FileText,
  Plus,
  ScanText,
  ArrowRight,
  X,
} from 'lucide-react';
import { useEnfermariaPatients } from '@/hooks/useEnfermariaPatients';
import { useFormTemplates } from '@/hooks/useFormTemplates';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  category: 'Enfermaria' | 'Calculadoras & DVA' | 'Ambulatório' | 'Formulários & Ações';
  keywords: string;
  icon: React.ElementType;
  onSelect: () => void;
}

const CALCULATOR_SHORTCUTS = [
  {
    id: 'funcao-renal',
    title: 'Função Renal: CKD-EPI (2021) & Cockcroft-Gault',
    subtitle: 'TFG estimada, Clearance de Creatinina e alerta de ajuste de dose',
    keywords: 'ckd epi cockcroft gault clcr creatinina renal tfg kdigo vancomicina meropenem cefepime',
  },
  {
    id: 'escores-gravidade',
    title: 'Escores de Gravidade: qSOFA, CURB-65, Wells e MELD-Na',
    subtitle: 'Triagem de sepse, pneumonia (PAC), TEP e cirrose hepática',
    keywords: 'qsofa sepse curb65 curb-65 pneumonia pac wells tep embolia meld meld-na cirrose',
  },
  {
    id: 'eletrolitos',
    title: 'Eletrólitos & Gasometria: Sódio, Cálcio e Ânion Gap',
    subtitle: 'Sódio corrigido pela glicemia, Cálcio pela albumina e Delta/Delta',
    keywords: 'sodio na hiperglicemia katz hillier calcio albumina anion gap gasometria acidose',
  },
  {
    id: 'guia-dva',
    title: 'Guia Rápido de Diluição e Infusão de DVA & Sedação',
    subtitle: 'Conversor mL/h ↔ mcg/kg/min (Noradrenalina, Dobuta, Vaso, Fentanil, Midazolam, Precedex)',
    keywords: 'dva noradrenalina nora dobutamina vasopressina nipride nitroprussiato tridil nitroglicerina fentanil midazolam dormonid precedex dexmedetomidina bomba infusao ml/h',
  },
  {
    id: 'diurese',
    title: 'Taxa de Diurese (mL/kg/h)',
    subtitle: 'Avaliação de débito urinário e oligúria em 6h, 12h ou 24h',
    keywords: 'diurese oliguria anuria debito urinario ml/kg/h',
  },
  {
    id: 'child-pugh',
    title: 'Escore de Child-Pugh',
    subtitle: 'Classificação funcional A, B e C na cirrose hepática',
    keywords: 'child pugh cirrose ascite encefalopatia bilirrubina inr',
  },
  {
    id: 'cha2ds2-va',
    title: 'Escore CHA₂DS₂-VA (Fibrilação Atrial)',
    subtitle: 'Risco cardioembólico e indicação de anticoagulação na FA',
    keywords: 'cha2ds2 va fa fibrilacao atrial anticoagulacao avc',
  },
  {
    id: 'prevent',
    title: 'Risco Cardiovascular AHA PREVENT',
    subtitle: 'Estimativa de risco cardiovascular em 10 anos',
    keywords: 'prevent aha risco cardiovascular infarto avc estatina',
  },
  {
    id: 'imc',
    title: 'Índice de Massa Corporal (IMC)',
    subtitle: 'Classificação nutricional por peso e estatura',
    keywords: 'imc obesidade sobrepeso peso altura',
  },
  {
    id: 'carga',
    title: 'Carga Tabágica (Anos-Maço)',
    subtitle: 'Cálculo rápido de maços-ano e rastreamento',
    keywords: 'tabagismo cigarro anos maco carga tabagica',
  },
  {
    id: 'pedz',
    title: 'Z-Escore Pediátrico (OMS)',
    subtitle: 'Peso, estatura e IMC para idade na pediatria',
    keywords: 'pediatria z escore oms crianca crescimento',
  },
  {
    id: 'ig',
    title: 'Idade Gestacional & DPP',
    subtitle: 'Cálculo por DUM ou ultrassom obstétrico',
    keywords: 'gestante gravidez dum dpp idade gestacional obstetrica',
  },
];

export function GlobalCommandPalette({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { patients } = useEnfermariaPatients();
  const { templates } = useFormTemplates();
  const [ambulatorioPacientes] = useLocalStorage<any[]>('evolutigas_ambulatorio_pacientes_v1', []);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isOpen]);

  const allItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [];

    // 1. Pacientes da Enfermaria
    patients.forEach((p) => {
      const openPendCount = (p.pendencias || []).filter((x) => !x.done).length;
      items.push({
        id: `enf_${p.id}`,
        title: `${p.bed} — ${p.name} (${p.age}a)`,
        subtitle: `HD: ${p.diagnosis}${openPendCount > 0 ? ` · ${openPendCount} pendência(s)` : ''}`,
        category: 'Enfermaria',
        keywords: `${p.bed} ${p.name} ${p.diagnosis} ${p.prontuario || ''} ${p.antibioticos || ''} enfermaria leito`,
        icon: Bed,
        onSelect: () => {
          navigate(`/enfermaria/paciente/${p.id}`);
          onClose();
        },
      });
    });

    // 2. Calculadoras & DVA
    CALCULATOR_SHORTCUTS.forEach((calc) => {
      items.push({
        id: `calc_${calc.id}`,
        title: calc.title,
        subtitle: calc.subtitle,
        category: 'Calculadoras & DVA',
        keywords: `${calc.title} ${calc.subtitle} ${calc.keywords}`,
        icon: Calculator,
        onSelect: () => {
          navigate('/calculadoras', { state: { initialTab: calc.id } });
          onClose();
        },
      });
    });

    // 3. Pacientes do Ambulatório
    ambulatorioPacientes
      .filter((p) => !p.archived)
      .forEach((p) => {
        items.push({
          id: `amb_${p.id}`,
          title: `Ambulatório: ${p.nome}`,
          subtitle: `Horário: ${p.hora || '--:--'} · Clique para abrir a consulta`,
          category: 'Ambulatório',
          keywords: `${p.nome} ${p.notas || ''} ambulatorio consulta anamnese`,
          icon: Stethoscope,
          onSelect: () => {
            navigate('/ambulatorio', { state: { openPatientId: p.id } });
            onClose();
          },
        });
      });

    // 4. Moldes PDF & Ações Rápidas
    templates.forEach((t) => {
      items.push({
        id: `tpl_${t.id}`,
        title: `Formulário PDF: ${t.name}`,
        subtitle: `${t.fields.length} campos mapeados · Abrir na Central de Formulários`,
        category: 'Formulários & Ações',
        keywords: `${t.name} formulario pdf receita aih atestado exame`,
        icon: FileText,
        onSelect: () => {
          navigate('/formularios', { state: { selectedForm: t.id } });
          onClose();
        },
      });
    });

    items.push(
      {
        id: 'act_novo_paciente',
        title: 'Admitir Novo Paciente na Enfermaria',
        subtitle: 'Cadastrar novo leito, diagnóstico e antibióticos',
        category: 'Formulários & Ações',
        keywords: 'novo paciente admitir enfermaria leito internacao',
        icon: Plus,
        onSelect: () => {
          navigate('/enfermaria/novo');
          onClose();
        },
      },
      {
        id: 'act_transcritor',
        title: 'Transcritor Inteligente de Exames',
        subtitle: 'Extrair exames laboratoriais e de imagem com (VR: XX)',
        category: 'Formulários & Ações',
        keywords: 'transcritor exames laboratorio imagem vr',
        icon: ScanText,
        onSelect: () => {
          navigate('/transcritor');
          onClose();
        },
      },
      {
        id: 'act_importar_pdf',
        title: 'Importar Novo Molde PDF Oficial',
        subtitle: 'Mapear campos sobre um PDF de receita, AIH, APAC ou atestado',
        category: 'Formulários & Ações',
        keywords: 'importar novo pdf molde receita aih formulario',
        icon: FileText,
        onSelect: () => {
          navigate('/formularios/novo');
          onClose();
        },
      }
    );

    return items;
  }, [patients, ambulatorioPacientes, templates, navigate, onClose]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems.slice(0, 14);
    const terms = q.split(/\s+/);
    return allItems.filter((item) => {
      const haystack = `${item.title} ${item.subtitle} ${item.keywords}`.toLowerCase();
      return terms.every((term) => haystack.includes(term));
    });
  }, [allItems, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0
        );
      } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
        e.preventDefault();
        filteredItems[selectedIndex].onSelect();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-start justify-center pt-14 sm:pt-20 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-slate-200 gap-3">
          <Search className="w-5 h-5 text-teal-600 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar leito (ex: 12A), paciente, droga (ex: Nora, Fentanil) ou calculadora (CKD-EPI, MELD)..."
            className="w-full text-sm text-slate-900 placeholder:text-slate-400 bg-transparent focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-2 divide-y divide-slate-100 flex-1">
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">
              Nenhum leito, paciente ou calculadora encontrado para "{query}".
            </div>
          ) : (
            <div className="space-y-1">
              {filteredItems.map((item, idx) => {
                const Icon = item.icon;
                const active = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={item.onSelect}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      active ? 'bg-teal-50 text-teal-900' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`p-2 rounded-lg shrink-0 ${
                          active ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold truncate">{item.title}</span>
                          <span className="text-[10px] text-slate-400 shrink-0">· {item.category}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.subtitle}</p>
                      </div>
                    </div>
                    <ArrowRight
                      className={`w-4 h-4 shrink-0 ${active ? 'text-teal-600' : 'text-slate-300'}`}
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-400">
          <span>Use ↑↓ para navegar e Enter para abrir</span>
          <span>Atalho: Ctrl+K ou ⌘K</span>
        </div>
      </div>
    </div>
  );
}
