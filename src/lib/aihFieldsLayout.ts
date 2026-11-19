import type { FormField, FormTemplate } from '@/types/formTemplate';

export type AihSmartFieldRole =
  | 'cnes_solicitante_nome'
  | 'cnes_solicitante_cod'
  | 'cnes_executante_nome'
  | 'cnes_executante_cod'
  | 'municipio'
  | 'ibge'
  | 'uf'
  | 'cep'
  | 'endereco'
  | 'diagnostico_inicial'
  | 'cid_principal'
  | 'cid_secundario'
  | 'cid_associadas'
  | 'procedimento_nome'
  | 'procedimento_codigo'
  | 'clinica'
  | 'carater'
  | 'raca_cor'
  | null;

export const SUS_CLINICAS = [
  { code: '01', label: '01 - Cirúrgica' },
  { code: '02', label: '02 - Obstétrica' },
  { code: '03', label: '03 - Clínica Médica' },
  { code: '04', label: '04 - Crônicos' },
  { code: '05', label: '05 - Psiquiatria' },
  { code: '06', label: '06 - Tisiologia' },
  { code: '07', label: '07 - Pediatria' },
  { code: '08', label: '08 - Reabilitação' },
  { code: '09', label: '09 - Hospital-Dia' },
] as const;

export const SUS_CARATER_INTERNACAO = [
  { code: '01', label: '01 - Eletivo' },
  { code: '02', label: '02 - Urgência' },
  { code: '03', label: '03 - Acidente no local de trabalho ou a serviço da empresa' },
  { code: '04', label: '04 - Acidente no trajeto para o trabalho' },
  { code: '05', label: '05 - Outros tipos de acidente de trânsito' },
  { code: '06', label: '06 - Outros tipos de lesões/envenenamentos (químicos ou físicos)' },
] as const;

export const SUS_RACA_COR = [
  { code: '01', label: '01 - Branca' },
  { code: '02', label: '02 - Preta' },
  { code: '03', label: '03 - Parda' },
  { code: '04', label: '04 - Amarela' },
  { code: '05', label: '05 - Indígena' },
  { code: '99', label: '99 - Sem informação' },
] as const;

