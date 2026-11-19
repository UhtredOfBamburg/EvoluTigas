import { CARDIO_NEURO_PROTOCOLS } from './cardioNeuro';
import { RESP_GASTRO_PROTOCOLS } from './respGastro';
import { GENITO_OSTEO_ENDO_PROTOCOLS } from './genitoOsteoEndo';
import { PSIQ_DHE_PROTOCOLS } from './psiqDhe';
import { INFECTO_EMERG_REF_PROTOCOLS } from './infectoEmergRef';
import type {
  GuideMedicationItem,
  PrescriptionProtocol,
  PrescriptionSpecialty,
  ReceiptRecommendation,
} from './types';

export * from './types';

export type QuickFilterMode = 'todas' | 'favoritas' | 'pronto_atendimento' | 'receita_casa';

export const ALL_PRESCRIPTION_PROTOCOLS: PrescriptionProtocol[] = [
  ...CARDIO_NEURO_PROTOCOLS,
  ...RESP_GASTRO_PROTOCOLS,
  ...GENITO_OSTEO_ENDO_PROTOCOLS,
  ...PSIQ_DHE_PROTOCOLS,
  ...INFECTO_EMERG_REF_PROTOCOLS,
].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));

export const SPECIALTY_LIST: PrescriptionSpecialty[] = [
  'Cardiologia',
  'Dermatologia',
  'Emergência',
  'Endocrinologia',
  'Ginecologia',
  'Hematologia',
  'Hidroeletrolítico',
  'Infectologia',
  'Intoxicações',
  'Musculoesquelético',
  'Neurologia',
  'Oftalmologia',
  'Otorrinolaringologia',
  'Respiratório',
  'Saúde Mental',
  'Sistema Digestivo',
  'Sistema Urinário',
  'Referência Rápida',
];

export function normalizeSearch(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function protocolSupportsHomeReceipt(protocol: PrescriptionProtocol): boolean {
  return protocol.scenarios.some((s) => s.setting === 'receita');
}

export function protocolHasControlledOption(protocol: PrescriptionProtocol): boolean {
  if (protocol.primaryReceipt === 'receita_controle') return true;
  return protocol.scenarios.some((s) => s.medications.some((m) => m.controlled));
}

export function searchPrescriptionProtocols(
  protocols: PrescriptionProtocol[],
  query: string,
  quickFilter: QuickFilterMode,
  selectedSpecialty: PrescriptionSpecialty | null,
  favoritesSet: Set<string>
): PrescriptionProtocol[] {
  const normQuery = normalizeSearch(query);
  const terms = normQuery ? normQuery.split(/\s+/).filter(Boolean) : [];

  return protocols.filter((protocol) => {
    if (quickFilter === 'favoritas' && !favoritesSet.has(protocol.id)) {
      return false;
    }
    if (
      quickFilter === 'pronto_atendimento' &&
      !protocol.settings.includes('pronto_atendimento') &&
      !protocol.settings.includes('sala_vermelha')
    ) {
      return false;
    }
    if (quickFilter === 'receita_casa' && !protocolSupportsHomeReceipt(protocol)) {
      return false;
    }
    if (selectedSpecialty && !protocol.specialties.includes(selectedSpecialty)) {
      return false;
    }

    if (terms.length === 0) return true;

    const medNames = protocol.scenarios
      .flatMap((s) => [s.label, ...s.medications.map((m) => `${m.item} ${m.via}`)])
      .join(' ');
    const haystack = normalizeSearch(
      `${protocol.title} ${protocol.shortSubtitle || ''} ${protocol.cid} ${protocol.specialties.join(' ')} ${protocol.keywords.join(' ')} ${medNames}`
    );

    return terms.every((t) => haystack.includes(t));
  });
}

export function detectRequiredReceiptType(
  selectedMeds: GuideMedicationItem[],
  fallback: ReceiptRecommendation = 'receita_simples'
): 'receita_simples' | 'receita_controle' {
  if (selectedMeds.some((m) => Boolean(m.controlled))) {
    return 'receita_controle';
  }
  if (fallback === 'receita_controle') {
    return selectedMeds.length === 0 ? 'receita_controle' : 'receita_simples';
  }
  return 'receita_simples';
}
