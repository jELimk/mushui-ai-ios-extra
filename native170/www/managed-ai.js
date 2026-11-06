'use strict';
// 3.2.2: provider keys live on the server (server/ai_gateway.py), never in the app. Every AI call goes to the
// account server with the sign-in token, so the existing request code runs unchanged. People only pick models.
{
  const W = WebEngine, key = W.key, url = W.url, migrate = W.migrate;
  const slots = new Set(['chat', 'image', 'voice', 'tts', 'live']);
  const server = (s) => String(s.human?.serverUrl || window.MIZUKI_SERVER || location.origin).replace(/\/+$/, '');

  W.key = (slot, value) => {
    if (!slots.has(slot)) return key(slot, value);
    return value === undefined ? key('human') : Promise.resolve();
  };
  W.url = (value) => (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(value) ? String(value).replace(/\/$/, '') : url(value));
  W.migrate = (raw) => {
    const s = migrate(raw), st = s.settings, base = server(s) + '/v1/ai';
    Object.assign(st, { provider: 'Managed', baseUrl: base + '/chat', imageProvider: 'ChatGPT', imageBaseUrl: base + '/openai', voiceBaseUrl: base + '/openai', ttsBaseUrl: base + '/openai', liveBaseUrl: base + '/openai', useImageKey: false });
    if (!st.managedAI) Object.assign(st, { managedAI: true, model: 'deepseek-v4-1-flash', imageModel: 'gpt-image-2.5-flare', voiceModel: 'whisper-1' });
    return s;
  };

  // Key and address fields stay in the page, hidden, because the save code still reads them.
  const fields = ['#apiKey', '#apiUrl', '#imageApiKey', '#imageUrl', '#voiceUrl', '#voiceKey', '#liveUrl', '#mzLiveKeyInput'];
  const tidy = () => {
    if (typeof providers !== 'undefined' && !providers.Managed) providers.Managed = { url: '', models: ['deepseek-v4-1-flash'] };
    for (const field of document.querySelectorAll(fields.join(','))) {
      field.hidden = true;
      field.style.display = 'none';
      const label = field.previousElementSibling;
      if (label?.tagName === 'LABEL') label.style.display = 'none';
    }
    for (const el of document.querySelectorAll('.provider-grid, [data-toggle="useImageKey"], [data-toggle="customEndpoint"], [data-action="clearKey"], [data-action="clearImageKey"]')) {
      (el.closest('.toggle-row') || el).style.display = 'none';
      const label = el.previousElementSibling;
      if (el.classList.contains('provider-grid') && label?.tagName === 'LABEL') label.style.display = 'none';
    }
    const liveKey = document.querySelector('[data-action="mzSaveLiveKey"]');
    if (liveKey) (liveKey.closest('.card') || liveKey).style.display = 'none';
    for (const note of document.querySelectorAll('.help, .small, .feature-note')) if (/金鑰|基底網址|網址|API key|base URL/i.test(note.textContent) && !note.closest('.message-scroll')) note.style.display = 'none';
  };
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; tidy(); });
  }).observe(document.documentElement, { childList: true, subtree: true });
}
