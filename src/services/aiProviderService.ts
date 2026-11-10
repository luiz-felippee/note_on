import {
  AiProviderName,
  AiProviderConfig,
  ChatMessage,
  Course,
  Subject,
  StudyTopic,
  TimelineItem,
  StudyQuestion,
} from '../types';

// Storage keys
const KEY_NVIDIA = 'noteon_nvidia_api_key';
const KEY_NVIDIA_MODEL = 'noteon_nvidia_model';
const KEY_GEMINI = 'noteon_gemini_api_key';
const KEY_GEMINI_MODEL = 'noteon_gemini_model';
const KEY_GROQ = 'noteon_groq_api_key';
const KEY_GROQ_MODEL = 'noteon_groq_model';
const KEY_OPENROUTER = 'noteon_openrouter_api_key';
const KEY_OPENROUTER_MODEL = 'noteon_openrouter_model';
const KEY_OPENAI = 'noteon_openai_api_key';
const KEY_OPENAI_MODEL = 'noteon_openai_model';
const KEY_ACTIVE_SELECTION = 'noteon_active_provider_selection';

export const AVAILABLE_MODELS = {
  nvidia: [
    { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct (Recomendado)', desc: 'Excelente raciocínio e síntese' },
    { id: 'deepseek-ai/deepseek-r1', name: 'DeepSeek R1 (Raciocínio Lógico)', desc: 'Raciocínio profundo com cadeia de pensamento' },
    { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'NVIDIA Nemotron 70B', desc: 'Modelo otimizado pela NVIDIA' },
    { id: 'meta/llama-3.1-405b-instruct', name: 'Llama 3.1 405B Instruct', desc: 'Maior modelo de código aberto do mundo' },
    { id: 'mistralai/mistral-large-2-instruct', name: 'Mistral Large 2', desc: 'Ótimo entendimento de português' },
  ],
  gemini: [
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Recomendado)', desc: 'Multimodal veloz com análise de imagens e lousas' },
    { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)', desc: 'Nova geração ultra veloz da Google' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', desc: 'Raciocínio profundo e grande janela' },
    { id: 'gemini-1.5-flash-8b', name: 'Gemini 1.5 Flash-8B', desc: 'Mais leve e econômico' },
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile (Recomendado)', desc: '300+ tokens/s instantâneo' },
    { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B', desc: 'Raciocínio veloz no Groq LPU' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', desc: 'Respostas em frações de segundo' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (32k context)', desc: 'Mistura de especialistas' },
  ],
  openrouter: [
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', desc: 'Raciocínio lógico avançado' },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', desc: 'Geral de alta performance' },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B', desc: 'Meta open weights' },
    { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku', desc: 'Velocidade e precisão' },
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o mini (Recomendado)', desc: 'Rápido, equilibrado e confiável' },
    { id: 'gpt-4o', name: 'GPT-4o (Completo)', desc: 'Modelo topo de linha' },
    { id: 'o3-mini', name: 'o3-mini (Raciocínio STEM)', desc: 'Especialista em ciências e exatas' },
  ],
};

export function getStoredAiKeys(): AiProviderConfig {
  try {
    return {
      nvidiaApiKey: localStorage.getItem(KEY_NVIDIA) || '',
      nvidiaModel: localStorage.getItem(KEY_NVIDIA_MODEL) || AVAILABLE_MODELS.nvidia[0].id,
      geminiApiKey: localStorage.getItem(KEY_GEMINI) || '',
      geminiModel: localStorage.getItem(KEY_GEMINI_MODEL) || AVAILABLE_MODELS.gemini[0].id,
      groqApiKey: localStorage.getItem(KEY_GROQ) || '',
      groqModel: localStorage.getItem(KEY_GROQ_MODEL) || AVAILABLE_MODELS.groq[0].id,
      openRouterApiKey: localStorage.getItem(KEY_OPENROUTER) || '',
      openRouterModel: localStorage.getItem(KEY_OPENROUTER_MODEL) || AVAILABLE_MODELS.openrouter[0].id,
      openAiApiKey: localStorage.getItem(KEY_OPENAI) || '',
      openAiModel: localStorage.getItem(KEY_OPENAI_MODEL) || AVAILABLE_MODELS.openai[0].id,
      activeProviderSelection:
        (localStorage.getItem(KEY_ACTIVE_SELECTION) as any) || 'auto',
    };
  } catch {
    return {};
  }
}

