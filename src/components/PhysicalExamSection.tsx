import React from 'react';
import { Button, Input, Label } from '@/components/ui';
import { SelectField, ToggleButtons, MultiSelectButtons } from '@/components/FormControls';
import { Stethoscope } from 'lucide-react';

export interface PhysicalExamData {
  paSist: string;
  paDiast: string;
  fc: string;
  fr: string;
  temp: string;
  peso: string;
  altura: string;
  imc?: string;
  spo2: string;
  ssvvO2: string;
  ssvvO2Fluxo: string;

  geralNormal: boolean;
  geralEstado: string;
  geralNivel: string;
  geralNutricao: string;
  geralHidratacao: string;
  geralColoracao: string;
  geralIctericia: string;
  geralCianose: string;
  geralTemp: string;
  geralTec: string;
  geralObs: string;

  acvNormal: boolean;
  acvRitmo: string;
  acvTempos: string;
  acvBulhas: string;
  acvSopro: string;
  acvObs: string;
  acvSoproFoco: string[];
  acvSoproFase: string[];
  acvSoproIntensidade: string;
  acvSoproIrradiacao: string;
  acvSoproObs: string;

  arNormal: boolean;
  arMurmurio: string;
  arRuidos: string;
  arEsforco: string;
  arTiragem: string;
  arMusculatura: string;
  arObs: string;
  arRuidosList: string[];
  arRuidosLocal: string[];
  arRuidosObs: string;
  arDetalhado: boolean;
  arExpansibilidade: string[];
  arPercussao: string[];
  arFremito: string[];
  arDetalhadoObs: string;

  abdNormal: boolean;
  abdForma: string;
  abdConsistencia: string;
  abdRha: string;
  abdDor: string;
  abdDorTipo: string;
  abdDorLocal: string[];
  abdVisceromegalias: string;
  abdDescompressao: string;
  abdMurphy: string;
  abdGiordano: string;
  abdTraube: string;
  abdObs: string;

  mmiiNormal: boolean;
  mmiiPerfusao: string;
  mmiiEdema: string;
  mmiiEdemaGrau: string;
  mmiiEdemaLocal: string;
  mmiiPanturrilhas: string;
  mmiiPulsos: string;
  mmiiObs: string;

  neuroNormal: boolean;
  neuroAvaliacao: string;
  neuroGlasgowO: string;
  neuroGlasgowV: string;
  neuroGlasgowM: string;
  neuroGlasgowP: string;
  neuroPupilas: string;
  neuroFmMSD: string;
  neuroFmMSE: string;
  neuroFmMID: string;
  neuroFmMIE: string;
  neuroBabinski: string;
  neuroMarcha: string;
  neuroObs: string;
}

export const DEFAULT_PHYSICAL_EXAM_DATA: PhysicalExamData = {
  paSist: '120',
  paDiast: '80',
  fc: '72',
  fr: '16',
  temp: '36.5',
  peso: '70.0',
  altura: '170',
  imc: '--.-',
  spo2: '98',
  ssvvO2: 'AA',
  ssvvO2Fluxo: '',

  geralNormal: true,
  geralEstado: 'BEG',
  geralNivel: 'LOTE',
  geralNutricao: 'Eutrófico',
  geralHidratacao: 'Hidratado',
  geralColoracao: 'Corado',
  geralIctericia: 'Anictérico',
  geralCianose: 'Acianótico',
  geralTemp: 'Afebril',
  geralTec: '< 2s',
  geralObs: '',

  acvNormal: true,
  acvRitmo: 'RCR',
  acvTempos: '2T',
  acvBulhas: 'BNF',
  acvSopro: 'Ausente',
  acvObs: '',
  acvSoproFoco: [],
  acvSoproFase: [],
  acvSoproIntensidade: '',
  acvSoproIrradiacao: '',
  acvSoproObs: '',

  arNormal: true,
  arMurmurio: 'Presente bilateral',
  arRuidos: 'Sem RA',
  arEsforco: 'Sem sinais',
  arTiragem: '',
  arMusculatura: '',
  arObs: '',
  arRuidosList: ['Sem RA'],
  arRuidosLocal: [],
  arRuidosObs: '',
  arDetalhado: false,
  arExpansibilidade: ['Preservada'],
  arPercussao: ['Som claro pulmonar'],
  arFremito: ['Preservado'],
  arDetalhadoObs: '',

  abdNormal: true,
  abdForma: 'Plano',
  abdConsistencia: 'Flácido',
  abdRha: 'Presentes (RHA+)',
  abdDor: 'Indolor',
  abdDorTipo: '',
  abdDorLocal: [],
  abdVisceromegalias: 'Sem VMG',
  abdDescompressao: 'Negativa',
  abdMurphy: 'Negativo',
  abdGiordano: 'Negativo bilateral',
  abdTraube: 'Livre',
  abdObs: '',

  mmiiNormal: true,
  mmiiPerfusao: 'Bem perfundidos',
  mmiiEdema: 'Sem edema',
  mmiiEdemaGrau: '',
  mmiiEdemaLocal: '',
  mmiiPanturrilhas: 'Livres',
  mmiiPulsos: 'Presentes e simétricos',
  mmiiObs: '',

  neuroNormal: true,
  neuroAvaliacao: 'Sem déficits focais',
  neuroGlasgowO: '4 — Espontânea',
  neuroGlasgowV: '5 — Orientada',
  neuroGlasgowM: '6 — Obedece comandos',
  neuroGlasgowP: 'Bilateral reativa (-0)',
  neuroPupilas: 'PIFR',
  neuroFmMSD: '5',
  neuroFmMSE: '5',
  neuroFmMID: '5',
  neuroFmMIE: '5',
  neuroBabinski: 'Negativo bilateral',
  neuroMarcha: 'Normal',
  neuroObs: '',
};

