/** Everything the companion knows about a student, and nothing it does not. */

export type Weekday =
  | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export const WEEKDAYS: readonly Weekday[] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
] as const;

export interface Student {
  readonly id: string;
  readonly name: string;
  readonly degree?: string;
  readonly school?: string;
  readonly batch?: string;
}

export interface ClassSlot {
  readonly day: Weekday;
  readonly code: string;
  readonly name: string;
  /** Minutes from midnight, so comparisons never depend on locale parsing. */
  readonly startMinutes: number;
  readonly endMinutes: number;
  readonly room?: string;
  readonly faculty?: string;
  readonly type?: string;
  readonly mode?: string;
}

export interface EnrolledCourse {
  readonly code: string;
  readonly title: string;
  readonly creditHours: number;
  readonly type?: string;
  readonly section?: string;
  readonly mode?: string;
  readonly faculty?: string;
}

export interface Schedule {
  readonly term: string;
  readonly classes: readonly ClassSlot[];
  readonly courses: readonly EnrolledCourse[];
}

export interface CourseResult {
  readonly code: string;
  readonly title: string;
  readonly creditHours: number;
  readonly grade: string;
  readonly gradePoints: number;
}

export interface Semester {
  readonly term: string;
  readonly courses: readonly CourseResult[];
  readonly creditsEarned: number;
  readonly sgpa: number | null;
  readonly cgpa: number | null;
}

export interface Transcript {
  readonly semesters: readonly Semester[];
  readonly totals: {
    readonly creditsEarned: number;
    readonly creditsForGpa: number;
    readonly gradePoints: number;
    readonly cgpa: number;
  };
}

export interface Payment {
  readonly date: string;
  readonly at: number;
  readonly challan: string;
  readonly account: string;
  readonly amount: number;
  readonly bank?: string;
}

export interface PaymentHistory {
  readonly items: readonly Payment[];
  readonly pages: number;
}

/** One envelope holding everything, with the time each part was read. */
export interface Snapshot {
  readonly version: 1;
  readonly student: Student | null;
  readonly schedule: Schedule | null;
  readonly transcript: Transcript | null;
  readonly payments: PaymentHistory | null;
  readonly readAt: {
    readonly schedule?: number;
    readonly transcript?: number;
    readonly payments?: number;
  };
  readonly exportedAt: number;
}

export interface Settings {
  theme: 'dark' | 'light';
  /** Minutes of warning before a class starts. */
  leadMinutes: number;
  notificationsEnabled: boolean;
  /** Days the student wants reminders on; empty means every day with a class. */
  mutedDays: Weekday[];
  lastNotifiedKey: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  leadMinutes: 15,
  notificationsEnabled: false,
  mutedDays: [],
  lastNotifiedKey: null
};

export type GradeBand = 'a' | 'b' | 'c' | 'f' | 'x';

export function gradeBand(grade: string): GradeBand {
  const g = (grade || '').trim().toUpperCase();
  if (!g || ['SA', 'P', 'NA', 'I', 'W'].includes(g)) return 'x';
  if (g.startsWith('A')) return 'a';
  if (g.startsWith('B')) return 'b';
  if (g.startsWith('C')) return 'c';
  return 'f';
}
