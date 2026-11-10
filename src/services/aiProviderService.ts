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
const KEY_GEMINI = 'noteon_gemini_api_key';
const KEY_GROQ = 'noteon_groq_api_key';
const KEY_OPENROUTER = 'noteon_openrouter_api_key';
const KEY_OPENAI = 'noteon_openai_api_key';

export function getStoredAiKeys(): AiProviderConfig {
  try {
    return {
      geminiApiKey: localStorage.getItem(KEY_GEMINI) || '',
      groqApiKey: localStorage.getItem(KEY_GROQ) || '',
      openRouterApiKey: localStorage.getItem(KEY_OPENROUTER) || '',
      openAiApiKey: localStorage.getItem(KEY_OPENAI) || '',
    };
  } catch {
    return {};
  }
}

export function saveStoredAiKeys(config: Partial<AiProviderConfig>): void {
  try {
    if (config.geminiApiKey !== undefined) {
      if (config.geminiApiKey.trim()) {
        localStorage.setItem(KEY_GEMINI, config.geminiApiKey.trim());
      } else {
        localStorage.removeItem(KEY_GEMINI);
      }
    }

    if (config.groqApiKey !== undefined) {
      if (config.groqApiKey.trim()) {
        localStorage.setItem(KEY_GROQ, config.groqApiKey.trim());
      } else {
        localStorage.removeItem(KEY_GROQ);
      }
    }

    if (config.openRouterApiKey !== undefined) {
      if (config.openRouterApiKey.trim()) {
        localStorage.setItem(KEY_OPENROUTER, config.openRouterApiKey.trim());
      } else {
        localStorage.removeItem(KEY_OPENROUTER);
      }
    }

    if (config.openAiApiKey !== undefined) {
      if (config.openAiApiKey.trim()) {
        localStorage.setItem(KEY_OPENAI, config.openAiApiKey.trim());
      } else {
        localStorage.removeItem(KEY_OPENAI);
      }
    }
  } catch (err) {
    console.warn('Erro ao salvar chaves de IA no localStorage:', err);
  }
}

export interface LessonContext {
  course?: Course | null;
  subject?: Subject | null;
  topic: StudyTopic;
  items: TimelineItem[];
  questions?: StudyQuestion[];
}

// Build a rich contextual prompt from the lesson
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

// 1. Google Gemini API Call
async function callGemini(
  apiKey: string,
  userMessage: string,
  contextPrompt: string,
  samplePhotos: TimelineItem[] = []
): Promise<string> {
  const systemInstruction = `${contextPrompt}\nResponda em português brasileiro com clareza, formatação didática com markdown (tópicos, negrito), foco no aprendizado e retenção para provas.`;

  const parts: any[] = [{ text: systemInstruction }, { text: `Pergunta/Solicitação do aluno:\n${userMessage}` }];

  // Include up to 2 blackboard photos as multimodal inline data if available
  for (const photo of samplePhotos.slice(0, 2)) {
    if (photo.mediaDataUrl && photo.mediaDataUrl.startsWith('data:image/')) {
      const commaIdx = photo.mediaDataUrl.indexOf(',');
      if (commaIdx !== -1) {
        const mime = photo.mediaDataUrl.slice(5, photo.mediaDataUrl.indexOf(';'));
        const base64Data = photo.mediaDataUrl.slice(commaIdx + 1);
        // Only include if size is reasonable (< 3MB base64)
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

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

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

// 2. Groq API Call (Ultra-fast Llama 3.3 70B)
async function callGroq(apiKey: string, userMessage: string, contextPrompt: string): Promise<string> {
  const url = 'https://api.groq.com/openai/v1/chat/completions';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
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

// 3. OpenRouter / OpenAI API Call (DeepSeek V3 / GPT-4o mini)
async function callOpenRouterOrOpenAi(
  apiKey: string,
  userMessage: string,
  contextPrompt: string,
  isOpenAi = false
): Promise<string> {
  const endpoint = isOpenAi
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://openrouter.ai/api/v1/chat/completions';

  const model = isOpenAi ? 'gpt-4o-mini' : 'deepseek/deepseek-chat';

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
      model,
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

// 4. Fallback Local Engine (Pedagogical Linguistic Synthesizer)
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

  // Default pedagogical assistance
  return (
    `Com base nas anotações e áudios da aula **"${topic.title}"**, aqui estão os pontos principais:\n\n` +
    `• Foram identificados **${audios.length} áudios com falas** e **${photos.length} fotos de lousa** registradas.\n` +
    (exams.length > 0 ? `• Existem **${exams.length} itens marcados como prioridade de prova**.\n` : '') +
    `\n💡 **Dica do Tutor:** Você pode clicar nos botões rápidos acima para **"Organizar Tópicos Principais"** ou **"Criar Plano de Estudos da Aula"**, ou fazer qualquer pergunta sobre o conteúdo explicado pelo professor!`
  );
}

// Multi-Model Failover Orchestrator
export async function executeAiStudyRequest(params: {
  userMessage: string;
  context: LessonContext;
  onProviderSwitched?: (provider: AiProviderName, modelLabel: string) => void;
}): Promise<{
  reply: string;
  providerUsed: string;
  usedFailover: boolean;
}> {
  const { userMessage, context, onProviderSwitched } = params;
  const keys = getStoredAiKeys();
  const contextPrompt = buildLessonContextPrompt(context);

  const samplePhotos = context.items.filter((i) => i.type === 'photo');

  // Define providers to try in order of priority
  const providerChain: Array<{
    name: AiProviderName;
    label: string;
    hasKey: boolean;
    runner: () => Promise<string>;
  }> = [
    {
      name: 'gemini',
      label: 'Google Gemini 1.5 Flash (Multimodal)',
      hasKey: Boolean(keys.geminiApiKey?.trim()),
      runner: () => callGemini(keys.geminiApiKey!.trim(), userMessage, contextPrompt, samplePhotos),
    },
    {
      name: 'groq',
      label: 'Groq (Llama 3.3 70B Ultra Rápido)',
      hasKey: Boolean(keys.groqApiKey?.trim()),
      runner: () => callGroq(keys.groqApiKey!.trim(), userMessage, contextPrompt),
    },
    {
      name: 'openrouter',
      label: 'OpenRouter (DeepSeek V3 / Multimodel)',
      hasKey: Boolean(keys.openRouterApiKey?.trim()),
      runner: () => callOpenRouterOrOpenAi(keys.openRouterApiKey!.trim(), userMessage, contextPrompt, false),
    },
    {
      name: 'openai',
      label: 'OpenAI (GPT-4o mini)',
      hasKey: Boolean(keys.openAiApiKey?.trim()),
      runner: () => callOpenRouterOrOpenAi(keys.openAiApiKey!.trim(), userMessage, contextPrompt, true),
    },
  ];

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
      console.warn(`[NoteOn AI] Provedor ${prov.name} falhou ou limite excedido:`, err.message);
      // Automatically fall over to next provider in chain!
      continue;
    }
  }

  // If no API keys were configured or all active keys hit rate limit / quota
  const localReply = generateLocalStudyAssistantReply(userMessage, context);

  return {
    reply: localReply,
    providerUsed: lastError ? 'Tutor NoteOn Local (Fallback Automático)' : 'Tutor NoteOn Local',
    usedFailover: attempts > 0,
  };
}