export function saveStoredAiKeys(config: Partial<AiProviderConfig>): void {
  try {
    if (config.nvidiaApiKey !== undefined) {
      if (config.nvidiaApiKey.trim()) localStorage.setItem(KEY_NVIDIA, config.nvidiaApiKey.trim());
      else localStorage.removeItem(KEY_NVIDIA);
    }
    if (config.nvidiaModel !== undefined) localStorage.setItem(KEY_NVIDIA_MODEL, config.nvidiaModel);

    if (config.geminiApiKey !== undefined) {
      if (config.geminiApiKey.trim()) localStorage.setItem(KEY_GEMINI, config.geminiApiKey.trim());
      else localStorage.removeItem(KEY_GEMINI);
    }
    if (config.geminiModel !== undefined) localStorage.setItem(KEY_GEMINI_MODEL, config.geminiModel);

    if (config.groqApiKey !== undefined) {
      if (config.groqApiKey.trim()) localStorage.setItem(KEY_GROQ, config.groqApiKey.trim());
      else localStorage.removeItem(KEY_GROQ);
    }
    if (config.groqModel !== undefined) localStorage.setItem(KEY_GROQ_MODEL, config.groqModel);

    if (config.openRouterApiKey !== undefined) {
      if (config.openRouterApiKey.trim()) localStorage.setItem(KEY_OPENROUTER, config.openRouterApiKey.trim());
      else localStorage.removeItem(KEY_OPENROUTER);
    }
    if (config.openRouterModel !== undefined) localStorage.setItem(KEY_OPENROUTER_MODEL, config.openRouterModel);

    if (config.openAiApiKey !== undefined) {
      if (config.openAiApiKey.trim()) localStorage.setItem(KEY_OPENAI, config.openAiApiKey.trim());
      else localStorage.removeItem(KEY_OPENAI);
    }
    if (config.openAiModel !== undefined) localStorage.setItem(KEY_OPENAI_MODEL, config.openAiModel);

    if (config.activeProviderSelection !== undefined) {
      localStorage.setItem(KEY_ACTIVE_SELECTION, config.activeProviderSelection);
    }
  } catch (err) {
    console.warn('Erro ao salvar chaves e modelos no localStorage:', err);
  }
}

export interface LessonContext {
  course?: Course | null;
  subject?: Subject | null;
  topic: StudyTopic;
  items: TimelineItem[];
  questions?: StudyQuestion[];
}

export function buildLessonContextPrompt(ctx: LessonContext): string {
  const { subject, topic, items } = ctx;

  const audios = items.filter((i) => i.type === 'audio');
  const photos = items.filter((i) => i.type === 'photo');
  const notes = items.filter((i) => i.type === 'text');

  let text = `Você é o Tutor de Estudos Inteligente do NoteOn.\n`;
  text += `Contexto da aula atual:\n`;
  text += `- Disciplina: ${subject?.name || 'Geral'}\n`;
  text += `- Título da Aula: ${topic.title}\n`;
  if (topic.summary) {
    text += `- Resumo inicial: ${topic.summary}\n`;
  }
  text += `- Data: ${topic.date} (${topic.startTime})\n\n`;

  // Audios & Transcripts
  text += `### Gravações de Áudio e Falas do Professor (${audios.length}):\n`;
  if (audios.length === 0) {
    text += `(Nenhum áudio gravado ainda nesta aula)\n\n`;
  } else {
    audios.forEach((a, idx) => {
      text += `Áudio #${idx + 1} [${a.timeLabel}] "${a.title || 'Gravação'}":\n`;
      if (a.transcript) {
        text += `Transcrição da fala: "${a.transcript}"\n`;
      } else if (a.content) {
        text += `Conteúdo: ${a.content}\n`;
      } else {
        text += `(Áudio gravado sem transcrição de fala disponível)\n`;
      }
      text += `\n`;
    });
  }

  // Photos & Slides
  text += `### Fotos de Lousa e Slides Capturados (${photos.length}):\n`;
  if (photos.length === 0) {
    text += `(Nenhuma foto ou slide capturado)\n\n`;
  } else {
    photos.forEach((p, idx) => {
      text += `Foto #${idx + 1} [${p.timeLabel}] "${p.title || 'Slide/Lousa'}":\n`;
      if (p.lectureRelativeTimestamp) {
        text += `Momento do áudio: ${p.lectureRelativeTimestamp}\n`;
      }
      if (p.content) {
        text += `Descrição/Anotação do slide: ${p.content}\n`;
      }
      text += `\n`;
    });
  }

  // Text Notes
  if (notes.length > 0) {
    text += `### Anotações em Texto dos Estudantes (${notes.length}):\n`;
    notes.forEach((n, idx) => {
      text += `Nota #${idx + 1} [${n.timeLabel}]: ${n.title ? `${n.title} - ` : ''}${n.content}\n`;
    });
    text += `\n`;
  }

  return text;
}

