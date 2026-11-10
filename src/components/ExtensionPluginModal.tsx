import React from 'react';
import {
  X,
  Puzzle,
  CheckCircle2,
  Monitor,
  Keyboard,
  ExternalLink,
  Download,
  Sparkles,
} from 'lucide-react';

interface ExtensionPluginModalProps {
  isOpen: boolean;
  onClose: () => void;
  lightMode: boolean;
  isExtensionDetected: boolean;
  onStartNativeScreenShare: () => void;
  hasNativeScreenStream: boolean;
}

export const ExtensionPluginModal: React.FC<ExtensionPluginModalProps> = ({
  isOpen,
  onClose,
  lightMode,
  isExtensionDetected,
  onStartNativeScreenShare,
  hasNativeScreenStream,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
      <div
        className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
          lightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}
      >
        {/* Modal Header */}
        <div
          className={`p-4 sm:p-5 border-b flex items-center justify-between ${
            lightMode ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-900/80'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Puzzle className="w-5 h-5" />
            </span>
            <div>
              <h2
                className={`text-base font-bold ${
                  lightMode ? 'text-slate-900' : 'text-slate-100'
                }`}
              >
                Plugin de Captura de Tela (Extensão)
              </h2>
              <p
                className={`text-xs ${
                  lightMode ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                Tire prints de slides da aula e salve direto no áudio com Alt + S
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs leading-relaxed">
          {/* Status Badge */}
          <div
            className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
              isExtensionDetected
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={`w-4 h-4 ${
                  isExtensionDetected ? 'text-emerald-400' : 'text-indigo-400'
                }`}
              />
              <span className="font-semibold text-xs">
                {isExtensionDetected
                  ? 'Plugin Detectado e Conectado ao NoteOn!'
                  : 'Plugin Pronto na pasta do projeto (Load Unpacked)'}
              </span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-slate-800 font-mono text-[11px] text-slate-300 border border-slate-700">
              Alt + S
            </span>
          </div>

          {/* Quick Option 1: Native In-Browser Screen Share (Zero install) */}
          <div
            className={`p-3.5 rounded-xl border ${
              lightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-slate-700/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 font-bold text-slate-200">
                <Monitor className="w-4 h-4 text-cyan-400" />
                <span>Opção 1: Captura Nativa Direta (Sem Instalação)</span>
              </div>
              {hasNativeScreenStream && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
                  Ativo Agora
                </span>
              )}
            </div>
            <p className="text-slate-400 text-xs mb-3">
              Compartilhe a janela ou aba do professor (Meet, Slides, YouTube). O botão de print
              fica visível na barra de gravação para tirar fotos sem instalar nada!
            </p>
            <button
              type="button"
              onClick={() => {
                onStartNativeScreenShare();
                onClose();
              }}
              className="w-full py-2 px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center justify-center gap-2 cursor-pointer shadow transition"
            >
              <Monitor className="w-4 h-4" />
              <span>
                {hasNativeScreenStream
                  ? 'Alterar Aba/Tela Compartilhada'
                  : 'Conectar Tela da Aula Agora'}
              </span>
            </button>
          </div>

          {/* Option 2: Chrome Extension (Audio Recording + Alt + S / Alt + R across any tab) */}
          <div
            className={`p-3.5 rounded-xl border ${
              lightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-slate-700/60'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-slate-200 mb-2">
              <Puzzle className="w-4 h-4 text-indigo-400" />
              <span>Opção 2: Extensão do Navegador (Áudio Flutuante & Recorte de Slides)</span>
            </div>
            <p className="text-slate-400 text-xs mb-3">
              Grave o áudio de aulas em qualquer aba com botão flutuante de controle na tela com{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-300 font-mono font-bold">
                Alt + R
              </kbd>
              {' '}e recorte slides com{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-indigo-300 font-mono font-bold">
                Alt + S
              </kbd>
              {' '}(ou print com Alt + Shift + S). Tudo sincronizado automaticamente com o NoteOn!
            </p>

            <div className="space-y-2 bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                  1
                </span>
                <p className="text-slate-300">
                  No Google Chrome, Edge ou Brave, abra{' '}
                  <span className="font-mono text-indigo-300 select-all">chrome://extensions</span>
                </p>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                  2
                </span>
                <p className="text-slate-300">
                  Ative o <strong>Modo do desenvolvedor</strong> no canto superior direito.
                </p>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                  3
                </span>
                <p className="text-slate-300">
                  Clique em <strong>Carregar sem compactação</strong> (Load Unpacked) e escolha a pasta:
                  <br />
                  <span className="font-mono text-[11px] text-cyan-300 break-all select-all block mt-1 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                    note_on\extension
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-3 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>
                Pronto! Durante a aula, basta apertar <strong>Alt + S</strong> e o print é salvo
                automaticamente na gravação!
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className={`p-3 sm:p-4 border-t flex items-center justify-end ${
            lightMode ? 'border-slate-200 bg-slate-50' : 'border-slate-800 bg-slate-900/60'
          }`}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs cursor-pointer shadow transition"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};

