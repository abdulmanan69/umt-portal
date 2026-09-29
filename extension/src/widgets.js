/* UMT Portal - Reimagined | widgets: the pieces the academic views are built from */
(function () {
  'use strict';
  const U = window.UMTX;
  if (!U) return;
  const el = U.el;
  const SVGNS = 'http://www.w3.org/2000/svg';

  function svg(tag, attrs, kids) {
    const node = document.createElementNS(SVGNS, tag);
    for (const k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (kid) { node.appendChild(kid); });
    return node;
  }

  function block(opts) {
    const head = el('div', { class: 'umtx-blockhead' }, [
      el('div', {}, [
        el('h2', { text: opts.title }),
        opts.note ? el('p', { text: opts.note }) : null
      ]),
      opts.actions ? el('div', { class: 'umtx-actions' }, opts.actions) : null
    ]);
    return el('section', { class: 'umtx-block', id: opts.id || null }, [head, opts.body]);
  }

  function tag(icon, text) {
    return el('span', { class: 'umtx-tag' }, [icon ? el('i', { class: 'fas ' + icon }) : null, document.createTextNode(text)]);
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return 'Still up';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }

  /* the GPA ridge: one step per graded semester */
  function ridge(semesters, opts) {
    const o = opts || {};
    const w = o.w || 300, h = o.h || 86, pad = o.pad || 18;
    const pts = semesters.filter(function (s) { return typeof s.sgpa === 'number' && s.sgpa > 0; });
    if (pts.length < 2) return el('div', { class: 'umtx-tag', text: 'A trend appears once two semesters are graded' });

    const lo = 1.8, hi = 4;
    const innerW = w - pad * 2, innerH = h - pad * 2;
    const x = function (i) { return pad + (pts.length === 1 ? innerW / 2 : innerW * i / (pts.length - 1)); };
    const y = function (v) { return pad + innerH * (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)); };

    const line = pts.map(function (s, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(s.sgpa).toFixed(1); }).join(' ');
    const area = line + ' L' + x(pts.length - 1).toFixed(1) + ' ' + (h - pad) + ' L' + x(0).toFixed(1) + ' ' + (h - pad) + ' Z';

    const defs = svg('defs', {}, [
      svg('linearGradient', { id: 'umtxRidgeFill', x1: '0', y1: '0', x2: '0', y2: '1' }, [
        svg('stop', { offset: '0%', 'stop-color': '#F59B1C', 'stop-opacity': '.30' }),
        svg('stop', { offset: '100%', 'stop-color': '#F59B1C', 'stop-opacity': '0' })
      ])
    ]);

    const kids = [defs,
      svg('line', { class: 'r-grid', x1: pad, y1: y(3), x2: w - pad, y2: y(3) }),
      svg('path', { class: 'r-area', d: area }),
      svg('path', { class: 'r-line', d: line })
    ];

    pts.forEach(function (s, i) {
      kids.push(svg('circle', { class: 'r-dot', cx: x(i), cy: y(s.sgpa), r: 3.4 }));
      if (o.labels) {
        kids.push(svg('text', { class: 'r-lbl', x: x(i), y: h - 3, 'text-anchor': 'middle' },
          [document.createTextNode(s.term.replace(/\s+20/, ' '))]));
        kids.push(svg('text', { class: 'r-val', x: x(i), y: y(s.sgpa) - 9, 'text-anchor': 'middle' },
          [document.createTextNode(s.sgpa.toFixed(2))]));
      }
    });

    const node = svg('svg', {
      class: 'umtx-ridge', viewBox: '0 0 ' + w + ' ' + h,
      role: 'img', 'aria-label': 'Semester GPA trend across ' + pts.length + ' graded semesters'
    }, kids);
    return node;
  }

  function ring(fraction, label) {
    const r = 18, c = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(1, fraction || 0));
    return svg('svg', { class: 'umtx-ringwrap', viewBox: '0 0 44 44' }, [
      svg('circle', { class: 'umtx-ring-bg', cx: 22, cy: 22, r: r, fill: 'none', 'stroke-width': 4 }),
      svg('circle', {
        class: 'umtx-ring-fg', cx: 22, cy: 22, r: r, fill: 'none', 'stroke-width': 4,
        'stroke-dasharray': c.toFixed(1), 'stroke-dashoffset': (c * (1 - pct)).toFixed(1)
      }),
      svg('text', { class: 'umtx-ring-txt', x: 22, y: 26, 'text-anchor': 'middle' }, [document.createTextNode(label || '')])
    ]);
  }

  function statCard(opts) {
    return el('div', { class: 'umtx-stat umtx-rise', style: '--i:' + (opts.index || 0) }, [
      opts.visual || el('span', { class: 'umtx-staticon' }, [el('i', { class: 'fas ' + (opts.icon || 'fa-circle') })]),
      el('div', { class: 'umtx-statbody' }, [
        el('small', { text: opts.label }),
        el('b', { text: opts.value }),
        opts.note ? el('em', { text: opts.note }) : null
      ])
    ]);
  }

  function stats(t, d) {
    const cards = [];
    let i = 0;
    cards.push(statCard({
      index: i++, icon: 'fa-graduation-cap',
      label: 'CGPA', value: (t.totals.cgpa || 0).toFixed(2), note: 'out of 4.00'
    }));
    cards.push(statCard({
      index: i++, icon: 'fa-layer-group',
      label: 'Credits earned', value: String(t.totals.credits || 0),
      note: d.courses + ' courses on record'
    }));
    if (d.last) {
      const rising = d.trend > 0.001;
      const flat = Math.abs(d.trend) < 0.001;
      cards.push(statCard({
        index: i++, icon: flat ? 'fa-minus' : rising ? 'fa-arrow-up' : 'fa-arrow-down',
        label: 'Latest semester', value: (d.last.sgpa || 0).toFixed(2),
        note: d.last.term + (flat ? ', same as before' : (rising ? ', up ' : ', down ') + Math.abs(d.trend).toFixed(2))
      }));
    }
    if (d.best) {
      cards.push(statCard({ index: i++, icon: 'fa-trophy', label: 'Best semester', value: d.best.sgpa.toFixed(2), note: d.best.term }));
    }
    cards.push(statCard({ index: i++, icon: 'fa-calendar-alt', label: 'Semesters', value: String(d.semesters), note: 'on your record' }));
    return el('div', { class: 'umtx-stats' }, cards);
  }

  function dial(value, max) {
    const pct = Math.max(0, Math.min(1, (value || 0) / (max || 4)));
    const r = 58, c = 2 * Math.PI * r;
    const ring = svg('svg', { viewBox: '0 0 132 132', 'aria-hidden': 'true' }, [
      svg('defs', {}, [
        svg('linearGradient', { id: 'umtxDial', x1: '0', y1: '0', x2: '1', y2: '1' }, [
          svg('stop', { offset: '0%', 'stop-color': '#F8C34A' }),
          svg('stop', { offset: '55%', 'stop-color': '#F59B1C' }),
          svg('stop', { offset: '100%', 'stop-color': '#E26005' })
        ])
      ]),
      svg('circle', { class: 'd-bg', cx: 66, cy: 66, r: r, fill: 'none', 'stroke-width': 9 }),
      svg('circle', {
        class: 'd-fg', cx: 66, cy: 66, r: r, fill: 'none', 'stroke-width': 9,
        'stroke-dasharray': c.toFixed(1),
        'stroke-dashoffset': c.toFixed(1),
        style: '--dash:' + c.toFixed(1) + ';--target:' + (c * (1 - pct)).toFixed(1)
      })
    ]);
    return el('div', { class: 'umtx-dial' }, [
      ring,
      el('div', { class: 'umtx-dial-mid' }, [
        el('b', { 'data-count': (value || 0).toFixed(2), text: (value || 0).toFixed(2) }),
        el('small', { text: 'of ' + (max || 4).toFixed(2) })
      ])
    ]);
  }

  function heroLink(label, href, icon, primary) {
    return el('a', { class: 'umtx-heroaction' + (primary ? ' is-primary' : ''), href: href }, [
      el('i', { class: 'fas ' + icon }),
      document.createTextNode(label)
    ]);
  }

  function hero(t, d) {
    const s = t.student || {};
    const first = (s.name || 'Student').split(/\s+/)[0];
    const pretty = first.charAt(0) + first.slice(1).toLowerCase();
    const right = el('div', { class: 'umtx-cgpa' }, [
      el('span', { class: 'umtx-lbl', text: 'Cumulative GPA' }),
      dial(t.totals.cgpa, 4),
      ridge(t.semesters, { w: 240, h: 56 })
    ]);
    return el('section', { class: 'umtx-hero' }, [
      el('div', {}, [
        el('div', { class: 'umtx-hero-eyebrow' }, [el('i', { class: 'fas fa-bolt' }), document.createTextNode(greeting())]),
        el('h1', { text: pretty }),
        el('p', { text: (s.degree || 'Your programme') + (s.school ? ' at the ' + s.school : '') }),
        el('div', { class: 'umtx-meta' }, [
          s.id ? tag('fa-id-card', s.id) : null,
          tag('fa-layer-group', (t.totals.credits || 0) + ' credit hours earned'),
          tag('fa-calendar', d.semesters + ' semesters'),
          d.last ? tag('fa-flag-checkered', 'Last: ' + d.last.term) : null
        ]),
        el('div', { class: 'umtx-heroactions' }, [
          heroLink('Open transcript', '/Transcript', 'fa-graduation-cap', true),
          heroLink('Attendance', '/Attendance', 'fa-user-check'),
          heroLink('Fee voucher', '/Payment/Payment_Voucher', 'fa-file-invoice')
        ])
      ]),
      right
    ]);
  }

  function chipFor(course, index) {
    const b = U.data.band(course.grade);
    const grade = (course.grade || '--').trim();
    const node = el('span', {
      class: 'umtx-chip g-' + b,
      style: '--cr:' + Math.max(1, course.cr || 1) + ';--d:' + (index || 0) + ';',
      title: course.code + '  ' + course.title + '  |  ' + (course.cr || 0) + ' cr  |  grade ' + grade,
      text: grade
    });
    return node;
  }

  function degreeMap(semesters) {
    let seq = 0;
    const rows = semesters.map(function (s) {
      return el('div', { class: 'umtx-maprow' }, [
        el('div', { class: 'umtx-mapterm' }, [
          el('b', { text: s.term }),
          el('small', { text: (s.sgpa ? 'SGPA ' + s.sgpa.toFixed(2) : 'in progress') + '  |  ' + (s.earned || 0) + ' cr' })
        ]),
        el('div', { class: 'umtx-maptrack' }, s.courses.map(function (c) { return chipFor(c, seq++); }))
      ]);
    });
    /* mark the rows that run past their track so the fade hint shows */
    setTimeout(function () {
      rows.forEach(function (row) {
        const track = row.querySelector('.umtx-maptrack');
        if (track && track.scrollWidth > track.clientWidth + 2) row.setAttribute('data-umtx-scrolls', '1');
      });
    }, 60);

    const legend = el('div', { class: 'umtx-legend' }, [
      el('span', {}, [el('i', { style: 'background:var(--u-good)' }), document.createTextNode('A range')]),
      el('span', {}, [el('i', { style: 'background:var(--u-cyan)' }), document.createTextNode('B range')]),
      el('span', {}, [el('i', { style: 'background:var(--u-warn)' }), document.createTextNode('C range')]),
      el('span', {}, [el('i', { style: 'background:var(--u-bad)' }), document.createTextNode('D or F')]),
      el('span', {}, [el('i', { style: 'background:var(--u-text-3)' }), document.createTextNode('Pass, audit or pending')]),
      el('span', { text: 'Chip width follows credit hours' })
    ]);
    return el('div', {}, [el('div', { class: 'umtx-map' }, rows), legend]);
  }

  function loading(title, note) {
    return el('div', { class: 'umtx-block umtx-loading' }, [
      el('div', { class: 'umtx-spinner', 'aria-hidden': 'true' }),
      el('div', {}, [
        el('h2', { text: title }),
        note ? el('p', { text: note }) : null
      ])
    ]);
  }

  /* one line that says how old a record is and offers to refresh it */
  function freshness(name, onRefresh) {
    const stamp = U.data.stamp(name);
    const wrap = el('div', { class: 'umtx-freshness' }, [
      el('i', { class: 'fas fa-clock' }),
      el('span', { text: 'Updated ' + U.relativeTime(stamp) }),
      el('button', {
        class: 'umtx-refreshbtn', type: 'button',
        html: '<i class="fas fa-sync-alt"></i>Refresh now'
      })
    ]);
    wrap.querySelector('.umtx-refreshbtn').addEventListener('click', function () {
      if (onRefresh) onRefresh();
      else U.shell.refreshRecords([name]);
    });
    return wrap;
  }

  function currency(n) {
    return 'Rs ' + Math.round(n || 0).toLocaleString('en-PK');
  }

  function eyebrow(text) {
    return el('div', { class: 'umtx-eyebrow', text: text });
  }

  function skeleton(height) {
    return el('div', { class: 'umtx-skel', style: 'height:' + (height || 120) + 'px' });
  }

  U.ui = {
    svg: svg, block: block, tag: tag, ridge: ridge, ring: ring,
    stats: stats, hero: hero, dial: dial, loading: loading, degreeMap: degreeMap, chipFor: chipFor, eyebrow: eyebrow, freshness: freshness, currency: currency, skeleton: skeleton, greeting: greeting
  };
})();
