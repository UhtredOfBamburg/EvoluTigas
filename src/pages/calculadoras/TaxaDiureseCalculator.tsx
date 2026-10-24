import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from '@/components/ui';
import { Droplets } from 'lucide-react';

export function TaxaDiureseCalculator() {
  const [diuresePeso, setDiuresePeso] = useState('');
  const [diureseVol, setDiureseVol] = useState('');
  const [diureseTempo, setDiureseTempo] = useState('');
  const [taxaDiurese, setTaxaDiurese] = useState<number | null>(null);

  const calcularDiurese = () => {
    const p = parseFloat(diuresePeso);
    const v = parseFloat(diureseVol);
    const t = parseFloat(diureseTempo);
    if (p && v && t) setTaxaDiurese(v / p / t);
  };

  return (
    <Card className="border-teal-200 shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100">
        <CardTitle className="text-lg text-teal-800 flex items-center gap-2">
          <Droplets className="w-5 h-5" /> Taxa de Diurese
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="space-y-2">
          <Label>Peso (kg)</Label>
          <Input type="number" placeholder="Ex: 15" value={diuresePeso} onChange={e => setDiuresePeso(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Volume (mL)</Label>
            <Input type="number" placeholder="Ex: 300" value={diureseVol} onChange={e => setDiureseVol(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tempo (h)</Label>
            <Input type="number" placeholder="Ex: 12" value={diureseTempo} onChange={e => setDiureseTempo(e.target.value)} />
          </div>
        </div>
        <Button onClick={calcularDiurese} className="w-full bg-teal-600 hover:bg-teal-700">Calcular</Button>
        {taxaDiurese !== null && (
          <div className="mt-4 p-3 bg-teal-50 rounded-md border border-teal-100 text-center">
            <div className="text-sm text-teal-800 font-medium">Resultado:</div>
            <div className="text-2xl font-bold text-teal-900">{taxaDiurese.toFixed(2)} mL/kg/h</div>
            <div className="text-xs text-teal-700 mt-1">
              {taxaDiurese < 1 ? 'Oligúria (atenção)' : 'Diurese adequada'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
