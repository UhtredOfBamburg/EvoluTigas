import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Button } from '@/components/ui';
import { Copy, Check, Syringe } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

interface DrugConfig {
  id: string;
  name: string;
  category: 'dva' | 'sedacao';
  presentation: string;
  dilutionRecipe: string;
  concentrationMcgPerMl: number; // or UI/mL or mg/mL
  unitType: 'mcg_kg_min' | 'mcg_kg_h' | 'ui_min' | 'mcg_min';
  unitLabel: string;
  minUsual: number;
  maxUsual: number;
  defaultMlH: number;
}

const DRUGS: DrugConfig[] = [
  {
    id: 'nora_padrao',
    name: 'Noradrenalina (Padrão 64 mcg/mL)',
    category: 'dva',
    presentation: 'Ampola 4 mg/4 mL (hemitartarato)',
    dilutionRecipe: '4 ampolas (16 mL = 16 mg) + 234 mL de SG 5% (Volume total = 250 mL → 64 mcg/mL)',
    concentrationMcgPerMl: 64,
    unitType: 'mcg_kg_min',
    unitLabel: 'mcg/kg/min',
    minUsual: 0.05,
    maxUsual: 2.0,
    defaultMlH: 10,
  },
  {
    id: 'nora_dobrada',
    name: 'Noradrenalina Concentrada (128 mcg/mL)',
    category: 'dva',
    presentation: 'Ampola 4 mg/4 mL',
    dilutionRecipe: '8 ampolas (32 mL = 32 mg) + 218 mL de SG 5% (Volume total = 250 mL → 128 mcg/mL)',
    concentrationMcgPerMl: 128,
    unitType: 'mcg_kg_min',
    unitLabel: 'mcg/kg/min',
    minUsual: 0.05,
    maxUsual: 2.0,
    defaultMlH: 8,
  },
  {
    id: 'dobutamina',
    name: 'Dobutamina (1.000 mcg/mL)',
    category: 'dva',
    presentation: 'Ampola 250 mg/20 mL',
    dilutionRecipe: '1 ampola (20 mL = 250 mg) + 230 mL de SF 0,9% ou SG 5% (Total = 250 mL → 1.000 mcg/mL)',
    concentrationMcgPerMl: 1000,
    unitType: 'mcg_kg_min',
    unitLabel: 'mcg/kg/min',
    minUsual: 2.5,
    maxUsual: 20.0,
    defaultMlH: 10,
  },
  {
    id: 'vasopressina',
    name: 'Vasopressina (0,2 UI/mL)',
    category: 'dva',
    presentation: 'Ampola 20 UI/1 mL',
    dilutionRecipe: '1 ampola (1 mL = 20 UI) + 99 mL de SF 0,9% ou SG 5% (Total = 100 mL → 0,2 UI/mL)',
    concentrationMcgPerMl: 0.2, // UI/mL
    unitType: 'ui_min',
    unitLabel: 'UI/min',
    minUsual: 0.01,
    maxUsual: 0.04,
    defaultMlH: 9,
  },
  {
    id: 'nipride',
    name: 'Nitroprussiato de Sódio — Nipride (200 mcg/mL)',
    category: 'dva',
    presentation: 'Ampola 50 mg/2 mL (Fotossensível)',
    dilutionRecipe: '1 ampola (2 mL = 50 mg) + 248 mL de SG 5% (Total = 250 mL → 200 mcg/mL)',
    concentrationMcgPerMl: 200,
    unitType: 'mcg_kg_min',
    unitLabel: 'mcg/kg/min',
    minUsual: 0.3,
    maxUsual: 10.0,
    defaultMlH: 10,
  },
  {
    id: 'tridil',
    name: 'Nitroglicerina — Tridil (200 mcg/mL)',
    category: 'dva',
    presentation: 'Ampola 50 mg/10 mL',
    dilutionRecipe: '1 ampola (10 mL = 50 mg) + 240 mL de SF 0,9% ou SG 5% em frasco ecoflac (200 mcg/mL)',
    concentrationMcgPerMl: 200,
    unitType: 'mcg_min',
    unitLabel: 'mcg/min',
    minUsual: 5,
    maxUsual: 200,
    defaultMlH: 6,
  },
  {
    id: 'fentanil',
    name: 'Fentanil Diluído (10 mcg/mL)',
    category: 'sedacao',
    presentation: 'Ampola 500 mcg/10 mL (50 mcg/mL)',
    dilutionRecipe: '2 ampolas (20 mL = 1.000 mcg) + 80 mL de SF 0,9% (Total = 100 mL → 10 mcg/mL)',
    concentrationMcgPerMl: 10,
    unitType: 'mcg_kg_h',
    unitLabel: 'mcg/kg/h',
    minUsual: 0.5,
    maxUsual: 5.0,
    defaultMlH: 10,
  },
  {
    id: 'midazolam',
    name: 'Midazolam — Dormonid (1 mg/mL)',
    category: 'sedacao',
    presentation: 'Ampola 50 mg/10 mL',
    dilutionRecipe: '2 ampolas (20 mL = 100 mg) + 80 mL de SF 0,9% (Total = 100 mL → 1.000 mcg/mL = 1 mg/mL)',
    concentrationMcgPerMl: 1000, // 1000 mcg/mL = 1 mg/mL
    unitType: 'mcg_kg_min',
    unitLabel: 'mcg/kg/min',
    minUsual: 0.5,
    maxUsual: 5.0,
    defaultMlH: 8,
  },
  {
    id: 'precedex',
    name: 'Dexmedetomidina — Precedex (4 mcg/mL)',
    category: 'sedacao',
    presentation: 'Ampola 200 mcg/2 mL',
    dilutionRecipe: '1 ampola (2 mL = 200 mcg) + 48 mL de SF 0,9% (Total = 50 mL → 4 mcg/mL)',
    concentrationMcgPerMl: 4,
    unitType: 'mcg_kg_h',
    unitLabel: 'mcg/kg/h',
    minUsual: 0.2,
    maxUsual: 1.4,
    defaultMlH: 10,
  },
];

