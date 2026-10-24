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
    field.type === 'date' &&
    (norm === 'data' || norm === 'data pedido' || norm === 'data receita' || norm === 'data emissao')
  ) {
    norm = 'data emissao';
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

/** Wraps text to fit maxWidth, respecting explicit line breaks the user typed. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const safeText = sanitizeWinAnsi(text);
  const lines: string[] = [];
  for (const paragraph of safeText.split(/\r?\n/)) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }
    let current = '';
    for (const word of paragraph.split(/\s+/)) {
      if (!word) continue;
      const candidate = current ? `${current} ${word}` : word;
      if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

export interface GeneratePdfOptions {
  fieldFontSizes?: Record<string, number>;
  globalFontSize?: number;
}

/**
 * Loads the original template PDF and stamps the user's values on top of it at the
 * exact positions defined for each field, producing a real vector filled PDF.
 * Automatically mirrors values across 1ª Via and 2ª Via fields that belong to the same group.
 */
export async function generateFilledPdf(
  template: FormTemplate,
  values: Record<string, string>,
  optionsOrFontSize?: number | GeneratePdfOptions
): Promise<Uint8Array> {
  const opts: GeneratePdfOptions =
    typeof optionsOrFontSize === 'number'
      ? { globalFontSize: optionsOrFontSize }
      : optionsOrFontSize || {};

  // Mirror values & font sizes across multi-via grouped fields so filling 1 box fills all vias
  const mirroredValues: Record<string, string> = { ...values };
  const mirroredFontSizes: Record<string, number> = { ...(opts.fieldFontSizes || {}) };
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
  }

  const pdfDoc = await PDFDocument.load(base64ToBytes(template.pdfBase64));
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  for (const field of template.fields) {
    const raw = mirroredValues[field.id];
    if (raw === undefined || raw === null || raw === '') continue;

    const page = pages[field.page];
    if (!page) continue;

    const { width, height } = page.getSize();
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

      const numberedItems = rawItems.map((item, idx) => `${idx + 1}. ${item}`);

      // Split evenly into 2 columns strictly inside the defined field box (boxX..boxX+boxW, boxYTop..boxYTop+boxH)
      const mid = Math.ceil(numberedItems.length / 2);
      const col1Items = numberedItems.slice(0, mid);
      const col2Items = numberedItems.slice(mid);

      const leftPad = 4;
      const colGap = 10;
      const colWidth = Math.max(20, (boxW - leftPad * 2 - colGap) / 2);
      const col1X = boxX + leftPad;
      const col2X = col1X + colWidth + colGap;

      const getMaxItemWidth = (size: number) =>
        Math.max(
          0,
          ...numberedItems.map((item) => font.widthOfTextAtSize(sanitizeWinAnsi(item), size))
        );

      let activeFontSize = fontSize;
      let activeLineHeight = activeFontSize * 1.24;
      let col1Lines = wrapText(col1Items.join('\n'), font, activeFontSize, colWidth);
      let col2Lines = wrapText(col2Items.join('\n'), font, activeFontSize, colWidth);
      let neededLines = Math.max(col1Lines.length, col2Lines.length);

      // Scale down font if items exceed the defined box height or column width
      while (
        (neededLines * activeLineHeight > boxH || getMaxItemWidth(activeFontSize) > colWidth) &&
        activeFontSize > 6
      ) {
        activeFontSize = Number((activeFontSize - 0.5).toFixed(1));
        activeLineHeight = activeFontSize * 1.18;
        col1Lines = wrapText(col1Items.join('\n'), font, activeFontSize, colWidth);
        col2Lines = wrapText(col2Items.join('\n'), font, activeFontSize, colWidth);
        neededLines = Math.max(col1Lines.length, col2Lines.length);
      }

      const maxAllowedLines = Math.max(
        1,
        Math.floor((boxH + activeLineHeight * 0.2) / activeLineHeight)
      );

      col1Lines.slice(0, maxAllowedLines).forEach((line, i) => {
        const yOffset = height - boxYTop - activeFontSize - 1 - i * activeLineHeight;
        page.drawText(line, {
          x: col1X,
          y: yOffset,
          size: activeFontSize,
          font,
          color: rgb(0.04, 0.04, 0.08),
          maxWidth: colWidth,
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
          maxWidth: colWidth,
        });
      });

      continue;
    }

    const lineHeight = fontSize * 1.22;
    const isSingleLine = field.type === 'text' || field.type === 'date';
    const maxLines = isSingleLine ? 1 : Math.max(1, Math.floor((boxH + lineHeight * 0.35) / lineHeight));
    const lines = wrapText(value, font, fontSize, Math.max(boxW - 4, 12)).slice(0, maxLines);

    lines.forEach((line, i) => {
      // Vertically center single-line fields slightly inside their box
      const yOffset = isSingleLine
        ? height - boxYTop - Math.min(boxH * 0.72, fontSize + 2)
        : height - boxYTop - fontSize - 1 - i * lineHeight;

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

  return pdfDoc.save();
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
