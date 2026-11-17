'use strict';
// 3.4.1: moving around by swiping, and everything that slides also fades.
// - Main tabs (聊天 · 聯絡人 · 朋友圈 · 聽歌 · 我): swipe left / right to the next tab; the page follows the finger.
// - 聯絡人: the swipe first moves between AI and 人類, and the highlight under those two buttons follows the finger.
// - Inside a chat or a page: swipe right (from the left edge, or anywhere that has no swipe of its own) to go back.
// - Switching between buttons in a group (AI/人類, segmented choices, the bottom tabs, sticker packs) slides the
//   highlight from the old button to the new one.
// - A new screen slides in a little from the side it came from and fades in, whether it came from a swipe or a tap.
// Phones and tablets only for the gestures (touch); the desktop layout keeps its own panels.
{
  const TABS = ['chats', 'contacts', 'moments', 'music', 'settings'];
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktop = () => !!document.querySelector('.desktop-shell');
  const screenEl = () => document.querySelector('#app > .conversation, #app > .page');
  const css = document.createElement('style');
  css.textContent = `
.mz-gliding{isolation:isolate}
.mz-gliding>*{position:relative;z-index:1}
.mz-glider{position:absolute;z-index:0;pointer-events:none;margin:0}
/* While the highlight slides, the button's own highlight is hidden; stronger than any theme's 「selected」 style
   (the glass theme's beat the plain rule, so both showed and the highlight looked doubled). */
html:root:root .mz-gliding.mz-gliding .mz-glide-target.mz-glide-target.mz-glide-target.mz-glide-target.mz-glide-target.mz-glide-target{background:transparent!important;box-shadow:none!important;border-color:transparent!important;transition:none!important}
html:root .mz-gliding>:not(.mz-glider){transition:color .2s!important}
/* While a screen slides, nothing re-blurs what's behind it on every frame (the bars stay see-through) and the page's
   own fade-in doesn't run on top of the slide: that's what made swipes stutter on phones. */
html.mz-swiping *{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
html.mz-swiping .page,html.mz-swiping .conversation{animation:none!important}
`;
  document.head.append(css);

  // ---------- sliding highlight between buttons ----------
  const GROUPS = [
    { box: '.contact-mode', item: 'button', on: 'selected' },
    { box: '.mz-segs', item: '.mz-seg', on: 'selected' },
    { box: '#app > .nav', item: 'button', on: 'active', part: '.nav-icon' },
    { box: '.sticker-panel .between .flex', item: '.chip', on: 'selected' },
  ];
  const chosen = (box, gr) => { const items = [...box.querySelectorAll(':scope > ' + gr.item)]; const i = items.findIndex((x) => x.classList.contains(gr.on)); return { items, i, el: i < 0 ? null : gr.part ? items[i].querySelector(gr.part) || items[i] : items[i] }; };
  const rel = (el, box) => { const a = el.getBoundingClientRect(), b = box.getBoundingClientRect(); return { x: a.left - b.left + box.scrollLeft, y: a.top - b.top + box.scrollTop, w: a.width, h: a.height }; };
  const snapshot = () => {
    const out = [];
    GROUPS.forEach((gr, g) => document.querySelectorAll(gr.box).forEach((box, n) => { const c = chosen(box, gr); if (c.el) out.push({ key: g + ':' + n, i: c.i, at: rel(c.el, box) }); }));
    return out;
  };
  const glide = (box, target, from, ms = 260) => {
    if (calm() || !from.w) return;
    const to = rel(target, box), cs = getComputedStyle(target);
    if (Math.abs(to.x - from.x) < 1 && Math.abs(to.y - from.y) < 1) return;
    if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
    box.querySelectorAll(':scope > .mz-glider').forEach((x) => x.remove());
    const ghost = document.createElement('i');
    ghost.className = 'mz-glider';
    Object.assign(ghost.style, { left: '0', top: '0', width: to.w + 'px', height: to.h + 'px', background: cs.background, borderRadius: cs.borderRadius, boxShadow: cs.boxShadow, border: cs.border });
    box.classList.add('mz-gliding');
    box.prepend(ghost);
    target.classList.add('mz-glide-target');
    const a = ghost.animate([
      { transform: `translate(${from.x}px,${from.y}px)`, width: from.w + 'px', height: from.h + 'px' },
      { transform: `translate(${to.x}px,${to.y}px)`, width: to.w + 'px', height: to.h + 'px' },
    ], { duration: ms, easing: 'cubic-bezier(.3,.9,.3,1)' });
    const done = () => { ghost.remove(); target.classList.remove('mz-glide-target'); if (!box.querySelector(':scope > .mz-glider')) box.classList.remove('mz-gliding'); };
    a.onfinish = done; a.oncancel = done;
  };
  const glideChanges = (before) => {
    if (!before.length) return;
    GROUPS.forEach((gr, g) => document.querySelectorAll(gr.box).forEach((box, n) => {
      const old = before.find((x) => x.key === g + ':' + n), c = chosen(box, gr);
      if (old && c.el && old.i !== c.i) glide(box, c.el, old.at);
    }));
  };

  // Some groups change their highlight in place, without a redraw: check right after the click as well.
  document.addEventListener('click', (e) => {
    const hit = GROUPS.findIndex((gr) => e.target.closest?.(gr.box + ' > ' + gr.item));
    if (hit < 0) return;
    const before = snapshot();
    requestAnimationFrame(() => { try { if (!document.querySelector('.mz-glider')) glideChanges(before); } catch {} });
  }, true);

  // ---------- screens sliding in ----------
  const view = () => ({ tab, sub: !!(chatId || page), key: tab + '|' + (chatId || '') + '|' + (page || '') + '|' + (tab === 'contacts' ? contactMode : '') });
  let goingBack = false, fromSwipe = 0, settleTimer = 0;
  const sliding = () => { clearTimeout(settleTimer); document.documentElement.classList.add('mz-swiping'); };
  const settled = (ms = 60) => { clearTimeout(settleTimer); settleTimer = setTimeout(() => document.documentElement.classList.remove('mz-swiping'), ms); };
  const enter = (el, dir) => {
    if (!el || calm() || desktop()) return;
    sliding();
    el.style.willChange = 'transform, opacity';
    el.style.opacity = '0';
    // One frame later, once the new screen is laid out, so the slide doesn't compete with building it.
    requestAnimationFrame(() => {
      el.style.opacity = '';
      const a = el.animate([{ transform: `translateX(${dir * 22}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 230, easing: 'cubic-bezier(.2,.8,.2,1)' });
      const done = () => { el.style.willChange = ''; settled(); };
      a.onfinish = done; a.oncancel = done;
    });
  };
  const direction = (a, b) => {
    if (a.sub && !b.sub) return -1;
    if (!a.sub && b.sub) return 1;
    if (a.sub && b.sub) return goingBack ? -1 : 1;
    if (a.tab !== b.tab) return Math.sign(TABS.indexOf(b.tab) - TABS.indexOf(a.tab)) || 1;
    return 0;
  };
  if (typeof window.goBack === 'function') { const back = window.goBack; window.goBack = function (...x) { goingBack = true; try { return back.apply(this, x); } finally { setTimeout(() => { goingBack = false; }, 0); } }; }
  const renderBefore = render;
  render = function (...x) {
    let before = [], was = null;
    try { before = snapshot(); was = view(); } catch {}
    const r = renderBefore.apply(this, x);
    try {
      glideChanges(before);
      const now = view();
      if (was && now.key !== was.key && Date.now() > fromSwipe) {
        if (was.tab === 'contacts' && now.tab === 'contacts' && !was.sub && !now.sub) enter(screenEl()?.querySelector(':scope > .content'), contactMode === 'human' ? 1 : -1);
        else { const d = direction(was, now); if (d) enter(screenEl(), d); }
      }
    } catch {}
    return r;
  };

  // ---------- gestures ----------
  const EDGE = 28;
  let g = null;
  const sideways = (el) => { for (; el && el !== document.body; el = el.parentElement) if (el.scrollWidth > el.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(el).overflowX)) return true; return false; };
  const busy = (t) => t.closest('input,textarea,select,audio,video,iframe,.composer,.composer-menu,.sticker-panel,.message-body,.mz-listen-player,.mz-player,.voice-wave,[data-voice-seek],[role=slider]');
  const begin = (t, x, y) => {
    if (desktop() || modal || (typeof callOverlay !== 'undefined' && callOverlay) || document.querySelector('.modal-backdrop,.mz-lock')) return null;
    if (!t.closest?.('#app') || y > innerHeight - 56 || window.mzGlass?.held?.()) return null;
    const edge = x <= EDGE;
    if (!edge && (busy(t) || sideways(t))) return null;
    if (chatId || page) return { kind: 'back', edge };
    if (!TABS.includes(tab)) return null;
    return { kind: 'tabs', edge };
  };
  // Where a swipe in this direction leads: a contacts mode, the next tab, going back, or nowhere.
  const target = (kind, dir) => {
    if (kind === 'back') return dir > 0 ? { go: 'back' } : null;
    if (tab === 'contacts' && document.querySelector('.contact-mode')) {
      if (dir < 0 && contactMode === 'ai') return { go: 'mode', mode: 'human' };
      if (dir > 0 && contactMode === 'human') return { go: 'mode', mode: 'ai' };
    }
    const next = TABS[TABS.indexOf(tab) - dir];
    return next ? { go: 'tab', tab: next } : null;
  };
  const moving = (d) => (d.to?.go === 'mode' ? screenEl()?.querySelector(':scope > .content') : screenEl());
  const paint = (d) => {
    const el = d.el, w = innerWidth, dx = d.to ? d.dx : d.dx * 0.25;
    el.style.transform = `translateX(${dx}px)`;
    el.style.opacity = String(1 - Math.min(0.55, Math.abs(dx) / w * 0.8));
    if (d.ghost) { const p = Math.min(1, Math.abs(d.dx) / (w * 0.6)); d.ghost.style.transform = `translate(${d.gFrom.x + (d.gTo.x - d.gFrom.x) * p}px,${d.gFrom.y}px)`; }
  };
  const reset = (d, ms = 180) => {
    const el = d.el;
    el.style.transition = `transform ${ms}ms ease-out, opacity ${ms}ms ease-out`;
    el.style.transform = ''; el.style.opacity = '';
    if (d.ghost) { d.ghost.style.transition = `transform ${ms}ms ease-out`; d.ghost.style.transform = `translate(${d.gFrom.x}px,${d.gFrom.y}px)`; }
    setTimeout(() => { el.style.transition = ''; el.style.willChange = ''; dropGhost(d); }, ms + 20);
    settled(ms + 40);
  };
  const dropGhost = (d) => { if (!d.ghost) return; d.ghost.remove(); d.box?.classList.remove('mz-gliding'); d.gEl?.classList.remove('mz-glide-target'); d.ghost = null; };
  // 聯絡人: the highlight under AI / 人類 rides along with the finger.
  const ghostFor = (d) => {
    const box = document.querySelector('.contact-mode'), gr = GROUPS[0];
    if (!box) return;
    const c = chosen(box, gr), other = c.items.find((x) => x.dataset.contactmode === d.to.mode);
    if (!c.el || !other) return;
    const cs = getComputedStyle(c.el);
    if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
    d.box = box; d.gEl = c.el; d.gFrom = rel(c.el, box); d.gTo = rel(other, box);
    const ghost = document.createElement('i');
    ghost.className = 'mz-glider';
    Object.assign(ghost.style, { left: '0', top: '0', width: d.gFrom.w + 'px', height: d.gFrom.h + 'px', background: cs.background, borderRadius: cs.borderRadius, boxShadow: cs.boxShadow, transform: `translate(${d.gFrom.x}px,${d.gFrom.y}px)` });
    box.classList.add('mz-gliding'); box.prepend(ghost); c.el.classList.add('mz-glide-target');
    d.ghost = ghost;
  };
  const finish = (d) => {
    const to = d.to, el = d.el, out = d.dx > 0 ? 1 : -1, ms = 150;
    el.style.transition = `transform ${ms}ms ease-in, opacity ${ms}ms ease-in`;
    el.style.transform = `translateX(${out * 100}%)`; el.style.opacity = '0';
    if (d.ghost) { d.ghost.style.transition = `transform ${ms}ms ease-in`; d.ghost.style.transform = `translate(${d.gTo.x}px,${d.gTo.y}px)`; }
    setTimeout(() => {
      fromSwipe = Date.now() + 400;
      el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; el.style.willChange = '';
      dropGhost(d);
      if (to.go === 'back') window.goBack?.();
      else if (to.go === 'mode') document.querySelector(`[data-contactmode="${to.mode}"]`)?.click();
      else (document.querySelector(`#app > .nav [data-tab="${to.tab}"]`) || {}).click?.();
      // The new screen comes in from the side the finger came from, fading in.
      enter(to.go === 'mode' ? screenEl()?.querySelector(':scope > .content') : screenEl(), -out);
      if (!document.documentElement.classList.contains('mz-swiping') || calm() || desktop()) settled();
    }, ms);
  };
  document.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    const how = e.touches.length === 1 ? begin(e.target, t.clientX, t.clientY) : null;
    g = how ? { ...how, x: t.clientX, y: t.clientY, dx: 0, axis: '', el: null, t0: Date.now() } : null;
  }, { passive: true, capture: true });
  document.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (!g || !t) return;
    const dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.axis && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      g.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      // Going back is a right swipe only; a left swipe in a chat belongs to the page.
      if (g.axis === 'x' && g.kind === 'back' && dx < 0) g.axis = 'y';
      if (g.axis === 'x') {
        sliding();
        g.to = target(g.kind, dx > 0 ? 1 : -1);
        g.el = moving(g);
        if (!g.el) { g = null; return; }
        g.el.style.willChange = 'transform, opacity';
        if (g.to?.go === 'mode') ghostFor(g);
      }
    }
    if (g.axis === 'y') { g = null; return; }
    if (g.axis === 'x' && g.el) {
      g.dx = g.kind === 'back' ? Math.max(0, dx) : dx;
      // Changing direction mid-swipe changes where it leads.
      const to = target(g.kind, g.dx > 0 ? 1 : g.dx < 0 ? -1 : 0);
      if (g.to?.go !== to?.go || g.to?.tab !== to?.tab || g.to?.mode !== to?.mode) {
        g.el.style.transform = ''; g.el.style.opacity = ''; g.el.style.willChange = '';
        dropGhost(g);
        g.to = to; g.el = moving(g) || screenEl(); g.el.style.willChange = 'transform, opacity';
        if (to?.go === 'mode') ghostFor(g);
      }
      if (!g.frame) g.frame = requestAnimationFrame(() => { if (!g) return; g.frame = 0; paint(g); });
    }
  }, { passive: true, capture: true });
  document.addEventListener('touchend', () => {
    const d = g;
    g = null;
    if (!d?.el) return;
    cancelAnimationFrame(d.frame);
    const fast = Math.abs(d.dx) > 40 && Math.abs(d.dx) / Math.max(1, Date.now() - d.t0) > 0.5;
    if (d.to && (Math.abs(d.dx) > Math.min(90, innerWidth * 0.25) || fast)) finish(d); else reset(d);
  }, { passive: true, capture: true });
  document.addEventListener('touchcancel', () => { if (g?.el) reset(g); else settled(); g = null; }, { passive: true, capture: true });

  window.mzSwipeNav = { TABS, glide };
}
