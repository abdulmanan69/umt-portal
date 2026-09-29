/* UMT Portal - Reimagined | pages: what each screen gets on top of the theme */
(function () {
  'use strict';
  const U = window.UMTX;
  if (!U) return;
  const el = U.el, qs = U.qs, qsa = U.qsa;

  function canvas() { return qs('.outer-w3-agile') || qs('#content'); }

  function btn(label, icon, onClick, primary) {
    return el('button', {
      type: 'button',
      class: 'btn' + (primary ? ' btn-primary' : ''),
      onclick: onClick
    }, [icon ? el('i', { class: 'fas ' + icon, style: 'margin-right:7px' }) : null, document.createTextNode(label)]);
  }

  function link(label, href, icon, primary) {
    return el('a', { class: 'btn' + (primary ? ' btn-primary' : ''), href: href }, [
      icon ? el('i', { class: 'fas ' + icon, style: 'margin-right:7px' }) : null, document.createTextNode(label)
    ]);
  }

  /* ---- dashboard --------------------------------------------------------- */
  function tidyTiles() {
    qsa('.dashboard-card').forEach(function (card, i) {
      const body = card.querySelector('.card-body');
      if (!body) return;
      const img = card.querySelector('.card-icon img, .card-body > img');
      if (img) {
        if (!img.closest('.card-icon')) {
          const plate = el('div', { class: 'card-icon' });
          img.parentNode.insertBefore(plate, img);
          plate.appendChild(img);
        }
        /* the same artwork, blown up behind the tile */
        if (!card.querySelector('.umtx-tileart')) {
          card.appendChild(el('img', { class: 'umtx-tileart', src: img.src, alt: '', 'aria-hidden': 'true' }));
        }
      }
      card.classList.add('umtx-rise');
      card.style.setProperty('--i', i + 2);
    });
  }

  function academicOverview(mount) {
    const host = el('div', { id: 'umtx-overview' }, [
      U.ui.loading('Reading your academic record', 'This is kept on your machine, so it only happens once in a while.')
    ]);
    mount.parentNode.insertBefore(host, mount);

    const paint = function (t) {
      const d = U.data.derive(t);
      host.innerHTML = '';
      host.appendChild(U.ui.hero(t, d));
      host.appendChild(U.ui.stats(t, d));
      host.appendChild(U.ui.block({
        id: 'umtx-degreemap',
        title: 'Your degree so far',
        note: 'Every course you have taken, one row per semester. Hover a chip for the course and grade.',
        actions: [link('Full transcript', '/Transcript', 'fa-graduation-cap')],
        body: el('div', {}, [U.ui.degreeMap(t.semesters), U.ui.freshness('transcript')])
      }));
      layoutDashboard(mount);
    };

    /* redraw in place when a background refresh brings something newer */
    document.addEventListener('umtx:record', function (e) {
      if (e.detail && e.detail.name === 'transcript') {
        const fresh = U.data.cached('transcript');
        if (fresh) paint(fresh);
      }
    });

    U.data.load('transcript').then(paint).catch(function (err) {
      host.innerHTML = '';
      host.appendChild(el('div', { class: 'umtx-block' }, [
        el('div', { class: 'umtx-blockhead' }, [
          el('div', {}, [
            el('h2', { text: 'Academic overview is unavailable' }),
            el('p', { text: 'The transcript report did not load, so the summary cannot be built. ' + err.message })
          ]),
          el('div', { class: 'umtx-actions' }, [
            btn('Try again', 'fa-sync-alt', function () { location.reload(); })
          ])
        ])
      ]));
    });
  }

  /* Put the portal blocks into two columns: record on the left, actions on the right. */
  function layoutDashboard(tiles) {
    if (qs('#umtx-columns')) return;
    const root = canvas();
    const accordion = qs('.demo') || qs('#accordion');
    if (!root || !tiles) return;

    const left = el('div', { class: 'umtx-col', id: 'umtx-col-main' });
    const right = el('div', { class: 'umtx-col', id: 'umtx-col-side' });
    const columns = el('div', { class: 'umtx-columns', id: 'umtx-columns' }, [left, right]);
    tiles.parentNode.insertBefore(columns, tiles);

    const mapBlock = qs('#umtx-degreemap');
    if (mapBlock) left.appendChild(mapBlock);
    right.appendChild(U.ui.eyebrow('Go somewhere'));
    right.appendChild(tiles);

    /* the week needs the full width to show every day in one row */
    if (accordion) {
      const semester = el('div', { id: 'umtx-semester' }, [U.ui.eyebrow('This semester'), accordion]);
      columns.parentNode.insertBefore(semester, columns.nextSibling);
    }
  }

  function dashboard() {
    tidyTiles();
    const tiles = qs('.dashboard-container');
    if (!tiles) return;
    if (!qs('#umtx-overview')) academicOverview(tiles);
    watchAccordion();
  }

  /* the portal leaves the open/closed marker out of step with the panel */
  function syncPanelMarkers() {
    qsa('.panel').forEach(function (panel) {
      const body = panel.querySelector('.panel-collapse');
      const trigger = panel.querySelector('.panel-title a, .panel-title button');
      if (!body || !trigger) return;
      const open = body.classList.contains('show') || body.classList.contains('in');
      trigger.classList.toggle('collapsed', !open);
      trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function watchAccordion() {
    try { enhanceSchedule(); } catch (e) { console.warn('[umtx] timetable', e); }
    syncPanelMarkers();
    qsa('.panel-collapse').forEach(function (body) {
      new MutationObserver(syncPanelMarkers).observe(body, { attributes: true, attributeFilter: ['class'] });
      body.addEventListener('transitionend', syncPanelMarkers);
    });
    qsa('.panel-collapse').forEach(function (panel) {
      const obs = new MutationObserver(function () { U.shell.labelTables(panel); });
      obs.observe(panel, { childList: true, subtree: true });
    });
    U.shell.labelTables(document);
  }

  /* ---- timetable --------------------------------------------------------- */
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const COURSE_TINTS = ['#F59B1C', '#4CC9F0', '#34D399', '#A78BFA', '#FB7185', '#38BDF8', '#FBBF24'];

  function courseTint(code) {
    let n = 0;
    for (let i = 0; i < code.length; i++) n = (n * 31 + code.charCodeAt(i)) % 9973;
    return COURSE_TINTS[n % COURSE_TINTS.length];
  }

  function minutesOf(clock) {
    const m = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i.exec((clock || '').trim());
    if (!m) return null;
    let h = parseInt(m[1], 10) % 12;
    if (/pm/i.test(m[3])) h += 12;
    return h * 60 + parseInt(m[2], 10);
  }

  function shortClock(clock) {
    return (clock || '').replace(/^0/, '').replace(/\s*([AP])M$/i, function (all, p) { return p.toLowerCase() + 'm'; });
  }

  function readTable(root) {
    const table = root && root.querySelector('table');
    if (!table) return [];
    const rows = [...table.rows].map(function (r) {
      return [...r.cells].map(function (c) { return (c.textContent || '').replace(/\s+/g, ' ').trim(); });
    });
    if (!rows.length) return [];
    const head = rows[0].map(function (h) { return h.toLowerCase(); });
    return rows.slice(1).filter(function (r) { return r.some(Boolean); }).map(function (r) {
      const o = {};
      head.forEach(function (key, i) { o[key] = r[i] || ''; });
      return o;
    });
  }

  function parseSchedule() {
    const classes = readTable(qs('#collapseThree .panel-body')).map(function (r) {
      return {
        day: r['day'] || '',
        code: r['c.code'] || r['code'] || '',
        name: r['name'] || '',
        faculty: r['faculty'] || '',
        type: r['type'] || '',
        mode: r['mode'] || '',
        start: r['start time'] || '',
        end: r['end time'] || '',
        room: r['room'] || ''
      };
    }).filter(function (c) { return c.code && c.day; });

    const courses = readTable(qs('#collapseOne .panel-body')).map(function (r) {
      return {
        code: r['id'] || '',
        title: r['title'] || '',
        cr: parseFloat(r['cr.hr']) || 0,
        type: r['type'] || '',
        faculty: r['faculty'] || '',
        email: r['email'] || '',
        mode: r['mode'] || '',
        section: r['section'] || '',
        term: r['semester'] || ''
      };
    }).filter(function (c) { return c.code; });

    classes.sort(function (a, b) {
      const d = DAYS.indexOf(a.day) - DAYS.indexOf(b.day);
      return d !== 0 ? d : (minutesOf(a.start) || 0) - (minutesOf(b.start) || 0);
    });
    return { classes: classes, courses: courses, term: (courses[0] || {}).term || '' };
  }

  function nextClass(classes, now) {
    const today = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const minsNow = now.getHours() * 60 + now.getMinutes();
    for (let ahead = 0; ahead < 7; ahead++) {
      const dayIndex = (today + ahead) % 7;
      const dayName = DAYS[dayIndex];
      const onThatDay = classes.filter(function (c) { return c.day === dayName; });
      for (let i = 0; i < onThatDay.length; i++) {
        const start = minutesOf(onThatDay[i].start);
        if (start === null) continue;
        if (ahead > 0 || start > minsNow) {
          return { klass: onThatDay[i], ahead: ahead, dayName: dayName };
        }
      }
    }
    return null;
  }

  function isNow(klass, now) {
    const today = DAYS[now.getDay() === 0 ? 6 : now.getDay() - 1];
    if (klass.day !== today) return false;
    const mins = now.getHours() * 60 + now.getMinutes();
    const a = minutesOf(klass.start), b = minutesOf(klass.end);
    return a !== null && b !== null && mins >= a && mins <= b;
  }

  function classCard(klass, now) {
    const tint = courseTint(klass.code);
    const meta = [];
    if (klass.room) meta.push(el('span', { class: 'umtx-pill' }, [el('i', { class: 'fas fa-location-dot' }), document.createTextNode(klass.room)]));
    if (klass.type) meta.push(el('span', { class: 'umtx-pill', text: klass.type }));
    if (klass.mode) meta.push(el('span', { class: 'umtx-pill', text: klass.mode }));
    if (klass.faculty) meta.push(el('span', { class: 'umtx-pill' }, [el('i', { class: 'fas fa-user' }), document.createTextNode(klass.faculty)]));

    const card = el('article', {
      class: 'umtx-class',
      style: '--course:' + tint,
      title: klass.code + '  ' + klass.name
    }, [
      el('time', { text: shortClock(klass.start) + ' - ' + shortClock(klass.end) }),
      el('b', {}, [el('span', { text: klass.code }), document.createTextNode(klass.name)]),
      meta.length ? el('div', { class: 'umtx-classmeta' }, meta) : null
    ]);
    if (isNow(klass, now)) card.setAttribute('data-now', '1');
    return card;
  }

  function weekBoard(schedule) {
    const now = new Date();
    const today = DAYS[now.getDay() === 0 ? 6 : now.getDay() - 1];
    const used = DAYS.filter(function (d) {
      return schedule.classes.some(function (c) { return c.day === d; });
    });
    const days = used.length ? used : DAYS.slice(0, 5);

    return el('div', { class: 'umtx-week' }, days.map(function (day) {
      const list = schedule.classes.filter(function (c) { return c.day === day; });
      const total = list.reduce(function (n, c) {
        const a = minutesOf(c.start), b = minutesOf(c.end);
        return n + (a !== null && b !== null ? b - a : 0);
      }, 0);
      const box = el('section', { class: 'umtx-day' }, [
        el('header', { class: 'umtx-dayhead' }, [
          el('b', { text: day.slice(0, 3) }),
          el('small', { text: list.length ? list.length + (total ? ' | ' + Math.round(total / 60 * 10) / 10 + 'h' : '') : 'free' })
        ]),
        list.length
          ? el('div', { class: 'umtx-daybody' }, list.map(function (c) { return classCard(c, now); }))
          : el('p', { class: 'umtx-dayfree', text: 'No classes' })
      ]);
      if (day === today) box.setAttribute('data-today', '1');
      return box;
    }));
  }

  function nextClassCard(schedule) {
    const now = new Date();
    const next = nextClass(schedule.classes, now);
    if (!next) return null;
    const when = next.ahead === 0 ? 'Today' : next.ahead === 1 ? 'Tomorrow' : next.dayName;
    const k = next.klass;
    return el('div', { class: 'umtx-next' }, [
      el('i', { class: 'fas fa-circle-play' }),
      el('div', {}, [
        el('b', { text: k.code + ' - ' + k.name }),
        el('small', { text: when + ', ' + shortClock(k.start) + (k.room ? ' in ' + k.room : '') })
      ])
    ]);
  }

  function courseCards(schedule) {
    return el('div', { class: 'umtx-coursegrid' }, schedule.courses.map(function (c) {
      const meta = [];
      if (c.cr) meta.push(el('span', { class: 'umtx-pill', text: c.cr + ' cr' }));
      if (c.type) meta.push(el('span', { class: 'umtx-pill', text: c.type.replace(/ Course$/, '') }));
      if (c.section) meta.push(el('span', { class: 'umtx-pill', text: 'Section ' + c.section }));
      if (c.mode) meta.push(el('span', { class: 'umtx-pill', text: c.mode }));
      const perWeek = schedule.classes.filter(function (k) { return k.code === c.code; }).length;
      if (perWeek) meta.push(el('span', { class: 'umtx-pill' }, [el('i', { class: 'fas fa-calendar' }), document.createTextNode(perWeek + ' / week')]));
      return el('article', { class: 'umtx-coursecard', style: '--course:' + courseTint(c.code) }, [
        el('b', {}, [el('span', { text: c.code }), document.createTextNode(c.title)]),
        el('div', { class: 'umtx-classmeta' }, meta)
      ]);
    }));
  }

  function enhanceSchedule() {
    const ttBody = qs('#collapseThree .panel-body');
    const rcBody = qs('#collapseOne .panel-body');
    if (!ttBody || ttBody.getAttribute('data-umtx-done')) return;

    const schedule = parseSchedule();
    if (!schedule.classes.length && !schedule.courses.length) return;
    ttBody.setAttribute('data-umtx-done', '1');
    U.store.write('schedule', schedule);

    /* timetable */
    const rawTable = ttBody.querySelector('table');
    const board = el('div', {}, [
      el('div', { class: 'umtx-weekhead' }, [
        nextClassCard(schedule) || el('span', { class: 'umtx-tag', text: 'No upcoming class found' }),
        el('div', { class: 'umtx-actions' }, [
          btn('Table view', 'fa-table', function (e) {
            const showing = board.getAttribute('data-umtx-raw') === '1';
            board.setAttribute('data-umtx-raw', showing ? '0' : '1');
            week.style.display = showing ? '' : 'none';
            if (rawTable) rawTable.closest('.umtx-tablewrap, table').style.display = showing ? 'none' : '';
            e.currentTarget.lastChild.textContent = showing ? 'Table view' : 'Week view';
          })
        ])
      ])
    ]);
    const week = weekBoard(schedule);
    board.appendChild(week);
    ttBody.insertBefore(board, ttBody.firstChild);
    if (rawTable) {
      const holder = rawTable.closest('.umtx-tablewrap') || rawTable;
      holder.style.display = 'none';
    }

    /* the same week, summarised in the panel heading */
    const heading = qs('#headingThree .panel-title a, #headingThree .panel-title button');
    if (heading && !qs('.umtx-headcount', heading)) {
      const hours = schedule.classes.reduce(function (n, c) {
        const a = minutesOf(c.start), b = minutesOf(c.end);
        return n + (a !== null && b !== null ? b - a : 0);
      }, 0);
      heading.appendChild(el('small', {
        class: 'umtx-headcount',
        text: schedule.classes.length + ' classes  |  ' + Math.round(hours / 60 * 10) / 10 + ' h a week'
      }));
    }

    /* registered courses */
    if (rcBody && schedule.courses.length && !rcBody.getAttribute('data-umtx-done')) {
      rcBody.setAttribute('data-umtx-done', '1');
      const rcTable = rcBody.querySelector('table');
      rcBody.insertBefore(courseCards(schedule), rcBody.firstChild);
      if (rcTable) {
        const holder = rcTable.closest('.umtx-tablewrap') || rcTable;
        holder.style.display = 'none';
        rcBody.appendChild(el('div', { class: 'umtx-actions', style: 'margin-top:14px' }, [
          btn('Table view', 'fa-table', function (e) {
            const hidden = holder.style.display === 'none';
            holder.style.display = hidden ? '' : 'none';
            e.currentTarget.lastChild.textContent = hidden ? 'Card view' : 'Table view';
          })
        ]));
      }
      const rcHeading = qs('#headingOne .panel-title a, #headingOne .panel-title button');
      if (rcHeading && !qs('.umtx-headcount', rcHeading)) {
        const credits = schedule.courses.reduce(function (n, c) { return n + (c.cr || 0); }, 0);
        rcHeading.appendChild(el('small', {
          class: 'umtx-headcount',
          text: schedule.courses.length + ' courses  |  ' + credits + ' credit hours' + (schedule.term ? '  |  ' + schedule.term : '')
        }));
      }
    }

    /* the timetable is the thing people come for, so open it once */
    if (U.LS.get('timetable.opened', '0') !== '1') {
      U.LS.set('timetable.opened', '1');
      const panel = qs('#collapseThree');
      const trigger = qs('#headingThree .panel-title a, #headingThree .panel-title button');
      if (panel && !panel.classList.contains('show') && !panel.classList.contains('in')) {
        panel.classList.add('show', 'in');
        panel.style.height = 'auto';
        if (trigger) { trigger.classList.remove('collapsed'); trigger.setAttribute('aria-expanded', 'true'); }
      }
    }
  }

  /* ---- transcript -------------------------------------------------------- */
  function gradeChip(grade) {
    const text = (grade || '--').trim() || '--';
    return el('span', {
      class: 'umtx-gchip g-' + U.data.band(grade),
      title: gradeMeaning(text)
    }, [document.createTextNode(text)]);
  }

  const GRADE_WORDS = {
    'SA': 'Substitute or adjusted course',
    'P': 'Pass, no grade points',
    'F': 'Fail',
    'W': 'Withdrawn',
    'I': 'Incomplete',
    '--': 'No grade recorded'
  };

  function gradeMeaning(g) {
    if (GRADE_WORDS[g]) return g + ' - ' + GRADE_WORDS[g];
    return 'Grade ' + g;
  }

  function courseKind(course) {
    if (/\(Lab\)|Lab$/i.test(course.title)) return 'Lab';
    if (/\[R\]/.test(course.title)) return 'Repeat';
    return '';
  }

  function gradeTable(sem) {
    const cols = el('colgroup', {}, [
      el('col', { style: 'width:92px' }),
      el('col', {}),
      el('col', { style: 'width:58px' }),
      el('col', { style: 'width:86px' }),
      el('col', { style: 'width:78px' })
    ]);
    const head = el('tr', { 'data-umtx-headrow': '1' }, [
      el('th', { text: 'Code' }),
      el('th', { text: 'Course' }),
      el('th', { class: 'c-num', text: 'Cr' }),
      el('th', { text: 'Grade' }),
      el('th', { class: 'c-num', text: 'Points' })
    ]);
    const rows = sem.courses.map(function (c) {
      const kind = courseKind(c);
      const title = el('td', { class: 'c-title', 'data-label': 'Course' }, [
        document.createTextNode(c.title.replace(/\s*\[R\]\s*/, ' ')),
        kind ? el('small', { text: kind }) : null
      ]);
      return el('tr', {
        'data-umtx-course': (c.code + ' ' + c.title + ' ' + (c.grade || '')).toLowerCase()
      }, [
        el('td', { class: 'c-code', 'data-label': 'Code', text: c.code }),
        title,
        el('td', { class: 'c-num', 'data-label': 'Credit hours', text: String(c.cr) }),
        el('td', { 'data-label': 'Grade' }, [gradeChip(c.grade)]),
        el('td', { class: 'c-num', 'data-label': 'Grade points', text: c.gp ? c.gp.toFixed(1) : '--' })
      ]);
    });
    const table = el('table', { class: 'table umtx-courses', 'data-umtx-cards': '1' }, [
      cols, el('tbody', {}, [head].concat(rows))
    ]);
    return el('div', { class: 'umtx-tablewrap' }, [table]);
  }

  function countBands(courses) {
    const c = { a: 0, b: 0, c: 0, f: 0, x: 0 };
    courses.forEach(function (course) { c[U.data.band(course.grade)]++; });
    return c;
  }

  function distributionBar(counts, total) {
    const order = ['a', 'b', 'c', 'f', 'x'];
    const sum = total || order.reduce(function (n, k) { return n + counts[k]; }, 0) || 1;
    return el('span', { class: 'umtx-bar' }, order.map(function (k) {
      if (!counts[k]) return null;
      return el('i', { class: 'g-' + k, style: 'width:' + (counts[k] / sum * 100).toFixed(1) + '%' });
    }));
  }

  function deltaTag(now, before) {
    if (typeof now !== 'number' || typeof before !== 'number') return null;
    const diff = now - before;
    const dir = Math.abs(diff) < 0.005 ? 'flat' : diff > 0 ? 'up' : 'down';
    const icon = dir === 'flat' ? 'fa-minus' : dir === 'up' ? 'fa-arrow-up' : 'fa-arrow-down';
    return el('span', { class: 'umtx-delta ' + dir }, [
      el('i', { class: 'fas ' + icon }),
      document.createTextNode(dir === 'flat' ? 'level' : Math.abs(diff).toFixed(2))
    ]);
  }

  function semesterMeta(sem, prev) {
    const counts = countBands(sem.courses);
    const labs = sem.courses.filter(function (c) { return courseKind(c) === 'Lab'; }).length;
    const parts = [
      el('span', {}, [document.createTextNode('Credits '), el('b', { text: String(sem.earned || 0) })]),
      el('span', {}, [document.createTextNode('Courses '), el('b', { text: String(sem.courses.length) + (labs ? ' (' + labs + ' lab)' : '') })])
    ];
    if (sem.sgpa) {
      const sg = el('span', {}, [document.createTextNode('SGPA '), el('b', { text: sem.sgpa.toFixed(2) })]);
      parts.push(sg);
      const d = deltaTag(sem.sgpa, prev && prev.sgpa);
      if (d) parts.push(d);
    }
    if (sem.cgpa) parts.push(el('span', {}, [document.createTextNode('CGPA '), el('b', { text: sem.cgpa.toFixed(2) })]));
    parts.push(distributionBar(counts, sem.courses.length));
    return el('div', { class: 'umtx-semmeta' }, parts);
  }

  function badgeTone(grade) {
    const b = U.data.band(grade);
    return b === 'a' ? 'success' : b === 'b' ? 'primary' : b === 'c' ? 'warning' : b === 'f' ? 'danger' : 'dark';
  }

  function degreeSummary(t, d) {
    const totals = t.totals || {};
    const counts = { a: 0, b: 0, c: 0, f: 0, x: 0 };
    t.semesters.forEach(function (sem) {
      const c = countBands(sem.courses);
      Object.keys(counts).forEach(function (k) { counts[k] += c[k]; });
    });
    const figure = function (label, value, note) {
      return el('div', { class: 'umtx-figure' }, [
        el('small', { text: label }),
        el('b', { text: value }),
        note ? el('em', { text: note }) : null
      ]);
    };
    const legend = el('div', { class: 'umtx-legend', style: 'margin-top:12px' }, [
      el('span', {}, [el('i', { style: 'background:var(--u-good)' }), document.createTextNode(counts.a + ' in the A range')]),
      el('span', {}, [el('i', { style: 'background:var(--u-cyan)' }), document.createTextNode(counts.b + ' in the B range')]),
      el('span', {}, [el('i', { style: 'background:var(--u-warn)' }), document.createTextNode(counts.c + ' in the C range')]),
      counts.f ? el('span', {}, [el('i', { style: 'background:var(--u-bad)' }), document.createTextNode(counts.f + ' at D or F')]) : null,
      counts.x ? el('span', {}, [el('i', { style: 'background:var(--u-text-3)' }), document.createTextNode(counts.x + ' pass, audit or pending')]) : null
    ]);
    return U.ui.block({
      title: 'Where you stand',
      note: 'The figures the Controller of Examinations reports, and how your grades split.',
      body: el('div', {}, [
        el('div', { class: 'umtx-figures' }, [
          figure('Credit hours earned', String(totals.credits || 0), d.courses + ' courses'),
          figure('Credit hours for GPA', String(totals.gpaCredits || totals.credits || 0), 'counted toward CGPA'),
          figure('Total grade points', (totals.points || 0).toFixed(2), 'quality points'),
          figure('CGPA', (totals.cgpa || 0).toFixed(2), 'out of 4.00'),
          d.best ? figure('Best semester', d.best.sgpa.toFixed(2), d.best.term) : null
        ]),
        distributionBar(counts, d.courses),
        legend
      ])
    });
  }

  function applyCourseFilter(host, query, countNode, t) {
    const term = (query || '').trim().toLowerCase();
    let shown = 0;
    qsa('.umtx-semblock', host).forEach(function (block) {
      let visible = 0;
      qsa('tr[data-umtx-course]', block).forEach(function (row) {
        const hit = !term || row.getAttribute('data-umtx-course').indexOf(term) > -1;
        if (hit) { row.removeAttribute('data-umtx-hidden'); visible++; }
        else row.setAttribute('data-umtx-hidden', '1');
      });
      shown += visible;
      if (visible) block.removeAttribute('data-umtx-hidden');
      else block.setAttribute('data-umtx-hidden', '1');
    });
    const total = t.semesters.reduce(function (n, s) { return n + s.courses.length; }, 0);
    countNode.textContent = term
      ? shown + ' of ' + total + ' courses match "' + term + '".'
      : 'Newest semester first.';
  }

  function transcript() {
    const frame = qs('.embed-responsive');
    const root = canvas();
    if (!frame || !root || qs('#umtx-transcript')) return;

    /* the report must keep loading, so park it off screen rather than hiding it */
    frame.classList.add('umtx-offscreen');
    const host = el('div', { id: 'umtx-transcript' });
    frame.parentNode.insertBefore(host, frame);

    const heading = qs('.section-header');

    const render = function (t, stale) {
      const d = U.data.derive(t);
      host.innerHTML = '';
      if (heading) heading.style.display = 'none';
      host.appendChild(U.ui.hero(t, d));
      host.appendChild(U.ui.stats(t, d));

      host.appendChild(U.ui.block({
        title: 'Semester by semester',
        note: 'Grade points across ' + d.graded.length + ' graded semesters.',
        body: U.ui.ridge(t.semesters, { w: 720, h: 190, pad: 26, labels: true })
      }));

      host.appendChild(U.ui.block({
        title: 'Your degree so far',
        note: 'One row per semester, chip width follows credit hours.',
        body: U.ui.degreeMap(t.semesters)
      }));

      host.appendChild(degreeSummary(t, d));

      const count = el('p', { text: 'Newest semester first.' });
      const filter = el('label', { class: 'umtx-filter umtx-noprint' }, [
        el('i', { class: 'fas fa-search' }),
        el('input', { type: 'search', placeholder: 'Filter by course, code or grade', 'aria-label': 'Filter courses' })
      ]);
      filter.querySelector('input').addEventListener('input', function (e) {
        applyCourseFilter(host, e.target.value, count, t);
      });

      host.appendChild(el('div', { class: 'umtx-blockhead', style: 'margin:26px 2px 12px' }, [
        el('div', {}, [el('h2', { text: 'Course detail' }), count]),
        el('div', { class: 'umtx-actions' }, [
          filter,
          btn('Print this page', 'fa-print', function () { window.print(); }),
          btn('Official report', 'fa-file-alt', function (e) { toggleReport(frame, e.currentTarget); })
        ])
      ]));

      t.semesters.slice().reverse().forEach(function (sem, i, list) {
        const prev = list[i + 1] || null;
        host.appendChild(el('section', { class: 'umtx-block umtx-semblock' }, [
          el('div', { class: 'umtx-blockhead' }, [
            el('div', {}, [el('h2', { text: sem.term }), semesterMeta(sem, prev)])
          ]),
          gradeTable(sem)
        ]));
      });

      host.appendChild(el('div', { class: 'umtx-noprint' }, [U.ui.freshness('transcript')]));
      host.appendChild(el('p', {
        class: 'umtx-noprint',
        style: 'margin:10px 2px 0;font-size:12px;color:var(--u-text-3)',
        text: 'Read from the portal transcript report and kept on this machine. For anything official, request a transcript from the Office of the Controller of Examinations.'
      }));
    };

    const cached = U.data.cached('transcript');
    if (cached && cached.semesters && cached.semesters.length) render(cached, true);
    else host.appendChild(U.ui.loading('Reading your academic record', 'The portal report takes a few seconds to answer.'));

    U.data.load('transcript')
      .then(function (t) { render(t, false); })
      .catch(function (err) {
        if (cached && cached.semesters && cached.semesters.length) {
          U.shell.toast('Showing your saved record. The live report did not answer.', 'bad');
          return;
        }
        host.innerHTML = '';
        frame.classList.remove('umtx-offscreen');
        if (heading) heading.style.display = '';
        U.shell.toast('Could not read the transcript report: ' + err.message, 'bad');
      });
  }

  /* ---- report pages: payments, roadmap, store ---------------------------- */
  function frameHasError(iframe) {
    return reportState(iframe) === 'error';
  }

  /* pending, ok, blank or error - blank is what the portal returns most often
     when its report service is having a bad day */
  function reportState(iframe) {
    let doc = null;
    try { doc = iframe && iframe.contentDocument; } catch (e) { return 'pending'; }
    if (!doc || !doc.body) return 'pending';
    const text = doc.body.innerText || '';
    if (/Server Error|Object reference not set|Runtime Error/i.test(text)) return 'error';
    if (doc.readyState !== 'complete') return 'pending';
    if (text.replace(/\s+/g, '').length > 40 || doc.querySelectorAll('table').length > 1) return 'ok';
    return 'blank';
  }

  function frameNote(frame, state) {
    const existing = qs('.umtx-framenote', frame);
    if (existing) existing.remove();
    if (state === 'ok') { frame.removeAttribute('data-umtx-state'); return; }
    frame.setAttribute('data-umtx-state', state);
    const iframe = qs('iframe', frame);
    const note = el('div', { class: 'umtx-framenote' }, [
      el('i', { class: 'fas ' + (state === 'error' ? 'fa-exclamation-triangle' : 'fa-file-alt'), style: 'font-size:22px;color:var(--u-text-3)' }),
      el('h3', { text: state === 'error' ? 'The portal report service returned an error' : 'The portal returned an empty report' }),
      el('p', { text: 'This report is built once per page load on the portal side, and it fails now and then. Everything above was read from your saved copy.' }),
      el('div', { class: 'umtx-actions' }, [
        btn('Reload the page', 'fa-sync-alt', function () { location.reload(); }, true),
        iframe ? link('Open the report in a new tab', iframe.src, 'fa-external-link-alt') : null
      ])
    ]);
    frame.appendChild(note);
  }

  /* Show or hide the portal's own report, and be honest about what turned up. */
  function toggleReport(frame, button) {
    const hidden = frame.classList.toggle('umtx-offscreen');
    if (button && button.lastChild) button.lastChild.textContent = hidden ? 'Official report' : 'Hide official report';
    if (hidden) return;
    const iframe = qs('iframe', frame);
    frame.scrollIntoView({ behavior: 'smooth', block: 'start' });
    let tries = 0;
    const settle = function () {
      const state = reportState(iframe);
      if (state === 'pending' && tries++ < 20) return setTimeout(settle, 500);
      frameNote(frame, state === 'pending' ? 'blank' : state);
    };
    settle();
  }

  /* A report renders once per page load. Re-pointing the frame at the same URL
     makes the portal answer with an error, so the only real retry is a page
     reload, and that is the user's call. */
  function watchReport(frame, iframe) {
    if (!iframe) return;
    const check = function () {
      const state = reportState(iframe);
      if (state === 'pending' || state === 'ok') return;
      if (!frame.classList.contains('umtx-offscreen')) frameNote(frame, state);
      if (qs('#umtx-reporterr')) return;
      const note = el('div', { class: 'alert alert-warning', id: 'umtx-reporterr' }, [
        el('strong', { text: 'The portal report service did not answer. ' }),
        document.createTextNode('It only builds this report once per page load. '),
        btn('Reload the page', 'fa-sync-alt', function () { location.reload(); })
      ]);
      frame.parentNode.insertBefore(note, frame);
    };
    iframe.addEventListener('load', function () { setTimeout(check, 600); });
    setTimeout(check, 3000);
  }

  function reportFrame(opts) {
    const frame = qs('.embed-responsive');
    if (!frame || qs('#umtx-framebar')) return;
    const iframe = qs('iframe', frame);
    watchReport(frame, iframe);
    let tall = U.LS.get('frame.tall', '0') === '1';
    let dark = U.LS.get('frame.dark', '0') === '1';
    frame.classList.toggle('umtx-frame-dark', dark);
    const apply = function () {
      frame.style.height = tall ? 'calc(100vh - 150px)' : '';
      frame.style.maxHeight = tall ? 'none' : '';
    };
    apply();

    const bar = el('div', { class: 'umtx-framebar', id: 'umtx-framebar' }, [
      btn(tall ? 'Fit to page' : 'Taller view', 'fa-expand', function (e) {
        tall = !tall;
        U.LS.set('frame.tall', tall ? '1' : '0');
        apply();
        e.currentTarget.lastChild.textContent = tall ? 'Fit to page' : 'Taller view';
      }),
      btn('Reload report', 'fa-sync-alt', function () { location.reload(); }),
      iframe ? link('Open in a new tab', iframe.src, 'fa-external-link-alt') : null,
      btn(dark ? 'Report in white' : 'Report in dark', 'fa-adjust', function (e) {
        dark = !dark;
        U.LS.set('frame.dark', dark ? '1' : '0');
        frame.classList.toggle('umtx-frame-dark', dark);
        e.currentTarget.lastChild.textContent = dark ? 'Report in white' : 'Report in dark';
      }),
      opts && opts.extra ? opts.extra : null
    ]);
    frame.parentNode.insertBefore(bar, frame);
  }

  /* ---- payments ---------------------------------------------------------- */
  function paymentsView() {
    const frame = qs('.embed-responsive');
    const root = canvas();
    if (!frame || !root || qs('#umtx-payments')) return;

    frame.classList.add('umtx-offscreen');
    const host = el('div', { id: 'umtx-payments' });
    frame.parentNode.insertBefore(host, frame);
    const heading = qs('.section-header');

    const render = function (p) {
      const d = U.data.derivePayments(p);
      if (!d) return;
      host.innerHTML = '';
      if (heading) heading.style.display = 'none';

      const s = p.student || {};
      host.appendChild(el('section', { class: 'umtx-hero umtx-hero-flat' }, [
        el('div', {}, [
          el('div', { class: 'umtx-hero-eyebrow' }, [el('i', { class: 'fas fa-wallet' }), document.createTextNode('Payment history')]),
          el('h1', { text: U.ui.currency(d.total) }),
          el('p', { text: 'Across ' + d.count + ' payments, from ' + d.first.date + ' to ' + d.last.date + '.' }),
          el('div', { class: 'umtx-meta' }, [
            s.id ? U.ui.tag('fa-id-card', s.id) : null,
            s.program ? U.ui.tag('fa-graduation-cap', s.program) : null,
            s.batch ? U.ui.tag('fa-users', s.batch) : null
          ]),
          el('div', { class: 'umtx-heroactions' }, [
            el('a', { class: 'umtx-heroaction is-primary', href: '/Payment/Payment_Voucher' }, [
              el('i', { class: 'fas fa-file-invoice' }), document.createTextNode('Pending voucher')
            ])
          ])
        ])
      ]));

      const stats = el('div', { class: 'umtx-stats' }, [
        statTile(0, 'fa-coins', 'Total paid', U.ui.currency(d.total), d.count + ' payments'),
        statTile(1, 'fa-calendar-day', 'Last payment', U.ui.currency(d.last.amount), d.last.date),
        statTile(2, 'fa-arrow-up', 'Largest payment', U.ui.currency(d.largest.amount), d.largest.account),
        statTile(3, 'fa-chart-bar', 'This year', U.ui.currency(yearTotal(d, String(new Date().getFullYear()))), String(new Date().getFullYear()))
      ]);
      host.appendChild(stats);

      const list = el('div', { class: 'umtx-paylist' });
      const years = {};
      p.items.slice().reverse().forEach(function (item) {
        const year = item.date.slice(-4);
        if (!years[year]) {
          years[year] = true;
          list.appendChild(el('div', { class: 'umtx-yearhead' }, [
            el('b', { text: year }),
            el('span', { text: U.ui.currency(yearTotal(d, year)) })
          ]));
        }
        list.appendChild(el('div', { class: 'umtx-payrow' }, [
          el('span', { class: 'umtx-paydate', text: item.date }),
          el('span', { class: 'umtx-paywhat' }, [
            el('b', { text: item.account }),
            el('small', { text: 'Challan ' + item.challan + (item.bank ? '  |  ' + item.bank : '') })
          ]),
          el('span', { class: 'umtx-payamt', text: U.ui.currency(item.amount) })
        ]));
      });

      host.appendChild(U.ui.block({
        title: 'Every payment',
        note: 'Newest first, grouped by year.',
        actions: [
          btn('Official report', 'fa-file-alt', function (e) { toggleReport(frame, e.currentTarget); }),
          btn('Print', 'fa-print', function () { window.print(); })
        ],
        body: el('div', {}, [list, U.ui.freshness('payments')])
      }));

      if (p.pages > 1) {
        host.appendChild(el('p', {
          style: 'margin:10px 2px 0;font-size:12px;color:var(--u-text-3)',
          text: 'The portal prints this report across ' + p.pages + ' pages. These figures cover the ' + d.count + ' payments it lists.'
        }));
      }
    };

    document.addEventListener('umtx:record', function (e) {
      if (e.detail && e.detail.name === 'payments') {
        const fresh = U.data.cached('payments');
        if (fresh) render(fresh);
      }
    });

    const cached = U.data.cached('payments');
    if (cached && cached.items && cached.items.length) render(cached);
    else host.appendChild(U.ui.loading('Reading your payment history', 'The portal report takes a few seconds the first time.'));

    U.data.load('payments').then(render).catch(function (err) {
      if (cached && cached.items && cached.items.length) return;
      host.innerHTML = '';
      frame.classList.remove('umtx-offscreen');
      if (heading) heading.style.display = '';
      U.shell.toast('Could not read the payment report: ' + err.message, 'bad');
    });
  }

  function yearTotal(d, year) {
    const hit = d.byYear.filter(function (y) { return y.year === year; })[0];
    return hit ? hit.amount : 0;
  }

  function statTile(index, icon, label, value, note) {
    return el('div', { class: 'umtx-stat umtx-rise', style: '--i:' + index }, [
      el('span', { class: 'umtx-staticon' }, [el('i', { class: 'fas ' + icon })]),
      el('div', { class: 'umtx-statbody' }, [
        el('small', { text: label }),
        el('b', { text: value }),
        note ? el('em', { text: note }) : null
      ])
    ]);
  }

  /* ---- requests ---------------------------------------------------------- */
  function requests() {
    const table = qs('table.table');
    if (!table || qs('#umtx-reqsummary')) return;
    const counts = {};
    qsa('tbody tr', table).forEach(function (row) {
      const badge = row.querySelector('.badge');
      if (!badge) return;
      const key = (badge.textContent || '').trim();
      counts[key] = (counts[key] || 0) + 1;
    });
    const keys = Object.keys(counts);
    if (!keys.length) return;
    const total = keys.reduce(function (n, k) { return n + counts[k]; }, 0);
    const cards = [el('div', { class: 'umtx-stat' }, [
      el('div', { class: 'umtx-statbody' }, [el('small', { text: 'All requests' }), el('b', { text: String(total) })])
    ])].concat(keys.map(function (k) {
      return el('div', { class: 'umtx-stat' }, [
        el('div', { class: 'umtx-statbody' }, [el('small', { text: k }), el('b', { text: String(counts[k]) })])
      ]);
    }));
    const grid = el('div', { class: 'umtx-stats', id: 'umtx-reqsummary' }, cards);
    table.parentNode.insertBefore(grid, table);
  }

  /* ---- empty screens ----------------------------------------------------- */
  const EMPTY_ACTIONS = {
    '/mycourses': [['Register for courses', '/CourseRequest', 'fa-plus-square', true], ['See your transcript', '/Transcript', 'fa-graduation-cap']],
    '/attendance': [['Register for courses', '/CourseRequest', 'fa-plus-square', true], ['Check your road map', '/Roadmap', 'fa-map']],
    '/studentfeedback': [['Back to dashboard', '/Home/Index', 'fa-th-large', true]],
    '/announcements': [['Back to dashboard', '/Home/Index', 'fa-th-large', true]]
  };

  function emptyStates() {
    const here = location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    const actions = EMPTY_ACTIONS[here];
    if (!actions) return;
    const box = qs('.outer-w3-agile .container.text-center') || qs('.outer-w3-agile');
    const heading = box && (box.querySelector('h2') || box.querySelector('h3'));
    if (!heading || qs('#umtx-emptyact')) return;
    const row = el('div', { class: 'umtx-actions', id: 'umtx-emptyact', style: 'margin-top:8px' },
      actions.map(function (a) { return link(a[0], a[1], a[2], a[3]); }));
    heading.parentNode.appendChild(row);
  }

  /* ---- login ------------------------------------------------------------- */
  function login() {
    document.documentElement.setAttribute('data-umtx-login', '1');
    const form = qs('#loginform') || qs('form');
    if (!form || qs('#umtx-loginnote')) return;
    form.insertBefore(el('p', {
      id: 'umtx-loginnote',
      class: 'umtx-loginnote',
      text: 'Sign in with your UMT student ID and the code shown below.'
    }), form.firstChild);

    /* the three account links belong on one line */
    const accountLinks = qsa('a.account', form);
    if (accountLinks.length && !qs('#umtx-loginlinks')) {
      const row = el('div', { id: 'umtx-loginlinks', class: 'umtx-loginlinks' });
      accountLinks[0].closest('.container-fluid').parentNode.insertBefore(row, accountLinks[0].closest('.container-fluid'));
      accountLinks.forEach(function (a) {
        const holder = a.closest('.container-fluid');
        row.appendChild(a);
        if (holder && !holder.querySelector('a')) holder.remove();
      });
    }

    /* the colour logo disappears on a dark card, so use the white one there */
    const logo = qs('.wrap-login100 > img');
    if (logo) {
      const colour = logo.src;
      const sync = function () {
        const dark = document.documentElement.getAttribute('data-umtx-theme') === 'dark';
        logo.src = dark ? location.origin + '/img/umtlogowhite.png' : colour;
      };
      sync();
      new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ['data-umtx-theme'] });
    }
  }

  U.pages = {
    run: function () {
      const here = location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
      if (here === '/' || here === '/home' || here === '/home/index' || here === '/studentundertaking') dashboard();
      if (here === '/transcript') transcript();
      if (here === '/payment') paymentsView();
      if (here === '/payment/payment_voucher' || here === '/roadmap' || here === '/home/umtstore' || here === '/advisor') reportFrame();
      if (here.indexOf('/managerequests/getallrequests') === 0) requests();
      if (here.indexOf('/account/login') === 0) login();
      emptyStates();
      U.shell.labelTables(document);
    }
  };
})();
