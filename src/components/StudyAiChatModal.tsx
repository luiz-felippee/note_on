import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  X,
  Send,
  Calendar,
  Layers,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Cpu,
  BookmarkPlus,
  SlidersHorizontal,
  ChevronDown,
  MessageCircle,
  Smartphone,
} from 'lucide-react';
import {
  ChatMessage,
  Course,
  Subject,
  StudyTopic,
  TimelineItem,
  StudyQuestion,
  AiProviderConfig,
  AiProviderName,
} from '../types';
import {
  executeAiStudyRequest,
  getStoredAiKeys,
  saveStoredAiKeys,
  AVAILABLE_MODELS,
  LessonContext,
} from '../services/aiProviderService';
import {
  getStoredWhatsAppConfig,
  saveStoredWhatsAppConfig,
  dispatchStudyToWhatsApp,
  formatPhoneForDisplay,
  sanitizePhoneNumber,
  sendViaWebhook,
} from '../services/whatsappService';

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

  // Settings for Multi-Model API Keys & Model selection
  const [showConfig, setShowConfig] = useState(false);
  const [keysConfig, setKeysConfig] = useState<AiProviderConfig>(getStoredAiKeys());
  const [selectedProvider, setSelectedProvider] = useState<'auto' | AiProviderName>(
    keysConfig.activeProviderSelection || 'auto'
  );
  const [savedKeysSuccess, setSavedKeysSuccess] = useState(false);

  // WhatsApp Integration states
  const [whatsappConfig, setWhatsappConfig] = useState(getStoredWhatsAppConfig());
  const [whatsappPhone, setWhatsappPhone] = useState(formatPhoneForDisplay(whatsappConfig.phone));
  const [whatsappWebhook, setWhatsappWebhook] = useState(whatsappConfig.webhookUrl);
  const [whatsappAutoWebhook, setWhatsappAutoWebhook] = useState(whatsappConfig.autoSendWebhook);

  // Quick prompt for phone when user clicks Send to WhatsApp for the first time
  const [showPhonePromptModal, setShowPhonePromptModal] = useState(false);
  const [pendingWhatsAppContent, setPendingWhatsAppContent] = useState<string | null>(null);
  const [promptPhoneInput, setPromptPhoneInput] = useState('');

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
          `Identifiquei **${audiosCount} gravações com transcrição** e **${photosCount} fotos de lousa/slides**.\n\n` +
          `Você pode alternar entre modelos (NVIDIA Llama 3.3 / DeepSeek R1, Gemini, Groq) com proteção de limite por failover automático!`,
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
        selectedProvider,
        onProviderSwitched: (_provName, modelLabel) => {
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

      // Disparo automático via Webhook se ativado pelo usuário
      if (
        assistantMsg.isStudyPlan &&
        whatsappConfig.autoSendWebhook &&
        whatsappConfig.webhookUrl
      ) {
        sendViaWebhook(
          whatsappConfig.webhookUrl,
          {
            topicTitle: topic.title,
            subjectName: subject?.name,
            courseName: course?.name,
            content: assistantMsg.content,
            audioCount: items.filter((i) => i.type === 'audio').length,
            photoCount: items.filter((i) => i.type === 'photo').length,
          },
          whatsappConfig.phone
        ).catch((err) => console.warn('Erro ao disparar webhook automático:', err));
      }
    } catch (err: any) {
      console.error('Erro no Tutor IA:', err);
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: `Ocorreu uma instabilidade ao consultar as APIs: ${err.message}. Tente novamente em instantes.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveKeys = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...keysConfig,
      activeProviderSelection: selectedProvider,
    };
    saveStoredAiKeys(updated);
    setKeysConfig(updated);

    // Salva configurações do WhatsApp
    const cleanedPhone = sanitizePhoneNumber(whatsappPhone);
    saveStoredWhatsAppConfig({
      phone: cleanedPhone,
      webhookUrl: whatsappWebhook,
      autoSendWebhook: whatsappAutoWebhook,
    });
    setWhatsappConfig({
      phone: cleanedPhone,
      webhookUrl: whatsappWebhook.trim(),
      autoSendWebhook: whatsappAutoWebhook,
    });
    setWhatsappPhone(formatPhoneForDisplay(cleanedPhone));

    setSavedKeysSuccess(true);
    showToast('Provedores, modelos e WhatsApp salvos!');
    setTimeout(() => {
      setSavedKeysSuccess(false);
      setShowConfig(false);
    }, 1200);
  };

  const handleSendToWhatsApp = async (content: string) => {
    const currentConfig = getStoredWhatsAppConfig();
    if (!currentConfig.phone && !currentConfig.webhookUrl) {
      setPendingWhatsAppContent(content);
      setPromptPhoneInput('');
      setShowPhonePromptModal(true);
      return;
    }

    const res = await dispatchStudyToWhatsApp({
      topicTitle: topic.title,
      subjectName: subject?.name,
      courseName: course?.name,
      content,
      audioCount: items.filter((i) => i.type === 'audio').length,
      photoCount: items.filter((i) => i.type === 'photo').length,
      questionsCount: questions.length,
    });

    if (res.success) {
      showToast(res.message || 'WhatsApp aberto com o plano pronto!', 'success');
    } else {
      setPendingWhatsAppContent(content);
      setShowPhonePromptModal(true);
    }
  };

  const handleConfirmPromptPhone = async () => {
    if (!promptPhoneInput.trim()) return;
    const sanitized = sanitizePhoneNumber(promptPhoneInput);
    saveStoredWhatsAppConfig({ phone: sanitized });
    setWhatsappConfig((prev) => ({ ...prev, phone: sanitized }));
    setWhatsappPhone(formatPhoneForDisplay(sanitized));
    setShowPhonePromptModal(false);

    if (pendingWhatsAppContent) {
      await dispatchStudyToWhatsApp(
        {
          topicTitle: topic.title,
          subjectName: subject?.name,
          courseName: course?.name,
          content: pendingWhatsAppContent,
          audioCount: items.filter((i) => i.type === 'audio').length,
          photoCount: items.filter((i) => i.type === 'photo').length,
          questionsCount: questions.length,
        },
        sanitized
      );
      showToast('WhatsApp aberto! Envie a mensagem no chat.', 'success');
      setPendingWhatsAppContent(null);
    }
  };

  const handleCopyMessage = (msgId: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(msgId);
    showToast('Conteúdo copiado para a área de transferência!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSavePlanToTimeline = (content: string) => {
    onSaveToTimeline(content, `Plano de Estudo IA: ${topic.title}`);
    showToast('Plano de estudo salvo diretamente na aula!');
  };

  const configuredCount = [
    keysConfig.nvidiaApiKey,
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
          className={`p-3 sm:p-4 border-b flex items-center justify-between shrink-0 ${
            lightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 via-emerald-600 to-purple-600 text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className={`text-sm sm:text-base font-bold truncate ${lightMode ? 'text-slate-900' : 'text-slate-100'}`}>
                  Tutor IA de Estudos NoteOn
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0 hidden xs:inline">
                  NVIDIA + Multi-Model
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
                  : configuredCount > 0
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : lightMode
                  ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
              }`}
              title="Configurar APIs e Escolher Modelos (NVIDIA, Gemini, Groq, DeepSeek)"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {configuredCount > 0 ? `${configuredCount} APIs Ativas` : 'Configurar APIs & Modelos'}
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

        {/* API Settings & Model Selection Sub-Drawer */}
        {showConfig && (
          <div
            className={`p-4 border-b shrink-0 overflow-y-auto max-h-80 ${
              lightMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
            }`}
          >
            <form onSubmit={handleSaveKeys} className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Escolha de Modelos e Chaves de API (Anti-Bloqueio de Cota)</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  Rotação automática se houver limite de uso (429)
                </span>
              </div>

              {/* Grid with Providers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* 1. NVIDIA NIM */}
                <div className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5" />
                      <span>1. NVIDIA NIM (Llama 3.3 / DeepSeek R1)</span>
                    </span>
                    <a
                      href="https://build.nvidia.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 hover:underline flex items-center gap-0.5 text-[10px]"
                    >
                      <span>Obter chave NVIDIA</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>

                  <input
                    type="password"
                    value={keysConfig.nvidiaApiKey || ''}
                    onChange={(e) => setKeysConfig({ ...keysConfig, nvidiaApiKey: e.target.value })}
                    placeholder="nvapi-..."
                    className="w-full text-xs rounded-xl px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-emerald-500"
                  />

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Modelo NVIDIA:</label>
                    <select
                      value={keysConfig.nvidiaModel || AVAILABLE_MODELS.nvidia[0].id}
                      onChange={(e) => setKeysConfig({ ...keysConfig, nvidiaModel: e.target.value })}
                      className="w-full text-xs rounded-xl px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none cursor-pointer"
                    >
                      {AVAILABLE_MODELS.nvidia.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 2. Google Gemini */}
                <div className="p-3 rounded-2xl border border-indigo-500/30 bg-indigo-950/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-indigo-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>2. Google Gemini (Multimodal)</span>
                    </span>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:underline flex items-center gap-0.5 text-[10px]"
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
                    className="w-full text-xs rounded-xl px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Modelo Gemini:</label>
                    <select
                      value={keysConfig.geminiModel || AVAILABLE_MODELS.gemini[0].id}
                      onChange={(e) => setKeysConfig({ ...keysConfig, geminiModel: e.target.value })}
                      className="w-full text-xs rounded-xl px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none cursor-pointer"
                    >
                      {AVAILABLE_MODELS.gemini.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 3. Groq */}
                <div className="p-3 rounded-2xl border border-amber-500/30 bg-amber-950/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300">3. Groq (Ultra Rápido LPU)</span>
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-400 hover:underline flex items-center gap-0.5 text-[10px]"
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
                    className="w-full text-xs rounded-xl px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500"
                  />

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Modelo Groq:</label>
                    <select
                      value={keysConfig.groqModel || AVAILABLE_MODELS.groq[0].id}
                      onChange={(e) => setKeysConfig({ ...keysConfig, groqModel: e.target.value })}
                      className="w-full text-xs rounded-xl px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none cursor-pointer"
                    >
                      {AVAILABLE_MODELS.groq.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4. OpenRouter */}
                <div className="p-3 rounded-2xl border border-purple-500/30 bg-purple-950/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-300">4. OpenRouter (DeepSeek R1 / V3)</span>
                    <a
                      href="https://openrouter.ai/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-purple-400 hover:underline flex items-center gap-0.5 text-[10px]"
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
                    className="w-full text-xs rounded-xl px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-purple-500"
                  />

                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Modelo OpenRouter:</label>
                    <select
                      value={keysConfig.openRouterModel || AVAILABLE_MODELS.openrouter[0].id}
                      onChange={(e) => setKeysConfig({ ...keysConfig, openRouterModel: e.target.value })}
                      className="w-full text-xs rounded-xl px-2.5 py-1.5 bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none cursor-pointer"
                    >
                      {AVAILABLE_MODELS.openrouter.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Seção WhatsApp para Estudos */}
              <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-300 flex items-center gap-1.5 text-xs">
                    <MessageCircle className="w-4 h-4 text-emerald-400" />
                    <span>Envio de Planos & Resumos para o WhatsApp</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                    1-Clique & Webhook
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-300 font-medium block mb-1 flex items-center gap-1">
                      <Smartphone className="w-3 h-3 text-emerald-400" />
                      <span>Seu número de WhatsApp (com DDD):</span>
                    </label>
                    <input
                      type="tel"
                      value={whatsappPhone}
                      onChange={(e) => setWhatsappPhone(e.target.value)}
                      placeholder="Ex: (11) 99999-8888"
                      className="w-full text-xs rounded-xl px-3 py-2 bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Ao clicar em "Mandar pro WhatsApp", abre com o plano já formatado.
                    </span>
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-300 font-medium block mb-1">
                      Webhook Opcional (n8n / Evolution API / Z-API):
                    </label>
                    <input
                      type="url"
                      value={whatsappWebhook}
                      onChange={(e) => setWhatsappWebhook(e.target.value)}
                      placeholder="https://seu-servidor-whatsapp/webhook"
                      className="w-full text-xs rounded-xl px-3 py-2 bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={whatsappAutoWebhook}
                        onChange={(e) => setWhatsappAutoWebhook(e.target.checked)}
                        className="rounded text-emerald-500 focus:ring-emerald-400"
                      />
                      <span className="text-[10px] text-slate-300">
                        Disparo 100% automático no webhook ao gerar planos
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400">
                  🛡️ As chaves e modelos ficam salvos de forma segura no seu navegador.
                </span>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-indigo-600 hover:opacity-90 text-white text-xs font-bold cursor-pointer transition shadow flex items-center gap-1.5"
                >
                  {savedKeysSuccess ? <Check className="w-4 h-4" /> : null}
                  <span>{savedKeysSuccess ? 'Salvo!' : 'Salvar Configurações'}</span>
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

        {/* Model Selection Bar & Quick Action Chips */}
        <div
          className={`px-3 py-2 border-b flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0 text-xs ${
            lightMode ? 'bg-slate-100/70 border-slate-200' : 'bg-slate-950/40 border-slate-800'
          }`}
        >
          {/* Active Model Selector */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
              Modelo Ativo:
            </span>
            <select
              value={selectedProvider}
              onChange={(e) => {
                const val = e.target.value as any;
                setSelectedProvider(val);
                saveStoredAiKeys({ activeProviderSelection: val });
              }}
              className={`text-xs rounded-xl px-2.5 py-1.5 border font-semibold focus:outline-none cursor-pointer transition ${
                selectedProvider === 'auto'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40'
              }`}
            >
              <option value="auto">⚡ Auto-Failover (NVIDIA + Gemini + Groq)</option>
              <option value="nvidia">🟢 NVIDIA NIM ({keysConfig.nvidiaModel?.split('/')[1] || 'Llama 3.3'})</option>
              <option value="gemini">🔵 Google Gemini ({keysConfig.geminiModel || '1.5 Flash'})</option>
              <option value="groq">🟠 Groq ({keysConfig.groqModel?.split('-')[0] || 'Llama 3.3'})</option>
              <option value="openrouter">🟣 OpenRouter ({keysConfig.openRouterModel?.split('/')[1] || 'DeepSeek'})</option>
              <option value="openai">⚪ OpenAI ({keysConfig.openAiModel || 'GPT-4o mini'})</option>
            </select>
          </div>

          {/* Quick Action Chips */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() =>
                handleSendMessage(
                  'Por favor, analise todas as falas dos áudios gravados e as fotos/slides desta aula. Organize e sintetize os tópicos mais importantes de forma hierárquica, destacando os conceitos fundamentais que o professor enfatizou.'
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
              <span>📌 Organizar Tópicos</span>
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
              <span>📅 Plano de Estudo</span>
            </button>
          </div>
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
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-emerald-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
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

                      <div className="flex flex-wrap items-center gap-2">
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
                          className="hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition text-indigo-400 font-medium"
                          title="Salvar esta síntese como nota na aula"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          <span>Salvar no Caderno</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSendToWhatsApp(msg.content)}
                          className="hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition text-emerald-400 font-semibold bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-0.5 rounded-lg border border-emerald-500/20"
                          title="Enviar este plano de estudos diretamente para seu WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Mandar pro WhatsApp</span>
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
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-indigo-600 text-white flex items-center justify-center shrink-0 animate-pulse">
                <Sparkles className="w-4 h-4" />
              </div>
              <div
                className={`p-3.5 rounded-2xl rounded-bl-xs text-xs flex items-center gap-2.5 ${
                  lightMode ? 'bg-slate-100 text-slate-700' : 'bg-slate-800 text-slate-300'
                }`}
              >
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                <span>O Tutor IA está consultando o modelo e analisando o conteúdo da aula...</span>
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
              className="p-3 sm:px-4 sm:py-3 rounded-2xl bg-gradient-to-tr from-emerald-600 via-indigo-600 to-purple-600 hover:opacity-90 disabled:opacity-40 text-white font-bold transition cursor-pointer shrink-0 shadow-lg shadow-indigo-600/25 flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline text-xs">Enviar</span>
            </button>
          </form>
        </div>
      </div>

      {/* Modal Rápido para Informar WhatsApp caso não esteja configurado */}
      {showPhonePromptModal && (
        <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-emerald-500/40 p-5 shadow-2xl text-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Enviar para o seu WhatsApp</h3>
                <p className="text-[11px] text-slate-400">Informe seu WhatsApp com DDD para receber o plano de estudo</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-slate-300">WhatsApp (com DDD):</label>
              <input
                type="tel"
                autoFocus
                value={promptPhoneInput}
                onChange={(e) => setPromptPhoneInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmPromptPhone();
                  }
                }}
                placeholder="Ex: 11 99999-8888"
                className="w-full text-sm rounded-xl px-3 py-2.5 bg-slate-950 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-400 block">
                Ficará salvo para envio com 1 clique sempre que você quiser!
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setShowPhonePromptModal(false);
                  setPendingWhatsAppContent(null);
                }}
                className="px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white cursor-pointer transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPromptPhone}
                disabled={!promptPhoneInput.trim()}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white text-xs font-bold cursor-pointer transition shadow-md shadow-emerald-600/25 flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Enviar para WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
