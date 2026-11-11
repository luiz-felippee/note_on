import { StudyQuestion, QuestionType } from '../types';
import { getStoredAiKeys } from './aiProviderService';

const GEMINI_STORAGE_KEY = 'noteon_gemini_api_key';

export function getGeminiApiKey(): string {
  try {
    const direct = localStorage.getItem(GEMINI_STORAGE_KEY) || '';
    if (direct.trim()) return direct.trim();
    const multi = getStoredAiKeys();
    return (multi.geminiApiKey || '').trim();
  } catch {
    return '';
  }
}

export function saveGeminiApiKey(apiKey: string): void {
  try {
    if (apiKey.trim()) {
      localStorage.setItem(GEMINI_STORAGE_KEY, apiKey.trim());
    } else {
      localStorage.removeItem(GEMINI_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('Erro ao salvar chave Gemini no localStorage:', err);
  }
}

interface GenerateParams {
  transcript: string;
  topicTitle: string;
  subjectName?: string;
  audioItemId?: string;
  topicId: string;
  subjectId: string;
  courseId?: string;
}

/**
 * Limpa trechos corridos (sem pontuação) vindos do Web Speech API e limita ao tamanho máximo
 * sem cortar palavras ao meio.
 */
export function formatConciseText(raw: string, maxChars: number = 95, addEllipsis = false): string {
  if (!raw) return '';
  let text = raw
    .replace(/\s+/g, ' ')
    .replace(/^(né|tá|então|aí|tipo|bom|bem|olha|veja|assim|e|mas|ou)\b[,.\s]*/i, '')
    .trim();

  if (!text) return '';

  if (text.length > maxChars) {
    const sliced = text.slice(0, maxChars);
    const lastSpace = sliced.lastIndexOf(' ');
    text = lastSpace > maxChars * 0.55 ? sliced.slice(0, lastSpace) : sliced;
    // Remove preposições/conjunções soltas no final
    text = text
      .replace(/\s+(de|da|do|das|dos|em|na|no|nas|nos|com|para|por|que|se|e|ou|mas|como|quando|onde)$/i, '')
      .trim();
    if (addEllipsis) {
      text = `${text.replace(/[.,;:!?]+$/, '')}...`;
    }
  }

  // Capitalize first letter
  text = text.charAt(0).toUpperCase() + text.slice(1);
  return text;
}

/**
 * Divide transcrições contínuas (mesmo sem pontos finais do reconhecimento de voz)
 * em ideias curtas e independentes de 8 a 16 palavras.
 */
export function splitTranscriptIntoIdeas(transcript: string): string[] {
  const cleaned = transcript.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  // 1. Primeiro divide por pontuação caso exista
  const roughParts = cleaned
    .split(/[.!?;:\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // 2. Subdivide blocos longos usando conectivos naturais da fala em português
  const connectorRegex =
    /\s+(?=porque\b|pois\b|portanto\b|então\b|ou seja\b|além disso\b|por exemplo\b|significa\b|consiste\b|importante\b|lembrem\b|quando\b|onde\b|enquanto\b|sendo que\b|já que\b|dessa forma\b|nesse sentido\b|basicamente\b|primeiro\b|segundo\b|agora\b)/i;

  const mediumParts: string[] = [];
  for (const part of roughParts) {
    if (part.length <= 95) {
      mediumParts.push(part);
    } else {
      const sub = part
        .split(connectorRegex)
        .map((s) => s.trim())
        .filter(Boolean);
      mediumParts.push(...sub);
    }
  }

  // 3. Se ainda houver blocos sem conectivos (> 95 chars), divide a cada ~13 palavras
  const finalIdeas: string[] = [];
  for (const part of mediumParts) {
    const words = part.split(' ').filter(Boolean);
    if (words.length <= 15 && part.length <= 100) {
      if (words.length >= 4) {
        finalIdeas.push(formatConciseText(part, 90, false));
      }
    } else {
      const chunkSize = 13;
      for (let i = 0; i < words.length; i += chunkSize) {
        const chunk = words.slice(i, i + chunkSize).join(' ');
        if (chunk.split(' ').length >= 4) {
          finalIdeas.push(formatConciseText(chunk, 90, false));
        }
      }
    }
  }

  // Remove duplicados mantendo ordem
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const idea of finalIdeas) {
    const key = idea.toLowerCase();
    if (!seen.has(key) && idea.length >= 15) {
      seen.add(key);
      unique.push(idea);
    }
  }

  if (unique.length === 0 && cleaned.length > 0) {
    unique.push(formatConciseText(cleaned, 85, false));
  }

  return unique;
}

/**
 * Organiza e enxuga qualquer questão (nova ou já salva anteriormente no banco)
 * para garantir que enunciado, alternativas, citação e resposta sejam sempre curtos e bem organizados.
 */
export function sanitizeAndOrganizeQuestion(
  q: StudyQuestion,
  topicTitle: string = 'Aula',
  subjectName: string = 'Disciplina'
): StudyQuestion {
  const shortTopic = formatConciseText(topicTitle, 42, false);
  const shortSubject = formatConciseText(subjectName, 32, false);

  // 1. Enunciado curto e direto (máx 125 caracteres)
  let cleanPrompt = (q.prompt || '').replace(/\s+/g, ' ').trim();
  if (cleanPrompt.length > 130) {
    cleanPrompt = formatConciseText(cleanPrompt, 120, false);
    if (!cleanPrompt.endsWith('?') && !cleanPrompt.endsWith(':')) {
      cleanPrompt += '?';
    }
  }

  // 2. Trecho do professor curto (máx 95 caracteres)
  let cleanQuote = q.teacherQuoteSnippet ? formatConciseText(q.teacherQuoteSnippet, 90, true) : undefined;

  // 3. Alternativas curtas e equilibradas (máx 88 caracteres cada)
  let cleanOptions = q.options;
  if (q.type === 'multiple_choice' && Array.isArray(q.options) && q.options.length > 0) {
    cleanOptions = q.options.map((opt) => {
      const cleanedOpt = opt.replace(/^["'«»]+|["'«»]+$/g, '').trim();
      if (cleanedOpt.length <= 92) {
        const formatted = formatConciseText(cleanedOpt, 92, false);
        return formatted.endsWith('.') ? formatted : `${formatted}.`;
      }
      const ideas = splitTranscriptIntoIdeas(cleanedOpt);
      const bestIdea = ideas[0] || formatConciseText(cleanedOpt, 82, false);
      return bestIdea.endsWith('.') ? bestIdea : `${bestIdea}.`;
    });
  }

  // 4. Gabarito / Resposta curta e estruturada em tópicos
  let cleanExplanation = (q.explanation || '').trim();
  const isAlreadyStructured =
    cleanExplanation.includes('✅') && cleanExplanation.length <= 230;

  if (!isAlreadyStructured) {
    // Extrai a ideia central sem repetir um texto gigante
    const rawCore = cleanExplanation
      .replace(/^Conforme enfatizado na fala gravada:\s*/i, '')
      .replace(/^Gabarito esperado:\s*/i, '')
      .replace(/^O professor destacou o seguinte raciocínio central:\s*/i, '')
      .replace(/^O professor vinculou a aplicação prática diretamente a:\s*/i, '')
      .replace(/["“”]/g, '')
      .trim();

    const coreIdeas = splitTranscriptIntoIdeas(rawCore);
    const mainPoint =
      coreIdeas[0] ||
      (cleanQuote ? cleanQuote.replace(/\.\.\.$/, '') : `Conceito central de ${shortTopic}`);
    const secondPoint =
      coreIdeas[1] && coreIdeas[1] !== mainPoint
        ? coreIdeas[1]
        : `Fundamento essencial de ${shortTopic} em ${shortSubject}`;

    cleanExplanation = `✅ Resposta direta: ${formatConciseText(mainPoint, 90, false)}.\n📌 Ponto-chave: ${formatConciseText(secondPoint, 90, false)}.`;
  }

  return {
    ...q,
    prompt: cleanPrompt,
    options: cleanOptions,
    explanation: cleanExplanation,
    teacherQuoteSnippet: cleanQuote,
  };
}

export async function generateQuestionsFromTranscript(
  params: GenerateParams
): Promise<StudyQuestion[]> {
  const { transcript, topicTitle, subjectName, audioItemId, topicId, subjectId, courseId } =
    params;
  const cleanTranscript = transcript.trim();

  if (!cleanTranscript || cleanTranscript.length < 15) {
    throw new Error('A transcrição é muito curta para formular perguntas sobre a aula.');
  }

  const apiKey = getGeminiApiKey();

  // Try Gemini AI API if key is configured
  if (apiKey) {
    try {
      const aiQuestions = await callGeminiApi({
        apiKey,
        transcript: cleanTranscript,
        topicTitle,
        subjectName: subjectName || 'Aula',
      });

      if (aiQuestions && aiQuestions.length > 0) {
        return aiQuestions.map((q, idx) =>
          sanitizeAndOrganizeQuestion(
            {
              id: `question-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
              topicId,
              subjectId,
              courseId,
              audioItemId,
              type: q.type || 'multiple_choice',
              prompt: q.prompt,
              options: q.options && q.options.length >= 2 ? q.options : undefined,
              correctOptionIndex:
                typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0,
              explanation:
                q.explanation || 'Explicação baseada nos pontos-chave da aula.',
              teacherQuoteSnippet:
                q.teacherQuoteSnippet || formatConciseText(cleanTranscript, 85, true),
              createdAt: Date.now() + idx,
            },
            topicTitle,
            subjectName || 'Aula'
          )
        );
      }
    } catch (err) {
      console.warn('Falha na chamada ao Gemini API, usando gerador linguístico local:', err);
    }
  }

  // Local Smart Linguistic Generator (Works 100% offline with zero setup)
  return generateLocalLinguisticQuestions({
    transcript: cleanTranscript,
    topicTitle,
    subjectName: subjectName || 'Aula',
    audioItemId,
    topicId,
    subjectId,
    courseId,
  });
}

// Gemini REST API Integration with strict conciseness rules
async function callGeminiApi(args: {
  apiKey: string;
  transcript: string;
  topicTitle: string;
  subjectName: string;
}): Promise<
  Array<{
    type: QuestionType;
    prompt: string;
    options?: string[];
    correctOptionIndex?: number;
    explanation: string;
    teacherQuoteSnippet?: string;
  }>
> {
  const prompt = `Você é um professor especialista em criar questões objetivas, curtas e muito bem organizadas.
Tema da aula: "${args.topicTitle}" (${args.subjectName}).
Transcrição da aula:
"""
${args.transcript.slice(0, 3500)}
"""

Crie 3 questões (2 de múltipla escolha e 1 discursiva) seguindo RIGOROSAMENTE estas regras de tamanho e organização:
1. "prompt" (Pergunta): Direta, clara e curta (MÁXIMO 110 caracteres, apenas 1 frase).
2. "options" (Alternativas): 4 opções curtas e equilibradas (MÁXIMO 80 caracteres cada). Varie "correctOptionIndex" entre 0, 1, 2 e 3.
3. "explanation" (Resposta/Gabarito): Curta, direta e dividida em 2 tópicos (MÁXIMO 170 caracteres no total):
   "✅ Resposta direta: [1 frase curta]\n📌 Ponto-chave: [1 frase curta]"
4. "teacherQuoteSnippet": Trecho curto da fala (MÁXIMO 80 caracteres).

Retorne APENAS um array JSON válido:
[
  {
    "type": "multiple_choice",
    "prompt": "Qual é a função principal de...",
    "options": ["Opção A curta.", "Opção B curta.", "Opção C curta.", "Opção D curta."],
    "correctOptionIndex": 1,
    "explanation": "✅ Resposta direta: ...\n📌 Ponto-chave: ...",
    "teacherQuoteSnippet": "Trecho curto..."
  }
]`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${args.apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.25,
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errorText}`);
  }

  const json = await res.json();
  const textOutput = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!textOutput) {
    throw new Error('Resposta vazia da API Gemini.');
  }

  let cleaned = textOutput.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
  }

  return JSON.parse(cleaned);
}

/**
 * Embaralha as alternativas de forma determinística e retorna as opções + índice correto
 */
function buildBalancedOptions(
  correctText: string,
  distractors: string[],
  seed: number
): { options: string[]; correctOptionIndex: number } {
  const cleanCorrect = `${formatConciseText(correctText, 82, false).replace(/[.]+$/, '')}.`;
  const cleanDistractors = distractors
    .slice(0, 3)
    .map((d) => `${formatConciseText(d, 82, false).replace(/[.]+$/, '')}.`);

  const targetIndex = Math.abs(seed) % 4;
  const options: string[] = [];
  let dIdx = 0;

  for (let i = 0; i < 4; i++) {
    if (i === targetIndex) {
      options.push(cleanCorrect);
    } else {
      options.push(cleanDistractors[dIdx++] || 'Conceito não relacionado ao tema.');
    }
  }

  return { options, correctOptionIndex: targetIndex };
}

// Local Linguistic Semantic Question Generator (Concise & Well-Organized)
function generateLocalLinguisticQuestions(args: {
  transcript: string;
  topicTitle: string;
  subjectName: string;
  audioItemId?: string;
  topicId: string;
  subjectId: string;
  courseId?: string;
}): StudyQuestion[] {
  const { transcript, topicTitle, subjectName, audioItemId, topicId, subjectId, courseId } = args;

  const shortTopic = formatConciseText(topicTitle, 40, false);
  const shortSubject = formatConciseText(subjectName, 30, false);

  const ideas = splitTranscriptIntoIdeas(transcript);

  const causalKeywords = [
    'porque',
    'pois',
    'portanto',
    'ou seja',
    'significa',
    'importante',
    'lembrem',
    'defin',
    'consiste',
    'diferença',
    'função',
    'processo',
    'regra',
    'exemplo',
    'objetivo',
  ];

  const keyIdeas = ideas.filter((s) =>
    causalKeywords.some((kw) => s.toLowerCase().includes(kw))
  );

  const idea1 = keyIdeas[0] || ideas[0] || formatConciseText(transcript, 80, false);
  const idea2 =
    keyIdeas[1] ||
    ideas[1] ||
    ideas[Math.floor(ideas.length / 2)] ||
    idea1;
  const idea3 =
    ideas[ideas.length - 1] !== idea1 && ideas[ideas.length - 1] !== idea2
      ? ideas[ideas.length - 1]
      : ideas[2] || idea2;

  const questions: StudyQuestion[] = [];
  const baseTime = Date.now();

  // 1. Questão 1 (Múltipla Escolha - Conceito Principal)
  const mc1 = buildBalancedOptions(
    idea1,
    [
      `Aborda um tema secundário sem relação direta com ${shortTopic}`,
      `Descarta a aplicação prática desse conceito em ${shortSubject}`,
      `Apresenta uma exceção que anula a regra geral de ${shortTopic}`,
    ],
    baseTime % 4
  );

  questions.push({
    id: `q-local-${baseTime}-1`,
    topicId,
    subjectId,
    courseId,
    audioItemId,
    type: 'multiple_choice',
    prompt: `Qual é o ponto central explicado sobre "${shortTopic}"?`,
    options: mc1.options,
    correctOptionIndex: mc1.correctOptionIndex,
    explanation: `✅ Resposta direta: ${formatConciseText(idea1, 85, false)}.\n📌 Ponto-chave: Fundamento principal apresentado na aula de ${shortSubject}.`,
    teacherQuoteSnippet: formatConciseText(idea1, 85, true),
    createdAt: baseTime,
  });

  // 2. Questão 2 (Discursiva Curta - Síntese Objetiva)
  questions.push({
    id: `q-local-${baseTime}-2`,
    topicId,
    subjectId,
    courseId,
    audioItemId,
    type: 'discursive',
    prompt: `Resuma em 1 frase a ideia-chave apresentada sobre "${shortTopic}":`,
    explanation: `✅ Resposta direta: ${formatConciseText(idea2, 88, false)}.\n📌 Ponto-chave: Conecte essa ideia à aplicação prática em ${shortSubject}.`,
    teacherQuoteSnippet: formatConciseText(idea2, 85, true),
    createdAt: baseTime + 1,
  });

  // 3. Questão 3 (Múltipla Escolha - Aplicação, quando houver mais conteúdo)
  if (ideas.length >= 2 && transcript.length > 90) {
    const mc3 = buildBalancedOptions(
      idea3,
      [
        `Substituir o método da aula sem considerar ${shortTopic}`,
        `Ignorar os critérios técnicos discutidos em ${shortSubject}`,
        `Adotar um procedimento isolado sem base no tema da aula`,
      ],
      (baseTime + 2) % 4
    );

    questions.push({
      id: `q-local-${baseTime}-3`,
      topicId,
      subjectId,
      courseId,
      audioItemId,
      type: 'multiple_choice',
      prompt: `De acordo com a aula de ${shortSubject}, qual conclusão aplica-se a "${shortTopic}"?`,
      options: mc3.options,
      correctOptionIndex: mc3.correctOptionIndex,
      explanation: `✅ Resposta direta: ${formatConciseText(idea3, 85, false)}.\n📌 Ponto-chave: Conclusão prática destacada pelo professor na gravação.`,
      teacherQuoteSnippet: formatConciseText(idea3, 85, true),
      createdAt: baseTime + 2,
    });
  }

  return questions;
}
