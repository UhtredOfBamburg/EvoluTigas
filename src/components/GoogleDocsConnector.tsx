import React, { useEffect, useState } from 'react';
import { Button, Input, Label, Textarea } from '@/components/ui';
import {
  FileText,
  Search,
  Loader2,
  ExternalLink,
  DownloadCloud,
  UploadCloud,
  Sparkles,
  X,
  Link2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  HelpCircle,
} from 'lucide-react';
import {
  initGoogleDocsAuth,
  googleDocsSignIn,
  googleDocsLogout,
  getGoogleAccessToken,
  getConnectedGoogleUser,
  searchGoogleDocsFiles,
  fetchGoogleDocContent,
  createGoogleDocWithContent,
  appendTextToGoogleDoc,
  GoogleDocFileSummary,
  GoogleDocExtracted,
} from '@/lib/googleDocs';
import { useToast } from '@/hooks/useToast';

export interface LinkedGoogleDoc {
  docId: string;
  title: string;
  url: string;
  lastSyncedAt?: string;
}

interface GoogleDocsConnectorProps {
  mode: 'ambulatorio' | 'enfermaria';
  patientName: string;
  linkedDoc?: LinkedGoogleDoc | null;
  onUpdateLinkedDoc?: (doc: LinkedGoogleDoc | null) => void;
  onImportText: (extracted: GoogleDocExtracted, autoProcessAi?: boolean) => void;
  exportText?: string;
  exportDefaultTitle?: string;
}

const GCP_AUDIENCE_URL =
  'https://console.cloud.google.com/auth/audience?project=gen-lang-client-0326807319';

