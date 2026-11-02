/**
 * Prompt templates and clinical data pre-processors for POST /api/generate-evolucao.
 * Designed for high-precision Brazilian medical documentation (prontuário eletrônico).
 */

export type PromptType =
  | 'evolucao'
  | 'admissao'
  | 'sumario-alta'
  | 'ambulatorio-chat'
  | 'adaptador-dados'
  | 'revisor-medico'
  | 'conhecer-paciente'
  | 'organizar-hda'
  | 'gerar-exame-fisico'
  | 'passagem-caso'
  | 'interpretar-condutas';

/** Types handled outside this map because they need multimodal (image) parts. */
export const MULTIMODAL_TYPES = [
  'transcritor-exames',
  'detectar-campos-pdf',
  'auto-detectar-campos-pdf',
  'preencher-formulario-ia',
] as const;

export const ALL_KNOWN_TYPES = [
  'evolucao',
  'admissao',
  'sumario-alta',
  'ambulatorio-chat',
  'adaptador-dados',
  'revisor-medico',
  'conhecer-paciente',
  'organizar-hda',
  'gerar-exame-fisico',
  'passagem-caso',
  'interpretar-condutas',
  ...MULTIMODAL_TYPES,
];

function computeImcString(pesoStr?: string, alturaStr?: string): string {
  const peso = parseFloat(String(pesoStr || '').replace(',', '.'));
  let altura = parseFloat(String(alturaStr || '').replace(',', '.'));
  if (!peso || !altura || peso <= 0 || altura <= 0) return '';
  if (altura > 3) altura = altura / 100; // convert cm to m
  const imc = peso / (altura * altura);
  if (!isFinite(imc) || imc <= 0) return '';
  return imc.toFixed(1).replace('.', ',');
}

function formatPhysicalExamSummary(d: any): string {
  if (!d || typeof d !== 'object') return String(d || '');

  const lines: string[] = [];

  // SSVV
  const pa = d.paSist && d.paDiast ? `PA ${d.paSist}x${d.paDiast} mmHg` : '';
  const fc = d.fc ? `FC ${d.fc} bpm` : '';
  const fr = d.fr ? `FR ${d.fr} irpm` : '';
  const temp = d.temp ? `Tax ${d.temp} °C` : '';
  const spo2 = d.spo2 ? `SpO2 ${d.spo2}% (${d.ssvvO2 || d.suporteO2 || 'AA'}${d.ssvvO2Fluxo || d.suporteO2Fluxo ? ` ${d.ssvvO2Fluxo || d.suporteO2Fluxo}` : ''})` : '';
  const imcCalc = computeImcString(d.peso, d.altura) || (d.imc && d.imc !== '--.-' ? d.imc : '');
  const antropometria = [
    d.peso ? `Peso ${d.peso} kg` : '',
    d.altura ? `Altura ${d.altura} cm` : '',
    imcCalc ? `IMC ${imcCalc} kg/m²` : '',
  ].filter(Boolean).join(' | ');

  const ssvvLine = [pa, fc, fr, temp, spo2, antropometria].filter(Boolean).join(' | ');
  if (ssvvLine) lines.push(`SSVV: ${ssvvLine}`);

  // Geral
  if (d.geralNormal) {
    lines.push(`Geral: BEG, LOTE, eutrófico, normocorado, hidratado, acianótico, anictérico, afebril ao toque, TEC < 2s.${d.geralObs ? ` Obs: ${d.geralObs}` : ''}`);
  } else {
    const geralParts = [
      d.geralEstado,
      d.geralNivel,
      d.geralNutricao,
      d.geralHidratacao,
      d.geralColoracao,
      d.geralIctericia,
      d.geralCianose,
      d.geralTemp,
      d.geralTec ? `TEC ${d.geralTec}` : '',
      d.geralObs ? `Obs: ${d.geralObs}` : '',
    ].filter(Boolean).join(', ');
    lines.push(`Geral: ${geralParts}`);
  }

  // ACV
  if (d.acvNormal) {
    lines.push(`ACV: RCR em 2T, BNF, sem sopros audíveis.${d.acvObs ? ` Obs: ${d.acvObs}` : ''}`);
  } else {
    let soproDesc = 'sem sopros';
    if (d.acvSopro === 'Presente') {
      const focos = Array.isArray(d.acvSoproFoco) && d.acvSoproFoco.length ? `foco(s) ${d.acvSoproFoco.join('/')}` : '';
      const fases = Array.isArray(d.acvSoproFase) && d.acvSoproFase.length ? d.acvSoproFase.join('/') : '';
      const int = d.acvSoproIntensidade || '';
      const irrad = d.acvSoproIrradiacao ? `irradiando para ${d.acvSoproIrradiacao}` : '';
      soproDesc = `sopro ${[fases, int, focos, irrad].filter(Boolean).join(' ')}`;
    }
    lines.push(`ACV: ${[d.acvRitmo, d.acvTempos, `bulhas ${d.acvBulhas}`, soproDesc, d.acvObs].filter(Boolean).join(', ')}`);
  }

  // AR
  if (d.arNormal) {
    lines.push(`AR: MV presente bilateralmente e simétrico, sem ruídos adventícios, sem sinais de desconforto respiratório.${d.arObs ? ` Obs: ${d.arObs}` : ''}`);
  } else {
    const ruidos = Array.isArray(d.arRuidosList) && d.arRuidosList.length
      ? d.arRuidosList.includes('Sem RA')
        ? 'sem ruídos adventícios'
        : `presença de ${d.arRuidosList.join(', ')}${Array.isArray(d.arRuidosLocal) && d.arRuidosLocal.length ? ` em ${d.arRuidosLocal.join(', ')}` : ''}${d.arRuidosObs ? ` (${d.arRuidosObs})` : ''}`
      : d.arRuidos || 'sem RA';
    const detalhado = d.arDetalhado
      ? [
          Array.isArray(d.arExpansibilidade) && d.arExpansibilidade.length ? `Expansibilidade: ${d.arExpansibilidade.join(', ')}` : '',
          Array.isArray(d.arPercussao) && d.arPercussao.length ? `Percussão: ${d.arPercussao.join(', ')}` : '',
          Array.isArray(d.arFremito) && d.arFremito.length ? `FTV: ${d.arFremito.join(', ')}` : '',
          d.arDetalhadoObs || '',
        ].filter(Boolean).join('; ')
      : '';
    lines.push(`AR: MV ${d.arMurmurio || 'presente bilateral'}, ${ruidos}, esforço: ${d.arEsforco || 'sem sinais'}${detalhado ? `. ${detalhado}` : ''}${d.arObs ? `. Obs: ${d.arObs}` : ''}`);
  }

  // Abdome
  if (d.abdNormal) {
    lines.push(`Abdome: Plano, flácido, RHA+, indolor à palpação superficial e profunda, sem visceromegalias, descompressão brusca negativa, Murphy e Giordano negativos.${d.abdObs ? ` Obs: ${d.abdObs}` : ''}`);
  } else {
    let dorDesc = 'indolor à palpação';
    if (d.abdDor === 'Doloroso') {
      const tipo = d.abdDorTipo ? `à palpação ${d.abdDorTipo.toLowerCase()}` : '';
      const local = Array.isArray(d.abdDorLocal) && d.abdDorLocal.length ? `em ${d.abdDorLocal.join(', ')}` : '';
      dorDesc = `doloroso ${[tipo, local].filter(Boolean).join(' ')}`;
    }
    lines.push(
      `Abdome: ${[
        d.abdForma,
        d.abdConsistencia,
        `RHA ${d.abdRha}`,
        dorDesc,
        d.abdVisceromegalias,
        `DB ${d.abdDescompressao}`,
        `Murphy ${d.abdMurphy}`,
        `Giordano ${d.abdGiordano}`,
        d.abdTraube && d.abdTraube !== 'Não avaliado' ? `Traube ${d.abdTraube}` : '',
        d.abdObs,
      ].filter(Boolean).join(', ')}`
    );
  }

  // MMII
  if (d.mmiiNormal) {
    lines.push(`MMII: Extremidades bem perfundidas, aquecidas, sem edemas, panturrilhas livres e indolores, pulsos distais presentes e simétricos.${d.mmiiObs ? ` Obs: ${d.mmiiObs}` : ''}`);
  } else {
    const edemaDesc =
      d.mmiiEdema === 'Presente'
        ? `edema ${[d.mmiiEdemaGrau, d.mmiiEdemaLocal].filter(Boolean).join(' ')}`
        : 'sem edema';
    lines.push(
      `MMII: ${[
        d.mmiiPerfusao,
        edemaDesc,
        `panturrilhas ${d.mmiiPanturrilhas}`,
        `pulsos ${d.mmiiPulsos}`,
        d.mmiiObs,
      ].filter(Boolean).join(', ')}`
    );
  }

  // Neuro
  if (d.neuroNormal) {
    lines.push(`Neurológico: Lúcido e orientado no tempo e espaço (ECG 15), pupilas isocóricas e fotorreagentes, força muscular grau V global, sem déficits focais.${d.neuroObs ? ` Obs: ${d.neuroObs}` : ''}`);
  } else {
    if (d.neuroAvaliacao === 'Alterado') {
      lines.push(
        `Neurológico: Alterado. Glasgow (O: ${d.neuroGlasgowO}, V: ${d.neuroGlasgowV}, M: ${d.neuroGlasgowM}, P: ${d.neuroGlasgowP}), Pupilas: ${d.neuroPupilas}, Força Muscular (MSD ${d.neuroFmMSD}/5, MSE ${d.neuroFmMSE}/5, MID ${d.neuroFmMID}/5, MIE ${d.neuroFmMIE}/5), Babinski: ${d.neuroBabinski}, Marcha: ${d.neuroMarcha}.${d.neuroObs ? ` Obs: ${d.neuroObs}` : ''}`
      );
    } else {
      lines.push(`Neurológico: Sem déficits focais, pupilas ${d.neuroPupilas || 'PIFR'}.${d.neuroObs ? ` Obs: ${d.neuroObs}` : ''}`);
    }
  }

  return lines.join('\n');
}

