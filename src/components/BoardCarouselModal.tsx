import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  Headphones,
  Star,
  Image as ImageIcon,
} from 'lucide-react';
import { TimelineItem } from '../types';
import { AudioPlayerCard } from './AudioPlayerCard';

interface BoardCarouselModalProps {
  photoItems: TimelineItem[];
  allItems: TimelineItem[];
  subjectName: string;
  accentColor: string;
  onClose: () => void;
}

export const BoardCarouselModal: React.FC<BoardCarouselModalProps> = ({
  photoItems,
  allItems,
  subjectName,
  accentColor,
  onClose,
}) => {
  const [index, setIndex] = useState(0);
  const [seekTrigger, setSeekTrigger] = useState<{
    timeSeconds: number;
    triggerId: number;
  } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        setIndex((i) => (i + 1) % Math.max(1, photoItems.length));
      } else if (e.key === 'ArrowLeft') {
        setIndex(
          (i) => (i - 1 + Math.max(1, photoItems.length)) % Math.max(1, photoItems.length)
        );
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photoItems.length, onClose]);

  if (photoItems.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-center space-y-4">
          <ImageIcon className="w-12 h-12 text-cyan-400 mx-auto" />
          <h3 className="text-lg font-bold text-white">Nenhuma Foto Capturada Ainda</h3>
          <p className="text-xs text-slate-400">
            Tire fotos da lousa, slides ou caderno para navegar por todas elas em ordem de horário neste Carrossel de Quadros!
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  const currentPhoto = photoItems[index] || photoItems[0];
  const linkedAudio = currentPhoto.linkedAudioItemId
    ? allItems.find((i) => i.id === currentPhoto.linkedAudioItemId)
    : allItems.find(
        (i) => i.topicId === currentPhoto.topicId && i.type === 'audio'
      );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col">
      {/* Top Bar */}
      <div className="px-4 sm:px-5 py-2.5 sm:py-3.5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-2.5 sm:gap-3 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="px-2.5 sm:px-3 py-1 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono text-xs font-bold shrink-0">
            {index + 1} / {photoItems.length}
          </span>
          <span className="font-mono text-xs text-amber-300 flex items-center gap-1 shrink-0">
            <Clock className="w-3.5 h-3.5" />
            {currentPhoto.timeLabel}
          </span>
          <span className="text-xs text-slate-400 truncate hidden sm:inline">
            {subjectName}
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 sm:p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Split View: Photo Slide + Synchronized Notes & Audio */}
      <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6 p-3 sm:p-6 md:p-8 max-w-7xl w-full mx-auto items-start lg:items-center">
        {/* Left 2 Columns: The Board Photo */}
        <div className="lg:col-span-2 flex flex-col items-center justify-center bg-slate-900/70 border border-slate-800 rounded-2xl p-2 sm:p-4 relative min-h-[220px] sm:min-h-[360px] w-full">
          <div className="relative inline-block max-h-[46vh] lg:max-h-[68vh] rounded-xl overflow-hidden">
            <img
              src={currentPhoto.mediaDataUrl}
              alt={currentPhoto.title || 'Quadro'}
              className="max-h-[46vh] lg:max-h-[68vh] w-auto object-contain block mx-auto"
            />
            {currentPhoto.photoHighlights &&
              currentPhoto.photoHighlights.length > 0 && (
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                >
                  {currentPhoto.photoHighlights.map((st, sIdx) => (
                    <polyline
                      key={sIdx}
                      fill="none"
                      stroke={st.color}
                      strokeWidth={st.width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={st.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    />
                  ))}
                </svg>
              )}
          </div>

          {/* Prev/Next Floating Arrows */}
          {photoItems.length > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  setIndex((i) => (i - 1 + photoItems.length) % photoItems.length)
                }
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-950/80 hover:bg-indigo-600 text-white border border-slate-700 shadow-lg transition cursor-pointer"
                title="Foto Anterior (←)"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setIndex((i) => (i + 1) % photoItems.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-slate-950/80 hover:bg-indigo-600 text-white border border-slate-700 shadow-lg transition cursor-pointer"
                title="Próxima Foto (→)"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Right Column: Synchronized Explanation + Audio Player */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 self-stretch flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-cyan-400">
                Detalhes Cronológicos do Quadro
              </span>
              {currentPhoto.importantForExam && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-amber-400" />
                  Cai na Prova
                </span>
              )}
            </div>

            <h3 className="text-lg font-bold text-white">
              {currentPhoto.title || `Foto #${index + 1}`}
            </h3>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
              {currentPhoto.content || 'Sem anotação textual adicional.'}
            </div>

            {/* Linked Audio Player for this Photo */}
            {linkedAudio && linkedAudio.mediaDataUrl && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <Headphones className="w-4 h-4" />
                    <span>Áudio da Aula Sincronizado</span>
                  </span>
                  {typeof currentPhoto.lectureOffsetSeconds === 'number' && (
                    <button
                      type="button"
                      onClick={() =>
                        setSeekTrigger({
                          timeSeconds: currentPhoto.lectureOffsetSeconds || 0,
                          triggerId: Date.now(),
                        })
                      }
                      className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-mono font-semibold cursor-pointer"
                    >
                      ▶ Pular para {currentPhoto.lectureRelativeTimestamp}
                    </button>
                  )}
                </div>

                <AudioPlayerCard
                  src={linkedAudio.mediaDataUrl}
                  durationHint={linkedAudio.audioDurationSeconds}
                  waveform={linkedAudio.audioWaveform}
                  accentColor={accentColor}
                  title={linkedAudio.title}
                  markers={linkedAudio.audioMarkers}
                  seekRequest={seekTrigger}
                />
              </div>
            )}
          </div>

          {/* Thumbnail Strip */}
          <div className="pt-4 border-t border-slate-800 flex items-center gap-2 overflow-x-auto">
            {photoItems.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setIndex(idx)}
                className={`relative rounded-lg overflow-hidden border-2 shrink-0 w-16 h-12 transition cursor-pointer ${
                  idx === index
                    ? 'border-cyan-400 scale-105'
                    : 'border-slate-800 opacity-50 hover:opacity-80'
                }`}
              >
                <img
                  src={p.mediaDataUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 inset-x-0 bg-black/75 text-[9px] font-mono text-white text-center">
                  {p.timeLabel.slice(0, 5)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

