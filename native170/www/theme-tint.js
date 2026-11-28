'use strict';
// 3.4.0 r13: every colour follows the theme. The app was drawn in 芋泥紫, and many places (search box, lines,
// shadows, the dark mode's backgrounds…) kept that purple written in. Those spots now read var(--tp-<hex>, <hex>);
// here each one is turned to the current theme's hue, keeping its lightness, so 芋泥紫 looks exactly as before.
{
  const COLORS = ["dbc7e9", "b599c9", "e6c8da", "0d0a12b8", "14101ab8", "14101c", "15121b", "16131b", "16131bcc", "17131d", "18151e", "1a1720ee", "1a1720f0", "1a1720f2", "1b1821", "1d1724", "1d1923", "1d192300", "1d1c24", "1e1a24", "1e1a25", "1f1b26", "1f1b26e8", "201c27", "201d27", "211b2a", "211c28", "221d29", "231d29", "231e2a", "241d2d", "241f2b", "251f2d", "252030", "26202e", "26212d", "2a2431", "2a2431cc", "2a2432", "2b2531", "2c2338", "2c2636", "2d2735", "2e2836", "2f2430", "332c3c", "352d3f", "3a3146", "3a3245", "3a3344", "3b264e55", "3b3446", "45305412", "4a4154", "51405f70", "51405f88", "51405fef", "5c3d6814", "71538a14", "76558f", "7955900c", "7b4f6b", "7f5af0", "7f5af00f", "7f5af012", "7f5af014", "7f768a", "80619a22", "80648d20", "89669a0a", "8a6a80", "8a7f93", "8b7cf647", "9a86a6", "9a8fa4", "9d93a8", "a07db333", "a080ba", "a274c0", "a2789a", "a398ac", "a7a0ae", "aa86bd20", "b6a9bf", "b88fc126", "b99bd8", "c2b6ca", "cfc7d3", "d9c5e7", "d9cedf", "dccce9", "dccff0", "ded7e3", "e5daee", "e8dfef", "eadcf3", "ece6f3", "ede7f080", "eee3f5", "eee4f4", "eee6f0", "eee7f0", "eee7f3", "efe2fb", "f1eaf4", "f7eff8"];
  const BASE = '#a080ba';
  const rgb = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  function hls(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return [0, l, 0];
    const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h / 6, l, s];
  }
  function back(h, l, s) {
    if (!s) return [l, l, l];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = (t) => { t = (t % 1 + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
  }
  const hex = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  function parse(c) {
    c = String(c || '').trim();
    let m = c.match(/^#([0-9a-f]{3})$/i); if (m) return m[1].split('').map((x) => x + x).join('');
    m = c.match(/^#([0-9a-f]{6})/i); if (m) return m[1];
    m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); if (m) return [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join('');
    return '';
  }
  const [h0, , s0] = hls(...rgb(BASE.slice(1)));
  let lastAccent = null;
  function tint() {
    const root = document.documentElement;
    const accent = parse(getComputedStyle(root).getPropertyValue('--accent')) || BASE.slice(1);
    if (accent === lastAccent) return;
    lastAccent = accent;
    const [ht, , st] = hls(...rgb(accent));
    // Dark mode needs a light "deep" colour (selected tabs, icons, links); the theme's own deep colour is dark.
    { const [r, g, b] = back(ht, 0.8, Math.min(st, 0.5)); root.style.setProperty('--mz-deep-dark', '#' + hex(r) + hex(g) + hex(b)); }
    const same = accent === BASE.slice(1) || (Math.abs(ht - h0) < 0.01 && Math.abs(st - s0) < 0.02);
    const k = Math.min(2.2, st / s0);
    for (const c of COLORS) {
      const name = '--tp-' + c;
      if (same) { root.style.removeProperty(name); continue; }
      const [h, l, s] = hls(...rgb(c));
      const [r, g, b] = back(h - h0 + ht, l, Math.min(1, s * k));
      root.style.setProperty(name, '#' + hex(r) + hex(g) + hex(b) + c.slice(6));
    }
  }
  window.mzThemeTint = () => { lastAccent = null; tint(); };
  if (typeof applyTheme === 'function') {
    const before = applyTheme;
    applyTheme = function (...args) { const r = before.apply(this, args); try { tint(); } catch {} return r; };
  }
  // A colour set elsewhere (custom themes, the official app's own palette) is caught too.
  try { new MutationObserver(() => { try { tint(); } catch {} }).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] }); } catch {}
  try { tint(); } catch {}
}
