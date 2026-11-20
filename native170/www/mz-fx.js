'use strict';
// 3.4.4: motion from the user's two reference videos (own code, written from their prompts):
//  1. buttons: a press bursts a few soft droplets (particles) out of the button, in the theme colour
//  2. frosted cards (mouse): a soft round light follows the pointer inside the card, the rim near it brightens,
//     and the card tilts a little toward it (at most 4°), easing back when the pointer leaves
//  3. border beam: a light runs round the edge of a highlighted card (the Me page profile card)
//  4. popups grow out of the button that opened them, and shrink back into it when closed
//  5. bottom tab bar as a dock: the icon under the pointer / finger grows, its neighbours a little less, and its
//     name shows above it
// The bottom bar's sliding glass capsule (stretch + bounce + thin rim) lives in swipe-nav.js (glide).
// All of it stays off with "reduce motion" and while swiping between screens.
{
  const root = document.documentElement;
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches || root.classList.contains('mz-swiping');
  const accent = () => getComputedStyle(root).getPropertyValue('--accent').trim() || '#a080ba';

  // ---------- 1. droplets from pressed buttons ----------
  const BTN = '.pill, .icon-button, .send, [data-action="send"], .wx-menu-row, .setting-row, .nav button, .chip, .mz-seg, .swatch';
  let layer = null;
  const fxLayer = () => {
    if (layer?.isConnected) return layer;
    layer = document.createElement('div'); layer.id = 'mz-fx-layer'; document.body.append(layer); return layer;
  };
  const burst = (x, y, color, big) => {
    const L = fxLayer(), n = big ? 10 : 7;
    for (let i = 0; i < n; i++) {
      const d = document.createElement('i'), a = (Math.PI * 2 * i) / n + Math.random() * 0.6, dist = (big ? 26 : 18) + Math.random() * (big ? 22 : 14), size = 4 + Math.random() * (big ? 6 : 4);
      d.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${color}`;
      L.append(d);
      const an = d.animate([
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.95 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * dist * 0.75}px), calc(-50% + ${Math.sin(a) * dist * 0.75}px)) scale(.9)`, opacity: 0.9, offset: 0.55 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist + 6}px)) scale(0)`, opacity: 0 },
      ], { duration: 520 + Math.random() * 160, easing: 'cubic-bezier(.2,.8,.3,1)' });
      an.onfinish = an.oncancel = () => d.remove();
    }
    while (L.childElementCount > 60) L.firstElementChild.remove();
  };
  document.addEventListener('pointerdown', (e) => {
    if (e.button || calm()) return;
    const b = e.target.closest?.(BTN); if (!b || b.disabled || b.closest('#mz-kao .mz-kao-grid')) return;
    const primary = b.matches('.pill.primary, .send, [data-action="send"]');
    let color = accent();
    if (primary) { const bg = getComputedStyle(b).backgroundColor; if (bg && !/rgba?\(0, 0, 0, 0\)|transparent/.test(bg)) color = bg; }
    burst(e.clientX, e.clientY, color, primary);
  }, { capture: true, passive: true });

  // ---------- 2. light + tilt on frosted cards (pointer devices) ----------
  const CARD = '.card, .chat-entry, .mz-cgroup, .contact-favorites, .wx-menu-group, .moment, .mz-todo-item';
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let lit = null;
  const unlight = (c) => { if (!c) return; c.classList.remove('mz-lit'); c.style.removeProperty('--mz-tx'); c.style.removeProperty('--mz-ty'); };
  document.addEventListener('pointermove', (e) => {
    if (!fine.matches || e.pointerType !== 'mouse') return;
    const c = calm() || e.target.closest?.('.mz-cl-card, .mz-cl-preview') ? null : e.target.closest?.(CARD);
    if (c !== lit) { unlight(lit); lit = c; }
    if (!c || c.closest('.mz-tilt, .sheet') || c.matches('.mz-tilt')) return;
    const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    c.classList.add('mz-lit');
    c.style.setProperty('--mz-lx', (px * 100).toFixed(1) + '%'); c.style.setProperty('--mz-ly', (py * 100).toFixed(1) + '%');
    // small cards tilt more, wide ones less — never past 4°
    const k = Math.min(4, 4 * 320 / Math.max(320, r.width));
    c.style.setProperty('--mz-tx', ((0.5 - py) * 2 * k).toFixed(2) + 'deg'); c.style.setProperty('--mz-ty', ((px - 0.5) * 2 * k).toFixed(2) + 'deg');
  }, { passive: true });
  document.addEventListener('pointerleave', () => { unlight(lit); lit = null; }, true);
  document.addEventListener('mouseout', (e) => { if (lit && !e.relatedTarget?.closest?.(CARD)) { unlight(lit); lit = null; } }, { passive: true });

  // ---------- 4. popups grow from their button and go back into it ----------
  let from = null;
  document.addEventListener('pointerdown', (e) => { const b = e.target.closest?.('button, [data-action], [role="button"]'); if (b) from = { r: b.getBoundingClientRect(), at: Date.now() }; }, { capture: true, passive: true });
  const origin = (sheet) => {
    if (!from || Date.now() - from.at > 1500) return null;
    const s = sheet.getBoundingClientRect(); if (!s.width) return null;
    return { x: from.r.left + from.r.width / 2 - s.left, y: from.r.top + from.r.height / 2 - s.top, s, b: from.r };
  };
  if (typeof showModal === 'function') {
    const showBefore = showModal;
    showModal = function (...a) {
      const wasOpen = !!document.querySelector('#overlay .sheet');
      const r = showBefore.apply(this, a);
      try {
        const sheet = document.querySelector('#overlay .sheet');
        const o = !wasOpen && sheet && !calm() && origin(sheet);
        if (o) {
          sheet.style.transformOrigin = `${o.x}px ${o.y}px`;
          sheet.dataset.mzFrom = JSON.stringify({ x: o.b.left + o.b.width / 2, y: o.b.top + o.b.height / 2 });
          sheet.animate([{ transform: `scale(${Math.max(0.12, o.b.width / o.s.width).toFixed(3)})`, opacity: 0, borderRadius: '24px' }, { transform: 'scale(1.015)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)', opacity: 1 }], { duration: 340, easing: 'cubic-bezier(.2,.9,.3,1)' });
        }
      } catch {}
      return r;
    };
  }
  if (typeof closeModal === 'function') {
    const closeBefore = closeModal;
    closeModal = function (...a) {
      try {
        const sheet = document.querySelector('#overlay .sheet'), at = sheet?.dataset.mzFrom && JSON.parse(sheet.dataset.mzFrom);
        if (sheet && at && !calm()) {
          // a picture of the popup shrinks back into the button while the real one is already gone
          const s = sheet.getBoundingClientRect(), ghost = sheet.cloneNode(true);
          ghost.removeAttribute('id'); ghost.querySelectorAll('[id]').forEach((x) => x.removeAttribute('id'));
          Object.assign(ghost.style, { position: 'fixed', left: s.left + 'px', top: s.top + 'px', width: s.width + 'px', height: s.height + 'px', margin: '0', zIndex: 2147483000, pointerEvents: 'none', transformOrigin: `${at.x - s.left}px ${at.y - s.top}px` });
          document.body.append(ghost);
          const an = ghost.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.12)', opacity: 0 }], { duration: 150, easing: 'cubic-bezier(.4,0,.8,.4)' });
          an.onfinish = an.oncancel = () => ghost.remove();
        }
      } catch {}
      return closeBefore.apply(this, a);
    };
  }

  // ---------- 5. dock magnification on the bottom tab bar ----------
  let dock = null;
  const dockOff = () => { if (!dock) return; dock.querySelectorAll('button').forEach((b) => b.style.removeProperty('--mz-dock')); dock.classList.remove('mz-docking'); dock.querySelector('.mz-dock-name')?.remove(); dock = null; };
  const dockAt = (nav, x) => {
    if (calm()) return dockOff();
    dock = nav; nav.classList.add('mz-docking');
    const btns = [...nav.querySelectorAll(':scope > button')]; let best = null, bestD = 1e9;
    for (const b of btns) {
      const r = b.getBoundingClientRect(), c = r.left + r.width / 2, d = Math.abs(x - c), w = r.width || 60;
      const s = 1 + 0.32 * Math.max(0, 1 - d / (w * 1.6)); b.style.setProperty('--mz-dock', s.toFixed(3));
      if (d < bestD) { bestD = d; best = b; }
    }
    let tag = nav.querySelector(':scope > .mz-dock-name');
    if (!tag) { tag = document.createElement('span'); tag.className = 'mz-dock-name'; nav.append(tag); }
    const name = best?.getAttribute('aria-label') || best?.textContent.trim() || '';
    tag.textContent = name;
    const br = best.getBoundingClientRect(), nr = nav.getBoundingClientRect();
    tag.style.left = (br.left - nr.left + br.width / 2) + 'px';
  };
  document.addEventListener('pointermove', (e) => {
    const nav = e.target.closest?.('#app > .nav');
    if (nav && (e.pointerType === 'mouse' || e.buttons)) dockAt(nav, e.clientX); else if (dock && e.pointerType === 'mouse') dockOff();
  }, { passive: true });
  document.addEventListener('pointerdown', (e) => { const nav = e.target.closest?.('#app > .nav'); if (nav && e.pointerType !== 'mouse') dockAt(nav, e.clientX); }, { capture: true, passive: true });
  document.addEventListener('pointerup', (e) => { if (dock && e.pointerType !== 'mouse') setTimeout(dockOff, 120); }, { passive: true });
  document.addEventListener('pointercancel', () => dockOff(), { passive: true });

  const css = document.createElement('style');
  css.id = 'mz-fx-css';
  css.textContent = `
