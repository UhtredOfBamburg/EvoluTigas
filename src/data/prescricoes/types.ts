export type PrescriptionSpecialty =
  | 'Cardiologia'
  | 'Dermatologia'
  | 'Emergência'
  | 'Endocrinologia'
  | 'Ginecologia'
  | 'Hematologia'
  | 'Hidroeletrolítico'
  | 'Infectologia'
  | 'Intoxicações'
  | 'Musculoesquelético'
  | 'Neurologia'
  | 'Oftalmologia'
  | 'Otorrinolaringologia'
  | 'Respiratório'
  | 'Saúde Mental'
  | 'Sistema Digestivo'
  | 'Sistema Urinário'
  | 'Referência Rápida';

export type PrescriptionSetting = 'pronto_atendimento' | 'sala_vermelha' | 'ambulatorial';

export type ReceiptRecommendation = 'receita_simples' | 'receita_controle' | 'hospitalar';

export type MedicationVia =
  | 'Oral'
  | 'Sublingual'
  | 'Intravenosa'
  | 'Intramuscular'
  | 'Subcutânea'
  | 'Tópica'
  | 'Inalatória'
  | 'Nasal'
  | 'Oftálmica'
  | 'Intravaginal'
  | 'SNG / Oral'
  | 'Uso Interno'
  | 'Uso Externo';

export interface GuideWeightDoseSpec {
  mgPerKg?: number;
  mlPerKg?: number;
  uiPerKg?: number;
  mcgPerKg?: number;
  unit: string;
  maxDose?: number;
  minDose?: number;
  label: string;
}

export interface GuideMedicationItem {
  id: string;
  via: MedicationVia;
  quantidade: string;
  item: string;
  posologia: string;
  controlled?: boolean;
  controlledReason?: 'antimicrobiano' | 'psicotropico' | 'opioide';
  defaultSelected?: boolean;
  tag?: string;
  note?: string;
  weightDose?: GuideWeightDoseSpec;
}

export interface GuideScenario {
  id: string;
  label: string;
  setting: 'receita' | 'hospitalar';
  recommendedReceipt: ReceiptRecommendation;
  summary?: string;
  medications: GuideMedicationItem[];
  conductSteps?: string[];
}

export interface PrescriptionProtocol {
  id: string;
  title: string;
  shortSubtitle?: string;
  cid: string;
  specialties: PrescriptionSpecialty[];
  settings: PrescriptionSetting[];
  primaryReceipt: ReceiptRecommendation;
  keywords: string[];
  supportsWeightCalc?: boolean;
  weightNote?: string;
  scenarios: GuideScenario[];
  bizus?: string[];
  orientacoes?: string[];
  relatedCalculatorTab?: string;
  sourceNote?: string;
}
