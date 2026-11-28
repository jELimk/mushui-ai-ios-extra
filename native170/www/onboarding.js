'use strict';
// 3.4.4: the first time Mizuki opens on a device (from the user's reference video, own wording): 「先問一句」 —
// old user (sign in or import a backup) or new user (a short walk through the five tabs), and a cheeky way out in the
// corner: 「我自己配，別煩我」. People who already have chats never see it.
{
  const KEY = 'mz-welcome-v1';
  const seen = () => { try { return !!localStorage.getItem(KEY); } catch { return true; } };
  const mark = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch {} };
  const close = () => { document.getElementById('mz-welcome')?.remove(); document.getElementById('mz-tour')?.remove(); mark(); };

  const welcome = () => {
    if (document.getElementById('mz-welcome')) return;
    const el = document.createElement('div'); el.id = 'mz-welcome';
    el.innerHTML = `<button class="mz-wl-skip" data-mzwl="skip">${mzT('我自己配，別煩我', "I'll set it up myself, leave me alone")}</button>
<div class="mz-wl-body"><h1>${mzT('先問一句', 'Quick question')}</h1><p>${mzT('你以前用過沐水嗎？這決定我接下來要不要帶你走一遍。', 'Have you used Mizuki before? That decides whether I walk you through it.')}</p>
<button class="mz-wl-card old" data-mzwl="old"><b>${mzT('我是老用戶', "I've used it before")}</b><small>${mzT('我有帳號或備份，登入或匯入就完事', 'I have an account or a backup — sign in or import and done')}</small><span>→</span></button>
<button class="mz-wl-card new" data-mzwl="new"><b>${mzT('我是新用戶', "I'm new")}</b><small>${mzT('第一次用，帶我走一遍', 'First time — show me around')}</small><span>→</span></button></div>`;
    document.body.append(el);
    requestAnimationFrame(() => el.classList.add('on'));
  };

  // the walk (3.4.4 r4): goes to each page and points at the real button; a step whose button isn't there is skipped
  const OFF = () => (typeof MIZUKI_OFFICIAL_ID !== 'undefined' ? MIZUKI_OFFICIAL_ID : 'mizuki');
  const go = (tb, pg = '', chat = '') => () => { try { closeModal(); } catch {} tab = tb; page = pg; chatId = chat; render(); };
  const signed = () => { try { return !!humanData().connected; } catch { return false; } };
  const STEPS = [
    [go('chats'), 'nav:chats', ['聊天', 'Chats'], ['和 AI、朋友的聊天都在這裡。點一下就能打開。', 'All your chats with AIs and friends. Tap one to open it.']],
    [go('chats'), '[data-action="newChat"]', ['開新聊天', 'New chat'], ['按這裡開新的聊天或群組，AI 和朋友可以放在同一個群。', 'Start a new chat or group; AIs and friends can be in the same group.']],
    [go('contacts'), 'nav:contacts', ['聯絡人', 'Contacts'], ['你的 AI 和朋友都在這裡。', 'Your AIs and friends.']],
    [go('contacts'), '[data-action="mzCustomAI"]', ['自訂 AI', 'Custom AI'], ['選幾個喜歡的設定，沐水幫你寫好個性和說話方式。', 'Pick a few settings and Mizuki writes the personality for you.']],
    [go('contacts'), '.top [data-action="import"]', ['匯入角色', 'Import a character'], ['已經有角色檔？從這裡匯入。', 'Already have a character file? Import it here.']],
    [go('contacts'), '[data-contactmode="human"]', ['AI／人類', 'AI / People'], ['點這裡或左右滑，切到真人朋友，用對方的 ID 加好友。', 'Tap or swipe to see real friends and add them by ID.']],
    [go('moments'), '[data-action="compose"]', ['朋友圈', 'Moments'], ['按這裡發朋友圈；AI 也會發文、按讚、留言。', 'Post here; your AIs post, like and comment too.']],
    [go('music'), 'nav:music', ['聽歌', 'Music'], ['和 AI 或朋友一起聽歌，最多 10 個人。', 'Listen together with AIs or friends — up to 10 people.']],
    [() => { if (signed()) go('chats', '', 'human:' + OFF())(); }, '.conversation [data-action="composerPlus"]', ['更多功能', 'More'], ['照片、拍照、檔案、轉帳、禮物、位置都在這裡。', 'Photos, camera, files, transfers, gifts and location.']],
    [null, '.conversation [data-action="stickers"]', ['表情包', 'Stickers'], ['表情包和顏文字大總會。', 'Stickers and the kaomoji collection.']],
    [null, '.conversation [data-input="message"]', ['打字', 'Type'], ['在這裡打字，按傳送就送出。', 'Type here and press send.']],
    [null, '[data-mzmushui="toggle"]', ['沐水', 'Mizuki'], ['按一下，沐水會出現在聊天背景陪你。', 'Tap and Mizuki appears in the chat background.']],
    [null, '.conversation .top [data-action="chatOptions"]', ['聊天設定', 'Chat settings'], ['每個聊天右上角的 ⋯：搜尋、置頂、背景、AI 設定。', 'The ⋯ in every chat: search, pin, background, AI settings.']],
    [go('settings'), 'nav:settings', ['我', 'Me'], ['個人資料、狀態、收藏、日常、表情包都在這裡。', 'Profile, status, favourites, daily and stickers.']],
    [go('settings'), '[data-action="goSettings"]', ['設定', 'Settings'], ['所有設定都在這裡，改了會自動儲存。', 'All settings; changes save themselves.']],
    [() => { go('settings')(); document.querySelector('#app [data-action="goSettings"]')?.click(); }, '#app [data-page="api"]', ['模型與 API', 'Models & API'], ['先在這裡選好模型，AI 才能回你。', 'Pick a model here first so your AIs can reply.']],
    [null, '#app [data-page="appearance"]', ['外觀', 'Appearance'], ['主題、玻璃效果、深色模式、字體。', 'Themes, glass effect, dark mode, fonts.']],
    [null, '#app [data-page="privacy"]', ['隱私與 APP 鎖', 'Privacy & app lock'], ['緊急聯絡人、APP 鎖、守護者。', 'Emergency contacts, app lock, guardians.']],
    [null, '#app [data-page="backup"]', ['備份與還原', 'Backup'], ['換手機前記得先備份。', 'Back up before you switch phones.']],
  ];
  const vis = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden' ? e : null; };
  const find = (sel) => [...document.querySelectorAll(sel.startsWith('nav:') ? `#app [data-tab="${sel.slice(4)}"]` : sel)].map(vis).find(Boolean);
  let at = 0;
  const tour = async (i = 0, dir = 1) => {
    document.getElementById('mz-welcome')?.remove();
    for (; i >= 0 && i < STEPS.length; i += dir) {
      try { STEPS[i][0]?.(); } catch {}
      let t = null;
      for (let k = 0; k < 12 && !t; k++) { await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); t = find(STEPS[i][1]); if (!t) await new Promise((r) => setTimeout(r, 40)); }
      if (t) { if (t.getBoundingClientRect().top < 70 || t.getBoundingClientRect().bottom > innerHeight - 90) t.scrollIntoView?.({ block: 'center' }); await new Promise((r) => requestAnimationFrame(r)); t = find(STEPS[i][1]) || t; return draw(i, t); }
    }
    close(); go('chats')();
  };
  const draw = (i, t) => {
    at = i;
    let el = document.getElementById('mz-tour');
    if (!el) { el = document.createElement('div'); el.id = 'mz-tour'; document.body.append(el); }
    const r = t.getBoundingClientRect(), name = STEPS[i][2], text = STEPS[i][3], last = i === STEPS.length - 1;
    const below = r.top + r.height / 2 < innerHeight / 2, w = Math.min(300, innerWidth - 32), left = Math.min(Math.max(16, r.left + r.width / 2 - w / 2), innerWidth - w - 16);
    const ax = Math.min(Math.max(18, r.left + r.width / 2 - left), w - 18);
    if (!el.firstChild) el.innerHTML = '<i class="mz-tour-ring"></i><div class="mz-tour-tip"></div>';
    const ring = el.firstChild, tip = el.lastChild;
    Object.assign(ring.style, { left: r.left - 6 + 'px', top: r.top - 6 + 'px', width: r.width + 12 + 'px', height: r.height + 12 + 'px' });
    tip.className = 'mz-tour-tip ' + (below ? 'down' : 'up');
    tip.style.cssText = `width:${w}px;left:${left}px;${below ? `top:${r.bottom + 16}px` : `bottom:${innerHeight - r.top + 16}px`};--ax:${ax}px`;
    tip.innerHTML = `<b>${mzT(...name)}</b><p>${mzT(...text)}</p>
<div class="mz-tour-row"><span>${i + 1} / ${STEPS.length}</span>${i ? `<button data-mzwl="prev" data-i="${i}">${mzT('上一步', 'Back')}</button>` : ''}<button data-mzwl="skip">${mzT('跳過', 'Skip')}</button><button class="go" data-mzwl="${last ? 'done' : 'next'}" data-i="${i}">${last ? mzT('開始吧', "Let's go") : mzT('下一步', 'Next')}</button></div>`;
    el.classList.remove('moving');
  };
  addEventListener('resize', () => { if (document.getElementById('mz-tour')) { const t = find(STEPS[at][1]); if (t) draw(at, t); } });
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-mzwl]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const what = b.dataset.mzwl;
    if (what === 'skip' || what === 'done') { close(); if (what === 'done') go('chats')(); if (what === 'skip') toast?.(mzT('好，不吵你 (｡•ᴗ•｡)', "Okay, I'll leave you alone (｡•ᴗ•｡)"), 1600); return; }
    if (what === 'old') { close(); try { if (typeof actions.humanAccount === 'function') actions.humanAccount(); else { tab = 'settings'; page = 'backup'; render(); } } catch {} return; }
    if (what === 'new') { mark(); tour(0); return; }
    if (what === 'next' || what === 'prev') document.getElementById('mz-tour')?.classList.add('moving');
    if (what === 'next') tour(Number(b.dataset.i) + 1);
    if (what === 'prev') tour(Number(b.dataset.i) - 1, -1);
  }, true);
  // only for a fresh start: no chats yet and never shown on this device
  setTimeout(() => {
    try {
      if (seen() || window.MizukiStaffEdition) return;
      const used = (state?.chats || []).some((c) => (c.messages || []).some((m) => m.author === 'me'));
      if (used) { mark(); return; }
      welcome();
    } catch {}
  }, 1800);
  window.mzWelcome = { welcome, tour };
  actions.mzTour = () => tour(0);
  const renderBefore = render;
  render = function (...a) {
    const r = renderBefore.apply(this, a);
    try { const k = document.querySelector('#app .wx-menu-row[data-action="mzKaomoji"]'); if (k && !document.querySelector('#app [data-action="mzTour"]')) k.insertAdjacentHTML('afterend', `<button class="wx-menu-row" data-action="mzTour"><span>${mzT('使用教學', 'How to use')}</span><b>›</b></button>`); } catch {}
    return r;
  };

  const css = document.createElement('style');
  css.textContent = `
#mz-welcome{position:fixed;inset:0;z-index:2147482000;background:var(--bg);color:var(--ink);display:flex;flex-direction:column;padding:max(18px,env(safe-area-inset-top)) 22px 24px;opacity:0;transform:translateY(10px);transition:opacity .25s,transform .25s}
#mz-welcome.on{opacity:1;transform:none}
.mz-wl-skip{align-self:flex-end;border:0;background:none;color:var(--muted);font-size:14px;padding:8px 4px}
html.mz-titlebar .mz-wl-skip{margin-top:8px}
.mz-wl-body{margin:auto 0;max-width:520px;width:100%;align-self:center}
.mz-wl-body h1{font-size:30px;margin:0 0 14px}.mz-wl-body p{color:var(--muted);line-height:1.6;margin:0 0 30px}
.mz-wl-card{display:grid;grid-template-columns:1fr auto;gap:4px 10px;width:100%;text-align:left;border:0;border-radius:20px;padding:20px 22px;margin:0 0 14px;color:var(--ink)}
.mz-wl-card b{font-size:19px}.mz-wl-card small{grid-column:1;color:var(--muted);font-size:13px}.mz-wl-card span{grid-row:1/3;grid-column:2;align-self:center;font-size:20px}
.mz-wl-card.old{background:color-mix(in srgb,var(--accent) 22%,var(--bg))}.mz-wl-card.new{background:color-mix(in srgb,var(--ink) 7%,var(--bg))}
#mz-tour{position:fixed;inset:0;z-index:2147482000}
#mz-tour.moving .mz-tour-tip{opacity:0;transition:none}.mz-tour-tip{transition:opacity .15s}
.mz-tour-ring{position:fixed;transition:left .22s ease,top .22s ease,width .22s ease,height .22s ease;border-radius:18px;box-shadow:0 0 0 9999px #0005,0 0 0 3px var(--accent);animation:mz-tour-pulse 1.6s ease-in-out infinite;pointer-events:none}
@keyframes mz-tour-pulse{50%{box-shadow:0 0 0 9999px #0005,0 0 0 6px color-mix(in srgb,var(--accent) 60%,transparent)}}
.mz-tour-tip{position:fixed;padding:16px 18px;border-radius:18px;background:var(--surface,#fff);color:var(--ink);box-shadow:0 12px 40px #0004}
.mz-tour-tip:after{content:'';position:absolute;left:calc(var(--ax) - 8px);width:16px;height:16px;background:inherit;transform:rotate(45deg)}.mz-tour-tip.down:after{top:-7px}.mz-tour-tip.up:after{bottom:-7px}
.mz-tour-tip b{font-size:17px}.mz-tour-tip p{margin:6px 0 12px;line-height:1.55;font-size:14px}
.mz-tour-row{display:flex;align-items:center;gap:8px}.mz-tour-row span{flex:1;color:var(--muted);font-size:12px}
.mz-tour-row button{border:0;background:none;color:var(--muted);padding:6px 10px;border-radius:999px}.mz-tour-row .go{background:var(--accent);color:#fff;font-weight:600}
`;
  document.head.append(css);
}
