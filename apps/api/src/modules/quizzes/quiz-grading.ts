/**
 * Pure grading functions — no database, no Nest DI, fully unit-testable.
 *
 * Every scoring rule the platform applies lives here so that auto-grading,
 * manual grading and the "what would this score?" preview in the authoring UI
 * can never diverge.
 */
import { QuestionType, type QuizAnswerValue } from '../../packages/shared/src/index';

export interface GradableQuestion {
  id: string;
  type: QuestionType;
  points: number;
  correctOptionIds: string[];
  correctText: string | null;
}

export interface GradedAnswer {
  questionId: string;
  awardedPoints: number | null;
  isCorrect: boolean | null;
  needsManualGrade: boolean;
}

/** Normalizes free text before comparison: trim, collapse spaces, casefold. */
export function normalizeAnswerText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,!?؛،]/g, '');
}

/**
 * Grades one answer.
 *
 * - MULTIPLE_CHOICE / TRUE_FALSE: exactly one selection, all-or-nothing.
 * - MULTI_SELECT: partial credit — (correct picks − wrong picks) / total correct,
 *   floored at zero, so guessing everything scores nothing.
 * - SHORT_ANSWER: case/punctuation-insensitive match against the key; if no key
 *   was configured it falls through to manual grading.
 * - ESSAY / FILE_UPLOAD: always manual.
 */
export function gradeAnswer(
  question: GradableQuestion,
  value: QuizAnswerValue | undefined,
): GradedAnswer {
  const manual = (): GradedAnswer => ({
    questionId: question.id,
    awardedPoints: null,
    isCorrect: null,
    needsManualGrade: true,
  });

  if (question.type === QuestionType.ESSAY || question.type === QuestionType.FILE_UPLOAD) {
    return manual();
  }

  // Unanswered auto-gradable questions score zero.
  if (!value) {
    return {
      questionId: question.id,
      awardedPoints: 0,
      isCorrect: false,
      needsManualGrade: false,
    };
  }

  switch (question.type) {
    case QuestionType.MULTIPLE_CHOICE:
    case QuestionType.TRUE_FALSE: {
      if (value.type !== 'CHOICE') {
        return { questionId: question.id, awardedPoints: 0, isCorrect: false, needsManualGrade: false };
      }
      const selected = value.optionIds;
      const correct =
        selected.length === 1 &&
        question.correctOptionIds.length === 1 &&
        selected[0] === question.correctOptionIds[0];
      return {
        questionId: question.id,
        awardedPoints: correct ? question.points : 0,
        isCorrect: correct,
        needsManualGrade: false,
      };
    }

    case QuestionType.MULTI_SELECT: {
      if (value.type !== 'CHOICE') {
        return { questionId: question.id, awardedPoints: 0, isCorrect: false, needsManualGrade: false };
      }
      const correctSet = new Set(question.correctOptionIds);
      if (correctSet.size === 0) {
        return { questionId: question.id, awardedPoints: 0, isCorrect: false, needsManualGrade: false };
      }
      const selected = new Set(value.optionIds);
      let hits = 0;
      let misses = 0;
      for (const id of selected) {
        if (correctSet.has(id)) hits += 1;
        else misses += 1;
      }
      const ratio = Math.max(0, (hits - misses) / correctSet.size);
      const awarded = Number((question.points * ratio).toFixed(4));
      return {
        questionId: question.id,
        awardedPoints: awarded,
        isCorrect: ratio === 1,
        needsManualGrade: false,
      };
    }

    case QuestionType.SHORT_ANSWER: {
      if (value.type !== 'TEXT') {
        return { questionId: question.id, awardedPoints: 0, isCorrect: false, needsManualGrade: false };
      }
      if (!question.correctText) return manual();
      // The key may hold several acceptable answers separated by "|".
      const accepted = question.correctText
        .split('|')
        .map((candidate) => normalizeAnswerText(candidate))
        .filter(Boolean);
      const given = normalizeAnswerText(value.text);
      const correct = accepted.includes(given);
      return {
        questionId: question.id,
        awardedPoints: correct ? question.points : 0,
        isCorrect: correct,
        needsManualGrade: false,
      };
    }

    default:
      return manual();
  }
}

export interface AttemptScore {
  autoGradedPoints: number;
  pendingManualPoints: number;
  totalPoints: number;
  /** Scaled to the quiz's configured maxScore. */
  scaledScore: number;
  fullyGraded: boolean;
}

/** Aggregates graded answers into a final, scaled score. */
export function summarizeAttempt(
  questions: GradableQuestion[],
  graded: GradedAnswer[],
  quizMaxScore: number,
): AttemptScore {
  const byId = new Map(graded.map((g) => [g.questionId, g]));
  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

  let autoGradedPoints = 0;
  let pendingManualPoints = 0;

  for (const question of questions) {
    const answer = byId.get(question.id);
    if (!answer || answer.needsManualGrade) {
      pendingManualPoints += question.points;
      // A manually graded answer may already carry a score from the teacher.
      if (answer?.awardedPoints != null) {
        autoGradedPoints += answer.awardedPoints;
        pendingManualPoints -= question.points;
      }
      continue;
    }
    autoGradedPoints += answer.awardedPoints ?? 0;
  }

  const scale = totalPoints > 0 ? quizMaxScore / totalPoints : 0;
  return {
    autoGradedPoints: Number(autoGradedPoints.toFixed(4)),
    pendingManualPoints: Number(pendingManualPoints.toFixed(4)),
    totalPoints,
    scaledScore: Number((autoGradedPoints * scale).toFixed(2)),
    fullyGraded: pendingManualPoints === 0,
  };
}

/**
 * Deterministic Fisher–Yates shuffle seeded by a string, so a student who
 * reloads mid-exam sees the same order (the order is persisted per attempt).
 */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const result = items.slice();
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0;
  const next = (): number => {
    // xorshift32
    state ^= state << 13;
    state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0xffffffff;
  };

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