type Builder = (formData: unknown) => string;

const builders: Record<PromptType, Builder> = {
  evolucao: (formData: any) => {
    const d = formData && typeof formData === 'object' ? formData : {};
    const efSummary = formatPhysicalExamSummary(d);
    const pInfo = d.patientInfo || {};

    return `Você é um médico preceptor e residente sênior redigindo uma EVOLUÇÃO MÉDICA DIÁRIA de enfermaria em prontuário hospitalar brasileiro (padrão HC/UFG, USP, SUS).

Seu objetivo é transformar os dados estruturados abaixo em uma evolução clínica impecável, técnica, concisa, coesa e diretamente pronta para ser colada no prontuário eletrônico (sem saudações, sem explicações extras e sem inventar dados não informados).

DADOS DO PACIENTE / CONTEXTO:
- Paciente: ${pInfo.name || 'Não informado'} ${pInfo.age ? `(${pInfo.age} anos, ${pInfo.sex || ''})` : ''}
- Leito: ${pInfo.bed || d.local || 'Enfermaria'} | Dias de Internação (DIH): ${pInfo.dih || 'Não informado'}
- Diagnóstico Principal (HD): ${pInfo.diagnosis || d.hipotesesDiagnosticas || 'Não informado'}
- Comorbidades / Antecedentes: ${pInfo.comorbidades || 'Não informado'}
- Alergias: ${pInfo.alergias || 'Nega alergias conhecidas'}
- Antibióticos / Terapias em curso: ${d.antibioticosEmUso || pInfo.antibioticos || 'Não informado'}
- Dispositivos invasivos: ${d.dispositivosEmUso || pInfo.dispositivos || 'Não informado'}

PARTE 1 — ESTADO GERAL E SUBJETIVO (RELATO DO PERÍODO):
- Setor/Acompanhante: ${d.local || 'Enfermaria'}, ${d.acompanhante || 'Desacompanhado'}
- Nível de consciência/Orientação: ${d.consciencia || 'Acordado'}, ${d.orientacao || 'Lúcido'}
- Padrão respiratório: ${d.respiratorio || 'Eupneico'} em ${d.suporteO2 || 'Ar ambiente'}${d.suporteO2Fluxo ? ` (${d.suporteO2Fluxo})` : ''}, desconforto: ${d.desconfortoResp || 'Sem sinais'}
- Hemodinâmica: ${d.hemodinamica || 'Estável'}, ${d.dva || 'Sem DVA'}${d.dvaDetalhe ? ` (${d.dvaDetalhe})` : ''}
- Evolução da queixa principal: ${d.statusQueixa || 'Nega queixas'}
- Dor: ${d.dor || 'Ausente'}${d.dorDetalhe ? ` (${d.dorDetalhe})` : ''}
- Intercorrências nas últimas 24h: ${d.intercorrencias || 'Sem intercorrências'}${d.intercorrenciasDetalhe ? ` (${d.intercorrenciasDetalhe})` : ''}
- Outras queixas: ${Array.isArray(d.outrasQueixas) && d.outrasQueixas.length ? d.outrasQueixas.join(', ') : 'Nega febre, náuseas, vômitos ou outras queixas álgicas'}
- Observações livres da evolução subjetiva: ${d.subjetivoLivre || 'Nenhuma'}
- Fisiológicas:
  * Sono: ${d.sonoQualidade || 'Bom'} (${d.sonoTipo || 'Reparador'})${d.sonoObs ? ` - ${d.sonoObs}` : ''}
  * Dieta: Via ${d.dietaVia || 'VO'}, aceitação ${d.dietaAceitacao || 'Boa'}${d.dietaObs ? ` - ${d.dietaObs}` : ''}
  * Diurese: ${d.diureseVol || 'Preservada'}, aspecto ${d.diureseAspecto || 'fisiológico'}${d.diureseDebito ? `, débito 24h: ${d.diureseDebito} mL` : ''}${d.diureseObs ? ` - ${d.diureseObs}` : ''}
  * Evacuações: ${d.evacuacaoFreq || 'Presente'}${d.evacuacaoObs ? ` - ${d.evacuacaoObs}` : ''}
  * Deambulação: ${d.deambulacaoStatus || 'Deambulando'}${d.deambulacaoObs ? ` - ${d.deambulacaoObs}` : ''}

PARTE 2 — EXAME FÍSICO E SINAIS VITAIS:
${efSummary}

PARTE 3 — EXAMES COMPLEMENTARES, IMPRESSÃO E CONDUTA:
- Exames recentes / Laboratório / Imagem: ${d.examesRecentes || 'Não informados nesta evolução'}
- Impressão / Avaliação Clínica: ${d.impressaoClinica || 'Paciente clinicamente estável, em acompanhamento na enfermaria.'}
- Conduta / Plano Terapêutico: ${d.condutaPlano || 'Mantida prescrição médica otimizada, vigilância clínica e cuidados gerais de enfermaria.'}

ESTRUTURA OBRIGATÓRIA DE SAÍDA:
# EVOLUÇÃO MÉDICA — ${pInfo.bed ? `${pInfo.bed.toUpperCase()}` : 'ENFERMARIA'}
(Se houver dados de identificação/HD/ATB/Dispositivos/Alergias, liste de forma enxuta no cabeçalho em linhas curtas com "> " ou marcadores limpos)

1. SUBJETIVO:
Redija 1 a 2 parágrafos coesos, em linguagem médica formal (ex: "Paciente encontra-se em leito de enfermaria, acompanhado/desacompanhado... Evolui nas últimas 24 horas sem intercorrências, referindo... Quanto às funções fisiológicas, refere sono reparador, boa aceitação da dieta por via oral, diurese preservada e hábito intestinal presente...").

2. OBJETIVO (EXAME FÍSICO):
- SSVV: (linha única compacta separada por barras ou pipes)
- Ectoscopia/Geral: ...
- ACV: ...
- AR: ...
- Abdome: ...
- MMII: ...
- Neurológico: ...
(Se houver exames complementares informados, adicione a subseção "- Exames Complementares: ...")

3. IMPRESSÃO E CONDUTA:
- Impressão: Síntese do quadro atual e estabilidade clínica.
- Conduta: Lista objetiva em tópicos (incluindo as condutas informadas pelo médico).`;
  },

  admissao: (formData: any) => {
    const d = formData && typeof formData === 'object' ? formData : {};
    const pInfo = d.patientInfo || {};

    return `Você é um médico residente sênior redigindo uma NOTA DE ADMISSÃO HOSPITALAR completa, técnica e estruturada em português do Brasil.

DADOS DO PACIENTE:
- Nome: ${pInfo.name || 'Não informado'} ${pInfo.age ? `| Idade: ${pInfo.age} anos | Sexo: ${pInfo.sex || ''}` : ''}
- Leito: ${pInfo.bed || 'Enfermaria'} | Hipótese de Entrada: ${pInfo.diagnosis || d.hipoteseDiagnostica || ''}

DADOS DA ANAMNESE E EXAME FÍSICO DE ADMISSÃO:
- Queixa Principal (QP): ${d.qp || 'Não informada'}
- Duração / Cronologia: ${d.hdaDuracao || 'Não informada'}
- Características: ${Array.isArray(d.hdaCaracteristicas) && d.hdaCaracteristicas.length ? d.hdaCaracteristicas.join(', ') : 'Não especificadas'}
- Relato da HDA: ${d.hdaTexto || 'Não informado'}
- Antecedentes Pessoais Patológicos (APP): ${Array.isArray(d.appComorbidades) && d.appComorbidades.length ? d.appComorbidades.join(', ') : 'Nega comorbidades diagnosticadas'}${d.appOutros ? ` | Outros/Cirurgias: ${d.appOutros}` : ''}
- Medicações de Uso Contínuo (MUC): ${d.medicacoesUso || 'Nega uso contínuo de medicações'}
- Alergias: ${d.alergias || 'Nega alergias'}${d.alergiasDetalhe ? ` (${d.alergiasDetalhe})` : ''}
- História Familiar: ${d.historiaFamiliar || 'Sem antecedentes familiares relevantes informados'}
- Hábitos de Vida: ${d.tabagismo || 'Não tabagista'}, ${d.etilismo || 'Não etilista'}, ${d.atividadeFisica || 'Sedentário'}
- Sinais Vitais de Admissão: PA ${d.efPa || '--'} mmHg | FC ${d.efFc || '--'} bpm | FR ${d.efFr || '--'} irpm | Tax ${d.efTemp || '--'} °C | SpO2 ${d.efSpo2 || '--'}%
- Exame Físico Segmentar:
  * Geral: ${d.efGeral === 'Alterado' ? d.efGeralObs || 'Alterado' : 'BEG, LOTE, corado, hidratado, acianótico, anictérico, afebril'}
  * Cardiovascular: ${d.efCv === 'Alterado' ? d.efCvObs || 'Alterado' : 'RCR em 2T, BNF, sem sopros'}
  * Respiratório: ${d.efResp === 'Alterado' ? d.efRespObs || 'Alterado' : 'MV+ bilateralmente, sem ruídos adventícios, eupneico'}
  * Abdome: ${d.efAbd === 'Alterado' ? d.efAbdObs || 'Alterado' : 'Plano, flácido, RHA+, indolor à palpação, sem VMG ou sinais de irritação peritoneal'}
  * Neurológico: ${d.efNeuro === 'Alterado' ? d.efNeuroObs || 'Alterado' : 'Glasgow 15, PIFR, sem déficits neurológicos focais'}
- Exames de Entrada: ${d.examesAdmissao || 'Não informados'}
- Hipóteses Diagnósticas (HD): ${d.hipoteseDiagnostica || pInfo.diagnosis || 'Em investigação'}
- Conduta Inicial / Prescrição de Admissão: ${d.condutaAdmissao || 'Internação hospitalar, monitorização clínica, exames laboratoriais e suporte terapêutico.'}

ESTRUTURA OBRIGATÓRIA DE SAÍDA:
# NOTA DE ADMISSÃO HOSPITALAR
1. IDENTIFICAÇÃO & QUEIXA PRINCIPAL (QP)
2. HISTÓRIA DA DOENÇA ATUAL (HDA) — Redija em prosa médica fluida, técnica e cronológica.
3. ANTECEDENTES PESSOAIS, MUC, ALERGIAS E HÁBITOS DE VIDA
4. EXAME FÍSICO DE ADMISSÃO (SSVV e aparelhos)
5. EXAMES COMPLEMENTARES DE ENTRADA (se houver)
6. HIPÓTESES DIAGNÓSTICAS (HD)
7. CONDUTA INICIAL

Escreva apenas o documento médico finalizado, sem comentários introdutórios.`;
  },

  'sumario-alta': (formData: any) => {
    const d = formData && typeof formData === 'object' ? formData : {};
    const pInfo = d.patientInfo || {};

    return `Você é um médico hospitalista sênior redigindo um SUMÁRIO DE ALTA HOSPITALAR E ORIENTAÇÕES DE ALTA.

DADOS:
- Paciente: ${pInfo.name || d.nome || 'Paciente'} ${pInfo.age ? `(${pInfo.age} anos, ${pInfo.sex || ''})` : ''}
- Período de Internação: Admissão em ${pInfo.admissionDate || d.dataAdmissao || '---'} | Alta em ${new Date().toLocaleDateString('pt-BR')} (${pInfo.dih ? `${pInfo.dih} dias` : ''})
- Diagnóstico Principal na Alta: ${d.diagnosticoAlta || pInfo.diagnosis || 'Não informado'}
- Diagnósticos Secundários / Comorbidades: ${d.comorbidades || pInfo.comorbidades || 'Não informados'}
- Resumo da Internação e Intervenções Realizadas: ${d.resumoInternacao || 'Não informado'}
- Exames Relevantes na Internação: ${d.examesRelevantes || 'Não informados'}
- Condição Clínica na Alta: ${d.condicaoAlta || 'Estável, afebril, recebendo alta hospitalar melhorado.'}
- Prescrição / Receita de Alta: ${d.prescricaoAlta || 'Conforme receita anexa'}
- Plano de Seguimento / Retorno Ambulatorial e Sinais de Alarme: ${d.orientacoesAlta || 'Retorno ambulatorial e procura ao pronto-socorro se sinais de alarme.'}

ESTRUTURA DE SAÍDA:
# SUMÁRIO DE ALTA HOSPITALAR
- IDENTIFICAÇÃO E PERÍODO DE INTERNAÇÃO
- DIAGNÓSTICO PRINCIPAL E COMORBIDADES
- RESUMO DA EVOLUÇÃO HOSPITALAR E PROCEDIMENTOS
- EXAMES RELEVANTES
- CONDIÇÃO DE SAÍDA
- PRESCRIÇÃO E MEDICAÇÕES PARA CASA
- ORIENTAÇÕES AO PACIENTE E SINAIS DE ALERTA (linguagem clara e objetiva para o paciente/família)

Escreva apenas o documento médico pronto para impressão/prontuário.`;
  },

  'ambulatorio-chat': (formData) => `Você é um preceptor clínico especialista em medicina ambulatorial baseada em evidências (diretrizes brasileiras vigentes / SBC / SBD / SBPT / Ministério da Saúde).
O médico enviará dados clínicos brutos, dúvidas diagnósticas ou sintomas de um paciente em consulta ambulatorial.

Sua tarefa:
1. **Registro Estruturado (SOAP)**:
   - **S (Subjetivo)**: Sintetize a história clínica e queixas em terminologia médica culta.
   - **O (Objetivo)**: Estruture sinais vitais, exame físico e exames citados.
   - **A (Avaliação)**: Liste a hipótese diagnóstica principal (com CID-10 sugerido) e diagnósticos diferenciais pertinentes.
   - **P (Plano / Conduta)**: Sugira a conduta prática detalhada (exames a solicitar, prescrição farmacológica com posologia habitual, medidas não farmacológicas, encaminhamentos e sinais de alarme/retorno).

Dados fornecidos pelo médico:
${typeof formData === 'string' ? formData : JSON.stringify(formData, null, 2)}`,

  'adaptador-dados': (formData: any) => {
    const rawText = typeof formData === 'object' && formData !== null ? formData.texto || JSON.stringify(formData) : String(formData || '');
    const estilo = typeof formData === 'object' && formData !== null && formData.estilo ? formData.estilo : 'Evolução / Prontuário Padrão';

    return `Você é um médico redator especialista em documentação clínica hospitalar e ambulatorial.
O usuário fornecerá anotações médicas rápidas, abreviadas ou desorganizadas.

Estilo de saída solicitado: **${estilo}**

Regras estritas:
1. Reescreva e estruture os dados em linguagem médica formal, técnica, precisa e fluida (português do Brasil).
2. Expanda abreviações informais para a terminologia semiológica correta (ex: "pct" -> "Paciente", "dor abd qid" -> "dor abdominal em quadrante inferior direito / fossa ilíaca direita", "beg lote" -> "Bom estado geral, lúcido e orientado no tempo e no espaço").
3. Organize em seções claras de acordo com o estilo solicitado (${estilo}).
4. NUNCA invente dados clínicos, sinais vitais ou exames que não estejam presentes no rascunho.

Rascunho original:
${rawText}

Forneça apenas o texto médico reestruturado, pronto para copiar e colar no prontuário.`;
  },

  'revisor-medico': (formData: any) => {
    const rawText = typeof formData === 'object' && formData !== null ? formData.texto || '' : String(formData || '');
    const objetivo = typeof formData === 'object' && formData !== null ? formData.objetivo || 'Aprimorar terminologia médica e clareza' : 'Aprimorar terminologia médica e clareza';

    return `Você é um médico revisor especialista em redação médica e segurança jurídico-documental de prontuários.
Objetivo da revisão: **${objetivo}**

Aprimore o texto clínico abaixo garantindo:
- Terminologia semiológica e técnica rigorosa no padrão médico brasileiro;
- Clareza, concisão, coesão gramatical e proteção médico-legal;
- Fidelidade absoluta aos fatos clínicos informados (não invente achados).

Texto original:
${rawText}

Retorne apenas o texto médico revisado e pronto para uso.`;
  },

  'conhecer-paciente': (formData) => `Você é um médico assistente preparando o resumo pré-consulta de um paciente ambulatorial a partir das evoluções anteriores do prontuário.
Analise atentamente o prontuário abaixo e gere um **PREPARO DE PRÉ-CONSULTA AMBULATORIAL** altamente escaneável e prático:

### 1. Perfil Clínico & Diagnósticos Ativos
- Resumo de 1–2 linhas de quem é o paciente, diagnósticos principais (oncológicos, cirúrgicos ou clínicos) e status atual.

### 2. Comorbidades, Cirurgias Prévias & Alergias
- Lista em tópicos curtos.

### 3. Linha do Tempo / Resumo da História e Última Consulta
- Síntese objetiva da evolução até a última consulta.

### 4. Medicamentos em Uso Contínuo (MUC Atualizado)
- Lista estruturada com nome, dose e posologia (se constar no texto).

### 5. Checklist: O Que Cobrar e Avaliar Hoje
- Exames laboratoriais, de imagem ou anatomopatológicos que foram solicitados na última consulta;
- Sintomas ou respostas terapêuticas que precisam ser reavaliadas hoje;
- Pendências de encaminhamento ou programação cirúrgica.

Prontuário anterior:
${formData}`,

  'organizar-hda': (formData) => `Você é um médico preceptor de semiologia médica. O usuário enviará um relato bruto da História da Doença Atual (HDA).
Reescreva esse relato em um parágrafo (ou mais, se necessário) de **HDA padrão ouro** para prontuário médico:
- Inicie de forma clássica ("Paciente refere que há cerca de...", ou "Paciente comparece à consulta para seguimento de... / referindo...");
- Caracterize adequadamente os sintomas (início, duração, localização, caráter, intensidade, irradiação, fatores de melhora/piora, sintomas associados e evolução cronológica);
- Destaque as negativas pertinentes mencionadas no rascunho;
- Mantenha fidelidade estrita aos dados fornecidos (não invente sintomas não relatados);
- Entregue APENAS o texto da HDA pronto para colar no prontuário, sem títulos desnecessários ou comentários.

Relato bruto:
${formData}`,

  'gerar-exame-fisico': (formData) => {
    const summary = formatPhysicalExamSummary(formData);
    return `Você é um médico especialista em semiologia clínica. Com base nos parâmetros estruturados abaixo, redija a descrição do **EXAME FÍSICO** pronta para o prontuário médico.

Forneça o resultado em duas partes limpas:
1. Uma linha inicial de **SSVV** (Sinais Vitais e Antropometria, incluindo o IMC calculado se houver peso e altura).
2. O **Exame Físico Segmentar** bem articulado, utilizando a terminologia médica brasileira padrão (Geral, ACV, AR, Abdome, MMII, Neurológico), sem omitir nenhum achado patológico ou observação informada.

Parâmetros coletados:
${summary}

Responda apenas com o texto do exame físico pronto para copiar e colar.`;
  },

  'passagem-caso': (formData: any) => `Você é um médico residente sênior preparando uma **PASSAGEM DE CASO ESTRUTURADA (padrão SBAR / Discussão com Preceptor)** clara, direta e completa.
Consolide todas as informações disponíveis abaixo em um texto estruturado pelos seguintes tópicos:

1. **IDENTIFICAÇÃO & CONTEXTO CLÍNICO** (Quem é o paciente, antecedentes principais, motivo do acompanhamento)
2. **HISTÓRIA ATUAL & EVOLUÇÃO (HDA)** (Síntese da queixa atual e evolução recente)
3. **EXAME FÍSICO & EXAMES COMPLEMENTARES** (Sinais vitais, achados positivos e negativas relevantes)
4. **IMPRESSÃO DIAGNÓSTICA & LISTA DE PROBLEMAS**
5. **PROPOSTA DE CONDUTA / PONTOS PARA DISCUSSÃO**

Informações da consulta:
${typeof formData === 'string' ? formData : JSON.stringify(formData, null, 2)}

Escreva apenas a passagem de caso estruturada, pronta para leitura rápida ou envio.`,

  'interpretar-condutas': (formData) => `Você é um assistente médico inteligente. Analise a lista de condutas médicas abaixo e identifique TODOS os documentos médicos que precisam ser emitidos para o paciente.

Para cada documento identificado, extraia também o conteúdo clínico estruturado para que o formulário já seja preenchido automaticamente!

Retorne APENAS um array JSON válido (sem blocos markdown \`\`\`json), onde cada objeto segue exatamente este formato:
[
  {
    "tipo": "Receita Simples" | "Receita Controlada" | "Pedido de Exames" | "Encaminhamento" | "Atestado Médico" | "AIH",
    "titulo": "Título descritivo curto (ex: Receita Simples — Ajuste de Amiodarona)",
    "resumo": "Resumo em 1 linha do que consta neste documento",
    "especialidade": "Nome da especialidade (apenas se for Encaminhamento, senão string vazia)",
    "motivo": "Texto clínico formal justificando o encaminhamento, exame ou internação (se aplicável)",
    "dias": "Número de dias de afastamento (apenas se for Atestado Médico, ex: '3')",
    "cid": "Código CID-10 se mencionado ou inferido claramente, senão string vazia",
    "prescricaoTexto": "Texto completo formatado da prescrição ou da lista de exames solicitados",
    "medications": [
      {
        "via": "Oral",
        "item": "Nome do medicamento + concentração (ex: Amiodarona 200mg)",
        "quantidade": "Uso contínuo ou quantidade (ex: CONTÍNUO ou 1 caixa)",
        "posologia": "Instrução clara ao paciente (ex: Tomar 1 comprimido via oral 1x ao dia)"
      }
    ]
  }
]

Condutas informadas pelo médico:
${formData}`,
};

