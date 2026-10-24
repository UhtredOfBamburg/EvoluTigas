import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Button } from '@/components/ui';
import { Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

export function EletrolitosGasometriaCalculator() {
  const { toast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 1. Sódio Corrigido pela Glicemia
  const [naMedido, setNaMedido] = useState('130');
  const [glicemia, setGlicemia] = useState('450');

  const naResult = useMemo(() => {
    const na = parseFloat(naMedido.replace(',', '.'));
    const glic = parseFloat(glicemia.replace(',', '.'));
    if (!na || isNaN(glic)) return null;
    const deltaGlic = Math.max(0, (glic - 100) / 100);
    const katz = na + 1.6 * deltaGlic;
    const hillier = na + 2.4 * deltaGlic;
    return {
      katz: katz.toFixed(1),
      hillier: hillier.toFixed(1),
    };
  }, [naMedido, glicemia]);

  // 2. Cálcio Corrigido pela Albumina
  const [calcioTotal, setCalcioTotal] = useState('7.8');
  const [albuminaCa, setAlbuminaCa] = useState('2.5');

  const caResult = useMemo(() => {
    const ca = parseFloat(calcioTotal.replace(',', '.'));
    const alb = parseFloat(albuminaCa.replace(',', '.'));
    if (!ca || isNaN(alb)) return null;
    const corrigido = ca + 0.8 * (4.0 - alb);
    return corrigido.toFixed(2);
  }, [calcioTotal, albuminaCa]);

  // 3. Ânion Gap (corrigido pela albumina + Delta/Delta)
  const [agNa, setAgNa] = useState('140');
  const [agCl, setAgCl] = useState('102');
  const [agHco3, setAgHco3] = useState('14');
  const [agAlb, setAgAlb] = useState('4.0');

  const agResult = useMemo(() => {
    const na = parseFloat(agNa.replace(',', '.'));
    const cl = parseFloat(agCl.replace(',', '.'));
    const hco3 = parseFloat(agHco3.replace(',', '.'));
    const alb = parseFloat(agAlb.replace(',', '.')) || 4.0;
    if (!na || !cl || !hco3) return null;

    const ag = na - (cl + hco3);
    const agCorrigido = ag + 2.5 * (4.0 - alb);
    const deltaAg = agCorrigido - 12;
    const deltaHco3 = 24 - hco3;
    const deltaRatio = deltaHco3 > 0 ? deltaAg / deltaHco3 : null;

    let interp = 'Ânion Gap dentro da faixa normal (8–12 mEq/L).';
    if (agCorrigido > 12) {
      if (deltaRatio !== null) {
        if (deltaRatio < 1) {
          interp = 'Acidose metabólica de Ânion Gap aumentado + Acidose hiperclorêmica associada (Delta/Delta < 1).';
        } else if (deltaRatio > 2) {
          interp = 'Acidose metabólica de Ânion Gap aumentado + Alcalose metabólica associada ou retenção crônica de HCO3 (Delta/Delta > 2).';
        } else {
          interp = 'Acidose metabólica pura de Ânion Gap aumentado (Delta/Delta entre 1 e 2).';
        }
      } else {
        interp = 'Ânion Gap aumentado (> 12 mEq/L).';
      }
    }

    return {
      ag: ag.toFixed(1),
      agCorrigido: agCorrigido.toFixed(1),
      deltaRatio: deltaRatio !== null && deltaAg > 0 ? deltaRatio.toFixed(2) : null,
      interp,
    };
  }, [agNa, agCl, agHco3, agAlb]);

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
    toast('Copiado para a área de transferência!', 'success');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* 1. Sódio Corrigido */}
      <Card className="border-slate-200 flex flex-col justify-between">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-bold text-slate-900">
            1. Sódio Corrigido na Hiperglicemia
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4 flex-1 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Sódio Medido (mEq/L)</Label>
              <Input
                type="number"
                value={naMedido}
                onChange={(e) => setNaMedido(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Glicemia (mg/dL)</Label>
              <Input
                type="number"
                value={glicemia}
                onChange={(e) => setGlicemia(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
          </div>

          {naResult && (
            <div className="space-y-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Fórmula de Katz (+1,6):</span>
                  <strong className="text-xl font-bold font-mono tabular-nums text-teal-700">
                    {naResult.katz} mEq/L
                  </strong>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200/70 pt-1.5">
                  <span className="text-xs text-slate-500">Hillier (+2,4 se Glic &gt; 400):</span>
                  <strong className="text-base font-bold font-mono tabular-nums text-slate-800">
                    {naResult.hillier} mEq/L
                  </strong>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() =>
                  copyText(
                    'na',
                    `Na+ corrigido pela glicemia (${glicemia} mg/dL): ${naResult.katz} mEq/L (Katz) / ${naResult.hillier} mEq/L (Hillier)`
                  )
                }
              >
                {copiedKey === 'na' ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                Copiar Sódio Corrigido
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Cálcio Corrigido pela Albumina */}
      <Card className="border-slate-200 flex flex-col justify-between">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-bold text-slate-900">
            2. Cálcio Corrigido pela Albumina
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4 flex-1 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Cálcio Total Sérico (mg/dL)</Label>
              <Input
                type="number"
                step="0.1"
                value={calcioTotal}
                onChange={(e) => setCalcioTotal(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Albumina Sérica (g/dL)</Label>
              <Input
                type="number"
                step="0.1"
                value={albuminaCa}
                onChange={(e) => setAlbuminaCa(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
          </div>

          {caResult && (
            <div className="space-y-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-xs text-slate-500">Cálcio Total Corrigido (VR: 8,5–10,2):</span>
                <div className="text-2xl font-bold font-mono tabular-nums text-teal-700">
                  {caResult} mg/dL
                </div>
                <p className="text-[11px] text-slate-500">
                  Fórmula: Ca + 0,8 × (4,0 − Albumina)
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() =>
                  copyText(
                    'ca',
                    `Cálcio total corrigido pela albumina (${albuminaCa} g/dL): ${caResult} mg/dL`
                  )
                }
              >
                {copiedKey === 'ca' ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                Copiar Cálcio Corrigido
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Ânion Gap & Delta/Delta */}
      <Card className="border-slate-200 flex flex-col justify-between">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-bold text-slate-900">
            3. Ânion Gap & Relação Delta/Delta
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4 flex-1 flex flex-col justify-between">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Na+ (mEq/L)</Label>
              <Input
                type="number"
                value={agNa}
                onChange={(e) => setAgNa(e.target.value)}
                className="font-mono tabular-nums h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Cl- (mEq/L)</Label>
              <Input
                type="number"
                value={agCl}
                onChange={(e) => setAgCl(e.target.value)}
                className="font-mono tabular-nums h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">HCO3- (mEq/L)</Label>
              <Input
                type="number"
                value={agHco3}
                onChange={(e) => setAgHco3(e.target.value)}
                className="font-mono tabular-nums h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Albumina (g/dL)</Label>
              <Input
                type="number"
                step="0.1"
                value={agAlb}
                onChange={(e) => setAgAlb(e.target.value)}
                className="font-mono tabular-nums h-9"
              />
            </div>
          </div>

          {agResult && (
            <div className="space-y-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">AG Corrigido (Alb):</span>
                  <strong className="text-xl font-bold font-mono tabular-nums text-teal-700">
                    {agResult.agCorrigido} mEq/L
                  </strong>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>AG sem correção: {agResult.ag}</span>
                  {agResult.deltaRatio && <span>Delta/Delta: {agResult.deltaRatio}</span>}
                </div>
                <p className="text-[11px] text-slate-600 pt-1 border-t border-slate-200/70">
                  {agResult.interp}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() =>
                  copyText(
                    'ag',
                    `Ânion Gap: ${agResult.ag} mEq/L (Corrigido p/ Alb: ${agResult.agCorrigido} mEq/L${
                      agResult.deltaRatio ? ` | Delta/Delta: ${agResult.deltaRatio}` : ''
                    })`
                  )
                }
              >
                {copiedKey === 'ag' ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                Copiar Ânion Gap
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
