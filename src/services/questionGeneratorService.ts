import { StudyQuestion, QuestionType } from '../types';

const GEMINI_STORAGE_KEY = 'noteon_gemini_api_key';

export function getGeminiApiKey(): string {
  try {
    return localStorage.getItem(GEMINI_STORAGE_KEY) || '';
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
        return aiQuestions.map((q, idx) => ({
          id: `question-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          topicId,
          subjectId,
          courseId,
          audioItemId,
          type: q.type || 'multiple_choice',
          prompt: q.prompt,
          options: q.options && q.options.length >= 2 ? q.options : undefined,
          correctOptionIndex: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0,
          explanation: q.explanation || 'Explicação baseada na explicação do professor em aula.',
          teacherQuoteSnippet: q.teacherQuoteSnippet || cleanTranscript.slice(0, 150),
          createdAt: Date.now() + idx,
        }));
      }
    } catch (err) {
      console.warn('Falha na chamada ao Gemini API, usando gerador linguístico local:', err);
      // Fallback seamlessly to local linguistic engine
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

// Gemini REST API Integration
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
  const prompt = `Você é um tutor pedagógico acadêmico especialista em aprendizagem ativa e fixação de conteúdo para vestibulares, faculdade e concursos.
Com base EXCLUSIVAMENTE na transcrição do áudio gravado em aula pelo professor sobre o tema "${args.topicTitle}" da disciplina "${args.subjectName}":

Transcrição da aula:
"""
${args.transcript}
"""

Elabore entre 2 e 4 questões excelentes para testar e fixar o conhecimento dos estudantes.
Distribua em formato misto:
- Pelo menos 1 questão de múltipla escolha com 4 alternativas (A, B, C, D), indicando o índice da resposta correta (0 a 3) e uma explicação didática do porquê está correta.
- Pelo menos 1 questão discursiva/conceitual aberta com um gabarito comentado completo para o aluno conferir sua reflexão.
Para cada questão, extraia um trecho curto literal ou fiel da fala do professor (teacherQuoteSnippet).

Retorne ESTRITAMENTE um array JSON puro (sem marcação de markdown extra como \`\`\`json) com os objetos:
[
  {
    "type": "multiple_choice",
    "prompt": "Enunciado claro e contextualizado com a aula...",
    "options": ["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D"],
    "correctOptionIndex": 0,
    "explanation": "Explicação detalhada...",
    "teacherQuoteSnippet": "Trecho que o professor falou..."
  },
  {
    "type": "discursive",
    "prompt": "Pergunta aberta conceitual instigante...",
    "explanation": "Gabarito modelo com os pontos fundamentais que o estudante deve citar...",
    "teacherQuoteSnippet": "Trecho que o professor falou..."
  }
]`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${args.apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errorText}`);
  }

  const json = await res.json();
  const textOutput =
    json?.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!textOutput) {
    throw new Error('Resposta vazia da API Gemini.');
  }

  // Parse JSON
  let cleaned = textOutput.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```/, '').replace(/```$/, '').trim();
  }

  return JSON.parse(cleaned);
}

// Local Linguistic Semantic Question Generator
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

  // Split transcript into sentences
  const sentences = transcript
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);

  const questions: StudyQuestion[] = [];
  const baseTime = Date.now();

  // Find sentences with explanatory or emphasis markers
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
  ];

  const keySentences = sentences.filter((s) =>
    causalKeywords.some((kw) => s.toLowerCase().includes(kw))
  );

  const primarySentence =
    keySentences[0] || sentences[0] || transcript.slice(0, 140);
  const secondarySentence =
    keySentences[1] || sentences[1] || sentences[sentences.length - 1] || primarySentence;

  // 1. Multiple Choice Question
  const mcSnippet = primarySentence;
  questions.push({
    id: `q-local-${baseTime}-mc`,
    topicId,
    subjectId,
    courseId,
    audioItemId,
    type: 'multiple_choice',
    prompt: `Com base na aula de ${subjectName} sobre "${topicTitle}", como o professor explica o ponto central abordado neste trecho da gravação?`,
    options: [
      `${mcSnippet.charAt(0).toUpperCase() + mcSnippet.slice(1)}.`,
      `O conceito abordado é apenas secundário e não se relaciona com ${topicTitle}.`,
      `A explicação do professor descarta a influência desse mecanismo na disciplina.`,
      `Trata-se de uma exceção que invalida os princípios teóricos de ${subjectName}.`,
    ],
    correctOptionIndex: 0,
    explanation: `Conforme enfatizado na fala gravada: "${mcSnippet}". Essa é a definição e fundamento direto apresentado pelo professor.`,
    teacherQuoteSnippet: mcSnippet,
    createdAt: baseTime,
  });

  // 2. Discursive Conceptual Question
  const discSnippet = secondarySentence;
  questions.push({
    id: `q-local-${baseTime}-disc`,
    topicId,
    subjectId,
    courseId,
    audioItemId,
    type: 'discursive',
    prompt: `Explique com suas próprias palavras o conceito discutido pelo professor em "${topicTitle}": qual a principal conclusão transmitida na aula?`,
    explanation: `Gabarito esperado:\nO professor destacou o seguinte raciocínio central:\n"${discSnippet}".\n\nAo responder, você deve citar como essa ideia se conecta aos objetivos de ${topicTitle} e seus impactos práticos em ${subjectName}.`,
    teacherQuoteSnippet: discSnippet,
    createdAt: baseTime + 1,
  });

  // 3. If transcript is longer (> 180 chars), add a 3rd question (practical application)
  if (sentences.length >= 3 && transcript.length > 200) {
    const thirdSentence = sentences[Math.min(2, sentences.length - 1)];
    questions.push({
      id: `q-local-${baseTime}-app`,
      topicId,
      subjectId,
      courseId,
      audioItemId,
      type: 'multiple_choice',
      prompt: `Qual a melhor aplicação ou desdobramento prático mencionado na aula para o tema "${topicTitle}"?`,
      options: [
        `Aplicar a reflexão: "${thirdSentence.charAt(0).toUpperCase() + thirdSentence.slice(1)}".`,
        `Substituir totalmente a metodologia tradicional sem necessidade de fundamentação teórica.`,
        `Desconsiderar os fatores práticos em provas e avaliações acadêmicas.`,
        `Adotar um procedimento puramente empírico sem conexão com os conceitos vistos.`,
      ],
      correctOptionIndex: 0,
      explanation: `O professor vinculou a aplicação prática diretamente a: "${thirdSentence}".`,
      teacherQuoteSnippet: thirdSentence,
      createdAt: baseTime + 2,
    });
  }

  return questions;
}

