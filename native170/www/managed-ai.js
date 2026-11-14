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
    if (!st.managedAI) Object.assign(st, { managedAI: true, model: 'deepseek-v4-1-flash-1017', imageModel: 'gpt-image-2.6-flare', voiceModel: 'whisper-1' });
    // 3.4.0: the default chat model moved on; anyone still on the old default follows it.
    if (st.model === 'deepseek-v4-1-flash') st.model = 'deepseek-v4-1-flash-1017';
    // 3.4.0 r10: the default picture model is gpt-image-2.6-flare; anyone on an older default follows it.
    if (!st.imageModel || ['gpt-image-1.5', 'gpt-image-2.5-flare'].includes(st.imageModel)) st.imageModel = 'gpt-image-2.6-flare';
    return s;
  };

  // Key and address fields stay in the page, hidden, because the save code still reads them.
  const fields = ['#apiKey', '#apiUrl', '#imageApiKey', '#imageUrl', '#voiceUrl', '#voiceKey', '#liveUrl', '#mzLiveKeyInput'];
  const tidy = () => {
    if (typeof providers !== 'undefined' && !providers.Managed) providers.Managed = { url: '', models: ['deepseek-v4-1-flash-1017'] };
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
    // A card whose contents are all hidden would stay on the page as an empty white box.
    for (const box of document.querySelectorAll('.api-key-row, #app .content > .card')) {
      const kids = [...box.children];
      if (box.classList.contains('api-key-row') || (kids.length && kids.every((kid) => kid.style.display === 'none' || kid.hidden))) box.style.display = 'none';
    }
  };
  // Every model field can list what the service offers. The list goes away with the page.
  const kinds = { imageModel: ['imageBaseUrl', /gpt-image|image|dall/i], voiceModel: ['voiceBaseUrl', /whisper|transcribe/i], liveModel: ['liveBaseUrl', /live|realtime/i] };
  const addReaders = () => {
    for (const id of Object.keys(kinds)) {
      const input = document.getElementById(id);
      if (!input || input.nextElementSibling?.dataset?.modelread) continue;
      input.insertAdjacentHTML('afterend', `<button type="button" class="link-button" data-modelread="${id}">讀取全部可用模型</button><div class="model-grid" data-modelchips="${id}" hidden></div>`);
      window.mizukiTranslate?.(input.parentElement);
      // 3.4.0 r10: like the chat model, the picture model list loads by itself when the page opens.
      if (id === 'imageModel') setTimeout(() => input.parentElement.querySelector('[data-modelread="imageModel"]')?.click(), 50);
    }
  };
  document.addEventListener('click', async (e) => {
    const read = e.target.closest('[data-modelread]'), chip = e.target.closest('[data-modelpick]');
    if (chip) {
      const input = document.getElementById(chip.parentElement.dataset.modelchips);
      input.value = chip.dataset.modelpick;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      for (const other of chip.parentElement.children) other.classList.toggle('selected', other === chip);
      return;
    }
    if (!read) return;
    const id = read.dataset.modelread, [base, match] = kinds[id], box = document.querySelector(`[data-modelchips="${id}"]`), settings = (await W.read()).settings;
    read.textContent = '讀取中…';
    try {
      const all = await call('models', { settings: { ...settings, baseUrl: settings[base] } });
      let names = [...new Set(all.filter((x) => match.test(x)))];
      // Every GPT-Image model, newest first, then any other picture model.
      if (id === 'imageModel') names = [...names.filter((x) => /gpt-image/i.test(x)).sort((a, b) => b.localeCompare(a, undefined, { numeric: true })), ...names.filter((x) => !/gpt-image/i.test(x))];
      box.innerHTML = names.map((name) => `<button type="button" data-modelpick="${esc(name)}" class="${name === document.getElementById(id).value ? 'selected' : ''}">${esc(name)}</button>`).join('');
      box.hidden = !names.length;
      if (!names.length) toast('這個服務沒有列出可用模型');
    } catch (err) { toast(err.message || '讀取失敗'); }
    read.textContent = '讀取全部可用模型';
    window.mizukiTranslate?.(read.parentElement);
  });
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; tidy(); addReaders(); if (typeof page !== 'undefined' && page !== 'api' && typeof modelList !== 'undefined' && modelList.length) modelList = []; }, 16);
  }).observe(document.documentElement, { childList: true, subtree: true });
}