export function computeImcFromWeightHeight(pesoRaw: string | number, alturaRaw: string | number): string {
  const p = parseFloat(String(pesoRaw || '').replace(',', '.'));
  let a = parseFloat(String(alturaRaw || '').replace(',', '.'));
  if (!p || !a || p <= 0 || a <= 0) return '--.-';
  if (a > 3) a = a / 100;
  const val = p / (a * a);
  return isFinite(val) && val > 0 ? val.toFixed(1) : '--.-';
}

export function formatPhysicalExamInstant(d: Partial<PhysicalExamData>): string {
  const imcComputed = computeImcFromWeightHeight(d.peso || '', d.altura || '');
  const imcStr = imcComputed !== '--.-' ? imcComputed.replace('.', ',') : '';

  const ssvvParts = [
    d.paSist && d.paDiast ? `PA: ${d.paSist}x${d.paDiast} mmHg` : '',
    d.fc ? `FC: ${d.fc} bpm` : '',
    d.fr ? `FR: ${d.fr} irpm` : '',
    d.temp ? `Tax: ${d.temp} °C` : '',
    d.spo2
      ? `SpO₂: ${d.spo2}% (${d.ssvvO2 || 'AA'}${d.ssvvO2 && d.ssvvO2 !== 'AA' && d.ssvvO2Fluxo ? ` ${d.ssvvO2Fluxo}` : ''})`
      : '',
    d.peso ? `Peso: ${d.peso} kg` : '',
    d.altura ? `Alt: ${d.altura} cm` : '',
    imcStr ? `IMC: ${imcStr} kg/m²` : '',
  ]
    .filter(Boolean)
    .join(' | ');

  const geral = d.geralNormal
    ? `BEG, LOTE, eutrófico, normocorado, hidratado, acianótico, anictérico, afebril ao toque, TEC < 2s.${d.geralObs ? ` ${d.geralObs}` : ''}`
    : `${[
        d.geralEstado,
        d.geralNivel,
        d.geralNutricao,
        d.geralHidratacao,
        d.geralColoracao,
        d.geralIctericia,
        d.geralCianose,
        d.geralTemp,
        d.geralTec ? `TEC ${d.geralTec}` : '',
        d.geralObs,
      ]
        .filter(Boolean)
        .join(', ')}.`;

  const acv = d.acvNormal
    ? `RCR em 2T, BNF, sem sopros audíveis.${d.acvObs ? ` ${d.acvObs}` : ''}`
    : `${[
        d.acvRitmo,
        d.acvTempos,
        `bulhas ${d.acvBulhas}`,
        d.acvSopro === 'Presente'
          ? `sopro ${[
              ...(d.acvSoproFase || []),
              d.acvSoproIntensidade,
              ...(d.acvSoproFoco || []),
              d.acvSoproIrradiacao ? `irradiando para ${d.acvSoproIrradiacao}` : '',
            ]
              .filter(Boolean)
              .join(' ')}`
          : 'sem sopros',
        d.acvObs,
      ]
        .filter(Boolean)
        .join(', ')}.`;

  const ar = d.arNormal
    ? `MV presente bilateralmente e simétrico, sem ruídos adventícios, eupneico em ar ambiente, sem sinais de desconforto respiratório.${d.arObs ? ` ${d.arObs}` : ''}`
    : `MV ${d.arMurmurio || 'presente bilateral'}, ${
        Array.isArray(d.arRuidosList) && d.arRuidosList.length && !d.arRuidosList.includes('Sem RA')
          ? `presença de ${d.arRuidosList.join(', ')}${
              Array.isArray(d.arRuidosLocal) && d.arRuidosLocal.length ? ` em ${d.arRuidosLocal.join(', ')}` : ''
            }`
          : 'sem ruídos adventícios'
      }, ${d.arEsforco || 'sem sinais de esforço'}.${d.arObs ? ` ${d.arObs}` : ''}`;

  const abd = d.abdNormal
    ? `Plano, flácido, RHA+, indolor à palpação superficial e profunda, sem visceromegalias, descompressão brusca negativa, Murphy e Giordano negativos.${d.abdObs ? ` ${d.abdObs}` : ''}`
    : `${[
        d.abdForma,
        d.abdConsistencia,
        `RHA ${d.abdRha}`,
        d.abdDor === 'Doloroso'
          ? `doloroso ${[
              d.abdDorTipo ? `à palpação ${d.abdDorTipo.toLowerCase()}` : '',
              Array.isArray(d.abdDorLocal) && d.abdDorLocal.length ? `em ${d.abdDorLocal.join(', ')}` : '',
            ]
              .filter(Boolean)
              .join(' ')}`
          : 'indolor à palpação',
        d.abdVisceromegalias,
        `DB ${d.abdDescompressao}`,
        `Murphy ${d.abdMurphy}`,
        `Giordano ${d.abdGiordano}`,
        d.abdObs,
      ]
        .filter(Boolean)
        .join(', ')}.`;

  const mmii = d.mmiiNormal
    ? `Extremidades bem perfundidas e aquecidas, sem edemas, panturrilhas livres e indolores, pulsos periféricos presentes e simétricos.${d.mmiiObs ? ` ${d.mmiiObs}` : ''}`
    : `${[
        d.mmiiPerfusao,
        d.mmiiEdema === 'Presente'
          ? `edema ${[d.mmiiEdemaGrau, d.mmiiEdemaLocal].filter(Boolean).join(' ')}`
          : 'sem edema',
        `panturrilhas ${d.mmiiPanturrilhas}`,
        `pulsos ${d.mmiiPulsos}`,
        d.mmiiObs,
      ]
        .filter(Boolean)
        .join(', ')}.`;

  const neuro = d.neuroNormal
    ? `Lúcido e orientado no tempo e espaço (Glasgow 15), pupilas isocóricas e fotorreagentes, força muscular grau V global, sem déficits focais.${d.neuroObs ? ` ${d.neuroObs}` : ''}`
    : `Glasgow (O: ${d.neuroGlasgowO}, V: ${d.neuroGlasgowV}, M: ${d.neuroGlasgowM}), pupilas ${d.neuroPupilas}, FM (MSD ${d.neuroFmMSD}/5, MSE ${d.neuroFmMSE}/5, MID ${d.neuroFmMID}/5, MIE ${d.neuroFmMIE}/5), Babinski ${d.neuroBabinski}, marcha ${d.neuroMarcha}.${d.neuroObs ? ` ${d.neuroObs}` : ''}`;

  return [
    `SSVV: ${ssvvParts}`,
    `- Geral: ${geral}`,
    `- ACV: ${acv}`,
    `- AR: ${ar}`,
    `- Abdome: ${abd}`,
    `- MMII: ${mmii}`,
    `- Neurológico: ${neuro}`,
  ].join('\n');
}

