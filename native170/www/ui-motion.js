'use strict';
// 3.4.1: motion details from the user's prompt notes (the Macaron / Neon / City themes; Liquid Glass, Moon Jelly
// and Cats keep their own press effects):
//  1 press: down to 96 %, on release a spring a little past 100 % and back
//  2 switch: the knob stretches into a capsule while it travels, then settles round with a small bounce
//  3 ripple: starts where the finger touched (not the button's centre), clipped to the button, in its own layer
//  4 like / favourite: the icon pops and a ring of small particles flies out — only these buttons
//  5 checkbox: the tick is drawn in (left to right) in about 200 ms
//  6 slider: the filled part of the track follows the knob as you drag
// All of it is transform / opacity / background-size only, and off with prefers-reduced-motion.
{
  const root = document.documentElement;
  const plain = () => !root.matches('.mz-glass,.mz-jelly,.mz-cat') && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let fx = null;
  const layer = () => { if (!fx || !fx.isConnected) { fx = document.createElement('div'); fx.id = 'mz-motion-fx'; document.body.append(fx); } return fx; };

  // 3 ripple from the touch point
  const RIPPLE = '.pill,.primary,.setting-choice,.wx-menu-row,.chat-row,.contact-row,.mz-seg';
  document.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || !plain()) return;
    // the whole entry (row + its ⋯ button), not just the row, so the rectangle covers everything
    const b = e.target.closest?.('.chat-entry,.contact-entry') || e.target.closest?.(RIPPLE); if (!b || b.disabled) return;
    const r = b.getBoundingClientRect(), cs = getComputedStyle(b), box = document.createElement('div');
    box.className = 'mz-rip-box';
    box.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border-radius:${cs.borderRadius}`;
    const size = Math.hypot(Math.max(e.clientX - r.left, r.right - e.clientX), Math.max(e.clientY - r.top, r.bottom - e.clientY)) * 2;
    const dot = document.createElement('i');
    dot.style.cssText = `left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px;width:${size}px;height:${size}px`;
    box.append(dot); const l = layer(); while (l.childElementCount > 6) l.firstElementChild.remove(); l.append(box);
    // follow the row while the page scrolls instead of staying pinned to the old viewport spot
    const follow = () => { if (!b.isConnected) { box.remove(); return; } const n = b.getBoundingClientRect(); box.style.left = n.left + 'px'; box.style.top = n.top + 'px'; };
    addEventListener('scroll', follow, { capture: true, passive: true });
    const a = dot.animate([{ transform: 'scale(0)', opacity: .32 }, { transform: 'scale(1)', opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
    a.onfinish = a.oncancel = () => { removeEventListener('scroll', follow, { capture: true }); box.remove(); };
  }, { capture: true, passive: true });

  // 2 elastic switch (the switch may be rebuilt by the toggle, so it is found again by its data attributes)
  document.addEventListener('click', (e) => {
    const s = e.target.closest?.('.switch'); if (!s || !plain()) return;
    const sel = '.switch' + [...s.attributes].filter((a) => a.name.startsWith('data-')).map((a) => `[${a.name}="${CSS.escape(a.value)}"]`).join('');
    requestAnimationFrame(() => {
      const n = (sel !== '.switch' && document.querySelector(sel)) || (s.isConnected ? s : null); if (!n) return;
      n.classList.remove('mz-sw-on', 'mz-sw-off'); void n.offsetWidth;
      n.classList.add(n.classList.contains('on') ? 'mz-sw-on' : 'mz-sw-off');
      setTimeout(() => n.classList.remove('mz-sw-on', 'mz-sw-off'), 420);
    });
  });

  // 4 like / favourite burst
  const LIKE = '[data-like],[data-favorite],[data-action="favoriteMessage"],[data-action="toggleFavorite"]';
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.(LIKE); if (!b || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = b.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, l = layer();
    b.querySelector('svg')?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)', offset: .35 }, { transform: 'scale(.92)', offset: .7 }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
    for (let k = 0; k < 8; k++) {
      const p = document.createElement('i'); p.className = 'mz-burst';
      p.style.cssText = `left:${cx - 3}px;top:${cy - 3}px;background:${k % 2 ? 'var(--accent)' : '#ff6b8a'}`;
      l.append(p);
      const ang = (k / 8) * Math.PI * 2, d = 18 + (k % 3) * 4;
      const a = p.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(ang) * d}px,${Math.sin(ang) * d}px) scale(.3)`, opacity: 0 }], { duration: 480, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' });
      a.onfinish = () => p.remove();
    }
  }, true);

  // 6 slider fill follows the knob
  const fill = (el) => { const min = +el.min || 0, max = +el.max || 100, v = +el.value; el.style.setProperty('--mzp', ((v - min) / (max - min || 1)) * 100 + '%'); };
  document.addEventListener('input', (e) => { if (e.target.matches?.('input[type=range]')) fill(e.target); }, true);
  const renderBefore = render;
  render = function (...a) { const r = renderBefore.apply(this, a); try { document.querySelectorAll('#app input[type=range], #overlay input[type=range]').forEach(fill); } catch {} return r; };

  const P = 'html:not(.mz-glass):not(.mz-jelly):not(.mz-cat)';
  const css = document.createElement('style');
  css.textContent = `
#mz-motion-fx{position:fixed;inset:0;pointer-events:none;z-index:2147483500;overflow:hidden;contain:strict}
.mz-rip-box{position:absolute;overflow:hidden}
.mz-rip-box i{position:absolute;border-radius:50%;background:currentColor;color:var(--accent);opacity:0;will-change:transform,opacity}
.mz-burst{position:absolute;width:6px;height:6px;border-radius:50%;will-change:transform,opacity}
@media (prefers-reduced-motion:no-preference){
 ${P} :is(.pill,.icon-button,.setting-choice,.chat-entry,.contact-row,.nav button,.swatch){transition:transform .42s cubic-bezier(.34,1.56,.64,1)!important}
 ${P} :is(.pill,.icon-button,.setting-choice,.chat-entry,.contact-row,.nav button,.swatch):active{transform:scale(.96)!important;transition-duration:.08s!important;transition-timing-function:ease-out!important}
 ${P} .switch.mz-sw-on:after{animation:mz-sw-on .4s cubic-bezier(.3,.7,.3,1) both}
 ${P} .switch.mz-sw-off:after{animation:mz-sw-off .4s cubic-bezier(.3,.7,.3,1) both}
}
@keyframes mz-sw-on{0%{transform:translateX(0);width:22px}45%{transform:translateX(4px);width:32px}80%{transform:translateX(19px);width:21px}100%{transform:translateX(18px);width:22px}}
@keyframes mz-sw-off{0%{transform:translateX(18px);width:22px}45%{transform:translateX(4px);width:32px}80%{transform:translateX(-1px);width:21px}100%{transform:translateX(0);width:22px}}
/* 5 the tick is drawn in */
${P} .check-row input[type=checkbox]{appearance:none;-webkit-appearance:none;width:22px;height:22px;min-height:0;padding:0;flex:none;border:2px solid var(--accent);border-radius:7px;background:transparent no-repeat 3px 50%/0 12px;transition:background-color .15s}
${P} .check-row input[type=checkbox]:checked{background-color:var(--accent);background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 12'%3E%3Cpath d='M1.5 6.5 5 10l7.5-8' fill='none' stroke='white' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");background-size:14px 12px;animation:mz-tick .2s ease-out}
@keyframes mz-tick{from{background-size:0 12px}to{background-size:14px 12px}}
/* 6 slider fill */
${P} input[type=range]{accent-color:var(--accent)}
`;
  document.head.append(css);
}
