import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  X,
  Mic,
  Camera,
  FileText,
  HelpCircle,
  Star,
  ExternalLink,
  Play,
  Pause,
  Clock,
  Sparkles,
  BookOpen,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { Course, Subject, StudyTopic, TimelineItem, StudyQuestion, TimelineItemType } from '../types';

interface GlobalSearchViewProps {
  lightMode: boolean;
  courses: Course[];
  subjects: Subject[];
  topics: StudyTopic[];
  items: TimelineItem[];
  questions: StudyQuestion[];
  onNavigateToItem: (courseId: string | undefined, subjectId: string, topicId: string, itemId: string) => void;
  onNavigateToTopic: (courseId: string | undefined, subjectId: string, topicId: string) => void;
  onOpenPhotoViewer?: (item: TimelineItem) => void;
  onCloseSearch: () => void;
}

type SearchCategory = 'all' | 'audio' | 'photo' | 'text' | 'question' | 'exam';

export const GlobalSearchView: React.FC<GlobalSearchViewProps> = ({
  lightMode,
  courses,
  subjects,
  topics,
  items,
  questions,
  onNavigateToItem,
  onNavigateToTopic,
  onOpenPhotoViewer,
  onCloseSearch,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Map lookups for fast retrieval of context
  const subjectsMap = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  const topicsMap = useMemo(() => {
    const map = new Map<string, StudyTopic>();
    topics.forEach((t) => map.set(t.id, t));
    return map;
  }, [topics]);

  const coursesMap = useMemo(() => {
    const map = new Map<string, Course>();
    courses.forEach((c) => map.set(c.id, c));
    return map;
  }, [courses]);

  // Highlight helper
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim() || !text) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark
          key={i}
          className={`px-1 py-0.5 rounded font-semibold ${
            lightMode
              ? 'bg-amber-200 text-amber-950'
              : 'bg-amber-400/30 text-amber-200'
          }`}
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const handleToggleAudio = (itemId: string, audioUrl?: string) => {
    if (!audioUrl) return;

    if (playingAudioId === itemId) {
      audioRefs.current[itemId]?.pause();
      setPlayingAudioId(null);
    } else {
      if (playingAudioId && audioRefs.current[playingAudioId]) {
        audioRefs.current[playingAudioId]?.pause();
      }
      setPlayingAudioId(itemId);
      const audioEl = audioRefs.current[itemId];
      if (audioEl) {
        audioEl.play().catch(() => setPlayingAudioId(null));
      }
    }
  };

  // Filter Items
  const matchedItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return items.filter((item) => {
      // Category filter
      if (category === 'audio' && item.type !== 'audio') return false;
      if (category === 'photo' && item.type !== 'photo') return false;
      if (category === 'text' && item.type !== 'text') return false;
      if (category === 'exam' && !item.importantForExam) return false;
      if (category === 'question') return false;

      // Subject filter
      if (selectedSubjectId !== 'all' && item.subjectId !== selectedSubjectId) {
        return false;
      }

      // If no query, list everything that matches category & subject
      if (!q) return true;

      const titleMatch = (item.title || '').toLowerCase().includes(q);
      const contentMatch = (item.content || '').toLowerCase().includes(q);
      const transcriptMatch = (item.transcript || '').toLowerCase().includes(q);
      const timeMatch = (item.timeLabel || '').toLowerCase().includes(q);

      return titleMatch || contentMatch || transcriptMatch || timeMatch;
    });
  }, [items, searchTerm, category, selectedSubjectId]);

  // Filter Questions
  const matchedQuestions = useMemo(() => {
    if (category === 'audio' || category === 'photo' || category === 'text') {
      return [];
    }

    const q = searchTerm.trim().toLowerCase();

    return questions.filter((quest) => {
      if (category === 'exam' && !quest.importantForExam) return false;

      if (selectedSubjectId !== 'all' && quest.subjectId !== selectedSubjectId) {
        return false;
      }

      if (!q) return category === 'question';

      const questionMatch = quest.prompt.toLowerCase().includes(q);
      const explanationMatch = (quest.explanation || '').toLowerCase().includes(q);
      const optionsMatch = (quest.options || []).some((opt) => opt.toLowerCase().includes(q));

      return questionMatch || explanationMatch || optionsMatch;
    });
  }, [questions, searchTerm, category, selectedSubjectId]);

  const totalResults = matchedItems.length + matchedQuestions.length;

  const popularSuggestions = [
    'Potencial de ação',
    'Limiar',
    'Revisão prova',
    'Canais de sódio',
    'Conceito',
    'Resumo',
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden animate-in fade-in duration-200">
      {/* Top Header & Search Bar */}
      <div
        className={`p-4 sm:p-6 border-b shrink-0 ${
          lightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}
      >
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-xl bg-indigo-500/15 text-indigo-400">
                <Search className="w-5 h-5" />
              </span>
              <div>
                <h1
                  className={`text-lg sm:text-xl font-bold tracking-tight ${
                    lightMode ? 'text-slate-900' : 'text-slate-100'
                  }`}
                >
                  Pesquisa Global de Estudos
                </h1>
                <p className="text-xs text-slate-400">
                  Encontre qualquer frase dita em gravações de áudio, fotos de lousa, anotações e perguntas.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onCloseSearch}
              className={`p-2 rounded-xl border text-xs font-medium cursor-pointer transition ${
                lightMode
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                  : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
              }`}
            >
              Voltar à Aula
            </button>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-5 h-5 text-indigo-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite o que deseja pesquisar (ex: potencial de repouso, limiar, prova)..."
              className={`w-full rounded-2xl pl-12 pr-10 py-3.5 text-sm sm:text-base border shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition ${
                lightMode
                  ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                  : 'bg-slate-950/90 border-slate-700 text-slate-100 placeholder:text-slate-500'
              }`}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            {/* Category Chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setCategory('all')}
                className={`px-3 py-1.5 rounded-xl font-medium cursor-pointer transition flex items-center gap-1.5 ${
                  category === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : lightMode
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <span>Tudo</span>
                <span className="text-[10px] opacity-75">({items.length + questions.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setCategory('audio')}
                className={`px-3 py-1.5 rounded-xl font-medium cursor-pointer transition flex items-center gap-1.5 ${
                  category === 'audio'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : lightMode
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Áudios</span>
                <span className="text-[10px] opacity-75">
                  ({items.filter((i) => i.type === 'audio').length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCategory('photo')}
                className={`px-3 py-1.5 rounded-xl font-medium cursor-pointer transition flex items-center gap-1.5 ${
                  category === 'photo'
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : lightMode
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Fotos & Lousas</span>
                <span className="text-[10px] opacity-75">
                  ({items.filter((i) => i.type === 'photo').length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCategory('text')}
                className={`px-3 py-1.5 rounded-xl font-medium cursor-pointer transition flex items-center gap-1.5 ${
                  category === 'text'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : lightMode
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Anotações</span>
                <span className="text-[10px] opacity-75">
                  ({items.filter((i) => i.type === 'text').length})
                </span>
              </button>

              <button
                type="button"
                onClick={() => setCategory('question')}
                className={`px-3 py-1.5 rounded-xl font-medium cursor-pointer transition flex items-center gap-1.5 ${
                  category === 'question'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : lightMode
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Perguntas</span>
                <span className="text-[10px] opacity-75">({questions.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setCategory('exam')}
                className={`px-3 py-1.5 rounded-xl font-medium cursor-pointer transition flex items-center gap-1.5 ${
                  category === 'exam'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : lightMode
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
                }`}
              >
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>Para a Prova</span>
              </button>
            </div>

            {/* Subject Selector */}
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className={`text-xs rounded-xl px-2.5 py-1.5 border focus:outline-none cursor-pointer ${
                  lightMode
                    ? 'bg-slate-50 border-slate-200 text-slate-800'
                    : 'bg-slate-800/80 border-slate-700 text-slate-200'
                }`}
              >
                <option value="all">Todas as Matérias</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Results Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Header Summary */}
          {searchTerm && (
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>
                Mostrando <strong className="text-indigo-400 font-semibold">{totalResults}</strong>{' '}
                {totalResults === 1 ? 'resultado encontrado' : 'resultados encontrados'} para "
                <span className="text-slate-200 font-medium">{searchTerm}</span>"
              </span>
            </div>
          )}

          {/* Initial Search Guide (When query is empty) */}
          {!searchTerm && totalResults === 0 && (
            <div
              className={`p-8 text-center rounded-2xl border ${
                lightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/40 border-slate-800'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 mx-auto flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className={`text-base font-bold ${lightMode ? 'text-slate-800' : 'text-slate-200'}`}>
                Busca Instantânea em Todo o Caderno
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-5">
                Digite palavras-chave para encontrar trechos falados em áudios, anotações de texto, fotos e
                questões geradas.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs text-slate-500">Sugestões rápidas:</span>
                {popularSuggestions.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setSearchTerm(sug)}
                    className={`px-3 py-1 rounded-lg text-xs border cursor-pointer transition ${
                      lightMode
                        ? 'bg-white hover:bg-indigo-50 border-slate-200 text-indigo-600'
                        : 'bg-slate-800 hover:bg-indigo-900/40 border-slate-700 text-indigo-300'
                    }`}
                  >
                    "{sug}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No results message */}
          {searchTerm && totalResults === 0 && (
            <div
              className={`p-10 text-center rounded-2xl border ${
                lightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/40 border-slate-800'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-3">
                <Search className="w-6 h-6" />
              </div>
              <h3 className={`text-base font-bold ${lightMode ? 'text-slate-800' : 'text-slate-200'}`}>
                Nenhum resultado encontrado
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                Não encontramos anotações, transcrições ou questões contendo "{searchTerm}". Tente palavras mais
                curtas ou altere os filtros acima.
              </p>
            </div>
          )}

          {/* Matched Questions Section */}
          {matchedQuestions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-purple-400 uppercase tracking-wider px-1">
                <HelpCircle className="w-4 h-4" />
                <span>Perguntas de Estudo ({matchedQuestions.length})</span>
              </div>

              {matchedQuestions.map((q) => {
                const subj = subjectsMap.get(q.subjectId);
                const topic = topicsMap.get(q.topicId);

                return (
                  <div
                    key={q.id}
                    className={`p-4 rounded-2xl border transition hover:border-indigo-500/50 ${
                      lightMode ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/70 border-slate-800'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {subj && (
                          <span
                            className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-white"
                            style={{ backgroundColor: subj.color || '#6366f1' }}
                          >
                            {subj.name}
                          </span>
                        )}
                        <span className="text-xs text-slate-400 font-medium">
                          Aula: {topic?.title || 'Sem título'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onNavigateToTopic(q.courseId, q.subjectId, q.topicId)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <span>Abrir na Aula</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h4
                      className={`text-sm font-semibold mb-2 ${
                        lightMode ? 'text-slate-900' : 'text-slate-100'
                      }`}
                    >
                      {highlightMatch(q.prompt, searchTerm)}
                    </h4>

                    {q.options && q.options.length > 0 && (
                      <div className="space-y-1 mb-2">
                        {q.options.map((opt, idx) => (
                          <div
                            key={idx}
                            className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-2 ${
                              idx === q.correctOptionIndex
                                ? 'bg-emerald-500/15 text-emerald-300 font-medium'
                                : lightMode
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-slate-800/50 text-slate-400'
                            }`}
                          >
                            <span className="font-bold opacity-75">
                              {String.fromCharCode(65 + idx)})
                            </span>
                            <span>{highlightMatch(opt, searchTerm)}</span>
                            {idx === q.correctOptionIndex && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {q.explanation && (
                      <p className="text-xs text-slate-400 italic">
                        <strong>Explicação:</strong> {highlightMatch(q.explanation, searchTerm)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Matched Timeline Items Section */}
          {matchedItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider px-1">
                <BookOpen className="w-4 h-4" />
                <span>Anotações, Fotos e Áudios ({matchedItems.length})</span>
              </div>

              {matchedItems.map((item) => {
                const subj = subjectsMap.get(item.subjectId);
                const topic = topicsMap.get(item.topicId);
                const isPlaying = playingAudioId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition hover:border-indigo-500/50 ${
                      lightMode ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/70 border-slate-800'
                    }`}
                  >
                    {/* Item Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {subj && (
                          <span
                            className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-white shadow-xs"
                            style={{ backgroundColor: subj.color || '#6366f1' }}
                          >
                            {subj.name}
                          </span>
                        )}

                        <span className="text-xs text-slate-400 font-medium">
                          Aula: {topic?.title || 'Sem título'}
                        </span>

                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {item.timeLabel} • {item.dateLabel}
                        </span>

                        {item.importantForExam && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-400 flex items-center gap-1">
                            <Star className="w-3 h-3 fill-current" />
                            PROVA
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          onNavigateToItem(item.courseId, item.subjectId, item.topicId, item.id)
                        }
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer transition ml-auto"
                      >
                        <span>Abrir na Aula</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Title */}
                    {item.title && (
                      <h4
                        className={`text-sm sm:text-base font-bold mb-1.5 flex items-center gap-2 ${
                          lightMode ? 'text-slate-900' : 'text-slate-100'
                        }`}
                      >
                        {item.type === 'audio' && <Mic className="w-4 h-4 text-amber-400 shrink-0" />}
                        {item.type === 'photo' && <Camera className="w-4 h-4 text-cyan-400 shrink-0" />}
                        {item.type === 'text' && <FileText className="w-4 h-4 text-emerald-400 shrink-0" />}
                        <span>{highlightMatch(item.title, searchTerm)}</span>
                      </h4>
                    )}

                    {/* Content text */}
                    {item.content && (
                      <p
                        className={`text-xs sm:text-sm whitespace-pre-wrap mb-2.5 ${
                          lightMode ? 'text-slate-700' : 'text-slate-300'
                        }`}
                      >
                        {highlightMatch(item.content, searchTerm)}
                      </p>
                    )}

                    {/* Audio Transcript & Playback */}
                    {item.type === 'audio' && item.mediaDataUrl && (
                      <div
                        className={`p-3 rounded-xl border mb-2 ${
                          lightMode ? 'bg-amber-50/50 border-amber-200' : 'bg-amber-950/20 border-amber-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleToggleAudio(item.id, item.mediaDataUrl)}
                            className="p-2.5 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer font-bold transition shrink-0"
                          >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                          </button>

                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-semibold text-amber-400 block mb-0.5">
                              Gravação de Áudio ({item.audioDurationSeconds ? `${item.audioDurationSeconds}s` : 'Voz'})
                            </span>
                            {item.transcript ? (
                              <p className="text-xs text-slate-300 line-clamp-2">
                                <strong>Fala:</strong> "{highlightMatch(item.transcript, searchTerm)}"
                              </p>
                            ) : (
                              <span className="text-xs text-slate-400">Clique para ouvir a gravação</span>
                            )}
                          </div>
                        </div>

                        {/* Hidden Audio Element */}
                        <audio
                          ref={(el) => {
                            audioRefs.current[item.id] = el;
                          }}
                          src={item.mediaDataUrl}
                          onEnded={() => setPlayingAudioId(null)}
                          className="hidden"
                        />
                      </div>
                    )}

                    {/* Photo Thumbnail */}
                    {item.type === 'photo' && item.mediaDataUrl && (
                      <div className="mt-2 flex items-center gap-3">
                        <img
                          src={item.mediaDataUrl}
                          alt={item.title || 'Foto da Lousa'}
                          onClick={() => onOpenPhotoViewer && onOpenPhotoViewer(item)}
                          className="w-24 h-16 object-cover rounded-xl border border-slate-700 hover:scale-105 transition cursor-pointer"
                        />
                        <span className="text-xs text-slate-400">
                          Clique na miniatura para ampliar o slide em tela cheia.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
