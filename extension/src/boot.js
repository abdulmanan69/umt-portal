/* UMT Portal - Reimagined | boot */
(function () {
  'use strict';
  const U = window.UMTX;
  if (!U || !U.shell) return;

  U.shell.boot();

  let started = false;
  function start() {
    if (started) return;
    started = true;
    try { U.shell.buildTopbar(); } catch (e) { console.warn('[umtx] top bar', e); }
    try { U.shell.decorateSidebar(); } catch (e) { console.warn('[umtx] sidebar', e); }
    try { U.shell.buildMobileChrome(); } catch (e) { console.warn('[umtx] mobile chrome', e); }
    try { U.shell.bindKeys(); } catch (e) { console.warn('[umtx] keys', e); }
    try { U.shell.listenForPopup(); } catch (e) { console.warn('[umtx] popup bridge', e); }
    try { U.pages.run(); } catch (e) { console.warn('[umtx] page', e); }
    /* top up anything missing or months old, quietly, after the page settles */
    try { U.data.warm(); } catch (e) { console.warn('[umtx] warm', e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.addEventListener('load', function () {
    try { U.pages.run(); } catch (e) { /* already applied */ }
  });

  /* portal loads parts of some pages over ajax */
  const observer = new MutationObserver(function (records) {
    let touched = false;
    records.forEach(function (r) {
      for (let i = 0; i < r.addedNodes.length; i++) {
        const n = r.addedNodes[i];
        if (n.nodeType === 1 && (n.matches('table') || n.querySelector && n.querySelector('table'))) touched = true;
      }
    });
    if (touched) U.shell.labelTables(document);
  });
  const startObserving = function () {
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) startObserving();
  else document.addEventListener('DOMContentLoaded', startObserving);

  /* keep the top bar tooltip honest as records land */
  document.addEventListener('umtx:record', function () {
    try { U.shell.syncRefreshTitle(); } catch (e) { /* bar not built yet */ }
  });

  let wasMobile = window.matchMedia('(max-width: 1080px)').matches;
  window.addEventListener('resize', function () {
    const now = window.matchMedia('(max-width: 1080px)').matches;
    if (now !== wasMobile) { wasMobile = now; U.shell.setDrawer(false); }
  });
})();