// 1. NVIDIA NIM API Call (https://integrate.api.nvidia.com)
async function callNvidia(
  apiKey: string,
  model: string,
  userMessage: string,
  contextPrompt: string
): Promise<string> {
  const url = 'https://integrate.api.nvidia.com/v1/chat/completions';
  const targetModel = model || 'meta/llama-3.3-70b-instruct';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model: targetModel,
      messages: [
        {
          role: 'system',
          content: `${contextPrompt}\nVocê é o Tutor de Estudos NoteOn alimentado pela plataforma NVIDIA AI. Responda em português brasileiro com formatação clara em markdown (tópicos, negrito), foco didático e retenção para provas.`,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
      temperature: 0.4,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`NVIDIA API Error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content;

  if (!reply) {
    throw new Error('NVIDIA retornou resposta vazia.');
  }

  return reply.trim();
}

// 2. Google Gemini API Call (Multimodal with images)
async function callGemini(
  apiKey: string,
  model: string,
  userMessage: string,
  contextPrompt: string,
  samplePhotos: TimelineItem[] = []
): Promise<string> {
  const targetModel = model || 'gemini-1.5-flash';
  const systemInstruction = `${contextPrompt}\nResponda em português brasileiro com clareza, formatação didática com markdown (tópicos, negrito), foco no aprendizado e retenção para provas.`;

  const parts: any[] = [{ text: systemInstruction }, { text: `Pergunta/Solicitação do aluno:\n${userMessage}` }];

  // Include up to 2 blackboard photos as multimodal inline data if available
  for (const photo of samplePhotos.slice(0, 2)) {
    if (photo.mediaDataUrl && photo.mediaDataUrl.startsWith('data:image/')) {
      const commaIdx = photo.mediaDataUrl.indexOf(',');
      if (commaIdx !== -1) {
        const mime = photo.mediaDataUrl.slice(5, photo.mediaDataUrl.indexOf(';'));
        const base64Data = photo.mediaDataUrl.slice(commaIdx + 1);
        if (base64Data.length < 4_000_000) {
          parts.push({
            inlineData: {
              mimeType: mime || 'image/jpeg',
              data: base64Data,
            },
          });
        }
      }
    }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API Error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const candidate = data.candidates?.[0];
  const responseText = candidate?.content?.parts?.[0]?.text;

  if (!responseText) {
    throw new Error('Gemini retornou resposta vazia.');
  }

  return responseText.trim();
}

// 3. Groq API Call (Ultra-fast)
async function callGroq(
  apiKey: string,
  model: string,
  userMessage: string,
  contextPrompt: string
): Promise<string> {
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const targetModel = model || 'llama-3.3-70b-versatile';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: targetModel,
      messages: [
        {
          role: 'system',
          content: `${contextPrompt}\nVocê é o Tutor de Estudos do NoteOn. Responda em português brasileiro com excelente formatação didática, tópicos destacados e orientação de estudo.`,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
      temperature: 0.4,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Groq API Error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content;

  if (!reply) {
    throw new Error('Groq retornou resposta vazia.');
  }

  return reply.trim();
}

// 4. OpenRouter / OpenAI API Call
async function callOpenRouterOrOpenAi(
  apiKey: string,
  model: string,
  userMessage: string,
  contextPrompt: string,
  isOpenAi = false
): Promise<string> {
  const endpoint = isOpenAi
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions';

  const targetModel = model || (isOpenAi ? 'gpt-4o-mini' : 'deepseek/deepseek-r1');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  if (!isOpenAi) {
    headers['HTTP-Referer'] = 'https://noteon.app';
    headers['X-Title'] = 'NoteOn Study Assistant';
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: targetModel,
      messages: [
        {
          role: 'system',
          content: `${contextPrompt}\nVocê é o Tutor Pedagógico NoteOn. Ajude o estudante a sintetizar os conteúdos, organizar planos de estudo e tirar dúvidas. Responda em português com markdown.`,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
      temperature: 0.4,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OpenRouter/OpenAI API Error (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content;

  if (!reply) {
    throw new Error('Provedor retornou resposta vazia.');
  }

  return reply.trim();
}

// 5. Fallback Local Engine (Offline)
function generateLocalStudyAssistantReply(
  userMessage: string,
  ctx: LessonContext
): string {
  const { topic, items, subject } = ctx;
  const audios = items.filter((i) => i.type === 'audio');
  const photos = items.filter((i) => i.type === 'photo');
  const exams = items.filter((i) => i.importantForExam);

  const lower = userMessage.toLowerCase();

  // If user asked for study plan
  if (lower.includes('plano') || lower.includes('cronograma') || lower.includes('estudo')) {
    let plan = `### 📅 Plano de Estudos Estruturado: ${topic.title}\n`;
    plan += `**Disciplina:** ${subject?.name || 'Geral'} • **Total de Materiais:** ${audios.length} áudios, ${photos.length} fotos e ${items.length} itens registrados.\n\n`;

    plan += `#### 🟢 Etapa 1: Assimilação Ativa (Hoje - 30 a 45 min)\n`;
    if (audios.length > 0) {
      plan += `1. **Ouvir os trechos-chave dos áudios:**\n`;
      audios.forEach((a, i) => {
        plan += `   - **Áudio #${i + 1} (${a.timeLabel}):** Reouvir e validar os termos principais: *${a.transcript?.slice(0, 80) || a.title}*.\n`;
      });
    }
    if (photos.length > 0) {
      plan += `2. **Revisão dos Slides/Lousas capturados:**\n`;
      photos.forEach((p, i) => {
        plan += `   - **Foto #${i + 1} (${p.timeLabel}):** Explicar para si mesmo o diagrama/conteúdo de *${p.title || 'Slide'}*.\n`;
      });
    }
    plan += `\n`;

    plan += `#### 🟡 Etapa 2: Recuperação Ativa SM-2 (D+1 - Amanhã)\n`;
    plan += `- Sem olhar as anotações, escreva em 1 folha os 3 conceitos fundamentais discutidos nesta aula.\n`;
    plan += `- Teste seus conhecimentos respondendo às questões de estudo geradas no NoteOn.\n\n`;

    plan += `#### 🟣 Etapa 3: Fixação de Longo Prazo (D+7 e D+14)\n`;
    plan += `- Foco nos itens marcados com ⭐ **IMPORTANTE PARA A PROVA** (${exams.length} itens destacados).\n`;
    plan += `- Prática espaçada com os flashcards do NoteOn.\n`;

    return plan;
  }

  // If user asked to organize topics
  if (lower.includes('topico') || lower.includes('tópico') || lower.includes('organizar') || lower.includes('resumo')) {
    let summary = `### 📌 Síntese dos Tópicos Mais Importantes da Aula\n\n`;
    summary += `**Aula:** ${topic.title} (${subject?.name || 'Disciplina'})\n\n`;

    if (audios.length > 0) {
      summary += `#### 🎙️ Pontos Centrais Abordados pelo Professor (Áudios):\n`;
      audios.forEach((a, i) => {
        summary += `- **Tópico ${i + 1} [${a.timeLabel}]:** ${a.title || 'Explicação em áudio'}\n`;
        if (a.transcript) {
          summary += `  *Trecho da fala:* "${a.transcript}"\n`;
        }
      });
      summary += `\n`;
    }

    if (photos.length > 0) {
      summary += `#### 📸 Evidências Visuais e Esquemas de Lousa:\n`;
      photos.forEach((p, i) => {
        summary += `- **Slide/Esquema ${i + 1} [${p.timeLabel}]:** ${p.title || 'Esquema gráfico'}\n`;
        if (p.content) summary += `  *Nota:* ${p.content}\n`;
      });
      summary += `\n`;
    }

    if (exams.length > 0) {
      summary += `#### ⭐ Atenção Especial para a Prova:\n`;
      exams.forEach((ex) => {
        summary += `- **[${ex.timeLabel}] ${ex.title || 'Tópico de Prova'}:** ${ex.content || ex.transcript || 'Revisar com prioridade máxima.'}\n`;
      });
    }

    return summary;
  }

  return (
    `Com base nas anotações e áudios da aula **"${topic.title}"**, aqui estão os pontos principais:\n\n` +
    `• Foram identificados **${audios.length} áudios com falas** e **${photos.length} fotos de lousa** registradas.\n` +
    (exams.length > 0 ? `• Existem **${exams.length} itens marcados como prioridade de prova**.\n` : '') +
    `\n💡 **Dica do Tutor:** Você pode clicar nos botões rápidos acima para **"Organizar Tópicos Principais"** ou **"Criar Plano de Estudos da Aula"**, ou fazer qualquer pergunta sobre o conteúdo explicado pelo professor!`
  );
}

// Multi-Model Failover Orchestrator with NVIDIA, Gemini, Groq, OpenRouter, OpenAI
export async function executeAiStudyRequest(params: {
  userMessage: string;
  context: LessonContext;
  selectedProvider?: 'auto' | AiProviderName;
  onProviderSwitched?: (provider: AiProviderName, modelLabel: string) => void;
}): Promise<{
  reply: string;
  providerUsed: string;
  usedFailover: boolean;
}> {
  const { userMessage, context, selectedProvider = 'auto', onProviderSwitched } = params;
  const keys = getStoredAiKeys();
  const contextPrompt = buildLessonContextPrompt(context);

  const samplePhotos = context.items.filter((i) => i.type === 'photo');

  // Define full chain of supported providers
  const allProviders: Array<{
    name: AiProviderName;
    label: string;
    hasKey: boolean;
    runner: () => Promise<string>;
  }> = [
    {
      name: 'nvidia',
      label: `NVIDIA NIM (${keys.nvidiaModel || 'Llama 3.3 70B'})`,
      hasKey: Boolean(keys.nvidiaApiKey?.trim()),
      runner: () =>
        callNvidia(
          keys.nvidiaApiKey!.trim(),
          keys.nvidiaModel || 'meta/llama-3.3-70b-instruct',
          userMessage,
          contextPrompt
        ),
    },
    {
      name: 'gemini',
      label: `Google Gemini (${keys.geminiModel || '1.5 Flash'})`,
      hasKey: Boolean(keys.geminiApiKey?.trim()),
      runner: () =>
        callGemini(
          keys.geminiApiKey!.trim(),
          keys.geminiModel || 'gemini-1.5-flash',
          userMessage,
          contextPrompt,
          samplePhotos
        ),
    },
    {
      name: 'groq',
      label: `Groq (${keys.groqModel || 'Llama 3.3 70B'})`,
      hasKey: Boolean(keys.groqApiKey?.trim()),
      runner: () =>
        callGroq(
          keys.groqApiKey!.trim(),
          keys.groqModel || 'llama-3.3-70b-versatile',
          userMessage,
          contextPrompt
        ),
    },
    {
      name: 'openrouter',
      label: `OpenRouter (${keys.openRouterModel || 'DeepSeek'})`,
      hasKey: Boolean(keys.openRouterApiKey?.trim()),
      runner: () =>
        callOpenRouterOrOpenAi(
          keys.openRouterApiKey!.trim(),
          keys.openRouterModel || 'deepseek/deepseek-r1',
          userMessage,
          contextPrompt,
          false
        ),
    },
    {
      name: 'openai',
      label: `OpenAI (${keys.openAiModel || 'GPT-4o mini'})`,
      hasKey: Boolean(keys.openAiApiKey?.trim()),
      runner: () =>
        callOpenRouterOrOpenAi(
          keys.openAiApiKey!.trim(),
          keys.openAiModel || 'gpt-4o-mini',
          userMessage,
          contextPrompt,
          true
        ),
    },
  ];

  // If user selected a specific provider explicitly, try it first
  let providerChain = allProviders;
  if (selectedProvider && selectedProvider !== 'auto') {
    const chosen = allProviders.find((p) => p.name === selectedProvider);
    const others = allProviders.filter((p) => p.name !== selectedProvider);
    providerChain = chosen ? [chosen, ...others] : allProviders;
  }

  let attempts = 0;
  let lastError: any = null;

  for (const prov of providerChain) {
    if (!prov.hasKey) continue;

    try {
      attempts++;
      if (onProviderSwitched && attempts > 1) {
        onProviderSwitched(prov.name, prov.label);
      }

      const reply = await prov.runner();
      return {
        reply,
        providerUsed: prov.label,
        usedFailover: attempts > 1,
      };
    } catch (err: any) {
      lastError = err;
      console.warn(`[NoteOn AI] Provedor ${prov.name} (${prov.label}) falhou:`, err.message);
      // Auto-failover: jump to next provider seamlessly!
      continue;
    }
  }

  // Fallback to local engine if no keys configured or all providers exhausted
  const localReply = generateLocalStudyAssistantReply(userMessage, context);

  return {
    reply: localReply,
    providerUsed: lastError ? 'Tutor NoteOn Local (Fallback Automático)' : 'Tutor NoteOn Local',
    usedFailover: attempts > 0,
  };
}
