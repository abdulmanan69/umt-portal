import type { Snapshot } from '../core/types';

/** A believable week, so the app can be tried before any real data is in. */
export const SAMPLE: Snapshot = {
  version: 1,
  student: { id: 'F0000000000', name: 'Sample Student', degree: 'BS Computer Science' },
  schedule: {
    term: 'Sample term',
    classes: [
      { day: 'Monday', code: 'CS101', name: 'Programming Fundamentals', startMinutes: 540, endMinutes: 615, room: 'SST1-101', type: 'Theory', mode: 'On-Campus' },
      { day: 'Monday', code: 'MA107', name: 'Calculus', startMinutes: 660, endMinutes: 735, room: 'SST1-204', type: 'Theory', mode: 'On-Campus' },
      { day: 'Tuesday', code: 'CS101L', name: 'Programming Lab', startMinutes: 780, endMinutes: 900, room: 'LAB-3', type: 'Lab', mode: 'On-Campus' },
      { day: 'Wednesday', code: 'EN110', name: 'English I', startMinutes: 600, endMinutes: 675, room: 'SST2-110', type: 'Theory', mode: 'On-Campus' },
      { day: 'Thursday', code: 'MA107', name: 'Calculus', startMinutes: 660, endMinutes: 735, room: 'SST1-204', type: 'Theory', mode: 'On-Campus' },
      { day: 'Friday', code: 'CS102', name: 'Discrete Structures', startMinutes: 930, endMinutes: 1005, room: 'SST1-305', type: 'Theory', mode: 'On-Campus' }
    ],
    courses: [
      { code: 'CS101', title: 'Programming Fundamentals', creditHours: 3, type: 'Core Course', section: 'A1', mode: 'On-Campus' },
      { code: 'CS101L', title: 'Programming Lab', creditHours: 1, type: 'Core Course', section: 'A1', mode: 'On-Campus' },
      { code: 'MA107', title: 'Calculus', creditHours: 3, type: 'Core Course', section: 'A2', mode: 'On-Campus' },
      { code: 'EN110', title: 'English I', creditHours: 3, type: 'General Course', section: 'B1', mode: 'On-Campus' },
      { code: 'CS102', title: 'Discrete Structures', creditHours: 3, type: 'Core Course', section: 'A1', mode: 'On-Campus' }
    ]
  },
  transcript: null,
  payments: null,
  readAt: { schedule: Date.now() },
  exportedAt: Date.now()
};
