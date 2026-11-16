'use strict';
// 3.4.1: 液態玻璃 (Glassmorphism) theme, also usable as a 玻璃效果 switch on any other theme (外觀). A grey-white background (dark in dark mode); every surface is clear frosted
// glass with a bright top-left edge and a soft deep shadow.
// The mouse over something tilts it toward the pointer with a glare that follows (like a tilting glass card);
// pressing tilts a little more. On a phone, a long press does the same while the finger stays down.
{
  themes.glass = { name: '液態玻璃', accent: '#26262b', deep: '#111114', soft: '#f1f1f3', pink: '#e7e7ea', bg: '#ececec', bubble: '#ffffff', cover: 'linear-gradient(135deg,#f4f4f6,#dcdce0)' };

  const root = document.documentElement;
  // Two ways in: the 液態玻璃 theme itself (grey-white, "pure" glass), or the 玻璃效果 switch on top of any colour theme.
  const cur = () => { try { return (typeof draft !== 'undefined' && draft) || state.settings; } catch { return {}; } };
  const pure = () => cur().theme === 'glass';
  const on = () => pure() || !!cur().glassEffect;
  const sync = () => { root.classList.toggle('mz-glass', on()); root.classList.toggle('mz-glass-pure', pure()); };
  const before = applyTheme;
  applyTheme = function (...a) { const r = before.apply(this, a); try { sync(); } catch {} return r; };

  const GLASS = '.wx-menu-group,.chat-menu-button,.card,.bubble,.pill:not(.primary):not(.hangup),.icon-button,.chip,.swatch,.search,.soft-note,.provider-grid button,.model-grid button,.memory-grid button,.save,.sheet,.login-gate-card,.setting-row .setting-icon';
  const BIG = '.wx-menu-group,.card,.sheet,.soft-note,.login-gate-card';
  const sel = (s, pre) => s.split(',').map((x) => pre + ' ' + x).join(',');
  const css = document.createElement('style');
  css.id = 'mz-glass-css';
  css.textContent = `
html.mz-glass{--glass:#ffffff4d;--glass-strong:#ffffffa6;--glass-edge:#1e1e3c1f;--glass-hi:#ffffff;--glass-line:#1e1e3c14;--glass-shade:0 2px 6px #1e1e3c12,inset 0 0 0 1px #ffffff80;--glass-deep:20px 20px 50px #1e1e3c26,inset 0 0 0 1px #ffffff80}
html.mz-glass.mz-dark{--glass:#ffffff17;--glass-strong:#1d1d30b3;--glass-edge:#ffffff24;--glass-hi:#ffffff6b;--glass-line:#ffffff1a;--glass-shade:0 3px 8px #0000004d,inset 0 0 0 1px #ffffff12;--glass-deep:20px 20px 50px #00000080}
html.mz-glass.mz-glass-pure body{background:#ececec}
html.mz-glass.mz-glass-pure.mz-dark body{background:#161623}
html.mz-glass:not(.mz-glass-pure) body{background:var(--bg)}
/* pure glass (light): black text everywhere, grey for the quieter text */
html.mz-glass-pure:not(.mz-dark){--ink:#111114!important;--muted:#55555e!important;--accent-deep:#111114!important;color:#111114}
html.mz-glass-pure:not(.mz-dark) body,html.mz-glass-pure:not(.mz-dark) .eyebrow,html.mz-glass-pure:not(.mz-dark) .letter,html.mz-glass-pure:not(.mz-dark) .chevron,html.mz-glass-pure:not(.mz-dark) .typing,html.mz-glass-pure:not(.mz-dark) .footer-note{color:#111114!important}
html.mz-glass-pure.mz-dark{--accent:#d9d9df!important;--accent-deep:#f2f2f5!important}
html.mz-glass-pure.mz-dark .eyebrow,html.mz-glass-pure.mz-dark .nav button.active,html.mz-glass-pure.mz-dark .account-connection-notice{color:#f2f2f5!important}
html.mz-glass-pure.mz-dark .account-connection-notice{background:#ffffff14!important}
html.mz-glass-pure:not(.mz-dark) .nav button{color:#55555e!important}html.mz-glass-pure:not(.mz-dark) .nav button.active{color:#111114!important}
/* pure glass: every control is black and white — filled buttons and the send button black with white text, the rest white glass */
html.mz-glass-pure:root .primary,html.mz-glass-pure:root .composer button[type=submit],html.mz-glass-pure:root .switch.on,html.mz-glass-pure:root .save.saved{background:#111114!important;color:#fff!important;border-color:#111114!important;box-shadow:0 3px 10px #0000002e!important}
html.mz-glass-pure:root .selected{background:#ffffffd9!important;color:#111114!important;border-color:#111114!important}
html.mz-glass-pure.mz-dark:root .primary,html.mz-glass-pure.mz-dark:root .composer button[type=submit],html.mz-glass-pure.mz-dark:root .switch.on{background:#fff!important;color:#111114!important;border-color:#fff!important}
html.mz-glass-pure.mz-dark:root .selected{background:#ffffff26!important;color:#fff!important;border-color:#fff!important}
/* 我 page: the grey band between the profile and the menu isn't needed when the menu cards float; the status bubble is glass */
html.mz-glass:root .wx-divider{background:transparent!important}
html.mz-glass:root .wx-status-bubble{background:var(--glass)!important;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid var(--glass-edge)!important;border-top-color:var(--glass-hi)!important;border-left-color:var(--glass-hi)!important;box-shadow:var(--glass-shade)!important}
/* 我 page icons keep their own colours; 收藏 follows the theme hue elsewhere, so give it back its purple here */
html.mz-glass-pure:root .wx-menu-icon.color{color:#a274c0!important}
/* pure glass: avatars without a photo are white too (group faces and their tiles included) */
html.mz-glass-pure:root .avatar,html.mz-glass-pure:root .avatar.mizuki-group-face i{background:#fff!important;border-color:#fff!important;box-shadow:0 2px 8px #1e1e3c1a}
html.mz-glass-pure:root .avatar.mizuki-group-face{background:#ffffffb3!important}
html.mz-glass-pure:root .avatar.mizuki-group-face i{box-shadow:inset 0 0 0 1px #1e1e3c0f}
html.mz-glass-pure.mz-dark:root .avatar,html.mz-glass-pure.mz-dark:root .avatar.mizuki-group-face i{background:#ffffffe6!important;color:#2a2440!important}
html.mz-glass:root{--surface:var(--glass)!important}
html.mz-glass:root .page,html.mz-glass:root .conversation,html.mz-glass #app{background-color:transparent!important}
html.mz-glass #app{border-color:transparent!important}
${sel(GLASS, 'html.mz-glass:root')}{background:var(--glass)!important;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid var(--glass-edge)!important;border-top-color:var(--glass-hi)!important;border-left-color:var(--glass-hi)!important;box-shadow:var(--glass-shade)!important}
${sel(BIG, 'html.mz-glass:root')}{box-shadow:var(--glass-deep)!important}
html.mz-glass:root .sheet{background:#ffffff8c!important;-webkit-backdrop-filter:blur(28px) saturate(140%);backdrop-filter:blur(28px) saturate(140%)}
html.mz-glass.mz-dark:root .sheet{background:#1d1d30a6!important}
/* popups are one even sheet of glass: their title strip has no fill of its own */
html.mz-glass:root .sheet .sheet-title,html.mz-glass:root .sheet>.top,html.mz-glass:root .sheet header{background:transparent!important;box-shadow:none!important;border-color:transparent!important}
html.mz-glass:root .sheet .sheet-title::after,html.mz-glass:root .sheet .sheet-title::before{display:none!important}
html.mz-glass:root .mine .bubble{background:color-mix(in srgb,var(--accent) 28%,var(--glass))!important}
html.mz-glass:root .top,html.mz-glass:root .conversation .top,html.mz-glass:root .nav,html.mz-glass:root .composer{background:var(--glass)!important;-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);border-color:var(--glass-line)!important}
html.mz-glass:root .composer textarea,html.mz-glass input:not([type=checkbox]):not([type=radio]):not([type=range]),html.mz-glass textarea,html.mz-glass select{background:var(--glass)!important;border:1px solid var(--glass-line)!important}
html.mz-glass:root .search input:not([type=checkbox]):not([type=radio]):not([type=range]){background:transparent!important;border:0!important;box-shadow:none!important}
html.mz-glass:root .chat-row,html.mz-glass:root .setting-row,html.mz-glass:root .contact-row,html.mz-glass:root .letter,html.mz-glass:root .moment{border-color:var(--glass-line)!important}
/* everything floats: panels are rounded glass with a gap and a shadow, the grey-white shows between them */
html.mz-glass:root .desktop-shell{background:transparent!important;padding:12px;gap:12px;box-sizing:border-box}
html.mz-glass:root .desktop-workspace{background:transparent!important;min-height:0}
html.mz-glass:root .desktop-workspace>.conversation{height:100%!important}
html.mz-glass:root .desktop-rail,html.mz-glass:root .desktop-sidebar{background:var(--glass)!important;-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);border:1px solid var(--glass-edge)!important;border-top-color:var(--glass-hi)!important;border-left-color:var(--glass-hi)!important;border-radius:24px;box-shadow:var(--glass-deep)!important;overflow:hidden;height:auto!important;min-height:0}
html.mz-glass:root .desktop-rail .nav,html.mz-glass:root .desktop-sidebar .top{background:transparent!important;-webkit-backdrop-filter:none;backdrop-filter:none;border-color:transparent!important;box-shadow:none!important}
html.mz-glass:root .conversation .top,html.mz-glass:root .conversation>.composer,html.mz-glass:root #app>.nav{background:var(--glass)!important;-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);border:1px solid var(--glass-edge)!important;border-top-color:var(--glass-hi)!important;border-left-color:var(--glass-hi)!important;box-shadow:var(--glass-deep)!important}
html.mz-glass:root .conversation .top{margin:10px 10px 0;border-radius:20px}
html.mz-glass:root .conversation>.composer{margin:0 10px 10px;border-radius:22px}
html.mz-glass:root #app>.nav{left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));border-radius:24px;padding-bottom:12px}
/* page headers: the page's own colour, no blur — a blur edge on a clear header showed as a flickering white line while scrolling */
html.mz-glass{--mz-glass-page:var(--bg)}html.mz-glass.mz-glass-pure{--mz-glass-page:#ececec}html.mz-glass.mz-glass-pure.mz-dark{--mz-glass-page:#161623}
html.mz-glass:root .page>.top{background:var(--mz-glass-page)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;border-bottom:0!important;box-shadow:none!important}
html.mz-glass:root .composer button[type=submit]{background:var(--accent)!important;color:#fff!important;border-color:#ffffff59!important}
html.mz-glass.mz-dark:root .composer button[type=submit]{background:#fff!important;color:#2a2440!important}
html.mz-glass:root .search,html.mz-glass:root .desktop-shell .search{background:#ffffff38!important;box-shadow:none!important}
html.mz-glass.mz-dark:root .search,html.mz-glass.mz-dark:root .desktop-shell .search{background:#ffffff0d!important}
/* home chat list: every chat is its own floating glass card */
html.mz-glass:root .chat-entry,html.mz-glass:root .content>.chat-row{background:var(--glass)!important;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid var(--glass-edge)!important;border-top-color:var(--glass-hi)!important;border-left-color:var(--glass-hi)!important;border-radius:20px;box-shadow:var(--glass-shade)!important;margin:0 0 11px;align-items:center}
html.mz-glass:root .chat-entry{padding:0 10px 0 0}
html.mz-glass:root .chat-entry>.chat-row{background:transparent!important;border:0!important;box-shadow:none!important;padding:13px 4px 13px 14px}
html.mz-glass:root .content>.chat-row{padding:13px 14px}
html.mz-glass:root .chat-entry:has(.desktop-selected-chat),html.mz-glass:root .content>.chat-row.desktop-selected-chat{background:color-mix(in srgb,var(--accent) 16%,var(--glass))!important}
/* composer: the + and sticker buttons are flat glass with dark icons (they were white on white) */
html.mz-glass:root .composer .icon-button:not([type=submit]){background:#ffffff38!important;color:var(--ink)!important;box-shadow:none!important;border:1px solid var(--glass-edge)!important;border-top-color:var(--glass-hi)!important;border-left-color:var(--glass-hi)!important}
html.mz-glass:root .icon-button,html.mz-glass:root .pill:not(.primary):not(.hangup),html.mz-glass:root .chip{color:var(--ink)}
html.mz-glass.mz-dark:root .composer .icon-button:not([type=submit]){background:#ffffff14!important}
html.mz-glass:root .composer textarea{background:#ffffff38!important;box-shadow:none!important}
html.mz-glass.mz-dark:root .composer textarea{background:#ffffff0d!important}
html.mz-glass:root .nav .active .nav-icon{background:var(--glass-strong)!important}
html.mz-glass:root .primary{background:color-mix(in srgb,var(--accent) 85%,transparent)!important;color:#fff!important;border:1px solid #ffffff59!important;box-shadow:0 5px 15px color-mix(in srgb,var(--accent) 30%,transparent),inset 0 1px 0 #ffffff66!important}
html.mz-glass.mz-dark:root .primary{background:#fff!important;color:#2a2440!important;border:0!important;box-shadow:0 5px 15px #00000033!important}
html.mz-glass:root .selected{background:color-mix(in srgb,var(--accent) 22%,var(--glass))!important;border-color:var(--accent)!important}
html.mz-glass:root .modal-backdrop{background:#16162344}
.swatch[data-theme=glass] span{background:linear-gradient(135deg,#ffffffd9,#ffffff59)!important;border:1px solid #ffffff!important;box-shadow:inset 0 0 0 1px #ffffff80,2px 3px 8px #1e1e3c26,0 0 0 1px #1e1e3c14!important}
/* things that tilt and shine need round corners, or the glow shows as a square */
html.mz-glass:root .nav button,html.mz-glass:root .setting-row,html.mz-glass:root .contact-row,html.mz-glass:root .moment,html.mz-glass:root .wx-menu-row,html.mz-glass:root .profile-card{border-radius:16px}
.mz-glassfx-card{margin-top:18px!important}
.mz-tilt{transition:transform .4s cubic-bezier(.03,.98,.52,.99);transform:perspective(1000px) rotateX(var(--mz-rx,0deg)) rotateY(var(--mz-ry,0deg)) scale(var(--mz-sc,1))!important;will-change:transform}
.mz-tilt.mz-live{transition:transform .12s ease-out;z-index:2}
.mz-sheen{position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:3;opacity:0;transition:opacity .3s;background:linear-gradient(var(--mz-ga,180deg),#ffffff 0%,#ffffff00 75%)}
.mz-sheen.mz-show{opacity:var(--mz-glare,.25)}
@media(prefers-reduced-motion:reduce){.mz-tilt{transform:none!important}}
`;
  document.head.append(css);

  // ---- tilt and glare (only in this theme) ----
  const TARGET = '.card,.bubble,.pill,.icon-button,.chip,.swatch,.chat-row,.contact-row,.setting-row,.moment,.profile-card,.provider-grid button,.model-grid button,.memory-grid button,.photos button,.nav button,.save';
  const MAX = 12;
  const pick = (t) => { const el = t.closest?.(TARGET) || null; return el && el.parentElement?.matches('.chat-entry') ? el.parentElement : el; };
  let held = null, hover = null, frame = 0, last = null, timer = 0, start = null;
  const sheen = (el) => {
    let s = el.querySelector(':scope > .mz-sheen');
    if (!s) {
      if (getComputedStyle(el).position === 'static') { el.style.position = 'relative'; el.dataset.mzPos = '1'; }
      s = document.createElement('i'); s.className = 'mz-sheen'; el.append(s);
    }
    return s;
  };
  // Let go of an element: it springs back flat, the glare fades, and the helpers are removed afterwards.
  const settle = (el) => {
    if (!el) return;
    el.classList.remove('mz-live');
    for (const p of ['--mz-rx', '--mz-ry', '--mz-sc']) el.style.removeProperty(p);
    el.querySelector(':scope > .mz-sheen')?.classList.remove('mz-show');
    setTimeout(() => {
      if (el === held || el === hover) return;
      el.classList.remove('mz-tilt');
      el.querySelector(':scope > .mz-sheen')?.remove();
      for (const p of ['--mz-ga', '--mz-glare']) el.style.removeProperty(p);
      if (el.dataset.mzPos) { el.style.position = ''; delete el.dataset.mzPos; }
    }, 420);
  };
  const paint = () => {
    frame = 0;
    const el = held || hover; if (!el || !last || !el.isConnected) return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const x = Math.min(1, Math.max(0, (last.x - r.left) / r.width)), y = Math.min(1, Math.max(0, (last.y - r.top) / r.height));
    // Bigger things tilt less, so a wide card or chat row doesn't swing its far edge too much.
    const k = Math.min(1, 260 / Math.max(r.width, r.height)) * 0.6 + 0.4, press = el === held ? 1.25 : 1;
    el.style.setProperty('--mz-ry', ((x - 0.5) * 2 * MAX * k * press).toFixed(2) + 'deg');
    el.style.setProperty('--mz-rx', ((0.5 - y) * 2 * MAX * k * press).toFixed(2) + 'deg');
    el.style.setProperty('--mz-sc', el === held ? '1.04' : '1.025');
    // The glare comes from the side the pointer is on, brighter toward the top.
    el.style.setProperty('--mz-ga', (Math.atan2(x - 0.5, -(y - 0.5)) * 180 / Math.PI + 180).toFixed(0) + 'deg');
    el.style.setProperty('--mz-glare', (0.12 + (1 - y) * 0.33).toFixed(2));
  };
  const move = (e) => { last = { x: e.clientX, y: e.clientY }; if (!frame) frame = requestAnimationFrame(paint); };
  const lift = (el, e) => { el.classList.add('mz-tilt', 'mz-live'); sheen(el).classList.add('mz-show'); move(e); };
  const release = () => {
    clearTimeout(timer); timer = 0; start = null;
    const el = held; held = null;
    if (!el) return;
    if (el === hover) move(last ? { clientX: last.x, clientY: last.y } : { clientX: 0, clientY: 0 }); else settle(el);
  };
  const active = () => root.classList.contains('mz-glass');

  document.addEventListener('pointerdown', (e) => {
    if (!active() || e.button > 0) return;
    const el = pick(e.target); if (!el || el.closest('.mz-lock')) return;
    if (e.pointerType === 'mouse') { held = el; lift(el, e); return; }
    // Finger: only after a long press, so normal taps and scrolling stay the same.
    start = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => { timer = 0; if (start && el.isConnected) { held = el; lift(el, { clientX: start.x, clientY: start.y }); } }, 320);
  }, true);
  document.addEventListener('pointermove', (e) => {
    if (!active()) return;
    if (timer && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) { clearTimeout(timer); timer = 0; start = null; }
    if (held) { move(e); return; }
    if (e.pointerType !== 'mouse') return;
    const el = pick(e.target);
    if (el !== hover) { const old = hover; hover = el; settle(old); if (el) lift(el, e); }
    else if (el) move(e);
  }, { passive: true });
  // While a finger is holding something, keep the page still so the tilt follows the finger.
  document.addEventListener('touchmove', (e) => { if (held && e.cancelable) e.preventDefault(); }, { passive: false });
  for (const t of ['pointerup', 'pointercancel', 'blur']) window.addEventListener(t, release, true);
  document.documentElement.addEventListener('mouseleave', () => { const old = hover; hover = null; settle(old); });

  const appearanceBefore = appearancePage;
  appearancePage = function () {
    const html = appearanceBefore();
    const isPure = pure(), fx = isPure || !!cur().glassEffect;
    const card = `<div class="card mz-glassfx-card"><div class="toggle-row"><div><h3>${mzT('玻璃效果', 'Glass effect')}</h3><p>${isPure ? mzT('「液態玻璃」主題本身就是玻璃。', 'The Liquid Glass theme is already glass.') : mzT('把毛玻璃、浮起的卡片和傾斜反光加到現在的主題上，顏色維持原本的主題。', 'Adds frosted glass, floating cards and the tilt-and-shine to the current theme, keeping its colours.')}</p></div><button class="switch ${fx ? 'on' : ''}" type="button" data-mzglassfx ${isPure ? 'disabled' : ''} aria-label="${mzT('玻璃效果', 'Glass effect')}"></button></div></div>`;
    // Right under the colour themes.
    const sw = html.indexOf('class="swatches"'), at = sw < 0 ? -1 : html.indexOf('<p class="help">', sw);
    return at > 0 ? html.slice(0, at) + card + html.slice(at) : html + card;
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-mzglassfx]');
    if (!b || b.disabled || typeof draft === 'undefined' || !draft) return;
    draft.glassEffect = !draft.glassEffect;
    dirty = true;
    sync();
    render();
  });

  sync();
  try { new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['style'] }); } catch {}
  window.mzGlass = { on, sync };
}
