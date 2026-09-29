/* UMT Portal - Reimagined | data: read the student record, keep it, refresh on demand */
(function () {
  'use strict';
  const U = window.UMTX;
  if (!U) return;

  const TERM_RE = /^(Fall|Spring|Summer|Winter)\s+(20\d\d)$/i;
  const SUMMARY_RE = /Cr\.?\s*Hrs\.?\s*Earned\s*:?\s*(\d+)/i;
  const CGPA_RE = /CGPA\s*:?\s*([\d.]+)/i;
  const SGPA_RE = /SGPA\s*:?\s*([\d.]+)/i;
  const MONEY_DATE_RE = /^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/;

  function band(grade) {
    const g = (grade || '').trim().toUpperCase();
    if (!g || g === 'SA' || g === 'P' || g === 'NA' || g === 'I' || g === 'W') return 'x';
    if (g[0] === 'A') return 'a';
    if (g[0] === 'B') return 'b';
    if (g[0] === 'C') return 'c';
    return 'f';
  }

  function termOrder(term) {
    const m = TERM_RE.exec(term);
    if (!m) return 0;
    const season = { spring: 1, summer: 2, fall: 3, winter: 4 }[m[1].toLowerCase()] || 0;
    return parseInt(m[2], 10) * 10 + season;
  }

  function cellsOf(row) {
    const out = [];
    for (let i = 0; i < row.cells.length; i++) {
      const c = row.cells[i];
      if (c.querySelector('table')) continue;
      const t = (c.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) out.push(t);
    }
    return out;
  }

  function leafText(doc) {
    const out = [];
    const all = doc.querySelectorAll('td, th');
    for (let i = 0; i < all.length; i++) {
      if (all[i].querySelector('table')) continue;
      const t = (all[i].textContent || '').replace(/\s+/g, ' ').trim();
      if (t && t.length < 160) out.push(t);
    }
    return out.join(' | ');
  }

  function looksBroken(doc) {
    if (!doc || !doc.body) return false;
    return /Server Error|Object reference not set|Runtime Error/i.test(doc.body.innerText || '');
  }

  /* ---- transcript --------------------------------------------------------- */
  function parseTranscript(doc) {
    const rows = doc.querySelectorAll('tr');
    const semesters = [];
    const byTerm = Object.create(null);
    const seen = Object.create(null);
    let current = null;

    for (let i = 0; i < rows.length; i++) {
      const cells = cellsOf(rows[i]);
      if (!cells.length) continue;
      if (cells.some(function (c) { return c.length > 160; })) continue;

      if (cells.length === 1 && TERM_RE.test(cells[0])) {
        const term = cells[0];
        if (!byTerm[term]) {
          byTerm[term] = { term: term, order: termOrder(term), courses: [], earned: null, sgpa: null, cgpa: null };
          semesters.push(byTerm[term]);
        }
        current = byTerm[term];
        continue;
      }

      const joined = cells.join(' ');
      if (SUMMARY_RE.test(joined) && current) {
        if (current.earned === null) {
          current.earned = parseInt(SUMMARY_RE.exec(joined)[1], 10);
          const c = CGPA_RE.exec(joined);
          const g = SGPA_RE.exec(joined);
          current.cgpa = c ? parseFloat(c[1]) : null;
          current.sgpa = g ? parseFloat(g[1]) : null;
        }
        continue;
      }

      if (current && (cells.length === 4 || cells.length === 5) && /^[A-Z]{2,4}\d{2,4}[A-Z]?$/.test(cells[0])) {
        const key = current.term + '|' + cells[0];
        if (seen[key]) continue;
        seen[key] = 1;
        current.courses.push({
          code: cells[0],
          title: cells[1],
          cr: parseFloat(cells[2]) || 0,
          grade: cells[3] || '',
          gp: cells.length === 5 ? parseFloat(cells[4]) || 0 : 0
        });
      }
    }

    const flat = leafText(doc);
    const pick = function (re) { const m = re.exec(flat); return m ? m[1].trim() : ''; };

    const student = {
      id: pick(/ID No:?\s*\|?\s*([A-Za-z]?\d{6,12})/),
      name: pick(/Name:\s*\|?\s*([^|]{2,60}?)\s*(?:\||Fathers)/i),
      degree: pick(/Degree:\s*\|?\s*([^|]{2,60})/i),
      father: pick(/Fathers? Name:?\s*\|?\s*([^|]{2,60})/i),
      school: pick(/((?:School|Institute|Department) of [^|]{2,60})/i)
    };

    const totals = {
      credits: parseFloat(pick(/Credit Hours Earned\s*:?\s*\|?\s*(\d+)/i)) || 0,
      gpaCredits: parseFloat(pick(/Credit Hours for GPA\s*:?\s*\|?\s*(\d+)/i)) || 0,
      points: parseFloat(pick(/Total Grade Points\s*:?\s*\|?\s*([\d.]+)/i)) || 0,
      cgpa: parseFloat(pick(/CGPA\s*:?\s*\|?\s*([\d.]+)\s*\/\s*4/i)) || 0
    };

    semesters.sort(function (a, b) { return a.order - b.order; });
    if (!totals.cgpa && semesters.length) totals.cgpa = semesters[semesters.length - 1].cgpa || 0;
    return { student: student, semesters: semesters, totals: totals };
  }

  /* ---- payments ----------------------------------------------------------- */
  function money(text) {
    const n = parseFloat(String(text).replace(/[^\d.]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function parsePayments(doc) {
    const rows = doc.querySelectorAll('tr');
    const items = [];
    const seen = Object.create(null);

    for (let i = 0; i < rows.length; i++) {
      const cells = Array.prototype.map.call(rows[i].cells, function (c) {
        return (c.textContent || '').replace(/\s+/g, ' ').trim();
      }).filter(Boolean);
      if (cells.length < 4 || !MONEY_DATE_RE.test(cells[0])) continue;
      const key = cells.join('|');
      if (seen[key]) continue;
      seen[key] = 1;
      const when = new Date(cells[0]);
      items.push({
        date: cells[0],
        at: isNaN(when.getTime()) ? 0 : when.getTime(),
        challan: cells[1],
        account: cells[2],
        amount: money(cells[3]),
        bank: cells[4] || ''
      });
    }

    const flat = leafText(doc);
    const pick = function (re) { const m = re.exec(flat); return m ? m[1].trim() : ''; };
    const pageInfo = /(\d+)\s*of\s*(\d+)/.exec((doc.body && doc.body.innerText) || '');

    items.sort(function (a, b) { return a.at - b.at; });
    return {
      student: {
        id: pick(/Student ID:\s*\|?\s*([A-Za-z]?\d{6,12})/i),
        name: pick(/Name:\s*\|?\s*([^|]{2,60})/i),
        program: pick(/Program:\s*\|?\s*([^|]{2,40})/i),
        batch: pick(/Batch:\s*\|?\s*([^|]{2,30})/i)
      },
      items: items,
      pages: pageInfo ? parseInt(pageInfo[2], 10) : 1
    };
  }

  /* ---- readers ------------------------------------------------------------
     A report only renders on the first request after its own portal page primes
     the session. Reloading the frame breaks it, so read whatever is on screen,
     and otherwise open the portal page out of sight and read it from there.
     ------------------------------------------------------------------------- */
  function reportDocOnThisPage(match) {
    const frames = U.qsa('iframe');
    for (let i = 0; i < frames.length; i++) {
      let doc = null;
      try { doc = frames[i].contentDocument; } catch (e) { continue; }
      if (!doc) continue;
      if ((frames[i].src || '').toLowerCase().indexOf(match) > -1) return doc;
    }
    return null;
  }

  function waitForReport(getDoc, ready) {
    return new Promise(function (resolve, reject) {
      let tries = 0;
      const poll = function () {
        let doc = null;
        try { doc = getDoc(); } catch (e) { return reject(e); }
        if (doc && looksBroken(doc)) return reject(new Error('The portal report service returned an error'));
        if (doc && ready(doc)) return resolve(doc);
        if (++tries > 60) return reject(new Error('The portal report did not finish loading'));
        setTimeout(poll, 500);
      };
      poll();
    });
  }

  function readViaHiddenPage(pagePath, reportMatch, ready) {
    return new Promise(function (resolve, reject) {
      const host = document.body || document.documentElement;
      const frame = document.createElement('iframe');
      frame.setAttribute('aria-hidden', 'true');
      frame.setAttribute('tabindex', '-1');
      frame.style.cssText = 'position:absolute;left:-12000px;top:0;width:1180px;height:900px;border:0;opacity:0;pointer-events:none';
      frame.src = pagePath;

      let settled = false;
      const finish = function (fn, arg) {
        if (settled) return;
        settled = true;
        try { frame.remove(); } catch (e) { /* already gone */ }
        fn(arg);
      };

      frame.addEventListener('load', function () {
        waitForReport(function () {
          const outer = frame.contentDocument;
          if (!outer) return null;
          const inner = outer.querySelector('iframe[src*="' + reportMatch + '"], iframe');
          return inner ? inner.contentDocument : null;
        }, ready).then(function (doc) {
          /* copy what we need before the frame goes away */
          finish(resolve, doc.documentElement.outerHTML);
        }).catch(function (err) { finish(reject, err); });
      });
      frame.addEventListener('error', function () { finish(reject, new Error('Could not open ' + pagePath)); });

      host.appendChild(frame);
      setTimeout(function () { finish(reject, new Error('Timed out reading ' + pagePath)); }, 45000);
    });
  }

  function htmlToDoc(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  /* ---- sources ------------------------------------------------------------ */
  const SOURCES = {
    transcript: {
      page: '/Transcript',
      report: 'Transcript.aspx',
      ready: function (doc) { return doc.querySelectorAll('tr').length > 20; },
      parse: parseTranscript,
      check: function (v) { return v && v.semesters && v.semesters.length > 0; },
      direct: '/Reports/Transcript.aspx'
    },
    payments: {
      page: '/Payment',
      report: 'Payments.aspx',
      ready: function (doc) {
        return Array.prototype.some.call(doc.querySelectorAll('tr'), function (r) {
          const first = r.cells[0];
          return first && MONEY_DATE_RE.test((first.textContent || '').trim());
        });
      },
      parse: parsePayments,
      check: function (v) { return v && v.items && v.items.length > 0; },
      direct: null
    }
  };

  const inflight = Object.create(null);

  function fetchFresh(name) {
    const src = SOURCES[name];
    if (!src) return Promise.reject(new Error('Unknown record: ' + name));
    if (inflight[name]) return inflight[name];

    const fromThisPage = reportDocOnThisPage(src.report.toLowerCase());
    let chain;

    if (fromThisPage) {
      chain = waitForReport(function () { return reportDocOnThisPage(src.report.toLowerCase()); }, src.ready)
        .then(function (doc) { return doc.documentElement.outerHTML; });
    } else if (src.direct) {
      chain = fetch(src.direct, { credentials: 'same-origin' })
        .then(function (r) {
          if (!r.ok) throw new Error('status ' + r.status);
          return r.text();
        })
        .then(function (html) {
          const doc = htmlToDoc(html);
          if (looksBroken(doc) || !src.ready(doc)) throw new Error('empty report');
          return html;
        })
        .catch(function () { return readViaHiddenPage(src.page, src.report, src.ready); });
    } else {
      chain = readViaHiddenPage(src.page, src.report, src.ready);
    }

    inflight[name] = chain
      .then(function (html) {
        const value = src.parse(htmlToDoc(html));
        if (!src.check(value)) throw new Error('The report held no usable rows');
        U.store.write(name, value);
        document.dispatchEvent(new CustomEvent('umtx:record', { detail: { name: name } }));
        return value;
      })
      .then(function (v) { delete inflight[name]; return v; },
            function (e) { delete inflight[name]; throw e; });

    return inflight[name];
  }

  /* Cached value first, always. Network only when asked, or when the record is
     older than the window a student would care about. */
  function load(name, opts) {
    const o = opts || {};
    const cached = U.store.value(name);
    if (o.force) return fetchFresh(name);
    if (cached && SOURCES[name].check(cached)) {
      if (o.topUp !== false && U.store.ageDays(name) > (U.FRESH_DAYS[name] || 45)) {
        fetchFresh(name).catch(function () { /* keep the copy we have */ });
      }
      return Promise.resolve(cached);
    }
    return fetchFresh(name);
  }

  /* Warm whatever is missing or old, quietly, once per tab. */
  function warm() {
    const names = Object.keys(SOURCES);
    let delay = 2500;
    names.forEach(function (name) {
      let already = false;
      try { already = sessionStorage.getItem('umtx.warm.' + name) === '1'; } catch (e) { already = false; }
      if (already) return;
      const cached = U.store.value(name);
      const fresh = cached && SOURCES[name].check(cached) && U.store.ageDays(name) <= (U.FRESH_DAYS[name] || 45);
      if (fresh) return;
      try { sessionStorage.setItem('umtx.warm.' + name, '1'); } catch (e) { /* private mode */ }
      setTimeout(function () {
        fetchFresh(name).catch(function () { /* nothing to say, this is background work */ });
      }, delay);
      delay += 9000;
    });
  }

  function derive(t) {
    if (!t || !t.semesters) return null;
    const graded = t.semesters.filter(function (s) { return typeof s.sgpa === 'number' && s.sgpa > 0; });
    let best = null;
    graded.forEach(function (s) { if (!best || s.sgpa > best.sgpa) best = s; });
    const dist = { a: 0, b: 0, c: 0, f: 0, x: 0 };
    let courses = 0;
    t.semesters.forEach(function (s) {
      s.courses.forEach(function (c) { dist[band(c.grade)]++; courses++; });
    });
    const last = t.semesters[t.semesters.length - 1] || null;
    return {
      best: best, last: last, graded: graded, dist: dist, courses: courses,
      semesters: t.semesters.length,
      trend: last && graded.length > 1 ? last.sgpa - graded[graded.length - 2].sgpa : 0
    };
  }

  function derivePayments(p) {
    if (!p || !p.items || !p.items.length) return null;
    const items = p.items;
    let total = 0;
    const byYear = Object.create(null);
    items.forEach(function (i) {
      total += i.amount;
      const year = i.date.slice(-4);
      byYear[year] = (byYear[year] || 0) + i.amount;
    });
    const years = Object.keys(byYear).sort();
    return {
      total: total,
      count: items.length,
      first: items[0],
      last: items[items.length - 1],
      byYear: years.map(function (y) { return { year: y, amount: byYear[y] }; }),
      largest: items.slice().sort(function (a, b) { return b.amount - a.amount; })[0]
    };
  }

  U.data = {
    load: load,
    refresh: function (name) { return fetchFresh(name); },
    warm: warm,
    cached: function (name) { return U.store.value(name || 'transcript'); },
    stamp: function (name) { return U.store.stamp(name); },
    age: function (name) { return U.store.ageDays(name); },
    derive: derive,
    derivePayments: derivePayments,
    band: band,
    money: money,
    /* kept so older call sites keep working */
    getTranscript: function (force) { return load('transcript', { force: !!force }); },
    fromCurrentFrame: function () { return load('transcript', {}); }
  };
})();