export function GoogleDocsConnector({
  mode,
  patientName,
  linkedDoc,
  onUpdateLinkedDoc,
  onImportText,
  exportText,
  exportDefaultTitle,
}: GoogleDocsConnectorProps) {
  const { toast } = useToast();
  const [needsAuth, setNeedsAuth] = useState<boolean>(() => !getGoogleAccessToken());
  const [connectedEmail, setConnectedEmail] = useState<string | null>(
    () => getConnectedGoogleUser()?.email || null
  );
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showUnlockHelp, setShowUnlockHelp] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'import' | 'export'>('import');

  // Search & URL states
  const cleanPatientQuery =
    patientName &&
    !patientName.toUpperCase().includes('NOVO PACIENTE') &&
    !patientName.toUpperCase().includes('PACIENTE')
      ? patientName.split(' ')[0]
      : '';
  const [searchQuery, setSearchQuery] = useState(cleanPatientQuery);
  const [files, setFiles] = useState<GoogleDocFileSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [directUrlInput, setDirectUrlInput] = useState('');

  // Extracted Doc preview state
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<GoogleDocExtracted | null>(null);

  // Quick sync loading state
  const [isQuickPulling, setIsQuickPulling] = useState(false);

  // Export states (Enfermaria / Ambulatório)
  const [newDocTitle, setNewDocTitle] = useState(
    exportDefaultTitle || `Evolução - ${patientName || 'Paciente'}`
  );
  const [isExporting, setIsExporting] = useState(false);
  const [confirmAppendOpen, setConfirmAppendOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = initGoogleDocsAuth(
      (user) => {
        setNeedsAuth(false);
        setConnectedEmail(user.email);
      },
      () => {
        setNeedsAuth(true);
        setConnectedEmail(null);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setNewDocTitle(exportDefaultTitle || `Evolução - ${patientName || 'Paciente'}`);
  }, [exportDefaultTitle, patientName]);

  const handleGoogleLogin = async (): Promise<boolean> => {
    setIsLoggingIn(true);
    try {
      const res = await googleDocsSignIn();
      if (res?.accessToken) {
        setNeedsAuth(false);
        setConnectedEmail(res.user.email);
        toast(`Conectado como ${res.user.email}!`, 'success');
        return true;
      }
      return false;
    } catch (err: any) {
      console.error(err);
      setShowUnlockHelp(true);
      toast('Não foi possível concluir o login Google. Veja como liberar todos os e-mails.', 'error');
      return false;
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSwitchAccount = async () => {
    await googleDocsLogout();
    setNeedsAuth(true);
    setConnectedEmail(null);
    setFiles([]);
    await handleGoogleLogin();
  };

  const loadFiles = async (queryStr?: string) => {
    if (!getGoogleAccessToken()) return;
    setIsSearching(true);
    try {
      const list = await searchGoogleDocsFiles(queryStr);
      setFiles(list);
    } catch (err: any) {
      if (err?.message === 'AUTH_REQUIRED') {
        setNeedsAuth(true);
      } else {
        toast('Erro ao buscar documentos no seu Google Drive.', 'error');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const openModal = async (initialTab: 'import' | 'export') => {
    setModalTab(initialTab);
    if (!getGoogleAccessToken()) {
      const ok = await handleGoogleLogin();
      if (!ok) return;
    }
    setIsModalOpen(true);
    if (initialTab === 'import') {
      await loadFiles(searchQuery);
    }
  };

  const handleSelectDocToPreview = async (docIdOrUrl: string) => {
    if (!docIdOrUrl.trim()) {
      toast('Selecione um documento da sua conta ou cole o link.', 'error');
      return;
    }
    if (!getGoogleAccessToken()) {
      const ok = await handleGoogleLogin();
      if (!ok) return;
    }
    setIsLoadingDoc(true);
    try {
      const extracted = await fetchGoogleDocContent(docIdOrUrl);
      setPreviewDoc(extracted);
      if (onUpdateLinkedDoc) {
        onUpdateLinkedDoc({
          docId: extracted.documentId,
          title: extracted.title,
          url: extracted.url,
          lastSyncedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        });
      }
    } catch (err: any) {
      if (err?.message === 'AUTH_REQUIRED') {
        setNeedsAuth(true);
      } else {
        toast(err?.message || 'Erro ao abrir o documento no Google Docs.', 'error');
      }
    } finally {
      setIsLoadingDoc(false);
    }
  };

  const handleQuickPullLinkedDoc = async (autoProcessAi = false) => {
    if (!linkedDoc?.docId) return;
    if (!getGoogleAccessToken()) {
      const ok = await handleGoogleLogin();
      if (!ok) return;
    }
    setIsQuickPulling(true);
    try {
      const extracted = await fetchGoogleDocContent(linkedDoc.docId);
      if (onUpdateLinkedDoc) {
        onUpdateLinkedDoc({
          docId: extracted.documentId,
          title: extracted.title,
          url: extracted.url,
          lastSyncedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        });
      }
      onImportText(extracted, autoProcessAi);
    } catch (err: any) {
      toast(err?.message || 'Erro ao puxar texto do Google Docs.', 'error');
    } finally {
      setIsQuickPulling(false);
    }
  };

  const handleCreateNewGoogleDoc = async () => {
    if (!exportText || !exportText.trim()) {
      toast('Gere ou escreva o texto da evolução primeiro antes de exportar.', 'error');
      return;
    }
    if (!getGoogleAccessToken()) {
      const ok = await handleGoogleLogin();
      if (!ok) return;
    }
    setIsExporting(true);
    try {
      const header = `${newDocTitle.trim() || `Evolução - ${patientName}`}\nData: ${new Date().toLocaleString('pt-BR')}\n\n`;
      const created = await createGoogleDocWithContent(
        newDocTitle.trim() || `Evolução - ${patientName}`,
        `${header}${exportText.trim()}`
      );
      if (onUpdateLinkedDoc) {
        onUpdateLinkedDoc({
          docId: created.documentId,
          title: created.title,
          url: created.url,
          lastSyncedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        });
      }
      toast(`Documento "${created.title}" criado na sua conta do Google Docs!`, 'success');
      setIsModalOpen(false);
    } catch (err: any) {
      if (err?.message === 'AUTH_REQUIRED') {
        setNeedsAuth(true);
      } else {
        toast(err?.message || 'Erro ao criar Google Doc.', 'error');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleConfirmAppendToExistingDoc = async () => {
    if (!linkedDoc?.docId) return;
    if (!exportText || !exportText.trim()) {
      toast('Gere ou escreva o texto da evolução primeiro antes de anexar.', 'error');
      setConfirmAppendOpen(false);
      return;
    }
    if (!getGoogleAccessToken()) {
      const ok = await handleGoogleLogin();
      if (!ok) return;
    }
    setIsExporting(true);
    try {
      const datedHeader = `EVOLUÇÃO (${new Date().toLocaleString('pt-BR')})\n`;
      const updated = await appendTextToGoogleDoc(
        linkedDoc.docId,
        `${datedHeader}${exportText.trim()}`
      );
      if (onUpdateLinkedDoc) {
        onUpdateLinkedDoc({
          docId: updated.documentId,
          title: updated.title,
          url: updated.url,
          lastSyncedAt: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        });
      }
      toast(`Evolução anexada ao documento "${updated.title}" no Google Docs!`, 'success');
      setConfirmAppendOpen(false);
      setIsModalOpen(false);
    } catch (err: any) {
      if (err?.message === 'AUTH_REQUIRED') {
        setNeedsAuth(true);
      } else {
        toast(err?.message || 'Erro ao atualizar o Google Doc.', 'error');
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Main Connector Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-900">Google Docs</span>
              {!needsAuth && connectedEmail && (
                <span className="text-xs text-slate-500">
                  · Conectado como <strong className="text-slate-700">{connectedEmail}</strong>
                </span>
              )}
              {linkedDoc && (
                <span className="text-xs text-blue-700 truncate max-w-[240px] font-medium">
                  · {linkedDoc.title}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-0.5 text-xs flex-wrap">
              {!needsAuth && connectedEmail ? (
                <button
                  type="button"
                  onClick={handleSwitchAccount}
                  className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 underline"
                >
                  <LogOut className="w-3 h-3" /> Trocar conta Google
                </button>
              ) : (
                <span className="text-slate-500">
                  Cada usuário entra com seu próprio e-mail Google para abrir seus Docs
                </span>
              )}

              {linkedDoc && (
                <>
                  <a
                    href={linkedDoc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    Abrir no Docs <ExternalLink className="w-3 h-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => openModal('import')}
                    className="text-slate-500 hover:text-slate-800 underline"
                  >
                    Escolher outro Doc
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setShowUnlockHelp((v) => !v)}
                className="text-amber-700 hover:underline inline-flex items-center gap-1 font-medium"
              >
                <HelpCircle className="w-3 h-3" /> Deu erro 403 (Acesso bloqueado)?
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {needsAuth ? (
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold shadow-2xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <svg
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="w-4 h-4 shrink-0"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              <span>{isLoggingIn ? 'Conectando...' : 'Sign in with Google'}</span>
            </button>
          ) : (
            <>
              {linkedDoc ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isQuickPulling}
                    onClick={() => handleQuickPullLinkedDoc(false)}
                    className="h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 whitespace-nowrap"
                  >
                    {isQuickPulling ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <DownloadCloud className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Puxar Texto do Doc
                  </Button>
                  {mode === 'ambulatorio' && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={isQuickPulling}
                      onClick={() => handleQuickPullLinkedDoc(true)}
                      className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white whitespace-nowrap"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                      Puxar + Gerar Receitas/Exames
                    </Button>
                  )}
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => openModal('import')}
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold whitespace-nowrap"
                >
                  <DownloadCloud className="w-3.5 h-3.5 mr-1.5" />
                  Escolher Meu Google Doc
                </Button>
              )}

              {mode === 'enfermaria' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openModal('export')}
                  className="h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 font-semibold whitespace-nowrap"
                >
                  <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                  Salvar Evolução no Docs
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 1-Click Instructions to Unlock All Emails in Google Cloud OAuth Consent Screen */}
      {showUnlockHelp && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-xl p-4 text-xs text-amber-950 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="font-bold text-sm text-amber-900">
              Como liberar o login para qualquer e-mail (@discente.ufg.br e amigos) em 10 segundos:
            </p>
            <button
              type="button"
              onClick={() => setShowUnlockHelp(false)}
              className="text-amber-700 hover:text-amber-950"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="leading-relaxed">
            Por segurança da própria Google, todo aplicativo novo nasce bloqueado em <strong>"Modo de Teste"</strong> (aceitando apenas <code>pdrtorres90@gmail.com</code>). Para destravar qualquer e-mail para sempre:
          </p>
          <ol className="list-decimal list-inside space-y-1 font-medium">
            <li>
              Abra o painel do seu projeto clicando no botão abaixo (logado na sua conta <strong>pdrtorres90@gmail.com</strong>).
            </li>
            <li>
              Em <strong>Status de publicação (Publishing status)</strong>, clique no botão <strong>"PUBLICAR APLICATIVO" (Publish App)</strong> e confirme.
            </li>
            <li>
              Pronto! Qualquer pessoa (inclusive <code>@discente.ufg.br</code> e todos os seus amigos) conseguirá entrar com seu próprio e-mail normalmente. (Se aparecer aviso de "App não verificado" no login, basta clicar em <em>Avançado &rarr; Acessar gen-lang-client...</em>).
            </li>
          </ol>
          <div className="pt-1">
            <a
              href={GCP_AUDIENCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-900 hover:bg-amber-950 text-white font-semibold text-xs transition-colors"
            >
              Abrir Painel do Google e Clicar em "Publicar Aplicativo"
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Modal de Seleção dos Arquivos da Conta Conectada */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Meus Google Docs — {connectedEmail || patientName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Selecione o documento do paciente diretamente da sua conta Google conectada
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs inside Modal if Enfermaria */}
            {mode === 'enfermaria' && (
              <div className="flex border-b border-slate-200 px-5 bg-slate-50/60">
                <button
                  type="button"
                  onClick={() => setModalTab('import')}
                  className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    modalTab === 'import'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  1. Importar / Puxar Texto de um Doc
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab('export')}
                  className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
                    modalTab === 'export'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  2. Exportar / Salvar Evolução no Google Docs
                </button>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {modalTab === 'import' ? (
                <>
                  {/* Primary: Search User's Own Google Drive Docs */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Label className="text-xs font-semibold text-slate-700">
                        Documentos da sua conta ({connectedEmail}):
                      </Label>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          loadFiles('');
                        }}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Mostrar todos os recentes
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <Input
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && loadFiles(searchQuery)}
                          placeholder="Buscar pelo nome do paciente ou título do Doc..."
                          className="h-9 pl-8 text-xs"
                          autoFocus
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isSearching}
                        onClick={() => loadFiles(searchQuery)}
                        className="h-9 text-xs whitespace-nowrap"
                      >
                        {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Buscar'}
                      </Button>
                    </div>

                    <div className="border border-slate-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100 bg-slate-50/40">
                      {isSearching ? (
                        <div className="p-6 flex items-center justify-center text-xs text-slate-500 gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Buscando seus documentos no Google Drive...
                        </div>
                      ) : files.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400">
                          Nenhum Google Doc encontrado com esse filtro. Clique em "Mostrar todos os recentes" acima.
                        </div>
                      ) : (
                        files.map((file) => {
                          const isSelected = previewDoc?.documentId === file.id;
                          return (
                            <button
                              key={file.id}
                              type="button"
                              onClick={() => handleSelectDocToPreview(file.id)}
                              className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors ${
                                isSelected ? 'bg-blue-50/90 text-blue-900' : 'hover:bg-white text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                                <span className="text-xs font-medium truncate">{file.name}</span>
                              </div>
                              {file.modifiedTime && (
                                <span className="text-[11px] text-slate-400 font-mono tabular-nums shrink-0">
                                  {new Date(file.modifiedTime).toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Secondary: Paste URL */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-slate-400" />
                      Ou cole o link de um Google Doc compartilhado com você:
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={directUrlInput}
                        onChange={(e) => setDirectUrlInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSelectDocToPreview(directUrlInput)}
                        placeholder="https://docs.google.com/document/d/..."
                        className="h-9 text-xs flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isLoadingDoc || !directUrlInput.trim()}
                        onClick={() => handleSelectDocToPreview(directUrlInput)}
                        className="h-9 text-xs whitespace-nowrap"
                      >
                        Abrir Link
                      </Button>
                    </div>
                  </div>

                  {/* Preview of Extracted Content */}
                  {isLoadingDoc && (
                    <div className="p-8 border border-slate-200 rounded-xl flex items-center justify-center gap-2 text-xs text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> Extraindo texto do Google Doc...
                    </div>
                  )}

                  {previewDoc && !isLoadingDoc && (
                    <div className="space-y-3 border border-emerald-300 bg-emerald-50/40 rounded-xl p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {previewDoc.title}
                          </span>
                        </div>
                        <a
                          href={previewDoc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 shrink-0"
                        >
                          Abrir original <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <Textarea
                        value={previewDoc.text}
                        onChange={(e) => setPreviewDoc({ ...previewDoc, text: e.target.value })}
                        className="min-h-[160px] max-h-[240px] text-xs font-mono bg-white border-slate-200"
                      />

                      <div className="flex items-center justify-end gap-2 flex-wrap pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onImportText(previewDoc, false);
                            setIsModalOpen(false);
                          }}
                          className="h-9 text-xs border-slate-300 text-slate-800 bg-white hover:bg-slate-50"
                        >
                          <DownloadCloud className="w-3.5 h-3.5 mr-1.5" />
                          {mode === 'ambulatorio'
                            ? 'Apenas Puxar Texto para a Consulta'
                            : 'Puxar para Evolução e Histórico'}
                        </Button>

                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            onImportText(previewDoc, true);
                            setIsModalOpen(false);
                          }}
                          className="h-9 text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold"
                        >
                          <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                          {mode === 'ambulatorio'
                            ? 'Puxar + Gerar HDA, Receitas e Exames (IA)'
                            : 'Puxar + Preencher Campos da Enfermaria'}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Export Tab (Enfermaria) */
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700">
                      Texto da Evolução / Nota que será enviado ao seu Google Docs ({connectedEmail}):
                    </Label>
                    <Textarea
                      value={exportText || ''}
                      readOnly
                      placeholder="Gere a evolução médica na tela do paciente primeiro para exportá-la para o Google Docs."
                      className="min-h-[160px] text-xs font-mono bg-slate-50 border-slate-200"
                    />
                  </div>

                  {linkedDoc && (
                    <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-900">
                          Anexar ao documento vinculado do paciente
                        </p>
                        <p className="text-xs text-slate-600">
                          Documento atual: <strong>{linkedDoc.title}</strong>
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isExporting || !exportText?.trim()}
                        onClick={() => setConfirmAppendOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold whitespace-nowrap"
                      >
                        <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                        Anexar Evolução neste Doc
                      </Button>
                    </div>
                  )}

                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <p className="text-xs font-bold text-slate-900">
                      Ou criar um novo Google Doc na sua conta:
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Input
                        value={newDocTitle}
                        onChange={(e) => setNewDocTitle(e.target.value)}
                        placeholder="Título do novo documento..."
                        className="h-9 text-xs flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isExporting || !exportText?.trim()}
                        onClick={handleCreateNewGoogleDoc}
                        className="h-9 text-xs border-teal-300 text-teal-800 hover:bg-teal-50 font-semibold whitespace-nowrap"
                      >
                        {isExporting ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Criar Novo Google Doc
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mandatory User Confirmation Dialog Before Modifying an Existing Google Doc */}
      {confirmAppendOpen && linkedDoc && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-900">
                  Confirmar atualização no Google Docs?
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Você está prestes a adicionar a evolução de hoje ao final do documento existente{' '}
                  <strong>"{linkedDoc.title}"</strong> no seu Google Docs.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isExporting}
                onClick={() => setConfirmAppendOpen(false)}
                className="h-8 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isExporting}
                onClick={handleConfirmAppendToExistingDoc}
                className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Salvando...
                  </>
                ) : (
                  'Confirmar e Atualizar Doc'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