function normLabel(raw?: string): string {
  return (raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isAihTemplate(template?: FormTemplate | null): boolean {
  if (!template) return false;
  const nameNorm = normLabel(template.name);
  if (/\baih\b/.test(nameNorm) || nameNorm.includes('internacao hospitalar')) {
    return true;
  }
  const labels = (template.fields || []).map((f) => normLabel(f.label));
  const hasCnes = labels.some((l) => l.includes('cnes'));
  const hasProc = labels.some((l) => l.includes('codigo do procedimento') || l.includes('procedimento solicitado'));
  const hasCid = labels.some((l) => l.includes('cid 10') || l.includes('cid-10'));
  return hasCnes && hasProc && hasCid;
}

export function detectAihSmartFieldRole(label?: string): AihSmartFieldRole {
  const n = normLabel(label);
  if (!n) return null;

  if (n.includes('estabelecimento solicitante') || n.includes('instituicao cnes')) {
    return 'cnes_solicitante_nome';
  }
  if (n.includes('cnes solicitante') || /^2\s*[-–]?\s*cnes\b/.test(n)) {
    return 'cnes_solicitante_cod';
  }
  if (n.includes('estabelecimento executante')) {
    return 'cnes_executante_nome';
  }
  if (n.includes('cnes executante') || /^4\s*[-–]?\s*cnes\b/.test(n)) {
    return 'cnes_executante_cod';
  }
  if (n.includes('ibge')) {
    return 'ibge';
  }
  if (n.includes('municipio')) {
    return 'municipio';
  }
  if (n === 'uf' || /^18\s*[-–]?\s*uf\b/.test(n) || n.endsWith(' - uf')) {
    return 'uf';
  }
  if (n === 'cep' || /\bcep\b/.test(n)) {
    return 'cep';
  }
  if (n.includes('endereco')) {
    return 'endereco';
  }
  if (n.includes('diagnostico inicial') || n.includes('diagnostico principal')) {
    return 'diagnostico_inicial';
  }
  if (n.includes('cid') && n.includes('principal')) {
    return 'cid_principal';
  }
  if (n.includes('cid') && n.includes('secundario')) {
    return 'cid_secundario';
  }
  if (n.includes('cid') && (n.includes('associad') || n.includes('causa'))) {
    return 'cid_associadas';
  }
  if (n === 'cid' || n === 'cid 10' || n === 'cid-10') {
    return 'cid_principal';
  }
  if (n.includes('descricao do procedimento') || n === 'procedimento' || n.includes('procedimento solicitado')) {
    return 'procedimento_nome';
  }
  if (n.includes('codigo do procedimento') || n.includes('sigtap')) {
    return 'procedimento_codigo';
  }
  if (n === 'clinica' || /^29\s*[-–]?\s*clinica\b/.test(n)) {
    return 'clinica';
  }
  if (n.includes('carater da internacao') || /^30\s*[-–]?\s*carater\b/.test(n)) {
    return 'carater';
  }
  if (n.includes('raca/cor') || n.includes('raca')) {
    return 'raca_cor';
  }
  return null;
}

/**
 * Exact vector-measured coordinates from the official Ministry of Health SUS AIH PDF
 * (594.96 x 841.92 pts — A4 Portrait).
 * Preserves original field IDs from tpl_1795081811005 so saved presets remain compatible.
 */
const CNES_CELLS = [0.7759, 0.798, 0.8206, 0.8433, 0.866, 0.8887, 0.9114, 0.9347];
const CNS_PACIENTE_CELLS = [
  0.0662, 0.0895, 0.1147, 0.1399, 0.1639, 0.1891, 0.213, 0.2383, 0.2635, 0.2874, 0.3126, 0.3378,
  0.3618, 0.387, 0.4122, 0.4368,
];
const TEL_CELLS = [
  0.6851, 0.7135, 0.7425, 0.7639, 0.7853, 0.8068, 0.8269, 0.8484, 0.8698, 0.8912, 0.9127, 0.9347,
];
const UF_CELLS = [0.7519, 0.7778, 0.8036];
const CEP_CELLS = [0.815, 0.8293, 0.8435, 0.8596, 0.8737, 0.8879, 0.9021, 0.9181, 0.9347];
const PROC_SIGTAP_CELLS = [
  0.6385, 0.6669, 0.6971, 0.7261, 0.7564, 0.7853, 0.8156, 0.8446, 0.8748, 0.9051, 0.9347,
];
const DOC_SOLICITANTE_CELLS = [
  0.5528, 0.5786, 0.6038, 0.629, 0.6542, 0.6795, 0.7047, 0.7311, 0.7564, 0.7816, 0.8068, 0.832,
  0.8585, 0.8837, 0.9089, 0.9347,
];
const CNPJ_CELLS = [
  0.3322, 0.3555, 0.3807, 0.4046, 0.4286, 0.4526, 0.4765, 0.5005, 0.5244, 0.5484, 0.5723, 0.5963,
  0.6202, 0.6442, 0.6687,
];
const DOC_AUTORIZADOR_CELLS = [
  0.2565, 0.2811, 0.3051, 0.3303, 0.3542, 0.3794, 0.4046, 0.4286, 0.4538, 0.4778, 0.503, 0.5269,
  0.5521, 0.5761, 0.6013, 0.6271,
];

export const AIH_STANDARD_FIELDS: FormField[] = [
  // IDENTIFICAÇÃO DO ESTABELECIMENTO DE SAÚDE
  {
    id: 'f_0_0_toj9',
    label: '1 - NOME DO ESTABELECIMENTO SOLICITANTE',
    type: 'text',
    page: 0,
    xNorm: 0.072,
    yNorm: 0.1205,
    wNorm: 0.688,
    hNorm: 0.0135,
    fontSize: 8.5,
  },
  {
    id: 'f_0_1_wkow',
    label: '2 - CNES SOLICITANTE',
    type: 'text',
    page: 0,
    xNorm: 0.7759,
    yNorm: 0.1205,
    wNorm: 0.1588,
    hNorm: 0.014,
    fontSize: 8.5,
    combCells: 7,
    combCellX: CNES_CELLS,
    combDigitsOnly: true,
  },
  {
    id: 'f_0_2_tnyf',
    label: '3 - NOME DO ESTABELECIMENTO EXECUTANTE',
    type: 'text',
    page: 0,
    xNorm: 0.072,
    yNorm: 0.1463,
    wNorm: 0.688,
    hNorm: 0.0135,
    fontSize: 8.5,
  },
  {
    id: 'f_0_3_9chi',
    label: '4 - CNES EXECUTANTE',
    type: 'text',
    page: 0,
    xNorm: 0.7759,
    yNorm: 0.1463,
    wNorm: 0.1588,
    hNorm: 0.014,
    fontSize: 8.5,
    combCells: 7,
    combCellX: CNES_CELLS,
    combDigitsOnly: true,
  },

  // IDENTIFICAÇÃO DO PACIENTE
  {
    id: 'f_0_4_y87v',
    label: '5 - NOME DO PACIENTE',
    type: 'text',
    page: 0,
    xNorm: 0.072,
    yNorm: 0.193,
    wNorm: 0.674,
    hNorm: 0.014,
    fontSize: 8.5,
  },
  {
    id: 'f_0_5_yq3u',
    label: '6 - N° DO PRONTUÁRIO',
    type: 'text',
    page: 0,
    xNorm: 0.768,
    yNorm: 0.193,
    wNorm: 0.162,
    hNorm: 0.014,
    fontSize: 8.5,
  },
  {
    id: 'f_0_6_wave',
    label: '7 - CARTÃO NACIONAL DE SAÚDE (CNS)',
    type: 'text',
    page: 0,
    xNorm: 0.0662,
    yNorm: 0.2195,
    wNorm: 0.3706,
    hNorm: 0.0138,
    fontSize: 8.5,
    combCells: 15,
    combCellX: CNS_PACIENTE_CELLS,
    combDigitsOnly: true,
  },
  {
    id: 'f_0_7_o45m',
    label: '8 - DATA NASCIMENTO',
    type: 'date',
    page: 0,
    xNorm: 0.4481,
    yNorm: 0.2195,
    wNorm: 0.1324,
    hNorm: 0.0138,
    fontSize: 8.5,
    slashDateSlots: [0.451, 0.479, 0.49, 0.519, 0.53, 0.578],
  },
  {
    id: 'f_0_8_x7f4',
    label: '9 - SEXO: Masc.',
    type: 'checkbox',
    page: 0,
    xNorm: 0.6271,
    yNorm: 0.2214,
    wNorm: 0.0133,
    hNorm: 0.009,
    fontSize: 8,
  },
  {
    id: 'f_0_9_cz9h',
    label: '9 - SEXO: Fem.',
    type: 'checkbox',
    page: 0,
    xNorm: 0.699,
    yNorm: 0.2214,
    wNorm: 0.0133,
    hNorm: 0.009,
    fontSize: 8,
  },
  {
    id: 'f_0_10_m60i',
    label: '10 - RAÇA/COR',
    type: 'text',
    page: 0,
    xNorm: 0.751,
    yNorm: 0.2195,
    wNorm: 0.089,
    hNorm: 0.0138,
    fontSize: 8,
  },
  {
    id: 'f_0_11_17nz',
    label: '10.1 - ETNIA',
    type: 'text',
    page: 0,
    xNorm: 0.86,
    yNorm: 0.2195,
    wNorm: 0.071,
    hNorm: 0.0138,
    fontSize: 8,
  },
  {
    id: 'f_0_12_ro8d',
    label: '11 - NOME DA MÃE',
    type: 'text',
    page: 0,
    xNorm: 0.072,
    yNorm: 0.245,
    wNorm: 0.596,
    hNorm: 0.014,
    fontSize: 8.5,
  },
  {
    id: 'f_0_13_uljd',
    label: '12 - TELEFONE DE CONTATO',
    type: 'text',
    page: 0,
    xNorm: 0.6851,
    yNorm: 0.2485,
    wNorm: 0.2496,
    hNorm: 0.0112,
    fontSize: 8,
    combCells: 11,
    combCellX: TEL_CELLS,
    combDigitsOnly: true,
  },
  {
    id: 'f_0_14_d5md',
    label: '13 - NOME DO RESPONSÁVEL',
    type: 'text',
    page: 0,
    xNorm: 0.072,
    yNorm: 0.271,
    wNorm: 0.596,
    hNorm: 0.014,
    fontSize: 8.5,
  },
  {
    id: 'f_0_15_pfup',
    label: '14 - TELEFONE DE CONTATO (RESPONSÁVEL)',
    type: 'text',
    page: 0,
    xNorm: 0.6851,
    yNorm: 0.2742,
    wNorm: 0.2496,
    hNorm: 0.0112,
    fontSize: 8,
    combCells: 11,
    combCellX: TEL_CELLS,
    combDigitsOnly: true,
  },
  {
    id: 'f_0_16_1m03',
    label: '15 - ENDEREÇO (RUA, N°, BAIRRO)',
    type: 'text',
    page: 0,
    xNorm: 0.072,
    yNorm: 0.2968,
    wNorm: 0.858,
    hNorm: 0.0142,
    fontSize: 8.5,
  },
  {
    id: 'f_0_17_cjc2',
    label: '16 - MUNICÍPIO DE RESIDÊNCIA',
    type: 'text',
    page: 0,
    xNorm: 0.072,
    yNorm: 0.3228,
    wNorm: 0.522,
    hNorm: 0.0142,
    fontSize: 8.5,
  },
  {
    id: 'f_0_18_plgd',
    label: '17 - CÓD. IBGE MUNICÍPIO',
    type: 'text',
    page: 0,
    xNorm: 0.616,
    yNorm: 0.3228,
    wNorm: 0.12,
    hNorm: 0.0142,
    fontSize: 8.5,
  },
  {
    id: 'f_0_19_2ool',
    label: '18 - UF',
    type: 'text',
    page: 0,
    xNorm: 0.7519,
    yNorm: 0.3228,
    wNorm: 0.0517,
    hNorm: 0.0142,
    fontSize: 8.5,
    combCells: 2,
    combCellX: UF_CELLS,
    combDigitsOnly: false,
  },
  {
    id: 'f_0_20_l953',
    label: '19 - CEP',
    type: 'text',
    page: 0,
    xNorm: 0.815,
    yNorm: 0.3228,
    wNorm: 0.1197,
    hNorm: 0.0142,
    fontSize: 8,
    combCells: 8,
    combCellX: CEP_CELLS,
    combDigitsOnly: true,
  },

  // JUSTIFICATIVA DA INTERNAÇÃO
  {
    id: 'f_0_21_cnu3',
    label: '20 - PRINCIPAIS SINAIS E SINTOMAS CLÍNICOS',
    type: 'textarea',
    page: 0,
    xNorm: 0.072,
    yNorm: 0.372,
    wNorm: 0.856,
    hNorm: 0.107,
    fontSize: 8.5,
  },
  {
    id: 'f_0_22_nxqy',
    label: '21 - CONDIÇÕES QUE JUSTIFICAM A INTERNAÇÃO',
    type: 'textarea',
    page: 0,
    xNorm: 0.072,
    yNorm: 0.4955,
    wNorm: 0.856,
    hNorm: 0.044,
    fontSize: 8.5,
  },
  {
    id: 'f_0_23_311s',
    label: '22 - PRINCIPAIS RESULTADOS DE PROVAS DIAGNÓSTICAS',
    type: 'textarea',
    page: 0,
    xNorm: 0.072,
    yNorm: 0.5545,
    wNorm: 0.856,
    hNorm: 0.043,
    fontSize: 8.5,
  },
  {
    id: 'f_0_24_5anq',
    label: '23 - DIAGNÓSTICO INICIAL',
    type: 'text',
    page: 0,
    xNorm: 0.072,
    yNorm: 0.6122,
    wNorm: 0.382,
    hNorm: 0.0132,
    fontSize: 8.5,
  },
  {
    id: 'f_0_25_q20z',
    label: '24 - CID 10 PRINCIPAL',
    type: 'text',
    page: 0,
    xNorm: 0.464,
    yNorm: 0.6122,
    wNorm: 0.132,
    hNorm: 0.0132,
    fontSize: 8.5,
  },
  {
    id: 'f_0_26_b38n',
    label: '25 - CID 10 SECUNDÁRIO',
    type: 'text',
    page: 0,
    xNorm: 0.605,
    yNorm: 0.6122,
    wNorm: 0.141,
    hNorm: 0.0132,
    fontSize: 8.5,
  },
  {
    id: 'f_0_27_fefg',
    label: '26 - CID 10 CAUSAS ASSOCIADAS',
    type: 'text',
    page: 0,
    xNorm: 0.756,
    yNorm: 0.6122,
    wNorm: 0.174,
    hNorm: 0.0132,
    fontSize: 8.5,
  },

  // PROCEDIMENTO SOLICITADO
  {
    id: 'f_0_28_sy83',
    label: '27 - DESCRIÇÃO DO PROCEDIMENTO SOLICITADO',
    type: 'text',
    page: 0,
    xNorm: 0.072,
    yNorm: 0.6592,
    wNorm: 0.55,
    hNorm: 0.0136,
    fontSize: 8.5,
  },
  {
    id: 'f_0_29_1fin',
    label: '28 - CÓDIGO DO PROCEDIMENTO',
    type: 'text',
    page: 0,
    xNorm: 0.6385,
    yNorm: 0.6592,
    wNorm: 0.2962,
    hNorm: 0.0136,
    fontSize: 8.5,
    combCells: 10,
    combCellX: PROC_SIGTAP_CELLS,
    combDigitsOnly: true,
  },
  {
    id: 'f_0_30_585a',
    label: '29 - CLÍNICA',
    type: 'text',
    page: 0,
    xNorm: 0.072,
    yNorm: 0.6848,
    wNorm: 0.155,
    hNorm: 0.0136,
    fontSize: 8,
  },
  {
    id: 'f_0_31_c8xg',
    label: '30 - CARÁTER DA INTERNAÇÃO',
    type: 'text',
    page: 0,
    xNorm: 0.248,
    yNorm: 0.6848,
    wNorm: 0.166,
    hNorm: 0.0136,
    fontSize: 8,
  },
  {
    id: 'f_0_32_iapj',
    label: '31 - DOCUMENTO SOLICITANTE: CNS',
    type: 'checkbox',
    page: 0,
    xNorm: 0.4368,
    yNorm: 0.6862,
    wNorm: 0.0135,
    hNorm: 0.0105,
    fontSize: 8,
  },
  {
    id: 'f_0_33_tavn',
    label: '31 - DOCUMENTO SOLICITANTE: CPF',
    type: 'checkbox',
    page: 0,
    xNorm: 0.4908,
    yNorm: 0.6862,
    wNorm: 0.0135,
    hNorm: 0.0105,
    fontSize: 8,
  },
  {
    id: 'f_0_34_2wua',
    label: '32 - N° DOCUMENTO (CNS/CPF) DO PROFISSIONAL SOLICITANTE/ASSISTENTE',
    type: 'text',
    page: 0,
    xNorm: 0.5528,
    yNorm: 0.685,
    wNorm: 0.3819,
    hNorm: 0.0136,
    fontSize: 8.5,
    combCells: 15,
    combCellX: DOC_SOLICITANTE_CELLS,
    combDigitsOnly: true,
  },
  {
    id: 'f_0_35_kuro',
    label: '33 - NOME DO PROFISSIONAL SOLICITANTE/ASSISTENTE',
    type: 'text',
    page: 0,
    xNorm: 0.072,
    yNorm: 0.713,
    wNorm: 0.402,
    hNorm: 0.018,
    fontSize: 8.5,
  },
  {
    id: 'f_0_36_q32f',
    label: '34 - DATA DA SOLICITAÇÃO',
    type: 'date',
    page: 0,
    xNorm: 0.4897,
    yNorm: 0.713,
    wNorm: 0.1664,
    hNorm: 0.018,
    fontSize: 8.5,
    slashDateSlots: [0.493, 0.529, 0.543, 0.578, 0.592, 0.653],
  },
  {
    id: 'f_0_37_cx5u',
    label: '35 - ASSINATURA E CARIMBO',
    type: 'text',
    page: 0,
    xNorm: 0.673,
    yNorm: 0.713,
    wNorm: 0.258,
    hNorm: 0.018,
    fontSize: 8,
  },

  // CAUSAS EXTERNAS
  {
    id: 'f_0_38_eiuu',
    label: '36 - ACIDENTE DE TRÂNSITO',
    type: 'checkbox',
    page: 0,
    xNorm: 0.0982,
    yNorm: 0.7632,
    wNorm: 0.0135,
    hNorm: 0.0102,
    fontSize: 8,
  },
  {
    id: 'f_0_39_pnal',
    label: '37 - ACIDENTE TRABALHO TÍPICO',
    type: 'checkbox',
    page: 0,
    xNorm: 0.0982,
    yNorm: 0.7756,
    wNorm: 0.0135,
    hNorm: 0.0102,
    fontSize: 8,
  },
  {
    id: 'f_0_40_ammq',
    label: '38 - ACIDENTE TRABALHO TRAJETO',
    type: 'checkbox',
    page: 0,
    xNorm: 0.0982,
    yNorm: 0.788,
    wNorm: 0.0135,
    hNorm: 0.0102,
    fontSize: 8,
  },
  {
    id: 'f_0_41_9fxv',
    label: '39 - CNPJ DA SEGURADORA',
    type: 'text',
    page: 0,
    xNorm: 0.3322,
    yNorm: 0.7642,
    wNorm: 0.3365,
    hNorm: 0.0145,
    fontSize: 8,
    combCells: 14,
    combCellX: CNPJ_CELLS,
    combDigitsOnly: true,
  },
  {
    id: 'f_0_42_cvu8',
    label: '40 - N° DO BILHETE',
    type: 'text',
    page: 0,
    xNorm: 0.68,
    yNorm: 0.7642,
    wNorm: 0.16,
    hNorm: 0.0145,
    fontSize: 8,
  },
  {
    id: 'f_0_43_10i1',
    label: '41 - SÉRIE',
    type: 'text',
    page: 0,
    xNorm: 0.855,
    yNorm: 0.7642,
    wNorm: 0.076,
    hNorm: 0.0145,
    fontSize: 8,
  },
  {
    id: 'f_0_44_wee8',
    label: '42 - CNPJ EMPRESA',
    type: 'text',
    page: 0,
    xNorm: 0.3322,
    yNorm: 0.7882,
    wNorm: 0.3365,
    hNorm: 0.0145,
    fontSize: 8,
    combCells: 14,
    combCellX: CNPJ_CELLS,
    combDigitsOnly: true,
  },
  {
    id: 'f_0_45_8td8',
    label: '43 - CNAE DA EMPRESA',
    type: 'text',
    page: 0,
    xNorm: 0.68,
    yNorm: 0.7882,
    wNorm: 0.16,
    hNorm: 0.0145,
    fontSize: 8,
  },
  {
    id: 'f_0_46_g41k',
    label: '44 - CBOR',
    type: 'text',
    page: 0,
    xNorm: 0.855,
    yNorm: 0.7882,
    wNorm: 0.076,
    hNorm: 0.0145,
    fontSize: 8,
  },
  {
    id: 'f_0_47_7g9l',
    label: '45 - VÍNCULO: EMPREGADO',
    type: 'checkbox',
    page: 0,
    xNorm: 0.0898,
    yNorm: 0.8136,
    wNorm: 0.0135,
    hNorm: 0.0105,
    fontSize: 8,
  },
  {
    id: 'f_0_48_auz0',
    label: '45 - VÍNCULO: EMPREGADOR',
    type: 'checkbox',
    page: 0,
    xNorm: 0.225,
    yNorm: 0.8136,
    wNorm: 0.0135,
    hNorm: 0.0105,
    fontSize: 8,
  },
  {
    id: 'f_0_49_vv09',
    label: '45 - VÍNCULO: AUTÔNOMO',
    type: 'checkbox',
    page: 0,
    xNorm: 0.3688,
    yNorm: 0.8136,
    wNorm: 0.0135,
    hNorm: 0.0105,
    fontSize: 8,
  },
  {
    id: 'f_0_50_noiw',
    label: '45 - VÍNCULO: DESEMPREGADO',
    type: 'checkbox',
    page: 0,
    xNorm: 0.4965,
    yNorm: 0.8136,
    wNorm: 0.0135,
    hNorm: 0.0105,
    fontSize: 8,
  },
  {
    id: 'f_0_51_mazj',
    label: '45 - VÍNCULO: APOSENTADO',
    type: 'checkbox',
    page: 0,
    xNorm: 0.656,
    yNorm: 0.8136,
    wNorm: 0.0135,
    hNorm: 0.0105,
    fontSize: 8,
  },
  {
    id: 'f_0_52_i00l',
    label: '45 - VÍNCULO: NÃO SEGURADO',
    type: 'checkbox',
    page: 0,
    xNorm: 0.7958,
    yNorm: 0.8136,
    wNorm: 0.0135,
    hNorm: 0.0105,
    fontSize: 8,
  },

  // AUTORIZAÇÃO
  {
    id: 'f_0_53_ysxk',
    label: '46 - NOME DO PROFISSIONAL AUTORIZADOR',
    type: 'text',
    page: 0,
    xNorm: 0.072,
    yNorm: 0.862,
    wNorm: 0.369,
    hNorm: 0.021,
    fontSize: 8.5,
  },
  {
    id: 'f_0_54_irlj',
    label: '47 - CÓD. ÓRGÃO EMISSOR',
    type: 'text',
    page: 0,
    xNorm: 0.462,
    yNorm: 0.862,
    wNorm: 0.16,
    hNorm: 0.021,
    fontSize: 8.5,
  },
  {
    id: 'f_0_55_d3lz',
    label: '48 - DOCUMENTO AUTORIZADOR: CNS',
    type: 'checkbox',
    page: 0,
    xNorm: 0.09,
    yNorm: 0.904,
    wNorm: 0.0132,
    hNorm: 0.0108,
    fontSize: 8,
  },
  {
    id: 'f_0_55_cpf_aut',
    label: '48 - DOCUMENTO AUTORIZADOR: CPF',
    type: 'checkbox',
    page: 0,
    xNorm: 0.1725,
    yNorm: 0.904,
    wNorm: 0.0132,
    hNorm: 0.0108,
    fontSize: 8,
  },
  {
    id: 'f_0_58_pky1',
    label: '49 - N° DOCUMENTO (CNS/CPF) DO PROFISSIONAL AUTORIZADOR',
    type: 'text',
    page: 0,
    xNorm: 0.2565,
    yNorm: 0.897,
    wNorm: 0.3706,
    hNorm: 0.0205,
    fontSize: 8.5,
    combCells: 15,
    combCellX: DOC_AUTORIZADOR_CELLS,
    combDigitsOnly: true,
  },
  {
    id: 'f_0_59_ldny',
    label: '50 - DATA DA AUTORIZAÇÃO',
    type: 'date',
    page: 0,
    xNorm: 0.0662,
    yNorm: 0.9302,
    wNorm: 0.1651,
    hNorm: 0.0136,
    fontSize: 8.5,
    slashDateSlots: [0.069, 0.107, 0.118, 0.148, 0.159, 0.228],
  },
  {
    id: 'f_0_60_ljvk',
    label: '51 - ASSINATURA E CARIMBO (AUTORIZADOR)',
    type: 'text',
    page: 0,
    xNorm: 0.248,
    yNorm: 0.9302,
    wNorm: 0.374,
    hNorm: 0.0136,
    fontSize: 8,
  },
  {
    id: 'f_0_61_num_aih',
    label: '52 - N° DA AUTORIZAÇÃO (AIH)',
    type: 'text',
    page: 0,
    xNorm: 0.638,
    yNorm: 0.865,
    wNorm: 0.292,
    hNorm: 0.075,
    fontSize: 10,
  },
];

/**
 * Calibrates official A4 Portrait SUS AIH templates so every text box, comb cell,
 * slash-separated date, and checkbox aligns precisely with the printed vector PDF grid.
 */
export function normalizeAihTemplate(template: FormTemplate): FormTemplate {
  if (!isAihTemplate(template)) return template;

  const firstPage = template.pages?.[0];
  const isPortraitA4 =
    !firstPage || (firstPage.heightPts > firstPage.widthPts && firstPage.widthPts > 500);
  if (!isPortraitA4) return template;

  // Preserve any custom user-added fields beyond the standard SUS AIH grid
  const standardIds = new Set(AIH_STANDARD_FIELDS.map((f) => f.id));
  const isOfficialAihGrid =
    template.id === 'tpl_1795081811005' ||
    template.sourceTemplateId === 'tpl_1795081811005' ||
    (template.fields || []).filter((f) => standardIds.has(f.id)).length >= 10 ||
    (template.fields || []).length >= 35;

  if (!isOfficialAihGrid) return template;

  return {
    ...template,
    fields: AIH_STANDARD_FIELDS,
  };
}
