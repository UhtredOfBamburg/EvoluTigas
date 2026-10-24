import React, { useState, useMemo } from 'react';
import { RotateCcw, Copy, Check } from 'lucide-react';

type AsciteOption = 'Ausente' | 'Leve' | 'Moderada';
type EncefalopatiaOption = 'Ausente' | 'Grau 1-2' | 'Grau 3-4';

export function ChildPughCalculator() {
  const [bilirrubina, setBilirrubina] = useState('');
  const [albumina, setAlbumina] = useState('');
  const [inr, setInr] = useState('');
  const [ascite, setAscite] = useState<AsciteOption | null>(null);
  const [encefalopatia, setEncefalopatia] = useState<EncefalopatiaOption | null>(null);
  const [copied, setCopied] = useState(false);

  const handleReset = () => {
    setBilirrubina('');
    setAlbumina('');
    setInr('');
    setAscite(null);
    setEncefalopatia(null);
    setCopied(false);
  };

  const calculation = useMemo(() => {
    const biliVal = parseFloat(bilirrubina.replace(',', '.'));
    const albVal = parseFloat(albumina.replace(',', '.'));
    const inrVal = parseFloat(inr.replace(',', '.'));

    let biliPts: number | null = null;
    if (!isNaN(biliVal) && biliVal >= 0) {
      if (biliVal < 2.0) biliPts = 1;
      else if (biliVal <= 3.0) biliPts = 2;
      else biliPts = 3;
    }

    let albPts: number | null = null;
    if (!isNaN(albVal) && albVal >= 0) {
      if (albVal > 3.5) albPts = 1;
      else if (albVal >= 2.8) albPts = 2;
      else albPts = 3;
    }

    let inrPts: number | null = null;
    if (!isNaN(inrVal) && inrVal >= 0) {
      if (inrVal < 1.7) inrPts = 1;
      else if (inrVal <= 2.3) inrPts = 2;
      else inrPts = 3;
    }

    let ascitePts: number | null = null;
    if (ascite === 'Ausente') ascitePts = 1;
    else if (ascite === 'Leve') ascitePts = 2;
    else if (ascite === 'Moderada') ascitePts = 3;

    let encefPts: number | null = null;
    if (encefalopatia === 'Ausente') encefPts = 1;
    else if (encefalopatia === 'Grau 1-2') encefPts = 2;
    else if (encefalopatia === 'Grau 3-4') encefPts = 3;

    const isComplete =
      biliPts !== null &&
      albPts !== null &&
      inrPts !== null &&
      ascitePts !== null &&
      encefPts !== null;

    const total =
      (biliPts ?? 0) +
      (albPts ?? 0) +
      (inrPts ?? 0) +
      (ascitePts ?? 0) +
      (encefPts ?? 0);

    let classe: 'A' | 'B' | 'C' = 'A';
    let descricao = 'Doença bem compensada';
    let sobrevida1Ano = '100%';
    let sobrevida2Anos = '85%';
    let badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';

    if (total >= 10) {
      classe = 'C';
      descricao = 'Doença descompensada';
      sobrevida1Ano = '45%';
      sobrevida2Anos = '35%';
      badgeColor = 'bg-rose-50 text-rose-800 border-rose-200';
    } else if (total >= 7) {
      classe = 'B';
      descricao = 'Comprometimento funcional significativo';
      sobrevida1Ano = '80%';
      sobrevida2Anos = '60%';
      badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
    }

    return {
      biliPts,
      albPts,
      inrPts,
      ascitePts,
      encefPts,
      isComplete,
      total,
      classe,
      descricao,
      sobrevida1Ano,
      sobrevida2Anos,
      badgeColor,
    };
  }, [bilirrubina, albumina, inr, ascite, encefalopatia]);

  const handleCopy = () => {
    if (!calculation.isComplete) return;
    const text = `Child-Pugh: ${calculation.total} pontos (Classe ${calculation.classe} - ${calculation.descricao}) | Bilirrubina: ${bilirrubina} mg/dL (${calculation.biliPts} pt), Albumina: ${albumina} g/dL (${calculation.albPts} pt), INR: ${inr} (${calculation.inrPts} pt), Ascite: ${ascite} (${calculation.ascitePts} pt), Encefalopatia: ${encefalopatia} (${calculation.encefPts} pt).`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Child-Pugh</h2>
          <p className="text-sm text-slate-500 mt-0.5">Gravidade de cirrose</p>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Resetar
        </button>
      </div>

      {/* Inputs Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Bilirrubina (mg/dL)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="1.0"
            value={bilirrubina}
            onChange={(e) => setBilirrubina(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Albumina (g/dL)
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="3.5"
            value={albumina}
            onChange={(e) => setAlbumina(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            INR
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            placeholder="1.2"
            value={inr}
            onChange={(e) => setInr(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors"
          />
        </div>
      </div>

      {/* Ascite */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-slate-600 mb-2">
          Ascite
        </label>
        <div className="flex flex-wrap gap-2">
          {(['Ausente', 'Leve', 'Moderada'] as AsciteOption[]).map((option) => {
            const active = ascite === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setAscite(option)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  active
                    ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {/* Encefalopatia */}
      <div>
        <label className="block text-sm font-medium text-slate-600 mb-2">
          Encefalopatia
        </label>
        <div className="flex flex-wrap gap-2">
          {(['Ausente', 'Grau 1-2', 'Grau 3-4'] as EncefalopatiaOption[]).map((option) => {
            const active = encefalopatia === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => setEncefalopatia(option)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  active
                    ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {/* Resultado */}
      {calculation.isComplete && (
        <div className={`mt-6 p-5 rounded-xl border ${calculation.badgeColor} transition-all`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl font-bold">
                  {calculation.total} pontos — Child-Pugh Classe {calculation.classe}
                </span>
              </div>
              <p className="text-sm font-medium mt-1 opacity-90">
                {calculation.descricao} • Sobrevida estimada: 1 ano ({calculation.sobrevida1Ano}) | 2 anos ({calculation.sobrevida2Anos})
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-2.5 opacity-80">
                <span>Bilirrubina: +{calculation.biliPts} pt</span>
                <span>Albumina: +{calculation.albPts} pt</span>
                <span>INR: +{calculation.inrPts} pt</span>
                <span>Ascite: +{calculation.ascitePts} pt</span>
                <span>Encefalopatia: +{calculation.encefPts} pt</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white/80 hover:bg-white text-slate-800 border border-black/10 shadow-xs transition-colors self-start sm:self-center shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar para prontuário'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
