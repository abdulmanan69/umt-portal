import { parsePastedSchedule } from '../src/core/parse';

const timetable = [
  'Day','C.Code','Name','Faculty','Type','Mode','Start Time','End Time','Room',
  'Monday','IT461','Bockchain Technology and Application','Theory','On-Campus','11:00 AM','12:15 PM',
  'Monday','CY461','Digital Forensics','Theory','On-Campus','03:30 PM','04:45 PM','SST1-703B',
  'Monday','CS4172','Parallel and Distributed Computing','Theory','On-Campus','05:00 PM','06:15 PM','SST1-703B',
  'Tuesday','CY463','Cyber Law & Cyber Crime','Theory','On-Campus','11:00 AM','12:15 PM','SST1-604',
  'Tuesday','CY463','Cyber Law & Cyber Crime','Theory','On-Campus','12:30 PM','01:45 PM','SST1-604',
  'Wednesday','CC491','Final Year Project I','Theory','On-Campus','09:30 AM','10:45 AM','SST2-603',
  'Thursday','IT461','Bockchain Technology and Application','Theory','On-Campus','11:00 AM','12:15 PM',
  'Thursday','CY461','Digital Forensics','Theory','On-Campus','03:30 PM','04:45 PM','SST1-703B',
  'Thursday','CS4172','Parallel and Distributed Computing','Theory','On-Campus','05:00 PM','06:15 PM','SST1-703B',
  'Saturday','CC491','Final Year Project I','Theory','On-Campus','09:30 AM','10:45 AM','SST2-603'
].join('\n');

const courses = [
  'ID','Title','Cr.Hr','Type','Faculty','Email','Mode','Section','Semester',
  'CC491','Final Year Project I','2','Core Course','On-Campus','Y6','Fall 2026',
  'CS4172','Parallel and Distributed Computing','2','Core Course','On-Campus','Y5','Fall 2026',
  'CY461','Digital Forensics','3','Core Course','On-Campus','Y1','Fall 2026',
  'CY463','Cyber Law & Cyber Crime','3','Elective Course','On-Campus','Y2','Fall 2026',
  'IT461','Bockchain Technology and Application','3','Elective Course','On-Campus','Y1','Fall 2026'
].join('\n');

let failures = 0;
function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `\n      got      ${JSON.stringify(actual)}\n      expected ${JSON.stringify(expected)}`}`);
}

/* both tables pasted together, which is what selecting the dashboard gives */
const both = parsePastedSchedule(`${timetable}\n${courses}`);
check('classes found', both.schedule.classes.length, 10);
check('courses found', both.schedule.courses.length, 5);
check('term', both.schedule.term, 'Fall 2026');
check('no warnings', both.warnings, []);

const monday = both.schedule.classes.filter((c) => c.day === 'Monday');
check('monday count', monday.length, 3);
check('first class code', monday[0].code, 'IT461');
check('first class name', monday[0].name, 'Bockchain Technology and Application');
check('first class start (11:00 AM)', monday[0].startMinutes, 660);
check('first class end (12:15 PM)', monday[0].endMinutes, 735);
check('missing room stays empty', monday[0].room, '');
check('afternoon class room', monday[1].room, 'SST1-703B');
check('afternoon start (3:30 PM)', monday[1].startMinutes, 930);
check('mode kept', monday[1].mode, 'On-Campus');
check('type kept', monday[1].type, 'Theory');

/* the courses table follows the timetable, and must not bleed into the last class */
const saturday = both.schedule.classes.filter((c) => c.day === 'Saturday');
check('saturday count', saturday.length, 1);
check('saturday code', saturday[0].code, 'CC491');
check('saturday name is its own', saturday[0].name, 'Final Year Project I');
check('saturday room', saturday[0].room, 'SST2-603');
check('thursday last class name', both.schedule.classes.filter((c) => c.day === 'Thursday')[2].name, 'Parallel and Distributed Computing');

const fyp = both.schedule.courses.find((c) => c.code === 'CC491');
check('course credit hours', fyp?.creditHours, 2);
check('course type', fyp?.type, 'Core Course');
check('course section', fyp?.section, 'Y6');
check('course title', fyp?.title, 'Final Year Project I');

/* timetable alone still works, with courses inferred from the classes */
const onlyTimetable = parsePastedSchedule(timetable);
check('timetable alone: classes', onlyTimetable.schedule.classes.length, 10);
check('timetable alone: courses inferred', onlyTimetable.schedule.courses.length, 5);

/* tab separated, as a spreadsheet would paste */
const tabbed = parsePastedSchedule('Monday\tCY461\tDigital Forensics\tTheory\tOn-Campus\t03:30 PM\t04:45 PM\tSST1-703B');
check('tab separated row', tabbed.schedule.classes.length, 1);
check('tab separated room', tabbed.schedule.classes[0].room, 'SST1-703B');

/* nonsense should complain rather than invent */
const junk = parsePastedSchedule('hello there, this is not a timetable');
check('junk yields nothing', junk.schedule.classes.length, 0);
check('junk warns', junk.warnings.length > 0, true);

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
