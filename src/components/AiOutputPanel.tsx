import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Textarea } from '@/components/ui';
import { Bot, Copy, Download, Save, FileText, Pencil, Check } from 'lucide-react';

interface AiOutputPanelProps {
  text: string;
  onChange?: (newText: string) => void;
  loading: boolean;
  onCopy: () => void;
  onDownloadPdf: () => void;
  onSave: () => void;
  emptyLabel: React.ReactNode;
  title?: string;
  patientName?: string;
}

export function AiOutputPanel({
  text,
  onChange,
  loading,
  onCopy,
  onDownloadPdf,
  onSave,
  emptyLabel,
  title = 'Texto Gerado',
}: AiOutputPanelProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="lg:sticky lg:top-8 h-fit">
      <Card className="h-full border-teal-200 bg-teal-50/30 overflow-hidden shadow-sm">
        <CardHeader className="bg-teal-600 text-white py-3.5 px-5 flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Bot className="w-5 h-5" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-1.5 flex-wrap">
            {text && (
              <>
                {onChange && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-teal-500 h-8 px-2.5 text-xs gap-1.5"
                    onClick={() => setIsEditing(!isEditing)}
                    title={isEditing ? 'Concluir Edição' : 'Editar Texto'}
                  >
                    {isEditing ? <Check className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                    {isEditing ? 'Pronto' : 'Editar'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-teal-500 h-8 px-2.5 text-xs gap-1.5"
                  onClick={onCopy}
                  title="Copiar para Prontuário"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-teal-500 h-8 w-8"
                  onClick={onDownloadPdf}
                  title="Baixar PDF"
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-teal-500 h-8 w-8"
                  onClick={onSave}
                  title="Salvar no Histórico"
                >
                  <Save className="w-4 h-4" />
                </Button>
              </>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-teal-700 min-h-[450px] text-center bg-white">
              <Bot className="w-10 h-10 mb-4 animate-pulse text-teal-500" />
              <p className="text-sm font-medium">Sintetizando os dados clínicos em linguagem médica...</p>
              <p className="text-xs text-slate-400 mt-1">Estruturando semiologia, sinais vitais e conduta</p>
            </div>
          ) : text ? (
            isEditing && onChange ? (
              <div className="p-4 bg-white">
                <Textarea
                  value={text}
                  onChange={(e) => onChange(e.target.value)}
                  className="min-h-[450px] font-mono text-sm leading-relaxed text-slate-800 border-teal-300 focus-visible:ring-teal-500"
                />
                <p className="text-[11px] text-slate-400 mt-2 text-right">
                  Modo de edição ativo — suas alterações serão mantidas ao copiar, salvar ou gerar PDF.
                </p>
              </div>
            ) : (
              <div className="p-6 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans bg-white min-h-[450px] max-h-[680px] overflow-y-auto custom-scrollbar">
                {text}
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 min-h-[450px] text-center bg-white space-y-4">
              <FileText className="w-12 h-12 text-slate-200" />
              <p className="text-sm">{emptyLabel}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
