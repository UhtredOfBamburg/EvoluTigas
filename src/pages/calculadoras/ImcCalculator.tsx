import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from '@/components/ui';
import { Activity } from 'lucide-react';

export function ImcCalculator() {
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState('');
  const [imc, setImc] = useState<number | null>(null);

  const calcularIMC = () => {
    const p = parseFloat(peso);
    const a = parseFloat(altura) / 100;
    if (p && a) setImc(p / (a * a));
  };

  return (
    <Card className="border-teal-200 shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100">
        <CardTitle className="text-lg text-teal-800 flex items-center gap-2">
          <Activity className="w-5 h-5" /> IMC
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Peso (kg)</Label>
            <Input type="number" placeholder="Ex: 70" value={peso} onChange={e => setPeso(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Altura (cm)</Label>
            <Input type="number" placeholder="Ex: 175" value={altura} onChange={e => setAltura(e.target.value)} />
          </div>
        </div>
        <Button onClick={calcularIMC} className="w-full bg-teal-600 hover:bg-teal-700">Calcular</Button>
        
        {imc && (
          <div className="mt-4 p-3 bg-teal-50 rounded-md border border-teal-100 text-center">
            <div className="text-sm text-teal-800 font-medium">Resultado:</div>
            <div className="text-2xl font-bold text-teal-900">{imc.toFixed(1)} kg/m²</div>
            <div className="text-xs text-teal-700 mt-1">
              {imc < 18.5 ? 'Baixo peso' : imc < 25 ? 'Peso normal' : imc < 30 ? 'Sobrepeso' : 'Obesidade'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
