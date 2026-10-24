import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, MoreVertical, X, CheckCircle2 } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '@/hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'ios' | 'android'>(isIOS ? 'ios' : 'android');

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const installed = await install();
      if (installed) return;
    }
    setActiveTab(isIOS ? 'ios' : 'android');
    setShowGuideModal(true);
  };

  return (
    <>
      {compact ? (
        <button
          type="button"
          onClick={handleClick}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 text-xs font-semibold shadow-2xs transition-colors whitespace-nowrap shrink-0"
          title="Instalar Aplicativo no Celular"
        >
          <Smartphone className="w-3.5 h-3.5 shrink-0" />
          <span>App</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span>{isInstallable ? 'Instalar Aplicativo Agora' : 'Instalar no Android / iPhone'}</span>
        </button>
      )}

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-5 py-4 bg-teal-700 text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/15">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold leading-tight">Instalar App EvoluTigas</h3>
                  <p className="text-xs text-teal-100">Funciona como aplicativo nativo no Android e iOS</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-teal-100 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {isInstallable && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2.5">
                  <p className="text-xs font-semibold text-emerald-900">
                    Seu navegador suporta instalação direta com 1 clique:
                  </p>
                  <button
                    type="button"
                    onClick={install}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Instalar EvoluTigas Agora
                  </button>
                </div>
              )}

              {/* Platform selector tabs */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('android')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'android'
                      ? 'bg-white text-teal-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Android (Chrome) {isAndroid ? '• Seu aparelho' : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ios')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'ios'
                      ? 'bg-white text-teal-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  iPhone / iPad (Safari) {isIOS ? '• Seu aparelho' : ''}
                </button>
              </div>

              {activeTab === 'android' ? (
                <div className="space-y-3 text-sm text-slate-700">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="w-6 h-6 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">Abra o link público no Google Chrome</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Toque nos três pontinhos <MoreVertical className="w-3.5 h-3.5 inline text-slate-700" /> no canto superior direito do Chrome.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="w-6 h-6 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">Toque em &ldquo;Instalar aplicativo&rdquo;</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Ou selecione <strong>&ldquo;Adicionar à tela inicial&rdquo;</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-teal-50/70 border border-teal-200">
                    <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-teal-900 leading-relaxed">
                      Pronto! O ícone do <strong>EvoluTigas</strong> aparecerá junto com seus aplicativos em tela cheia, sem barra de navegador.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm text-slate-700">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="w-6 h-6 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">Abra no Safari do iPhone ou iPad</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Toque no botão <strong>Compartilhar</strong> <Share className="w-3.5 h-3.5 inline text-blue-600" /> na barra inferior do Safari.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                    <span className="w-6 h-6 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">Role para baixo e toque em &ldquo;Adicionar à Tela de Início&rdquo;</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Ícone <PlusSquare className="w-3.5 h-3.5 inline text-slate-700" /> <strong>Adicionar à Tela de Início</strong> e depois confirme em <strong>Adicionar</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-teal-50/70 border border-teal-200">
                    <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-teal-900 leading-relaxed">
                      Pronto! O <strong>EvoluTigas</strong> ficará na tela inicial do seu iPhone como um aplicativo dedicado em tela cheia.
                    </p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors"
              >
                Entendi, fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg">
      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
      Modo Offline — Usando dados salvos no aparelho
    </div>
  );
};
