/* UMT Portal - Reimagined | shell: theme, navigation, top bar, command palette */
(function () {
  'use strict';
  const U = window.UMTX;
  if (!U) return;
  const el = U.el, qs = U.qs, qsa = U.qsa;

  function applyTheme(theme) {
    const t = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-umtx-theme', t);
    U.LS.set('theme', t);
    const btn = qs('#umtx-theme');
    if (btn) {
      btn.innerHTML = '<i class="fas ' + (t === 'dark' ? 'fa-moon' : 'fa-sun') + '"></i>';
      const label = t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    }
  }

  function boot() {
    const root = document.documentElement;
    root.setAttribute('data-umtx', '1');
    root.setAttribute('data-umtx-theme', U.LS.get('theme', 'dark'));
    root.setAttribute('data-umtx-rail', U.LS.get('rail', '0'));
    root.setAttribute('data-umtx-nav', 'closed');
  }

  const NAV_GROUPS = {
    '/home/index': 'Overview',
    '/studentprofile/studentprofile': 'Academics',
    '/managerequests/getallrequests': 'Services',
    '/roadmap': 'Around campus'
  };

  function decorateSidebar() {
    const list = qs('#sidebar .components');
    if (!list) return;
    const here = location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    qsa('#sidebar .components a[href]').forEach(function (a) {
      const href = (a.getAttribute('href') || '').toLowerCase();
      if (!href || href.charAt(0) === '#' || href.indexOf('http') === 0) return;
      const path = href.split('?')[0].replace(/\/+$/, '');
      if (path === here || (path === '/home/index' && here === '/')) a.classList.add('umtx-active');
      const group = NAV_GROUPS[path];
      if (group) {
        const li = a.closest('li');
        if (!li || li.parentNode !== list) return;
        const prev = li.previousElementSibling;
        if (!(prev && prev.classList.contains('umtx-navgroup'))) {
          list.insertBefore(el('li', { class: 'umtx-navgroup', text: group }), li);
        }
      }
    });
  }

  function setRail(on) {
    document.documentElement.setAttribute('data-umtx-rail', on ? '1' : '0');
    U.LS.set('rail', on ? '1' : '0');
  }
  function isMobile() { return window.matchMedia('(max-width: 1080px)').matches; }
  function setDrawer(open) { document.documentElement.setAttribute('data-umtx-nav', open ? 'open' : 'closed'); }
  function toggleNav() {
    if (isMobile()) setDrawer(document.documentElement.getAttribute('data-umtx-nav') !== 'open');
    else setRail(document.documentElement.getAttribute('data-umtx-rail') !== '1');
  }

  function buildTopbar() {
    const bar = qs('#content > nav.navbar');
    if (!bar || bar.getAttribute('data-umtx-done')) return;
    bar.setAttribute('data-umtx-done', '1');

    const old = qs('#sidebarCollapse', bar);
    let toggle;
    if (old) {
      toggle = old.cloneNode(true);
      old.parentNode.replaceChild(toggle, old);
    } else {
      toggle = el('button', { id: 'sidebarCollapse', class: 'umtx-iconbtn', html: '<i class="fas fa-bars"></i>' });
      bar.insertBefore(toggle, bar.firstChild);
    }
    toggle.setAttribute('aria-label', 'Show or hide navigation');
    toggle.setAttribute('title', 'Navigation (Ctrl+B)');
    toggle.addEventListener('click', function (e) { e.preventDefault(); toggleNav(); });

    const r = U.route();
    const crumb = el('div', { class: 'umtx-crumb' }, [el('b', { text: r.title }), el('small', { text: r.sub })]);
    const header = qs('.navbar-header', bar) || toggle.parentNode;
    header.insertAdjacentElement('afterend', crumb);

    const right = el('div', { class: 'umtx-topright' });
    const search = el('button', {
      class: 'umtx-search', id: 'umtx-open-palette', type: 'button',
      'aria-label': 'Search the portal',
      html: '<i class="fas fa-search"></i><span>Search</span><kbd>Ctrl K</kbd>'
    });
    const theme = el('button', { class: 'umtx-iconbtn', id: 'umtx-theme', type: 'button' });
    theme.addEventListener('click', function () {
      applyTheme(document.documentElement.getAttribute('data-umtx-theme') === 'dark' ? 'light' : 'dark');
    });

    const refresh = el('button', {
      class: 'umtx-iconbtn', id: 'umtx-refresh', type: 'button',
      html: '<i class="fas fa-sync-alt"></i>'
    });
    refresh.addEventListener('click', function () { refreshRecords(recordsForPage()); });
    syncRefreshTitle();

    right.appendChild(search);
    right.appendChild(refresh);
    right.appendChild(theme);
    const icons = qs('.top-icons-agileits-w3layouts', bar);
    if (icons) right.appendChild(icons);
    bar.appendChild(right);

    applyTheme(U.LS.get('theme', 'dark'));
    buildUserChip(right);
    liftAnnouncement(bar);
  }

  /* the portal scrolls announcements in a marquee; show them as a readable banner */
  function liftAnnouncement(bar) {
    const marquee = qs('marquee', bar) || qs('marquee');
    const text = marquee ? (marquee.textContent || '').replace(/\s+/g, ' ').trim() : '';
    if (!text) return;
    const canvas = qs('.outer-w3-agile');
    if (!canvas || qs('.umtx-ticker')) return;
    const banner = el('div', { class: 'umtx-ticker', role: 'status' }, [
      el('i', { class: 'fas fa-bullhorn' }),
      el('p', { text: text }),
      el('a', { href: '/Announcements', text: 'All announcements' })
    ]);
    canvas.insertBefore(banner, canvas.firstChild);
  }

  function buildUserChip(right) {
    const source = qs('.drop-3 .profile');
    if (!source) return;
    const nameNode = qs('h3', source);
    const idNode = qs('a', source);
    const name = ((nameNode && nameNode.textContent) || '').trim();
    const id = ((idNode && idNode.textContent) || '').trim();
    if (!name) return;
    const initials = name.split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase();
    const chip = el('button', { class: 'umtx-userchip', type: 'button', title: name + ' - ' + id }, [
      el('span', { class: 'umtx-avatar', text: initials }),
      el('span', { class: 'umtx-who' }, [el('b', { text: name }), el('small', { text: id })])
    ]);
    chip.addEventListener('click', function () {
      const trigger = qs('#navbarDropdown2');
      if (trigger) trigger.click();
    });
    right.insertBefore(chip, right.firstChild);
    U.LS.setJSON('student', { name: name, id: id });
  }

  /* ---- records: what is stored, how old, and refreshing it ---------------- */
  function recordsForPage() {
    const here = location.pathname.toLowerCase();
    if (here.indexOf('/payment') === 0) return ['payments'];
    if (here.indexOf('/transcript') === 0) return ['transcript'];
    return ['transcript', 'payments'];
  }

  function recordLabel(name) {
    return name === 'payments' ? 'Payment history' : 'Academic record';
  }

  function syncRefreshTitle() {
    const btn = qs('#umtx-refresh');
    if (!btn) return;
    const lines = recordsForPage().map(function (name) {
      return recordLabel(name) + ': ' + U.relativeTime(U.data.stamp(name));
    });
    const title = ['Refresh now'].concat(lines).join(String.fromCharCode(10));
    btn.setAttribute('title', title);
    btn.setAttribute('aria-label', 'Refresh your records');
  }

  let refreshing = false;

  function refreshRecords(names) {
    if (refreshing) return Promise.resolve();
    refreshing = true;
    const btn = qs('#umtx-refresh');
    if (btn) { btn.classList.add('is-spinning'); btn.disabled = true; }
    qsa('.umtx-refreshbtn').forEach(function (b) { b.classList.add('is-spinning'); b.disabled = true; });

    const jobs = names.map(function (name) {
      return U.data.refresh(name).then(
        function () { return { name: name, ok: true }; },
        function (err) { return { name: name, ok: false, err: err }; }
      );
    });

    return Promise.all(jobs).then(function (results) {
      refreshing = false;
      if (btn) { btn.classList.remove('is-spinning'); btn.disabled = false; }
      qsa('.umtx-refreshbtn').forEach(function (b) { b.classList.remove('is-spinning'); b.disabled = false; });
      syncRefreshTitle();
      const good = results.filter(function (r) { return r.ok; });
      const bad = results.filter(function (r) { return !r.ok; });
      if (good.length) toast(good.map(function (r) { return recordLabel(r.name); }).join(' and ') + ' updated.', 'good');
      bad.forEach(function (r) {
        toast(recordLabel(r.name) + ' did not refresh: ' + r.err.message, 'bad');
      });
      return results;
    });
  }

  const BOTTOM = [
    { href: '/Home/Index', icon: 'fa-th-large', label: 'Home' },
    { href: '/MyCourses', icon: 'fa-book', label: 'Courses' },
    { href: '/Transcript', icon: 'fa-graduation-cap', label: 'Record' },
    { href: '/Payment', icon: 'fa-wallet', label: 'Fees' },
    { href: '/ManageRequests/getAllRequests', icon: 'fa-tasks', label: 'Requests' }
  ];

  function buildMobileChrome() {
    if (qs('.umtx-bottomnav')) return;
    if (!qs('#sidebar')) return; /* signed out: no portal navigation to mirror */
    const scrim = el('div', { class: 'umtx-navscrim', 'aria-hidden': 'true' });
    scrim.addEventListener('click', function () { setDrawer(false); });
    document.body.appendChild(scrim);
    const here = location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    const nav = el('nav', { class: 'umtx-bottomnav', 'aria-label': 'Quick navigation' },
      BOTTOM.map(function (item) {
        const path = item.href.toLowerCase();
        const active = path === here || (path === '/home/index' && here === '/');
        return el('a', { href: item.href, class: active ? 'umtx-active' : '' }, [
          el('i', { class: 'fas ' + item.icon }), el('span', { text: item.label })
        ]);
      })
    );
    document.body.appendChild(nav);
  }

  /* ---- command palette --------------------------------------------------- */
  let palette = null, plist = null, pinput = null, pitems = [], pindex = 0;

  function paletteEntries() {
    const seen = {};
    const out = [];
    U.ROUTES.forEach(function (r) {
      if (r.title === 'Sign in' || r.title === 'Request Chat') return;
      out.push({ title: r.title, sub: r.sub, icon: r.icon, keys: r.keys || '', href: hrefFor(r) });
    });
    qsa('#sidebar .components a[href], .dashboard-card .card-links a[href]').forEach(function (a) {
      const href = a.getAttribute('href');
      const label = (a.textContent || '').replace(/\s+/g, ' ').trim();
      if (!href || href.charAt(0) === '#' || !label || seen[href + label]) return;
      seen[href + label] = 1;
      if (out.some(function (o) { return o.title.toLowerCase() === label.toLowerCase(); })) return;
      out.push({ title: label, sub: href.indexOf('http') === 0 ? 'External site' : href, icon: 'fa-arrow-right', keys: '', href: href });
    });
    return out;
  }

  function hrefFor(r) {
    const map = {
      'Dashboard': '/Home/Index', 'Profile': '/studentProfile/studentProfile', 'My Courses': '/MyCourses',
      'Transcript': '/Transcript', 'Attendance': '/Attendance', 'Feedback': '/StudentFeedback',
      'Student Undertaking': '/StudentUndertaking', 'Track Requests': '/ManageRequests/getAllRequests',
      'Submit a Request': '/ManageRequests/Index1', 'Add or Drop Courses': '/CourseRequest/Index?RequestType=AddDrop',
      'New Registration': '/CourseRequest', 'Appointment Request': '/AppointmentRequest', 'FT Clearance': '/Home/Clearance',
      'Fee Voucher': '/Payment/Payment_Voucher', 'Payment History': '/Payment', 'Road Map': '/Roadmap',
      'Announcements': '/Announcements', 'UMT Store': '/Home/umtstore', 'Important Links': '/AcademicRecord',
      'Academic Advisor': '/Advisor', 'Peer Tutoring': '/TutorProgram/Index', 'Change Password': '/Manage/ChangePassword'
    };
    return map[r.title] || '/';
  }

  function buildPalette() {
    if (palette) return;
    const scrim = el('div', { class: 'umtx-scrim', id: 'umtx-scrim' });
    scrim.addEventListener('click', function () { closePalette(); });
    pinput = el('input', { type: 'text', placeholder: 'Jump to a page, or type what you need', 'aria-label': 'Search the portal' });
    plist = el('div', { class: 'umtx-plist', role: 'listbox' });
    palette = el('div', { class: 'umtx-palette', role: 'dialog', 'aria-label': 'Quick navigation' }, [
      pinput, plist,
      el('div', { class: 'umtx-pfoot' }, [
        el('span', { text: 'Enter to open' }),
        el('span', { text: 'Arrow keys to move' }),
        el('span', { text: 'Esc to close' })
      ])
    ]);
    document.body.appendChild(scrim);
    document.body.appendChild(palette);
    pinput.addEventListener('input', function () { renderPalette(pinput.value); });
    pinput.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { e.preventDefault(); open(pitems[pindex]); }
      else if (e.key === 'Escape') { closePalette(); }
    });
  }

  /* a query like "fee" should reach Fee Voucher before Feedback */
  function score(item, q) {
    const title = item.title.toLowerCase();
    if (title.indexOf(q) === 0) return 100 - title.length;
    const words = title.split(/\s+/);
    for (let i = 1; i < words.length; i++) if (words[i].indexOf(q) === 0) return 80 - i;
    if (title.indexOf(q) > -1) return 50;
    if ((item.keys || '').toLowerCase().indexOf(q) > -1) return 30;
    if ((item.sub || '').toLowerCase().indexOf(q) > -1) return 10;
    return 0;
  }

  function renderPalette(query) {
    const q = (query || '').toLowerCase().trim();
    const all = paletteEntries();
    pitems = !q ? all.slice(0, 9) : all.map(function (item) {
      return { item: item, score: score(item, q) };
    }).filter(function (r) { return r.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .map(function (r) { return r.item; })
      .slice(0, 40);
    pindex = 0;
    plist.innerHTML = '';
    if (!pitems.length) {
      plist.appendChild(el('div', { class: 'umtx-pitem', text: 'Nothing matches that. Try a page name such as transcript or fee.' }));
      return;
    }
    pitems.forEach(function (item, i) {
      const row = el('div', { class: 'umtx-pitem', role: 'option', 'aria-selected': i === 0 ? 'true' : 'false' }, [
        el('i', { class: 'fas ' + item.icon }),
        el('span', { text: item.title }),
        el('small', { text: item.sub })
      ]);
      row.addEventListener('click', function () { open(item); });
      row.addEventListener('mousemove', function () { select(i); });
      plist.appendChild(row);
    });
  }

  function select(i) {
    const rows = qsa('.umtx-pitem', plist);
    if (!rows.length) return;
    pindex = (i + rows.length) % rows.length;
    rows.forEach(function (r, n) { r.setAttribute('aria-selected', n === pindex ? 'true' : 'false'); });
    rows[pindex].scrollIntoView({ block: 'nearest' });
  }
  function move(delta) { select(pindex + delta); }
  function open(item) { if (item && item.href) location.href = item.href; }

  function openPalette() {
    buildPalette();
    renderPalette('');
    qs('#umtx-scrim').setAttribute('data-open', '1');
    palette.setAttribute('data-open', '1');
    pinput.value = '';
    pinput.focus();
  }
  function closePalette() {
    if (!palette) return;
    palette.setAttribute('data-open', '0');
    qs('#umtx-scrim').setAttribute('data-open', '0');
  }

  /* the toolbar popup can ask this tab to refresh */
  function listenForPopup() {
    try {
      if (!chrome || !chrome.runtime || !chrome.runtime.onMessage) return;
    } catch (e) { return; }
    chrome.runtime.onMessage.addListener(function (msg, sender, reply) {
      if (!msg || msg.umtx !== 'refresh') return;
      refreshRecords(msg.records || ['transcript', 'payments']).then(function (results) {
        reply({ ok: true, results: (results || []).map(function (r) { return { name: r.name, ok: r.ok }; }) });
      });
      return true; /* reply comes later */
    });
  }

  /* ---- keyboard ---------------------------------------------------------- */
  function bindKeys() {
    document.addEventListener('keydown', function (e) {
      const typing = /^(input|textarea|select)$/i.test((e.target.tagName || '')) || e.target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') { e.preventDefault(); toggleNav(); return; }
      if (e.key === 'Escape') { closePalette(); setDrawer(false); return; }
      if (!typing && e.key === '/') { e.preventDefault(); openPalette(); }
    });
    document.addEventListener('click', function (e) {
      const trigger = e.target.closest && e.target.closest('#umtx-open-palette');
      if (trigger) { e.preventDefault(); openPalette(); }
    });
  }

  /* ---- tables become cards on small screens ------------------------------ */
  function labelTables(scope) {
    qsa('table.table', scope || document).forEach(function (table) {
      if (table.getAttribute('data-umtx-cards')) return;
      const headRow = table.tHead ? table.tHead.rows[0] : table.rows[0];
      if (!headRow) return;
      const heads = Array.prototype.map.call(headRow.cells, function (c) {
        return (c.textContent || '').replace(/\s+/g, ' ').trim();
      });
      if (!heads.some(Boolean)) return;
      if (!table.tHead) headRow.setAttribute('data-umtx-headrow', '1');
      Array.prototype.forEach.call(table.rows, function (row, i) {
        if (row === headRow) return;
        Array.prototype.forEach.call(row.cells, function (cell, n) {
          if (heads[n] && !cell.getAttribute('data-label')) cell.setAttribute('data-label', heads[n]);
        });
      });
      table.setAttribute('data-umtx-cards', '1');
      if (!table.parentNode.classList.contains('umtx-tablewrap')) {
        const wrap = el('div', { class: 'umtx-tablewrap' });
        table.parentNode.insertBefore(wrap, table);
        wrap.appendChild(table);
      }
    });
  }

  /* ---- toast ------------------------------------------------------------- */
  function toast(message, tone) {
    let host = qs('.umtx-toasts');
    if (!host) { host = el('div', { class: 'umtx-toasts' }); document.body.appendChild(host); }
    const icon = tone === 'bad' ? 'fa-triangle-exclamation' : tone === 'good' ? 'fa-circle-check' : 'fa-circle-info';
    const node = el('div', { class: 'umtx-toast' }, [el('i', { class: 'fas ' + icon }), el('span', { text: message })]);
    host.appendChild(node);
    setTimeout(function () { node.remove(); }, 5200);
  }

  U.shell = {
    boot: boot,
    refreshRecords: refreshRecords,
    recordsForPage: recordsForPage,
    syncRefreshTitle: syncRefreshTitle,
    applyTheme: applyTheme,
    decorateSidebar: decorateSidebar,
    buildTopbar: buildTopbar,
    buildMobileChrome: buildMobileChrome,
    bindKeys: bindKeys,
    listenForPopup: listenForPopup,
    labelTables: labelTables,
    openPalette: openPalette,
    setDrawer: setDrawer,
    toast: toast
  };
})();
