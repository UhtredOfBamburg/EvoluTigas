import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Button } from '@/components/ui';
import { Copy, Check, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

export function FuncaoRenalCalculator() {
  const { toast } = useToast();
  const [creatinina, setCreatinina] = useState('1.2');
  const [idade, setIdade] = useState('65');
  const [peso, setPeso] = useState('70');
  const [altura, setAltura] = useState('170');
  const [sexo, setSexo] = useState<'M' | 'F'>('M');
  const [copied, setCopied] = useState(false);

  const results = useMemo(() => {
    const scr = parseFloat(creatinina.replace(',', '.'));
    const age = parseFloat(idade);
    const wt = parseFloat(peso.replace(',', '.'));
    const ht = parseFloat(altura.replace(',', '.'));

    if (!scr || scr <= 0 || !age || age <= 0) return null;

    // 1. CKD-EPI 2021 (Race-free equation)
    const kappa = sexo === 'F' ? 0.7 : 0.9;
    const alpha = sexo === 'F' ? -0.241 : -0.302;
    const sexMultiplier = sexo === 'F' ? 1.012 : 1.0;
    const ratio = scr / kappa;
    const ckdEpi =
      142 *
      Math.pow(Math.min(ratio, 1), alpha) *
      Math.pow(Math.max(ratio, 1), -1.2) *
      Math.pow(0.9938, age) *
      sexMultiplier;

    // 2. Cockcroft-Gault (Total Weight)
    let cgTotal: number | null = null;
    if (wt && wt > 0) {
      cgTotal = (((140 - age) * wt) / (72 * scr)) * (sexo === 'F' ? 0.85 : 1.0);
    }

    // 3. Body Surface Area (Mosteller) & Non-indexed CKD-EPI for drug dosing
    let bsa: number | null = null;
    let ckdEpiAbsolute: number | null = null;
    if (wt > 0 && ht > 0) {
      bsa = Math.sqrt((ht * wt) / 3600);
      ckdEpiAbsolute = (ckdEpi * bsa) / 1.73;
    }

    // KDIGO Stage classification
    let stage = 'G1';
    let stageDesc = 'Normal ou elevada (≥ 90)';
    let riskColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    let doseAlert = 'Sem necessidade habitual de ajuste renal para a maioria dos fármacos.';

    if (ckdEpi < 15) {
      stage = 'G5';
      stageDesc = 'Falência renal (< 15)';
      riskColor = 'text-red-700 bg-red-50 border-red-200';
      doseAlert = 'Ajuste rigoroso obrigatório! Evitar nefrotóxicos (AINEs, contraste, aminoglicosídeos) e ajustar ATB para ClCr < 15.';
    } else if (ckdEpi < 30) {
      stage = 'G4';
      stageDesc = 'Redução grave (15–29)';
      riskColor = 'text-red-700 bg-red-50 border-red-200';
      doseAlert = 'Ajuste de dose necessário para a maioria dos antibióticos (ex: Meropenem, Cefepime, Vancomicina, Ciprofloxacino) e HBPM (Enoxaparina 1mg/kg 1x/dia).';
    } else if (ckdEpi < 45) {
      stage = 'G3b';
      stageDesc = 'Redução moderada a grave (30–44)';
      riskColor = 'text-amber-700 bg-amber-50 border-amber-200';
      doseAlert = 'Atenção ao ajuste de dose de antibióticos beta-lactâmicos, DOACs, Metformina (reduzir dose/monitorar) e alopurinol.';
    } else if (ckdEpi < 60) {
      stage = 'G3a';
      stageDesc = 'Redução leve a moderada (45–59)';
      riskColor = 'text-amber-700 bg-amber-50 border-amber-200';
      doseAlert = 'Verificar ajuste para fármacos de janela estreita e hidratar antes de exames contrastados.';
    } else if (ckdEpi < 90) {
      stage = 'G2';
      stageDesc = 'Redução leve (60–89)';
      riskColor = 'text-teal-700 bg-teal-50 border-teal-200';
      doseAlert = 'Função renal preservada para a maioria das medicações habituais.';
    }

    return {
      ckdEpi: ckdEpi.toFixed(1),
      cgTotal: cgTotal ? cgTotal.toFixed(1) : null,
      ckdEpiAbsolute: ckdEpiAbsolute ? ckdEpiAbsolute.toFixed(1) : null,
      bsa: bsa ? bsa.toFixed(2) : null,
      stage,
      stageDesc,
      riskColor,
      doseAlert,
    };
  }, [creatinina, idade, peso, altura, sexo]);

  const handleCopy = () => {
    if (!results) return;
    const text = `Função Renal (Cr ${creatinina} mg/dL): TFGe (CKD-EPI 2021) = ${results.ckdEpi} mL/min/1,73m² (${results.stage})${
      results.cgTotal ? ` | ClCr (Cockcroft-Gault) = ${results.cgTotal} mL/min` : ''
    }`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    toast('Resultado copiado para colar na evolução!', 'success');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <Card className="lg:col-span-5 border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-base font-bold text-slate-900">
            Parâmetros do Paciente (CKD-EPI 2021 & Cockcroft-Gault)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Sexo Biológico</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSexo('M')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                  sexo === 'M'
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Masculino
              </button>
              <button
                type="button"
                onClick={() => setSexo('F')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-colors ${
                  sexo === 'F'
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Feminino
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Creatinina Sérica (mg/dL)</Label>
              <Input
                type="number"
                step="0.1"
                value={creatinina}
                onChange={(e) => setCreatinina(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Idade (anos)</Label>
              <Input
                type="number"
                value={idade}
                onChange={(e) => setIdade(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Peso (kg) — p/ Cockcroft</Label>
              <Input
                type="number"
                step="0.5"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Altura (cm) — opcional</Label>
              <Input
                type="number"
                value={altura}
                onChange={(e) => setAltura(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-7 border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-bold text-slate-900">
            Resultados e Ajuste Renal
          </CardTitle>
          {results && (
            <Button variant="outline" size="sm" onClick={handleCopy} className="h-8 text-xs">
              {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
              {copied ? 'Copiado!' : 'Copiar para Evolução'}
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          {!results ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              Informe creatinina e idade válidas para calcular.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                  <span className="text-xs font-semibold text-slate-500">
                    TFGe — CKD-EPI (2021)
                  </span>
                  <div className="text-3xl font-bold text-slate-900 font-mono tabular-nums">
                    {results.ckdEpi}{' '}
                    <span className="text-xs font-normal text-slate-500">mL/min/1,73m²</span>
                  </div>
                  <p className="text-xs text-slate-600 pt-1">
                    Estágio KDIGO: <strong className="text-slate-900">{results.stage}</strong> · {results.stageDesc}
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                  <span className="text-xs font-semibold text-slate-500">
                    Clearance — Cockcroft-Gault
                  </span>
                  <div className="text-3xl font-bold text-teal-700 font-mono tabular-nums">
                    {results.cgTotal || '--'}{' '}
                    <span className="text-xs font-normal text-slate-500">mL/min</span>
                  </div>
                  <p className="text-xs text-slate-600 pt-1">
                    Padrão em bulas para ajuste de dose de antibióticos e anticoagulantes
                  </p>
                </div>
              </div>

              {results.ckdEpiAbsolute && (
                <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-100/80 border border-slate-200 text-xs text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-slate-500 shrink-0" />
                    TFGe ajustada para Superfície Corporal do paciente ({results.bsa} m²):
                  </span>
                  <strong className="font-mono tabular-nums text-slate-900">
                    {results.ckdEpiAbsolute} mL/min
                  </strong>
                </div>
              )}

              <div className={`p-4 rounded-xl border text-xs space-y-1.5 ${results.riskColor}`}>
                <div className="font-bold flex items-center gap-1.5 text-sm">
                  {parseFloat(results.ckdEpi) < 60 ? (
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  )}
                  Conduta Farmacológica ({results.stage} — {results.stageDesc})
                </div>
                <p className="leading-relaxed">{results.doseAlert}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
