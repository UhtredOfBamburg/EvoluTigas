import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Label } from '@/components/ui';
import { Baby } from 'lucide-react';

export function IdadeGestacionalCalculator() {
  const [dum, setDum] = useState('');
  const [ig, setIg] = useState<{ semanas: number, dias: number } | null>(null);

  const calcularIG = () => {
    if (!dum) return;
    const dataDum = new Date(dum);
    const hoje = new Date();
    const diffTime = Math.abs(hoje.getTime() - dataDum.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setIg({ semanas: Math.floor(diffDays / 7), dias: diffDays % 7 });
  };

  return (
    <Card className="border-teal-200 shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100">
        <CardTitle className="text-lg text-teal-800 flex items-center gap-2">
          <Baby className="w-5 h-5" /> Idade Gestacional (DUM)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="space-y-2">
          <Label>Data da Última Menstruação</Label>
          <Input type="date" value={dum} onChange={e => setDum(e.target.value)} />
        </div>
        <Button onClick={calcularIG} className="w-full bg-teal-600 hover:bg-teal-700">Calcular</Button>
        {ig && (
          <div className="mt-4 p-3 bg-teal-50 rounded-md border border-teal-100 text-center">
            <div className="text-sm text-teal-800 font-medium">Idade Gestacional:</div>
            <div className="text-2xl font-bold text-teal-900">{ig.semanas} sem e {ig.dias} dias</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