#mz-fx-layer{position:fixed;inset:0;pointer-events:none;z-index:2147483600;overflow:hidden}
#mz-fx-layer i{position:absolute;border-radius:50%;filter:saturate(1.2);box-shadow:0 0 6px currentColor}
/* 2 — light + tilt (mouse only) */
@media (hover:hover) and (pointer:fine){
  :is(.card,.chat-entry,.mz-cgroup,.contact-favorites,.wx-menu-group,.moment,.mz-todo-item){transition:transform .45s cubic-bezier(.2,.8,.2,1);transform:perspective(900px) rotateX(var(--mz-tx,0deg)) rotateY(var(--mz-ty,0deg))}
  .mz-lit{transition:transform .12s ease-out!important;position:relative}
  .mz-lit::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:1;
    background:radial-gradient(260px circle at var(--mz-lx) var(--mz-ly),color-mix(in srgb,#fff 30%,transparent),transparent 62%);mix-blend-mode:soft-light}
  .mz-lit::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:1;padding:1px;
    background:radial-gradient(160px circle at var(--mz-lx) var(--mz-ly),color-mix(in srgb,#fff 85%,var(--accent)),transparent 70%);
    -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
  html.mz-dark .mz-lit::before{background:radial-gradient(260px circle at var(--mz-lx) var(--mz-ly),color-mix(in srgb,var(--accent) 26%,transparent),transparent 62%);mix-blend-mode:screen}
}
/* 3 — border beam on the Me page profile card */
@property --mz-beam{syntax:"<angle>";inherits:false;initial-value:0deg}
#app .wx-profile,#app .profile-card{position:relative;isolation:isolate}
#app .wx-profile::after,#app .profile-card::after{content:"";position:absolute;inset:0;border-radius:inherit;padding:1.5px;pointer-events:none;z-index:2;
  background:conic-gradient(from var(--mz-beam),transparent 0 56%,color-mix(in srgb,var(--accent) 60%,#fff) 74%,#fff 80%,color-mix(in srgb,var(--accent) 70%,transparent) 86%,transparent 94%);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:mz-beam 2.4s linear infinite}
@keyframes mz-beam{to{--mz-beam:360deg}}
@media (prefers-reduced-motion:reduce){#app .wx-profile::after,#app .profile-card::after{animation:none;opacity:.5}}
/* 5 — dock */
#app>.nav>button{transition:transform .18s cubic-bezier(.2,.9,.3,1.2)}
#app>.nav.mz-docking>button{transform:translateY(calc((var(--mz-dock,1) - 1) * -22px)) scale(var(--mz-dock,1));transition:transform .08s linear}
.mz-dock-name{position:absolute;bottom:calc(100% + 8px);transform:translateX(-50%);padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;white-space:nowrap;pointer-events:none;
  background:color-mix(in srgb,var(--surface,#fff) 82%,transparent);color:var(--ink);box-shadow:0 4px 14px #0002;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);animation:mz-dock-in .16s ease-out}
@keyframes mz-dock-in{from{opacity:0;transform:translate(-50%,4px)}}
`;
  document.head.append(css);
  window.mzFx = { burst };
}
