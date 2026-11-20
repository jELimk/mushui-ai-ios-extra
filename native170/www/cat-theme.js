'use strict';
// 3.4.1: 貓咪 (Cats) theme. Follows the user's UI-review videos: warm neutrals (cream paper, warm brown text), ONE
// accent (an orange-cat terracotta) used only for actions and the current choice, one set of line icons (same size,
// same 1.8 line, same colour) drawn with little cat ears, capsule switches turned into underlined tabs, plain cards.
// Behind everything live the user's three cats, drawn once each as pictures (only the pictures move, transform only):
//  - 橘貓: a fluffy long-haired orange cat lying in a loaf, green eyes, big tail that sways, blinks now and then;
//  - 暹羅: a lynx-point Siamese (cream body, grey-brown points, striped tail, white paws) asleep, breathing;
//  - 虎斑: a brown tabby kitten sitting, amber eyes, tail swaying.
// Tap a cat: it hops and says 喵. Tap anywhere: a little paw print. Everything holds still in popups, calls and swipes.
// More cats can be added to CATS later.
{
  themes.cat = { name: '貓咪', accent: '#c4613f', deep: '#3d3129', soft: '#f5e6dc', pink: '#f8e3da', bg: '#f7f2ec', bubble: '#f6e2d4', cover: 'linear-gradient(135deg,#f6e7d8,#f3ddd0 55%,#ede4d6)' };
  const root = document.documentElement;
  const cur = () => { try { return (typeof draft !== 'undefined' && draft) || state.settings; } catch { return {}; } };
  const on = () => cur().theme === 'cat';
  const url = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  // a fluffy outline: an ellipse whose edge is made of small soft bumps (quadratic curves)
  const fluff = (cx, cy, rx, ry, n = 22, amp = 0.09, start = 0) => {
    let d = '';
    for (let i = 0; i <= n; i++) {
      const t = start + (i / n) * Math.PI * 2, x = cx + rx * Math.cos(t), y = cy + ry * Math.sin(t);
      if (!i) { d += `M${x.toFixed(1)} ${y.toFixed(1)}`; continue; }
      const tm = start + ((i - 0.5) / n) * Math.PI * 2, k = 1 + amp;
      d += `Q${(cx + rx * k * Math.cos(tm)).toFixed(1)} ${(cy + ry * k * Math.sin(tm)).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d + 'Z';
  };
  const SVG = (vb, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">${body}</svg>`;
  const L = (c) => `stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;

  // ---------- the cats, in the simple line style the user picked (thick round outline, tiny faces) ----------
  const INK = '#3b302b', SW = (w = 3.2) => `stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`, W3 = SW();
  const face = (cx, cy, eyes, s = 1) => {
    const e = eyes === 'dots' ? '' : eyes === 'happy'
      ? `<path d="M${cx - 17 * s} ${cy} q${6 * s} ${-6 * s} ${12 * s} 0 M${cx + 5 * s} ${cy} q${6 * s} ${-6 * s} ${12 * s} 0" fill="none" ${W3}/>`
      : `<path d="M${cx - 16 * s} ${cy} q${5 * s} ${4 * s} ${10 * s} 0 M${cx + 6 * s} ${cy} q${5 * s} ${4 * s} ${10 * s} 0" fill="none" ${W3}/>`;
    const n = cy + 9 * s;
    return e + `<path d="M${cx - 3 * s} ${n} h${6 * s} l${-3 * s} ${3.4 * s} Z" fill="${INK}" ${SW(1.6)}/>
<path d="M${cx} ${n + 3.4 * s} q${-3.5 * s} ${5 * s} ${-7.5 * s} ${1.2 * s} M${cx} ${n + 3.4 * s} q${3.5 * s} ${5 * s} ${7.5 * s} ${1.2 * s}" fill="none" ${SW(2.6)}/>
<path d="M${cx - 24 * s} ${n - 2 * s} h${-13 * s} M${cx - 24 * s} ${n + 4 * s} l${-12 * s} ${3 * s} M${cx + 24 * s} ${n - 2 * s} h${13 * s} M${cx + 24 * s} ${n + 4 * s} l${12 * s} ${3 * s}" fill="none" ${SW(2.4)}/>`;
  };
  // 1 · 橘貓, sitting (eyes on their own layer so they can blink; tail on its own layer so it can sway)
  const OC = { fur: '#f6b26b', stripe: '#e3913f', light: '#fbd9ae', ear: '#f5b3a0' };
  const orangeBody = SVG('0 0 120 140', `
<path d="M34 80 C27 96 27 118 29 133 L83 133 C85 118 85 96 78 80" fill="${OC.fur}" ${W3}/>
<path d="M46 98 C50 104 62 104 66 98 L66 133 L46 133 Z" fill="${OC.light}"/>
<path d="M47 104 V133 M65 104 V133" fill="none" ${W3}/>
<path d="M22 58 C20 44 22 30 26 17 L45 31 C52 29.5 60 29.5 67 31 L86 17 C90 30 92 44 90 58 C88 76 74 85 56 85 C38 85 24 76 22 58 Z" fill="${OC.fur}" ${W3}/>
<path d="M29 30 L31 23 L39 30 Z M83 30 L81 23 L73 30 Z" fill="${OC.ear}"/>
<path d="M50 36 l2 7 M56 34 v8 M62 36 l-2 7" fill="none" stroke="${OC.stripe}" stroke-width="3" stroke-linecap="round"/>
${face(56, 58, 'dots')}`);
  const orangeEyes = SVG('0 0 120 140', `<circle cx="45" cy="58" r="3.6" fill="${INK}"/><circle cx="67" cy="58" r="3.6" fill="${INK}"/><circle cx="46.2" cy="56.8" r="1.1" fill="#fff"/><circle cx="68.2" cy="56.8" r="1.1" fill="#fff"/>`);
  const orangeTail = SVG('0 0 60 60', `<path d="M6 52 C26 54 40 46 40 32 C40 22 33 18 28 24" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"/><path d="M6 52 C26 54 40 46 40 32 C40 22 33 18 28 24" fill="none" stroke="${OC.fur}" stroke-width="5" stroke-linecap="round"/>`);
  // 2 · 虎斑貓, peeking over the edge with both paws (happy closed eyes)
  const TC = { fur: '#c4ae90', stripe: '#6b5947', ear: '#e9b3a4', paw: '#d8c7ad' };
  const tabbyBody = SVG('0 0 150 96', `
<path d="M28 96 C24 72 26 54 33 43 L35 14 L59 31 C67 29 83 29 91 31 L115 14 L117 43 C124 54 126 72 122 96 Z" fill="${TC.fur}" ${W3}/>
<path d="M41 30 L42 22 L51 29 Z M109 30 L108 22 L99 29 Z" fill="${TC.ear}"/>
<path d="M67 37 l2 8 M75 35 v9 M83 37 l-2 8 M31 62 h9 M30 70 h8 M119 62 h-9 M120 70 h-8" fill="none" stroke="${TC.stripe}" stroke-width="3" stroke-linecap="round"/>
${face(75, 62, 'happy', 1.15)}
<path d="M40 96 c0 -11 6 -16 15 -16 c9 0 15 5 15 16 Z M80 96 c0 -11 6 -16 15 -16 c9 0 15 5 15 16 Z" fill="${TC.paw}" ${W3}/>
<path d="M50 96 v-6 M60 96 v-6 M90 96 v-6 M100 96 v-6" fill="none" ${SW(2.4)}/>`);
  // 3 · 暹羅貓, curled up asleep (cream with grey-brown ears, face and tail tip)
  const SC = { fur: '#f4ebe0', point: '#86766f', mask: '#a89890' };
  const siameseBody = SVG('0 0 170 100', `
<path d="M4 94 H164" fill="none" ${W3}/>
<path d="M52 94 C50 66 72 46 106 46 C136 46 158 64 158 82 C158 90 152 94 144 94 Z" fill="${SC.fur}" ${W3}/>
<path d="M158 82 C152 94 124 98 98 92" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
<path d="M158 82 C152 94 124 98 98 92" fill="none" stroke="${SC.fur}" stroke-width="6" stroke-linecap="round"/>
<path d="M104 93 C99 93 96 92 94 91" fill="none" stroke="${SC.point}" stroke-width="6" stroke-linecap="round"/>
<path d="M12 94 C8 78 12 64 19 56 L21 34 L38 47 C44 45 53 45 59 47 L75 36 L75 56 C80 64 82 79 78 94 Z" fill="${SC.fur}"/>
<path d="M12 94 C8 78 12 64 19 56 L21 34 L38 47 C44 45 53 45 59 47 L75 36 L75.5 50" fill="none" ${W3}/>
<path d="M24 47 L25 40 L32 45 Z M71 45 L71 40 L64 45 Z" fill="${SC.point}"/>
<ellipse cx="46" cy="78" rx="13" ry="10" fill="${SC.mask}" opacity=".45"/>
${face(46, 70, 'sleep', .9)}
<path d="M62 94 c0 -8 6 -12 12 -12 c7 0 12 4 12 12 Z" fill="${SC.fur}" ${W3}/>`);
  const tabbyEyes = '', siameseTail = '', tabbyTail = '';

  // where each cat lives (pictures sized in px), and how it moves
  const CATS = [
    { id: 'orange', w: 112, pos: 'left:7%;bottom:128px', body: orangeBody, eyes: orangeEyes, eyeY: 41.4, tail: orangeTail, tw: 46, tpos: 'left:58%;top:53%', tor: '8% 88%', say: ['喵~', '喵嗚', '咪？', '呼嚕嚕…'], sayEn: ['Meow~', 'Mrrow', 'Mew?', 'Purrr…'] },
    { id: 'tabby', w: 128, pos: 'right:18%;bottom:84px', body: tabbyBody, bob: true, say: ['喵！', '喵喵', '咪~', '（探頭）'], sayEn: ['Meow!', 'Mew mew', 'Mew~', '(peeks)'] },
    { id: 'siamese', w: 150, pos: 'right:3%;bottom:30%', body: siameseBody, breathe: true, say: ['呼嚕…', '（翻身）', '喵…zzz'], sayEn: ['Purr…', '(rolls over)', 'Mew…zzz'] },
  ];
  let yard = null;
  const build = () => {
    yard = document.createElement('div');
    yard.id = 'mz-cat-yard'; yard.setAttribute('aria-hidden', 'true');
    yard.innerHTML = CATS.map((c, k) => `<div class="mz-cat mz-cat-${c.id}" data-cat="${k}" style="${c.pos};width:${c.w}px">
${c.tail ? `<img class="mz-cat-tail" src="${url(c.tail)}" style="${c.tpos};width:${c.tw}px;transform-origin:${c.tor};animation-delay:${-k * 1.7}s" alt="" draggable="false">` : ""}
<div class="mz-cat-body${c.breathe ? ' breathe' : ''}${c.bob ? ' bob' : ''}"><img src="${url(c.body)}" alt="" draggable="false">${c.eyes ? `<img class="mz-cat-eyes" src="${url(c.eyes)}" style="transform-origin:50% ${c.eyeY}%;animation-delay:${-k * 2.3}s" alt="" draggable="false">` : ''}</div></div>`).join('');
    document.body.prepend(yard);
  };

  // ---------- one line-icon set with cat ears (24 × 24, line 1.8, currentColor) ----------
  const I = {
    chats: 'M5.2 9.3 5.8 4.6l3.5 2.6h5.4l3.5-2.6.6 4.7C20.2 10.3 21 11.6 21 13c0 3.6-4 6-9 6-1.2 0-2.3-.1-3.3-.4L5 20l.9-3.1C4.1 15.8 3 14.5 3 13c0-1.5.8-2.8 2.2-3.7Z',
    contacts: 'M5 11.5 5.6 4l4.2 3.4h4.4L18.4 4l.6 7.5c0 4.4-3.1 8-7 8s-7-3.6-7-8Z M9.3 12.4h.01 M14.7 12.4h.01 M11 15.2h2l-1 1Z',
    moments: 'M12 20c-3 0-5-1.6-5-3.8 0-2.3 2.3-4.6 5-4.6s5 2.3 5 4.6c0 2.2-2 3.8-5 3.8Z M6.2 10.6a1.7 2 0 1 0 .01 0Z M9.8 6.6a1.7 2.1 0 1 0 .01 0Z M14.2 6.6a1.7 2.1 0 1 0 .01 0Z M17.8 10.6a1.7 2 0 1 0 .01 0Z',
    music: 'M4 15.5V13a8 8 0 0 1 16 0v2.5 M4 14h3v6H5a1 1 0 0 1-1-1Z M20 14h-3v6h2a1 1 0 0 0 1-1Z M7.2 6.6 7 3.4l2.6 1.7 M16.8 6.6l.2-3.2-2.6 1.7',
    me: 'M7 10.5 7.4 4.2l3 2.4h3.2l3-2.4.4 6.3c0 2.9-2.2 5-5 5s-5-2.1-5-5Z M4.5 20.5c.8-2.6 3.9-4.2 7.5-4.2s6.7 1.6 7.5 4.2',
    coin: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17Z M12 16.5c-1.7 0-2.8-.9-2.8-2.1 0-1.3 1.3-2.6 2.8-2.6s2.8 1.3 2.8 2.6c0 1.2-1.1 2.1-2.8 2.1Z M8.6 10.6h.01 M10.6 8.4h.01 M13.4 8.4h.01 M15.4 10.6h.01',
    heart: 'M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z M6 6.2 6.5 3l2.6 2 M18 6.2 17.5 3l-2.6 2',
    note: 'M6 3.5h10.5a1.5 1.5 0 0 1 1.5 1.5v14.5a1.5 1.5 0 0 1-1.5 1.5H6Z M6 3.5v17 M9.5 8.5h5 M9.5 12h5 M9.5 15.5h3',
    sticker: 'M4.5 11.5 5.2 4l4 3.2h5.6l4-3.2.7 7.5c0 4.4-3.4 8-7.5 8s-7.5-3.6-7.5-8Z M9 13.2c.8.9 1.8 1.3 3 1.3s2.2-.4 3-1.3 M9.3 10.6h.01 M14.7 10.6h.01',
    gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z M19 13.5v-3l-2.1-.5-.6-1.4 1.1-1.9-2.1-2.1-1.9 1.1-1.4-.6L11.5 3h-3l-.5 2.1-1.4.6-1.9-1.1-2.1 2.1 1.1 1.9-.6 1.4L3 10.5v3l2.1.5.6 1.4-1.1 1.9 2.1 2.1 1.9-1.1 1.4.6.5 2.1h3l.5-2.1 1.4-.6 1.9 1.1 2.1-2.1-1.1-1.9.6-1.4Z',
    cal: 'M4 6.5h16v13.5H4Z M4 10.5h16 M8 3.5v5 M16 3.5v5 M8.5 14.5l2.3 2.3 4.7-4.6',
    paw: 'M12 20c-2.6 0-4.4-1.4-4.4-3.3 0-2 2-4 4.4-4s4.4 2 4.4 4c0 1.9-1.8 3.3-4.4 3.3Z M7 11.2a1.5 1.8 0 1 0 .01 0Z M10.2 7.6a1.5 1.9 0 1 0 .01 0Z M13.8 7.6a1.5 1.9 0 1 0 .01 0Z M17 11.2a1.5 1.8 0 1 0 .01 0Z',
  };
  const ico = (k) => `<svg class="icon mz-cat-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${I[k] || I.paw}"/></svg>`;
  const NAV = { chats: 'chats', contacts: 'contacts', moments: 'moments', music: 'music', settings: 'me' };
  const ROW = (el) => {
    const a = (el.dataset.action || '') + ' ' + (el.dataset.page || '') + ' ' + el.textContent;
    return /wallet|coin|沐水幣|支付/i.test(a) ? 'coin' : /favorite|收藏/i.test(a) ? 'heart' : /record|記錄/i.test(a) ? 'note' : /sticker|表情/i.test(a) ? 'sticker' : /todo|待辦/i.test(a) ? 'cal' : /setting|設定/i.test(a) ? 'gear' : 'paw';
  };
  const swapIcons = () => {
    if (!on()) return;
    document.querySelectorAll('#app .nav button[data-tab], .desktop-rail button[data-tab]').forEach((b) => {
      const k = NAV[b.dataset.tab]; if (!k) return;
      const box = b.querySelector('.nav-icon') || b, old = box.querySelector('svg:not(.mz-cat-ico)');
      if (old && !box.querySelector('.mz-cat-ico')) old.outerHTML = ico(k);
    });
    document.querySelectorAll('#app .wx-menu-row .wx-menu-icon:not(.mz-cat-done)').forEach((s) => { s.classList.add('mz-cat-done'); s.innerHTML = ico(ROW(s.closest('.wx-menu-row'))); });
  };
  const renderBefore = render;
  render = function (...a) { const r = renderBefore.apply(this, a); try { swapIcons(); } catch {} return r; };
  // 3.4.2: the desktop rail (and some bars) are redrawn outside render(); swap in the same step, before the screen is
  // painted (a MutationObserver runs before painting), so the plain icons never flash for a frame
  try {
    let queued = false;
    new MutationObserver((ms) => {
      if (queued) return;
      for (const m of ms) for (const n of m.addedNodes) {
        if (n.nodeType === 1 && (n.matches?.('.nav,.desktop-rail,.wx-menu-row,svg,.nav-icon,button') || n.querySelector?.('.nav-icon,.wx-menu-icon'))) {
          queued = true; queueMicrotask(() => { queued = false; try { swapIcons(); } catch {} }); return;
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  } catch {}


  const sync = () => {
    const v = on();
    root.classList.toggle('mz-cat', v);
    if (v && !yard) build();
    if (yard) yard.hidden = !v;
    if (v) swapIcons();
  };
  const before = applyTheme;
  applyTheme = function (...a) { const r = before.apply(this, a); try { sync(); } catch {} return r; };

  // ---------- taps: a paw print; a tapped cat hops and says something ----------
  const PAWS = url(SVG('0 0 24 24', `<path fill="#c4613f" fill-opacity=".55" d="M12 21c-2.8 0-4.8-1.5-4.8-3.6 0-2.2 2.2-4.4 4.8-4.4s4.8 2.2 4.8 4.4c0 2.1-2 3.6-4.8 3.6Zm-5-9.2a1.7 2 0 1 1 0-4 1.7 2 0 0 1 0 4Zm3.3-3.6a1.7 2.1 0 1 1 0-4.2 1.7 2.1 0 0 1 0 4.2Zm3.4 0a1.7 2.1 0 1 1 0-4.2 1.7 2.1 0 0 1 0 4.2Zm3.3 3.6a1.7 2 0 1 1 0-4 1.7 2 0 0 1 0 4Z"/>`));
  let fx = null;
  const PRESS = 'button,.pill,.chip,.icon-button,.swatch,.setting-row,.contact-row,.chat-row,.wx-menu-row,[data-action],[data-page],a';
  document.addEventListener('pointerdown', (e) => {
    if (!on() || e.button > 0) return;
    if (!fx || !fx.isConnected) { fx = document.createElement('div'); fx.id = 'mz-cat-fx'; document.body.append(fx); }
    while (fx.childElementCount > 6) fx.firstElementChild.remove();
    const p = document.createElement('img'); p.src = PAWS; p.alt = '';
    const rot = Math.round(Math.random() * 40 - 20);
    p.style.cssText = `left:${Math.round(e.clientX - 13)}px;top:${Math.round(e.clientY - 13)}px`;
    fx.append(p);
    const a = p.animate([{ transform: `rotate(${rot}deg) scale(.5)`, opacity: 0 }, { transform: `rotate(${rot}deg) scale(1)`, opacity: 1, offset: .25 }, { transform: `rotate(${rot}deg) scale(1)`, opacity: 0 }], { duration: 700, easing: 'ease-out', fill: 'both' });
    a.onfinish = a.oncancel = () => p.remove();
    if (!yard || yard.hidden || e.target.closest?.(PRESS + ',.card,.moment,.chat-entry,.bubble,input,textarea,.sheet')) return;
    for (const el of yard.querySelectorAll('.mz-cat')) {
      const r = el.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) continue;
      const c = CATS[Number(el.dataset.cat)], body = el.querySelector('.mz-cat-body');
      el._hop?.cancel(); // the whole cat hops (tail included)
      el._hop = el.animate([{ transform: 'translateY(0) scale(1,1)' }, { transform: 'translateY(0) scale(1.06,.92)', offset: .18 }, { transform: 'translateY(-14px) scale(.96,1.05)', offset: .45 }, { transform: 'translateY(0) scale(1.04,.96)', offset: .75 }, { transform: 'translateY(0) scale(1,1)' }], { duration: 700, easing: 'ease-out' });
      const say = document.createElement('span'); say.className = 'mz-cat-say'; const k = Math.floor(Math.random() * c.say.length); say.textContent = mzT(c.say[k], (c.sayEn || c.say)[k]);
      say.style.cssText = `left:${Math.round(r.left + r.width * .3)}px;top:${Math.round(r.top - 10)}px`;
      fx.append(say);
      const s = say.animate([{ transform: 'translateY(6px)', opacity: 0 }, { transform: 'translateY(-4px)', opacity: 1, offset: .2 }, { transform: 'translateY(-18px)', opacity: 0 }], { duration: 1400, easing: 'ease-out', fill: 'both' });
      s.onfinish = () => say.remove();
      break;
    }
  }, { capture: true, passive: true });

  const C = 'html.mz-cat:root', CL = 'html.mz-cat:not(.mz-dark):root', CD = 'html.mz-cat.mz-dark:root';
  const css = document.createElement('style');
  css.id = 'mz-cat-css';
  css.textContent = `
/* warm neutrals, one accent */
${CL}{--bg:#f7f2ec!important;--ink:#3d3129!important;--muted:#8c7a6b!important;--accent:#c4613f!important;--accent-deep:#9a4a2e!important;--line:#ebe1d6!important;--soft:#f5e9df!important;--pink:#f8e7de!important;--bubble:#f6e4d6!important;--surface:#fffdf9!important;--card:#fffdf9!important;color:#3d3129}
${CD}{--bg:#1b1612!important;--ink:#f2e8dd!important;--muted:#b5a291!important;--accent:#e8875f!important;--accent-deep:#f2b393!important;--line:#352c25!important;--soft:#2a221c!important;--pink:#33261f!important;--bubble:#3a2a20!important;--surface:#241d18!important;--card:#241d18!important;color:#f2e8dd}
/* minimal, like the end of the review video: plain warm off-white, white list cards, thin dividers, small labels */
${CL} body{background:#f4f0ea!important}${CD} body{background:#1b1612!important}
${C} #app,${C} .page,${C} .conversation{background:transparent!important}
${C} :is(.card,.wx-menu-group,.chat-entry,.soft-note){background:var(--surface)!important;border:0!important;border-radius:14px!important;box-shadow:0 1px 2px #6b4a330f,0 4px 14px -10px #6b4a3326!important}
${CL} :is(.card,.wx-menu-group,.chat-entry){background:#fffdf8!important}
${C} .chat-entry>.chat-row{padding:14px 4px 14px 14px!important}
${C} .chat-entry>.chat-menu-button{margin-right:10px!important}
${C} :is(.setting-row,.contact-row,.wx-menu-row):not(:last-child){border-bottom:1px solid var(--line)!important}
${C} :is(.card h3,.favorites-title,.eyebrow,.mz-todo-h b){font-size:11px!important;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)!important;font-weight:600}
${C} .help,${C} small{color:var(--muted)}
${CL} .sheet{background:#fffdf9!important}${CD} .sheet{background:#241d18!important}
/* the accent only on actions and the current choice */
${C} .primary,${C} .composer button[type=submit]{background:var(--accent)!important;color:#fff!important;border:0!important;box-shadow:0 8px 18px -10px #c4613fb3!important}
${CD} .primary,${CD} .composer button[type=submit]{color:#1b1612!important}
${C} .switch.on{background:var(--accent)!important}
${C} .mine .bubble{background:var(--bubble)!important;color:var(--ink)!important}
${C} .message .bubble:is(.sticker-only,.photo-only){background:transparent!important}
/* capsule switches become underlined tabs */
${C} :is(.contact-mode,.mz-segs){background:transparent!important;box-shadow:none!important;border:0!important;border-bottom:1px solid var(--line)!important;border-radius:0!important;padding:0!important}
${C} :is(.contact-mode>button,.mz-segs>.mz-seg){background:transparent!important;box-shadow:none!important;border-radius:0!important;color:var(--muted)!important;position:relative}
${C} :is(.contact-mode>button.selected,.mz-segs>.mz-seg.selected){color:var(--ink)!important;font-weight:700}
${C} :is(.contact-mode>button.selected,.mz-segs>.mz-seg.selected)::after{content:"";position:absolute;left:28%;right:28%;bottom:-1px;height:2px;border-radius:2px;background:var(--accent)}
${C} .contact-mode .mz-glider,${C} .mz-segs .mz-glider{display:none!important}
/* icons: one set, one size, one colour; in a soft rounded square in the Me menu */
${C} .mz-cat-ico{width:22px!important;height:22px!important;display:block;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
${C} .wx-menu-icon.mz-cat-done{display:inline-grid!important;place-items:center;width:34px;height:34px;border-radius:11px;background:var(--soft)!important;color:var(--accent-deep)!important;font-size:0}
${C} .nav button{color:var(--muted)!important}${C} .nav button.active{color:var(--accent)!important}
${C} .nav .nav-icon{background:transparent!important;box-shadow:none!important}
${C} .nav .nav-icon{position:relative}${C} .nav button.active .nav-icon::after{content:"";position:absolute;left:50%;bottom:-5px;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:var(--accent)}
/* the cats, behind everything */
#mz-cat-yard{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;contain:strict}
#mz-cat-yard[hidden]{display:none}
.mz-cat{position:absolute;opacity:.95;transform-origin:50% 100%}
html.mz-dark .mz-cat{opacity:.8;filter:brightness(.82)}
.mz-cat img{display:block;width:100%;height:auto;user-select:none;-webkit-user-drag:none}
.mz-cat-body{position:relative;transform-origin:50% 100%;will-change:transform}
.mz-cat-body.breathe{animation:mz-cat-breathe 3.6s ease-in-out infinite}
.mz-cat-body.bob{animation:mz-cat-bob 5s ease-in-out infinite}
@keyframes mz-cat-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px) rotate(-1.5deg)}}
.mz-cat-eyes{position:absolute;inset:0;will-change:transform;animation:mz-cat-blink 6.5s infinite}
.mz-cat-tail{position:absolute;will-change:transform;animation:mz-cat-tail 4.2s ease-in-out infinite}
.mz-cat-orange .mz-cat-tail{z-index:-1}.mz-cat-siamese .mz-cat-tail{z-index:1}.mz-cat-tabby .mz-cat-tail{z-index:-1}
@keyframes mz-cat-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}}
@keyframes mz-cat-tail{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(7deg)}}
@keyframes mz-cat-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.012,1.03)}}
.mz-cat-siamese .mz-cat-tail{animation:mz-cat-tail-s 6s ease-in-out infinite}@keyframes mz-cat-tail-s{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2.5deg)}}
@media(prefers-reduced-motion:reduce){.mz-cat *{animation:none!important}}
html.mz-swiping #mz-cat-yard *,body:has(#overlay .modal-backdrop) #mz-cat-yard *,body:has(.call-overlay.mz-call:not(.mz-min)) #mz-cat-yard *{animation-play-state:paused!important}
#mz-cat-fx{position:fixed;inset:0;pointer-events:none;z-index:2147483600;overflow:hidden;contain:strict}
#mz-cat-fx img{position:absolute;width:26px;height:26px;opacity:0;will-change:transform,opacity}
html.mz-dark #mz-cat-fx img{filter:brightness(1.4)}
.mz-cat-say{position:absolute;padding:4px 10px;border-radius:12px;background:var(--surface,#fff);color:var(--accent-deep);font-size:13px;font-weight:700;box-shadow:0 6px 16px -8px #6b4a3380;white-space:nowrap}
/* the theme's swatch: a cat face on cream */
.swatch[data-theme=cat] span{background:url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect width='40' height='40' fill='%23fbf3e6'/><path d='M7 31 C5 25 6 18 8 12 L10 5 L16.5 11 C18.8 10.4 21.2 10.4 23.5 11 L30 5 L32 12 C34 18 35 25 33 31 C30 35 25 36.5 20 36.5 C15 36.5 10 35 7 31 Z' fill='%23f6b26b' stroke='%233b302b' stroke-width='2.2' stroke-linejoin='round'/><path d='M11 12 L12 8 L14.5 11 Z M29 12 L28 8 L25.5 11 Z' fill='%23f5b3a0'/><path d='M18 14 l.8 3 M20 13.5 v3.4 M22 14 l-.8 3' stroke='%23e3913f' stroke-width='1.6' stroke-linecap='round'/><circle cx='14.5' cy='22' r='1.9' fill='%233b302b'/><circle cx='25.5' cy='22' r='1.9' fill='%233b302b'/><path d='M18.6 25.6 h2.8 l-1.4 1.6 Z' fill='%233b302b'/><path d='M20 27.2 q-1.6 2.2 -3.4 .6 M20 27.2 q1.6 2.2 3.4 .6' fill='none' stroke='%233b302b' stroke-width='1.3' stroke-linecap='round'/></svg>") center/cover no-repeat!important;border:1px solid #3b302b33!important}
`;
  document.head.append(css);
  sync();
  try { new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['style'] }); } catch {}
  window.mzCat = { on, sync, CATS };
}
