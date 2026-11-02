import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib';
import type { FormField, FormTemplate, MedicationItem } from '@/types/formTemplate';

const CHECKED_VALUES = new Set(['true', 'sim', 'on', '1', 'x', 'yes', 'marcado']);

export interface CanonicalFieldGroup {
  key: string;
  label: string;
  primaryField: FormField;
  fields: FormField[];
}

/**
 * Strips "1ª Via", "2ª Via", "(Retenção da Farmácia)", "(Orientação ao Paciente)", "(cópia)", etc.
 * so that corresponding fields on 1st and 2nd copies share the same clean label.
 */
export function cleanViaLabel(rawLabel: string): string {
  const s = (rawLabel || '')
    // Remove parentheticals mentioning via, cópia, retenção, orientação, farmácia
    .replace(
      /\(\s*(?:[^)]*\b(?:1[ªa°]?|2[ªa°]?|3[ªa°]?|primeira|segunda|terceira|via|c[oó]pia|reten[cç][aã]o|orienta[cç][aã]o|farm[aá]cia)\b[^)]*)\)/gi,
      ''
    )
    // Remove standalone "1ª via - ...", "... - 2ª via", "via 1", "via da farmácia", etc.
    .replace(
      /\b(?:1[ªa°]?|2[ªa°]?|3[ªa°]?|primeira|segunda|terceira)\s*via\b(?:\s*[-–—:/|]\s*(?:reten[cç][aã]o(?:\s*da\s*farm[aá]cia)?|orienta[cç][aã]o(?:\s*ao\s*paciente)?|farm[aá]cia|paciente|comprador|fornecedor))?/gi,
      ''
    )
    .replace(/\bvia\s*(?:1|2|3|i|ii|iii|da\s*farm[aá]cia|do\s*paciente|farm[aá]cia|paciente)\b/gi, '')
    .replace(/\b(?:reten[cç][aã]o\s*da\s*farm[aá]cia|orienta[cç][aã]o\s*ao\s*paciente)\b/gi, '')
    // Remove trailing (1), (2), #1, #2, - 1, - 2
    .replace(/(?:\s*[-–—#]\s*[12]|\s*\(\s*[12]\s*\))$/g, '')
    // Clean up leading/trailing separators
    .replace(/^[\s\-–—:/|]+|[\s\-–—:/|]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return s || (rawLabel || '').trim();
}

export function isPrescriptionField(field: FormField, template?: FormTemplate | null): boolean {
  if (field.type === 'prescription') return true;
  const lower = (field.label || '').toLowerCase();
  if (lower.includes('prescri')) return true;
  if (
    template?.category === 'receita' &&
    field.type === 'textarea' &&
    !lower.includes('emitente') &&
    !lower.includes('endere') &&
    !lower.includes('comprador') &&
    !lower.includes('fornecedor')
  ) {
    return true;
  }
  return false;
}

export function isRequestedExamsField(field: FormField, template?: FormTemplate | null): boolean {
  if (field.type === 'checkbox' || field.type === 'date' || field.type === 'prescription') return false;
  const lower = (field.label || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Explicit label matches for requested exams
  if (
    lower === 'exames' ||
    lower === 'exame' ||
    lower.includes('exames solicitados') ||
    lower.includes('exame solicitado') ||
    lower.includes('solicitacao de exames') ||
    lower.includes('relacao de exames') ||
    lower.includes('lista de exames') ||
    lower.includes('procedimentos solicitados')
  ) {
    return true;
  }

  const tplNameLower = (template?.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const isExamForm =
    template?.category === 'exames' ||
    template?.id === 'pedido_exames' ||
    tplNameLower.includes('exame') ||
    tplNameLower.includes('sadts') ||
    tplNameLower.includes('sadt');

  if (isExamForm) {
    if (lower.includes('exame') && !lower.includes('data')) {
      return true;
    }
    if (
      field.type === 'textarea' &&
      !lower.includes('indica') &&
      !lower.includes('justificativa') &&
      !lower.includes('hipotese') &&
      !lower.includes('diagnostico') &&
      !lower.includes('motivo') &&
      !lower.includes('sintoma') &&
      !lower.includes('observa') &&
      !lower.includes('historia') &&
      !lower.includes('resumo') &&
      !lower.includes('emitente') &&
      !lower.includes('endere')
    ) {
      return true;
    }
  }

  return false;
}

export function isDateField(field: FormField): boolean {
  if (field.type === 'date') return true;
  const lower = (field.label || '').toLowerCase();
  return (
    lower === 'data' ||
    lower.includes('data d') ||
    lower.includes('data solic') ||
    lower.includes('data emiss') ||
    lower.includes('nascimento')
  );
}

export function isReceitaTemplate(template?: FormTemplate | null): boolean {
  if (!template) return false;
  if (template.category === 'receita') return true;
  const nameLower = (template.name || '').toLowerCase();
  if (nameLower.includes('receit') || nameLower.includes('prescri')) return true;
  return (template.fields || []).some(
    (f) => f.type === 'prescription' || (f.label || '').toLowerCase().includes('prescri')
  );
}

/**
 * Identifies whether a template is a "Receita de Controle Especial" (which requires 2 filled copies/vias).
 */
export function isControleEspecialTemplate(template?: FormTemplate | null): boolean {
  if (!template) return false;
  const norm = `${template.id || ''} ${template.name || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (
    norm.includes('controle') ||
    norm.includes('especial') ||
    norm.includes('notifica') ||
    norm.includes('azul') ||
    norm.includes('amarela') ||
    norm.includes('duas vias') ||
    norm.includes('2 vias') ||
    norm.includes('antimicrobiano') ||
    norm.includes('psicotrop') ||
    norm.includes('retencao')
  ) {
    return true;
  }

  if (norm.includes('simples') || norm.includes('exame')) {
    return false;
  }

  // If it's a landscape prescription that already has mirrored fields mapped on both halves (x < 0.48 and x >= 0.48)
  const firstPage = template.pages?.[0];
  const isLandscape = firstPage ? firstPage.widthPts > firstPage.heightPts : false;
  if (isReceitaTemplate(template) && isLandscape) {
    const hasLeftField = (template.fields || []).some((f) => f.xNorm < 0.48);
    const hasRightField = (template.fields || []).some((f) => f.xNorm >= 0.48);
    if (hasLeftField && hasRightField) {
      return true;
    }
  }

  return false;
}

/**
 * Identifies whether a template is an Exam Request ("Pedido de Exames" / "Solicitação de Exames").
 */
export function isExamFormTemplate(template?: FormTemplate | null): boolean {
  if (!template) return false;
  if (template.category === 'exames' || template.id === 'pedido_exames') return true;
  const norm = `${template.id || ''} ${template.name || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (norm.includes('exame') || norm.includes('sadt') || norm.includes('laborat')) {
    return true;
  }
  return (template.fields || []).some((f) => isRequestedExamsField(f, template));
}

/**
 * Identifies templates that should be printed on half an A4 sheet (like Receita de Controle Especial,
 * but with only the 1st half filled and the 2nd half left with blank information):
 * - Receita Simples
 * - Pedido de Exames
 */
export function isHalfSheetSingleViaTemplate(template?: FormTemplate | null): boolean {
  if (!template) return false;
  if (isControleEspecialTemplate(template)) return false;
  return isReceitaTemplate(template) || isExamFormTemplate(template);
}

/**
 * Ensures that any Receita template has a "Data de Solicitação" field so the user
 * always has the date option available on prescriptions.
 */
export function ensureReceitaDateField(template: FormTemplate): FormTemplate {
  if (!isReceitaTemplate(template)) return template;

  const hasRequestDate = (template.fields || []).some(
    (f) => isDateField(f) && !(f.label || '').toLowerCase().includes('nascimento')
  );
  if (hasRequestDate) return template;

  const prescFields = (template.fields || []).filter((f) => isPrescriptionField(f, template));
  const extraDateFields: FormField[] = [];

  if (prescFields.length > 0) {
    prescFields.forEach((pf, idx) => {
      const suggestedY = Math.min(0.92, Math.max(0.84, pf.yNorm + pf.hNorm + 0.035));
      extraDateFields.push({
        id: idx === 0 ? 'f_data_solicitacao' : `f_data_solicitacao_${idx + 1}`,
        label: 'Data de Solicitação',
        type: 'date',
        page: pf.page || 0,
        xNorm: Math.min(0.8, pf.xNorm + 0.12),
        yNorm: suggestedY,
        wNorm: Math.min(0.24, pf.wNorm * 0.45),
        hNorm: 0.026,
        fontSize: 12.06,
      });
    });
  } else {
    extraDateFields.push({
      id: 'f_data_solicitacao',
      label: 'Data de Solicitação',
      type: 'date',
      page: 0,
      xNorm: 0.21,
      yNorm: 0.915,
      wNorm: 0.24,
      hNorm: 0.026,
      fontSize: 12.06,
    });
  }

  return {
    ...template,
    fields: [...template.fields, ...extraDateFields],
  };
}

/**
 * Computes a canonical key and clean display label for a field so that duplicate boxes
 * across 1ª Via and 2ª Via are unified into a single input in the UI and filled together.
 */
export function getCanonicalFieldInfo(
  field: FormField,
  template?: FormTemplate | null
): { key: string; label: string } {
  if (isPrescriptionField(field, template)) {
    return { key: '__prescription__', label: 'Prescrição' };
  }
  if (isRequestedExamsField(field, template)) {
    return { key: '__requested_exams__', label: cleanViaLabel(field.label) || 'Exames Solicitados' };
  }

  const cleaned = cleanViaLabel(field.label);
  let norm = cleaned
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(do|da|de|dos|das|o|a|no|na)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Unify common synonym variations between 1ª via and 2ª via
  if (norm === 'paciente' || norm === 'nome paciente' || norm === 'paciente nome completo') {
    norm = 'nome paciente';
  } else if (norm === 'endereco' || norm === 'endereco paciente') {
    norm = 'endereco paciente';
  } else if (
    norm === 'emitente' ||
    norm === 'identificacao emitente' ||
    norm === 'identificacao emitente medico'
  ) {
    norm = 'identificacao emitente';
  } else if (
    (field.type === 'date' || isDateField(field)) &&
    (norm === 'data' ||
      norm === 'data pedido' ||
      norm === 'data receita' ||
      norm === 'data emissao' ||
      norm === 'data solicitacao' ||
      norm === 'data atendimento')
  ) {
    return {
      key: 'date::data_solicitacao',
      label: 'Data de Solicitação',
    };
  }

  return {
    key: `${field.type}::${norm || field.id}`,
    label: cleaned,
  };
}

/**
 * Groups fields that belong to 1ª Via / 2ª Via of the same logical field into a single group.
 */
export function groupMirroredFields(
  fields: FormField[],
  template?: FormTemplate | null
): CanonicalFieldGroup[] {
  const groups: CanonicalFieldGroup[] = [];
  const map = new Map<string, CanonicalFieldGroup>();

  for (const field of fields) {
    const { key, label } = getCanonicalFieldInfo(field, template);
    const existing = map.get(key);
    if (existing) {
      existing.fields.push(field);
    } else {
      const group: CanonicalFieldGroup = {
        key,
        label,
        primaryField: field,
        fields: [field],
      };
      map.set(key, group);
      groups.push(group);
    }
  }

  return groups;
}

export function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const binary = atob(clean.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

export function formatDateBr(isoOrBrDate: string): string {
  if (!isoOrBrDate) return '';
  const parts = isoOrBrDate.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  }
  return isoOrBrDate;
}

/** Sanitizes text for WinAnsi (StandardFonts.Helvetica) so pdf-lib never crashes on unsupported glyphs. */
function sanitizeWinAnsi(str: string): string {
  return str
    .replace(/\t/g, '  ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u2026/g, '...')
    // Remove characters outside Latin-1 / WinAnsi safe range
    .replace(/[^\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
}

/** Formats structured MedicationItem[] into the standardized Brazilian prescription text block. */
export function formatMedicationsToText(medications: MedicationItem[]): string {
  const valid = medications.filter((m) => m.item.trim() || m.posologia.trim());
  if (valid.length === 0) return '';

  let text = '';
  const vias = Array.from(new Set<string>(valid.map((m) => (m.via || 'Oral').trim())));
  let globalIdx = 1;

  vias.forEach((via) => {
    text += `USO ${via.toUpperCase()}\n\n`;
    valid
      .filter((m) => (m.via || 'Oral').trim() === via)
      .forEach((med) => {
        const itemTitle = med.item.trim() || 'Medicamento';
        const qtd = (med.quantidade || '').trim();
        let line = `${globalIdx}) ${itemTitle} `;
        if (qtd) {
          let dashes = 72 - line.length - qtd.length;
          if (dashes < 5) dashes = 5;
          line += '-'.repeat(dashes) + ' ' + qtd;
        }
        text += line + '\n';
        if (med.posologia.trim()) {
          text += `   ${med.posologia.trim()}\n`;
        }
        text += '\n';
        globalIdx++;
      });
  });

  return text.trim();
}

/**
 * Splits a single token that is wider than the available line width into chunks
 * that each fit strictly within the target width.
 */
function breakWordToFit(
  word: string,
  font: PDFFont,
  size: number,
  firstChunkMaxWidth: number,
  nextChunkMaxWidth: number
): string[] {
  const chunks: string[] = [];
  let remaining = word;
  let isFirst = true;

  while (remaining.length > 0) {
    const limitW = Math.max(12, isFirst ? firstChunkMaxWidth : nextChunkMaxWidth);
    if (font.widthOfTextAtSize(remaining, size) <= limitW) {
      chunks.push(remaining);
      break;
    }

    let cut = 1;
    while (
      cut < remaining.length &&
      font.widthOfTextAtSize(remaining.slice(0, cut + 1), size) <= limitW
    ) {
      cut++;
    }

    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
    isFirst = false;
  }

  return chunks;
}

/**
 * Wraps a single paragraph where the first line and continuation lines can have different max widths.
 * Breaks at word boundaries first, and breaks mid-word if any single token exceeds the line width.
 */
function wrapParagraphWithWidths(
  paragraph: string,
  font: PDFFont,
  size: number,
  firstLineMaxWidth: number,
  continuationMaxWidth: number
): string[] {
  const words = paragraph.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let current = '';
  const getMaxW = () => Math.max(12, lines.length === 0 ? firstLineMaxWidth : continuationMaxWidth);

  for (const word of words) {
    if (!current) {
      const limitW = getMaxW();
      if (font.widthOfTextAtSize(word, size) <= limitW) {
        current = word;
      } else {
        const chunks = breakWordToFit(word, font, size, limitW, continuationMaxWidth);
        for (let i = 0; i < chunks.length - 1; i++) {
          lines.push(chunks[i]);
        }
        current = chunks[chunks.length - 1] || '';
      }
      continue;
    }

    const limitW = getMaxW();
    const candidate = `${current} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= limitW) {
      current = candidate;
    } else if (font.widthOfTextAtSize(word, size) <= Math.max(12, continuationMaxWidth)) {
      // Normal word fits on the next line
      lines.push(current);
      current = word;
    } else {
      // Oversized unbroken word: pack what fits on the current line if reasonable, then slice the rest
      const prefixWithSpace = `${current} `;
      const remainingLineW = limitW - font.widthOfTextAtSize(prefixWithSpace, size);
      if (
        remainingLineW > size * 2 &&
        font.widthOfTextAtSize(word.slice(0, 1), size) <= remainingLineW
      ) {
        const chunks = breakWordToFit(word, font, size, remainingLineW, continuationMaxWidth);
        lines.push(`${prefixWithSpace}${chunks[0]}`);
        for (let i = 1; i < chunks.length - 1; i++) {
          lines.push(chunks[i]);
        }
        current = chunks.length > 1 ? chunks[chunks.length - 1] : '';
      } else {
        lines.push(current);
        const chunks = breakWordToFit(word, font, size, continuationMaxWidth, continuationMaxWidth);
        for (let i = 0; i < chunks.length - 1; i++) {
          lines.push(chunks[i]);
        }
        current = chunks[chunks.length - 1] || '';
      }
    }
  }

  if (current) lines.push(current);
  return lines;
}

/** Wraps text to fit maxWidth, respecting explicit line breaks the user typed. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const safeText = sanitizeWinAnsi(text);
  const lines: string[] = [];
  for (const paragraph of safeText.split(/\r?\n/)) {
    if (paragraph.trim() === '') {
      lines.push('');
      continue;
    }
    lines.push(...wrapParagraphWithWidths(paragraph, font, size, maxWidth, maxWidth));
  }
  return lines;
}

export type VerticalAlignMode = 'bottom' | 'middle' | 'top';
export type HalfSheetLayoutMode = 'half_blank_form' | 'half_empty_white' | 'full_original';

export interface GeneratePdfOptions {
  fieldFontSizes?: Record<string, number>;
  fieldAlignments?: Record<string, VerticalAlignMode>;
  globalFontSize?: number;
  halfSheetMode?: HalfSheetLayoutMode;
}

/**
 * Loads the original template PDF and stamps the user's values on top of it at the
 * exact positions defined for each field, producing a real vector filled PDF.
 * Automatically mirrors values across 1ª Via and 2ª Via fields that belong to the same group.
 * For Receita Simples and Pedido de Exames, formats the output as a half-sheet A4 Landscape
 * (like Receita de Controle Especial) with the 1st half filled and the 2nd half left with blank information.
 */
export async function generateFilledPdf(
  rawTemplate: FormTemplate,
  values: Record<string, string>,
  optionsOrFontSize?: number | GeneratePdfOptions
): Promise<Uint8Array> {
  const template = ensureReceitaDateField(rawTemplate);
  const opts: GeneratePdfOptions =
    typeof optionsOrFontSize === 'number'
      ? { globalFontSize: optionsOrFontSize }
      : optionsOrFontSize || {};

  const halfSheetMode: HalfSheetLayoutMode = opts.halfSheetMode || 'half_blank_form';
  const useHalfSheet =
    isHalfSheetSingleViaTemplate(template) && halfSheetMode !== 'full_original';

  // Mirror values & font sizes across multi-via grouped fields so filling 1 box fills all vias
  const mirroredValues: Record<string, string> = { ...values };
  const mirroredFontSizes: Record<string, number> = { ...(opts.fieldFontSizes || {}) };
  const mirroredAlignments: Record<string, VerticalAlignMode> = { ...(opts.fieldAlignments || {}) };
  const groups = groupMirroredFields(template.fields, template);

  for (const group of groups) {
    if (group.fields.length <= 1) continue;
    const populatedField = group.fields.find(
      (f) => mirroredValues[f.id] !== undefined && mirroredValues[f.id] !== ''
    );
    if (populatedField) {
      const val = mirroredValues[populatedField.id];
      for (const f of group.fields) {
        if (!mirroredValues[f.id]) {
          mirroredValues[f.id] = val;
        }
      }
    }
    const primarySize = mirroredFontSizes[group.primaryField.id];
    if (primarySize !== undefined) {
      for (const f of group.fields) {
        if (mirroredFontSizes[f.id] === undefined) {
          mirroredFontSizes[f.id] = primarySize;
        }
      }
    }
    const primaryAlign = mirroredAlignments[group.primaryField.id];
    if (primaryAlign !== undefined) {
      for (const f of group.fields) {
        if (mirroredAlignments[f.id] === undefined) {
          mirroredAlignments[f.id] = primaryAlign;
        }
      }
    }
  }

  const origPdfBytes = base64ToBytes(template.pdfBase64);
  const pdfDoc = await PDFDocument.load(origPdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  for (const field of template.fields) {
    const raw = mirroredValues[field.id];
    if (raw === undefined || raw === null || raw === '') continue;

    const page = pages[field.page];
    if (!page) continue;

    const { width, height } = page.getSize();

    // If the page is already landscape (2 halves side-by-side) and this is a Receita Simples or Pedido de Exames
    // in half-sheet mode, leave the 2nd half (right side, xNorm >= 0.5) with its information blank.
    if (useHalfSheet && width > height && field.xNorm >= 0.5) {
      continue;
    }

    const boxX = field.xNorm * width;
    const boxYTop = field.yNorm * height;
    const boxW = field.wNorm * width;
    const boxH = field.hNorm * height;
    const fontSize = Number(mirroredFontSizes[field.id] ?? field.fontSize ?? opts.globalFontSize ?? 10);

    if (field.type === 'checkbox') {
      if (CHECKED_VALUES.has(String(raw).toLowerCase().trim())) {
        const markSize = Math.max(7, Math.min(fontSize + 1, boxH * 0.85));
        page.drawText('X', {
          x: boxX + boxW / 2 - markSize * 0.32,
          y: height - boxYTop - boxH / 2 - markSize * 0.36,
          size: markSize,
          font: fontBold,
          color: rgb(0, 0, 0),
        });
      }
      continue;
    }

    const value = field.type === 'date' ? formatDateBr(raw) : raw;

    if (isRequestedExamsField(field, template)) {
      const rawItems = String(value)
        .split(/\r?\n/)
        .map((line) =>
          line
            .replace(/^\s*(?:\d+\s*[.)\-–—:]\s*|[-•*]\s*)/, '')
            .trim()
        )
        .filter(Boolean);

      if (rawItems.length === 0) continue;

      // Ensure the 2-column area stays strictly inside the form border while having proper width/height
      const isLandscapePage = width > height;
      const safeRightX = isLandscapePage
        ? field.xNorm < 0.48
          ? width * 0.476
          : width * 0.976
        : width * 0.94;
      const maxAvailableW = Math.max(40, safeRightX - boxX);
      const effectiveBoxW =
        boxW < maxAvailableW * 0.65
          ? maxAvailableW
          : Math.min(boxW, maxAvailableW);

      const fieldsBelow = template.fields.filter(
        (other) =>
          other.page === field.page &&
          other.id !== field.id &&
          other.yNorm > field.yNorm + 0.02 &&
          Math.abs(other.xNorm - field.xNorm) < 0.38
      );
      const nearestBelowYNorm =
        fieldsBelow.length > 0
          ? Math.min(...fieldsBelow.map((o) => o.yNorm))
          : 0.87;
      const safeBottomY = Math.max(boxYTop + boxH, (nearestBelowYNorm - 0.015) * height);
      const effectiveBoxH = Math.max(boxH, safeBottomY - boxYTop);

      const leftPad = 4;
      const colGap = 12;
      const colWidth = Math.max(30, (effectiveBoxW - leftPad * 2 - colGap) / 2);
      const col1X = boxX + leftPad;
      const col2X = col1X + colWidth + colGap;

      // Preserve the exact configured fontSize (never shrink the font down for long exam names)
      const activeFontSize = fontSize;
      const activeLineHeight = activeFontSize * 1.24;

      // Wrap each exam onto the next line(s) if its name is wider than colWidth,
      // keeping the exam number attached to the first line and indenting continuation lines
      const wrapExamItem = (rawExamText: string, idx: number): string[] => {
        const prefix = `${idx + 1}. `;
        const contIndent = '   ';
        const prefixW = font.widthOfTextAtSize(prefix, activeFontSize);
        const contIndentW = font.widthOfTextAtSize(contIndent, activeFontSize);
        const firstLineMaxW = Math.max(20, colWidth - prefixW);
        const contLineMaxW = Math.max(20, colWidth - contIndentW);
        const safeExam = sanitizeWinAnsi(rawExamText);

        const bodyLines = wrapParagraphWithWidths(
          safeExam,
          font,
          activeFontSize,
          firstLineMaxW,
          contLineMaxW
        );

        return bodyLines.map((line, lineIdx) =>
          lineIdx === 0 ? `${prefix}${line}` : `${contIndent}${line}`
        );
      };

      const wrappedItems: string[][] = rawItems.map((item, idx) => wrapExamItem(item, idx));
      const maxAllowedLines = Math.max(
        1,
        Math.floor((effectiveBoxH + activeLineHeight * 0.25) / activeLineHeight)
      );

      // Distribute items across the 2 columns while respecting wrapped multi-line exam heights
      let splitIdx = Math.ceil(wrappedItems.length / 2);
      while (splitIdx > 1) {
        const col1Count = wrappedItems
          .slice(0, splitIdx)
          .reduce((acc, lines) => acc + lines.length, 0);
        const col2Count = wrappedItems
          .slice(splitIdx)
          .reduce((acc, lines) => acc + lines.length, 0);
        if (
          col1Count > maxAllowedLines &&
          col2Count + wrappedItems[splitIdx - 1].length <= Math.max(maxAllowedLines, col1Count - 1)
        ) {
          splitIdx--;
        } else {
          break;
        }
      }

      const col1Lines = wrappedItems.slice(0, splitIdx).flat();
      const col2Lines = wrappedItems.slice(splitIdx).flat();

      col1Lines.slice(0, maxAllowedLines).forEach((line, i) => {
        const yOffset = height - boxYTop - activeFontSize - 1 - i * activeLineHeight;
        page.drawText(line, {
          x: col1X,
          y: yOffset,
          size: activeFontSize,
          font,
          color: rgb(0.04, 0.04, 0.08),
        });
      });

      col2Lines.slice(0, maxAllowedLines).forEach((line, i) => {
        const yOffset = height - boxYTop - activeFontSize - 1 - i * activeLineHeight;
        page.drawText(line, {
          x: col2X,
          y: yOffset,
          size: activeFontSize,
          font,
          color: rgb(0.04, 0.04, 0.08),
        });
      });

      continue;
    }

    const lineHeight = fontSize * 1.22;
    const isSingleLine = field.type === 'text' || field.type === 'date';
    const maxLines = isSingleLine ? 1 : Math.max(1, Math.floor((boxH + lineHeight * 0.35) / lineHeight));
    const lines = wrapText(value, font, fontSize, Math.max(boxW - 4, 12)).slice(0, maxLines);
    const alignMode: VerticalAlignMode = mirroredAlignments[field.id] || 'bottom';

    lines.forEach((line, i) => {
      let yOffset: number;
      if (isSingleLine) {
        if (alignMode === 'top') {
          yOffset = height - boxYTop - Math.min(boxH * 0.52, fontSize + 1);
        } else if (alignMode === 'middle') {
          yOffset = height - boxYTop - boxH / 2 - fontSize * 0.34;
        } else {
          // 'bottom' (baseline sits neatly on the line)
          yOffset = height - boxYTop - Math.max(fontSize, boxH - 2);
        }
      } else {
        yOffset = height - boxYTop - fontSize - 1 - i * lineHeight;
      }

      page.drawText(line, {
        x: boxX + 2,
        y: yOffset,
        size: fontSize,
        font,
        color: rgb(0.04, 0.04, 0.08),
        maxWidth: Math.max(boxW - 4, 12),
      });
    });
  }

  const filledPdfBytes = await pdfDoc.save();
  if (!useHalfSheet) {
    return filledPdfBytes;
  }

  // Transform Receita Simples & Pedido de Exames into the A4 Landscape 2-Half layout
  // (like Receita de Controle Especial, with 1st half filled and 2nd half with blank information)
  const filledSourceDoc = await PDFDocument.load(filledPdfBytes);
  const blankSourceDoc = await PDFDocument.load(origPdfBytes);
  const outDoc = await PDFDocument.create();

  const filledPages = filledSourceDoc.getPages();
  const blankPages = blankSourceDoc.getPages();

  for (let i = 0; i < filledPages.length; i++) {
    const filledPage = filledPages[i];
    const blankPage = blankPages[i];
    const { width: srcW, height: srcH } = filledPage.getSize();

    if (srcH >= srcW) {
      // Source page is Full-Page Portrait (e.g., A4 Portrait Receita Simples or Pedido de Exames):
      // Place 2 half-pages side-by-side on an A4 Landscape sheet (841.89 x 595.28 pts)
      const A4_LANDSCAPE_W = 841.89;
      const A4_LANDSCAPE_H = 595.28;
      const halfW = A4_LANDSCAPE_W / 2;
      const outPage = outDoc.addPage([A4_LANDSCAPE_W, A4_LANDSCAPE_H]);

      const scale = Math.min(halfW / srcW, A4_LANDSCAPE_H / srcH);
      const drawW = srcW * scale;
      const drawH = srcH * scale;
      const offsetX = (halfW - drawW) / 2;
      const offsetY = (A4_LANDSCAPE_H - drawH) / 2;

      // Left half: Filled form (1ª metade preenchida)
      const embeddedFilled = await outDoc.embedPage(filledPage);
      outPage.drawPage(embeddedFilled, {
        x: offsetX,
        y: offsetY,
        width: drawW,
        height: drawH,
      });

      // Right half: Unfilled form template ("com as informações em branco") unless user chose empty white
      if (halfSheetMode === 'half_blank_form' && blankPage) {
        const embeddedBlank = await outDoc.embedPage(blankPage);
        outPage.drawPage(embeddedBlank, {
          x: halfW + offsetX,
          y: offsetY,
          width: drawW,
          height: drawH,
        });
      }

      // Dashed vertical cut line in the middle
      for (let y = 14; y < A4_LANDSCAPE_H - 14; y += 8) {
        outPage.drawLine({
          start: { x: halfW, y },
          end: { x: halfW, y: Math.min(y + 4, A4_LANDSCAPE_H - 14) },
          thickness: 0.6,
          color: rgb(0.7, 0.73, 0.77),
        });
      }
    } else {
      // Source page is already Landscape (e.g., Pedido de Exames with left half form):
      // Keep left half filled, and on the right half place the unfilled form template (or white if selected)
      const halfW = srcW / 2;
      const outPage = outDoc.addPage([srcW, srcH]);

      const embeddedFilled = await outDoc.embedPage(filledPage);
      outPage.drawPage(embeddedFilled, {
        x: 0,
        y: 0,
        width: srcW,
        height: srcH,
      });

      // Clear right half to ensure no stray marks
      outPage.drawRectangle({
        x: halfW,
        y: 0,
        width: halfW,
        height: srcH,
        color: rgb(1, 1, 1),
      });

      if (halfSheetMode === 'half_blank_form' && blankPage) {
        const embeddedBlankLeftHalf = await outDoc.embedPage(blankPage, {
          left: 0,
          bottom: 0,
          right: halfW,
          top: srcH,
        });
        outPage.drawPage(embeddedBlankLeftHalf, {
          x: halfW,
          y: 0,
          width: halfW,
          height: srcH,
        });
      }

      // Dashed vertical cut line in the middle
      for (let y = 14; y < srcH - 14; y += 8) {
        outPage.drawLine({
          start: { x: halfW, y },
          end: { x: halfW, y: Math.min(y + 4, srcH - 14) },
          thickness: 0.6,
          color: rgb(0.7, 0.73, 0.77),
        });
      }
    }
  }

  return outDoc.save();
}

export function downloadPdfBytes(bytes: Uint8Array, filename: string) {
  const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revoking object URL so Safari (macOS & iOS) finishes reading the blob stream
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function shareOrDownloadPdfBytes(bytes: Uint8Array, filename: string): Promise<boolean> {
  const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  try {
    const file = new File([bytes], safeName, { type: 'application/pdf' });
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({
        files: [file],
        title: safeName,
      });
      return true;
    }
  } catch (err: any) {
    if (err?.name === 'AbortError') return false;
  }
  downloadPdfBytes(bytes, safeName);
  return true;
}
