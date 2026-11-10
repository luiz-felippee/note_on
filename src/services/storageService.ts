import { openDB, IDBPDatabase } from 'idb';
import { Course, Subject, StudyTopic, TimelineItem, StudyQuestion } from '../types';

const DB_NAME = 'noteon_study_db';
const DB_VERSION = 3; // Upgraded for questions store

let dbPromise: Promise<IDBPDatabase> | null = null;

function getLocalDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (!db.objectStoreNames.contains('courses')) {
          db.createObjectStore('courses', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('subjects')) {
          const subjStore = db.createObjectStore('subjects', { keyPath: 'id' });
          subjStore.createIndex('by-course', 'courseId');
        } else if (oldVersion < 2 && transaction) {
          const subjStore = transaction.objectStore('subjects');
          if (!subjStore.indexNames.contains('by-course')) {
            subjStore.createIndex('by-course', 'courseId');
          }
        }
        if (!db.objectStoreNames.contains('topics')) {
          const topicStore = db.createObjectStore('topics', { keyPath: 'id' });
          topicStore.createIndex('by-subject', 'subjectId');
        }
        if (!db.objectStoreNames.contains('items')) {
          const itemStore = db.createObjectStore('items', { keyPath: 'id' });
          itemStore.createIndex('by-topic', 'topicId');
          itemStore.createIndex('by-subject', 'subjectId');
        }
        if (!db.objectStoreNames.contains('questions')) {
          const qStore = db.createObjectStore('questions', { keyPath: 'id' });
          qStore.createIndex('by-topic', 'topicId');
          qStore.createIndex('by-subject', 'subjectId');
        }
      },
    });
  }
  return dbPromise;
}