const fallbackBuilder: Builder = (formData) => `Escreva um texto médico profissional em português do Brasil com base nestes dados: ${JSON.stringify(formData)}`;

export function buildPrompt(type: string, formData: unknown): string {
  const builder = (builders as Record<string, Builder>)[type];
  return (builder ?? fallbackBuilder)(formData);
}

export function buildTranscritorPrompt(customPrompt: string | undefined, outputFormat: string | undefined): string {
  const defaultFormatPrompt = `
DIRETRIZES OBRIGATÓRIAS DE TRANSCRIÇÃO DE EXAMES (FORMATO COMPACTO ABREVIADO):
1. Você pode receber uma ou várias imagens/PDFs ao mesmo tempo. Consolide todos os exames da mesma data em uma única sequência contínua separada por " / ", iniciando apenas com a data no formato "DD/MM/AA:".
2. PROIBIDO ESCREVER NOMES DE EXAMES POR EXTENSO: NUNCA escreva "HEMOGLOBINA", "HEMATÓCRITO", "LEUCÓCITOS", "PLAQUETAS", "GLICOSE", "HEMOGLOBINA GLICADA", "UREIA", "CREATININA", "TAXA DE FILTRAÇÃO GLOMERULAR", "SÓDIO", "POTÁSSIO", "CÁLCIO", "FÓSFORO", "MAGNÉSIO", "FERRO SÉRICO", "CAPACIDADE TOTAL DE LIGAÇÃO DO FERRO", "PROTEÍNA C REATIVA", "GAMA GLUTAMIL TRANSFERASE", "FOSFATASE ALCALINA", "TRIGLICERÍDEOS", "COLESTEROL TOTAL", "PTH - PARATORMÔNIO", "T4 L - TIROXINA LIVRE", "ÁCIDO FÓLICO", "ÁCIDO ÚRICO", "ÁCIDO LÁCTICO", etc. Use EXCLUSIVAMENTE as siglas abaixo.
3. PROIBIDO INCLUIR UNIDADES DE MEDIDA E VALORES DE REFERÊNCIA:
   - NUNCA escreva unidades (mg/dL, g/dL, ug/dL, pg/mL, ng/dL, uUI/mL, ug/L, mmol/L, mg/L, U/L, %, mm³, 10^6/µL).
   - NUNCA escreva "(VR: ...)" ao lado dos resultados.
   - NUNCA inclua "Glicose Média Estimada (GME)".
   - No hemograma, inclua APENAS: HB / HT / VCM / HCM / RW / LEUCO / PLQ. Omita Eritrócitos, CHCM, VPM e a contagem diferencial de leucócitos se normal ou igual a zero (NUNCA escreva BLASTOS 0, PROMIELÓCITOS 0, MIELÓCITOS 0, METAMIELÓCITOS 0, BASTONETES 0, SEGMENTADOS, EOSINÓFILOS, BASÓFILOS, LINFÓCITOS, MONÓCITOS, exceto se houver desvio/alteração relevante como BAST elevado).
   - Em LEUCO e PLQ, escreva o número inteiro sem ponto de milhar (ex: LEUCO 4610 / PLQ 95000).
   - A Taxa de Filtração Glomerular (TFG / CKD-EPI) deve SEMPRE vir entre parênteses colada logo após a Creatinina no formato: CR <valor> (CKD <valor>) — ex: CR 1,7 (CKD 41).

TABELA OFICIAL DE ABREVIAÇÕES OBRIGATÓRIAS (SEMPRE EM CAIXA ALTA E SEM ACENTO):
- Hemoglobina -> HB
- Hematócrito -> HT
- VCM -> VCM | HCM -> HCM | RDW -> RW
- Leucócitos -> LEUCO (sem ponto, ex: LEUCO 4610)
- Plaquetas -> PLQ (sem ponto, ex: PLQ 95000)
- Glicose / Glicemia -> GLIC
- Hemoglobina Glicada (A1C) -> HBA1C
- Ureia -> UR
- Creatinina + TFG/CKD-EPI -> CR <valor> (CKD <valor>)
- Sódio -> NA | Potássio -> K | Cálcio -> CA | Cálcio Iônico -> CAI | Magnésio -> MG | Fósforo -> P
- TGO / AST -> TGO | TGP / ALT -> TGP | Gama-GT -> GGT | Fosfatase Alcalina -> FA
- Bilirrubina Total -> BT | Direta -> BD | Indireta -> BI | Albumina -> ALB | Proteínas Totais -> PT
- Desidrogenase Láctica (LDH) -> DHL | Amilase -> AMIL | Lipase -> LIP | CPK -> CPK
- Proteína C Reativa -> PCR | VHS -> VHS
- Ácido Úrico -> AC URICO | Ácido Láctico / Lactato -> LACT
- Colesterol Total -> CT | HDL -> HDL | LDL -> LDL | VLDL -> VLDL | Triglicerídeos -> TG
- TSH -> TSH | T4 Livre -> T4L | T3 Livre -> T3L | Paratormônio -> PTH
- Vitamina B12 -> B12 | Ácido Fólico -> AC FOLICO | Vitamina D (25-OH) -> VIT D
- Ferritina -> FERRITINA | Ferro Sérico -> FE | Capacidade Total de Ligação do Ferro (TIBC/CTLF) -> TIBIC | Saturação da Transferrina -> IST | Capacidade de Fixação Latente do Ferro -> CFLF
- Imunoglobulinas -> IGG / IGM / IGA
- TAP / TP -> TAP <seg> (INR <val>) | TTPa -> TTPA <seg> (R <val>)
- Eletroforese de Proteínas (em linha própria sem barras):
  EFP PT <val> ALBUM <val> GLOBULINA <val> PICO <val> REL A/G <val>
- Cadeias Leves Livres (em linha própria sem barras):
  KAPPA <val> LAMBDA <val> REL K/L <val>

EXEMPLO EXATO DO FORMATO ESPERADO PARA EXAMES LABORATORIAIS:
12/08/26: HB 11,5 / HT 33,6 / VCM 99 / HCM 33,9 / RW 12,6 / LEUCO 4610 / PLQ 95000 / GLIC 176 / HBA1C 7,4 / UR 55 / CR 1,7 (CKD 41) / NA 138 / K 4,3 / TGO 31 / TGP 41 / CA 9,3 / PCR 1,23 / TSH 1,21 / B12 655 / FERRITINA 612 / AC FOLICO 7,26 / TIBIC 340 / IGG 1316 / IGM 89 / IGA 216 / 
EFP PT 7,1 ALBUM 3,85 GLOBULINA 3,27 PICO 0,28 REL A/G 1,18
KAPPA 40,11 LAMBDA 17,63 REL K/L 2,28

Se for EXAME DE IMAGEM (TC, RM, RX, USG, ECO, EDA, Colonoscopia), estruture assim:
>> [NOME DO EXAME EM CAIXA ALTA] (DD/MM/AA):
- DESCRIÇÃO / ACHADOS PRINCIPAIS: (Resumo técnico objetivo dos achados relevantes)
- CONCLUSÃO / IMPRESSÃO: (Resumo fiel da conclusão do laudo)
`;

  return `Você é um médico especialista em transcrição enxuta e abreviada de exames complementares para prontuário hospitalar.
Transcreva fielmente os resultados contidos nas imagens/documentos ou no texto enviado, convertendo TODOS os nomes de exames laboratoriais para suas abreviações clínicas padronizadas em caixa alta, sem unidades de medida e sem valores de referência.
${outputFormat && outputFormat.trim() ? `\nO usuário definiu um FORMATO DE SAÍDA PERSONALIZADO prioritário:\n"""\n${outputFormat}\n"""\nSiga rigorosamente a estrutura e o estilo deste formato personalizado!` : defaultFormatPrompt}

Instruções ou texto complementar enviado pelo usuário: ${customPrompt || 'Transcreva os exames anexados no formato abreviado padrão.'}
Retorne apenas a transcrição pronta para copiar e colar no prontuário, sem frases introdutórias e sem markdown (**).`;
}

