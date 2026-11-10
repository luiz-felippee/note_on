import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Key,
  Calendar,
  Layers,
  Copy,
  Check,
  Plus,
  RefreshCw,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  Cpu,
  BookmarkPlus,
} from 'lucide-react';
import { ChatMessage, Course, Subject, StudyTopic, TimelineItem, StudyQuestion, AiProviderConfig } from '../types';
import {
  executeAiStudyRequest,
  getStoredAiKeys,
  saveStoredAiKeys,
  LessonContext,
} from '../services/aiProviderService';

interface StudyAiChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  lightMode: boolean;
  course: Course | null;
  subject: Subject | null;
  topic: StudyTopic;
  items: TimelineItem[];
  questions: StudyQuestion[];
  onSaveToTimeline: (text: string, title?: string) => void;
  showToast: (msg: string, type?: 'success' | 'info') => void;
}

export const StudyAiChatModal: React.FC<StudyAiChatModalProps> = ({
  isOpen,
  onClose,
  lightMode,
  course,
  subject,
  topic,
  items,
  questions,
  onSaveToTimeline,
  showToast,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeProviderNotice, setActiveProviderNotice] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Settings for Multi-Model API Keys
  const [showConfig, setShowConfig] = useState(false);
  const [keysConfig, setKeysConfig] = useState<AiProviderConfig>(getStoredAiKeys());
  const [savedKeysSuccess, setSavedKeysSuccess] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize with welcome message if empty
  useEffect(() => {
    if (messages.length === 0) {
      const audiosCount = items.filter((i) => i.type === 'audio').length;
      const photosCount = items.filter((i) => i.type === 'photo').length;

      const welcomeMsg: ChatMessage = {
        id: 'msg-welcome',
        role: 'assistant',
        content:
          `Olá! Sou seu **Tutor IA de Estudos NoteOn**.\n\n` +
          `Estou conectado à aula **"${topic.title}"** da disciplina **"${subject?.name || 'Geral'}"**.\n\n` +
          `Identifiquei **${audiosCount} áudios com transcrição** e **${photosCount} fotos de lousa/slides**.\n\n` +
          `Como posso te ajudar agora? Você pode usar os botões de ação rápida abaixo ou me fazer qualquer pergunta!`,
        timestamp: Date.now(),
        providerUsed: 'Tutor NoteOn',
      };
      setMessages([welcomeMsg]);
    }
  }, [topic.id, subject?.id]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  if (!isOpen) return null;

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputText).trim();
    if (!textToSend || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: textToSend,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customPrompt) setInputText('');
    setIsLoading(true);
    setActiveProviderNotice(null);

    const lessonContext: LessonContext = {
      course,
      subject,
      topic,
      items,
      questions,
    };

    try {
      const result = await executeAiStudyRequest({
        userMessage: textToSend,
        context: lessonContext,
        onProviderSwitched: (provName, modelLabel) => {
          setActiveProviderNotice(`⚡ Limite da 1ª API atingido. Alternado com sucesso para ${modelLabel}`);
        },
      });

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: result.reply,
        timestamp: Date.now(),
        providerUsed: result.providerUsed,
        isStudyPlan: textToSend.toLowerCase().includes('plano'),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('Erro no Tutor IA:', err);
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: `Ocorreu uma instabilidade ao consultar os modelos de IA: ${err.message}. Tente novamente em instantes.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoredAiKeys(keysConfig);
    setSavedKeysSuccess(true);
    showToast('Chaves de IA salvas com sucesso!');
    setTimeout(() => {
      setSavedKeysSuccess(false);
      setShowConfig(false);
    }, 1200);
  };

  const handleCopyMessage = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(msgId);
    showToast('Conteúdo copiado para a área de transferência!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSavePlanToTimeline = (content: string) => {
    onSaveToTimeline(content, `Plano de Estudo IA: ${topic.title}`);
    showToast('Plano de estudo salvo diretamente na linha do tempo da aula!');
  };

  const configuredCount = [
    keysConfig.geminiApiKey,
    keysConfig.groqApiKey,
    keysConfig.openRouterApiKey,
    keysConfig.openAiApiKey,
  ].filter((k) => Boolean(k?.trim())).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`w-full max-w-3xl h-[92vh] max-h-[850px] rounded-3xl border shadow-2xl flex flex-col overflow-hidden ${
          lightMode ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}
      >
        {/* Header */}
        <div
          className={`p-3.5 sm:p-4 border-b flex items-center justify-between shrink-0 ${
            lightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={`text-sm sm:text-base font-bold truncate ${lightMode ? 'text-slate-900' : 'text-slate-100'}`}>
                  Tutor IA de Estudos NoteOn
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 shrink-0 hidden xs:inline">
                  Multi-Model Failover
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Contexto: <strong className="text-slate-300 font-medium">{subject?.name}</strong> • {topic.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setShowConfig((v) => !v)}
              className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                showConfig
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : configuredCount > 1
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : lightMode
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
              }`}
              title="Configurar Chaves de API (Multi-Model Failover)"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {configuredCount > 0 ? `${configuredCount} APIs Ativas` : 'Configurar APIs'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className={`p-2 rounded-xl transition cursor-pointer ${
                lightMode ? 'text-slate-500 hover:bg-slate-200' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* API Settings Sub-Drawer */}
        {showConfig && (
          <div
            className={`p-4 border-b shrink-0 overflow-y-auto max-h-72 ${
              lightMode ? 'bg-indigo-50/70 border-indigo-100' : 'bg-slate-950 border-slate-800'
            }`}
          >
            <form onSubmit={handleSaveKeys} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Configuração de Provedores com Failover Automático</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  Insira mais de uma chave para não travar no limite gratuito
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Google Gemini */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-semibold text-slate-300">1. Google Gemini (Multimodal)</span>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:underline flex items-center gap-0.5"
                    >
                      <span>Obter chave grátis</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <input
                    type="password"
                    value={keysConfig.geminiApiKey || ''}
                    onChange={(e) => setKeysConfig({ ...keysConfig, geminiApiKey: e.target.value })}
                    placeholder="AIzaSy..."
                    className="w-full text-xs rounded-xl px-3 py-2 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* 2. Groq */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-semibold text-slate-300">2. Groq (Llama 3.3 Ultra Rápido)</span>
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:underline flex items-center gap-0.5"
                    >
                      <span>Obter chave grátis</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <input
                    type="password"
                    value={keysConfig.groqApiKey || ''}
                    onChange={(e) => setKeysConfig({ ...keysConfig, groqApiKey: e.target.value })}
                    placeholder="gsk_..."
                    className="w-full text-xs rounded-xl px-3 py-2 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* 3. OpenRouter / DeepSeek */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-semibold text-slate-300">3. OpenRouter (DeepSeek V3 / Claude)</span>
                    <a
                      href="https://openrouter.ai/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:underline flex items-center gap-0.5"
                    >
                      <span>Obter chave</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <input
                    type="password"
                    value={keysConfig.openRouterApiKey || ''}
                    onChange={(e) => setKeysConfig({ ...keysConfig, openRouterApiKey: e.target.value })}
                    placeholder="sk-or-v1-..."
                    className="w-full text-xs rounded-xl px-3 py-2 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* 4. OpenAI */}
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-semibold text-slate-300">4. OpenAI (GPT-4o mini)</span>
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:underline flex items-center gap-0.5"
                    >
                      <span>Obter chave</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <input
                    type="password"
                    value={keysConfig.openAiApiKey || ''}
                    onChange={(e) => setKeysConfig({ ...keysConfig, openAiApiKey: e.target.value })}
                    placeholder="sk-..."
                    className="w-full text-xs rounded-xl px-3 py-2 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400">
                  🛡️ Suas chaves ficam guardadas no seu próprio navegador e nunca são expostas a terceiros.
                </span>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer transition shadow flex items-center gap-1.5"
                >
                  {savedKeysSuccess ? <Check className="w-4 h-4" /> : null}
                  <span>{savedKeysSuccess ? 'Salvo!' : 'Salvar Provedores'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Notice of automatic failover */}
        {activeProviderNotice && (
          <div className="px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>{activeProviderNotice}</span>
          </div>
        )}

        {/* Quick Action Chips Bar */}
        <div
          className={`px-3 py-2 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 text-xs ${
            lightMode ? 'bg-slate-100/70 border-slate-200' : 'bg-slate-950/40 border-slate-800'
          }`}
        >
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 hidden sm:inline">
            Ações Rápidas:
          </span>

          <button
            type="button"
            onClick={() =>
              handleSendMessage(
                'Por favor, analise todas as falas dos áudios gravados e as imagens/slides desta aula. Organize e sintetize os tópicos mais importantes de forma hierárquica, destacando os conceitos fundamentais que o professor enfatizou.'
              )
            }
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
              lightMode
                ? 'bg-white hover:bg-indigo-50 border-slate-200 text-indigo-700'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-indigo-300'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>📌 Organizar Tópicos Principais</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handleSendMessage(
                'Crie um plano de estudo estruturado e personalizado para esta aula, detalhando um cronograma para revisar cada áudio gravado e foto/slide capturado. Inclua metas para Hoje (assimilação), Amanhã D+1 (recuperação ativa) e D+7/D+14 (repetição espaçada SM-2).'
              )
            }
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
              lightMode
                ? 'bg-white hover:bg-emerald-50 border-slate-200 text-emerald-700'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-emerald-300'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>📅 Criar Plano de Estudo</span>
          </button>

          <button
            type="button"
            onClick={() =>
              handleSendMessage(
                'Com base nos áudios do professor e anotações, aponte quais são os pontos com maior chance de serem cobrados em prova e as possíveis pegadinhas conceituais.'
              )
            }
            disabled={isLoading}
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
              lightMode
                ? 'bg-white hover:bg-amber-50 border-slate-200 text-amber-700'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>⭐ Foco para Prova</span>
          </button>
        </div>

        {/* Chat Messages Conversation Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-br-xs shadow-md'
                      : lightMode
                      ? 'bg-slate-100 text-slate-800 border border-slate-200 shadow-sm rounded-bl-xs'
                      : 'bg-slate-800/80 text-slate-200 border border-slate-700/60 shadow-sm rounded-bl-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Assistant Message Actions & Provider Badge */}
                  {!isUser && (
                    <div className="mt-3 pt-2.5 border-t border-slate-700/40 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span className="font-mono text-[10px] opacity-75">
                        {msg.providerUsed ? `⚡ ${msg.providerUsed}` : 'Tutor NoteOn'}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.id, msg.content)}
                          className="hover:text-indigo-400 flex items-center gap-1 cursor-pointer transition"
                          title="Copiar texto"
                        >
                          {copiedId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedId === msg.id ? 'Copiado' : 'Copiar'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSavePlanToTimeline(msg.content)}
                          className="hover:text-emerald-400 flex items-center gap-1 cursor-pointer transition text-indigo-400 font-medium"
                          title="Salvar esta síntese como nota na aula"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          <span>Salvar no Caderno</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 animate-pulse">
                <Sparkles className="w-4 h-4" />
              </div>
              <div
                className={`p-3.5 rounded-2xl rounded-bl-xs text-xs flex items-center gap-2.5 ${
                  lightMode ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-300'
                }`}
              >
                <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                <span>O Tutor IA está analisando seus áudios, imagens e gerando a resposta...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Chat Input Bar */}
        <div
          className={`p-3 sm:p-4 border-t shrink-0 ${
            lightMode ? 'bg-white border-slate-200' : 'bg-slate-950 border-slate-800'
          }`}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-end gap-2"
          >
            <textarea
              ref={inputRef}
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Pergunte qualquer coisa sobre a aula, peça um plano de estudos ou tire uma dúvida..."
              className={`flex-1 rounded-2xl p-3 text-xs sm:text-sm border resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition ${
                lightMode
                  ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                  : 'bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500'
              }`}
            />

            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-3 sm:px-4 sm:py-3 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 text-white font-bold transition cursor-pointer shrink-0 shadow-lg shadow-indigo-600/25 flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Enviar</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
