import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const PreventCalculator = lazy(() =>
  import('./calculadoras/PreventCalculator').then((m) => ({ default: m.PreventCalculator }))
);
const PedzCalculator = lazy(() =>
  import('./calculadoras/PedzCalculator').then((m) => ({ default: m.PedzCalculator }))
);
const ImcCalculator = lazy(() =>
  import('./calculadoras/ImcCalculator').then((m) => ({ default: m.ImcCalculator }))
);
const CargaTabagicaCalculator = lazy(() =>
  import('./calculadoras/CargaTabagicaCalculator').then((m) => ({ default: m.CargaTabagicaCalculator }))
);
const TaxaDiureseCalculator = lazy(() =>
  import('./calculadoras/TaxaDiureseCalculator').then((m) => ({ default: m.TaxaDiureseCalculator }))
);
const IdadeGestacionalCalculator = lazy(() =>
  import('./calculadoras/IdadeGestacionalCalculator').then((m) => ({ default: m.IdadeGestacionalCalculator }))
);
const ChildPughCalculator = lazy(() =>
  import('./calculadoras/ChildPughCalculator').then((m) => ({ default: m.ChildPughCalculator }))
);
const Cha2ds2VaCalculator = lazy(() =>
  import('./calculadoras/Cha2ds2VaCalculator').then((m) => ({ default: m.Cha2ds2VaCalculator }))
);
const FuncaoRenalCalculator = lazy(() =>
  import('./calculadoras/FuncaoRenalCalculator').then((m) => ({ default: m.FuncaoRenalCalculator }))
);
const EscoresGravidadeCalculator = lazy(() =>
  import('./calculadoras/EscoresGravidadeCalculator').then((m) => ({ default: m.EscoresGravidadeCalculator }))
);
const EletrolitosGasometriaCalculator = lazy(() =>
  import('./calculadoras/EletrolitosGasometriaCalculator').then((m) => ({ default: m.EletrolitosGasometriaCalculator }))
);
const GuiaDvaSedacaoCalculator = lazy(() =>
  import('./calculadoras/GuiaDvaSedacaoCalculator').then((m) => ({ default: m.GuiaDvaSedacaoCalculator }))
);

interface CalcTabItem {
  id: string;
  label: string;
  category: 'plantao' | 'ambulatorio';
  badge?: string;
}

const CALCULATOR_TABS: CalcTabItem[] = [
  { id: 'funcao-renal', label: 'Função Renal (CKD-EPI & CG)', category: 'plantao', badge: 'Novo' },
  { id: 'escores-gravidade', label: 'Gravidade (qSOFA, CURB-65, Wells, MELD-Na)', category: 'plantao', badge: 'Novo' },
  { id: 'eletrolitos', label: 'Eletrólitos & Ânion Gap (Na+, Ca2+, AG)', category: 'plantao', badge: 'Novo' },
  { id: 'guia-dva', label: 'Guia DVA & Sedação (mL/h)', category: 'plantao', badge: 'Novo' },
  { id: 'diurese', label: 'Taxa de Diurese (mL/kg/h)', category: 'plantao' },
  { id: 'child-pugh', label: 'Child-Pugh', category: 'plantao' },
  { id: 'cha2ds2-va', label: 'CHA₂DS₂-VA', category: 'ambulatorio' },
  { id: 'prevent', label: 'Risco CV (PREVENT)', category: 'ambulatorio' },
  { id: 'imc', label: 'IMC', category: 'ambulatorio' },
  { id: 'carga', label: 'Carga Tabágica', category: 'ambulatorio' },
  { id: 'pedz', label: 'Z-Escore Pediátrico', category: 'ambulatorio' },
  { id: 'ig', label: 'Idade Gestacional', category: 'ambulatorio' },
];

export default function Calculadoras() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('funcao-renal');
  const [categoryFilter, setCategoryFilter] = useState<'todas' | 'plantao' | 'ambulatorio'>('todas');

  useEffect(() => {
    const initialTab = (location.state as any)?.initialTab;
    if (initialTab && CALCULATOR_TABS.some((t) => t.id === initialTab)) {
      setActiveTab(initialTab);
      setCategoryFilter('todas');
    }
  }, [location.state]);

  const visibleTabs = CALCULATOR_TABS.filter((t) =>
    categoryFilter === 'todas' ? true : t.category === categoryFilter
  );

  const renderCalculator = () => {
    switch (activeTab) {
      case 'funcao-renal': return <FuncaoRenalCalculator />;
      case 'escores-gravidade': return <EscoresGravidadeCalculator />;
      case 'eletrolitos': return <EletrolitosGasometriaCalculator />;
      case 'guia-dva': return <GuiaDvaSedacaoCalculator />;
      case 'child-pugh': return <ChildPughCalculator />;
      case 'cha2ds2-va': return <Cha2ds2VaCalculator />;
      case 'prevent': return <PreventCalculator />;
      case 'pedz': return <PedzCalculator />;
      case 'imc': return <ImcCalculator />;
      case 'carga': return <CargaTabagicaCalculator />;
      case 'diurese': return <TaxaDiureseCalculator />;
      case 'ig': return <IdadeGestacionalCalculator />;
      default: return <FuncaoRenalCalculator />;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Calculadoras & Guias de Bolso</h1>
          <p className="text-slate-500 text-sm mt-1">
            Escores de gravidade, função renal para ajuste de dose, distúrbios hidroeletrolíticos e bombas de infusão (DVA/Sedação)
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          <button
            onClick={() => setCategoryFilter('todas')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              categoryFilter === 'todas'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todas ({CALCULATOR_TABS.length})
          </button>
          <button
            onClick={() => {
              setCategoryFilter('plantao');
              if (CALCULATOR_TABS.find((t) => t.id === activeTab)?.category !== 'plantao') {
                setActiveTab('funcao-renal');
              }
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              categoryFilter === 'plantao'
                ? 'bg-white text-teal-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Enfermaria & Plantão (6)
          </button>
          <button
            onClick={() => {
              setCategoryFilter('ambulatorio');
              if (CALCULATOR_TABS.find((t) => t.id === activeTab)?.category !== 'ambulatorio') {
                setActiveTab('cha2ds2-va');
              }
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              categoryFilter === 'ambulatorio'
                ? 'bg-white text-teal-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Ambulatório (6)
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 pb-3 border-b border-slate-200">
        {visibleTabs.map((tab) => (
          <TabButton
            key={tab.id}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            badge={tab.badge}
          >
            {tab.label}
          </TabButton>
        ))}
      </div>

      <div className="mt-4">
        <Suspense
          fallback={
            <div className="py-12 flex items-center justify-center text-slate-400 gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
              <span>Carregando calculadora...</span>
            </div>
          }
        >
          {renderCalculator()}
        </Suspense>
      </div>
    </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
  badge,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
        active
          ? 'bg-teal-600 text-white shadow-sm'
          : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:border-slate-300'
      }`}
    >
      <span>{children}</span>
      {badge && (
        <span
          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
            active ? 'bg-teal-800 text-teal-100' : 'bg-teal-50 text-teal-700'
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
