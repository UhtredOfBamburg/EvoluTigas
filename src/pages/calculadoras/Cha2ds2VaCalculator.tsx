import React, { useState, useMemo } from 'react';
import { RotateCcw, Copy, Check } from 'lucide-react';

export function Cha2ds2VaCalculator() {
  const [ic, setIc] = useState<boolean | null>(null);
  const [has, setHas] = useState<boolean | null>(null);
  const [idade, setIdade] = useState('');
  const [dm, setDm] = useState<boolean | null>(null);
  const [avc, setAvc] = useState<boolean | null>(null);
  const [doencaVascular, setDoencaVascular] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  const handleReset = () => {
    setIc(null);
    setHas(null);
    setIdade('');
    setDm(null);
    setAvc(null);
    setDoencaVascular(null);
    setCopied(false);
  };

  const calculation = useMemo(() => {
    const idadeVal = parseInt(idade, 10);
    const hasValidAge = !isNaN(idadeVal) && idadeVal > 0;

    const anySelected =
      ic !== null ||
      has !== null ||
      hasValidAge ||
      dm !== null ||
      avc !== null ||
      doencaVascular !== null;

    const icPts = ic ? 1 : 0;
    const hasPts = has ? 1 : 0;
    let idadePts = 0;
    if (hasValidAge) {
      if (idadeVal >= 75) idadePts = 2;
      else if (idadeVal >= 65) idadePts = 1;
    }
    const dmPts = dm ? 1 : 0;
    const avcPts = avc ? 2 : 0;
    const vascPts = doencaVascular ? 1 : 0;

    const total = icPts + hasPts + idadePts + dmPts + avcPts + vascPts;

    let nivelRisco = 'Baixo risco tromboembólico';
    let conduta = 'Anticoagulação oral não recomendada (ESC 2024).';
    let badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';

    if (total >= 2) {
      nivelRisco = 'Alto risco tromboembólico';
      conduta = 'Anticoagulação oral recomendada (Classe I, Nível A — ESC 2024), preferencialmente com DOAC.';
      badgeColor = 'bg-rose-50 text-rose-800 border-rose-200';
    } else if (total === 1) {
      nivelRisco = 'Risco tromboembólico intermediário';
      conduta = 'Anticoagulação oral deve ser considerada (Classe IIa, Nível C — ESC 2024) para prevenir tromboembolismo.';
      badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
    }

    return {
      anySelected,
      total,
      icPts,
      hasPts,
      idadePts,
      dmPts,
      avcPts,
      vascPts,
      nivelRisco,
      conduta,
      badgeColor,
    };
  }, [ic, has, idade, dm, avc, doencaVascular]);

  const handleCopy = () => {
    const text = `CHA2DS2-VA: ${calculation.total} ${calculation.total === 1 ? 'ponto' : 'pontos'} (${calculation.nivelRisco}) — ${calculation.conduta}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderYesNoButtons = (
    value: boolean | null,
    onChange: (val: boolean) => void
  ) => (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
          value === false
            ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
        }`}
      >
        Não
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
          value === true
            ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
        }`}
      >
        Sim
      </button>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">CHA2DS2-VA</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Risco de AVC em fibrilação atrial (ESC 2024)
          </p>
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

      <div className="space-y-5">
        {/* Insuficiência cardíaca / disfunção de VE */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">
            Insuficiência cardíaca / disfunção de VE
          </label>
          {renderYesNoButtons(ic, setIc)}
        </div>

        {/* Hipertensão */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">
            Hipertensão
          </label>
          {renderYesNoButtons(has, setHas)}
        </div>

        {/* Idade */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">
            Idade
          </label>
          <input
            type="number"
            min="0"
            max="130"
            placeholder="70"
            value={idade}
            onChange={(e) => setIdade(e.target.value)}
            className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 transition-colors"
          />
        </div>

        {/* Diabetes */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">
            Diabetes
          </label>
          {renderYesNoButtons(dm, setDm)}
        </div>

        {/* AVC/AIT/tromboembolismo prévio */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">
            AVC/AIT/tromboembolismo prévio
          </label>
          {renderYesNoButtons(avc, setAvc)}
        </div>

        {/* Doença vascular (IAM, DAP, placa aórtica) */}
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-2">
            Doença vascular (IAM, DAP, placa aórtica)
          </label>
          {renderYesNoButtons(doencaVascular, setDoencaVascular)}
        </div>
      </div>

      {/* Resultado */}
      {calculation.anySelected && (
        <div className={`mt-6 p-5 rounded-xl border ${calculation.badgeColor} transition-all`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-2xl font-bold">
                CHA2DS2-VA: {calculation.total} {calculation.total === 1 ? 'ponto' : 'pontos'}
              </div>
              <div className="text-sm font-semibold mt-0.5">
                {calculation.nivelRisco}
              </div>
              <p className="text-sm mt-1 opacity-90">
                {calculation.conduta}
              </p>
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
