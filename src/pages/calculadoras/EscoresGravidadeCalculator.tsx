import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Input, Label, Button } from '@/components/ui';
import { Copy, Check, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/useToast';

export function EscoresGravidadeCalculator() {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<'qsofa' | 'curb65' | 'wells' | 'meld'>('qsofa');
  const [copied, setCopied] = useState(false);

  // 1. qSOFA state
  const [qsofaFr, setQsofaFr] = useState(false);
  const [qsofaPas, setQsofaPas] = useState(false);
  const [qsofaGlasgow, setQsofaGlasgow] = useState(false);

  const qsofaScore = (qsofaFr ? 1 : 0) + (qsofaPas ? 1 : 0) + (qsofaGlasgow ? 1 : 0);

  // 2. CURB-65 state
  const [curbConfusao, setCurbConfusao] = useState(false);
  const [curbUreia, setCurbUreia] = useState(false);
  const [curbFr, setCurbFr] = useState(false);
  const [curbPa, setCurbPa] = useState(false);
  const [curbIdade, setCurbIdade] = useState(false);

  const curbScore =
    (curbConfusao ? 1 : 0) +
    (curbUreia ? 1 : 0) +
    (curbFr ? 1 : 0) +
    (curbPa ? 1 : 0) +
    (curbIdade ? 1 : 0);

  // 3. Wells TEP state
  const [wellsSinaisTvp, setWellsSinaisTvp] = useState(false); // +3
  const [wellsDiagMaisProvavel, setWellsDiagMaisProvavel] = useState(false); // +3
  const [wellsFc100, setWellsFc100] = useState(false); // +1.5
  const [wellsImobilizacao, setWellsImobilizacao] = useState(false); // +1.5
  const [wellsTvpTepPrevio, setWellsTvpTepPrevio] = useState(false); // +1.5
  const [wellsHemoptise, setWellsHemoptise] = useState(false); // +1
  const [wellsMalignidade, setWellsMalignidade] = useState(false); // +1

  const wellsScore =
    (wellsSinaisTvp ? 3 : 0) +
    (wellsDiagMaisProvavel ? 3 : 0) +
    (wellsFc100 ? 1.5 : 0) +
    (wellsImobilizacao ? 1.5 : 0) +
    (wellsTvpTepPrevio ? 1.5 : 0) +
    (wellsHemoptise ? 1 : 0) +
    (wellsMalignidade ? 1 : 0);

  // 4. MELD-Na state
  const [meldBilirrubina, setMeldBilirrubina] = useState('1.5');
  const [meldInr, setMeldInr] = useState('1.2');
  const [meldCreatinina, setMeldCreatinina] = useState('1.1');
  const [meldSodio, setMeldSodio] = useState('135');
  const [meldDialise, setMeldDialise] = useState(false);

  const meldResult = useMemo(() => {
    let bili = Math.max(1.0, parseFloat(meldBilirrubina.replace(',', '.')) || 1.0);
    let inr = Math.max(1.0, parseFloat(meldInr.replace(',', '.')) || 1.0);
    let cr = Math.max(1.0, parseFloat(meldCreatinina.replace(',', '.')) || 1.0);
    let na = parseFloat(meldSodio.replace(',', '.')) || 135;

    if (meldDialise || cr > 4.0) cr = 4.0;
    na = Math.min(137, Math.max(125, na));

    const meldI =
      0.957 * Math.log(cr) +
      0.378 * Math.log(bili) +
      1.12 * Math.log(inr) +
      0.643;
    const meldRaw = Math.round(meldI * 10);

    let meldNa = meldRaw;
    if (meldRaw > 11) {
      meldNa = Math.round(
        meldRaw + 1.32 * (137 - na) - 0.033 * meldRaw * (137 - na)
      );
    }
    meldNa = Math.min(40, Math.max(6, meldNa));

    let mortality = '< 2% em 90 dias';
    if (meldNa >= 40) mortality = '~71% em 90 dias';
    else if (meldNa >= 30) mortality = '~52% em 90 dias';
    else if (meldNa >= 20) mortality = '~20% em 90 dias';
    else if (meldNa >= 10) mortality = '~6% em 90 dias';

    return { meldRaw, meldNa, mortality };
  }, [meldBilirrubina, meldInr, meldCreatinina, meldSodio, meldDialise]);

  const copySummary = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    toast('Escore copiado para colar na evolução!', 'success');
  };

  return (
    <div className="space-y-4">
      {/* Sub-navigation for severity scores */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-fit flex-wrap">
        {[
          { id: 'qsofa', label: 'qSOFA (Sepse)' },
          { id: 'curb65', label: 'CURB-65 (Pneumonia)' },
          { id: 'wells', label: 'Wells (TEP)' },
          { id: 'meld', label: 'MELD-Na (Cirrose)' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id as any)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              subTab === t.id
                ? 'bg-white text-teal-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'qsofa' && (
        <Card className="border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-900">
              qSOFA (Quick SOFA) — Triagem de Sepse à Beira-Leito
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                copySummary(
                  `qSOFA: ${qsofaScore}/3 pontos (${
                    qsofaScore >= 2 ? 'Alto risco de desfecho desfavorável / Avaliar sepse' : 'Baixo risco pelo qSOFA'
                  })`
                )
              }
              className="h-8 text-xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
              Copiar para Evolução
            </Button>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              {[
                {
                  checked: qsofaFr,
                  onChange: setQsofaFr,
                  title: 'Frequência Respiratória ≥ 22 irpm',
                  pts: '+1 pt',
                },
                {
                  checked: qsofaPas,
                  onChange: setQsofaPas,
                  title: 'Pressão Arterial Sistólica ≤ 100 mmHg',
                  pts: '+1 pt',
                },
                {
                  checked: qsofaGlasgow,
                  onChange: setQsofaGlasgow,
                  title: 'Alteração do Estado Mental (Glasgow < 15)',
                  pts: '+1 pt',
                },
              ].map((item, idx) => (
                <label
                  key={idx}
                  className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-colors ${
                    item.checked ? 'bg-teal-50/70 border-teal-300' : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => item.onChange(e.target.checked)}
                      className="w-4 h-4 rounded accent-teal-600"
                    />
                    <span className="text-sm font-medium text-slate-800">{item.title}</span>
                  </div>
                  <span className="text-xs font-mono font-semibold text-teal-700">{item.pts}</span>
                </label>
              ))}
            </div>

            <div className="flex flex-col justify-between p-5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-500">Pontuação qSOFA</span>
                <div className="text-4xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {qsofaScore} <span className="text-base font-normal text-slate-500">/ 3 pontos</span>
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                  qsofaScore >= 2
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                <div className="font-bold flex items-center gap-1.5 text-sm">
                  {qsofaScore >= 2 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                  {qsofaScore >= 2 ? 'qSOFA Positivo (≥ 2 pontos)' : 'qSOFA Negativo (< 2 pontos)'}
                </div>
                <p>
                  {qsofaScore >= 2
                    ? 'Alto risco de disfunção orgânica e mortalidade. Solicitar lactato sérico, hemoculturas (2 pares), exames para SOFA completo e iniciar pacote de 1ª hora da sepse se infecção suspeita.'
                    : 'Baixo risco imediato pelo qSOFA. Atenção: qSOFA negativo não exclui sepse se houver forte suspeita clínica.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {subTab === 'curb65' && (
        <Card className="border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-900">
              CURB-65 — Gravidade na Pneumonia Adquirida na Comunidade (PAC)
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                copySummary(
                  `CURB-65: ${curbScore}/5 pontos (${
                    curbScore <= 1
                      ? 'Baixo risco — Tratamento ambulatorial'
                      : curbScore === 2
                      ? 'Risco intermediário — Considerar internação em enfermaria'
                      : 'Alto risco (PAC grave) — Internação hospitalar / Avaliar UTI'
                  })`
                )
              }
              className="h-8 text-xs"
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar para Evolução
            </Button>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2.5">
              {[
                { checked: curbConfusao, onChange: setCurbConfusao, title: 'C — Confusão mental aguda (desorientação)' },
                { checked: curbUreia, onChange: setCurbUreia, title: 'U — Ureia > 50 mg/dL (ou > 43 mg/dL)' },
                { checked: curbFr, onChange: setCurbFr, title: 'R — Frequência Respiratória ≥ 30 irpm' },
                { checked: curbPa, onChange: setCurbPa, title: 'B — PAS < 90 mmHg ou PAD ≤ 60 mmHg' },
                { checked: curbIdade, onChange: setCurbIdade, title: '65 — Idade ≥ 65 anos' },
              ].map((item, idx) => (
                <label
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                    item.checked ? 'bg-teal-50/70 border-teal-300' : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => item.onChange(e.target.checked)}
                      className="w-4 h-4 rounded accent-teal-600"
                    />
                    <span className="text-xs font-medium text-slate-800">{item.title}</span>
                  </div>
                  <span className="text-xs font-mono font-semibold text-teal-700">+1 pt</span>
                </label>
              ))}
            </div>

            <div className="flex flex-col justify-between p-5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-500">Escore CURB-65</span>
                <div className="text-4xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {curbScore} <span className="text-base font-normal text-slate-500">/ 5 pontos</span>
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                  curbScore >= 3
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : curbScore === 2
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                <div className="font-bold text-sm">
                  {curbScore <= 1
                    ? '0–1 ponto: Baixo Risco (Mortalidade < 3%)'
                    : curbScore === 2
                    ? '2 pontos: Risco Intermediário (Mortalidade ~9%)'
                    : '3–5 pontos: Alto Risco / PAC Grave (Mortalidade 15–40%)'}
                </div>
                <p>
                  {curbScore <= 1
                    ? 'Conduta sugerida: Tratamento ambulatorial (salvo hipoxemia SpO2 < 90%, incapacidade de ingestão oral ou vulnerabilidade social).'
                    : curbScore === 2
                    ? 'Conduta sugerida: Internação hospitalar em leito de enfermaria (ou hospital-dia/observação).'
                    : 'Conduta sugerida: Internação hospitalar imediata. Com 4 ou 5 pontos, avaliar necessidade de leito de UTI.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {subTab === 'wells' && (
        <Card className="border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-900">
              Escore de Wells — Tromboembolismo Pulmonar (TEP)
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                copySummary(
                  `Escore de Wells (TEP): ${wellsScore} pontos (${
                    wellsScore > 6 ? 'Alta probabilidade' : wellsScore >= 2 ? 'Probabilidade moderada' : 'Baixa probabilidade'
                  })`
                )
              }
              className="h-8 text-xs"
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar para Evolução
            </Button>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              {[
                { checked: wellsSinaisTvp, onChange: setWellsSinaisTvp, title: 'Sinais e sintomas clínicos de TVP', pts: '+3.0' },
                { checked: wellsDiagMaisProvavel, onChange: setWellsDiagMaisProvavel, title: 'TEP é o diagnóstico mais provável (ou tão provável quanto outro)', pts: '+3.0' },
                { checked: wellsFc100, onChange: setWellsFc100, title: 'Frequência cardíaca > 100 bpm', pts: '+1.5' },
                { checked: wellsImobilizacao, onChange: setWellsImobilizacao, title: 'Imobilização ≥ 3 dias ou cirurgia nas últimas 4 semanas', pts: '+1.5' },
                { checked: wellsTvpTepPrevio, onChange: setWellsTvpTepPrevio, title: 'TVP ou TEP prévio objetivamente diagnosticado', pts: '+1.5' },
                { checked: wellsHemoptise, onChange: setWellsHemoptise, title: 'Hemoptise', pts: '+1.0' },
                { checked: wellsMalignidade, onChange: setWellsMalignidade, title: 'Neoplasia ativa (em tratamento nos últimos 6 meses ou paliativo)', pts: '+1.0' },
              ].map((item, idx) => (
                <label
                  key={idx}
                  className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors ${
                    item.checked ? 'bg-teal-50/70 border-teal-300' : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => item.onChange(e.target.checked)}
                      className="w-4 h-4 rounded accent-teal-600"
                    />
                    <span className="text-xs font-medium text-slate-800">{item.title}</span>
                  </div>
                  <span className="text-xs font-mono font-semibold text-teal-700 shrink-0 ml-2">{item.pts}</span>
                </label>
              ))}
            </div>

            <div className="flex flex-col justify-between p-5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-4">
              <div>
                <span className="text-xs font-semibold text-slate-500">Pontuação de Wells (TEP)</span>
                <div className="text-4xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {wellsScore.toFixed(1)} <span className="text-base font-normal text-slate-500">pontos</span>
                </div>
              </div>

              <div
                className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                  wellsScore > 6
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : wellsScore > 4
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}
              >
                <div className="font-bold text-sm">
                  {wellsScore > 4
                    ? 'TEP Provável (> 4 pontos)'
                    : 'TEP Improvável (≤ 4 pontos)'}
                </div>
                <p>
                  {wellsScore > 4
                    ? 'Conduta sugerida: Solicitar Angio-TC de Tórax (protocolo TEP) diretamente e considerar anticoagulação empírica se não houver contraindicação.'
                    : 'Conduta sugerida: Solicitar D-dímero (ajustado por idade se > 50 anos: Idade × 10). Se D-dímero negativo, exclui TEP com segurança.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {subTab === 'meld' && (
        <Card className="border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-900">
              MELD-Na — Gravidade na Doença Hepática Crônica
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                copySummary(
                  `MELD-Na: ${meldResult.meldNa} pontos (MELD puro: ${meldResult.meldRaw} | Mortalidade estimada em 90d: ${meldResult.mortality})`
                )
              }
              className="h-8 text-xs"
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar para Evolução
            </Button>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Bilirrubina Total (mg/dL)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={meldBilirrubina}
                    onChange={(e) => setMeldBilirrubina(e.target.value)}
                    className="font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">INR</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={meldInr}
                    onChange={(e) => setMeldInr(e.target.value)}
                    className="font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Creatinina (mg/dL)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={meldCreatinina}
                    onChange={(e) => setMeldCreatinina(e.target.value)}
                    className="font-mono tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Sódio Sérico (mEq/L)</Label>
                  <Input
                    type="number"
                    step="1"
                    value={meldSodio}
                    onChange={(e) => setMeldSodio(e.target.value)}
                    className="font-mono tabular-nums"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 pt-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={meldDialise}
                  onChange={(e) => setMeldDialise(e.target.checked)}
                  className="w-4 h-4 rounded accent-teal-600"
                />
                Diálise ≥ 2 vezes na última semana (ou CVVHD nas últimas 24h)
              </label>
            </div>

            <div className="flex flex-col justify-between p-5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-semibold text-slate-500">Escore MELD-Na</span>
                  <div className="text-4xl font-bold font-mono tabular-nums text-teal-700 mt-1">
                    {meldResult.meldNa}
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold text-slate-500">MELD Clássico</span>
                  <div className="text-2xl font-bold font-mono tabular-nums text-slate-700 mt-2">
                    {meldResult.meldRaw}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white text-xs space-y-1">
                <div className="font-bold text-slate-900">
                  Mortalidade Estimada em 90 Dias: {meldResult.mortality}
                </div>
                <p className="text-slate-600">
                  Pacientes com MELD-Na ≥ 15 apresentam benefício claro de avaliação para listagem de transplante hepático.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
