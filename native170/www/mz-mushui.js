'use strict';
// 3.4.4 沐水 in the official chat background (mz-mushui: bg-16x9 / 4x3 / 9x16 by screen shape, character c1-c8 on top). 放空眨眼 = 1-3, 低頭滑手機 = 4-6, 掏出手機 = 7-8-4.
// Only the character changes; the background stays still. Originals: Project/art/mz-mushui.
// You write → finish 放空眨眼 → 掏出手機 → 低頭滑手機 (loops). It replies → 掏出手機 reversed → 放空眨眼.
// Each animation waits for the one before; frames cross-fade with a blur.
{
  const OFF = () => (typeof MIZUKI_OFFICIAL_ID !== 'undefined' ? MIZUKI_OFFICIAL_ID : 'mizuki');
  const inOfficial = () => typeof chatId !== 'undefined' && chatId === 'human:' + OFF();
  const ROOM_NAMES = { A: ['放空眨眼', 'Spacing out'], B: ['低頭滑手機', 'On the phone'], C: ['走到電腦前', 'To the computer'], D: ['伸懶腰回床上', 'Stretch, back to bed'] };
  const KEY = 'mzMushui', NAMES = { A: ['放空眨眼', 'Spacing out'], B: ['低頭滑手機', 'On the phone'] };
  let cfg = { on: false, alpha: 0.6 };
  try { cfg = { ...cfg, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {} };
  const src = (n) => `mz-mushui/c${n}.webp`;
  // [bg aspect, png height / bg height, png top, png centre x]
  const BG = { '16x9': [16 / 9, .88, .11, .48], '4x3': [4 / 3, .85, .075, .47], '9x16': [9 / 16, .69, .26, .5] };
  const fit = () => {
    const conv = box?.parentElement; if (!conv) return;
    // only the space between the chat header and the input (desktop: it used to run under both)
    const cr = conv.getBoundingClientRect(), hd = conv.querySelector('.top')?.getBoundingClientRect(), low = conv.querySelector('.mizuki-official-actions, .composer')?.getBoundingClientRect();
    const t0 = hd ? hd.bottom - cr.top + 8 : 0, t1 = low ? low.top - cr.top - 8 : cr.height;
    Object.assign(box.style, { top: t0 + 'px', height: Math.max(0, t1 - t0) + 'px', left: '10px', right: '10px', bottom: 'auto' });
    const w = conv.clientWidth - 20, h = Math.max(1, t1 - t0), r = w / h;
    const k = Object.keys(BG).sort((a, b) => Math.abs(Math.log(BG[a][0] / r)) - Math.abs(Math.log(BG[b][0] / r)))[0], [ar, ph, pt, px] = BG[k];
    const st = box.firstElementChild, sw = Math.max(w, h * ar), sh = sw / ar;
    if (st.dataset.bg !== k) { st.dataset.bg = k; st.querySelector('.bg').src = `mz-mushui/bg-${k}.webp`; }
    Object.assign(st.style, { width: sw + 'px', height: sh + 'px', left: (w - sw) / 2 + 'px', top: (h - sh) / 2 + 'px' });
    const cw = ph * sh * 648 / 1152;
    st.querySelectorAll('.ch').forEach((i) => Object.assign(i.style, { height: ph * sh + 'px', width: cw + 'px', top: pt * sh + 'px', left: px * sw - cw / 2 + 'px' }));
  };
  addEventListener('resize', () => fit());
  for (let n = 1; n <= 8; n++) { const i = new Image(); i.src = src(n); i.decode?.().catch(() => {}); }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  let box = null, frame = 1, mode = 'idle', running = false, wantSend = false, wantReply = false, extra = 0, manual = '', wake = null;
  const layer = () => {
    if (box) return box;
    box = document.createElement('div'); box.id = 'mz-mushui';
    box.innerHTML = `<div class="st"><img class="bg" alt=""><img class="ch" src="${src(1)}" alt=""><img class="ch b" alt=""></div>`;
    return box;
  };
  // one frame change: the new frame fades in over the old one out of a light blur; the two layers take turns on top
  let topI = 0;
  const show = async (n, ms = 90) => {
    if (!box || n === frame) return;
    const imgs = box.querySelectorAll('.ch'), old = imgs[topI], nu = imgs[1 - topI];
    nu.src = src(n);
    try { await nu.decode(); } catch {}
    nu.style.zIndex = 2; old.style.zIndex = 1;
    // slow blur-in: the old frame softens while the new one comes out of the blur
    nu.animate([{ opacity: 0, filter: 'blur(6px)' }, { opacity: .6, filter: 'blur(3px)', offset: .5 }, { opacity: 1, filter: 'blur(0)' }], { duration: ms, easing: 'ease-in-out', fill: 'forwards' });
    old.animate([{ opacity: 1, filter: 'blur(0)' }, { opacity: 1, filter: 'blur(2px)', offset: .5 }, { opacity: 0, filter: 'blur(4px)' }], { duration: ms, easing: 'ease-in-out', fill: 'forwards' });
    await wait(ms);
    if (!box) return;
    nu.style.opacity = 1; nu.getAnimations().forEach((x) => x.cancel());
    old.style.opacity = 0; old.getAnimations().forEach((x) => x.cancel()); topI = 1 - topI; frame = n;
  };
  const blink = async (o) => { await show(o + 1, 70); await show(o + 2, 70); await wait(40); await show(o + 1, 70); await show(o, 90); };
  // 先兩下，停一下，再三下
  const cycle = async (o) => { await show(o, 250); for (const k of [2, 3]) { for (let i = 0; i < k; i++) { await blink(o); await wait(80); } if (k === 2) await wait(200); } };
  const phoneOut = async () => { for (const n of [7, 8, 4]) { await show(n, 240); await wait(100); } };
  const phoneAway = async () => { for (const n of [8, 7, 1]) { await show(n, 240); await wait(100); } };
  const rest = (ms) => new Promise((r) => { const t = setTimeout(r, ms); wake = () => { clearTimeout(t); r(); }; });
  const poke = () => { const w = wake; wake = null; w?.(); };
  const run = async () => {
    if (running) return; running = true;
    try {
      while (box?.isConnected && cfg.on) {
        if (manual) {
          const m = manual; manual = '';
          if (m === 'A') await cycle(1); else if (mode === 'phone') await cycle(4); else { await phoneOut(); await cycle(4); await phoneAway(); }
          await show(mode === 'phone' ? 4 : 1, 200); continue;
        }
        if (mode === 'idle') {
          await cycle(1);
          if (wantSend) { wantSend = false; await phoneOut(); mode = 'phone'; continue; }
        } else {
          await cycle(4);
          if (extra > 0) { extra--; await wait(600); continue; }
          if (wantReply) { wantReply = false; await phoneAway(); mode = 'idle'; continue; }
        }
        if (!wantSend && !wantReply && !manual) await rest(800 + Math.random() * 700);
      }
    } finally { running = false; }
  };
  const onSend = () => { if (mode === 'phone' || wantSend) extra = Math.min(extra + 1, 3); else wantSend = true; wantReply = false; poke(); };
  const onReply = () => { if (mode === 'phone' || wantSend) { wantReply = true; poke(); } };
  // new messages in the official chat
  let seen = -1;
  const msgs = () => { try { return (humanData().messages || []).filter((m) => m.sender === OFF() || m.recipient === OFF() || m.official); } catch { return []; } };
  const winMode = () => !!window.mzRoomDesk && cfg.view === 'window';
  const tick = () => {
    const list = msgs();
    if (winMode()) { if (seen >= 0 && list.length > seen) for (const m of list.slice(seen)) (m.sender === OFF() || m.official ? window.mzRoomDesk.onReply() : window.mzRoomDesk.onSend(m)); seen = list.length; return; }
    if (seen < 0 || !cfg.on) { seen = list.length; return; }
    if (list.length <= seen) return;
    for (const m of list.slice(seen)) (m.sender === OFF() || m.official ? onReply : onSend)();
    seen = list.length;
  };
  setInterval(tick, 500);
  // 3.4.4: while 一起聽歌 plays, the jELi pet keeps its music off
  { const pc = window.BroadcastChannel ? new BroadcastChannel('mz-pet') : null; let last = null;
    setInterval(() => { const n = Number(state?.settings?.mushuiCoins || 0); if (n !== last) { last = n; try { localStorage.setItem('mz-coins', String(n)); } catch {} } }, 1000);
    pc?.addEventListener('message', async ({ data: m }) => { if (m?.t === 'spend' && m.n > 0 && window.WebEngine) { await WebEngine.edit((s) => { s.settings.mushuiCoins = Math.max(0, Number(s.settings.mushuiCoins || 0) - m.n); }); state = await WebEngine.view(); } }); }
  { let was = null; const pc = window.BroadcastChannel ? new BroadcastChannel('mz-pet') : null; setInterval(() => { const on = !!document.querySelector('#mzListenBand'); if (on === was) return; was = on; try { localStorage.setItem('mz-listening', on ? '1' : '0'); } catch {} pc?.postMessage({ t: 'listen', on }); }, 1000); }
  const place = () => {
    const conv = document.querySelector('.conversation');
    if (!conv || !inOfficial() || !cfg.on) { box?.remove(); return; }
    const l = layer();
    if (l.parentElement !== conv) { conv.prepend(l); }
    fit();
    l.style.opacity = cfg.alpha;
    run();
  };
  // 3.4.4: the jELi desktop pet opens with the same 沐水 button; works with 背景 or 視窗 (those two stay either-or)
  const pet = (on) => { if (cfg.pet && window.Desktop?.invoke) Desktop.invoke('mzPet', { cmd: on ? 'open' : 'close' }).catch(() => {}); };
  const toggle = () => {
    if (cfg.view === 'none' && window.Desktop?.invoke) { Desktop.invoke('mzPet', { cmd: 'isOpen' }).then((o) => Desktop.invoke('mzPet', { cmd: o ? 'close' : 'open' })).catch(() => {}); return; }
    if (winMode()) { pet(!window.mzRoomDesk.open); window.mzRoomDesk.toggle(); return; }
    pet(!cfg.on);
    cfg.on = !cfg.on; save();
    if (cfg.on) { mode = 'idle'; frame = 1; topI = 0; { const [a, b] = layer().querySelectorAll('.ch'); a.src = src(1); a.style.opacity = 1; b.style.opacity = 0; } seen = -1; tick(); place(); box.animate([{ opacity: 0 }, { opacity: cfg.alpha }], { duration: 700, easing: 'ease' }); }
    else { const b = box; box = null; b?.animate([{ opacity: cfg.alpha }, { opacity: 0 }], { duration: 300 }).finished.then(() => b.remove()).catch(() => b.remove()); poke(); }
    document.querySelectorAll('[data-mzmushui="toggle"]').forEach((x) => x.classList.toggle('selected', cfg.on));
  };
  const renderBefore = render;
  render = function (...a) {
    const r = renderBefore.apply(this, a);
    try {
      const row = inOfficial() && document.querySelector('.conversation .mizuki-official-actions');
      if (row && !row.querySelector('[data-mzmushui]')) row.insertAdjacentHTML('beforeend', `<button class="pill ${(winMode() ? window.mzRoomDesk.open : cfg.on) ? 'selected' : ''}" data-mzmushui="toggle">${mzT('沐水', 'Mizuki')}</button>`);
      place();
    } catch {}
    return r;
  };
  // the official chat's ⋯: opacity + play one animation
  const optionsBefore = actions.chatOptions;
  actions.chatOptions = function (...args) {
    const r = optionsBefore.apply(this, args);
    try {
      const sheet = document.querySelector('#overlay .sheet');
      if (sheet && inOfficial() && !sheet.querySelector('.mz-mushui-opts')) (sheet.querySelector(':scope > :is(h2,h3,.sheet-title,.between)')||sheet.firstElementChild).insertAdjacentHTML('afterend', `<div class="mz-mushui-opts card">${window.mzRoomDesk && !window.mzRoomDesk.room ? `<div class="flex">${mzT('打開沐水時顯示', 'Show Mizuki as')}　${[['bg', '背景', 'Background'], ['window', '視窗', 'Window'], ['none', '只有桌寵', 'Pet only']].map(([v, zh, en]) => `<button class="pill ${(cfg.view || 'bg') === v ? 'selected' : ''}" data-mzmushui="view" data-v="${v}">${mzT(zh, en)}</button>`).join('')}</div>` : ''}${window.mzRoomDesk && !window.mzRoomDesk.room ? `<div class="flex">${mzT('桌寵', 'Desktop pet')}　<button class="pill ${cfg.pet ? 'selected' : ''}" data-mzmushui="pet">${mzT('一起打開', 'Open with Mizuki')}</button></div>` : ''}${window.mzRoomDesk ? `<div class="flex">${mzT('刷影片視窗', 'Video window')}　${[[0, '淺色', 'Light'], [1, '深色', 'Dark']].map(([v, zh, en]) => `<button class="pill ${!!cfg.shortsDark === !!v ? 'selected' : ''}" data-mzmushui="dark" data-v="${v}">${mzT(zh, en)}</button>`).join('')}</div>` : ''}${window.mzRoomDesk?.room ? `<div class="flex">${Object.entries(ROOM_NAMES).map(([k, n]) => `<button class="pill" data-mzmushui="play" data-k="${k}">${mzT('播放', 'Play')}「${mzT(...n)}」</button>`).join('')}</div><button class="pill" data-mzmushui="closeroom">${mzT('關閉沐水視窗', "Close Mizuki's window")}</button>` : `<div><label class="field" ${winMode() ? 'hidden' : ''}>${mzT('沐水透明度', 'Mizuki opacity')} <b>${Math.round(cfg.alpha * 100)}%</b><input type="range" min="10" max="100" value="${Math.round(cfg.alpha * 100)}" data-mzmushui="alpha"></label><div class="flex">${Object.entries(winMode() ? ROOM_NAMES : NAMES).map(([k, n]) => `<button class="pill" data-mzmushui="play" data-k="${k}">${mzT('播放', 'Play')}「${mzT(...n)}」</button>`).join('')}</div></div>`}</div>`);
    } catch {}
    return r;
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-mzmushui]'); if (!b) return;
    if (b.dataset.mzmushui === 'toggle') toggle();
    else if (b.dataset.mzmushui === 'view') {
      const v = b.dataset.v; if ((cfg.view || 'bg') === v) return;
      if (v === 'none') { if (cfg.on) toggle(); if (window.mzRoomDesk?.open) window.mzRoomDesk.toggle(); } else if (v === 'window' && cfg.on) toggle(); else if (v === 'bg' && window.mzRoomDesk?.open) window.mzRoomDesk.toggle();
      cfg.view = v; save(); b.parentElement.querySelectorAll('[data-mzmushui="view"]').forEach((x) => x.classList.toggle('selected', x === b));
      document.querySelectorAll('[data-mzmushui="toggle"]').forEach((x) => x.classList.remove('selected'));
    }
    else if (b.dataset.mzmushui === 'pet') { cfg.pet = !cfg.pet; save(); b.classList.toggle('selected', cfg.pet); if (!cfg.pet) Desktop.invoke('mzPet', { cmd: 'close' }).catch(() => {}); else if (winMode() ? window.mzRoomDesk.open : cfg.on) pet(true); }
    else if (b.dataset.mzmushui === 'dark') { cfg.shortsDark = b.dataset.v === '1'; save(); b.parentElement.querySelectorAll('[data-mzmushui="dark"]').forEach((x) => x.classList.toggle('selected', x === b)); }
    else if (b.dataset.mzmushui === 'closeroom') { Desktop.invoke('closeWindow'); }
    else if (b.dataset.mzmushui === 'play') {
      if (window.mzRoomDesk?.room) { window.mzRoomPlay?.(b.dataset.k); closeModal?.(); return; }
      if (winMode()) { Desktop.invoke('mzRoom', { cmd: 'play', k: b.dataset.k }).catch(() => {}); closeModal?.(); return; }
      if (!cfg.on) toggle(); manual = b.dataset.k; poke(); closeModal?.(); }
  });
  document.addEventListener('input', (e) => {
    const s = e.target.closest?.('[data-mzmushui="alpha"]'); if (!s) return;
    cfg.alpha = s.value / 100; save(); if (box) box.style.opacity = cfg.alpha;
    const t = s.parentElement.querySelector('b'); if (t) t.textContent = s.value + '%';
  });
  const css = document.createElement('style');
  css.textContent = `.conversation:has(#mz-mushui){isolation:isolate}
.conversation:has(#mz-mushui) .messages{background:transparent!important}
#mz-mushui{position:absolute!important;border-radius:20px;z-index:-1!important;pointer-events:none;overflow:hidden}
#mz-mushui .st{position:absolute}#mz-mushui .bg{position:absolute;inset:0;width:100%;height:100%}#mz-mushui .ch{position:absolute;will-change:opacity,filter}#mz-mushui .b{opacity:0}
.mz-mushui-opts{display:grid;gap:10px;margin-bottom:12px}.mz-mushui-opts input{width:100%}.mz-mushui-opts .flex{flex-wrap:wrap;gap:8px}`;
  document.head.append(css);
  window.mzMushui = { onSend, onReply, get mode() { return mode; }, get frame() { return frame; } };
}
