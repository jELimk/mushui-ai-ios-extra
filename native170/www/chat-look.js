'use strict';
// 3.4.0 r12: 我 → 設定 → 外觀 → 聊天, a small category of its own.
// 1. Voice bars: style (waveform / short bar / detailed card), spacing, shape, depth, motion, colour and material,
//    with a live preview picture on top (the chat background, or the theme colours).
// 2. Messages start from the top or sit at the bottom by the input box; reply by swiping right or by selecting the
//    text and tapping 回覆; the other side's messages with or without a bubble.
// 3. Text boxes don't catch the page's scroll until you tap into them.
{
  const DEF = { vbStyle: 'wave', vbDensity: 'normal', vbShape: 'soft', vbDepth: 'light', vbMotion: 'soft', vbColor: 'theme', vbMaterial: 'solid', chatOrder: 'top', replyMode: 'swipe', peerBubble: 'on' };
  const OPTS = {
    vbStyle: [['wave', '波形', 'Waveform'], ['bar', '短條', 'Short bar'], ['card', '詳細卡', 'Detailed card']],
    vbDensity: [['compact', '緊湊', 'Compact'], ['normal', '適中', 'Medium'], ['loose', '寬鬆', 'Roomy']],
    vbShape: [['crisp', '利落', 'Crisp'], ['soft', '柔和', 'Soft'], ['round', '圓潤', 'Round']],
    vbDepth: [['flat', '平面', 'Flat'], ['light', '輕微浮起', 'Slight lift'], ['strong', '明顯浮起', 'Clear lift']],
    vbMotion: [['none', '無', 'None'], ['soft', '柔和', 'Gentle'], ['lively', '活潑', 'Lively']],
    vbColor: [['theme', '主題漸層', 'Theme'], ['white', '白色', 'White'], ['accent', '主題色', 'Accent'], ['bubble', '跟氣泡同色', 'Like bubbles']],
    vbMaterial: [['solid', '實色', 'Solid'], ['glass', '毛玻璃', 'Frosted'], ['clear', '透明', 'Clear']],
    chatOrder: [['top', '從上往下', 'Top down'], ['bottom', '從下往上', 'Bottom up']],
    replyMode: [['swipe', '右滑回覆', 'Swipe right'], ['select', '選取文字回覆', 'Select text']],
    peerBubble: [['on', '有氣泡框', 'With bubble'], ['off', '沒有氣泡框', 'No bubble']],
  };
  const pick = (k) => { const s = (typeof draft !== 'undefined' && draft) || state?.settings || {}; return OPTS[k].some((o) => o[0] === s[k]) ? s[k] : DEF[k]; };
  const saved = (k) => { const s = state?.settings || {}; return OPTS[k].some((o) => o[0] === s[k]) ? s[k] : DEF[k]; };
  let part = 'shape';

  // ---- styles ----
  const css = document.createElement('style');
  css.id = 'mz-chat-look';
  css.textContent = `
.voice-player{--vdur:4}
.voice-player .vb-icon,.voice-player .vb-meta{display:none}
html.mz-vb-bar .bubble.voice-only,html.mz-vb-card .bubble.voice-only{background:transparent!important;box-shadow:none!important;border-color:transparent!important;padding:0!important}
html.mz-vb-bar .bubble.voice-only .voice-player,html.mz-vb-card .bubble.voice-only .voice-player{margin:0}
html.mz-vb-bar .voice-player{width:min(calc(110px + min(var(--vdur),60) * 2.6px),100%);cursor:pointer}
html.mz-vb-bar .voice-player .voice-wave{opacity:0;pointer-events:none;flex:1;min-width:8px}
html.mz-vb-bar .voice-player .voice-play{background:transparent!important;box-shadow:none!important;color:inherit!important;font-size:0;flex-basis:26px;width:26px}
html.mz-vb-bar .voice-player .vb-icon{display:block;width:22px;height:22px;pointer-events:none}
html.mz-vb-bar .voice-player time{font-size:13px;color:inherit;opacity:.85}
html.mz-vb-bar .message.mine .voice-player{flex-direction:row-reverse;margin-left:auto}
html.mz-vb-bar .message.mine .voice-player time{text-align:left}
html.mz-vb-card .voice-player{display:grid;grid-template-columns:auto 1fr auto;grid-template-areas:"p m t" "w w w";row-gap:6px;width:min(280px,100%)}
html.mz-vb-card .voice-player .voice-play{grid-area:p}
html.mz-vb-card .voice-player .vb-meta{grid-area:m;display:grid;min-width:0;line-height:1.25}
html.mz-vb-card .voice-player .vb-meta b{font-size:13px}
html.mz-vb-card .voice-player .vb-meta small{font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
html.mz-vb-card .voice-player time{grid-area:t;align-self:start}
html.mz-vb-card .voice-player .voice-wave{grid-area:w;height:22px}
html.mz-vbd-compact .voice-player{min-height:36px;padding:3px 8px;gap:7px;margin:4px 0}
html.mz-vbd-compact .voice-player .voice-play{flex-basis:26px;width:26px;height:26px}
html.mz-vbd-loose .voice-player{min-height:58px;padding:11px 15px;gap:13px}
html.mz-vbs-crisp .voice-player{border-radius:8px}
html.mz-vbs-round .voice-player{border-radius:999px}
html.mz-vbs-round.mz-vb-card .voice-player{border-radius:24px}
html.mz-vbl-flat .voice-player{box-shadow:none!important}
html.mz-vbl-strong .voice-player{box-shadow:0 10px 24px color-mix(in srgb,var(--accent) 24%,transparent),0 2px 6px #00000014!important}
html.mz-vbc-white .voice-player{background:#fff!important;border-color:var(--line)!important;color:var(--ink)!important}
html.mz-vbc-accent .voice-player{background:var(--accent)!important;border-color:transparent!important;color:#fff!important}
html.mz-vbc-accent .voice-player time,html.mz-vbc-accent .voice-player .vb-meta small{color:#ffffffd0}
html.mz-vbc-accent .voice-player .voice-wave i{background:#ffffffc0}
html.mz-vbc-accent .voice-player .voice-play{background:#ffffff40;color:#fff}
html.mz-vbc-bubble .voice-player{background:var(--bubble)!important;border-color:transparent!important}
html.mz-vbc-bubble .message:not(.mine) .voice-player{background:#fff!important}
html.mz-dark.mz-vbc-white .voice-player,html.mz-dark.mz-vbc-bubble .message:not(.mine) .voice-player{background:var(--tp-2a2431,#2a2431)!important;color:var(--ink)!important}
html.mz-vbt-glass .voice-player{background:color-mix(in srgb,var(--bg) 52%,transparent)!important;-webkit-backdrop-filter:blur(14px) saturate(1.4);backdrop-filter:blur(14px) saturate(1.4);border-color:#ffffff70!important}
html.mz-vbt-clear .voice-player{background:transparent!important;box-shadow:none!important;border:1.5px solid color-mix(in srgb,var(--accent) 45%,transparent)!important}
html.mz-vbm-none .voice-wave::before{transition:none}
.voice-player.vb-on .vb-icon path.vb-w{animation:mzVbWave 1s ease-in-out infinite}
.voice-player.vb-on .vb-icon path.vb-w2{animation-delay:.25s}
html.mz-vbm-none .voice-player.vb-on .vb-icon path{animation:none}
html.mz-vbm-lively .voice-player.vb-on .voice-wave i{animation:mzVbBounce .7s ease-in-out infinite alternate}
html.mz-vbm-lively .voice-player.vb-on .voice-wave i:nth-child(3n){animation-delay:.2s}
html.mz-vbm-lively .voice-player.vb-on .voice-wave i:nth-child(3n+1){animation-delay:.4s}
html.mz-vbm-lively .voice-player.vb-on{transform:scale(1.02);transition:transform .2s}
@keyframes mzVbWave{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes mzVbBounce{from{transform:scaleY(.55)}to{transform:scaleY(1.15)}}
html.mz-order-bottom .message-scroll{display:flex;flex-direction:column}
html.mz-order-bottom .message-scroll>.message-list{margin-top:auto;flex:0 0 auto}
html.mz-peer-off .message:not(.mine):not(.call-event) .bubble:not(.voice-only){background:transparent!important;box-shadow:none!important;border-color:transparent!important;padding-left:2px!important;padding-right:2px!important;backdrop-filter:none!important}
html.mz-reply-select .touch-message-ui .message .bubble,html.mz-reply-select .touch-message-ui .message .bubble *{-webkit-user-select:text!important;user-select:text!important}
.mz-reply-bar{position:fixed;z-index:60;display:flex;gap:2px;padding:4px;border-radius:14px;background:var(--ink,#222);box-shadow:0 8px 22px #0000003a;transform:translate(-50%,-100%)}
.mz-reply-bar button{padding:8px 13px;border:0;border-radius:10px;background:transparent;color:var(--bg,#fff);font-size:13px;font-weight:600}
.mz-cl-sticky{position:sticky;top:var(--mz-cl-top,72px);z-index:4;padding:10px}
html.mz-glass:root .mz-cl-sticky{background:var(--glass-strong)!important;-webkit-backdrop-filter:blur(24px);backdrop-filter:blur(24px)}
.mz-cl-preview{position:relative;display:grid;gap:10px;padding:16px 14px;border-radius:22px;overflow:hidden;background:linear-gradient(160deg,var(--soft),var(--bg)) center/cover}
.mz-cl-preview .message{display:flex;margin:0;padding:0;animation:none}
.mz-cl-preview .message.mine{flex-direction:row-reverse}
.mz-cl-preview .message-body{max-width:86%;display:flex;flex-direction:column}
.mz-cl-preview .message.mine .message-body{align-items:flex-end}
.mz-cl-preview .voice-caption{display:none}
.mz-cl-card .mz-segs.mz-cl-4{grid-template-columns:repeat(2,1fr)}
.mz-cl-card .mz-segs.mz-cl-2{grid-template-columns:repeat(2,1fr)}
.mz-cl-card label.mz-cl-label{display:block;margin:14px 0 0;font-size:13px;color:var(--muted)}
.mz-cl-parts{margin-top:4px}
/* 3. A text box doesn't scroll with the page until you tap into it. */
html.touch-ui textarea:not(:focus){overflow-y:hidden!important;overscroll-behavior:auto}
html.touch-ui textarea:focus{overscroll-behavior:contain}
`;
  document.head.append(css);
  try { document.documentElement.classList.toggle('touch-ui', isTouchDevice()); } catch {}

  const CLASS = { vbStyle: 'mz-vb-', vbDensity: 'mz-vbd-', vbShape: 'mz-vbs-', vbDepth: 'mz-vbl-', vbMotion: 'mz-vbm-', vbColor: 'mz-vbc-', vbMaterial: 'mz-vbt-', chatOrder: 'mz-order-', replyMode: 'mz-reply-', peerBubble: 'mz-peer-' };
  function apply() {
    const root = document.documentElement;
    for (const k of Object.keys(OPTS)) for (const [v] of OPTS[k]) root.classList.toggle(CLASS[k] + v, pick(k) === v);
  }
  const themeBefore = applyTheme;
  applyTheme = function (...args) { const r = themeBefore.apply(this, args); try { apply(); } catch {} return r; };
  apply();

  // ---- voice bar markup: the speaker icon (short bar) and the title line (detailed card) ----
  const SPEAKER = '<svg class="vb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3l4.5-4v13L7 14.5H4z" fill="currentColor"/><path class="vb-w" d="M15 9a4 4 0 0 1 0 6"/><path class="vb-w vb-w2" d="M18 6.5a8 8 0 0 1 0 11"/></svg>';
  const voiceBefore = voiceHtml;
  voiceHtml = (a) => {
    const html = voiceBefore(a);
    if (!a?.data) return html;
    const d = Math.max(1, Math.round(+a.duration || 0));
    const kind = String(a.data).slice(5, String(a.data).indexOf(';')).split('/')[1] || 'audio';
    const meta = `<span class="vb-meta"><b>${mzT('語音訊息', 'Voice message')}</b><small>voice-${d}s.${esc(kind.replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'audio')}</small></span>`;
    return html.replace('<div class="voice-player">', `<div class="voice-player" style="--vdur:${d}">`).replace(/(<button class="voice-play"[^>]*>)([^<]*)(<\/button>)/, `$1$2${SPEAKER}$3${meta}`);
  };
  // voice.js writes ▶ / Ⅱ as the button text, which would wipe the icon: keep the icon inside.
  const keepIcon = (b) => { if (b && !b.querySelector('.vb-icon')) b.insertAdjacentHTML('beforeend', SPEAKER); };
  for (const type of ['play', 'pause', 'ended']) document.addEventListener(type, (e) => {
    if (!e.target.matches?.('.voice-audio')) return;
    const box = e.target.closest('.voice-player');
    box?.classList.toggle('vb-on', type === 'play');
    setTimeout(() => keepIcon(box?.querySelector('.voice-play')), 0);
  }, true);
  // A short bar plays from anywhere on it.
  document.addEventListener('click', (e) => {
    if (!document.documentElement.classList.contains('mz-vb-bar')) return;
    const box = e.target.closest?.('.voice-player');
    if (!box || e.target.closest('.voice-play') || box.closest('.mz-cl-preview')) return;
    box.querySelector('.voice-play')?.click();
  });

  // ---- the page ----
  const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
  const seg = (k, cls = '') => `<div class="mz-segs ${cls}">${OPTS[k].map(([v, zh, en]) => `<button type="button" class="mz-seg ${pick(k) === v ? 'selected' : ''}" data-mzcl="${k}:${v}">${mzT(zh, en)}</button>`).join('')}</div>`;
  const row = (k, zh, en, cls) => `<label class="mz-cl-label">${mzT(zh, en)}</label>${seg(k, cls)}`;
  function preview() {
    const bg = state?.settings?.chatBg;
    const msg = (mine, inner, voice) => `<div class="message ${mine ? 'mine' : ''}"><div class="message-body"><div class="bubble${voice ? ' voice-only' : ''}">${inner}</div></div></div>`;
    return `<div class="mz-cl-preview conversation" ${bg ? `style="background-image:url('${esc(bg)}')"` : ''} aria-hidden="true">${msg(false, voiceHtml({ data: SILENT, duration: 4 }), true)}${msg(true, voiceHtml({ data: SILENT, duration: 8 }), true)}${msg(false, mzT('語音的文字會顯示在下面，可以選取複製。', 'The words of a voice message show below it and can be copied.'))}${msg(true, mzT('好～', 'OK~'))}</div>`;
  }
  function parts() {
    const tab = (id, zh, en) => `<button type="button" class="mz-seg ${part === id ? 'selected' : ''}" data-mzclpart="${id}">${mzT(zh, en)}</button>`;
    const body = part === 'color' ? row('vbColor', '顏色', 'Colour', 'mz-cl-4')
      : part === 'material' ? row('vbMaterial', '材質', 'Material')
        : row('vbStyle', '樣式', 'Style') + row('vbDensity', '疏密', 'Spacing') + row('vbShape', '形狀', 'Shape') + row('vbDepth', '層次', 'Depth') + row('vbMotion', '動效', 'Motion');
    return `<div class="mz-segs mz-cl-parts">${tab('color', '顏色', 'Colour')}${tab('shape', '形態', 'Form')}${tab('material', '材質', 'Material')}</div>${body}`;
  }
  function chatLookPage() {
    return `<div class="card mz-cl-card mz-cl-sticky">${preview()}</div>`
      + `<div class="card mz-cl-card"><h3>${mzT('語音條', 'Voice bars')}</h3><p class="help">${mzT('聊天裡發出和收到的語音：可以換成波形、隨時長伸縮的短條，或有檔名的詳細卡。', 'Voice messages you send and get: a waveform, a short bar that grows with its length, or a detailed card with a file name.')}</p><div data-mzclparts>${parts()}</div></div>`
      + `<div class="card mz-cl-card"><h3>${mzT('訊息', 'Messages')}</h3>${row('chatOrder', '訊息排列', 'Message order', 'mz-cl-2')}<p class="help">${mzT('從上往下：訊息從畫面頂端開始排。從下往上：訊息貼著輸入框，舊的往上推。', 'Top down: messages start at the top. Bottom up: messages sit by the input box and older ones move up.')}</p>${row('replyMode', '回覆方式', 'How to reply', 'mz-cl-2')}<p class="help">${mzT('選取文字回覆：長按訊息會選取全部文字，可以拉動選取範圍，再按「回覆」只引用選取的部分。電腦直接用滑鼠選取文字。', 'Select text: press and hold a message to select all its text, adjust the selection, then tap Reply to quote just that part. On a computer, select text with the mouse.')}</p>${row('peerBubble', '對方的訊息', "Other side's messages", 'mz-cl-2')}</div>`
      + `<p class="help">${mzT('會即時預覽並自動保留。', 'Changes preview right away and are kept automatically.')}</p>`;
  }
  pageNames.chatLook = '聊天';
  const pageBefore = settingsPage;
  settingsPage = function () {
    if (page !== 'chatLook') return pageBefore();
    // The preview stays on screen while the options below scroll, just under the title bar (its height varies).
    setTimeout(() => { const top = document.querySelector('.page > .top'); if (top) document.documentElement.style.setProperty('--mz-cl-top', top.offsetHeight + 'px'); });
    return `<header class="top"><div class="between"><div class="flex">${btn('back', 'back', '返回')}<h2>${mzT('聊天', 'Chat')}</h2></div><button class="pill save" data-action="save">${mzT('儲存', 'Save')}</button></div></header><div class="content">${chatLookPage()}</div>`;
  };
  const appearanceBefore = appearancePage;
  appearancePage = function () {
    const sub = [OPTS.vbStyle.find((o) => o[0] === pick('vbStyle')), OPTS.peerBubble.find((o) => o[0] === pick('peerBubble'))].map((o) => mzT(o[1], o[2])).join(' · ');
    return `<div class="card">${settingRow('chatLook', 'chat', mzT('聊天', 'Chat'), sub)}</div>` + appearanceBefore();
  };

  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-mzcl]');
    if (b) {
      const [k, v] = b.dataset.mzcl.split(':');
      if (!draft || !OPTS[k]) return;
      draft[k] = v;
      dirty = true;
      apply();
      b.parentElement.querySelectorAll('.mz-seg').forEach((x) => x.classList.toggle('selected', x === b));
      return;
    }
    const p = e.target.closest?.('[data-mzclpart]');
    if (p) {
      part = p.dataset.mzclpart;
      const box = document.querySelector('[data-mzclparts]');
      if (box) box.innerHTML = parts();
    }
  });

  // ---- 2. Reply by selecting text ----
  const selecting = () => saved('replyMode') === 'select' || pick('replyMode') === 'select';
  let quote = '';
  const replyBefore = replyMessageId;
  replyMessageId = function (id, ...rest) {
    const q = quote; quote = '';
    const r = replyBefore.call(this, id, ...rest);
    if (q && replyDrafts[chatId]) { replyDrafts[chatId].text = q.slice(0, 300); render(); document.querySelector('.composer textarea')?.focus({ preventScroll: true }); }
    return r;
  };
  // A sideways swipe on a message: in select mode it does nothing (no slide, no reply).
  document.addEventListener('pointermove', (e) => {
    if (!selecting() || typeof touchMessageGesture === 'undefined') return;
    const g = touchMessageGesture;
    if (!g || g.pointer !== e.pointerId) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (Math.abs(dx) > 9 && Math.abs(dx) > Math.abs(dy) * 1.2) { clearTimeout(g.timer); touchMessageGesture = null; g.row.style.transform = ''; }
  }, true);

  // Press and hold: select the whole message, then show 回覆 / 複製 / 更多 above it.
  let holdTimer = 0;
  document.addEventListener('pointerdown', (e) => {
    clearTimeout(holdTimer);
    if (!selecting() || e.pointerType === 'mouse') return;
    const row = e.target.closest?.('.message[data-message-id]'), bubble = e.target.closest?.('.bubble');
    if (!row || !bubble || row.closest('.mz-cl-preview') || e.target.closest('button,a,input,textarea,audio,video,img')) return;
    const x = e.clientX, y = e.clientY;
    const cancel = (ev) => { if (Math.abs(ev.clientX - x) > 9 || Math.abs(ev.clientY - y) > 9) clearTimeout(holdTimer); };
    document.addEventListener('pointermove', cancel, { passive: true });
    setTimeout(() => document.removeEventListener('pointermove', cancel), 700);
    holdTimer = setTimeout(() => {
      if (typeof touchMessageGesture !== 'undefined' && touchMessageGesture) { clearTimeout(touchMessageGesture.timer); touchMessageGesture = null; }
      const text = bubble.querySelector('.chat-line, p') || bubble;
      try { const r = document.createRange(); r.selectNodeContents(text); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch {}
      showBar(row.dataset.messageId);
    }, 480);
  }, true);
  document.addEventListener('pointerup', () => clearTimeout(holdTimer), true);
  document.addEventListener('contextmenu', (e) => { if (selecting() && e.target.closest?.('.message .bubble') && isTouchDevice()) e.preventDefault(); }, true);

  let bar = null, barFor = '';
  function hideBar() { bar?.remove(); bar = null; barFor = ''; }
  function showBar(id) {
    hideBar();
    const row = document.querySelector(`.message[data-message-id="${CSS.escape(id)}"]`);
    const box = row?.querySelector('.bubble')?.getBoundingClientRect();
    if (!box) return;
    barFor = id;
    bar = document.createElement('div');
    bar.className = 'mz-reply-bar';
    bar.innerHTML = `<button type="button" data-mzrb="reply">${mzT('回覆', 'Reply')}</button><button type="button" data-mzrb="copy">${mzT('複製', 'Copy')}</button><button type="button" data-mzrb="more">${mzT('更多', 'More')}</button>`;
    bar.style.left = Math.max(90, Math.min(innerWidth - 90, box.left + box.width / 2)) + 'px';
    bar.style.top = Math.max(70, box.top - 8) + 'px';
    document.body.append(bar);
  }
  const selectedIn = (id) => {
    const s = getSelection(), t = String(s || '').trim();
    if (!t || !s.rangeCount) return '';
    const row = s.getRangeAt(0).commonAncestorContainer.parentElement?.closest?.('.message[data-message-id]') || s.anchorNode?.parentElement?.closest?.('.message[data-message-id]');
    return row?.dataset.messageId === id ? t : '';
  };
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest?.('[data-mzrb]');
    if (!b) { if (bar && !e.target.closest('.mz-reply-bar')) setTimeout(() => { if (!String(getSelection() || '').trim()) hideBar(); }, 250); return; }
    e.preventDefault(); // keep the selection
    const id = barFor, text = selectedIn(id);
    if (b.dataset.mzrb === 'reply') { quote = text; hideBar(); getSelection()?.removeAllRanges(); replyMessageId(id); }
    else if (b.dataset.mzrb === 'copy') { const m = messageById(id); navigator.clipboard?.writeText(text || m?.text || '').then(() => toast(mzT('已複製', 'Copied'), 1000)).catch(() => {}); hideBar(); getSelection()?.removeAllRanges(); }
    else { hideBar(); getSelection()?.removeAllRanges(); messageActions(id); }
  }, true);
  // On a computer: select text in a message with the mouse and the bar shows up.
  document.addEventListener('mouseup', (e) => {
    if (!selecting() || e.target.closest?.('.mz-reply-bar')) return;
    setTimeout(() => {
      const s = getSelection(), t = String(s || '').trim();
      if (!t || !s.rangeCount) return;
      const row = s.anchorNode?.parentElement?.closest?.('.message[data-message-id]');
      if (row && !row.closest('.mz-cl-preview') && selectedIn(row.dataset.messageId)) showBar(row.dataset.messageId);
    }, 0);
  });
  document.addEventListener('scroll', () => { if (bar) hideBar(); }, true);
}
// Back from 外觀 → 聊天 returns to 外觀 (an older back handler sends unknown settings pages home).
{
  const backBefore = window.goBack;
  window.goBack = function (...args) {
    if (!modal && !chatId && tab === 'settings' && page === 'chatLook') {
      if (typeof accountPageHistory !== 'undefined' && accountPageHistory.at(-1)?.page === 'appearance') accountPageHistory.pop();
      page = 'appearance';
      render();
      return true;
    }
    return backBefore?.apply(this, args);
  };
}
