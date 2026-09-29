/* UMT Portal - Reimagined | core: storage, theme, helpers, routes */
(function () {
  'use strict';

  const W = window;
  if (W.UMTX) return;

  const LS = {
    get(key, fallback) {
      try { const v = localStorage.getItem('umtx.' + key); return v === null ? fallback : v; }
      catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('umtx.' + key, value); } catch (e) { /* private mode */ }
      try { chrome.storage && chrome.storage.local.set({ ['umtx.' + key]: value }); } catch (e) { /* popup mirror */ }
    },
    getJSON(key, fallback) {
      try { return JSON.parse(localStorage.getItem('umtx.' + key)) || fallback; } catch (e) { return fallback; }
    },
    setJSON(key, value) { LS.set(key, JSON.stringify(value)); }
  };

  function el(tag, props, kids) {
    const node = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v === null || v === undefined) continue;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'text') node.textContent = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v);
      }
    }
    (Array.isArray(kids) ? kids : kids ? [kids] : []).forEach(function (kid) {
      if (kid === null || kid === undefined || kid === false) return;
      node.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    });
    return node;
  }

  const qs = function (sel, root) { return (root || document).querySelector(sel); };
  const qsa = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ---- store -------------------------------------------------------------
     Records here change a couple of times a year, so nothing is thrown away on
     a timer. Age only decides whether a quiet background refresh is worth it.
     ------------------------------------------------------------------------ */
  const STORE_VERSION = 2;

  const store = {
    read: function (name) {
      const raw = LS.getJSON('cache.' + name, null);
      if (!raw) return null;
      /* records written before the store existed */
      if (!raw.ver && raw.fetchedAt) return { ver: 1, ts: raw.fetchedAt, value: raw };
      if (!raw.ver || !raw.value) return null;
      return raw;
    },
    value: function (name) {
      const rec = store.read(name);
      return rec ? rec.value : null;
    },
    stamp: function (name) {
      const rec = store.read(name);
      return rec ? rec.ts : 0;
    },
    write: function (name, value) {
      const rec = { ver: STORE_VERSION, ts: Date.now(), value: value };
      LS.setJSON('cache.' + name, rec);
      return rec;
    },
    clear: function (name) { LS.set('cache.' + name, JSON.stringify(null)); },
    ageDays: function (name) {
      const ts = store.stamp(name);
      return ts ? (Date.now() - ts) / 86400000 : Infinity;
    }
  };

  /* how long before a record is worth quietly refreshing in the background */
  const FRESH_DAYS = { transcript: 45, payments: 30 };

  function relativeTime(ts) {
    if (!ts) return 'never';
    const secs = Math.max(0, (Date.now() - ts) / 1000);
    if (secs < 90) return 'just now';
    const mins = secs / 60;
    if (mins < 60) return Math.round(mins) + (Math.round(mins) === 1 ? ' minute ago' : ' minutes ago');
    const hours = mins / 60;
    if (hours < 24) return Math.round(hours) + (Math.round(hours) === 1 ? ' hour ago' : ' hours ago');
    const days = hours / 24;
    if (days < 30) return Math.round(days) + (Math.round(days) === 1 ? ' day ago' : ' days ago');
    return 'on ' + new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /* ---- routes ------------------------------------------------------------ */
  const ROUTES = [
    { match: /^\/(home(\/index)?)?$/, title: 'Dashboard', sub: 'Everything at a glance', icon: 'fa-th-large', keys: 'home overview' },
    { match: /^\/studentprofile/, title: 'Profile', sub: 'Biography and interests', icon: 'fa-user', keys: 'bio about me' },
    { match: /^\/mycourses/, title: 'My Courses', sub: 'Courses you are registered in', icon: 'fa-book', keys: 'subjects classes' },
    { match: /^\/transcript/, title: 'Transcript', sub: 'Full academic record', icon: 'fa-graduation-cap', keys: 'grades gpa cgpa result marks' },
    { match: /^\/attendance/, title: 'Attendance', sub: 'Class attendance by course', icon: 'fa-calendar-check', keys: 'present absent' },
    { match: /^\/studentfeedback/, title: 'Feedback', sub: 'Course and faculty feedback', icon: 'fa-comment-dots', keys: 'evaluation survey' },
    { match: /^\/studentundertaking/, title: 'Student Undertaking', sub: 'Declarations you have signed', icon: 'fa-file-signature', keys: 'declaration agreement' },
    { match: /^\/managerequests\/getallrequests/, title: 'Track Requests', sub: 'Status of every request you filed', icon: 'fa-tasks', keys: 'status prs tickets' },
    { match: /^\/managerequests\/index1/, title: 'Submit a Request', sub: 'Open a new request', icon: 'fa-paper-plane', keys: 'new request apply prs' },
    { match: /^\/managerequests\/prschat/, title: 'Request Chat', sub: 'Conversation on a request', icon: 'fa-comments', keys: 'chat reply' },
    { match: /^\/courserequest\/index/, title: 'Add or Drop Courses', sub: 'Change your registration', icon: 'fa-exchange-alt', keys: 'add drop swap' },
    { match: /^\/courserequest/, title: 'New Registration', sub: 'Register for the coming semester', icon: 'fa-plus-square', keys: 'enroll register courses' },
    { match: /^\/appointmentrequest/, title: 'Appointment Request', sub: 'Book time with an office', icon: 'fa-calendar-plus', keys: 'meeting book' },
    { match: /^\/home\/clearance/, title: 'FT Clearance', sub: 'Final term clearance', icon: 'fa-clipboard-check', keys: 'clearance dues' },
    { match: /^\/payment\/payment_voucher/, title: 'Fee Voucher', sub: 'Pending vouchers to pay', icon: 'fa-file-invoice', keys: 'challan dues pay' },
    { match: /^\/payment/, title: 'Payment History', sub: 'Every fee you have paid', icon: 'fa-wallet', keys: 'fee challan paid receipt' },
    { match: /^\/roadmap/, title: 'Road Map', sub: 'Your degree plan', icon: 'fa-map', keys: 'plan degree scheme' },
    { match: /^\/announcements/, title: 'Announcements', sub: 'News and events', icon: 'fa-bullhorn', keys: 'news events notice' },
    { match: /^\/home\/umtstore/, title: 'UMT Store', sub: 'Campus store', icon: 'fa-shopping-cart', keys: 'shop buy' },
    { match: /^\/academicrecord/, title: 'Important Links', sub: 'Services across UMT', icon: 'fa-link', keys: 'links resources' },
    { match: /^\/advisor/, title: 'Academic Advisor', sub: 'Who advises you, and how to reach them', icon: 'fa-user-tie', keys: 'advisor mentor' },
    { match: /^\/tutorprogram/, title: 'Peer Tutoring', sub: 'Get help from a peer tutor', icon: 'fa-chalkboard-teacher', keys: 'tutor help study' },
    { match: /^\/manage\/changepassword/, title: 'Change Password', sub: 'Account security', icon: 'fa-lock', keys: 'password security' },
    { match: /^\/account\/login/, title: 'Sign in', sub: 'UMT Student Portal', icon: 'fa-sign-in-alt', keys: 'login' }
  ];

  function route(pathname) {
    const p = (pathname || location.pathname).toLowerCase().replace(/\/+$/, '') || '/';
    for (let i = 0; i < ROUTES.length; i++) if (ROUTES[i].match.test(p)) return ROUTES[i];
    return { title: 'UMT Portal', sub: p, icon: 'fa-dot-circle', keys: '' };
  }

  W.UMTX = {
    LS: LS, el: el, qs: qs, qsa: qsa, ROUTES: ROUTES, route: route,
    store: store, FRESH_DAYS: FRESH_DAYS, relativeTime: relativeTime,
    origin: 'https://online.umt.edu.pk'
  };
})();