/**
 * Deterministic post-processor that guarantees lab exam transcriptions use compact clinical
 * abbreviations (HB, HT, VCM, HCM, RW, LEUCO, PLQ, GLIC, HBA1C, UR, CR (CKD), NA, K, etc.)
 * and strips verbose units, reference values (VR: ...), and zero-count differential noise.
 */
export function postProcessTranscritorOutput(rawText: string, customOutputFormat?: string): string {
  if (!rawText || typeof rawText !== 'string') return rawText;

  const hasCustomFormat = Boolean(customOutputFormat && customOutputFormat.trim());
  const customWantsVr = hasCustomFormat && /\bVR\b/i.test(customOutputFormat!);

  let text = rawText.replace(/\*\*/g, '').trim();

  // 1. Normalize ">> LABS (DD/MM/YYYY):" or "LABS (DD/MM/YY):" to "DD/MM/YY:"
  if (!hasCustomFormat) {
    text = text.replace(/(?:>>\s*)?LABS?\s*\((\d{2}\/\d{2}\/)(?:20)?(\d{2})\)\s*:/gi, '$1$2:');
    text = text.replace(/^(\s*)(?:>>\s*)?(\d{2}\/\d{2}\/)20(\d{2})\s*:/gm, '$1$2$3:');
  }

  // 2. Strip "(VR: ...)" unless custom format explicitly wants VR
  if (!customWantsVr) {
    text = text.replace(/\s*\((?:VR|V\.R\.|Ref\.?|Valores?\s+de\s+refer[êe]ncia)\s*:[^)]*\)/gi, '');
  }

  // 3. Process line by line so we don't corrupt imaging reports (TC/RM/USG descriptions)
  const rawLines = text.split('\n');
  const processedLines: string[] = [];

  for (const rawLine of rawLines) {
    let line = rawLine.trim();
    if (!line) {
      processedLines.push('');
      continue;
    }

    // Leave imaging report description/conclusion lines untouched
    const isImagingProse =
      /^[-•*]\s*(?:DESCRI[ÇC][ÃA]O|ACHADOS|CONCLUS[ÃA]O|IMPRESS[ÃA]O|LAUDO|T[ÉE]CNICA)/i.test(line) ||
      /^>>\s*(?:TC|TOMOGRAFIA|RM|RESSON[ÂA]NCIA|USG|ULTRASSONOGRAFIA|RX|RAIO[\s-]X|ECO|ECOCARDIOGRAMA|EDA|ENDOSCOPIA|COLONOSCOPIA|BI[ÓO]PSIA|ANATOMOPATOL[ÓO]GICO)\b/i.test(line);

    if (isImagingProse) {
      processedLines.push(line);
      continue;
    }

    // Replace mid-line ">>" with " / "
    line = line.replace(/\s*>>\s*/g, ' / ').replace(/^\s*\/\s*/, '');

    // Remove Glicose Média Estimada (GME)
    line = line.replace(
      /(?:\/\s*)?Glicose\s+M[ée]dia\s+Estimada\s*(?:\(GME\))?\s*[\d.,]+\s*(?:mg\/dL)?\s*/gi,
      ' '
    );

    // Remove zero-value or routine differential leucogram items when dumped verbatim from lab PDF
    line = line.replace(
      /\s*\/\s*(?:BLASTOS|PROMIEL[ÓO]CITOS|MIELOBASTOS|MIELOBLASTOS|MIEL[ÓO]CITOS|METAMIEL[ÓO]CITOS|BASTONETES|LINF[ÓO]CITOS\s+AT[ÍI]PICOS|PLASM[ÓO]CITOS)\s+0+(?:[.,]0+)?(?:\s*\([^)]*\))?(?=\s*\/|\s*$)/gi,
      ''
    );
    line = line.replace(
      /\s*\/\s*(?:SEGMENTADOS|EOSIN[ÓO]FILOS|BAS[ÓO]FILOS|LINF[ÓO]CITOS(?:\s+T[ÍI]PICOS)?|MON[ÓO]CITOS)\s+[\d.,]+\s*\([\d.,]+%\)(?=\s*\/|\s*$)/gi,
      ''
    );

    // Remove ERITRÓCITOS, CHCM, VPM when part of standard hemograma dump
    line = line.replace(/\b(?:ERITR[ÓO]CITOS|HEM[ÁA]CIAS)\s+[\d.,]+\s*(?:10\^\d+\/[µu]L)?\s*\/\s*/gi, '');
    line = line.replace(/\s*\/\s*(?:CHCM|VPM)\s+[\d.,]+(?=\s*\/|\s*$)/gi, '');

    // Replace full lab exam names with standard abbreviations (ordered longest/most specific first)
    const replacements: Array<[RegExp, string]> = [
      [/\bHEMOGLOBINA\s+GLICADA(?:\s*[-–—]\s*A1C|\s*\(HBA1C\)|\s*A1C|\s*\(A1C\))?\b/gi, 'HBA1C'],
      [/\bCONCENTRA[ÇC][ÃA]O\s+DE\s+HEMOGLOBINA\s+CORPUSCULAR\s+M[ÉE]DIA(?:\s*\(CHCM\))?\b/gi, 'CHCM'],
      [/\bHEMOGLOBINA\s+CORPUSCULAR\s+M[ÉE]DIA(?:\s*\(HCM\))?\b/gi, 'HCM'],
      [/\bVOLUME\s+CORPUSCULAR\s+M[ÉE]DIO(?:\s*\(VCM\))?\b/gi, 'VCM'],
      [/\bVOLUME\s+PLAQUET[ÁA]RIO\s+M[ÉE]DIO(?:\s*\(VPM\))?\b/gi, 'VPM'],
      [/\bHEMOGLOBINA\b/gi, 'HB'],
      [/\bHEMAT[ÓO]CRITO\b/gi, 'HT'],
      [/\bRDW\b/gi, 'RW'],
      [/\bLEUC[ÓO]CITOS(?:\s+TOTAIS|\s+GLOBAL)?\b/gi, 'LEUCO'],
      [/\bPLAQUETAS\b|\bPLAQ\b/gi, 'PLQ'],
      [/\bGLICOSE(?:\s+EM\s+JEJUM|\s+DE\s+JEJUM|\s+S[ÉE]RICA|\s+PLASM[ÁA]TICA)?\b|\bGLICEMIA(?:\s+DE\s+JEJUM|\s+EM\s+JEJUM)?\b/gi, 'GLIC'],
      [/\bUREIA(?:\s+S[ÉE]RICA)?\b/gi, 'UR'],
      [/\bCREATININA(?:\s+S[ÉE]RICA)?\b/gi, 'CR'],
      [/\bTAXA\s+DE\s+FILTRA[ÇC][ÃA]O\s+GLOMERULAR(?:\s+ESTIMADA)?(?:\s*\((?:TFG|CKD-EPI|eTFG)\))?\b|\bRITMO\s+DE\s+FILTRA[ÇC][ÃA]O\s+GLOMERULAR\b|\bCKD-EPI\b|\bTFGe?\b/gi, 'CKD'],
      [/\bS[ÓO]DIO(?:\s+S[ÉE]RICO)?\b|\bNa\b/g, 'NA'],
      [/\bPOT[ÁA]SSIO(?:\s+S[ÉE]RICO)?\b/gi, 'K'],
      [/\bC[ÁA]LCIO\s+I[ÔO]NICO\b|\bC[ÁA]LCIO\s+IONIZADO\b|\bCaI\b/gi, 'CAI'],
      [/\bC[ÁA]LCIO(?:\s+TOTAL|\s+S[ÉE]RICO)?\b|\bCaT\b|\bCa\b/g, 'CA'],
      [/\bMAGN[ÉE]SIO(?:\s+S[ÉE]RICO)?\b|\bMg\b/g, 'MG'],
      [/\bF[ÓO]SFORO(?:\s+S[ÉE]RICO|\s+INORG[ÂA]NICO)?\b/gi, 'P'],
      [/\bASPARTATO\s+AMINOTRANSFERASE(?:\s*\((?:AST|TGO)\))?\b|\bTRANSAMINASE\s+(?:GLUT[ÂA]MICO[\s-]+)?OXALAC[ÉE]TICA\b|\bAST\s*\/\s*TGO\b|\bTGO\s*\/\s*AST\b|\bTGO\s*\(AST\)\b|\bAST\s*\(TGO\)\b/gi, 'TGO'],
      [/\bALANINA\s+AMINOTRANSFERASE(?:\s*\((?:ALT|TGP)\))?\b|\bTRANSAMINASE\s+(?:GLUT[ÂA]MICO[\s-]+)?PIR[ÚU]VICA\b|\bALT\s*\/\s*TGP\b|\bTGP\s*\/\s*ALT\b|\bTGP\s*\(ALT\)\b|\bALT\s*\(TGP\)\b/gi, 'TGP'],
      [/\bGAMA\s*[-–—]?\s*GLUTAMIL\s+TRANSFERASE(?:\s*\(GGT\))?\b|\bGAMA\s*[-–—]?\s*GT\b/gi, 'GGT'],
      [/\bFOSFATASE\s+ALCALINA(?:\s*\(FA\))?\b|\bFALC\b/gi, 'FA'],
      [/\bPROTE[ÍI]NA\s+C\s+REATIVA(?:\s+ULTRASSENS[ÍI]VEL)?(?:\s*\(PCR\))?\b/gi, 'PCR'],
      [/\bVELOCIDADE\s+DE\s+HEMOSSEDIMENTA[ÇC][ÃA]O(?:\s*\(VHS\))?\b/gi, 'VHS'],
      [/\bPTH\s*[-–—]\s*PARATORM[ÔO]NIO\b|\bPARATORM[ÔO]NIO(?:\s*[-–—]\s*PTH|\s+INTACTO|\s*\(PTH\))?\b/gi, 'PTH'],
      [/\bT4\s*L?\s*[-–—]\s*TIROXINA\s+LIVRE\b|\bTIROXINA\s+LIVRE(?:\s*[-–—]\s*T4\s*L?|\s*\(T4\s*L(?:IVRE)?\))?\b|\bT4\s+LIVRE\b|\bT4\s+L\b/gi, 'T4L'],
      [/\bT3\s*L?\s*[-–—]\s*TRIIODOTIRONINA\s+LIVRE\b|\bTRIIODOTIRONINA\s+LIVRE\b|\bT3\s+LIVRE\b|\bT3\s+L\b/gi, 'T3L'],
      [/\bHORM[ÔO]NIO\s+TIREOESTIMULANTE(?:\s*[-–—]\s*TSH|\s*\(TSH\))?\b|\bTSH\s+ULTRASSENS[ÍI]VEL\b/gi, 'TSH'],
      [/\bVITAMINA\s+B\s*12\b|\bCIANOCOBALAMINA\b/gi, 'B12'],
      [/\b[ÁA]CIDO\s+F[ÓO]LICO\b|\bFOLATO\b/gi, 'AC FOLICO'],
      [/\b25\s*[-–—]?\s*(?:OH|HIDROXI)\s*[-–—]?\s*VITAMINA\s+D\b|\bVITAMINA\s+D(?:\s+25\s+HIDROXI|\s*\(25-OH\))?\b/gi, 'VIT D'],
      [/\bCAPACIDADE\s+TOTAL\s+DE\s+LIGA[ÇC][ÃA]O\s+DO\s+FERRO(?:\s*\((?:TIBC|TIBIC|CTLF)\))?\b|\bCAPACIDADE\s+TOTAL\s+DE\s+COMBINA[ÇC][ÃA]O\s+DO\s+FERRO\b|\bTIBC\b|\bCTLF\b/gi, 'TIBIC'],
      [/\bCAPACIDADE\s+DE\s+FIXA[ÇC][ÃA]O\s+LATENTE\s+DO\s+FERRO(?:\s*\(CFLF\))?\b|\bCAPACIDADE\s+LATENTE\s+DE\s+LIGA[ÇC][ÃA]O\s+DO\s+FERRO\b/gi, 'CFLF'],
      [/(?:%\s*DE\s+|\b[ÍI]NDICE\s+DE\s+)?SATURA[ÇC][ÃA]O\s+DA\s+TRANSFERRINA(?:\s*\(IST\))?/gi, 'IST'],
      [/\bFERRO\s+S[ÉE]RICO\b|\bFERRO\b(?!\s+LIVRE)/gi, 'FE'],
      [/\bTRIGLICER[ÍI]DEOS\b|\bTRIGLIC[ÉE]RIDES\b|\bTRIG\b/gi, 'TG'],
      [/\bCOLESTEROL\s+TOTAL\b/gi, 'CT'],
      [/\bCOLESTEROL\s+HDL\b|\bHDL\s*[-–—]\s*COLESTEROL\b/gi, 'HDL'],
      [/\bCOLESTEROL\s+LDL\b|\bLDL\s*[-–—]\s*COLESTEROL\b/gi, 'LDL'],
      [/\bCOLESTEROL\s+VLDL\b|\bVLDL\s*[-–—]\s*COLESTEROL\b/gi, 'VLDL'],
      [/\b[ÁA]CIDO\s+[ÚU]RICO(?:\s+S[ÉE]RICO)?\b/gi, 'AC URICO'],
      [/\b[ÁA]CIDO\s+L[ÁA]CTICO\b|\bLACTATO\b/gi, 'LACT'],
      [/\bDESIDROGENASE\s+L[ÁA]CTICA(?:\s*\((?:LDH|DHL)\))?\b|\bLDH\b/gi, 'DHL'],
      [/\bBILIRRUBINA\s+TOTAL\b/gi, 'BT'],
      [/\bBILIRRUBINA\s+DIRETA\b/gi, 'BD'],
      [/\bBILIRRUBINA\s+INDIRETA\b/gi, 'BI'],
      [/\bIMUNOGLOBULINA\s+G(?:\s*\(IGG\))?\b|\bIgG\b/g, 'IGG'],
      [/\bIMUNOGLOBULINA\s+M(?:\s*\(IGM\))?\b|\bIgM\b/g, 'IGM'],
      [/\bIMUNOGLOBULINA\s+A(?:\s*\(IGA\))?\b|\bIgA\b/g, 'IGA'],
      [/\bIMUNOGLOBULINA\s+E(?:\s*\(IGE\))?\b|\bIgE\b/g, 'IGE'],
    ];

    for (const [regex, abbr] of replacements) {
      line = line.replace(regex, abbr);
    }

    // Strip standard measurement units right after numbers
    line = line.replace(
      /(\d+(?:[.,]\d+)?)\s*(?:mg\/dL|g\/dL|ug\/dL|µg\/dL|mcg\/dL|pg\/mL|ng\/dL|ng\/mL|uUI\/mL|µUI\/mL|mUI\/L|mUI\/mL|ug\/L|µg\/L|mmol\/L|mEq\/L|U\/L|UI\/L|mg\/L|mL\/min\/1[.,]73\s*m[²2]|10\^\d+\/[µu]L|\/mm[³3]|mm[³3]|fL|pg|%)(?=\s|$|\/|\))/gi,
      '$1'
    );

    // Combine "CR <val> / CKD <val>" into "CR <val> (CKD <val>)"
    line = line.replace(/\bCR\s+([\d.,]+)\s*\/\s*CKD\s+([\d.,]+)/gi, 'CR $1 (CKD $2)');

    // Remove thousand separator dots in LEUCO and PLQ (e.g. LEUCO 5.210 -> LEUCO 5210, PLQ 339.000 -> PLQ 339000)
    line = line.replace(/\b(LEUCO|PLQ)\s+(\d{1,3})\.(\d{3})(?!\d)/g, '$1 $2$3');

    // Clean up duplicate slashes and spacing
    line = line
      .replace(/\s*\/\s*(?:\/\s*)+/g, ' / ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    processedLines.push(line);
  }

  // 4. Merge multiple lines that share the exact same date header (e.g. from multi-batch uploads)
  if (!hasCustomFormat) {
    const mergedLines: string[] = [];
    const dateLineIndexMap = new Map<string, number>();

    for (const line of processedLines) {
      const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{2,4}):\s*(.+)$/);
      if (dateMatch) {
        const dateKey = dateMatch[1];
        const restContent = dateMatch[2].replace(/\s*\/\s*$/, '').trim();
        if (dateLineIndexMap.has(dateKey)) {
          const idx = dateLineIndexMap.get(dateKey)!;
          const existing = mergedLines[idx].replace(/\s*\/\s*$/, '');
          mergedLines[idx] = `${existing} / ${restContent}`;
        } else {
          dateLineIndexMap.set(dateKey, mergedLines.length);
          mergedLines.push(`${dateKey}: ${restContent}`);
        }
      } else {
        mergedLines.push(line);
      }
    }

    return mergedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  return processedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Builds the prompt for locating where each named field should sit on a scanned
 * PDF form page (used by the "Meus Formulários" custom template builder).
 */