function createDemoAudioDataUrl(): string {
  const sampleRate = 22050;
  const durationSeconds = 6;
  const numSamples = sampleRate * durationSeconds;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  const notes = [440, 523.25, 587.33, 659.25, 783.99, 880];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const noteIdx = Math.min(Math.floor(t), notes.length - 1);
    const freq = notes[noteIdx];
    const localT = t - Math.floor(t);
    const env = Math.exp(-3.0 * localT) * Math.min(1, localT * 35);
    const sample = Math.sin(2 * Math.PI * freq * t) * env * 0.35;
    const pcm = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + i * 2, pcm * 32767, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

function createDemoBoardPhotoDataUrl(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="520" viewBox="0 0 900 520">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#1e293b"/>
      </linearGradient>
    </defs>
    <rect width="900" height="520" rx="16" fill="url(#bg)"/>
    <g stroke="#334155" stroke-width="1" opacity="0.4">
      <line x1="0" y1="80" x2="900" y2="80"/>
      <line x1="0" y1="160" x2="900" y2="160"/>
      <line x1="0" y1="240" x2="900" y2="240"/>
      <line x1="0" y1="320" x2="900" y2="320"/>
      <line x1="0" y1="400" x2="900" y2="400"/>
      <line x1="150" y1="0" x2="150" y2="520"/>
      <line x1="300" y1="0" x2="300" y2="520"/>
      <line x1="450" y1="0" x2="450" y2="520"/>
      <line x1="600" y1="0" x2="600" y2="520"/>
      <line x1="750" y1="0" x2="750" y2="520"/>
    </g>
    <text x="45" y="55" fill="#38bdf8" font-family="sans-serif" font-size="24" font-weight="bold">QUADRO DA AULA — Potencial de Ação Neuronal</text>
    <text x="45" y="85" fill="#94a3b8" font-family="monospace" font-size="15">Foto capturada às 08:15:42 • Fases de Despolarização e Repolarização</text>
    <line x1="90" y1="420" x2="820" y2="420" stroke="#94a3b8" stroke-width="3"/>
    <line x1="90" y1="130" x2="90" y2="450" stroke="#94a3b8" stroke-width="3"/>
    <text x="35" y="160" fill="#f8fafc" font-family="monospace" font-size="16">+30mV</text>
    <text x="35" y="330" fill="#fbbf24" font-family="monospace" font-size="16">-55mV</text>
    <text x="35" y="390" fill="#f8fafc" font-family="monospace" font-size="16">-70mV</text>
    <line x1="90" y1="325" x2="820" y2="325" stroke="#fbbf24" stroke-width="2" stroke-dasharray="8,8"/>
    <text x="690" y="315" fill="#fbbf24" font-family="sans-serif" font-size="14">Limiar de Disparo</text>
    <path d="M 90 385 L 230 385 Q 270 385 290 325 L 360 155 Q 375 130 390 155 L 470 435 Q 510 465 560 395 L 780 385" fill="none" stroke="#22d3ee" stroke-width="5"/>
    <circle cx="375" cy="145" r="8" fill="#f43f5e"/>
    <text x="400" y="150" fill="#fda4af" font-family="sans-serif" font-size="16" font-weight="bold">1. Pico (+30 mV) - Fechamento canais Na+</text>
    <circle cx="290" cy="325" r="7" fill="#fbbf24"/>
    <text x="130" y="295" fill="#fde047" font-family="sans-serif" font-size="15">Abertura Na+ (Tudo ou Nada)</text>
    <text x="485" y="280" fill="#a7f3d0" font-family="sans-serif" font-size="15">2. Saída de K+ (Repolarização)</text>
    <text x="485" y="475" fill="#c4b5fd" font-family="sans-serif" font-size="15">3. Hiperpolarização (-90mV)</text>
  </svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// Seed initial demo data with 3-Level hierarchy: Course -> Subject -> Topic -> Items
export async function ensureInitialSeedData(): Promise<void> {
  const db = await getLocalDB();
  const existingCourses = await db.getAll('courses');
  const now = Date.now();

  let defaultCourseId = 'course-medicina';

  if (existingCourses.length === 0) {
    const course1: Course = {
      id: 'course-medicina',
      name: 'Medicina & Saúde',
      description: 'Graduação em Medicina e Ciclo Clínico',
      color: '#6366f1',
      createdAt: now - 3600000 * 24,
      updatedAt: now,
    };
    const course2: Course = {
      id: 'course-exatas',
      name: 'Engenharia & Exatas',
      description: 'Disciplinas de Cálculo, Física e Computação',
      color: '#10b981',
      createdAt: now - 3600000 * 20,
      updatedAt: now,
    };
    await db.put('courses', course1);
    await db.put('courses', course2);
  } else {
    defaultCourseId = existingCourses[0].id;
  }

  // Check if existing subjects need courseId migration
  const existingSubjects = await db.getAll('subjects');
  for (const s of existingSubjects) {
    if (!s.courseId) {
      s.courseId = defaultCourseId;
      await db.put('subjects', s);
    }
  }

  if (existingSubjects.length > 0) return;

  const subj1: Subject = {
    id: 'subj-fisiologia',
    courseId: 'course-medicina',
    name: 'Fisiologia Humana',
    color: '#6366f1',
    icon: 'Brain',
    teacher: 'Prof. Dr. Ricardo Mendes',
    semester: '2026.2',
    createdAt: now - 3600000 * 5,
    updatedAt: now,
  };

  const subj2: Subject = {
    id: 'subj-calculo',
    courseId: 'course-exatas',
    name: 'Cálculo e Física',
    color: '#10b981',
    icon: 'Calculator',
    teacher: 'Profa. Helena Costa',
    semester: '2026.2',
    createdAt: now - 3600000 * 3,
    updatedAt: now,
  };

  const topic1: StudyTopic = {
    id: 'topic-neuro-01',
    courseId: 'course-medicina',
    subjectId: subj1.id,
    title: 'Aula 01: Bioeletrogênese e Potencial de Ação',
    summary:
      'Estudo dos canais iônicos dependentes de voltagem, limiar de excitabilidade e condução saltatória.',
    date: new Date().toISOString().slice(0, 10),
    startTime: '08:10:00',
    studyDurationSeconds: 2740,
    createdAt: now - 3600000 * 26,
    updatedAt: now,
  };

  const item1: TimelineItem = {
    id: 'item-demo-1',
    topicId: topic1.id,
    subjectId: subj1.id,
    courseId: 'course-medicina',
    type: 'text',
    createdAt: now - 1800000,
    timeLabel: '08:12:15',
    dateLabel: new Date().toLocaleDateString('pt-BR'),
    orderIndex: 1,
    title: 'Conceito de Potencial de Repouso (-70 mV)',
    content:
      'O neurônio em repouso mantém uma diferença de potencial de aproximadamente -70 mV.\n\n• Bomba de Na+/K+ ATPase: bombeia 3 Na+ para fora e 2 K+ para dentro.\n• Canais de vazamento de K+ são muito mais permeáveis no repouso.',
    importantForExam: true,
    syncStatus: 'local',
  };

  const item2: TimelineItem = {
    id: 'item-demo-2',
    topicId: topic1.id,
    subjectId: subj1.id,
    courseId: 'course-medicina',
    type: 'photo',
    createdAt: now - 1400000,
    timeLabel: '08:15:42',
    dateLabel: new Date().toLocaleDateString('pt-BR'),
    orderIndex: 2,
    title: 'Gráfico da Lousa: Curva do Potencial de Ação',
    content:
      'Abertura dos canais de sódio no limiar (-55 mV) segue a Lei do Tudo ou Nada. A repolarização ocorre pelo efluxo rápido de potássio.',
    mediaDataUrl: createDemoBoardPhotoDataUrl(),
    importantForExam: true,
    lectureRelativeTimestamp: '00:02 do áudio',
    lectureOffsetSeconds: 2,
    linkedAudioItemId: 'item-demo-3',
    syncStatus: 'local',
  };

  const item3: TimelineItem = {
    id: 'item-demo-3',
    topicId: topic1.id,
    subjectId: subj1.id,
    courseId: 'course-medicina',
    type: 'audio',
    createdAt: now - 900000,
    timeLabel: '08:21:08',
    dateLabel: new Date().toLocaleDateString('pt-BR'),
    orderIndex: 3,
    title: 'Explicação em Áudio: Período Refratário',
    content:
      'No período refratário absoluto os canais de Na+ estão inativados, impedindo qualquer novo disparo.',
    transcript:
      'Durante o período refratário absoluto nenhum novo potencial de ação pode ser disparado porque a comporta de inativação do canal de sódio está fechada.',
    mediaDataUrl: createDemoAudioDataUrl(),
    audioDurationSeconds: 6,
    audioWaveform: [
      0.25, 0.55, 0.85, 0.7, 0.4, 0.6, 0.95, 0.8, 0.5, 0.3, 0.75, 0.9, 0.65, 0.45, 0.8,
      0.95, 0.7, 0.5, 0.35, 0.6, 0.85, 0.55, 0.4, 0.7, 0.5, 0.3, 0.45, 0.25,
    ],
    importantForExam: true,
    syncStatus: 'local',
  };

  await db.put('subjects', subj1);
  await db.put('subjects', subj2);
  await db.put('topics', topic1);
  await db.put('items', item1);
  await db.put('items', item2);
  await db.put('items', item3);
}

// Course CRUD Operations
export async function getAllCourses(): Promise<Course[]> {
  const db = await getLocalDB();
  const list = await db.getAll('courses');
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveCourse(course: Course): Promise<void> {
  const db = await getLocalDB();
  await db.put('courses', course);
}

export async function deleteCourseAndChildren(courseId: string): Promise<void> {
  const db = await getLocalDB();
  const subjects = await getSubjectsByCourse(courseId);
  for (const s of subjects) {
    await deleteSubjectAndChildren(s.id);
  }
  await db.delete('courses', courseId);
}

// Subject CRUD Operations
export async function getAllSubjects(): Promise<Subject[]> {
  const db = await getLocalDB();
  const list = await db.getAll('subjects');
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getSubjectsByCourse(courseId: string): Promise<Subject[]> {
  const db = await getLocalDB();
  const list = await db.getAllFromIndex('subjects', 'by-course', courseId);
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveSubject(subject: Subject): Promise<void> {
  const db = await getLocalDB();
  await db.put('subjects', subject);
}

export async function deleteSubjectAndChildren(subjectId: string): Promise<void> {
  const db = await getLocalDB();
  const topics = await db.getAllFromIndex('topics', 'by-subject', subjectId);
  for (const t of topics) {
    await deleteTopicAndItems(t.id);
  }
  await db.delete('subjects', subjectId);
}

// Topic CRUD Operations
export async function getTopicsBySubject(subjectId: string): Promise<StudyTopic[]> {
  const db = await getLocalDB();
  const list = await db.getAllFromIndex('topics', 'by-subject', subjectId);
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAllTopics(): Promise<StudyTopic[]> {
  const db = await getLocalDB();
  const list = await db.getAll('topics');
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveTopic(topic: StudyTopic): Promise<void> {
  const db = await getLocalDB();
  await db.put('topics', topic);
}

export async function deleteTopicAndItems(topicId: string): Promise<void> {
  const db = await getLocalDB();
  const items = await db.getAllFromIndex('items', 'by-topic', topicId);
  for (const item of items) {
    await db.delete('items', item.id);
  }
  await db.delete('topics', topicId);
}

// Timeline Items CRUD Operations
export async function getItemsByTopic(topicId: string): Promise<TimelineItem[]> {
  const db = await getLocalDB();
  const list: TimelineItem[] = await db.getAllFromIndex('items', 'by-topic', topicId);
  return list.sort((a, b) => {
    if (a.orderIndex !== b.orderIndex) return a.orderIndex - b.orderIndex;
    return a.createdAt - b.createdAt;
  });
}

export async function getAllItems(): Promise<TimelineItem[]> {
  const db = await getLocalDB();
  const list: TimelineItem[] = await db.getAll('items');
  return list.sort((a, b) => a.createdAt - b.createdAt);
}

export async function saveTimelineItem(item: TimelineItem): Promise<TimelineItem> {
  const db = await getLocalDB();
  const toSave: TimelineItem = {
    ...item,
    syncStatus: item.syncStatus || 'local',
  };
  await db.put('items', toSave);
  return toSave;
}

export async function deleteTimelineItem(itemId: string): Promise<void> {
  const db = await getLocalDB();
  await db.delete('items', itemId);
}

export async function getQuestionsByTopic(topicId: string): Promise<StudyQuestion[]> {
  const db = await getLocalDB();
  const tx = db.transaction('questions', 'readonly');
  const index = tx.store.index('by-topic');
  return index.getAll(topicId);
}

export async function getAllQuestions(): Promise<StudyQuestion[]> {
  const db = await getLocalDB();
  return db.getAll('questions');
}

export async function saveQuestion(question: StudyQuestion): Promise<StudyQuestion> {
  const db = await getLocalDB();
  await db.put('questions', question);
  return question;
}

export async function saveQuestionsBatch(questions: StudyQuestion[]): Promise<StudyQuestion[]> {
  const db = await getLocalDB();
  const tx = db.transaction('questions', 'readwrite');
  for (const q of questions) {
    await tx.store.put(q);
  }
  await tx.done;
  return questions;
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const db = await getLocalDB();
  await db.delete('questions', questionId);
}

// 1-Click Full Backup Export & Import (.json)
export async function exportFullBackupJson(): Promise<string> {
  const db = await getLocalDB();
  const [courses, subjects, topics, items, questions] = await Promise.all([
    db.getAll('courses'),
    db.getAll('subjects'),
    db.getAll('topics'),
    db.getAll('items'),
    db.getAll('questions'),
  ]);
  const payload = {
    app: 'NoteOn',
    version: 4,
    exportedAt: new Date().toISOString(),
    courses,
    subjects,
    topics,
    items,
    questions,
  };
  return JSON.stringify(payload, null, 2);
}

export async function importFullBackupJson(jsonContent: string): Promise<{
  courses: number;
  subjects: number;
  topics: number;
  items: number;
  questions: number;
}> {
  const parsed = JSON.parse(jsonContent);
  if (!parsed || !Array.isArray(parsed.subjects) || !Array.isArray(parsed.items)) {
    throw new Error('Arquivo de backup inválido.');
  }
  const db = await getLocalDB();
  for (const c of parsed.courses || []) {
    await db.put('courses', c);
  }
  for (const s of parsed.subjects) {
    await db.put('subjects', s);
  }
  for (const t of parsed.topics || []) {
    await db.put('topics', t);
  }
  for (const i of parsed.items) {
    await db.put('items', i);
  }
  for (const q of parsed.questions || []) {
    await db.put('questions', q);
  }
  return {
    courses: (parsed.courses || []).length,
    subjects: parsed.subjects.length,
    topics: (parsed.topics || []).length,
    items: parsed.items.length,
    questions: (parsed.questions || []).length,
  };
}

export async function saveMergedCloudData(data: {
  courses?: Course[];
  subjects?: Subject[];
  topics?: StudyTopic[];
  items?: TimelineItem[];
  questions?: StudyQuestion[];
}): Promise<void> {
  const db = await getLocalDB();
  for (const c of data.courses || []) {
    await db.put('courses', c);
  }
  for (const s of data.subjects || []) {
    await db.put('subjects', s);
  }
  for (const t of data.topics || []) {
    await db.put('topics', t);
  }
  for (const i of data.items || []) {
    await db.put('items', i);
  }
  for (const q of data.questions || []) {
    await db.put('questions', q);
  }
}
