import { TimelineItem } from '../types';

export type SM2Rating = 'again' | 'hard' | 'good' | 'easy';

export interface SM2NextIntervals {
  again: number;
  hard: number;
  good: number;
  easy: number;
}

const DEFAULT_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Calculates the next review parameters according to the SuperMemo-2 (SM-2) algorithm.
 */
export function calculateSM2Review(
  item: TimelineItem,
  rating: SM2Rating
): {
  repetitionIntervalDays: number;
  repetitionEaseFactor: number;
  repetitionStep: number;
  nextReviewTimestamp: number;
  lastReviewedTimestamp: number;
  repetitionHistoryCount: number;
  flashcardStatus: 'mastered' | 'review_again';
} {
  const currentEase = item.repetitionEaseFactor || DEFAULT_EASE_FACTOR;
  const currentStep = item.repetitionStep || 0;
  const currentInterval = item.repetitionIntervalDays || 0;
  const historyCount = (item.repetitionHistoryCount || 0) + 1;
  const now = Date.now();

  let nextInterval: number;
  let nextEase = currentEase;
  let nextStep: number;
  let flashcardStatus: 'mastered' | 'review_again';

  switch (rating) {
    case 'again': // Errei / Esqueci completamente
      nextStep = 0;
      nextInterval = 1;
      nextEase = Math.max(MIN_EASE_FACTOR, +(currentEase - 0.2).toFixed(2));
      flashcardStatus = 'review_again';
      break;

    case 'hard': // Difícil, mas lembrei
      nextStep = Math.max(1, currentStep);
      nextInterval = Math.max(1, Math.round((currentInterval || 1) * 1.2));
      nextEase = Math.max(MIN_EASE_FACTOR, +(currentEase - 0.15).toFixed(2));
      flashcardStatus = 'review_again';
      break;

    case 'good': // Bom / Resposta normal
      if (currentStep === 0) {
        nextInterval = 1;
      } else if (currentStep === 1) {
        nextInterval = 3;
      } else if (currentStep === 2) {
        nextInterval = 7;
      } else {
        nextInterval = Math.max(1, Math.round(currentInterval * currentEase));
      }
      nextStep = currentStep + 1;
      flashcardStatus = 'mastered';
      break;

    case 'easy': // Muito fácil / Dominei
      if (currentStep === 0) {
        nextInterval = 3;
      } else if (currentStep === 1) {
        nextInterval = 6;
      } else {
        nextInterval = Math.max(1, Math.round(currentInterval * currentEase * 1.3));
      }
      nextStep = currentStep + 1;
      nextEase = +(currentEase + 0.15).toFixed(2);
      flashcardStatus = 'mastered';
      break;
  }

  const nextReviewTimestamp = now + nextInterval * ONE_DAY_MS;

  return {
    repetitionIntervalDays: nextInterval,
    repetitionEaseFactor: nextEase,
    repetitionStep: nextStep,
    nextReviewTimestamp,
    lastReviewedTimestamp: now,
    repetitionHistoryCount: historyCount,
    flashcardStatus,
  };
}

/**
 * Pre-computes how many days each button would schedule for the card.
 */
export function getSM2NextIntervals(item: TimelineItem): SM2NextIntervals {
  const currentEase = item.repetitionEaseFactor || DEFAULT_EASE_FACTOR;
  const currentStep = item.repetitionStep || 0;
  const currentInterval = item.repetitionIntervalDays || 0;

  // again
  const again = 1;

  // hard
  const hard = Math.max(1, Math.round((currentInterval || 1) * 1.2));

  // good
  let good: number;
  if (currentStep === 0) good = 1;
  else if (currentStep === 1) good = 3;
  else if (currentStep === 2) good = 7;
  else good = Math.max(1, Math.round(currentInterval * currentEase));

  // easy
  let easy: number;
  if (currentStep === 0) easy = 3;
  else if (currentStep === 1) easy = 6;
  else easy = Math.max(1, Math.round(currentInterval * currentEase * 1.3));

  return { again, hard, good, easy };
}

/**
 * Checks if a card is due for review today.
 */
export function isItemDueForReview(
  item: TimelineItem,
  targetTimestamp = Date.now()
): boolean {
  if (!item.importantForExam) return false;
  // If never reviewed, it's due
  if (!item.nextReviewTimestamp) return true;
  // If due timestamp is in the past or within 4 hours
  return item.nextReviewTimestamp <= targetTimestamp + 4 * 60 * 60 * 1000;
}

/**
 * Filters items that are due for review.
 */
export function getDueItemsForReview(
  items: TimelineItem[],
  subjectId?: string | null
): TimelineItem[] {
  return items.filter((item) => {
    if (subjectId && item.subjectId !== subjectId) return false;
    return isItemDueForReview(item);
  });
}

/**
 * Formats day count into compact label, e.g. "1d", "3d", "14d", "1m".
 */
export function formatSM2IntervalDays(days: number): string {
  if (days <= 0) return '<1d';
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  return `${months}m`;
}
