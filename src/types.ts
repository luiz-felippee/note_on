export type TimelineItemType = 'text' | 'photo' | 'audio';

export type StudyTagType = 'duvida' | 'formula' | 'exercicio' | 'importante';

export interface AudioMomentMarker {
  id: string;
  timeSeconds: number;
  timeFormatted: string; // MM:SS
  tag: StudyTagType;
  label: string;
}

export interface PhotoHighlightStroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export interface Course {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  createdAt: number;
  updatedAt: number;
}

export interface Subject {
  id: string;
  courseId: string; // Mandatory link to Course
  name: string;
  color: string;
  icon: string;
  teacher?: string;
  semester?: string;
  examDate?: string;
  createdAt: number;
  updatedAt: number;
}

export interface StudyTopic {
  id: string;
  courseId?: string; // Optional direct denormalization for quick filters
  subjectId: string; // Linked to Subject
  title: string;
  summary?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm:ss
  studyDurationSeconds: number;
  review1dCompleted?: boolean;
  review7dCompleted?: boolean;
  review30dCompleted?: boolean;
  lastReviewedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface TimelineItem {
  id: string;
  topicId: string;
  subjectId: string;
  courseId?: string;
  type: TimelineItemType;
  createdAt: number; // exact timestamp (ms)
  timeLabel: string; // HH:mm:ss
  dateLabel: string; // DD/MM/YYYY
  orderIndex: number;
  content: string;
  transcript?: string;
  title?: string;
  importantForExam: boolean;
  studyTags?: StudyTagType[];
  audioMarkers?: AudioMomentMarker[];
  mediaDataUrl?: string;
  mediaSize?: number;
  audioDurationSeconds?: number;
  audioWaveform?: number[];
  lectureRelativeTimestamp?: string;
  lectureOffsetSeconds?: number;
  linkedAudioItemId?: string;
  flashcardStatus?: 'mastered' | 'review_again' | 'unseen';
  // Spaced Repetition (SM-2 / Anki)
  repetitionIntervalDays?: number;
  repetitionEaseFactor?: number;
  repetitionStep?: number;
  nextReviewTimestamp?: number;
  lastReviewedTimestamp?: number;
  repetitionHistoryCount?: number;
  photoHighlights?: PhotoHighlightStroke[];
  syncStatus?: 'local' | 'syncing' | 'synced';
}

export type QuestionType = 'multiple_choice' | 'discursive';

export interface StudyQuestion {
  id: string;
  topicId: string;
  subjectId: string;
  courseId?: string;
  audioItemId?: string;
  type: QuestionType;
  prompt: string;
  options?: string[];
  correctOptionIndex?: number;
  explanation: string;
  teacherQuoteSnippet?: string;
  userSelectedOption?: number;
  userRevealedDiscursive?: boolean;
  userNotes?: string;
  createdAt: number;
  importantForExam?: boolean;
}
