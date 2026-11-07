import React, { useState, useRef } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Highlighter,
  Eraser,
  Check,
  Clock,
  Download,
} from 'lucide-react';
import { PhotoHighlightStroke, TimelineItem } from '../types';

interface PhotoViewerModalProps {
  item: TimelineItem;
  onClose: () => void;
  onSaveHighlights: (itemId: string, strokes: PhotoHighlightStroke[]) => void;
}

const HIGHLIGHT_COLORS = [
  { name: 'Amarelo', value: 'rgba(250, 204, 21, 0.48)' },
  { name: 'Verde', value: 'rgba(52, 211, 153, 0.48)' },
  { name: 'Rosa', value: 'rgba(244, 63, 94, 0.48)' },
  { name: 'Azul', value: 'rgba(56, 189, 248, 0.48)' },
];

export const PhotoViewerModal: React.FC<PhotoViewerModalProps> = ({
  item,
  onClose,
  onSaveHighlights,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isHighlighting, setIsHighlighting] = useState(false);
  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0].value);
  const [strokes, setStrokes] = useState<PhotoHighlightStroke[]>(
    item.photoHighlights || []
  );
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const getRelativeCoords = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isHighlighting) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getRelativeCoords(e);
    setCurrentPoints([pt]);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isHighlighting || currentPoints.length === 0) return;
    const pt = getRelativeCoords(e);
    setCurrentPoints((prev) => [...prev, pt]);
  };

  const handlePointerUp = () => {
    if (!isHighlighting || currentPoints.length === 0) return;
    const newStroke: PhotoHighlightStroke = {
      points: currentPoints,
      color: selectedColor,
      width: 3.5,
    };
    const updated = [...strokes, newStroke];
    setStrokes(updated);
    setCurrentPoints([]);
    onSaveHighlights(item.id, updated);
  };

  const clearHighlights = () => {
    setStrokes([]);
    onSaveHighlights(item.id, []);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-800 bg-slate-900/90 shrink-0">
        <div className="flex items-center justify-between sm:justify-start gap-2.5 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-mono text-[11px] font-semibold flex items-center gap-1 border border-indigo-500/30 shrink-0">
              <Clock className="w-3 h-3" />
              {item.timeLabel}
            </span>
            <h3 className="text-xs sm:text-sm md:text-base font-semibold text-white truncate">
              {item.title || 'Foto de Estudo'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer sm:hidden shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer shrink-0"
            title="Diminuir Zoom"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-slate-300 w-10 text-center shrink-0">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
            className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer shrink-0"
            title="Aumentar Zoom"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer shrink-0"
            title="Girar 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-slate-700 mx-0.5 shrink-0" />

          <button
            type="button"
            onClick={() => setIsHighlighting((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
              isHighlighting
                ? 'bg-amber-500 text-slate-950 font-semibold shadow-lg shadow-amber-500/25'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
            }`}
          >
            <Highlighter className="w-4 h-4" />
            <span>{isHighlighting ? 'Marca-Texto' : 'Grifar'}</span>
          </button>

          {isHighlighting && (
            <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded-lg shrink-0">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setSelectedColor(c.value)}
                  style={{ backgroundColor: c.value.replace('0.48', '0.95') }}
                  className={`w-4 h-4 rounded-full border-2 transition cursor-pointer ${
                    selectedColor === c.value
                      ? 'border-white scale-110'
                      : 'border-transparent opacity-70'
                  }`}
                  title={`Cor ${c.name}`}
                />
              ))}
              {strokes.length > 0 && (
                <button
                  type="button"
                  onClick={clearHighlights}
                  className="p-1 text-rose-400 hover:text-rose-300 ml-1 cursor-pointer"
                  title="Limpar marcações"
                >
                  <Eraser className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {item.mediaDataUrl && (
            <a
              href={item.mediaDataUrl}
              download={`foto-${item.timeLabel.replace(/:/g, '-')}.png`}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition shrink-0"
              title="Baixar Foto"
            >
              <Download className="w-4 h-4" />
            </a>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition cursor-pointer hidden sm:flex shrink-0"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex items-center justify-center p-4 md:p-8 select-none"
      >
        <div
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transition: isHighlighting ? 'none' : 'transform 0.2s ease',
          }}
          className="relative inline-block max-w-full max-h-full shadow-2xl rounded-xl overflow-hidden border border-slate-700"
        >
          <img
            src={item.mediaDataUrl}
            alt={item.title || 'Foto da aula'}
            className="max-h-[72vh] w-auto object-contain block pointer-events-none"
          />
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={`absolute inset-0 w-full h-full ${
              isHighlighting ? 'cursor-crosshair touch-none' : 'pointer-events-none'
            }`}
          >
            {strokes.map((st, idx) => (
              <polyline
                key={idx}
                fill="none"
                stroke={st.color}
                strokeWidth={st.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={st.points.map((p) => `${p.x},${p.y}`).join(' ')}
              />
            ))}
            {currentPoints.length > 0 && (
              <polyline
                fill="none"
                stroke={selectedColor}
                strokeWidth={3.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={currentPoints.map((p) => `${p.x},${p.y}`).join(' ')}
              />
            )}
          </svg>
        </div>
      </div>

      {/* Bottom Caption & Study Notes */}
      {item.content && (
        <div className="px-6 py-4 bg-slate-900/90 border-t border-slate-800 max-w-4xl mx-auto w-full rounded-t-2xl">
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-1 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            Anotação Vinculada à Foto
          </div>
          <p className="text-sm text-slate-200 whitespace-pre-wrap">{item.content}</p>
        </div>
      )}
    </div>
  );
};

