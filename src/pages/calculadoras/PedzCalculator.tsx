import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from '@/components/ui';
import { Baby, RotateCcw } from 'lucide-react';
import { calculateAll } from '@pedi-growth/core';
import pediatricCharts from '@/lib/pediatricCharts.json';
import { GrowthChart } from '@/components/GrowthChart';
import { SelectField, ToggleButtons, MultiSelectButtons } from '@/components/FormControls';
import { useToast } from '@/hooks/useToast';

export function PedzCalculator() {
  const { toast } = useToast();
  const [sexoPedz, setSexoPedz] = useState<'M' | 'F' | null>(null);
  const [refPedz, setRefPedz] = useState<'OMS' | 'ZEMEL'>('OMS');
  const [idadeAnosPedz, setIdadeAnosPedz] = useState('');
  const [idadeMesesPedz, setIdadeMesesPedz] = useState('');
  const [estaturaPedz, setEstaturaPedz] = useState('');
  const [pesoPedz, setPesoPedz] = useState('');
  const [pesoUnidadePedz, setPesoUnidadePedz] = useState<'kg' | 'g'>('kg');
  const [perimetroPedz, setPerimetroPedz] = useState('');
  
  const [resultadoPedz, setResultadoPedz] = useState<any | null>(null);

  const resetPedz = () => {
    setSexoPedz(null);
    setRefPedz('OMS');
    setIdadeAnosPedz('');
    setIdadeMesesPedz('');
    setEstaturaPedz('');
    setPesoPedz('');
    setPesoUnidadePedz('kg');
    setPerimetroPedz('');
    setResultadoPedz(null);
  };

  const calcularPedz = async () => {
    if (!sexoPedz) {
      toast("Por favor, selecione o sexo biológico.", 'error');
      return;
    }
    const anos = parseFloat(idadeAnosPedz) || 0;
    const meses = parseFloat(idadeMesesPedz) || 0;
    if (!idadeAnosPedz && !idadeMesesPedz) {
      toast("Por favor, informe a idade do paciente.", 'error');
      return;
    }
    
    const totalMeses = anos * 12 + meses;
    const isMasculino = sexoPedz === 'M';
    
    if (!estaturaPedz && !pesoPedz && !perimetroPedz) {
      toast("Por favor, informe pelo menos um dos valores: estatura, peso ou perímetro cefálico.", 'error');
      return;
    }

    const pPesoKilos = pesoPedz ? parseFloat(pesoPedz) * (pesoUnidadePedz === 'g' ? 0.001 : 1) : undefined;
    const estaturaMeters = estaturaPedz ? parseFloat(estaturaPedz) / 100 : undefined;
    const imc = (pPesoKilos && estaturaMeters) ? (pPesoKilos / (estaturaMeters * estaturaMeters)) : null;

    const measurementDate = new Date();
    const dob = new Date(measurementDate);
    dob.setFullYear(dob.getFullYear() - anos);
    dob.setMonth(dob.getMonth() - meses);
    
    try {
      const assessment = await calculateAll({
        sex: isMasculino ? 'male' : 'female',
        dateOfBirth: dob,
        dateOfMeasurement: measurementDate,
        weight: pPesoKilos,
        lengthHeight: estaturaPedz ? parseFloat(estaturaPedz) : undefined,
        headCircumference: perimetroPedz ? parseFloat(perimetroPedz) : undefined,
        chartSet: refPedz === 'OMS' ? 'who-standard' : 'down-syndrome',
      });

      let zEstatura = null, pEstatura = null;
      let zPeso = null, pPeso = null;
      let zImc = null, pImc = null;
      let zPerimetro = null, pPerimetro = null;

      assessment.results.forEach(res => {
        if (res.indicator === 'length-height-for-age') {
          zEstatura = Math.round(res.zScore * 100) / 100;
          pEstatura = Math.round(res.percentile * 10) / 10;
        } else if (res.indicator === 'weight-for-age') {
          zPeso = Math.round(res.zScore * 100) / 100;
          pPeso = Math.round(res.percentile * 10) / 10;
        } else if (res.indicator === 'bmi-for-age') {
          zImc = Math.round(res.zScore * 100) / 100;
          pImc = Math.round(res.percentile * 10) / 10;
        } else if (res.indicator === 'head-circumference-for-age') {
          zPerimetro = Math.round(res.zScore * 100) / 100;
          pPerimetro = Math.round(res.percentile * 10) / 10;
        }
      });

      setResultadoPedz({
        totalMeses,
        sexo: sexoPedz,
        estatura: estaturaPedz ? parseFloat(estaturaPedz) : null,
        peso: pPesoKilos !== undefined ? pPesoKilos : null,
        imc: imc !== null ? Math.round(imc * 10) / 10 : null,
        zEstatura, zPeso, zImc, zPerimetro,
        pEstatura, pPeso, pImc, pPerimetro
      });
    } catch (e) {
      console.error(e);
      toast("Erro ao calcular os índices Z-Escore com as curvas da OMS.", 'error');
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm w-full">
      <CardHeader className="pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-xl text-slate-800 flex items-center gap-2">
            <Baby className="w-6 h-6 text-teal-600" />
            Z-Escore Pediátrico e Curvas de Crescimento
          </CardTitle>
          <p className="text-sm text-slate-500 mt-1">Cálculo exato com bibliotecas oficiais da OMS</p>
        </div>
        <Button variant="ghost" size="sm" onClick={resetPedz} className="text-slate-500 hover:text-slate-700">
          <RotateCcw className="w-4 h-4 mr-2" />
          Limpar
        </Button>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Sexo Biológico</Label>
              <ToggleButtons options={['M', 'F']} value={sexoPedz} onChange={setSexoPedz} />
            </div>
            <div className="space-y-2">
              <Label>Referência</Label>
              <SelectField value={refPedz} onChange={setRefPedz} options={['OMS', 'ZEMEL']} />
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Idade</Label>
              <div className="flex gap-2">
                <Input type="number" placeholder="Anos" value={idadeAnosPedz} onChange={e => setIdadeAnosPedz(e.target.value)} />
                <Input type="number" placeholder="Meses" value={idadeMesesPedz} onChange={e => setIdadeMesesPedz(e.target.value)} />
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Estatura/Comprimento (cm)</Label>
              <Input type="number" step="0.1" placeholder="Ex: 110.5" value={estaturaPedz} onChange={e => setEstaturaPedz(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Perímetro Cefálico (cm)</Label>
              <Input type="number" step="0.1" placeholder="Ex: 45.2" value={perimetroPedz} onChange={e => setPerimetroPedz(e.target.value)} />
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Peso</Label>
              <div className="flex gap-2">
                <Input type="number" step="0.1" placeholder="Ex: 18.5" value={pesoPedz} onChange={e => setPesoPedz(e.target.value)} />
                <select className="border-slate-200 rounded-md text-sm w-20" value={pesoUnidadePedz} onChange={e => setPesoUnidadePedz(e.target.value as 'kg'|'g')}>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                </select>
              </div>
            </div>
            
            <Button className="w-full bg-teal-600 hover:bg-teal-700 mt-6" onClick={calcularPedz}>Calcular Z-Escores</Button>
          </div>
        </div>

        {resultadoPedz && (
          <div className="mt-8 space-y-6">
            <h3 className="font-semibold text-slate-800 text-lg">Resultados ({resultadoPedz.ref === 'ZEMEL' ? 'Síndrome de Down' : 'OMS'})</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-sm text-slate-500 font-medium mb-1">Estatura por Idade</div>
                <div className="text-2xl font-bold text-slate-900">{resultadoPedz.zEstatura !== null ? resultadoPedz.zEstatura : '-'} <span className="text-sm font-normal text-slate-500">Z</span></div>
                <div className="text-xs text-slate-500 mt-1">Percentil {resultadoPedz.pEstatura !== null ? resultadoPedz.pEstatura : '-'}</div>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-sm text-slate-500 font-medium mb-1">Peso por Idade</div>
                <div className="text-2xl font-bold text-slate-900">{resultadoPedz.zPeso !== null ? resultadoPedz.zPeso : '-'} <span className="text-sm font-normal text-slate-500">Z</span></div>
                <div className="text-xs text-slate-500 mt-1">Percentil {resultadoPedz.pPeso !== null ? resultadoPedz.pPeso : '-'}</div>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-sm text-slate-500 font-medium mb-1">IMC por Idade</div>
                <div className="text-2xl font-bold text-slate-900">{resultadoPedz.zImc !== null ? resultadoPedz.zImc : '-'} <span className="text-sm font-normal text-slate-500">Z</span></div>
                <div className="text-xs text-slate-500 mt-1">Percentil {resultadoPedz.pImc !== null ? resultadoPedz.pImc : '-'}</div>
              </div>
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-sm text-slate-500 font-medium mb-1">Perímetro Cefálico</div>
                <div className="text-2xl font-bold text-slate-900">{resultadoPedz.zPerimetro !== null ? resultadoPedz.zPerimetro : '-'} <span className="text-sm font-normal text-slate-500">Z</span></div>
                <div className="text-xs text-slate-500 mt-1">Percentil {resultadoPedz.pPerimetro !== null ? resultadoPedz.pPerimetro : '-'}</div>
              </div>
            </div>

            <div className="mt-8 space-y-6 border-t border-slate-100 pt-6">
              <h3 className="font-semibold text-slate-800 text-lg">Curvas de Crescimento ({resultadoPedz.sexo === 'M' ? 'Meninos' : 'Meninas'})</h3>
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#10b981]"></div>
                  <span className="text-xs text-slate-600">P50 (Mediana)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#f59e0b]"></div>
                  <span className="text-xs text-slate-600">P15 e P85</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
                  <span className="text-xs text-slate-600">P3 e P97</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#3b82f6] border border-white"></div>
                  <span className="text-xs text-slate-600 font-medium">Paciente</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {resultadoPedz.totalMeses <= 60 ? (
                  <>
                    <GrowthChart 
                      title="Estatura por Idade (0-5 anos)"
                      xAxisLabel="Idade (meses)"
                      yAxisLabel="Estatura (cm)"
                      data={resultadoPedz.sexo === 'M' ? pediatricCharts.boys0to5.height : pediatricCharts.girls0to5.height}
                      patientData={resultadoPedz.estatura ? { age: resultadoPedz.totalMeses, value: resultadoPedz.estatura } : null}
                    />
                    <GrowthChart 
                      title="Peso por Idade (0-5 anos)"
                      xAxisLabel="Idade (meses)"
                      yAxisLabel="Peso (kg)"
                      data={resultadoPedz.sexo === 'M' ? pediatricCharts.boys0to5.weight : pediatricCharts.girls0to5.weight}
                      patientData={resultadoPedz.peso ? { age: resultadoPedz.totalMeses, value: resultadoPedz.peso } : null}
                    />
                  </>
                ) : (
                  <>
                    <GrowthChart 
                      title="Estatura por Idade (5-19 anos)"
                      xAxisLabel="Idade (anos)"
                      yAxisLabel="Estatura (cm)"
                      data={resultadoPedz.sexo === 'M' ? pediatricCharts.boys5to19.height : pediatricCharts.girls5to19.height}
                      patientData={resultadoPedz.estatura ? { age: resultadoPedz.totalMeses / 12, value: resultadoPedz.estatura } : null}
                    />
                    <GrowthChart 
                      title="Peso por Idade (5-19 anos)"
                      xAxisLabel="Idade (anos)"
                      yAxisLabel="Peso (kg)"
                      data={resultadoPedz.sexo === 'M' ? pediatricCharts.boys5to19.weight : pediatricCharts.girls5to19.weight}
                      patientData={resultadoPedz.peso ? { age: resultadoPedz.totalMeses / 12, value: resultadoPedz.peso } : null}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
