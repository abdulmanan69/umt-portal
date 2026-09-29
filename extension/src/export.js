/* UMT Portal - Reimagined | build a snapshot in the shape the web companion expects */
(function () {
  'use strict';
  const U = window.UMTX;
  if (!U) return;

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  function clockToMinutes(value) {
    const m = /^(\d{1,2}):(\d{2})\s*([AP])M$/i.exec((value || '').trim());
    if (!m) return null;
    const hour = (Number(m[1]) % 12) + (m[3].toUpperCase() === 'P' ? 12 : 0);
    return hour * 60 + Number(m[2]);
  }

  function buildSnapshot() {
    const transcript = U.store.value('transcript');
    const payments = U.store.value('payments');
    const schedule = U.store.value('schedule');
    const who = U.LS.getJSON('student', null);

    const student = transcript && transcript.student
      ? {
          id: transcript.student.id || (who && who.id) || '',
          name: transcript.student.name || (who && who.name) || '',
          degree: transcript.student.degree || '',
          school: transcript.student.school || ''
        }
      : who
        ? { id: who.id, name: who.name }
        : null;

    return {
      version: 1,
      student: student,
      schedule: schedule ? {
        term: schedule.term || '',
        classes: (schedule.classes || []).map(function (c) {
          return {
            day: DAYS.indexOf(c.day) > -1 ? c.day : 'Monday',
            code: c.code,
            name: c.name,
            startMinutes: clockToMinutes(c.start),
            endMinutes: clockToMinutes(c.end),
            room: c.room || '',
            faculty: c.faculty || '',
            type: c.type || '',
            mode: c.mode || ''
          };
        }).filter(function (c) { return c.startMinutes !== null && c.endMinutes !== null; }),
        courses: (schedule.courses || []).map(function (c) {
          return {
            code: c.code,
            title: c.title,
            creditHours: c.cr || 0,
            type: c.type || '',
            section: c.section || '',
            mode: c.mode || '',
            faculty: c.faculty || ''
          };
        })
      } : null,
      transcript: transcript ? {
        semesters: (transcript.semesters || []).map(function (s) {
          return {
            term: s.term,
            creditsEarned: s.earned || 0,
            sgpa: typeof s.sgpa === 'number' ? s.sgpa : null,
            cgpa: typeof s.cgpa === 'number' ? s.cgpa : null,
            courses: (s.courses || []).map(function (c) {
              return {
                code: c.code,
                title: c.title,
                creditHours: c.cr || 0,
                grade: c.grade || '',
                gradePoints: c.gp || 0
              };
            })
          };
        }),
        totals: {
          creditsEarned: (transcript.totals || {}).credits || 0,
          creditsForGpa: (transcript.totals || {}).gpaCredits || 0,
          gradePoints: (transcript.totals || {}).points || 0,
          cgpa: (transcript.totals || {}).cgpa || 0
        }
      } : null,
      payments: payments ? {
        items: (payments.items || []).map(function (p) {
          return {
            date: p.date,
            at: p.at || 0,
            challan: p.challan || '',
            account: p.account || '',
            amount: p.amount || 0,
            bank: p.bank || ''
          };
        }),
        pages: payments.pages || 1
      } : null,
      readAt: {
        schedule: U.store.stamp('schedule') || undefined,
        transcript: U.store.stamp('transcript') || undefined,
        payments: U.store.stamp('payments') || undefined
      },
      exportedAt: Date.now()
    };
  }

  U.exportSnapshot = buildSnapshot;

  /* the popup asks for this when the student presses "Send to web app" */
  try {
    if (chrome && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(function (msg, sender, reply) {
        if (!msg || msg.umtx !== 'snapshot') return;
        try {
          reply({ ok: true, snapshot: buildSnapshot() });
        } catch (e) {
          reply({ ok: false, error: e.message });
        }
        return true;
      });
    }
  } catch (e) { /* not in an extension context */ }
})();
