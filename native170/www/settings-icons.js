'use strict';
// 3.4.3: every row on the settings home has its own icon (no two alike), and each special theme has its own set:
// normal themes (line icons), 海月水母 (sea things), 液態玻璃 (faceted crystals with a sparkle), 貓咪 (cat things).
// Same 24 x 24 grid and line as the other icon sets. Rows are matched by data-page / data-action.
{
  const C = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
  const SP = (x, y) => `M${x} ${y - 1.7}l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5Z`;
  const CAT = 'M5 10V4.5l3.8 2.8a8 8 0 0 1 6.4 0L19 4.5V10a7 7 0 1 1-14 0Z';
  const SETS = {
    base: {
      language: C(12, 12, 9) + ' M3 12h18 M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9 M12 3c-2.5 2.6-3.8 5.6-3.8 9s1.3 6.4 3.8 9',
      api: 'M7 7h10v10H7Z M10 10h4v4h-4Z M9.5 3v4 M14.5 3v4 M9.5 17v4 M14.5 17v4 M3 9.5h4 M3 14.5h4 M17 9.5h4 M17 14.5h4',
      memory: 'M9 3a4 4 0 0 0-4 4v1a4 4 0 0 0-2 7 4 4 0 0 0 6 5V3 M15 3a4 4 0 0 1 4 4v1a4 4 0 0 1 2 7 4 4 0 0 1-6 5V3 M5 9h4 M15 14h4',
      life: 'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9 M12 3v6l5-3 M21 12h-6l3 5 M12 21v-6l-5 3 M3 12h6L6 7',
      appearance: 'M12 3a9 9 0 0 0 0 18h2a2 2 0 0 0 1-4c-1-1 1-2 3-2 5 0 4-12-6-12 M7 9h.01 M10 6h.01 M15 7h.01 M6 13h.01',
      chat: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H5l-3 2v-6a8.5 8.5 0 1 1 19-4.5Z M7 10h.01 M12 10h.01 M17 10h.01',
      notifications: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15Z M10 20.5a2 2 0 0 0 4 0 M12 3v2',
      coins: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4Z M15.5 9a4 4 0 0 1 0 6 M18 6.5a7.5 7.5 0 0 1 0 11',
      privacy: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z M12 15v2.5',
      devices: 'M3 5h13v9H3Z M7 18h5 M9.5 14v4 M17.5 9h3.5v11h-3.5Z M19.2 17.5h.01',
      humanAccount: 'M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2 M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 8v8 M16 12h8',
      backup: 'M4 4h16v4H4Z M5.5 8v12h13V8 M12 11v6 M9.5 14.5 12 17l2.5-2.5',
      about: C(12, 12, 9) + ' M12 11v6 M12 7.5h.01',
    },
    jelly: {
      language: C(12, 12, 8.5) + ' M3.8 10c2.7 1.5 5.5 1.5 8.2 0s5.5-1.5 8.2 0 M3.8 14.5c2.7 1.5 5.5 1.5 8.2 0s5.5-1.5 8.2 0',
      api: 'M10 21l1-12h2l1 12Z M9 9h6 M10.5 9V6.5h3V9 M12 6.5V4 M8 6 5 5 M16 6l3-1 M7 21h10',
      memory: 'M4 15a8 8 0 0 1 16 0Z M12 7v8 M8.2 8.2 9.8 15 M15.8 8.2 14.2 15 M3 15h18 ' + C(12, 18.5, 1.6),
      life: 'M3 12c3-4.5 8.5-5.5 13 0-4.5 5.5-10 4.5-13 0Z M16 12l5-3.5v7Z M7.5 11h.01',
      appearance: 'M12 21v-7 M12 14c-3 0-4-2.5-4-5V5.5 M8 9c-2 0-3-1.5-3-3.5 M12 14c3 0 4-2.5 4-5V4.5 M16 9c2 0 3-1.5 3-3.5 M8 21h8',
      chat: C(8, 13, 4.5) + ' ' + C(16.5, 7, 3) + ' ' + C(17.5, 16.5, 2) + ' M6.5 11.5a2 2 0 0 1 2-1.5',
      notifications: 'M12 3c-4 3-6 7-6 11h12c0-4-2-8-6-11Z M6 14l-1.5 3h15L18 14 M10 17.5a2 2 0 0 0 4 0 M9.5 9.5h5',
      coins: 'M3 15a7 7 0 0 1 7-7v7Z M3 15h7 M6.5 15v-6 M14 9.5c1.3 1.6 1.3 3.4 0 5 M17 7c2.7 2.8 2.7 7.2 0 10',
      privacy: 'M4 11h16v9H4Z M4 11c0-3.3 3.6-6 8-6s8 2.7 8 6 M4 14.5h16 M11 13.5h2v3h-2Z',
      devices: C(12, 12, 8.5) + ' ' + C(12, 12, 5) + ' M12 3.5v2 M12 18.5v2 M3.5 12h2 M18.5 12h2',
      humanAccount: C(12, 5, 2) + ' M12 7v14 M8 11h8 M4.5 14c0 4 3.4 7 7.5 7s7.5-3 7.5-7 M4.5 14 3 15.5 M19.5 14l1.5 1.5',
      backup: 'M10 3h4v3l2.5 3v12h-9V9L10 6Z M10 6h4 M9.5 13h5 M9.5 16h3',
      about: C(11, 13, 7.5) + ' M11 12v4.5 M11 9.5h.01 ' + C(19.5, 4.5, 1.5),
    },
    glass: {
      language: C(12, 12, 8.5) + ' M3.5 12h17 M12 3.5 8.5 12l3.5 8.5 3.5-8.5Z ' + SP(19.5, 4),
      api: 'M12 3l9 9-9 9-9-9Z M12 8l4 4-4 4-4-4Z M12 3v5 M12 16v5 M3 12h5 M16 12h5',
      memory: C(12, 10, 6.5) + ' M7 20.5h10l-1.5-3.2h-7Z M9 7.5l2-1.5 ' + SP(19.5, 4.5),
      life: 'M12 3l2.6 5.8 6.4.7-4.8 4.3 1.4 6.2L12 16.8 6.4 20l1.4-6.2L3 9.5l6.4-.7Z M12 3v13.8 M3 9.5l9 7.3 9-7.3',
      appearance: 'M9 4l6.5 13H2.5Z M15.5 17 21 14 M14 13.5l7-3.5 M12.6 10.5 20 6.5',
      chat: 'M4 5h16v10.5h-9L6 19.5v-4H4Z M4 5l8 5.5L20 5 ' + SP(19.5, 19),
      notifications: 'M12 3l5 4v7l2 3H5l2-3V7Z M7 7h10 M12 3v14 M10 20.5h4',
      coins: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4Z M15.5 9a4 4 0 0 1 0 6 ' + SP(19, 6) + ' ' + SP(19.5, 17),
      privacy: 'M7.5 11V8a4.5 4.5 0 0 1 9 0v3 M5 11h14l-2 9.5H7Z M5 11l7 4 7-4 M12 15v5.5',
      devices: 'M3 4.5h18v11H3Z M3 4.5l9 5.5 9-5.5 M9 20h6 M12 15.5V20',
      humanAccount: 'M12 3l3.5 2v4L12 11 8.5 9V5Z M4.5 20.5l2-5h11l2 5Z M6.5 15.5l5.5 5 5.5-5',
      backup: 'M12 3l8 4.5v9L12 21l-8-4.5v-9Z M4 7.5l8 4.5 8-4.5 M12 12v9',
      about: 'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9Z M12 11v5 M12 8h.01',
    },
    cat: {
      language: CAT + ' M5.2 13h13.6 M12 7.5c1.8 2 1.8 10.5 0 12.5 M12 7.5c-1.8 2-1.8 10.5 0 12.5',
      api: C(11, 12, 8) + ' M4.5 8.5c4 0 9 2 12 8 M7 5c3 2 6 6 7 14 M3.5 14c3-1 7 0 10 4.5 M19 17.5l3 2.5',
      memory: C(12, 15.5, 3.8) + ' ' + C(6.5, 10, 1.6) + ' ' + C(9.8, 6, 1.6) + ' ' + C(14.2, 6, 1.6) + ' ' + C(17.5, 10, 1.6),
      life: 'M6 12h12 M18 12l3-3.2 M18 12l3 3.2 M8.5 9v6 M11.5 8v8 M14.5 9v6 ' + C(4.2, 12, 1.8),
      appearance: 'M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 1-3.7c-1-1 0-2.3 2-2.3H18a3 3 0 0 0 3-3c0-5-4-9-9-9Z ' + C(8, 13, 1.6) + ' M6.5 9.5h.01 M9 7h.01 M11.5 9h.01',
      chat: 'M4 8l1-4 3 2h8l3-2 1 4v7a3 3 0 0 1-3 3h-7l-4 3v-3a2 2 0 0 1-2-2Z M9 11h.01 M15 11h.01 M10.8 13.5c.7.6 1.7.6 2.4 0',
      notifications: C(12, 14.5, 6) + ' M6 14.5h12 M12 14.5v3 M11 17.8h2 M4 8.5l3-1 M20 8.5l-3-1 M12 3.5v5',
      coins: 'M3 11V6.5l2.5 1.8h3L11 6.5V11a4 4 0 0 1-8 0Z M6 11h.01 M8 11h.01 M14.5 9c1.3 1.5 1.3 3.5 0 5 M17.5 6.5c2.7 2.8 2.7 7.2 0 10',
      privacy: 'M7 11V8a5 5 0 0 1 10 0v3 M7.6 5.5 6.5 2.5l3 1.4 M16.4 5.5l1.1-3-3 1.4 M5 11h14v10H5Z M12 15v2.5',
      devices: 'M3 12h18l-2 8.5H5Z M3 12l3-3h12l3 3 M8 9V5.5l2 1.5h4l2-1.5V9 M10.5 7.8h.01 M13.5 7.8h.01',
      humanAccount: 'M8 4v4 M8 4l2.5 2h3L16 4v4 M8 8a4 4 0 0 0 8 0 M7 21c0-5 2-8.5 5-8.5s5 3.5 5 8.5Z M17 20c2 0 3.5-1 3.5-3.5',
      backup: 'M4 10l3-6 2.5 3h5L17 4l3 6v10H4Z M12 10v6.5 M9.5 14 12 16.5l2.5-2.5',
      about: CAT + ' M12 12.5v4.5 M12 10h.01',
    },
    cyber: {
      language: 'M12 3a9 9 0 1 0 .01 0Z M3 12h18 M12 3v18 M5.5 6.5h13 M5.5 17.5h13 M20 3l1 1',
      api: 'M6 6h12v12H6Z M9 9h6v6H9Z M9 2v4 M15 2v4 M9 18v4 M15 18v4 M2 9h4 M2 15h4 M18 9h4 M18 15h4',
      memory: 'M4 6h16v12H4Z M4 10h16 M4 14h16 M8 6v12 M16 6v12 M2 4l2 2',
      life: 'M3 12h4l2-5 3 10 2-6 2 3h5 M3 4v3 M21 17v3',
      appearance: 'M12 3l9 5v8l-9 5-9-5V8Z M12 3v18 M3 8l9 5 9-5',
      chat: 'M4 5h16v10H11l-4 4v-4H4Z M7 9h2 M11 9h2 M15 9h2',
      notifications: 'M7 16V10a5 5 0 0 1 10 0v6l2 2H5Z M10 21h4 M3 6l2 2 M21 6l-2 2',
      coins: 'M3 9h4l5-4v14l-5-4H3Z M15 9v6 M18 7v10 M21 10v4',
      privacy: 'M7 10V7a5 5 0 0 1 10 0v3 M5 10h14v11H5Z M12 14v3 M3 10l2-2 M21 10l-2-2',
      devices: 'M3 4h13v10H3Z M7 18h5 M9.5 14v4 M18 8h3v12h-3Z M2 2l2 2',
      humanAccount: 'M9 3l4 2.3v4.4L9 12 5 9.7V5.3Z M2 21l2-5h10l2 5 M19 8v6 M16 11h6',
      backup: 'M4 4h16v5H4Z M5 9v11h14V9 M12 12v6 M9 15l3 3 3-3 M17 6h1',
      about: 'M4 4h16v16H4Z M12 10v6 M12 7h.01 M4 8h2 M18 16h2',
    },
  };
  const root = document.documentElement;
  const which = () => {
    if (root.classList.contains('mz-cyber')) return 'cyber';
    if (root.classList.contains('mz-cat')) return 'cat';
    if (root.classList.contains('mz-jelly')) return 'jelly';
    const t = ((typeof draft !== 'undefined' && draft) || (typeof state !== 'undefined' && state?.settings) || {}).theme;
    if (root.classList.contains('mz-glass') && t === 'glass') return 'glass';
    return 'base';
  };
  const swap = () => {
    const set = which(), icons = SETS[set];
    document.querySelectorAll('#app .setting-row').forEach((b) => {
      const k = b.dataset.page || b.dataset.action, d = icons[k];
      const span = b.querySelector(':scope > .setting-icon');
      if (!d || !span || span.dataset.si === set + k) return;
      span.dataset.si = set + k;
      span.innerHTML = `<svg class="icon mz-si" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"></path></svg>`;
    });
  };
  const before = render;
  render = function (...a) { const r = before.apply(this, a); try { swap(); } catch {} return r; };
  try {
    new MutationObserver(() => { try { swap(); } catch {} }).observe(document.querySelector('#app'), { childList: true, subtree: true });
    new MutationObserver(() => { try { swap(); } catch {} }).observe(root, { attributes: true, attributeFilter: ['class'] });
  } catch {}
  window.mzSettingsIcons = { SETS, swap };
}