export function GuiaDvaSedacaoCalculator() {
  const { toast } = useToast();
  const [peso, setPeso] = useState('70');
  const [filterCat, setFilterCat] = useState<'todas' | 'dva' | 'sedacao'>('todas');
  const [ratesMlH, setRatesMlH] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    DRUGS.forEach((d) => {
      init[d.id] = String(d.defaultMlH);
    });
    return init;
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const weightKg = Math.max(1, parseFloat(peso.replace(',', '.')) || 70);

  const calculateDose = (drug: DrugConfig, mlHStr: string) => {
    const mlH = Math.max(0, parseFloat(mlHStr.replace(',', '.')) || 0);
    if (drug.unitType === 'mcg_kg_min') {
      return (mlH * drug.concentrationMcgPerMl) / (weightKg * 60);
    }
    if (drug.unitType === 'mcg_kg_h') {
      return (mlH * drug.concentrationMcgPerMl) / weightKg;
    }
    if (drug.unitType === 'ui_min' || drug.unitType === 'mcg_min') {
      return (mlH * drug.concentrationMcgPerMl) / 60;
    }
    return 0;
  };

  const visibleDrugs = DRUGS.filter((d) => (filterCat === 'todas' ? true : d.category === filterCat));

  const handleCopyPrescription = (drug: DrugConfig, mlHStr: string, doseVal: number) => {
    const text = `${drug.name}: ${drug.dilutionRecipe} — Correr em BIC a ${mlHStr} mL/h (${doseVal.toFixed(2)} ${drug.unitLabel} para ${weightKg} kg).`;
    navigator.clipboard.writeText(text);
    setCopiedId(drug.id);
    setTimeout(() => setCopiedId(null), 1800);
    toast('Diluição e dose copiadas para a prescrição/evolução!', 'success');
  };

  return (
    <div className="space-y-5">
      {/* Top Weight Bar & Filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <Syringe className="w-5 h-5" />
          </div>
          <div>
            <Label className="text-xs font-bold text-slate-900">Peso do Paciente (kg)</Label>
            <p className="text-xs text-slate-500">
              Ajusta instantaneamente a conversão mL/h ↔ dose de todas as bombas abaixo
            </p>
          </div>
          <Input
            type="number"
            step="1"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
            className="w-24 h-10 font-mono tabular-nums text-base font-bold text-center border-teal-300"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-center">
          {[
            { id: 'todas', label: 'Todas (9)' },
            { id: 'dva', label: 'Drogas Vasoativas (6)' },
            { id: 'sedacao', label: 'Sedoanalgesia (3)' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterCat(tab.id as any)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                filterCat === tab.id
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Drug Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleDrugs.map((drug) => {
          const mlHStr = ratesMlH[drug.id] ?? String(drug.defaultMlH);
          const dose = calculateDose(drug, mlHStr);
          const isHigh = dose > drug.maxUsual;
          const isLow = dose > 0 && dose < drug.minUsual;

          return (
            <Card key={drug.id} className="border-slate-200 flex flex-col justify-between">
              <CardHeader className="pb-2.5 border-b border-slate-100">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-bold text-slate-900 leading-snug">
                    {drug.name}
                  </CardTitle>
                  <span className="text-[11px] font-medium text-slate-500 shrink-0">
                    {drug.category === 'dva' ? 'DVA' : 'Sedação'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{drug.presentation}</p>
              </CardHeader>

              <CardContent className="pt-3.5 space-y-3.5 flex-1 flex flex-col justify-between">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed">
                  <strong className="text-slate-900">Diluição:</strong> {drug.dilutionRecipe}
                </div>

                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-slate-600">
                        Vazão na BIC (mL/h)
                      </Label>
                      <Input
                        type="number"
                        step="0.5"
                        value={mlHStr}
                        onChange={(e) =>
                          setRatesMlH((prev) => ({ ...prev, [drug.id]: e.target.value }))
                        }
                        className="h-9 font-mono tabular-nums font-bold text-sm"
                      />
                    </div>

                    <div className="p-2 rounded-lg bg-teal-50/70 border border-teal-200 text-right">
                      <span className="block text-[10px] font-semibold text-teal-800">
                        Dose Calculada
                      </span>
                      <span className="text-lg font-bold font-mono tabular-nums text-teal-900">
                        {dose.toFixed(2)}
                      </span>{' '}
                      <span className="text-[11px] text-teal-700">{drug.unitLabel}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Faixa usual: {drug.minUsual} a {drug.maxUsual} {drug.unitLabel}
                    </span>
                    {isHigh && (
                      <span className="text-red-600 font-semibold">Acima da faixa usual</span>
                    )}
                    {isLow && (
                      <span className="text-amber-600 font-semibold">Dose submínima</span>
                    )}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyPrescription(drug, mlHStr, dose)}
                  className="w-full h-8 text-xs"
                >
                  {copiedId === drug.id ? (
                    <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {copiedId === drug.id ? 'Copiado!' : 'Copiar Diluição + Dose'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