export function buildFieldDetectionPrompt(fieldLabels: string[], alreadyFound: string[]): string {
  const remaining = fieldLabels.filter((f) => !alreadyFound.includes(f));
  return `Você é um assistente especialista em análise de formulários médicos e hospitalares (AIH, APAC, Receituários, Atestados, Guias SUS) que analisa a imagem de UMA página de um formulário em PDF e localiza onde cada campo listado abaixo deve ser preenchido.

Campos a localizar nesta página:
${remaining.map((f) => `- ${f}`).join('\n')}

Regras:
- Só inclua no resultado os campos que você realmente identificou NESTA página. Se um campo da lista claramente não aparece nesta página, omita-o (não invente posição).
- As coordenadas são relativas ao tamanho da página, de 0 a 1, com origem (0,0) no canto SUPERIOR ESQUERDO.
- "x" e "y" são o canto superior esquerdo EXATO da área em branco onde o texto ou 'X' deve ser estampado (em caixas com título no topo como "3 - NOME DO PACIENTE", posicione "y" ABAIXO do rótulo impresso, dentro da área branca livre da caixa; em linhas como "Paciente: _______", posicione "x" logo após "Paciente:").
- "width" e "height" são o tamanho relativo da área branca disponível para o preenchimento.
- Retorne APENAS um array JSON válido, sem markdown e sem comentários, neste formato exato:
[{"label": "Nome do paciente", "type": "text", "x": 0.15, "y": 0.22, "width": 0.55, "height": 0.03, "fontSize": 9}]

Se nenhum campo da lista aparecer nesta página, retorne um array vazio: []`;
}

