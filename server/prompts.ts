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
DIRETRIZES DE TRANSCRIÇÃO MÉDICA (PADRÃO HOSPITALAR HC/UFG):
1. Você pode receber uma ou várias imagens/PDFs ao mesmo tempo. Se receber múltiplas páginas ou fotos, consolide e organize todos os exames por data e categoria sem omitir nenhum parâmetro relevante.
2. Padronize abreviações médicas consagradas e separe parâmetros laboratoriais com " / " em linha contínua para economizar espaço no prontuário.
3. REGRA OBRIGATÓRIA PARA VALORES ALTERADOS: Sempre que um valor der alterado (maior ou menor que o valor de referência do exame), coloque IMEDIATAMENTE ao lado do resultado alterado o valor de referência entre parênteses no formato (VR: XX). Utilize a faixa de referência impressa no próprio laudo (ou a referência clínica padrão caso não esteja visível). Valores dentro da normalidade NÃO devem ter (VR: XX) ao lado.

Se for EXAME LABORATORIAL, utilize rigorosamente este formato compacto por data (note como os alterados trazem "(VR: XX)" logo ao lado):
>> LABS (DD/MM/AA): HB 9,9 (VR: 12,0-16,0) / HT 28,6 (VR: 36,0-46,0) / VCM 87,2 / HCM 30,2 / RDW 17,8 (VR: 11,5-14,5) / LEUCO 14.170 (VR: 4.000-11.000) (BAST 3% / SEG 79% / LINF 10% / MONO 7% / EOS 1%) / PLAQ 242.000 / PCR 12,4 (VR: < 0,5) / UR 67 (VR: 15-40) / CR 1,8 (VR: 0,6-1,2) / Na 143 / K 3,7 / Mg 2,01 / P 2,5 / CaT 8,9 / TGO 24 / TGP 19 / FA 88 / GGT 42 / BT 0,8 (BD 0,2 / BI 0,6) / ALB 3,8 / TAP 20,1s (INR 1,57 (VR: 0,8-1,2)) / TTPa 37,2s (R 1,11) / [ GSA: pH 7,42 / pCO2 38 / pO2 92 / HCO3 24 / BE +0,5 / SatO2 97% / Lac 1,2 ]

Se for EXAME DE IMAGEM (TC, RM, RX, USG, ECO, EDA, Colonoscopia), estruture assim:
>> [NOME DO EXAME EM CAIXA ALTA] (DD/MM/AA):
- DESCRIÇÃO / ACHADOS PRINCIPAIS: (Resumo técnico objetivo dos achados relevantes)
- CONCLUSÃO / IMPRESSÃO: (Resumo fiel da conclusão do laudo em destaque)

Se for CONTROLE DE SINAIS VITAIS / BALANÇO HÍDRICO (24h), estruture assim:
# CONTROLES 24H:
PAS: mín-máx mmHg | PAD: mín-máx mmHg | PAM: mín-máx mmHg | FC: mín-máx bpm | FR: mín-máx irpm | SpO2: mín-máx% | Tax: mín-máx °C | HGT: mín-máx mg/dL | Diurese: X mL | BH: +/- X mL
`;

  return `Você é um médico especialista em transcrição de exames complementares para prontuário hospitalar.
Transcreva fielmente os resultados contidos nas imagens/documentos ou no texto enviado.

REGRA INEGOCIÁVEL DE VALORES DE REFERÊNCIA: Sempre que qualquer resultado quantitativo estiver ALTERADO (maior ou menor que o valor de referência), escreva obrigatoriamente ao lado dele o valor de referência entre parênteses no formato "(VR: XX)" — por exemplo: "HB 9,9 (VR: 12-16) / CR 1,9 (VR: 0,6-1,2) / K 3,9". Não adicione "(VR: XX)" em resultados normais.
${outputFormat && outputFormat.trim() ? `\nO usuário definiu um FORMATO DE SAÍDA PERSONALIZADO prioritário:\n"""\n${outputFormat}\n"""\nSiga rigorosamente a estrutura e o estilo deste formato personalizado, mantendo sempre "(VR: XX)" ao lado de cada valor alterado!` : defaultFormatPrompt}

Instruções ou texto complementar enviado pelo usuário: ${customPrompt || 'Transcreva os exames anexados.'}
Retorne apenas a transcrição pronta para copiar e colar no prontuário, sem frases introdutórias.`;
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