interface PhysicalExamSectionProps {
  data: PhysicalExamData;
  onChange: (field: string, value: any) => void;
  showSsvvCard?: boolean;
}

export function PhysicalExamSection({ data, onChange, showSsvvCard = true }: PhysicalExamSectionProps) {
  const imcValue = computeImcFromWeightHeight(data.peso, data.altura);

  return (
    <div className="space-y-4">
      {showSsvvCard && (
        <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h4 className="font-semibold text-teal-800 text-sm flex items-center gap-2">
              <Stethoscope className="w-4 h-4" /> SSVV — Sinais Vitais
            </h4>
            <span className="text-xs text-slate-500">
              IMC calculado: <strong>{imcValue} kg/m²</strong>
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Label className="text-xs">PA Sist:</Label>
              <Input
                className="w-14 h-7 text-xs px-1"
                value={data.paSist}
                onChange={(e) => onChange('paSist', e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1">
              <Label className="text-xs">Diast:</Label>
              <Input
                className="w-14 h-7 text-xs px-1"
                value={data.paDiast}
                onChange={(e) => onChange('paDiast', e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1">
              <Label className="text-xs">FC:</Label>
              <Input
                className="w-12 h-7 text-xs px-1"
                value={data.fc}
                onChange={(e) => onChange('fc', e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1">
              <Label className="text-xs">FR:</Label>
              <Input
                className="w-12 h-7 text-xs px-1"
                value={data.fr}
                onChange={(e) => onChange('fr', e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1">
              <Label className="text-xs">Temp:</Label>
              <Input
                className="w-12 h-7 text-xs px-1"
                value={data.temp}
                onChange={(e) => onChange('temp', e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1">
              <Label className="text-xs">SpO₂:</Label>
              <Input
                className="w-12 h-7 text-xs px-1"
                value={data.spo2}
                onChange={(e) => onChange('spo2', e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1">
              <Label className="text-xs">Peso(kg):</Label>
              <Input
                className="w-14 h-7 text-xs px-1"
                value={data.peso}
                onChange={(e) => onChange('peso', e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1">
              <Label className="text-xs">Alt(cm):</Label>
              <Input
                className="w-14 h-7 text-xs px-1"
                value={data.altura}
                onChange={(e) => onChange('altura', e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 items-end">
            <SelectField
              label="Suporte O₂"
              value={data.ssvvO2}
              onChange={(v: string) => onChange('ssvvO2', v)}
              options={['AA', 'CN', 'Cateter de O2', 'Máscara', 'Masc. Venturi', 'VNI', 'VM', 'VMI']}
              className="w-1/2"
            />
            {data.ssvvO2 !== 'AA' && (
              <div className="space-y-1.5 w-1/2">
                <Label className="text-xs text-slate-500">Fluxo / FiO₂</Label>
                <Input
                  className="h-8 text-xs"
                  value={data.ssvvO2Fluxo || ''}
                  onChange={(e) => onChange('ssvvO2Fluxo', e.target.value)}
                  placeholder="Ex: 2L/min"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Geral */}
      <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-teal-800">Geral</h4>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer bg-white px-2 py-1 rounded shadow-sm border border-slate-200">
            <input
              type="checkbox"
              checked={data.geralNormal}
              onChange={(e) => onChange('geralNormal', e.target.checked)}
              className="rounded text-teal-600 focus:ring-teal-500"
            />
            Tudo normal
          </label>
        </div>
        {!data.geralNormal && (
          <div className="grid grid-cols-3 gap-3">
            <SelectField
              label="Estado geral"
              value={data.geralEstado}
              onChange={(v: string) => onChange('geralEstado', v)}
              options={['BEG', 'REG', 'MEG']}
            />
            <SelectField
              label="Nível consciência"
              value={data.geralNivel}
              onChange={(v: string) => onChange('geralNivel', v)}
              options={['LOTE', 'Sonolento', 'Torporoso', 'Comatoso']}
            />
            <SelectField
              label="Estado nutricional"
              value={data.geralNutricao}
              onChange={(v: string) => onChange('geralNutricao', v)}
              options={['Eutrófico', 'Emagrecido', 'Sobrepeso', 'Obeso', 'Caquético']}
            />
            <SelectField
              label="Hidratação"
              value={data.geralHidratacao}
              onChange={(v: string) => onChange('geralHidratacao', v)}
              options={['Hidratado', 'Desidratado 1+/4+', 'Desidratado 2+/4+', 'Desidratado 3+/4+', 'Desidratado 4+/4+']}
            />
            <SelectField
              label="Coloração"
              value={data.geralColoracao}
              onChange={(v: string) => onChange('geralColoracao', v)}
              options={['Corado', 'Hipocorado 1+/4+', 'Hipocorado 2+/4+', 'Hipocorado 3+/4+', 'Hipocorado 4+/4+']}
            />
            <SelectField
              label="Icterícia"
              value={data.geralIctericia}
              onChange={(v: string) => onChange('geralIctericia', v)}
              options={['Anictérico', 'Ictérico']}
            />
            <SelectField
              label="Cianose"
              value={data.geralCianose}
              onChange={(v: string) => onChange('geralCianose', v)}
              options={['Acianótico', 'Cianótico']}
            />
            <SelectField
              label="Temperatura"
              value={data.geralTemp}
              onChange={(v: string) => onChange('geralTemp', v)}
              options={['Afebril', 'Febril']}
            />
            <SelectField
              label="TEC"
              value={data.geralTec}
              onChange={(v: string) => onChange('geralTec', v)}
              options={['< 2s', '2-3s', '3-5s', '> 5s']}
            />
          </div>
        )}
        <Input
          placeholder="Observações gerais..."
          className="h-8 text-xs"
          value={data.geralObs}
          onChange={(e) => onChange('geralObs', e.target.value)}
        />
      </div>

      {/* ACV */}
      <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-teal-800">Aparelho Cardiovascular</h4>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer bg-white px-2 py-1 rounded shadow-sm border border-slate-200">
            <input
              type="checkbox"
              checked={data.acvNormal}
              onChange={(e) => onChange('acvNormal', e.target.checked)}
              className="rounded text-teal-600 focus:ring-teal-500"
            />
            Tudo normal
          </label>
        </div>
        {!data.acvNormal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SelectField
                label="Ritmo"
                value={data.acvRitmo}
                onChange={(v: string) => onChange('acvRitmo', v)}
                options={['RCR', 'RCI']}
              />
              <SelectField
                label="Tempos"
                value={data.acvTempos}
                onChange={(v: string) => onChange('acvTempos', v)}
                options={['2T', '3T (B3)', '3T (B4)']}
              />
              <SelectField
                label="Bulhas"
                value={data.acvBulhas}
                onChange={(v: string) => onChange('acvBulhas', v)}
                options={['BNF', 'Hipofonéticas', 'Hiperfonéticas']}
              />
              <SelectField
                label="Sopro"
                value={data.acvSopro}
                onChange={(v: string) => onChange('acvSopro', v)}
                options={['Ausente', 'Presente']}
              />
            </div>

            {data.acvSopro === 'Presente' && (
              <div className="pl-3 border-l-2 border-red-200 space-y-3">
                <div>
                  <Label className="text-xs text-slate-500 mb-1.5 block">Foco</Label>
                  <MultiSelectButtons
                    options={['Aórtico', 'Pulmonar', 'Tricúspide', 'Mitral']}
                    value={data.acvSoproFoco}
                    onChange={(v: string[]) => onChange('acvSoproFoco', v)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-500 mb-1.5 block">Fase</Label>
                  <MultiSelectButtons
                    options={['Sistólico', 'Diastólico']}
                    value={data.acvSoproFase}
                    onChange={(v: string[]) => onChange('acvSoproFase', v)}
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-500 mb-1.5 block">Intensidade</Label>
                  <ToggleButtons
                    options={['1+/6+', '2+/6+', '3+/6+', '4+/6+', '5+/6+', '6+/6+']}
                    value={data.acvSoproIntensidade}
                    onChange={(v: string) => onChange('acvSoproIntensidade', v)}
                  />
                </div>
                <Input
                  placeholder="Irradiação..."
                  className="h-8 text-xs"
                  value={data.acvSoproIrradiacao}
                  onChange={(e) => onChange('acvSoproIrradiacao', e.target.value)}
                />
              </div>
            )}
          </div>
        )}
        <Input
          placeholder="Observações cardiovasculares..."
          className="h-8 text-xs"
          value={data.acvObs}
          onChange={(e) => onChange('acvObs', e.target.value)}
        />
      </div>

      {/* AR */}
      <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-teal-800">Aparelho Respiratório</h4>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer bg-white px-2 py-1 rounded shadow-sm border border-slate-200">
            <input
              type="checkbox"
              checked={data.arNormal}
              onChange={(e) => onChange('arNormal', e.target.checked)}
              className="rounded text-teal-600 focus:ring-teal-500"
            />
            Tudo normal
          </label>
        </div>
        {!data.arNormal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <SelectField
                label="Murmúrio vesicular"
                value={data.arMurmurio}
                onChange={(v: string) => onChange('arMurmurio', v)}
                options={[
                  'Presente bilateral',
                  'Reduzido globalmente',
                  'Reduzido D',
                  'Reduzido E',
                  'Abolido D',
                  'Abolido E',
                ]}
              />
              <SelectField
                label="Esforço respiratório"
                value={data.arEsforco}
                onChange={(v: string) => onChange('arEsforco', v)}
                options={['Sem sinais', 'Tiragem', 'Musculatura acessória']}
              />
            </div>

            <div className="pl-3 border-l-2 border-slate-200 space-y-3">
              <div>
                <Label className="text-xs text-slate-500 mb-1.5 block">Ruídos adventícios</Label>
                <MultiSelectButtons
                  options={['Sem RA', 'Roncos', 'Sibilos', 'Crepitantes', 'Bolhosos']}
                  value={data.arRuidosList}
                  onChange={(v: string[]) => onChange('arRuidosList', v)}
                  exclusiveOption="Sem RA"
                />
              </div>
              {!data.arRuidosList.includes('Sem RA') && data.arRuidosList.length > 0 && (
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">Localização</Label>
                    <MultiSelectButtons
                      options={['Ápice E', 'Ápice D', 'Base E', 'Base D', 'Hemitórax E', 'Hemitórax D', 'Difuso']}
                      value={data.arRuidosLocal}
                      onChange={(v: string[]) => onChange('arRuidosLocal', v)}
                    />
                  </div>
                  <Input
                    placeholder="Observações adicionais sobre os RA..."
                    className="h-8 text-xs"
                    value={data.arRuidosObs}
                    onChange={(e) => onChange('arRuidosObs', e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200 mt-2">
              <button
                type="button"
                className="text-xs text-teal-700 font-medium hover:underline flex items-center gap-1 mb-2"
                onClick={() => onChange('arDetalhado', !data.arDetalhado)}
              >
                {data.arDetalhado ? 'Ocultar exame detalhado' : 'Mostrar exame detalhado'}
              </button>

              {data.arDetalhado && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">Expansibilidade torácica</Label>
                    <MultiSelectButtons
                      options={[
                        'Preservada',
                        'Reduzida difusamente',
                        'Reduzida à direita (D)',
                        'Reduzida à esquerda (E)',
                        'Reduzida em ápice D',
                        'Reduzida em ápice E',
                        'Reduzida em base D',
                        'Reduzida em base E',
                      ]}
                      value={data.arExpansibilidade}
                      onChange={(v: string[]) => onChange('arExpansibilidade', v)}
                      exclusiveOption="Preservada"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">Percussão pulmonar</Label>
                    <MultiSelectButtons
                      options={['Som claro pulmonar', 'Macicez', 'Submacicez', 'Hipertimpanismo']}
                      value={data.arPercussao}
                      onChange={(v: string[]) => onChange('arPercussao', v)}
                      exclusiveOption="Som claro pulmonar"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">Frêmito toracovocal</Label>
                    <MultiSelectButtons
                      options={['Preservado', 'Reduzido D', 'Reduzido E', 'Aumentado D', 'Aumentado E', 'Abolido D', 'Abolido E']}
                      value={data.arFremito}
                      onChange={(v: string[]) => onChange('arFremito', v)}
                      exclusiveOption="Preservado"
                    />
                  </div>
                  <Input
                    placeholder="Observações respiratórias detalhadas..."
                    className="h-8 text-xs"
                    value={data.arDetalhadoObs}
                    onChange={(e) => onChange('arDetalhadoObs', e.target.value)}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        <Input
          placeholder="Observações respiratórias..."
          className="h-8 text-xs"
          value={data.arObs}
          onChange={(e) => onChange('arObs', e.target.value)}
        />
      </div>

      {/* Abdome */}
      <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-teal-800">Abdome</h4>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer bg-white px-2 py-1 rounded shadow-sm border border-slate-200">
            <input
              type="checkbox"
              checked={data.abdNormal}
              onChange={(e) => onChange('abdNormal', e.target.checked)}
              className="rounded text-teal-600 focus:ring-teal-500"
            />
            Tudo normal
          </label>
        </div>
        {!data.abdNormal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <SelectField
                label="Forma"
                value={data.abdForma}
                onChange={(v: string) => onChange('abdForma', v)}
                options={['Plano', 'Globoso', 'Escavado', 'Distendido']}
              />
              <SelectField
                label="Consistência"
                value={data.abdConsistencia}
                onChange={(v: string) => onChange('abdConsistencia', v)}
                options={['Flácido', 'Tenso', 'Em tábua']}
              />
              <SelectField
                label="RHA"
                value={data.abdRha}
                onChange={(v: string) => onChange('abdRha', v)}
                options={['Presentes (RHA+)', 'Aumentados', 'Diminuídos', 'Ausentes']}
              />
              <SelectField
                label="Visceromegalias"
                value={data.abdVisceromegalias}
                onChange={(v: string) => onChange('abdVisceromegalias', v)}
                options={['Sem VMG', 'Hepatomegalia', 'Esplenomegalia']}
              />
              <SelectField
                label="Descompressão brusca"
                value={data.abdDescompressao}
                onChange={(v: string) => onChange('abdDescompressao', v)}
                options={['Negativa', 'Positiva']}
              />
              <SelectField
                label="Murphy"
                value={data.abdMurphy}
                onChange={(v: string) => onChange('abdMurphy', v)}
                options={['Negativo', 'Positivo']}
              />
              <SelectField
                label="Giordano"
                value={data.abdGiordano}
                onChange={(v: string) => onChange('abdGiordano', v)}
                options={['Negativo bilateral', 'Positivo D', 'Positivo E', 'Positivo bilateral']}
              />
              <SelectField
                label="Traube"
                value={data.abdTraube}
                onChange={(v: string) => onChange('abdTraube', v)}
                options={['Livre', 'Maciço', 'Não avaliado']}
              />
            </div>

            <div className="pt-2 border-t border-slate-200">
              <Label className="text-xs text-slate-500 mb-1.5 block">Dor à palpação</Label>
              <ToggleButtons
                options={['Indolor', 'Doloroso']}
                value={data.abdDor}
                onChange={(v: string) => onChange('abdDor', v)}
              />
              {data.abdDor === 'Doloroso' && (
                <div className="pl-3 border-l-2 border-slate-200 space-y-3 mt-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-500 w-16">Tipo</Label>
                    <ToggleButtons
                      options={['Superficial', 'Profunda', 'Ambas']}
                      value={data.abdDorTipo}
                      onChange={(v: string) => onChange('abdDorTipo', v)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-500 block">Localização</Label>
                    <MultiSelectButtons
                      options={['HCD', 'Epigástrio', 'HCE', 'FD', 'Mesogástrio', 'FE', 'FID', 'Hipogástrio', 'FIE', 'Difusa']}
                      value={data.abdDorLocal}
                      onChange={(v: string[]) => onChange('abdDorLocal', v)}
                      exclusiveOption="Difusa"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        <Input
          placeholder="Observações abdome..."
          className="h-8 text-xs"
          value={data.abdObs}
          onChange={(e) => onChange('abdObs', e.target.value)}
        />
      </div>

      {/* MMII */}
      <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-teal-800">Membros Inferiores</h4>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer bg-white px-2 py-1 rounded shadow-sm border border-slate-200">
            <input
              type="checkbox"
              checked={data.mmiiNormal}
              onChange={(e) => onChange('mmiiNormal', e.target.checked)}
              className="rounded text-teal-600 focus:ring-teal-500"
            />
            Tudo normal
          </label>
        </div>
        {!data.mmiiNormal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Perfusão"
                value={data.mmiiPerfusao}
                onChange={(v: string) => onChange('mmiiPerfusao', v)}
                options={['Bem perfundidos', 'Mal perfundidos']}
              />
              <SelectField
                label="Panturrilhas"
                value={data.mmiiPanturrilhas}
                onChange={(v: string) => onChange('mmiiPanturrilhas', v)}
                options={['Livres', 'Empastadas', 'Dolorosas']}
              />
              <SelectField
                label="Pulsos periféricos"
                value={data.mmiiPulsos}
                onChange={(v: string) => onChange('mmiiPulsos', v)}
                options={['Presentes e simétricos', 'Diminuídos', 'Ausentes']}
              />
            </div>
            <div className="pt-2 border-t border-slate-200">
              <Label className="text-xs text-slate-500 mb-1.5 block">Edema</Label>
              <ToggleButtons
                options={['Sem edema', 'Presente']}
                value={data.mmiiEdema}
                onChange={(v: string) => onChange('mmiiEdema', v)}
              />
              {data.mmiiEdema === 'Presente' && (
                <div className="pl-3 border-l-2 border-slate-200 space-y-3 mt-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-500 w-16">Grau</Label>
                    <ToggleButtons
                      options={['1+/4+', '2+/4+', '3+/4+', '4+/4+']}
                      value={data.mmiiEdemaGrau}
                      onChange={(v: string) => onChange('mmiiEdemaGrau', v)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-slate-500 w-16">Local</Label>
                    <ToggleButtons
                      options={['MID', 'MIE', 'Bilateral']}
                      value={data.mmiiEdemaLocal}
                      onChange={(v: string) => onChange('mmiiEdemaLocal', v)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        <Input
          placeholder="Observações MMII..."
          className="h-8 text-xs"
          value={data.mmiiObs}
          onChange={(e) => onChange('mmiiObs', e.target.value)}
        />
      </div>

      {/* Neurológico */}
      <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-teal-800">Neurológico</h4>
          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer bg-white px-2 py-1 rounded shadow-sm border border-slate-200">
            <input
              type="checkbox"
              checked={data.neuroNormal}
              onChange={(e) => onChange('neuroNormal', e.target.checked)}
              className="rounded text-teal-600 focus:ring-teal-500"
            />
            Tudo normal
          </label>
        </div>
        {!data.neuroNormal && (
          <div className="grid grid-cols-1 gap-3">
            <SelectField
              label="Avaliação"
              value={data.neuroAvaliacao}
              onChange={(v: string) => onChange('neuroAvaliacao', v)}
              options={['Sem déficits focais', 'Alterado']}
            />
            {data.neuroAvaliacao === 'Alterado' && (
              <div className="space-y-4 pt-2 border-t border-slate-200 mt-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-semibold text-slate-700">Escala de Glasgow-P</h5>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2"
                    onClick={() => {
                      onChange('neuroGlasgowO', '4 — Espontânea');
                      onChange('neuroGlasgowV', '5 — Orientada');
                      onChange('neuroGlasgowM', '6 — Obedece comandos');
                      onChange('neuroGlasgowP', 'Bilateral reativa (-0)');
                    }}
                  >
                    Resetar
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Abertura Ocular (O)"
                    value={data.neuroGlasgowO}
                    onChange={(v: string) => onChange('neuroGlasgowO', v)}
                    options={['4 — Espontânea', '3 — Ao comando', '2 — À dor', '1 — Ausente']}
                  />
                  <SelectField
                    label="Resposta Verbal (V)"
                    value={data.neuroGlasgowV}
                    onChange={(v: string) => onChange('neuroGlasgowV', v)}
                    options={[
                      '5 — Orientada',
                      '4 — Confusa',
                      '3 — Palavras inapropriadas',
                      '2 — Sons incompreensíveis',
                      '1 — Ausente',
                    ]}
                  />
                  <SelectField
                    label="Resposta Motora (M)"
                    value={data.neuroGlasgowM}
                    onChange={(v: string) => onChange('neuroGlasgowM', v)}
                    options={[
                      '6 — Obedece comandos',
                      '5 — Localiza dor',
                      '4 — Retirada à dor',
                      '3 — Flexão anormal',
                      '2 — Extensão anormal',
                      '1 — Ausente',
                    ]}
                  />
                  <SelectField
                    label="Resposta Pupilar (P)"
                    value={data.neuroGlasgowP}
                    onChange={(v: string) => onChange('neuroGlasgowP', v)}
                    options={['Bilateral reativa (-0)', 'Unilateral reativa (-1)', 'Nenhuma reativa (-2)']}
                  />
                </div>

                <div className="pt-2 border-t border-slate-200 mt-2 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField
                      label="Pupilas"
                      value={data.neuroPupilas}
                      onChange={(v: string) => onChange('neuroPupilas', v)}
                      options={['PIFR', 'Anisocoria', 'Midríase', 'Miose']}
                    />
                    <SelectField
                      label="Babinski"
                      value={data.neuroBabinski}
                      onChange={(v: string) => onChange('neuroBabinski', v)}
                      options={['Negativo bilateral', 'Positivo D', 'Positivo E']}
                    />
                    <SelectField
                      label="Marcha"
                      value={data.neuroMarcha}
                      onChange={(v: string) => onChange('neuroMarcha', v)}
                      options={['Normal', 'Alterada', 'Não avaliada']}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1.5 block">Força muscular (0-5)</Label>
                    <div className="grid grid-cols-4 gap-2">
                      <div className="flex items-center gap-1">
                        <Label className="text-[10px]">MSD:</Label>
                        <Input
                          className="h-7 text-xs px-1"
                          value={data.neuroFmMSD}
                          onChange={(e) => onChange('neuroFmMSD', e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Label className="text-[10px]">MSE:</Label>
                        <Input
                          className="h-7 text-xs px-1"
                          value={data.neuroFmMSE}
                          onChange={(e) => onChange('neuroFmMSE', e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Label className="text-[10px]">MID:</Label>
                        <Input
                          className="h-7 text-xs px-1"
                          value={data.neuroFmMID}
                          onChange={(e) => onChange('neuroFmMID', e.target.value)}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Label className="text-[10px]">MIE:</Label>
                        <Input
                          className="h-7 text-xs px-1"
                          value={data.neuroFmMIE}
                          onChange={(e) => onChange('neuroFmMIE', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <Input
          placeholder="Observações neurológicas..."
          className="h-8 text-xs"
          value={data.neuroObs}
          onChange={(e) => onChange('neuroObs', e.target.value)}
        />
      </div>
    </div>
  );
}
