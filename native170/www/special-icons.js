'use strict';
// 3.4.1: the special themes each get their own line-icon set (like the cat theme): same 24 × 24 grid, same 1.8
// line, one colour, for the five bottom tabs and the Me menu.
//  - 海月水母: ocean icons — a jellyfish-bell speech bubble, a jellyfish face, a starfish, a shell with a note,
//    a little jellyfish person, a pearl, a ship's wheel…
//  - 液態玻璃: crystal icons — faceted, with a small sparkle (✦) of light on each.
{
  const SETS = {
    jelly: {
      chats: 'M4 12a8 7 0 0 1 16 0v1.5H4Z M7 13.5c0 2 1 3.2-.5 5 M12 13.5c0 2.2-1 3.5 0 5.5 M17 13.5c0 2 1 3.2-.5 5 M9 9.5h.01 M15 9.5h.01',
      contacts: 'M3 12a4.5 4 0 0 1 9 0Z M5 12v4 M7.5 12v5 M10 12v4 M12 10a4.5 4 0 0 1 9 0Z M14 10v4 M16.5 10v5 M19 10v4',
      moments: 'M12 3.5l2.3 5.1 5.4.5-4.1 3.6 1.2 5.4L12 15.3l-4.8 2.8 1.2-5.4-4.1-3.6 5.4-.5Z',
      music: 'M5 19.5c-1.2-4.6 1.3-11 7-11s8.2 6.4 7 11Z M8 19.5 10 9 M12 19.5V8.5 M16 19.5 14 9 M15.5 4.5v-2l3 1',
      me: 'M7 9.5a5 4.5 0 0 1 10 0v1H7Z M9.5 10.5c0 1.5.5 2.5-.4 4 M14.5 10.5c0 1.5-.5 2.5.4 4 M4.5 21c1-3 4-4.5 7.5-4.5s6.5 1.5 7.5 4.5',
      coin: 'M3.5 14c0-4.7 3.8-8.5 8.5-8.5s8.5 3.8 8.5 8.5Z M3.5 14l2 5h13l2-5 M12 11.5a2 2 0 1 0 .01 0Z',
      heart: 'M12 20s-7-4.2-7-9.4A3.9 3.9 0 0 1 12 8.5a3.9 3.9 0 0 1 7 2.1C19 15.8 12 20 12 20Z M17.5 4.5a1.2 1.2 0 1 0 .01 0Z M20 2.8h.01',
      note: 'M6 3.5h12v17H6Z M9 8.5c1-1 2-1 3 0s2 1 3 0 M9 12.5c1-1 2-1 3 0s2 1 3 0 M9 16.5h4',
      sticker: 'M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0Z M8.5 13.5c1.8 2 5.2 2 7 0 M9 10h.01 M15 10h.01 M18.2 3.5a1.3 1.3 0 1 0 2.6 0a1.3 1.3 0 1 0-2.6 0Z',
      gear: 'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Z M12 2v2.5 M12 19.5V22 M2 12h2.5 M19.5 12H22 M4.9 4.9l1.8 1.8 M17.3 17.3l1.8 1.8 M4.9 19.1l1.8-1.8 M17.3 6.7l1.8-1.8',
      cal: 'M4 6.5h16v13.5H4Z M4 10.5h16 M8 3.5v5 M16 3.5v5 M7 15c1.2-1.2 2.3-1.2 3.5 0s2.3 1.2 3.5 0 2.3-1.2 3.5 0',
      other: 'M12 6a4 4 0 1 0 .01 0Z M6 16a2.5 2.5 0 1 0 .01 0Z M17.5 15.5a1.5 1.5 0 1 0 .01 0Z',
    },
    glass: {
      chats: 'M4 11c0-3.9 3.6-6.5 8-6.5s8 2.6 8 6.5-3.6 6.5-8 6.5c-1 0-2-.1-2.9-.4L5 19l1.1-3.2C4.8 14.5 4 12.9 4 11Z M8 9.5l2.5-2.5 M18.5 3l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L17 5l1.5-.5Z',
      contacts: 'M12 3.5 16 6v4.5l-4 2.5-4-2.5V6Z M8 6l4 2.5L16 6 M12 8.5V13 M5 20.5c.8-3 3.6-4.8 7-4.8s6.2 1.8 7 4.8',
      moments: 'M12 3 21 12 12 21 3 12Z M12 3v18 M3 12h18 M7.5 7.5l9 9',
      music: 'M9 18V6l10-2v12 M6.5 15.5a2.5 2 0 1 0 .01 0Z M16.5 13.5a2.5 2 0 1 0 .01 0Z M4 3l.4 1.2 1.2.4-1.2.4L4 6.2l-.4-1.2L2.4 4.6l1.2-.4Z',
      me: 'M12 3 15.5 6.5 12 10 8.5 6.5Z M5 20.5c.8-3.2 3.6-5.2 7-5.2s6.2 2 7 5.2 M19 9l.4 1.1 1.1.4-1.1.4L19 12l-.4-1.1-1.1-.4 1.1-.4Z',
      coin: 'M7 4h10l3.5 5L12 20 3.5 9Z M3.5 9h17 M9.5 4 8 9l4 11 4-11-1.5-5',
      heart: 'M12 20.5 4.2 12.6a4.6 4.6 0 0 1 7.8-4.9 4.6 4.6 0 0 1 7.8 4.9Z M12 7.7v12.8 M4.2 12.6 12 14.2l7.8-1.6 M19 2.6l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5Z',
      note: 'M6 3.5h12a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z M8.5 3.5 5 7 M9 11h6 M9 14.5h4',
      sticker: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z M8.5 14c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2 M9 9.5h.01 M15 9.5h.01 M4 8l4-4',
      gear: 'M12 2.5 20.2 7.2v9.6L12 21.5l-8.2-4.7V7.2Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
      cal: 'M4 6.5h16v13.5H4Z M4 10.5h16 M8 3.5v5 M16 3.5v5 M12 13l.7 1.8 1.8.7-1.8.7L12 18l-.7-1.8-1.8-.7 1.8-.7Z',
      other: 'M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6Z',
    },
    cyber: {
      chats: 'M4 5h16v10H11l-4 4v-4H4Z M7 9h6 M7 12h9 M17 5l3 3',
      contacts: 'M12 3l5 3v5l-5 3-5-3V6Z M12 8.5v2 M4 21l3-5h10l3 5 M9 16l3 3 3-3',
      moments: 'M12 3v4 M12 17v4 M3 12h4 M17 12h4 M7 7l2 2 M15 15l2 2 M17 7l-2 2 M7 17l2-2 M12 9.5a2.5 2.5 0 1 0 .01 0Z',
      music: 'M9 17V5l10-2v12 M5 17h4v4H5Z M15 15h4v4h-4Z M3 9h2 M3 12h3',
      me: 'M6 10a6 6 0 0 1 12 0v3H6Z M6 11.5h12 M9 11.5v1.5 M15 11.5v1.5 M5 21l2-5h10l2 5',
      coin: 'M12 3l7 4v10l-7 4-7-4V7Z M12 8v8 M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4',
      heart: 'M12 20l-8-8 3-4h3l2 2 2-2h3l3 4Z M4 12h4l1.5-2 2 4 1.5-2H20',
      note: 'M5 3h10l4 4v14H5Z M15 3v4h4 M8 11l2 2-2 2 M12 15h4',
      sticker: 'M4 4h16v16H4Z M8 9h2v2H8Z M14 9h2v2h-2Z M8 15h8 M4 8h2 M18 16h2',
      gear: 'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z M12 9l3 3-3 3-3-3Z',
      cal: 'M3 6h18v15H3Z M3 10h18 M8 3v5 M16 3v5 M7 14h3v3H7Z M14 14h3',
      other: 'M12 3v5 M12 16v5 M3 12h5 M16 12h5 M9 9h6v6H9Z',
    },
  };
  const root = document.documentElement;
  const which = () => (root.classList.contains('mz-cyber') ? 'cyber' : root.classList.contains('mz-jelly') ? 'jelly' : root.classList.contains('mz-glass') && ((typeof draft !== 'undefined' && draft) || state.settings).theme === 'glass' ? 'glass' : '');
  const ico = (set, k) => `<svg class="icon mz-sp-ico" data-set="${set}" viewBox="0 0 24 24" aria-hidden="true"><path d="${SETS[set][k] || SETS[set].other}"/></svg>`;
  const NAV = { chats: 'chats', contacts: 'contacts', moments: 'moments', music: 'music', settings: 'me' };
  const rowKind = (el) => {
    const a = (el?.dataset.action || '') + ' ' + (el?.dataset.page || '') + ' ' + (el?.textContent || '');
    return /wallet|coin|沐水幣|支付/i.test(a) ? 'coin' : /favorite|收藏/i.test(a) ? 'heart' : /record|記錄/i.test(a) ? 'note' : /sticker|表情/i.test(a) ? 'sticker' : /todo|待辦/i.test(a) ? 'cal' : /setting|設定/i.test(a) ? 'gear' : 'other';
  };
  const swap = () => {
    const set = which(); if (!set) return;
    document.querySelectorAll('#app .nav button[data-tab], .desktop-rail button[data-tab]').forEach((b) => {
      const k = NAV[b.dataset.tab]; if (!k) return;
      const box = b.querySelector('.nav-icon') || b, cur = box.querySelector('svg');
      if (cur && cur.dataset.set !== set) cur.outerHTML = ico(set, k);
    });
    document.querySelectorAll('#app .wx-menu-row .wx-menu-icon').forEach((s) => {
      if (s.dataset.spset === set) return;
      if (!s.dataset.orig) s.dataset.orig = s.innerHTML;
      s.dataset.spset = set; s.classList.add('mz-sp-done'); s.innerHTML = ico(set, rowKind(s.closest('.wx-menu-row')));
    });
  };
  const renderBefore = render;
  render = function (...a) { const r = renderBefore.apply(this, a); try { swap(); } catch {} return r; };
  const applyBefore = applyTheme;
  applyTheme = function (...a) { const r = applyBefore.apply(this, a); try { setTimeout(swap, 0); } catch {} return r; };

  // 3.4.2: the desktop rail (and some bars) are redrawn outside render(); swap in the same step, before the screen is
  // painted (a MutationObserver runs before painting), so the plain icons never flash for a frame
  try {
    let queued = false;
    new MutationObserver((ms) => {
      if (queued) return;
      for (const m of ms) for (const n of m.addedNodes) {
        if (n.nodeType === 1 && (n.matches?.('.nav,.desktop-rail,.wx-menu-row,svg,.nav-icon,button') || n.querySelector?.('.nav-icon,.wx-menu-icon'))) {
          queued = true; queueMicrotask(() => { queued = false; try { swap(); } catch {} }); return;
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  } catch {}
  const css = document.createElement('style');
  css.textContent = `
.wx-menu-icon .mz-sp-ico,.nav .mz-sp-ico,.mz-sp-ico{width:22px!important;height:22px!important;display:block;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
html.mz-jelly .wx-menu-icon.mz-sp-done,html.mz-glass .wx-menu-icon.mz-sp-done{display:inline-grid!important;place-items:center;width:34px;height:34px;border-radius:11px;font-size:0}
html.mz-jelly:not(.mz-dark) .wx-menu-icon.mz-sp-done{background:#e3f2fc!important;color:#0e7ab8!important}
html.mz-jelly.mz-dark .wx-menu-icon.mz-sp-done{background:#00e5ff1a!important;color:#64ffda!important;box-shadow:0 0 10px #00ffff26}
html.mz-glass:not(.mz-jelly):not(.mz-dark) .wx-menu-icon.mz-sp-done{background:linear-gradient(145deg,#ffffffe6,#ffffff80)!important;color:#1f1f24!important;box-shadow:inset 0 1px 1px #fff,0 2px 8px -3px #0002}
html.mz-glass:not(.mz-jelly).mz-dark .wx-menu-icon.mz-sp-done{background:#ffffff14!important;color:#f2f2f6!important;box-shadow:inset 0 1px 0 #ffffff33}
`;
  document.head.append(css);
  setTimeout(swap, 0);
}
