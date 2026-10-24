import {
  buildPrompt,
  buildTranscritorPrompt,
  buildFieldDetectionPrompt,
  buildAutoFieldDetectionPrompt,
  buildFormAutoFillPrompt,
  MULTIMODAL_TYPES,
} from '../../server/prompts';
import type { AiGenerateType } from '@/hooks/useAiGenerate';

export interface PromptBuildInput {
  type: AiGenerateType;
  formData?: unknown;
  customPrompt?: string;
  outputFormat?: string;
  fieldLabels?: string[];
  alreadyFound?: string[];
  formFields?: Array<{ id: string; label: string; type: string }>;
}

export function buildClientPrompt(options: PromptBuildInput): string {
  const isMultimodal = (MULTIMODAL_TYPES as readonly string[]).includes(options.type);

  if (isMultimodal) {
    if (options.type === 'detectar-campos-pdf') {
      return buildFieldDetectionPrompt(
        options.fieldLabels || [],
        options.alreadyFound || []
      );
    }
    if (options.type === 'auto-detectar-campos-pdf') {
      return buildAutoFieldDetectionPrompt();
    }
    if (options.type === 'preencher-formulario-ia') {
      return buildFormAutoFillPrompt(options.formFields || [], options.customPrompt);
    }
    return buildTranscritorPrompt(options.customPrompt, options.outputFormat);
  }

  return buildPrompt(options.type, options.formData);
}
