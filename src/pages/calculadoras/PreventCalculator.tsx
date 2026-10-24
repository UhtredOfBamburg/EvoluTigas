import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from '@/components/ui';
import { HeartPulse } from 'lucide-react';
import { SelectField, ToggleButtons, MultiSelectButtons } from '@/components/FormControls';
import { useToast } from '@/hooks/useToast';
// @ts-ignore
import { PREVENT } from '@/lib/prevent';
// @ts-ignore
import { PREVENT_COEFFS } from '@/lib/prevent_coeffs';

export function PreventCalculator() {
  const { toast } = useToast();
  const [sexo, setSexo] = useState<'M' | 'F' | null>(null);
  const [idade, setIdade] = useState('');
  const [pas, setPas] = useState('');
  const [colTotal, setColTotal] = useState('');
  const [hdl, setHdl] = useState('');
  const [imcPrevent, setImcPrevent] = useState('');
  const [egfr, setEgfr] = useState('');
  const [usaAntiHipertensivo, setUsaAntiHipertensivo] = useState(false);
  const [usaEstatina, setUsaEstatina] = useState(false);
  const [diabetes, setDiabetes] = useState(false);
  const [tabagista, setTabagista] = useState(false);
  
  const [riscoCVD10, setRiscoCVD10] = useState<number | null>(null);
  const [riscoASCVD10, setRiscoASCVD10] = useState<number | null>(null);
  const [riscoHF10, setRiscoHF10] = useState<number | null>(null);

  const calcularPrevent = () => {
    if (!sexo || !idade || !pas || !colTotal || !hdl || !imcPrevent || !egfr) {
      toast("Por favor, preencha todos os campos obrigatórios.", 'error');
      return;
    }
    
    try {
      const inp = {
        age: parseFloat(idade),
        sex: sexo === 'M' ? 'male' : 'female',
        sbp: parseFloat(pas),
        total_c: parseFloat(colTotal),
        hdl_c: parseFloat(hdl),
        bmi: parseFloat(imcPrevent),
        egfr: parseFloat(egfr),
        dm: diabetes,
        smoking: tabagista,
        bp_tx: usaAntiHipertensivo,
        statin: usaEstatina,
        chol_unit: "mg/dL"
      };

      const result = PREVENT.estimate(inp, "base", PREVENT_COEFFS, 4);
      setRiscoCVD10(Math.round((result.r10 as any).total_cvd * 1000) / 10);
      setRiscoASCVD10(Math.round((result.r10 as any).ascvd * 1000) / 10);
      setRiscoHF10(Math.round((result.r10 as any).heart_failure * 1000) / 10);
    } catch (e) {
      console.error(e);
      toast("Ocorreu um erro no cálculo. Verifique se os dados estão corretos.", 'error');
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm w-full">
      <CardHeader className="pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl text-slate-800 flex items-center gap-2">
            <HeartPulse className="w-6 h-6 text-red-500" />
            Risco Cardiovascular AHA PREVENT™
          </CardTitle>
          <p className="text-sm text-slate-500 mt-1">Equações oficiais da AHA para Risco de CVD a 10 Anos</p>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sexo Biológico</Label>
              <ToggleButtons options={['M', 'F']} value={sexo} onChange={setSexo} />
            </div>
            <div className="space-y-2">
              <Label>Idade (30-79 anos)</Label>
              <Input type="number" value={idade} onChange={e => setIdade(e.target.value)} placeholder="Ex: 55" />
            </div>
            <div className="space-y-2">
              <Label>Pressão Sistólica (mmHg)</Label>
              <Input type="number" value={pas} onChange={e => setPas(e.target.value)} placeholder="Ex: 120" />
            </div>
            <div className="space-y-2">
              <Label>IMC (kg/m²)</Label>
              <Input type="number" value={imcPrevent} onChange={e => setImcPrevent(e.target.value)} placeholder="Ex: 27.5" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Colesterol Total (mg/dL)</Label>
              <Input type="number" value={colTotal} onChange={e => setColTotal(e.target.value)} placeholder="Ex: 200" />
            </div>
            <div className="space-y-2">
              <Label>Colesterol HDL (mg/dL)</Label>
              <Input type="number" value={hdl} onChange={e => setHdl(e.target.value)} placeholder="Ex: 50" />
            </div>
            <div className="space-y-2">
              <Label>eGFR (mL/min/1.73m²)</Label>
              <Input type="number" value={egfr} onChange={e => setEgfr(e.target.value)} placeholder="Ex: 90" />
            </div>
          </div>
          <div className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
            <Label className="font-semibold text-slate-700">Fatores de Risco & Medicações</Label>
            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={usaAntiHipertensivo} onChange={e => setUsaAntiHipertensivo(e.target.checked)} className="rounded text-teal-600 focus:ring-teal-500" />
                <span className="text-sm text-slate-700">Em uso de Anti-hipertensivo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={usaEstatina} onChange={e => setUsaEstatina(e.target.checked)} className="rounded text-teal-600 focus:ring-teal-500" />
                <span className="text-sm text-slate-700">Em uso de Estatina</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={diabetes} onChange={e => setDiabetes(e.target.checked)} className="rounded text-teal-600 focus:ring-teal-500" />
                <span className="text-sm text-slate-700">Diabetes Tipo 2</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={tabagista} onChange={e => setTabagista(e.target.checked)} className="rounded text-teal-600 focus:ring-teal-500" />
                <span className="text-sm text-slate-700">Tabagista Atual</span>
              </label>
            </div>
          </div>
        </div>
        
        <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
          <Button className="w-full md:w-auto bg-teal-600 hover:bg-teal-700" onClick={calcularPrevent}>
            Calcular Risco (PREVENT)
          </Button>
        </div>

        {riscoCVD10 !== null && (
          <div className="mt-6 p-5 bg-red-50 border border-red-100 rounded-xl">
            <h3 className="font-semibold text-red-900 mb-4 flex items-center gap-2">
              <HeartPulse className="w-5 h-5 text-red-600" /> Resultados do Risco em 10 Anos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg shadow-sm border border-red-100 text-center">
                <div className="text-sm text-slate-500 font-medium uppercase tracking-wider">Risco CVD Total</div>
                <div className="text-3xl font-bold text-red-700 mt-1">{riscoCVD10}%</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border border-red-100 text-center">
                <div className="text-sm text-slate-500 font-medium uppercase tracking-wider">Risco ASCVD</div>
                <div className="text-3xl font-bold text-red-700 mt-1">{riscoASCVD10}%</div>
              </div>
              <div className="bg-white p-4 rounded-lg shadow-sm border border-red-100 text-center">
                <div className="text-sm text-slate-500 font-medium uppercase tracking-wider">Insuf. Cardíaca</div>
                <div className="text-3xl font-bold text-red-700 mt-1">{riscoHF10}%</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
