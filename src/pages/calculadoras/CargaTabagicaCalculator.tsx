import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from '@/components/ui';
import { Cigarette } from 'lucide-react';

export function CargaTabagicaCalculator() {
  const [cigarrosDia, setCigarrosDia] = useState('');
  const [anosFumo, setAnosFumo] = useState('');
  const [cargaTabagica, setCargaTabagica] = useState<number | null>(null);

  const calcularCargaTabagica = () => {
    const c = parseFloat(cigarrosDia);
    const a = parseFloat(anosFumo);
    if (c && a) setCargaTabagica((c / 20) * a);
  };

  return (
    <Card className="border-teal-200 shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100">
        <CardTitle className="text-lg text-teal-800 flex items-center gap-2">
          <Cigarette className="w-5 h-5" /> Carga Tabágica
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="space-y-2">
          <Label>Cigarros por dia</Label>
          <Input type="number" placeholder="Ex: 15" value={cigarrosDia} onChange={e => setCigarrosDia(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Anos de fumo</Label>
          <Input type="number" placeholder="Ex: 20" value={anosFumo} onChange={e => setAnosFumo(e.target.value)} />
        </div>
        <Button onClick={calcularCargaTabagica} className="w-full bg-teal-600 hover:bg-teal-700">Calcular</Button>
        {cargaTabagica !== null && (
          <div className="mt-4 p-3 bg-teal-50 rounded-md border border-teal-100 text-center">
            <div className="text-sm text-teal-800 font-medium">Resultado:</div>
            <div className="text-2xl font-bold text-teal-900">{cargaTabagica.toFixed(1)} maços-ano</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
