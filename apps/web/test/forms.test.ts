import { describe, expect, it } from 'vitest';
import { validateCourseForm, emptyCourseForm, courseToForm } from '@/components/courses/CourseForm';
import { validateQuizForm, emptyQuizForm } from '@/components/quizzes/QuizForm';

describe('validateCourseForm', () => {
  it('accepts a valid course', () => {
    const form = {
      ...emptyCourseForm(),
      title: 'IELTS Intensive',
      price: '12500000',
      discountPercent: '10',
      capacity: '20',
      sessions: [{ dayOfWeek: 0, startTime: '17:30', endTime: '19:00', room: 'A' }],
    };
    expect(validateCourseForm(form)).toEqual({});
  });

  it('rejects missing title and negative price', () => {
    const errors = validateCourseForm({ ...emptyCourseForm(), price: '-1' });
    expect(errors.title).toBeTruthy();
    expect(errors.price).toBeTruthy();
  });

  it('rejects discount outside 0-100', () => {
    const errors = validateCourseForm({ ...emptyCourseForm(), title: 'x', price: '1000', discountPercent: '120' });
    expect(errors.discountPercent).toBeTruthy();
  });

  it('rejects sessions with reversed times', () => {
    const form = {
      ...emptyCourseForm(),
      title: 'x',
      price: '1000',
      sessions: [{ dayOfWeek: 0, startTime: '19:00', endTime: '17:30', room: '' }],
    };
    expect(validateCourseForm(form).sessions).toBeTruthy();
  });

  it('rejects endDate before startDate', () => {
    const form = {
      ...emptyCourseForm(),
      title: 'x',
      price: '1000',
      startDate: '2026-09-01',
      endDate: '2026-08-01',
    };
    expect(validateCourseForm(form).endDate).toBeTruthy();
  });
});

describe('courseToForm round-trip', () => {
  it('maps a CourseSummary back into editable form values', () => {
    const course = {
      id: 'c1',
      slug: 'ielts',
      title: 'IELTS',
      type: 'IN_PERSON' as const,
      level: 'INTERMEDIATE' as const,
      price: 10000,
      discountPercent: 20,
      effectivePrice: 8000,
      currency: 'IRR',
      durationHours: 40,
      capacity: 20,
      enrolledCount: 5,
      seatsLeft: 15,
      startDate: '2026-09-01T00:00:00.000Z',
      sessions: [{ dayOfWeek: 1, startTime: '17:30', endTime: '19:00', room: null }],
      instructorIds: ['i1'],
      isPublished: true,
    };
    const form = courseToForm(course);
    expect(form.title).toBe('IELTS');
    expect(form.price).toBe('10000');
    expect(form.discountPercent).toBe('20');
    expect(form.sessions[0].room).toBe('');
    expect(form.isPublished).toBe(true);
  });
});

describe('validateQuizForm', () => {
  it('accepts a valid quiz', () => {
    const form = {
      ...emptyQuizForm(),
      title: 'میان‌ترم',
      questions: [
        {
          type: 'MULTIPLE_CHOICE' as const,
          prompt: '2+2=?',
          points: '1',
          options: [
            { id: 'a', text: '3' },
            { id: 'b', text: '4' },
          ],
          correctOptionIds: ['b'],
          correctText: '',
          explanation: '',
          allowedMimeTypes: '',
        },
      ],
    };
    expect(validateQuizForm(form)).toEqual({});
  });

  it('requires exactly one correct option for MULTIPLE_CHOICE', () => {
    const form = {
      ...emptyQuizForm(),
      title: 'x',
      questions: [
        {
          type: 'MULTIPLE_CHOICE' as const,
          prompt: '2+2=?',
          points: '1',
          options: [
            { id: 'a', text: '3' },
            { id: 'b', text: '4' },
          ],
          correctOptionIds: [],
          correctText: '',
          explanation: '',
          allowedMimeTypes: '',
        },
      ],
    };
    expect(validateQuizForm(form).questions).toBeTruthy();
  });

  it('requires a correct answer for SHORT_ANSWER', () => {
    const form = {
      ...emptyQuizForm(),
      title: 'x',
      questions: [
        {
          type: 'SHORT_ANSWER' as const,
          prompt: 'Capital of Iran?',
          points: '1',
          options: [],
          correctOptionIds: [],
          correctText: '',
          explanation: '',
          allowedMimeTypes: '',
        },
      ],
    };
    expect(validateQuizForm(form).questions).toBeTruthy();
  });

  it('validates the time limit window (30s - 24h)', () => {
    expect(validateQuizForm({ ...emptyQuizForm(), title: 'x', timeLimitSeconds: '10' }).timeLimitSeconds).toBeTruthy();
    expect(validateQuizForm({ ...emptyQuizForm(), title: 'x', timeLimitSeconds: '1800' }).timeLimitSeconds).toBeUndefined();
  });
});