/**
 * Automatically detects ALL fillable boxes, lines, checkboxes, date fields, and prescription areas
 * on a scanned/rendered PDF page without requiring the user to pre-type field names.
 */
export function buildAutoFieldDetectionPrompt(): string {
  return `Você é um especialista em mapeamento visual de formulários médicos e hospitalares brasileiros (AIH, APAC, LME, Receituários, Atestados e Solicitações de Exames).
Analise a imagem desta página de formulário PDF e detecte os campos em branco, caixas retangulares numeradas, linhas para preenchimento e quadradinhos de marcação (checkboxes) onde o profissional deve escrever ou marcar "X".

Regras cruciais de velocidade e precisão:
1. Em formulários em grade/caixas (como AIH e APAC do SUS), cada caixa tem um pequeno título impresso na parte superior esquerda (ex: "1 - NOME DO ESTABELECIMENTO", "3 - NOME DO PACIENTE", "18 - CÓDIGO DO PROCEDIMENTO PRINCIPAL").
   - O campo detectado ("x", "y", "width", "height") deve cobrir APENAS a área em branco de escrita (ABAIXO do rótulo impresso daquela caixa, sem sobrepor o título).
2. GRADES DE DÍGITOS (MUITO IMPORTANTE): NUNCA crie um campo separado para cada quadradinho de dígito ou letra individual (como em Cartão Nacional de Saúde/CNS, CPF, CEP, Prontuário, Telefone, Data de Nascimento, CID ou Código de Procedimento). Agrupe TODA a fileira de quadradinhos daquele dado em UM ÚNICO campo ("type": "text" ou "date") cobrindo a largura total da caixa!
3. Em formulários com linhas ("Nome: _________________"), posicione "x" logo após o rótulo impresso e "y" logo acima da linha.
4. Em quadradinhos de opção (ex: "Masc. [ ]", "Fem. [ ]"), crie um campo com "type": "checkbox" posicionado exatamente sobre o "[ ]".
5. Classifique "type" como: "prescription" (área central de medicações de receita), "textarea" (caixa de múltiplas linhas como Sinais e Sintomas / Justificativa), "date" (datas), "checkbox" (quadradinho de marcar X) ou "text" (campos de 1 linha).
6. Sugira "fontSize" (entre 7 e 11): use 7.5 ou 8 para caixas densas de guias SUS (AIH/APAC) e 10 para receituários e atestados.
7. Coordenadas normalizadas de 0 a 1 (origem 0,0 no canto superior esquerdo da imagem), ordenadas de cima para baixo, da esquerda para a direita.
8. DOCUMENTOS COM 2 VIAS (ex: Receituário de Controle Especial com 1ª Via e 2ª Via): Detecte os campos TANTO na 1ª Via QUANTO na 2ª Via usando EXATAMENTE O MESMO "label" nas duas vias (ex: "Nome do Paciente", "Endereço do Paciente", "Prescrição", "Data", SEM sufixo de via) para vinculação automática.

Retorne APENAS um array JSON válido:
[
  {
    "label": "3 - Nome do Paciente",
    "type": "text",
    "x": 0.04,
    "y": 0.19,
    "width": 0.68,
    "height": 0.024,
    "fontSize": 8
  }
]`;
}

