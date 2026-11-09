import React, { useState } from 'react';
import {
  HelpCircle,
  Sparkles,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Trash2,
  Star,
  Volume2,
  Key,
  BookOpen,
  Check,
  RotateCcw,
} from 'lucide-react';
import { StudyQuestion } from '../types';
import { getGeminiApiKey, saveGeminiApiKey } from '../services/questionGeneratorService';

interface TopicQuestionsViewProps {
  questions: StudyQuestion[];
  topicTitle: string;
  subjectName: string;
  lightMode: boolean;
  isGenerating?: boolean;
  onGenerateFromAudios: () => void;
  onUpdateQuestion: (question: StudyQuestion) => void;
  onDeleteQuestion: (questionId: string) => void;
  onJumpToAudio?: (audioItemId: string) => void;
  hasAudioTranscripts: boolean;
}

export const TopicQuestionsView: React.FC<TopicQuestionsViewProps> = ({
  questions,
  topicTitle,
  subjectName,
  lightMode,
  isGenerating = false,
  onGenerateFromAudios,
  onUpdateQuestion,
  onDeleteQuestion,
  onJumpToAudio,
  hasAudioTranscripts,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'multiple_choice' | 'discursive'>('all');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getGeminiApiKey());
  const [apiKeySavedSuccess, setApiKeySavedSuccess] = useState(false);

  const filteredQuestions = questions.filter((q) => {
    if (filterType === 'all') return true;
    return q.type === filterType;
  });

  const mcCount = questions.filter((q) => q.type === 'multiple_choice').length;
  const discCount = questions.filter((q) => q.type === 'discursive').length;

  const handleSelectOption = (question: StudyQuestion, optionIndex: number) => {
    onUpdateQuestion({
      ...question,
      userSelectedOption: optionIndex,
    });
  };

  const handleToggleDiscursiveReveal = (question: StudyQuestion) => {
    onUpdateQuestion({
      ...question,
      userRevealedDiscursive: !question.userRevealedDiscursive,
    });
  };

  const handleToggleImportant = (question: StudyQuestion) => {
    onUpdateQuestion({
      ...question,
      importantForExam: !question.importantForExam,
    });
  };

  const handleResetAnswer = (question: StudyQuestion) => {
    onUpdateQuestion({
      ...question,
      userSelectedOption: undefined,
      userRevealedDiscursive: false,
    });
  };

  const handleSaveApiKey = () => {
    saveGeminiApiKey(apiKeyInput);
    setApiKeySavedSuccess(true);
    setTimeout(() => {
      setApiKeySavedSuccess(false);
      setShowApiKeyModal(false);
    }, 1200);
  };

  const hasApiKey = Boolean(getGeminiApiKey());

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div
        className={`p-4 rounded-2xl border transition shadow-sm ${
          lightMode
            ? 'bg-white border-slate-200'
            : 'bg-slate-900/90 border-slate-800'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-purple-500/20 text-purple-400">
                <HelpCircle className="w-5 h-5" />
              </span>
              <h2
                className={`text-base sm:text-lg font-bold ${
                  lightMode ? 'text-slate-900' : 'text-slate-100'
                }`}
              >
                Questões da Aula ({questions.length})
              </h2>
            </div>
            <p
              className={`text-xs mt-1 ${
                lightMode ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              Perguntas geradas a partir da transcrição da fala do professor sobre{' '}
              <span className="font-semibold text-purple-400">"{topicTitle}"</span>.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowApiKeyModal(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 border transition cursor-pointer ${
                hasApiKey
                  ? lightMode
                    ? 'bg-purple-50 border-purple-200 text-purple-700'
                    : 'bg-purple-950/40 border-purple-800/60 text-purple-300'
                  : lightMode
                  ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700'
              }`}
              title="Configurar chave de inteligência artificial Gemini"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{hasApiKey ? 'Gemini IA Conectado' : 'Configurar Gemini (Opcional)'}</span>
            </button>

            <button
              type="button"
              onClick={onGenerateFromAudios}
              disabled={isGenerating}
              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'Criando Questões...' : 'Gerar Novas Questões'}</span>
            </button>
          </div>
        </div>

        {/* Filter Badges */}
        {questions.length > 0 && (
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-slate-800/40 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                filterType === 'all'
                  ? 'bg-purple-600 text-white'
                  : lightMode
                  ? 'text-slate-600 hover:bg-slate-100'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              Todas ({questions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('multiple_choice')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                filterType === 'multiple_choice'
                  ? 'bg-purple-600 text-white'
                  : lightMode
                  ? 'text-slate-600 hover:bg-slate-100'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              Múltipla Escolha ({mcCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('discursive')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer whitespace-nowrap ${
                filterType === 'discursive'
                  ? 'bg-purple-600 text-white'
                  : lightMode
                  ? 'text-slate-600 hover:bg-slate-100'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              Discursivas ({discCount})
            </button>
          </div>
        )}
      </div>

      {/* Empty State */}
      {questions.length === 0 && (
        <div
          className={`p-8 text-center rounded-2xl border ${
            lightMode
              ? 'bg-white border-slate-200'
              : 'bg-slate-900/60 border-slate-800'
          }`}
        >
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <HelpCircle className="w-6 h-6" />
          </div>
          <h3
            className={`text-base font-semibold ${
              lightMode ? 'text-slate-800' : 'text-slate-200'
            }`}
          >
            Nenhuma questão gerada ainda para esta aula
          </h3>
          <p
            className={`text-xs max-w-md mx-auto mt-1 leading-relaxed ${
              lightMode ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            Ao gravar um áudio durante a aula, o sistema transcreve a fala do professor
            e formula automaticamente perguntas para testar e fixar seu conhecimento!
          </p>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {hasAudioTranscripts ? (
              <button
                type="button"
                onClick={onGenerateFromAudios}
                disabled={isGenerating}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-2 shadow cursor-pointer transition disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isGenerating ? 'Criando Perguntas...' : 'Gerar Perguntas Desta Aula'}</span>
              </button>
            ) : (
              <p className="text-xs text-amber-400/90 bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/20">
                💡 Dica: Grave um áudio pelo botão do microfone abaixo para gerar perguntas!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Questions List */}
      <div className="space-y-4">
        {filteredQuestions.map((q, qIndex) => {
          const isAnswered = q.userSelectedOption !== undefined;
          const isCorrect = q.userSelectedOption === q.correctOptionIndex;

          return (
            <div
              key={q.id}
              className={`p-4 sm:p-5 rounded-2xl border transition shadow-sm relative ${
                lightMode
                  ? 'bg-white border-slate-200 hover:border-slate-300'
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700/80'
              }`}
            >
              {/* Question Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                      q.type === 'multiple_choice'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    }`}
                  >
                    {q.type === 'multiple_choice' ? 'Múltipla Escolha' : 'Discursiva'}
                  </span>
                  <span
                    className={`text-xs ${
                      lightMode ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    Questão #{qIndex + 1}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {/* Favorite for Exam / Flashcards */}
                  <button
                    type="button"
                    onClick={() => handleToggleImportant(q)}
                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                      q.importantForExam
                        ? 'text-amber-400 bg-amber-400/10'
                        : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/60'
                    }`}
                    title={
                      q.importantForExam
                        ? 'Marcada como importante para revisão'
                        : 'Marcar para revisão e flashcards'
                    }
                  >
                    <Star
                      className={`w-4 h-4 ${
                        q.importantForExam ? 'fill-amber-400 text-amber-400' : ''
                      }`}
                    />
                  </button>

                  {/* Reset Answer */}
                  {(isAnswered || q.userRevealedDiscursive) && (
                    <button
                      type="button"
                      onClick={() => handleResetAnswer(q)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition cursor-pointer"
                      title="Refazer questão"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Delete Question */}
                  <button
                    type="button"
                    onClick={() => onDeleteQuestion(q.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                    title="Excluir questão"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Prompt Text */}
              <p
                className={`text-sm sm:text-base font-semibold leading-relaxed ${
                  lightMode ? 'text-slate-800' : 'text-slate-100'
                }`}
              >
                {q.prompt}
              </p>

              {/* Teacher Quote Excerpt Callout */}
              {q.teacherQuoteSnippet && (
                <div
                  className={`mt-3 p-2.5 rounded-xl text-xs border flex items-start gap-2 ${
                    lightMode
                      ? 'bg-purple-50/70 border-purple-200/80 text-purple-950'
                      : 'bg-purple-950/20 border-purple-800/40 text-purple-200'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="font-semibold text-purple-300 block text-[10px] uppercase tracking-wider mb-0.5">
                      Fala do Professor em Aula:
                    </span>
                    <p className="italic leading-relaxed font-sans">
                      "{q.teacherQuoteSnippet}"
                    </p>
                  </div>
                  {q.audioItemId && onJumpToAudio && (
                    <button
                      type="button"
                      onClick={() => onJumpToAudio(q.audioItemId!)}
                      className="px-2 py-0.5 rounded-md bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 text-[10px] font-medium transition cursor-pointer whitespace-nowrap self-center"
                    >
                      Ouvir Áudio
                    </button>
                  )}
                </div>
              )}

              {/* Multiple Choice Options */}
              {q.type === 'multiple_choice' && q.options && (
                <div className="mt-4 space-y-2">
                  {q.options.map((opt, optIdx) => {
                    const letters = ['A', 'B', 'C', 'D', 'E'];
                    const letter = letters[optIdx] || `${optIdx + 1}`;
                    const isSelected = q.userSelectedOption === optIdx;
                    const isTheCorrectOption = q.correctOptionIndex === optIdx;

                    let btnStyle = lightMode
                      ? 'bg-slate-50 border-slate-200 hover:border-purple-300 text-slate-700'
                      : 'bg-slate-800/60 border-slate-700 hover:border-purple-500/50 text-slate-200';

                    if (isAnswered) {
                      if (isTheCorrectOption) {
                        btnStyle =
                          'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 ring-1 ring-emerald-500/40';
                      } else if (isSelected && !isTheCorrectOption) {
                        btnStyle =
                          'bg-rose-500/20 border-rose-500/60 text-rose-200 ring-1 ring-rose-500/40';
                      } else {
                        btnStyle = 'opacity-40 border-transparent';
                      }
                    }

                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => handleSelectOption(q, optIdx)}
                        className={`w-full p-3 rounded-xl border text-left text-xs sm:text-sm font-medium transition flex items-start gap-3 cursor-pointer ${btnStyle}`}
                      >
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs ${
                            isAnswered && isTheCorrectOption
                              ? 'bg-emerald-600 text-white'
                              : isAnswered && isSelected
                              ? 'bg-rose-600 text-white'
                              : lightMode
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-slate-700 text-slate-300'
                          }`}
                        >
                          {letter}
                        </span>
                        <span className="flex-1 pt-0.5">{opt}</span>
                        {isAnswered && isTheCorrectOption && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 self-center" />
                        )}
                        {isAnswered && isSelected && !isTheCorrectOption && (
                          <XCircle className="w-5 h-5 text-rose-400 shrink-0 self-center" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Feedback & Explanation for Multiple Choice */}
              {q.type === 'multiple_choice' && isAnswered && (
                <div
                  className={`mt-3.5 p-3.5 rounded-xl border animate-in fade-in slide-in-from-top-1 ${
                    isCorrect
                      ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                      : 'bg-rose-950/20 border-rose-800/40 text-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                    {isCorrect ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span className="text-emerald-300">Resposta Correta! Parabéns!</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-4 h-4 text-rose-400" />
                        <span className="text-rose-300">
                          Resposta Incorreta. A alternativa correta é a{' '}
                          {String.fromCharCode(65 + (q.correctOptionIndex || 0))}.
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans mt-1">
                    {q.explanation}
                  </p>
                </div>
              )}

              {/* Discursive Question Controls */}
              {q.type === 'discursive' && (
                <div className="mt-4 space-y-3">
                  <div className="relative">
                    <textarea
                      placeholder="Escreva sua resposta ou reflexão aqui para fixar o conteúdo..."
                      value={q.userNotes || ''}
                      onChange={(e) =>
                        onUpdateQuestion({
                          ...q,
                          userNotes: e.target.value,
                        })
                      }
                      rows={3}
                      className={`w-full p-3 rounded-xl border text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 transition resize-none ${
                        lightMode
                          ? 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'
                          : 'bg-slate-800/60 border-slate-700 text-slate-100 placeholder-slate-500'
                      }`}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleDiscursiveReveal(q)}
                      className="px-3.5 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      {q.userRevealedDiscursive ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Ocultar Gabarito Comentado</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Ver Gabarito e Explicação do Professor</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Revealed Model Answer */}
                  {q.userRevealedDiscursive && (
                    <div
                      className={`p-3.5 rounded-xl border animate-in fade-in slide-in-from-top-1 ${
                        lightMode
                          ? 'bg-purple-50 border-purple-200 text-purple-950'
                          : 'bg-purple-950/30 border-purple-800/50 text-purple-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-bold text-xs mb-1.5 text-purple-300">
                        <BookOpen className="w-4 h-4" />
                        <span>Gabarito e Critérios de Correção:</span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line font-sans">
                        {q.explanation}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Gemini API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div
            className={`w-full max-w-md p-5 rounded-2xl border shadow-xl ${
              lightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="p-1.5 rounded-xl bg-purple-500/20 text-purple-400">
                <Key className="w-4 h-4" />
              </span>
              <h3
                className={`text-base font-bold ${
                  lightMode ? 'text-slate-900' : 'text-slate-100'
                }`}
              >
                Chave da API Gemini (Google AI)
              </h3>
            </div>
            <p
              className={`text-xs leading-relaxed mb-4 ${
                lightMode ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              Com a chave gratuita do Google Gemini, o app gera perguntas ultra-aprofundadas
              e gabaritos detalhados para cada áudio. Se não tiver, o app continua funcionando
              normalmente com o motor linguístico offline!
            </p>

            <div className="space-y-3">
              <div>
                <label
                  className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 ${
                    lightMode ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  Sua Chave (AI Studio)
                </label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className={`w-full p-2.5 rounded-xl border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-purple-500 ${
                    lightMode
                      ? 'bg-slate-50 border-slate-200 text-slate-800'
                      : 'bg-slate-800 border-slate-700 text-slate-100'
                  }`}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-purple-400">
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline flex items-center gap-1"
                >
                  Obter chave grátis no Google AI Studio ↗
                </a>
              </div>

              {apiKeySavedSuccess && (
                <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  <span>Chave salva com sucesso!</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowApiKeyModal(false)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer ${
                    lightMode
                      ? 'text-slate-600 hover:bg-slate-100'
                      : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveApiKey}
                  className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer shadow transition"
                >
                  Salvar Chave
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

