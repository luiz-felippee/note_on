import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, Sparkles } from 'lucide-react';
import { AudioMomentMarker } from '../types';

interface AudioPlayerCardProps {
  src: string;
  durationHint?: number;
  waveform?: number[];
  accentColor?: string;
  title?: string;
  transcript?: string;
  markers?: AudioMomentMarker[];
  seekRequest?: { timeSeconds: number; triggerId: number } | null;
  onGenerateQuestions?: () => void;
}

const DEFAULT_WAVEFORM = [
  0.3, 0.5, 0.75, 0.6, 0.85, 0.45, 0.9, 0.7, 0.55, 0.4, 0.8, 0.95, 0.65, 0.5,
  0.75, 0.85, 0.6, 0.4, 0.7, 0.9, 0.55, 0.35, 0.65, 0.8, 0.5, 0.45, 0.6, 0.35,
];

export const AudioPlayerCard: React.FC<AudioPlayerCardProps> = ({
  src,
  durationHint = 0,
  waveform,
  accentColor = '#6366f1',
  title,
  transcript,
  markers = [],
  seekRequest,
  onGenerateQuestions,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [resolvedSrc, setResolvedSrc] = useState<string>(src);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationHint || 0);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [pulseHighlight, setPulseHighlight] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const bars = waveform && waveform.length > 8 ? waveform : DEFAULT_WAVEFORM;

  // Converte data URLs de áudio (inclusive audio/webm;codecs=opus) em Blob URL nativo para reprodução 100% confiável
  useEffect(() => {
    if (!src || !src.startsWith('data:')) {
      setResolvedSrc(src);
      return;
    }

    let objectUrl: string | null = null;
    try {
      const commaIdx = src.indexOf(',');
      if (commaIdx !== -1) {
        const header = src.slice(0, commaIdx).toLowerCase();
        const base64Data = src.slice(commaIdx + 1).trim();
        let mime = 'audio/webm';
        if (header.includes('audio/wav') || header.includes('audio/x-wav')) {
          mime = 'audio/wav';
        } else if (header.includes('audio/mp4') || header.includes('audio/aac')) {
          mime = 'audio/mp4';
        } else if (header.includes('audio/mpeg') || header.includes('audio/mp3')) {
          mime = 'audio/mpeg';
        } else if (header.includes('audio/ogg')) {
          mime = 'audio/ogg';
        }

        const binaryStr = atob(base64Data);
        const len = binaryStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mime });
        objectUrl = URL.createObjectURL(blob);
        setResolvedSrc(objectUrl);
      } else {
        setResolvedSrc(src);
      }
    } catch {
      setResolvedSrc(src);
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      } else if (durationHint > 0) {
        setDuration(durationHint);
      }
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [resolvedSrc, durationHint]);

  useEffect(() => {
    if (!seekRequest || !audioRef.current) return;
    const audio = audioRef.current;
    const targetSec = Math.max(0, seekRequest.timeSeconds);
    try {
      audio.currentTime = targetSec;
      setCurrentTime(targetSec);
      audio.play().catch(() => {});
      setIsPlaying(true);
      setPulseHighlight(true);
      const timer = setTimeout(() => setPulseHighlight(false), 1600);
      return () => clearTimeout(timer);
    } catch {
      // ignore
    }
  }, [seekRequest]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const jumpToSecond = (sec: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, sec);
    setCurrentTime(Math.max(0, sec));
    audio.play().catch(() => {});
    setIsPlaying(true);
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 2];
    const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
    setPlaybackRate(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  };

  const handleSeekBarIndex = (index: number) => {
    const audio = audioRef.current;
    const total = duration || durationHint || 1;
    if (!audio) return;
    const target = (index / bars.length) * total;
    if (isFinite(target)) {
      audio.currentTime = target;
      setCurrentTime(target);
    }
  };

  const formatTime = (sec: number) => {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const effectiveDuration = duration > 0 ? duration : durationHint;
  const progressRatio =
    effectiveDuration > 0 ? Math.min(1, currentTime / effectiveDuration) : 0;

  return (
    <div
      className={`rounded-xl bg-slate-950/60 border p-3 sm:px-3.5 sm:py-3 transition-all duration-300 ${
        pulseHighlight
          ? 'border-indigo-400 ring-2 ring-indigo-400/30'
          : 'border-slate-800/80'
      }`}
    >
      <audio ref={audioRef} src={resolvedSrc} preload="metadata" />
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={togglePlay}
            style={{ backgroundColor: accentColor }}
            className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-md hover:brightness-110 active:scale-95 transition shrink-0 cursor-pointer"
            title={isPlaying ? 'Pausar' : 'Reproduzir'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" />
            )}
          </button>

          {/* Interactive Waveform */}
          <div
            className="flex-1 h-8 flex items-center gap-1 cursor-pointer select-none"
            title="Clique para avançar ou voltar no áudio"
          >
            {bars.map((val, idx) => {
              const barRatio = idx / bars.length;
              const isPlayed = barRatio <= progressRatio;
              const heightPct = Math.max(20, Math.min(100, Math.round(val * 100)));
              return (
                <div
                  key={idx}
                  onClick={() => handleSeekBarIndex(idx)}
                  className="flex-1 h-full flex items-center justify-center group"
                >
                  <div
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: isPlayed ? accentColor : undefined,
                    }}
                    className={`w-full max-w-[5px] rounded-full transition-all ${
                      isPlayed
                        ? 'opacity-100'
                        : 'bg-slate-700/80 group-hover:bg-slate-500'
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Compact Time & Speed Controls */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 text-xs font-mono text-slate-400 pl-1 sm:pl-0">
          <span>
            {formatTime(currentTime)} / {formatTime(effectiveDuration)}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={cycleSpeed}
              className="px-2 py-0.5 rounded-md bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700/80 transition cursor-pointer"
              title="Velocidade"
            >
              {playbackRate}x
            </button>
            <a
              href={src}
              download={`${title || 'audio-aula'}.wav`}
              className="p-1 text-slate-400 hover:text-white transition"
              title="Baixar áudio"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Subtle Bottom Row only if markers or transcript exist */}
      {(markers.length > 0 || transcript) && (
        <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-1.5 flex-wrap">
            {markers.map((mk) => (
              <button
                key={mk.id}
                type="button"
                onClick={() => jumpToSecond(mk.timeSeconds)}
                className="px-2 py-0.5 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 font-mono flex items-center gap-1 transition cursor-pointer"
              >
                <span className="text-indigo-400 font-semibold">
                  {mk.timeFormatted}
                </span>
                <span className="font-sans">{mk.label}</span>
              </button>
            ))}
          </div>

          {transcript && (
            <div className="flex items-center gap-2">
              {onGenerateQuestions && (
                <button
                  type="button"
                  onClick={onGenerateQuestions}
                  className="text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 cursor-pointer bg-purple-500/10 hover:bg-purple-500/20 px-2 py-0.5 rounded-md border border-purple-500/30 transition"
                  title="Gerar perguntas sobre este áudio"
                >
                  <Sparkles className="w-3 h-3 text-purple-400" />
                  <span>Gerar Questões</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowTranscript((v) => !v)}
                className="text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
              >
                {showTranscript ? 'Ocultar transcrição' : 'Ver transcrição da fala'}
              </button>
            </div>
          )}
        </div>
      )}

      {showTranscript && transcript && (
        <p className="mt-2 text-xs text-slate-300 italic bg-slate-900/70 rounded-lg p-2.5 border border-slate-800/60 leading-relaxed">
          "{transcript}"
        </p>
      )}
    </div>
  );
};