/**
 * Extracts field values and structured medications from clinical case text and/or registration screenshot
 * to automatically fill any active form in Central de Formulários.
 */
export function buildFormAutoFillPrompt(
  fields: Array<{ id: string; label: string; type: string }>,
  clinicalContext?: string
): string {
  const fieldsList = fields
    .map((f) => `- ID: "${f.id}" | Rótulo: "${f.label}" | Tipo: "${f.type}"`)
    .join('\n');

  return `Você é um assistente médico de preenchimento automático de formulários hospitalares (AIH, APAC, Receituários, Atestados, Encaminhamentos, Pedidos de Exames).
Analise o contexto clínico em texto e/ou a imagem anexada (que pode ser um print da tela de cadastro do hospital, prontuário ou evolução do paciente) e extraia os valores para preencher os campos do formulário listado abaixo.

CAMPOS DO FORMULÁRIO ATIVO:
${fieldsList}

CONTEXTO / PRONTUÁRIO INFORMADO PELO MÉDICO:
${clinicalContext && clinicalContext.trim() ? clinicalContext : '(Analise também a imagem anexada, se houver)'}

REGRAS DE PREENCHIMENTO:
1. Preencha o objeto "values" associando o "ID" exato do campo ao valor correspondente encontrado ou clinicamente deduzido com segurança a partir do caso (ex: Sinais e Sintomas, Condições que Justificam Internação, Diagnóstico, CID-10, Nome do Paciente, Prontuário, CNS, Data de Nascimento no formato DD/MM/AAAA, Sexo, Endereço, Município, UF, CEP, Nome da Mãe, Telefone, etc.).
2. Para campos do tipo "checkbox", se a condição for verdadeira para este paciente (ex: "Sexo: Masculino" quando o paciente é homem, ou "Caráter Urgência"), defina o valor como "true". Caso contrário, omita ou deixe "".
3. Se o formulário contiver prescrição de medicamentos ou se o contexto mencionar medicamentos para receita, preencha também o array "medications" com cada medicamento estruturado (via, quantidade, item com nome+dose, posologia clara para o paciente).
4. Não invente dados pessoais (como CPF ou CNS) se não constarem no texto/imagem — deixe esses campos sem preencher caso ausentes. Porém, para campos clínicos (como Justificativa, Sinais e Sintomas, Condições que Justificam, Indicação Clínica, CID-10 compatível), redija-os de forma técnica, formal e completa com base no resumo clínico fornecido!

Retorne APENAS um objeto JSON válido (sem blocos markdown \`\`\`json), exatamente neste formato:
{
  "values": {
    "id_do_campo": "valor preenchido"
  },
  "medications": [
    {
      "via": "Oral",
      "quantidade": "CONTÍNUO",
      "item": "Losartana Potássica 50mg",
      "posologia": "Tomar 1 comprimido via oral de 12/12 horas"
    }
  ]
}`;
}

