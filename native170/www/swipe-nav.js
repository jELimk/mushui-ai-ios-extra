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
  const glassMotion = () => document.documentElement.classList.contains('mz-glass');
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktop = () => !!document.querySelector('.desktop-shell');
  const screenEl = () => document.querySelector('#app > .conversation, #app > .page, .desktop-workspace > .page, .desktop-workspace > .conversation');
  const css = document.createElement('style');
  css.textContent = `
.mizuki-record-pager.mz-pdrag .mizuki-record-pane{visibility:visible!important}
html.mz-swiping .page,html.mz-swiping .page>.content{overflow-x:hidden!important}
.mz-gliding{isolation:isolate}
.mz-gliding>*{position:relative;z-index:1}
.mz-glider{position:absolute;z-index:0;pointer-events:none;margin:0}
/* While the highlight slides, the button's own highlight is hidden; stronger than any theme's 「selected」 style
   (the glass theme's beat the plain rule, so both showed and the highlight looked doubled). */
html:root:root .mz-gliding.mz-gliding .mz-glide-target.mz-glide-target.mz-glide-target.mz-glide-target.mz-glide-target.mz-glide-target{background:transparent!important;box-shadow:none!important;border-color:transparent!important;transition:none!important}
html:root .mz-gliding>:not(.mz-glider){transition:color .2s!important}
/* While a screen slides, nothing re-blurs what's behind it on every frame (the bars stay see-through) and the page's
   own fade-in doesn't run on top of the slide: that's what made swipes stutter on phones. */
/* 3.4.2: moving parts are only marked will-change: transform — marking opacity too made each moving list its own
   "backdrop root", so the frosted cards inside blurred nothing and looked clear mid-swipe.
   Blur is no longer paused while swiping — everything keeps the same look (the user saw cards and bars turn
   see-through). Blur radii are kept small so swipes stay smooth. */
html.mz-swiping .page,html.mz-swiping .conversation{animation:none!important}
/* 3.4.1: AI / 人類 look like 記錄's 朋友圈 / 狀態 — two plain halves and one underline that slides (and follows
   the finger / mouse while dragging). --cmp: 0 = AI, 1 = 人類, anything in between while dragging. */
html:root:root .contact-mode.contact-mode{position:relative;display:grid!important;grid-template-columns:1fr 1fr;gap:0!important;padding:0 0 10px!important;margin-bottom:6px;background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;--cmp:0}
html:root:root .contact-mode.contact-mode[data-mode="human"]{--cmp:1}
html:root:root .contact-mode.contact-mode:not(.mz-cm-probe)>button{background:transparent!important;border:0!important;box-shadow:none!important;border-radius:14px!important;font:inherit;color:var(--muted)!important;font-weight:400;padding:8px 0!important;min-height:0;transform:none!important}
html:root:root .contact-mode.contact-mode>button.selected{color:var(--accent-deep)!important;font-weight:700}
html:root:root .contact-mode.contact-mode>button::before,html:root:root .contact-mode.contact-mode>button::after{display:none!important}
/* the underline sits 18 px in from each side, so when it springs past its end (left or right) there is room to see it
   run over and get pulled back — a rubber-band "duang". Shared by AI / 人類 and 記錄's 朋友圈 / 狀態. */
:root{--mz-duang:cubic-bezier(.2,1.24,.4,1);--mz-tab-fill:color-mix(in srgb,var(--surface,#fff) 82%,white)}
:root.mz-dark{--mz-tab-fill:color-mix(in srgb,var(--surface,var(--bg)) 90%,white)}

.contact-mode::after,.mizuki-record-indicator{bottom:0;height:3px;background:var(--accent);border-radius:3px}
.contact-mode::after{content:""}
.contact-mode::before,.mizuki-record-tabs::before{content:"";top:0;bottom:10px;border-radius:12px;background:var(--mz-tab-fill)}
.contact-mode::after,.contact-mode::before,.mizuki-record-indicator,.mizuki-record-tabs::before{
  position:absolute;left:18px;width:calc(50% - 36px);pointer-events:none;
  transform:translateX(calc(var(--cmp,0) * (100% + 36px)));
  transition:transform .7s var(--mz-duang);will-change:transform
}
.mizuki-record-tabs{--cmp:0;gap:0}
.mizuki-record-tabs[data-tab="status"]{--cmp:1}
html:root:root .mizuki-record-tabs button{position:relative;background:transparent!important;border:0!important;box-shadow:none!important}
html:root body #app .page>.top.mizuki-record-top{margin-inline:0!important;padding-inline:25px}
@media(min-width:850px){html:root body #app .page>.top.mizuki-record-top{padding-inline:44px}}
html:root body #app .page>.mizuki-record-top>.between{max-width:none}
.mz-cm-drag::after,.mz-cm-drag::before,.mz-cm-drag>.mizuki-record-indicator{transition:none!important}
.contact-mode.mz-cm-commit::after,.contact-mode.mz-cm-commit::before{transition:none;animation:mz-cm-settle .7s var(--mz-duang) var(--cm-delay,0ms)}
@keyframes mz-cm-settle{from{transform:translateX(calc(var(--cm-from) * (100% + 36px)))}to{transform:translateX(calc(var(--cmp,0) * (100% + 36px)))}}
/* the theme's own "selected" pill (e.g. neon's pop colour) becomes a separate layer that slides with the finger too */

html:root:root .contact-mode.contact-mode:not(.mz-cm-probe)>button.selected.selected{background:transparent!important;box-shadow:none!important}
html:root:root .contact-mode.contact-mode>button{position:relative;z-index:1}
html:root:root .contact-mode.mz-cm-probe>button{transition:none!important}


`;
  document.head.append(css);

  // ---------- sliding highlight between buttons ----------
  const GROUPS = [
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
    if (calm() || !glassMotion() || !from.w) return;
    const to = rel(target, box), cs = getComputedStyle(target);
    if (Math.abs(to.x - from.x) < 1 && Math.abs(to.y - from.y) < 1) return;
    if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
    box.querySelectorAll(':scope > .mz-glider').forEach((x) => x.remove());
    // 賽博朋克: no glide — the old one wipes out toward where it came from, the new one wipes in from the other side
    if (document.documentElement.classList.contains('mz-cyber')) {
      const right = to.x >= from.x;
      const old = document.createElement('i'); old.className = 'mz-glider';
      Object.assign(old.style, { left: '0', top: '0', width: from.w + 'px', height: from.h + 'px', transform: `translate(${from.x}px,${from.y}px)`, background: cs.background, border: cs.border });
      box.classList.add('mz-gliding'); box.prepend(old); target.classList.add('mz-glide-target');
      const out = old.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: right ? 'inset(0 100% 0 0)' : 'inset(0 0 0 100%)' }], { duration: 120, easing: 'steps(4,end)', fill: 'forwards' });
      out.onfinish = out.oncancel = () => { old.remove(); target.classList.remove('mz-glide-target'); box.classList.remove('mz-gliding'); target.animate([{ clipPath: right ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], { duration: 140, easing: 'steps(4,end)' }); };
      return;
    }
    const ghost = document.createElement('i');
    ghost.className = 'mz-glider';
    // 3.4.4 (the user's prompt): a capsule with a thin bright rim; on the way it stretches along the direction it moves,
    // then lands with a little elastic bounce
    const rim = 'inset 0 0 0 1px rgba(255,255,255,.55), inset 0 1px 0 rgba(255,255,255,.8)';
    Object.assign(ghost.style, { left: '0', top: '0', width: to.w + 'px', height: to.h + 'px', background: cs.background, borderRadius: cs.borderRadius, boxShadow: (cs.boxShadow && cs.boxShadow !== 'none' ? cs.boxShadow + ', ' : '') + rim, border: cs.border });
    box.classList.add('mz-gliding');
    box.prepend(ghost);
    target.classList.add('mz-glide-target');
    const dx = to.x - from.x, dy = to.y - from.y, horiz = Math.abs(dx) >= Math.abs(dy), dir = Math.sign(horiz ? dx : dy) || 1;
    const sw = horiz ? Math.max(from.w, to.w) + Math.min(Math.abs(dx) * 0.45, Math.max(from.w, to.w) * 0.6) : Math.max(from.w, to.w);
    const sh = horiz ? Math.max(from.h, to.h) * 0.88 : Math.max(from.h, to.h) + Math.min(Math.abs(dy) * 0.45, Math.max(from.h, to.h) * 0.6);
    const mx = from.x + dx * 0.5 - (sw - (from.w + to.w) / 2) / 2, my = from.y + dy * 0.5 - (sh - (from.h + to.h) / 2) / 2;
    const ox = horiz ? dir * Math.min(6, to.w * 0.08) : 0, oy = horiz ? 0 : dir * Math.min(6, to.h * 0.08);
    const a = ghost.animate([
      { transform: `translate(${from.x}px,${from.y}px)`, width: from.w + 'px', height: from.h + 'px', offset: 0 },
      { transform: `translate(${mx}px,${my}px)`, width: sw + 'px', height: sh + 'px', offset: 0.45 },
      { transform: `translate(${to.x + ox}px,${to.y + oy}px)`, width: to.w * (horiz ? 0.94 : 1.04) + 'px', height: to.h * (horiz ? 1.04 : 0.94) + 'px', offset: 0.78 },
      { transform: `translate(${to.x}px,${to.y}px)`, width: to.w + 'px', height: to.h + 'px', offset: 1 },
    ], { duration: Math.max(ms, 380), easing: 'cubic-bezier(.3,.7,.3,1)' });
    const done = () => { ghost.remove(); target.classList.remove('mz-glide-target'); if (!box.querySelector(':scope > .mz-glider')) box.classList.remove('mz-gliding'); };
    a.onfinish = done; a.oncancel = done;
  };
  // Continue the indicator when tapping a mode redraws the header.
  const cmSlide = (was) => {
    const box = document.querySelector('.contact-mode'); if (!box || was == null) return;
    const now = contactMode === 'human' ? 1 : 0; if (was === now) return;
    box.classList.add('mz-cm-drag'); box.style.setProperty('--cmp', String(was)); void box.offsetWidth;
    box.classList.remove('mz-cm-drag'); box.style.removeProperty('--cmp');
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
  // 3.4.1: the screen sliding in is remembered by how to find it again (the whole screen, or the contacts list),
  // because the app often builds it a second time while it slides (人類 loads its friends, background checks):
  // the rebuilt one used to pop in at full strength in the middle of the slide, which showed as a flicker.
  let entering = null;
  // 聯絡人: the part under the AI / 人類 buttons (contacts-groups.js puts it in one box)
  const listEl = () => screenEl()?.querySelector(':scope > .mz-cpane') || screenEl()?.querySelector(':scope > .content');
  const find =(what) => (what === 'list' ? listEl() : screenEl());
  const enter = (el, dir) => {
    if (!el || calm() || desktop()) return;
    sliding();
    const what = el === screenEl() ? 'screen' : 'list';
    entering?.anim?.cancel();
    const e = entering = { what, dir, el, anim: null };
    // 3.4.1: shown at once — it starts already visible and only finishes a short glide, instead of waiting a frame
    // hidden and then fading in from far away (that felt like a pause before the page appeared)
    play(e, 0);
  };
  const play = (e, at) => {
    const el = e.el;
    el.style.willChange = 'transform';
    const a = e.anim = el.animate([{ transform: `translateX(${e.dir * 8}%)` }, { transform: 'none' }], { duration: 160, easing: 'cubic-bezier(.2,.8,.2,1)' });
    a.currentTime = at;
    const done = () => { if (e.anim !== a) return; el.style.willChange = ''; if (entering === e) entering = null; settled(); };
    a.onfinish = done; a.oncancel = done;
  };
  // After any render: if the screen that's sliding in (or being dragged / sliding out) was rebuilt, carry on with
  // the new one from the same point instead of letting it appear all at once.
  const carry = () => {
    const e = entering;
    if (e && !e.el.isConnected) {
      const now = find(e.what);
      if (!now) entering = null;
      else if (!e.anim) { e.el = now; play(e, 0); }
      else { const at = Number(e.anim.currentTime) || 0, old = e.anim; e.anim = null; old.cancel(); e.el = now; play(e, at); }
    }
    if (g?.el && !g.el.isConnected) {
      const now = moving(g);
      if (now) { dropGhost(g); g.el = now; now.style.willChange = 'transform'; if (g.to?.go === 'mode') ghostFor(g); paint(g); }
    }
    if (leaving && !leaving.isConnected) { const now = find(leavingWhat); if (now) { now.style.opacity = '0'; leaving = now; } }
  };
  let leaving = null, leavingWhat = '', modeSwipe = null;
  const direction = (a, b) => {
    if (a.sub && !b.sub) return -1;
    if (!a.sub && b.sub) return 1;
    if (a.sub && b.sub) return goingBack ? -1 : 1;
    if (a.tab !== b.tab) return Math.sign(TABS.indexOf(b.tab) - TABS.indexOf(a.tab)) || 1;
    return 0;
  };
  if (typeof window.goBack === 'function') { const back = window.goBack; window.goBack = function (...x) { goingBack = true; try { return back.apply(this, x); } finally { setTimeout(() => { goingBack = false; }, 0); } }; }
  // 3.4.4: going back by a button slides the way back: the page you leave is pushed off to the right (a picture of it,
  // so nothing in it can be tapped any more) while the page underneath comes in from a little to the left
  let backShot = null;
  const takeShot = () => {
    if (calm() || !glassMotion() || desktop()) return;
    const el = screenEl(); if (!el) return;
    const r = el.getBoundingClientRect(), shot = el.cloneNode(true);
    shot.querySelectorAll('[id]').forEach((x) => x.removeAttribute('id'));
    shot.querySelectorAll('video,audio,iframe').forEach((x) => x.remove());
    const scrollers = [...el.querySelectorAll('.message-scroll, .content, .page')].map((x) => x.scrollTop);
    backShot = { shot, r, at: Date.now(), scrollers, srcScroll: el.scrollTop };
  };
  const playShot = () => {
    const b = backShot; backShot = null; if (!b || Date.now() - b.at > 600) return false;
    const { shot, r } = b;
    Object.assign(shot.style, { position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', margin: '0', zIndex: '60', pointerEvents: 'none', background: 'var(--bg)', boxShadow: '-12px 0 30px #0002', overflow: 'hidden' });
    document.getElementById('app')?.append(shot);
    shot.scrollTop = b.srcScroll; [...shot.querySelectorAll('.message-scroll, .content, .page')].forEach((x, i) => { x.scrollTop = b.scrollers[i] || 0; });
    sliding();
    const out = shot.animate([{ transform: 'none' }, { transform: 'translateX(100%)' }], { duration: 300, easing: 'cubic-bezier(.3,.7,.3,1)' });
    out.onfinish = out.oncancel = () => { shot.remove(); settled(); };
    const el = screenEl();
    if (el) { const a = el.animate([{ transform: 'translateX(-22%)', filter: 'brightness(.94)' }, { transform: 'none', filter: 'none' }], { duration: 300, easing: 'cubic-bezier(.3,.7,.3,1)' }); a.onfinish = a.oncancel = () => {}; }
    return true;
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-action="back"], [data-action="closeChat"], .top [aria-label="返回"], .top [aria-label="Back"]');
    if (!b || !b.closest('#app')) return;
    // the page variables are already changed when render() runs, so the change is checked right after the tap instead
    takeShot(); const k = view().key;
    setTimeout(() => { try { if (backShot && view().key !== k) playShot(); else backShot = null; } catch {} }, 0);
  }, true);
  const renderBefore = render;
  render = function (...x) {
    let before = [], was = null, cmWas = null;
    try { before = snapshot(); was = view(); const live = document.querySelector('.contact-mode'); if (live) { const v = live.style.getPropertyValue('--cmp'); cmWas = v !== '' ? Number(v) : (live.querySelector('[data-contactmode="human"].selected') ? 1 : 0); } } catch {}
    const r = renderBefore.apply(this, x);
    try {
      if (modeSwipe) {
        const box = document.querySelector('.contact-mode');
        if (!box || modeSwipe.cm.committed && contactMode !== modeSwipe.to.mode) {
          dropGhost(modeSwipe);
          modeSwipe = null;
          cmSlide(cmWas);
        } else if (box !== modeSwipe.box) settleMode(modeSwipe, box);
      } else cmSlide(cmWas);
      glideChanges(before);
      carry();
      const now = view();
      if (glassMotion() && was && now.key !== was.key && Date.now() > fromSwipe) {
        // 3.4.1: tapping AI / 人類 switches at once (sliding on a tap made a scrollbar flash and the list jump).
        if (was.tab === 'contacts' && now.tab === 'contacts' && !was.sub && !now.sub) {}
        else { const d = direction(was, now); if (d) enter(screenEl(), d); }
      }
    } catch {}
    return r;
  };

  // ---------- gestures ----------
  const EDGE = 28;
  let g = null;
  const sideways = (el) => { for (; el && el !== document.body; el = el.parentElement) if (el.scrollWidth > el.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(el).overflowX)) return true; return false; };
  const busy = (t) => t.closest('#mz-kao,#mz-reader,input,textarea,select,audio,video,iframe,.composer,.composer-menu,.sticker-panel,.message-body,.mz-listen-player,.mz-player,.voice-wave,[data-voice-seek],[role=slider]');
  const begin = (t, x, y, mouse) => {
    // 3.4.1: a call screen that's showing: a right swipe (going back) shrinks it to the green bar, so you can keep
    // chatting during the call. A minimized call no longer blocks the usual swipes.
    const call = typeof callOverlay !== 'undefined' && callOverlay;
    const callUp = !!call && call.isConnected && call.classList.contains('mz-call') && !call.classList.contains('mz-min');
    if (desktop() && (!mouse || !t.closest?.('.desktop-workspace') || (tab !== 'contacts' && page !== 'records'))) return null;
    if (modal || document.querySelector('.modal-backdrop,.mz-lock')) return null;
    if (callUp) return t.closest?.('.call-overlay') && !t.closest('input,textarea,[role=slider],video') ? { kind: 'call', edge: x <= EDGE } : null;
    if (call && !callUp && !call.classList.contains('mz-min')) return null;
    if (!t.closest?.('#app') || y > innerHeight - 56) return null;
    if (window.mzGlass?.held?.() && !t.closest('.contact-mode,.mz-cpane,.mizuki-records')) return null;
    const edge = x <= EDGE;
    if (t.closest?.('#mz-kao,#mz-reader')) return null; // full-screen panels handle their own swipes
    if (!edge && (busy(t) || sideways(t))) return null;
    if (chatId || page) return { kind: 'back', edge };
    if (!TABS.includes(tab)) return null;
    return { kind: 'tabs', edge };
  };
  // Where a swipe in this direction leads: a contacts mode, the next tab, going back, or nowhere.
  // A sub page with its own tabs (記錄's 朋友圈 / 狀態): a swipe moves to the neighbouring tab; only past the
  // first tab (or from the very edge) does a right swipe go back.
  const SUBTABS = '.wx-record-tabs,.mizuki-record-tabs,[role=tablist]';
  const subtab = (dir) => {
    const box = screenEl()?.querySelector(SUBTABS); if (!box) return null;
    const items = [...box.querySelectorAll('button')].filter((b) => !b.disabled && b.offsetParent);
    const at = items.findIndex((b) => b.matches('.active,.selected,[aria-selected=true]'));
    const next = at < 0 ? null : items[at - dir];
    return next ? { go: 'subtab', btn: next } : null;
  };
  const target = (kind, dir) => {
    // 3.4.1: going back needs a swipe that starts at the left edge (a swipe in the middle of a page — e.g. on the dark-mode switch — used to go back by mistake)
    if (kind === 'back') return (!g?.edge && subtab(dir)) || (dir > 0 && g?.edge ? { go: 'back' } : null);
    if (kind === 'call') return dir > 0 ? { go: 'call' } : null;
    if (tab === 'contacts' && document.querySelector('.contact-mode')) {
      if (dir < 0 && contactMode === 'ai') return { go: 'mode', mode: 'human' };
      if (dir > 0 && contactMode === 'human') return { go: 'mode', mode: 'ai' };
    }
    const next = TABS[TABS.indexOf(tab) - dir];
    return next ? { go: 'tab', tab: next } : null;
  };
  const moving = (d) => (d.to?.go === 'call' || d.kind === 'call' ? (typeof callOverlay !== 'undefined' ? callOverlay : null) : d.to?.go === 'mode' ? listEl() : d.to?.go === 'subtab' ? (screenEl()?.querySelector(PAGER) || screenEl()) : screenEl());
  // 記錄's 朋友圈 / 狀態 are one page with a pager: the swipe drags the pager itself (both halves side by side)
  // instead of sliding the whole screen out and a new one in.
  const PAGER = '.mizuki-record-pager';
  const isPager = (d) => d.el?.matches?.(PAGER);
  const pagerBase = (el) => (el.dataset.tab === 'status' ? -100 : 0);
  const paint = (d) => {
    if (isPager(d)) {
      const el = d.el, dx = d.to ? d.dx : d.dx * 0.25;
      el.classList.add('mz-pdrag'); el.style.transition = 'none';
      el.style.transform = `translateX(calc(${pagerBase(el)}% + ${dx}px))`;
      const tabs = el.closest('.mizuki-records')?.querySelector('.mizuki-record-tabs');
      if (tabs) {
        tabs.classList.add('mz-cm-drag');
        const start = pagerBase(el) ? 1 : 0;
        tabs.style.setProperty('--cmp', String(Math.max(0, Math.min(1, start - dx / Math.max(1, el.clientWidth * .6)))));
      }
      return;
    }
    const el = d.el, dx = d.to ? d.dx : d.dx * 0.25;
    el.style.transform = `translateX(${dx}px)`;
    // AI / 人類: the list only slides (no fading — it looked like it turned see-through)
    // no fading: opacity on a moving screen stops the frosted glass inside it from blurring what's behind
    el.style.opacity = '';
    if (d.cm && d.box) { const p = Math.min(1, Math.abs(d.dx) / d.cm.span); d.box.style.setProperty('--cmp', String(d.cm.from + (d.cm.to - d.cm.from) * p)); }
  };
  const pagerDone = (el) => {
    const tabs = el.closest('.mizuki-records')?.querySelector('.mizuki-record-tabs');
    tabs?.classList.remove('mz-cm-drag');
    tabs?.style.removeProperty('--cmp');
    el.style.transition = ''; el.style.transform = ''; el.style.willChange = ''; setTimeout(() => el.classList.remove('mz-pdrag'), 340); };
  const reset = (d, ms = 180) => {
    if (isPager(d)) { pagerDone(d.el); settled(360); return; }
    const el = d.el;
    if (d.cm) dropGhost(d);
    el.style.transition = `transform ${ms}ms ease-out, opacity ${ms}ms ease-out`;
    el.style.transform = ''; el.style.opacity = '';
    setTimeout(() => { el.style.transition = ''; el.style.willChange = ''; dropGhost(d); }, ms + 20);
    settled(ms + 40);
  };
  const dropGhost = (d) => { if (d.cm) { const box = d.box; d.cm = null; if (box) { box.classList.remove('mz-cm-drag', 'mz-cm-commit'); box.style.removeProperty('--cmp'); box.style.removeProperty('--cm-from'); box.style.removeProperty('--cm-delay'); } } };
  // 聯絡人: the highlight under AI / 人類 rides along with the finger.
  const ghostFor = (d) => {
    const box = document.querySelector('.contact-mode');
    if (!box) return;
    d.box = box; d.cm = { span: Math.max(1, box.clientWidth * 0.6), from: contactMode === 'human' ? 1 : 0, to: d.to.mode === 'human' ? 1 : 0 };
    box.classList.add('mz-cm-drag');
  };
  const settleMode = (d, box) => {
    d.box = box;
    box.style.setProperty('--cm-from', d.cm.release);
    box.style.setProperty('--cm-delay', `-${performance.now() - d.cm.started}ms`);
    box.classList.remove('mz-cm-drag');
    box.classList.add('mz-cm-commit');
    box.style.setProperty('--cmp', String(d.cm.to));
  };
  const finish = (d) => {
    if (isPager(d)) { pagerDone(d.el); d.to.btn.click(); settled(360); return; }
    const to = d.to, el = d.el, out = d.dx > 0 ? 1 : -1, ms = 90;
    leaving = el; leavingWhat = to.go === 'mode' ? 'list' : 'screen';
    el.style.transition = `transform ${ms}ms ease-in, opacity ${ms}ms ease-in`;
    el.style.transform = `translateX(${out * 100}%)`; el.style.opacity = '';
    if (d.cm) {
      d.cm.release = d.box.style.getPropertyValue('--cmp') || String(d.cm.from);
      d.cm.started = performance.now();
      modeSwipe = d;
      settleMode(d, d.box);
    }
    setTimeout(() => {
      fromSwipe = Date.now() + 400;
      const gone = leaving || el; leaving = null;
      for (const x of new Set([el, gone])) { x.style.transition = ''; x.style.transform = ''; x.style.opacity = ''; x.style.willChange = ''; }
      if (to.go === 'call') { actions.mzCallMinimize?.(); settled(); return; }
      if (to.go === 'subtab') { to.btn.click(); enter(screenEl(), -out); if (!document.documentElement.classList.contains('mz-swiping')) settled(); return; }
      if (to.go === 'back') window.goBack?.();
      else if (to.go === 'mode') document.querySelector(`[data-contactmode="${to.mode}"]`)?.click();
      else (document.querySelector(`#app > .nav [data-tab="${to.tab}"]`) || {}).click?.();
      if (modeSwipe === d) d.cm.committed = true;
      if (modeSwipe === d) setTimeout(() => {
        if (modeSwipe !== d) return;
        modeSwipe = null;
        dropGhost(d);
      }, 630);
      // The new screen slides in from the other side.
      enter(to.go === 'mode' ? listEl() : screenEl(), -out);
      if (!document.documentElement.classList.contains('mz-swiping') || calm() || desktop()) settled();
    }, ms);
  };
  const start = (target0, x, y, mouse) => {
    // 3.4.4: a new swipe while the last one still moves: finish the old one first (it got stuck half-way)
    try { if (g) { dropGhost(g); if (g.el) { g.el.getAnimations?.().forEach((a) => a.finish()); g.el.style.transform = ''; g.el.style.willChange = ''; } } entering?.anim?.finish(); } catch {}
    if (modeSwipe) { dropGhost(modeSwipe); modeSwipe = null; }
    const how = begin(target0, x, y, mouse);
    // 3.4.1: a mouse drag only moves between AI / 人類 and 記錄's 朋友圈 / 狀態 (never back, never other tabs)
    if (how && mouse && !((how.kind === 'tabs' && tab === 'contacts') || (how.kind === 'back' && screenEl()?.querySelector(SUBTABS)))) { g = null; return; }
    g = how ? { ...how, edge: mouse ? false : how.edge, mouse, x, y, dx: 0, axis: '', el: null, t0: Date.now() } : null;
  };
  const mouseOk = (to) => !g?.mouse || !to || to.go === 'mode' || to.go === 'subtab';
  document.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (e.touches.length === 1) start(e.target, t.clientX, t.clientY, false); else g = null;
  }, { passive: true, capture: true });
  const move = (t) => {
    if (!g || !t) return;
    const dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.axis && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      g.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
      // Going back is a right swipe only; a left swipe in a chat belongs to the page.
      if (g.axis === 'x' && (g.kind === 'call' || (g.kind === 'back' && !(!g.edge && subtab(-1)))) && dx < 0) g.axis = 'y';
      if (g.axis === 'x') {
        sliding();
        g.to = target(g.kind, dx > 0 ? 1 : -1);
        if (!mouseOk(g.to)) { g = null; settled(); return; }
        if (!g.to && g.kind === 'back' && !g.edge) { g = null; return; } // a middle-of-page swipe with nowhere to go does nothing
        g.el = moving(g);
        if (!g.el) { g = null; return; }
        g.el.style.willChange = 'transform';
        if (g.to?.go === 'mode') ghostFor(g);
      }
    }
    if (g.axis === 'y') { g = null; return; }
    if (g.axis === 'x' && g.el) {
      g.dx = (g.kind === 'back' && g.to?.go !== 'subtab' && !(!g.edge && subtab(-1))) || g.kind === 'call' ? Math.max(0, dx) : dx;
      // Changing direction mid-swipe changes where it leads.
      let to = target(g.kind, g.dx > 0 ? 1 : g.dx < 0 ? -1 : 0);
      if (!mouseOk(to)) to = null;
      if (g.to?.go !== to?.go || g.to?.tab !== to?.tab || g.to?.mode !== to?.mode || g.to?.btn !== to?.btn) {
        if (isPager(g)) pagerDone(g.el); g.el.style.transform = ''; g.el.style.opacity = ''; g.el.style.willChange = '';
        dropGhost(g);
        g.to = to; g.el = moving(g) || screenEl(); g.el.style.willChange = 'transform';
        if (to?.go === 'mode') ghostFor(g);
      }
      if (!g.frame) g.frame = requestAnimationFrame(() => { if (!g) return; g.frame = 0; paint(g); });
    }
  };
  document.addEventListener('touchmove', (e) => move(e.touches[0]), { passive: true, capture: true });
  const end = () => {
    const d = g;
    g = null;
    if (!d?.el) return;
    if (d.mouse && Math.abs(d.dx) > 6) dragged = true;
    cancelAnimationFrame(d.frame);
    const fast = Math.abs(d.dx) > 40 && Math.abs(d.dx) / Math.max(1, Date.now() - d.t0) > 0.5;
    if (d.to && (Math.abs(d.dx) > Math.min(90, innerWidth * 0.25) || fast)) finish(d); else reset(d);
  };
  document.addEventListener('touchend', end, { passive: true, capture: true });
  // the same with a mouse (left button held, dragged sideways); the click after a drag is swallowed
  let dragged = false;
  document.addEventListener('mousedown', (e) => { if (e.button === 0 && !e.target.closest?.('input,textarea,select,[contenteditable]')) start(e.target, e.clientX, e.clientY, true); }, true);
  document.addEventListener('mousemove', (e) => { if (!g?.mouse) return; if (!(e.buttons & 1)) { end(); return; } move(e); if (g?.axis === 'x') e.preventDefault(); }, true);
  document.addEventListener('mouseup', () => { if (g?.mouse) end(); }, true);
  document.addEventListener('click', (e) => { if (dragged && e.isTrusted) { dragged = false; e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('mousedown', () => { dragged = false; }, true);
  document.addEventListener('touchcancel', () => { if (g?.el) reset(g); else settled(); g = null; }, { passive: true, capture: true });

  window.mzSwipeNav = { TABS, glide, takeShot, debugShot: () => backShot };
}
