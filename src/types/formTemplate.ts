export type FieldType = 'text' | 'textarea' | 'date' | 'checkbox' | 'prescription';

export interface FormField {
  id: string;
  label: string;
  type: FieldType;
  page: number; // 0-indexed
  /** All normalized 0..1, top-left origin, relative to the page's own width/height. */
  xNorm: number;
  yNorm: number;
  wNorm: number;
  hNorm: number;
  fontSize?: number;
  required?: boolean;
  /** Uniform character-cell comb rendering (e.g. 7 for CNES, 10 for SIGTAP, 15 for CNS). */
  combCells?: number;
  /** Exact normalized [x0, x1, ..., xN] cell borders for comb boxes (handles unequal DDD+phone widths). */
  combCellX?: number[];
  /** Strip punctuation before placing digits into comb cells (default true when combCells/combCellX set). */
  combDigitsOnly?: boolean;
  /** Exact normalized [dayL, dayR, monthL, monthR, yearL, yearR] X bounds around printed '/' date slashes. */
  slashDateSlots?: [number, number, number, number, number, number];
}

export interface TemplatePage {
  widthPts: number;
  heightPts: number;
}

export interface FormTemplate {
  id: string;
  name: string;
  ownerId?: string;
  ownerName?: string;
  isOfficial?: boolean;
  isCommunity?: boolean;
  sourceTemplateId?: string;
  category?: 'receita' | 'atestado' | 'guia' | 'exames' | 'outro';
  isBuiltIn?: boolean;
  pdfBase64: string;
  pages: TemplatePage[];
  fields: FormField[];
  createdAt: string;
}

export interface MedicationItem {
  id: string;
  via: string;
  quantidade: string;
  item: string;
  posologia: string;
}

export interface SavedFormPreset {
  id: string;
  ownerId?: string;
  formId: string;
  name: string;
  values: Record<string, string>;
  medications?: MedicationItem[];
  prescricaoMode?: 'formulario' | 'livre';
  fieldFontSizes?: Record<string, number>;
  createdAt: string;
}

