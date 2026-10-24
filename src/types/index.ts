export * from './formTemplate';

export interface PatientSummary {
  id: string | number;
  name: string;
  age?: number;
  sex?: 'M' | 'F';
  bed?: string;
  diagnosis?: string;
  lastUpdate?: string;
}

export interface ClinicalHistoryEntry {
  id: string;
  date: string;
  text: string;
  type?: 'evolucao' | 'admissao';
}
