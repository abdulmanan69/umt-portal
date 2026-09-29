/* UMT Portal - Reimagined | bridge between the extension and the web companion.
   This runs on companion pages only. It never volunteers data: the record is
   handed over when the student presses "Send to web app" in the extension. */
(function () {
  'use strict';

  const APP = 'umt-companion';
  const ME = 'umt-portal-extension';

  function post(message) {
    window.postMessage(Object.assign({ source: ME }, message), location.origin);
  }

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== APP) return;
    if (data.type === 'ping' || data.type === 'request-snapshot') post({ type: 'hello' });
  });

  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg && msg.umtx === 'push-snapshot' && msg.snapshot) {
      post({ type: 'snapshot', snapshot: msg.snapshot });
    }
  });

  post({ type: 'hello' });
})();
