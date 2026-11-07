import React, { useState } from 'react';
import {
  X,
  Star,
  Eye,
  EyeOff,
  CheckCircle2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { TimelineItem } from '../types';
import { AudioPlayerCard } from './AudioPlayerCard';
import {
  SM2Rating,
  getSM2NextIntervals,
  formatSM2IntervalDays,
} from '../services/spacedRepetitionService';

interface ExamFlashcardsModalProps {
  items: TimelineItem[];
  subjectName: string;
  accentColor: string;
  onClose: () => void;
  onUpdateStatus: (itemId: string, status: 'mastered' | 'review_again') => void;
  onSM2Grade?: (itemId: string, rating: SM2Rating) => void;
}

export const ExamFlashcardsModal: React.FC<ExamFlashcardsModalProps> = ({
  items,
  subjectName,
  accentColor,
  onClose,
  onUpdateStatus,
  onSM2Grade,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [occludePhotoDetails, setOccludePhotoDetails] = useState(true);

  if (items.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-center space-y-4">
          <Star className="w-12 h-12 text-amber-400 mx-auto" />
          <h3 className="text-lg font-bold text-white">
            Nenhum item marcado com "⭐ Cai na Prova"
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Marque seus textos, fotos de quadro ou áudios mais importantes com a estrela ⭐ na linha do tempo para transformá-los automaticamente em Flashcards de Revisão Ativa!
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold cursor-pointer"
          >
            Voltar para a Aula
          </button>
        </div>
      </div>
    );
  }

  const currentItem = items[currentIndex] || items[0];
  const masteredCount = items.filter((i) => i.flashcardStatus === 'mastered').length;
  const reviewAgainCount = items.filter(
    (i) => i.flashcardStatus === 'review_again'
  ).length;

  const goNext = () => {
    setRevealed(false);
    setCurrentIndex((i) => (i + 1) % items.length);
  };

  const goPrev = () => {
    setRevealed(false);
    setCurrentIndex((i) => (i - 1 + items.length) % items.length);
  };

  const intervals = getSM2NextIntervals(currentItem);

  const handleSM2Rating = (rating: SM2Rating) => {
    if (onSM2Grade) {
      onSM2Grade(currentItem.id, rating);
    } else {
      onUpdateStatus(
        currentItem.id,
        rating === 'again' || rating === 'hard' ? 'review_again' : 'mastered'
      );
    }
    if (currentIndex < items.length - 1) {
      goNext();
    } else {
      setRevealed(true);
    }
  };

  const handleGrade = (status: 'mastered' | 'review_again') => {
    onUpdateStatus(currentItem.id, status);
    if (currentIndex < items.length - 1) {
      goNext();
    } else {
      setRevealed(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col p-2 sm:p-4 md:p-8 overflow-y-auto">
      <div className="max-w-3xl w-full mx-auto my-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h3 className="text-sm md:text-base font-bold text-white truncate">
                Flashcards — {subjectName}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Card {currentIndex + 1} de {items.length} • Lembre-se antes de revelar!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-mono">
              <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Dominei:</span> {masteredCount}
              </span>
              <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-rose-500/15 text-rose-300 border border-rose-500/30">
                <span className="hidden xs:inline">Revisar:</span> {reviewAgainCount}
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-slate-800">
          <div
            style={{
              width: `${Math.round(((currentIndex + 1) / items.length) * 100)}%`,
              backgroundColor: accentColor,
            }}
            className="h-full transition-all duration-300"
          />
        </div>

        {/* Flashcard Body */}
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span className="px-2.5 py-1 rounded-md bg-slate-800 text-amber-300 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Capturado às {currentItem.timeLabel} ({currentItem.dateLabel})
            </span>

            {currentItem.type === 'photo' && (
              <button
                type="button"
                onClick={() => setOccludePhotoDetails((v) => !v)}
                className="text-xs text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {occludePhotoDetails ? (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Mostrar foto sem filtro</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Ocultar parte inferior da foto</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Question / Prompt Title */}
          <div className="text-center py-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
              Pergunta / Tópico Chave da Aula
            </span>
            <h2 className="text-lg md:text-xl font-bold text-white mt-1">
              {currentItem.title ||
                `O que foi explicado às ${currentItem.timeLabel} nesta ${currentItem.type === 'photo'
                  ? 'foto da lousa'
                  : currentItem.type === 'audio'
                    ? 'gravação de áudio'
                    : 'anotação'
                }?`}
            </h2>
          </div>

          {/* Photo Preview (with optional active-recall occlusion mask before reveal!) */}
          {currentItem.type === 'photo' && currentItem.mediaDataUrl && (
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 max-h-72 flex items-center justify-center mx-auto">
              <img
                src={currentItem.mediaDataUrl}
                alt={currentItem.title || 'Foto'}
                className="max-h-72 w-auto object-contain"
              />
              {!revealed && occludePhotoDetails && (
                <div
                  onClick={() => setRevealed(true)}
                  className="absolute inset-x-0 bottom-0 h-1/2 bg-slate-950/90 backdrop-blur-md border-t border-amber-500/40 flex flex-col items-center justify-center cursor-pointer p-4 text-center"
                >
                  <EyeOff className="w-6 h-6 text-amber-400 mb-1" />
                  <span className="text-xs font-semibold text-amber-300">
                    Área de Resposta Oculta para Teste de Memória
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Clique para revelar a foto completa e a explicação
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Answer Area (Blurred/Hidden until Revealed) */}
          {!revealed ? (
            <div className="py-6 flex flex-col items-center justify-center bg-slate-950/70 rounded-2xl border border-dashed border-slate-800">
              <p className="text-xs text-slate-400 mb-3 text-center max-w-md">
                Formule mentalmente a explicação deste tópico antes de revelar sua anotação e áudio.
              </p>
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                <span>Revelar Resposta e Explicação</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 bg-slate-950/90 p-5 rounded-2xl border border-indigo-500/40 animate-fadeIn">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Resposta / Explicação Registrada na Aula:
              </div>

              {currentItem.type === 'audio' && currentItem.mediaDataUrl && (
                <AudioPlayerCard
                  src={currentItem.mediaDataUrl}
                  durationHint={currentItem.audioDurationSeconds}
                  waveform={currentItem.audioWaveform}
                  accentColor={accentColor}
                  title={currentItem.title}
                  transcript={currentItem.transcript}
                  markers={currentItem.audioMarkers}
                />
              )}

              <p className="text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">
                {currentItem.content}
              </p>

              {/* SM-2 Spaced Repetition Buttons */}
              <div className="pt-3 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Como foi sua lembrança deste conteúdo?</span>
                  {currentItem.repetitionIntervalDays ? (
                    <span className="font-mono text-[11px] text-indigo-300">
                      Ciclo: {currentItem.repetitionIntervalDays}d • Facilidade: {Math.round((currentItem.repetitionEaseFactor || 2.5) * 100)}%
                    </span>
                  ) : (
                    <span className="font-mono text-[11px] text-amber-300">
                      Card Novo (Primeira Revisão)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSM2Rating('again')}
                    className="p-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 flex flex-col items-center justify-center transition cursor-pointer"
                  >
                    <span className="text-xs font-bold">Errei</span>
                    <span className="text-[10px] font-mono text-rose-400 mt-0.5">
                      {formatSM2IntervalDays(intervals.again)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSM2Rating('hard')}
                    className="p-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 flex flex-col items-center justify-center transition cursor-pointer"
                  >
                    <span className="text-xs font-bold">Difícil</span>
                    <span className="text-[10px] font-mono text-amber-400 mt-0.5">
                      {formatSM2IntervalDays(intervals.hard)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSM2Rating('good')}
                    className="p-2.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/40 text-indigo-300 flex flex-col items-center justify-center transition cursor-pointer"
                  >
                    <span className="text-xs font-bold">Bom</span>
                    <span className="text-[10px] font-mono text-indigo-400 mt-0.5">
                      {formatSM2IntervalDays(intervals.good)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSM2Rating('easy')}
                    className="p-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 flex flex-col items-center justify-center transition cursor-pointer shadow-lg shadow-emerald-500/10"
                  >
                    <span className="text-xs font-bold">Fácil</span>
                    <span className="text-[10px] font-mono text-emerald-400 mt-0.5">
                      {formatSM2IntervalDays(intervals.easy)}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <button
            type="button"
            onClick={goPrev}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Anterior</span>
          </button>

          <div className="flex items-center gap-1.5">
            {items.map((it, idx) => (
              <button
                key={it.id}
                type="button"
                onClick={() => {
                  setRevealed(false);
                  setCurrentIndex(idx);
                }}
                className={`w-2.5 h-2.5 rounded-full transition cursor-pointer ${idx === currentIndex
                  ? 'bg-indigo-400 scale-125'
                  : it.flashcardStatus === 'mastered'
                    ? 'bg-emerald-500'
                    : it.flashcardStatus === 'review_again'
                      ? 'bg-rose-500'
                      : 'bg-slate-700'
                  }`}
                title={`Card ${idx + 1}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={goNext}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1 cursor-pointer"
          >
            <span>Próximo</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

