import { parseClock } from './time';
import { WEEKDAYS, type ClassSlot, type EnrolledCourse, type Schedule, type Weekday } from './types';

/**
 * Parses whatever the student pasted out of the portal. Copying a table drops
 * empty cells, so nothing here counts columns: every value is recognised by its
 * own shape, and a weekday or a course code starts a new record.
 */

const HEADINGS = new Set([
  'day', 'c.code', 'code', 'name', 'faculty', 'type', 'mode', 'start time', 'end time', 'room',
  'id', 'title', 'cr.hr', 'credit hours', 'email', 'section', 'semester', 'course', 'sr', 'sr.'
]);

const RE_CODE = /^[A-Z]{2,4}\d{2,4}[A-Z]?$/;
const RE_TIME = /^\d{1,2}:\d{2}\s*[AP]M$/i;
const RE_ROOM = /^[A-Z]{1,5}\d?[-/]\d{1,4}[A-Z]?$/i;
const RE_SECTION = /^[A-Z]\d{1,2}$/;
const RE_TERM = /^(Fall|Spring|Summer|Winter)\s+20\d\d$/i;
const RE_MODE = /^(on[-\s]?campus|online|hybrid|blended|remote)$/i;
const RE_KIND = /^(theory|lab|practical|tutorial|studio)$/i;
const RE_COURSE_TYPE = /(core|elective|general|university|foundation)\s+course$/i;
const RE_EMAIL = /@/;

function tokenise(text: string): string[] {
  return text
    .split(/[\t\n\r]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !HEADINGS.has(line.toLowerCase()));
}

function asWeekday(token: string): Weekday | null {
  const match = WEEKDAYS.find((d) => d.toLowerCase() === token.toLowerCase());
  return match ?? null;
}

function buildClass(day: Weekday, tokens: string[]): ClassSlot | null {
  const times = tokens.filter((t) => RE_TIME.test(t));
  const start = times[0] ? parseClock(times[0]) : null;
  const end = times[1] ? parseClock(times[1]) : null;
  const code = tokens.find((t) => RE_CODE.test(t));
  if (!code || start === null || end === null) return null;

  const room = tokens.find((t) => RE_ROOM.test(t) && t !== code);
  const mode = tokens.find((t) => RE_MODE.test(t));
  const kind = tokens.find((t) => RE_KIND.test(t));
  const used = new Set([code, room, mode, kind, ...times].filter(Boolean) as string[]);
  const rest = tokens.filter((t) => !used.has(t));
  const name = rest.sort((a, b) => b.length - a.length)[0] ?? code;
  const faculty = rest.find((t) => t !== name && /^[A-Za-z. ]{3,40}$/.test(t));

  return {
    day,
    code,
    name,
    startMinutes: start,
    endMinutes: end,
    room: room ?? '',
    faculty: faculty ?? '',
    type: kind ?? '',
    mode: mode ?? ''
  };
}

function buildCourse(code: string, tokens: string[]): EnrolledCourse | null {
  if (!code) return null;
  const credits = tokens.find((t) => /^\d(\.\d)?$/.test(t));
  const type = tokens.find((t) => RE_COURSE_TYPE.test(t));
  const mode = tokens.find((t) => RE_MODE.test(t));
  const section = tokens.find((t) => RE_SECTION.test(t));
  const email = tokens.find((t) => RE_EMAIL.test(t));
  const used = new Set([credits, type, mode, section, email].filter(Boolean) as string[]);
  const rest = tokens.filter((t) => !used.has(t) && !RE_TERM.test(t));
  const title = rest.sort((a, b) => b.length - a.length)[0] ?? code;

  return {
    code,
    title,
    creditHours: credits ? Number(credits) : 0,
    type: type ?? '',
    section: section ?? '',
    mode: mode ?? '',
    faculty: ''
  };
}

export interface ParseResult {
  readonly schedule: Schedule;
  readonly warnings: string[];
}

export function parsePastedSchedule(text: string, existing?: Schedule | null): ParseResult {
  const tokens = tokenise(text);
  const warnings: string[] = [];
  const classes: ClassSlot[] = [];
  const courses: EnrolledCourse[] = [];
  let term = existing?.term ?? '';

  /* pass one: anything that hangs off a weekday is a class */
  let currentDay: Weekday | null = null;
  let bucket: string[] = [];
  const flushClass = () => {
    if (!currentDay) return;
    const slot = buildClass(currentDay, bucket);
    if (slot) classes.push(slot);
    else if (bucket.some((t) => RE_TIME.test(t))) {
      warnings.push(`Skipped a ${currentDay} row without two clear times.`);
    }
    bucket = [];
  };

  for (const token of tokens) {
    const day = asWeekday(token);
    if (day) {
      flushClass();
      currentDay = day;
      continue;
    }
    if (RE_TERM.test(token) && !term) term = token;
    if (!currentDay) continue;

    /* A row is complete once it holds both times. Anything after that belongs to
       the next row, or to the courses table that follows the timetable. */
    const complete = bucket.filter((t) => RE_TIME.test(t)).length >= 2;
    if (complete && RE_CODE.test(token)) {
      flushClass();
      bucket.push(token);
      continue;
    }
    if (complete && (RE_COURSE_TYPE.test(token) || RE_TERM.test(token))) {
      flushClass();
      currentDay = null;
      continue;
    }
    bucket.push(token);
  }
  flushClass();

  /* pass two: course rows, which start at a code and carry no weekday */
  const classCodes = new Set(classes.map((c) => c.code));
  const afterDays = tokens.slice(0);
  let currentCode: string | null = null;
  let courseBucket: string[] = [];
  let sawWeekday = false;
  const flushCourse = () => {
    if (!currentCode) return;
    const looksLikeCourseRow = courseBucket.some((t) => RE_COURSE_TYPE.test(t) || RE_SECTION.test(t) || RE_TERM.test(t));
    if (looksLikeCourseRow) {
      const course = buildCourse(currentCode, courseBucket);
      if (course) courses.push(course);
    }
    courseBucket = [];
  };

  for (const token of afterDays) {
    if (asWeekday(token)) { sawWeekday = true; currentCode = null; courseBucket = []; continue; }
    if (RE_TIME.test(token)) { currentCode = null; courseBucket = []; continue; }
    if (RE_CODE.test(token)) {
      flushCourse();
      currentCode = token;
      continue;
    }
    if (currentCode) courseBucket.push(token);
  }
  flushCourse();
  void sawWeekday;

  const merged = new Map<string, EnrolledCourse>();
  for (const course of courses) merged.set(course.code, course);
  for (const code of classCodes) {
    if (!merged.has(code)) {
      const slot = classes.find((c) => c.code === code);
      merged.set(code, { code, title: slot?.name ?? code, creditHours: 0, type: '', section: '', mode: slot?.mode ?? '', faculty: '' });
    }
  }

  if (!classes.length) warnings.push('No classes were recognised. Copy the whole timetable table, headings included.');

  return {
    schedule: { term, classes, courses: [...merged.values()].sort((a, b) => a.code.localeCompare(b.code)) },
    warnings
  };
}
