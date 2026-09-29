(function () {
  const PORTAL = 'https://online.umt.edu.pk';
  const get = function (keys) { return new Promise(function (r) { chrome.storage.local.get(keys, r); }); };
  const set = function (obj) { return new Promise(function (r) { chrome.storage.local.set(obj, r); }); };

  function parse(raw) {
    try { return JSON.parse(raw || 'null'); } catch (e) { return null; }
  }

  function unwrap(rec) {
    if (!rec) return null;
    if (rec.ver && rec.value) return { value: rec.value, ts: rec.ts };
    if (rec.fetchedAt) return { value: rec, ts: rec.fetchedAt };
    return null;
  }

  function relative(ts) {
    if (!ts) return 'not loaded yet';
    const mins = (Date.now() - ts) / 60000;
    if (mins < 2) return 'just now';
    if (mins < 60) return Math.round(mins) + ' min ago';
    const hours = mins / 60;
    if (hours < 24) return Math.round(hours) + ' h ago';
    const days = hours / 24;
    if (days < 30) return Math.round(days) + ' d ago';
    return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function money(n) { return 'Rs ' + Math.round(n || 0).toLocaleString('en-PK'); }

  function render(state) {
    const theme = state['umtx.theme'] === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);

    const student = parse(state['umtx.student']);
    if (student && student.name) {
      document.getElementById('name').textContent = student.name;
      document.getElementById('id').textContent = student.id || '';
    }

    const t = unwrap(parse(state['umtx.cache.transcript']));
    const p = unwrap(parse(state['umtx.cache.payments']));

    if (t && t.value.totals) {
      document.getElementById('cgpa').textContent = (t.value.totals.cgpa || 0).toFixed(2);
      document.getElementById('credits').textContent = t.value.totals.credits || 0;
      document.getElementById('sems').textContent = (t.value.semesters || []).length;
    }
    if (p && p.value.items) {
      const total = p.value.items.reduce(function (n, i) { return n + (i.amount || 0); }, 0);
      document.getElementById('paid').textContent = money(total);
    }
    document.getElementById('t-age').textContent = relative(t && t.ts);
    document.getElementById('p-age').textContent = relative(p && p.ts);
  }

  get(['umtx.theme', 'umtx.student', 'umtx.cache.transcript', 'umtx.cache.payments']).then(render);

  document.getElementById('theme').addEventListener('click', function () {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    set({ 'umtx.theme': next });
  });

  const refreshBtn = document.getElementById('refresh');
  refreshBtn.addEventListener('click', function () {
    refreshBtn.disabled = true;
    refreshBtn.classList.add('busy');
    refreshBtn.textContent = 'Refreshing in the portal tab...';

    chrome.tabs.query({ url: PORTAL + '/*' }, function (tabs) {
      if (!tabs.length) {
        chrome.tabs.create({ url: PORTAL + '/Home/Index' });
        window.close();
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { umtx: 'refresh' }, function () {
        const failed = chrome.runtime.lastError;
        refreshBtn.classList.remove('busy');
        refreshBtn.disabled = false;
        refreshBtn.textContent = failed ? 'Open the portal tab and try again' : 'Refreshed';
        if (!failed) {
          get(['umtx.theme', 'umtx.student', 'umtx.cache.transcript', 'umtx.cache.payments']).then(render);
          setTimeout(function () { refreshBtn.textContent = 'Refresh now'; }, 2500);
        }
      });
    });
  });

  /* Hand the record to an open companion tab, only when asked. */
  const sendBtn = document.getElementById('send');
  sendBtn.addEventListener('click', function () {
    sendBtn.disabled = true;
    sendBtn.textContent = 'Looking for the app...';
    chrome.tabs.query({ url: ['https://*.github.io/*', 'http://localhost/*', 'http://127.0.0.1/*'] }, function (appTabs) {
      if (!appTabs.length) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Open the web app first';
        setTimeout(function () { sendBtn.textContent = 'Send to web app'; }, 2600);
        return;
      }
      chrome.tabs.query({ url: PORTAL + '/*' }, function (portalTabs) {
        if (!portalTabs.length) {
          sendBtn.disabled = false;
          sendBtn.textContent = 'Open the portal tab first';
          setTimeout(function () { sendBtn.textContent = 'Send to web app'; }, 2600);
          return;
        }
        chrome.tabs.sendMessage(portalTabs[0].id, { umtx: 'snapshot' }, function (reply) {
          if (chrome.runtime.lastError || !reply || !reply.ok) {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Could not read the record';
            setTimeout(function () { sendBtn.textContent = 'Send to web app'; }, 2600);
            return;
          }
          appTabs.forEach(function (tab) {
            chrome.tabs.sendMessage(tab.id, { umtx: 'push-snapshot', snapshot: reply.snapshot }, function () {
              void chrome.runtime.lastError;
            });
          });
          sendBtn.textContent = 'Sent';
          setTimeout(function () {
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send to web app';
          }, 2600);
        });
      });
    });
  });

  document.querySelectorAll('[data-go]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      chrome.tabs.create({ url: a.href });
    });
  });
})();
