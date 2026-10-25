import React, { useState, useRef } from 'react';
import { Button, Textarea } from '@/components/ui';
import { Paperclip, Send, Copy, FileText, AlertCircle, RefreshCw, Save, Trash2, Wand2, X } from 'lucide-react';
import { cn, copyToClipboard } from '@/lib/utils';
import { prepareFilesSequentially } from '@/lib/fileToBase64';
import { useAiGenerate } from '@/hooks/useAiGenerate';
import { useToast } from '@/hooks/useToast';
import { useLocalStorage } from '@/hooks/useLocalStorage';

type Message = { role: 'user' | 'assistant', content: string, type?: 'image' | 'text' };
interface SavedSession { id: string; name: string; date: string; messages: Message[] }
interface SavedFormat { id: string; label: string; format: string }

const BATCH_SIZE = 4;

export default function TranscritorExames() {
  const [isSync, setIsSync] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [outputFormat, setOutputFormat] = useState('');
  const [mobileTab, setMobileTab] = useState<'chat' | 'options'>('chat');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [savedSessions, setSavedSessions] = useLocalStorage<SavedSession[]>('transcricoes_salvas', []);
  const [savedFormats, setSavedFormats] = useLocalStorage<SavedFormat[]>('transcritor_formatos_salvos', []);

  const { generate, loading: isLoading } = useAiGenerate();
  const { toast } = useToast();

  const replaceLastLoadingMessage = (content: string) => {
    setMessages(prev => {
      const newMessages = [...prev];
      const last = newMessages[newMessages.length - 1];
      if (last && last.role === 'assistant') {
        newMessages[newMessages.length - 1] = { ...last, content };
      } else {
        newMessages.push({ role: 'assistant', content });
      }
      return newMessages;
    });
  };

  const processWithAI = async (text: string, inlineDatas?: { mimeType: string, data: string }[]) => {
    if (inlineDatas && inlineDatas.length > BATCH_SIZE) {
      const totalBatches = Math.ceil(inlineDatas.length / BATCH_SIZE);
      const transcribedParts: string[] = [];

      for (let b = 0; b < totalBatches; b++) {
        if (b > 0) {
          await new Promise((r) => setTimeout(r, 500));
        }
        const chunk = inlineDatas.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        replaceLastLoadingMessage(
          transcribedParts.length > 0
            ? `${transcribedParts.join('\n\n')}\n\nTranscrevendo lote ${b + 1} de ${totalBatches}...`
            : `Transcrevendo exames (lote ${b + 1} de ${totalBatches})...`
        );

        let partResult = await generate<string>({
          type: 'transcritor-exames',
          customPrompt: text,
          inlineDatas: chunk,
          outputFormat,
          errorMessage: `Erro ao transcrever lote ${b + 1} de ${totalBatches}.`,
        });

        if (!partResult || !partResult.trim()) {
          await new Promise((r) => setTimeout(r, 1200));
          partResult = await generate<string>({
            type: 'transcritor-exames',
            customPrompt: text,
            inlineDatas: chunk,
            outputFormat,
            errorMessage: `Erro ao transcrever lote ${b + 1} de ${totalBatches}.`,
          });
        }

        if (partResult && partResult.trim()) {
          transcribedParts.push(partResult.trim());
        }
      }

      if (transcribedParts.length > 0) {
        replaceLastLoadingMessage(transcribedParts.join('\n\n'));
      } else {
        replaceLastLoadingMessage('Erro ao transcrever exame. Tente novamente.');
      }
      return;
    }

    const result = await generate<string>({
      type: 'transcritor-exames',
      customPrompt: text,
      inlineDatas,
      outputFormat,
      errorMessage: 'Erro ao transcrever exame. Tente novamente.',
    });
    replaceLastLoadingMessage(result ?? 'Erro ao transcrever exame. Tente novamente.');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setMessages(prev => [...prev, { role: 'user', content: `[${files.length} arquivo(s) anexado(s)]` }]);
      setMessages(prev => [...prev, { role: 'assistant', content: `Preparando ${files.length} arquivo(s)...` }]);
      
      try {
        const inlineDatas = await prepareFilesSequentially(files, (curr, total) => {
          if (total > 1) {
            replaceLastLoadingMessage(`Otimizando arquivo ${curr} de ${total}...`);
          }
        });
        if (inlineDatas.length === 0) {
          replaceLastLoadingMessage('Não foi possível ler os arquivos selecionados. Tente enviar foto em JPG/PNG ou PDF.');
          return;
        }
        replaceLastLoadingMessage('Lendo exames anexados...');
        await processWithAI('', inlineDatas);
      } catch (error) {
        console.error(error);
        replaceLastLoadingMessage('Erro ao processar os arquivos selecionados. Tente novamente.');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: 'user', content: input }]);
    const currentInput = input;
    setInput('');
    
    setMessages(prev => [...prev, { role: 'assistant', content: 'Transcrevendo exames...' }]);
    processWithAI(currentInput);
  };

  const getCompiledText = () => {
    return messages
      .filter(m => m.role === 'assistant' && !m.content.includes('Lendo exame anexado...') && !m.content.includes('Transcrevendo exames...') && !m.content.includes('Lendo exames anexados...'))
      .map(m => m.content)
      .join('\n\n');
  };

  const handleCompilar = async () => {
    const compiledText = getCompiledText();
    if (compiledText) {
      const ok = await copyToClipboard(compiledText);
      if (ok) {
        toast('Transcrições copiadas para a área de transferência!', 'success');
      } else {
        toast('Não foi possível copiar automaticamente.', 'error');
      }
    } else {
      toast('Nenhuma transcrição disponível para compilar ainda.', 'info');
    }
  };

  const handleLimpar = () => {
    setMessages([]);
  };

  const handleNovoPaciente = () => {
    setMessages([]);
    toast('Novo paciente iniciado — histórico de exames limpo.', 'info');
  };

  const handleSalvarSessao = () => {
    const relevant = messages.filter(
      m => !(m.role === 'assistant' && (m.content.includes('Lendo exame anexado...') || m.content.includes('Transcrevendo exames...')))
    );
    if (relevant.length === 0) {
      toast('Nada para salvar ainda. Transcreva um exame primeiro.', 'info');
      return;
    }
    const firstUserMsg = messages.find(m => m.role === 'user')?.content || '';
    const label = firstUserMsg.replace('[Arquivo anexado: ', '').replace(']', '').replace('[Imagem colada]', 'Imagem colada').slice(0, 42);
    const entry: SavedSession = {
      id: Date.now().toString(),
      name: label || `Sessão ${new Date().toLocaleDateString('pt-BR')}`,
      date: new Date().toLocaleString('pt-BR'),
      messages,
    };
    setSavedSessions(prev => [entry, ...prev]);
    toast('Sessão de transcrição salva!', 'success');
  };

  const handleLoadSession = (entry: SavedSession) => {
    setMessages(entry.messages);
    setMobileTab('chat');
    toast(`Sessão "${entry.name}" carregada.`, 'success');
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedSessions(prev => prev.filter(s => s.id !== id));
  };

  const handleSalvarFormato = () => {
    if (!outputFormat.trim()) {
      toast('Cole um exemplo de formato de saída antes de salvar.', 'info');
      return;
    }
    const label = outputFormat.trim().split('\n')[0].slice(0, 28) || 'Formato sem título';
    const entry: SavedFormat = { id: Date.now().toString(), label, format: outputFormat };
    setSavedFormats(prev => [entry, ...prev]);
    toast('Formato de saída salvo!', 'success');
  };

  const handleUseFormat = (f: SavedFormat) => {
    setOutputFormat(f.format);
    toast(`Formato "${f.label}" aplicado.`, 'success');
  };

  const handleDeleteFormat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedFormats(prev => prev.filter(f => f.id !== id));
  };

  const assistantCount = messages.filter(m => m.role === 'assistant').length;

  return (
    <div className="h-[calc(100dvh-3.5rem)] md:h-full flex flex-col -m-4 md:-m-8 overflow-hidden">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 px-3 py-2.5 sm:px-6 sm:py-3.5 flex flex-col gap-2.5 shrink-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3 sm:gap-5 min-w-0">
            <h1 className="text-base sm:text-xl font-bold text-slate-800 truncate">
              Transcritor de Exames
            </h1>
            <label className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-600 cursor-pointer shrink-0">
              <input 
                type="checkbox" 
                checked={isSync} 
                onChange={e => setIsSync(e.target.checked)}
                className="rounded text-teal-600 focus:ring-teal-500" 
              />
              <span>Sincronizada</span>
            </label>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto justify-start sm:justify-end overflow-x-auto no-scrollbar">
            <Button
              variant="outline"
              className="text-slate-700 gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 text-xs whitespace-nowrap shrink-0"
              onClick={handleCompilar}
            >
              <Copy className="w-3.5 h-3.5 shrink-0" />
              <span>COMPILAR ({assistantCount})</span>
            </Button>
            <Button
              variant="outline"
              className="text-slate-700 gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 text-xs whitespace-nowrap shrink-0"
              onClick={handleLimpar}
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              <span>LIMPAR</span>
            </Button>
            <Button
              variant="outline"
              className="text-teal-700 border-teal-200 hover:bg-teal-50 gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 text-xs whitespace-nowrap shrink-0"
              onClick={handleSalvarSessao}
            >
              <Save className="w-3.5 h-3.5 shrink-0" />
              <span>SALVAR</span>
            </Button>
          </div>
        </div>

        {/* Mobile Segmented Tab Switcher (hidden on lg+) */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg lg:hidden">
          <button
            type="button"
            onClick={() => setMobileTab('chat')}
            className={cn(
              'py-1.5 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
              mobileTab === 'chat'
                ? 'bg-white text-teal-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>Transcrever Exames</span>
            {assistantCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                {assistantCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('options')}
            className={cn(
              'py-1.5 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
              mobileTab === 'options'
                ? 'bg-white text-teal-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            <Wand2 className="w-3.5 h-3.5 shrink-0" />
            <span>Formato & Salvos</span>
            {savedSessions.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                {savedSessions.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Side: Chat/Input Area */}
        <div
          className={cn(
            'flex-1 flex flex-col min-w-0 bg-slate-50 relative',
            mobileTab === 'chat' ? 'flex' : 'hidden lg:flex'
          )}
        >
          {/* Warning Banner */}
          <div className="bg-teal-50 border-b border-teal-100 px-3 py-2 sm:px-6 sm:py-3 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 text-teal-800 text-xs sm:text-sm min-w-0">
              <AlertCircle className="w-4 h-4 text-teal-600 shrink-0" />
              <span className="leading-snug">
                Trocou de paciente? Use <strong className="font-bold">NOVO PACIENTE</strong> antes de enviar.
              </span>
            </div>
            <Button
              variant="outline"
              className="bg-white text-teal-700 border-teal-200 hover:bg-teal-50 gap-1.5 h-8 px-2.5 text-xs font-semibold whitespace-nowrap shrink-0"
              onClick={handleNovoPaciente}
            >
              <RefreshCw className="w-3 h-3 shrink-0" />
              <span>NOVO PACIENTE</span>
            </Button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-center px-4">
                <FileText className="w-12 h-12 mb-3 text-slate-300" strokeWidth={1.25} />
                <p className="text-base sm:text-lg font-medium text-slate-600">
                  Nenhum exame transcrito ainda
                </p>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xs">
                  Toque no clipe abaixo para enviar foto/PDF dos exames ou cole com{' '}
                  <kbd className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-xs text-slate-600">
                    Ctrl+V
                  </kbd>
                </p>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {messages.map((msg, i) => (
                  <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[92%] sm:max-w-[80%] rounded-xl p-3.5 sm:p-4 shadow-sm text-sm break-words",
                        msg.role === 'user'
                          ? "bg-teal-600 text-white"
                          : "bg-white border border-slate-200 text-slate-800"
                      )}
                    >
                      <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500 transition-shadow">
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-slate-500 hover:text-teal-600 shrink-0 h-9 w-9"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Anexar foto ou PDF de exame"
              >
                <Paperclip className="w-5 h-5" />
              </Button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                className="hidden" 
                accept="image/*,.pdf" 
                multiple
                disabled={isLoading}
              />
              <input 
                type="text" 
                value={input}
                disabled={isLoading}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !isLoading && handleSend()}
                onPaste={async (e) => {
                  if (isLoading) return;
                  const items = e.clipboardData?.items;
                  if (!items) return;
                  const files: File[] = [];
                  for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                      const file = items[i].getAsFile();
                      if (file) files.push(file);
                    }
                  }
                  if (files.length > 0) {
                    e.preventDefault();
                    setMessages(prev => [...prev, { role: 'user', content: `[${files.length} imagem(ns) colada(s)]` }]);
                    setMessages(prev => [...prev, { role: 'assistant', content: 'Lendo exames anexados...' }]);
                    try {
                      const inlineDatas = await prepareFilesSequentially(files);
                      await processWithAI('', inlineDatas);
                    } catch (error) {
                      console.error(error);
                      replaceLastLoadingMessage('Erro ao processar imagem colada. Tente novamente.');
                    }
                  }
                }}
                placeholder="Anexe no clipe, tire foto ou digite..."
                className="flex-1 min-w-0 bg-transparent border-none focus:outline-none focus:ring-0 text-sm py-1.5 px-1.5"
              />
              <Button 
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                size="icon" 
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg shrink-0 h-9 w-9"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Right Side: Options and Saved */}
        <div
          className={cn(
            'w-full lg:w-80 bg-white lg:border-l border-slate-200 flex-col shrink-0 overflow-y-auto',
            mobileTab === 'options' ? 'flex' : 'hidden lg:flex'
          )}
        >
          <div className="p-4 border-b border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm sm:text-base">
                <Wand2 className="w-4 h-4 text-teal-600" />
                Formato de Saída
              </div>
              <button
                type="button"
                onClick={() => setMobileTab('chat')}
                className="lg:hidden text-xs font-semibold text-teal-600 hover:text-teal-700"
              >
                Voltar aos exames →
              </button>
            </div>
            
            <Textarea 
              placeholder="Cole aqui um EXEMPLO do formato desejado (ex: PADRÃO HC/UFG). Valores alterados já recebem (VR: XX) automaticamente."
              value={outputFormat}
              onChange={e => setOutputFormat(e.target.value)}
              className="min-h-[120px] text-xs resize-none bg-slate-50"
            />

            {savedFormats.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {savedFormats.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleUseFormat(f)}
                    className="group flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-200 text-slate-700 hover:text-teal-700 transition-colors"
                    title={f.format}
                  >
                    {f.label}
                    <span
                      role="button"
                      onClick={(e) => handleDeleteFormat(f.id, e)}
                      className="opacity-60 group-hover:opacity-100 hover:text-red-600 rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </span>
                  </button>
                ))}
              </div>
            )}

            <Button variant="outline" size="sm" className="w-full text-xs text-teal-600 border-teal-200 bg-teal-50 hover:bg-teal-100" onClick={handleSalvarFormato}>
              + SALVAR FORMATO ATUAL
            </Button>
          </div>

          <div className="p-4 flex-1 flex flex-col">
            <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm sm:text-base mb-4">
              <Save className="w-4 h-4 text-teal-600" />
              Transcrições Salvas
            </div>
            
            {savedSessions.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm bg-slate-50/50 rounded-lg border border-dashed border-slate-200 min-h-[100px]">
                Nenhuma sessão salva
              </div>
            ) : (
              <div className="space-y-2">
                {savedSessions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleLoadSession(s)}
                    className="w-full text-left p-3 rounded-lg border border-slate-200 hover:border-teal-300 hover:bg-teal-50/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-slate-700 line-clamp-2">{s.name || 'Sessão sem título'}</span>
                      <span
                        role="button"
                        onClick={(e) => handleDeleteSession(s.id, e)}
                        className="shrink-0 text-slate-400 lg:opacity-0 lg:group-hover:opacity-100 hover:text-red-600 transition-opacity p-1"
                        title="Excluir sessão"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 mt-1 block">{s.date} · {s.messages.filter(m => m.role === 'assistant').length} transcrição(ões)</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

