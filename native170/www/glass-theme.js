'use strict';
// 3.4.1: 液態玻璃 (Liquid Glass) theme. A seventh colour theme whose surfaces are frosted glass over a soft,
// colourful backdrop. Holding something (mouse button down, or a finger long-press) tilts it toward the pointer and
// a light reflection follows the pointer; with a mouse, hovering shows a faint reflection too.
{
  themes.glass = { name: '液態玻璃', accent: '#7f9dd0', deep: '#4f6597', soft: '#e6edfa', pink: '#ead9f3', bg: '#ffffff', bubble: '#dde7fb', cover: 'linear-gradient(135deg,#bcd3f5,#e3d2f4 50%,#cdeee6)' };

  const root = document.documentElement;
  const on = () => { try { return ((typeof draft !== 'undefined' && draft) || state.settings).theme === 'glass'; } catch { return false; } };
  const sync = () => root.classList.toggle('mz-glass', on());
  const before = applyTheme;
  applyTheme = function (...a) { const r = before.apply(this, a); try { sync(); } catch {} return r; };

  const GLASS = '.card,.bubble,.pill:not(.primary):not(.hangup),.icon-button,.chip,.swatch,.search,.soft-note,.provider-grid button,.model-grid button,.memory-grid button,.save,.sheet,.login-gate-card';
  const sel = (s, pre) => s.split(',').map((x) => pre + ' ' + x).join(',');
  const css = document.createElement('style');
  css.id = 'mz-glass-css';
  css.textContent = `
html.mz-glass{--glass:#f5f7fbb8;--glass-strong:#f8f9fcd9;--glass-edge:#e4e9f2;--glass-line:#e8ecf3;--glass-shade:0 8px 26px #2a35551a,0 1px 3px #2a355514,inset 0 1px 0 #ffffff,inset 0 -1px 0 #ffffff80}
html.mz-glass.mz-dark{--glass:#1c223366;--glass-strong:#1a1f2ea6;--glass-edge:#ffffff2e;--glass-line:#ffffff1a;--glass-shade:0 10px 30px #0006,inset 0 1px 0 #ffffff26,inset 0 -1px 0 #ffffff0d}
html.mz-glass body{background:#fff}
html.mz-glass.mz-dark body{background:#0f1117}
html.mz-glass .page,html.mz-glass .conversation,html.mz-glass #app{background-color:transparent!important}
${sel(GLASS, 'html.mz-glass')}{background:var(--glass)!important;-webkit-backdrop-filter:blur(18px) saturate(170%);backdrop-filter:blur(18px) saturate(170%);border:1px solid var(--glass-edge)!important;box-shadow:var(--glass-shade)!important}
html.mz-glass .sheet{background:var(--glass-strong)!important;-webkit-backdrop-filter:blur(28px) saturate(180%);backdrop-filter:blur(28px) saturate(180%)}
html.mz-glass .mine .bubble{background:color-mix(in srgb,var(--accent) 30%,var(--glass))!important}
html.mz-glass .top,html.mz-glass .conversation .top,html.mz-glass .nav,html.mz-glass .composer{background:var(--glass)!important;-webkit-backdrop-filter:blur(26px) saturate(180%);backdrop-filter:blur(26px) saturate(180%);border-color:var(--glass-line)!important}
html.mz-glass .composer textarea,html.mz-glass input:not([type=checkbox]):not([type=radio]):not([type=range]),html.mz-glass textarea,html.mz-glass select{background:var(--glass-strong)!important;border:1px solid var(--glass-line)!important}
html.mz-glass .chat-row,html.mz-glass .setting-row,html.mz-glass .contact-row,html.mz-glass .letter,html.mz-glass .moment{border-color:var(--glass-line)!important}
html.mz-glass .setting-row .setting-icon,html.mz-glass .nav .active .nav-icon{background:var(--glass-strong)!important;box-shadow:inset 0 1px 0 #ffffffc0}
html.mz-glass .primary{background:linear-gradient(160deg,color-mix(in srgb,var(--accent) 80%,#fff),var(--accent))!important;box-shadow:0 6px 18px color-mix(in srgb,var(--accent) 35%,transparent),inset 0 1px 0 #ffffff80!important}
html.mz-glass .selected{background:color-mix(in srgb,var(--accent) 20%,var(--glass))!important;border-color:var(--accent)!important}
html.mz-glass .modal-backdrop{background:#2a335533}
.swatch[data-theme=glass] span{background:linear-gradient(135deg,#ffffffe0,#c9dcff99 45%,#f0d4f499)!important;border:1px solid #ffffff!important;box-shadow:inset 0 1px 0 #fff,0 2px 8px #4f659733}
.mz-tilt{transition:transform .5s cubic-bezier(.2,1.6,.4,1)}
.mz-tilt.mz-held{transition:transform .09s ease-out;transform:perspective(650px) rotateX(var(--mz-rx,0deg)) rotateY(var(--mz-ry,0deg)) scale(1.025)!important;z-index:2}
.mz-sheen{position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:3;opacity:0;transition:opacity .25s;mix-blend-mode:soft-light;background:radial-gradient(circle at var(--mz-gx,50%) var(--mz-gy,50%),#ffffffee 0,#ffffff80 18%,transparent 55%),linear-gradient(calc(var(--mz-ga,135deg)),transparent 35%,#ffffff70 50%,transparent 65%)}
.mz-sheen.mz-show{opacity:.55}.mz-held>.mz-sheen.mz-show{opacity:1}
html.mz-dark .mz-sheen{mix-blend-mode:screen}html.mz-dark .mz-sheen.mz-show{opacity:.25}html.mz-dark .mz-held>.mz-sheen.mz-show{opacity:.5}
@media(prefers-reduced-motion:reduce){.mz-tilt.mz-held{transform:none!important}}
`;
  document.head.append(css);

  // ---- pointer tilt and reflection (only in this theme) ----
  const TARGET = '.card,.bubble,.pill,.icon-button,.chip,.swatch,.chat-row,.contact-row,.setting-row,.moment,.profile-card,.provider-grid button,.model-grid button,.memory-grid button,.photos button,.nav button,.save';
  const MAX = 9;
  let held = null, hover = null, frame = 0, last = null, timer = 0, start = null;
  const sheen = (el) => {
    let s = el.querySelector(':scope > .mz-sheen');
    if (!s) {
      if (getComputedStyle(el).position === 'static') { el.style.position = 'relative'; el.dataset.mzPos = '1'; }
      s = document.createElement('i'); s.className = 'mz-sheen'; el.append(s);
    }
    return s;
  };
  const drop = (el) => {
    if (!el) return;
    const s = el.querySelector(':scope > .mz-sheen');
    s?.classList.remove('mz-show');
    setTimeout(() => { if (el === held || el === hover) return; s?.remove(); if (el.dataset.mzPos) { el.style.position = ''; delete el.dataset.mzPos; } }, 300);
  };
  const paint = () => {
    frame = 0;
    const el = held || hover; if (!el || !last || !el.isConnected) return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const x = Math.min(1, Math.max(0, (last.x - r.left) / r.width)), y = Math.min(1, Math.max(0, (last.y - r.top) / r.height));
    el.style.setProperty('--mz-gx', (x * 100).toFixed(1) + '%');
    el.style.setProperty('--mz-gy', (y * 100).toFixed(1) + '%');
    el.style.setProperty('--mz-ga', (90 + (x - 0.5) * 120).toFixed(0) + 'deg');
    if (el === held) {
      // Bigger things tilt less, so a wide card doesn't swing its far edge too much.
      const k = Math.min(1, 220 / Math.max(r.width, r.height)) * 0.5 + 0.5;
      el.style.setProperty('--mz-ry', ((x - 0.5) * 2 * MAX * k).toFixed(2) + 'deg');
      el.style.setProperty('--mz-rx', ((0.5 - y) * 2 * MAX * k).toFixed(2) + 'deg');
    }
  };
  const move = (e) => { last = { x: e.clientX, y: e.clientY }; if (!frame) frame = requestAnimationFrame(paint); };
  const grab = (el, e) => {
    held = el; el.classList.add('mz-tilt', 'mz-held'); sheen(el).classList.add('mz-show'); move(e);
  };
  const release = () => {
    clearTimeout(timer); timer = 0; start = null;
    const el = held; held = null;
    if (!el) return;
    el.classList.remove('mz-held');
    el.style.removeProperty('--mz-rx'); el.style.removeProperty('--mz-ry');
    if (el !== hover) drop(el);
    setTimeout(() => { if (el !== held) el.classList.remove('mz-tilt'); }, 520);
  };
  const active = () => root.classList.contains('mz-glass');

  document.addEventListener('pointerdown', (e) => {
    if (!active() || e.button > 0) return;
    const el = e.target.closest?.(TARGET); if (!el || el.closest('.mz-lock')) return;
    if (e.pointerType === 'mouse') { grab(el, e); return; }
    // Finger: only after a long press, so normal taps and scrolling stay the same.
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    timer = setTimeout(() => { timer = 0; if (start && el.isConnected) grab(el, { clientX: start.x, clientY: start.y }); }, 320);
  }, true);
  document.addEventListener('pointermove', (e) => {
    if (!active()) return;
    if (timer && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) { clearTimeout(timer); timer = 0; start = null; }
    if (held) { move(e); return; }
    if (e.pointerType !== 'mouse') return;
    const el = e.target.closest?.(TARGET) || null;
    if (el !== hover) { const old = hover; hover = el; drop(old); if (el) sheen(el).classList.add('mz-show'); }
    if (el) move(e);
  }, { passive: true });
  // While a finger is holding something, keep the page still so the tilt follows the finger.
  document.addEventListener('touchmove', (e) => { if (held && e.cancelable) e.preventDefault(); }, { passive: false });
  for (const t of ['pointerup', 'pointercancel', 'blur']) window.addEventListener(t, release, true);
  document.addEventListener('pointerleave', () => { const old = hover; hover = null; drop(old); });

  sync();
  try { new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['style'] }); } catch {}
  window.mzGlass = { on, sync };
}
