import React, { useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, X, Check, AlertCircle } from 'lucide-react';

interface CameraModalProps {
  onCapture: (dataUrl: string, title: string, caption: string) => void;
  onClose: () => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (capturedImage) return;

    const startCamera = async () => {
      setError(null);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1600 },
            height: { ideal: 1200 },
          },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn('Erro ao acessar câmera:', err);
        setError(
          'Não foi possível acessar a câmera diretamente. Verifique a permissão do navegador ou use o botão de Upload/Galeria.'
        );
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [facingMode, capturedImage]);

  const takeSnapshot = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    const maxW = 1400;
    const scale = video.videoWidth > maxW ? maxW / video.videoWidth : 1;
    canvas.width = (video.videoWidth || 1280) * scale;
    canvas.height = (video.videoHeight || 720) * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!capturedImage) return;
    onCapture(
      capturedImage,
      title.trim() || `Foto do Estudo (${new Date().toLocaleTimeString('pt-BR')})`,
      caption.trim()
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl max-h-[95vh] flex flex-col">
        <div className="w-10 h-1 bg-slate-700 rounded-full mx-auto mt-2.5 sm:hidden" />
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white font-semibold text-sm sm:text-base">
            <Camera className="w-4 sm:w-5 h-4 sm:h-5 text-indigo-400 shrink-0" />
            <span className="truncate">Capturar Foto</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto">
          {error ? (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 text-rose-300 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm">{error}</div>
            </div>
          ) : !capturedImage ? (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border border-slate-800">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-950/75 text-xs font-mono text-emerald-400 border border-emerald-500/30">
                  Horário: {new Date().toLocaleTimeString('pt-BR')}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-4">
                <button
                  type="button"
                  onClick={() =>
                    setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))
                  }
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Inverter Câmera</span>
                </button>

                <button
                  type="button"
                  onClick={takeSnapshot}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Tirar Foto Agora</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleConfirm} className="space-y-4">
              <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 max-h-72 flex items-center justify-center">
                <img
                  src={capturedImage}
                  alt="Preview"
                  className="max-h-72 w-auto object-contain"
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Título da Foto (ex: Quadro 1, Slide de Fórmulas, Página do Caderno)
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Esquema do Quadro - Parte 1"
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Anotação / Observação Vinculada à Foto
                  </label>
                  <textarea
                    rows={2}
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Anote o que o professor explicou sobre esta imagem..."
                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCapturedImage(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium transition cursor-pointer"
                >
                  Tirar Outra
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar na Linha do Tempo</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

