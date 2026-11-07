'use strict';
// 3.2.1: older iPhones (iOS 14 to 16). Loaded first. Fills in what their WebKit lacks; on a current system
// every check below finds the real feature and this file does nothing. Add ?legacy=1 to the page URL to
// force the stylesheet rewrite on a modern browser when testing it.
(function () {
  /* ---- JavaScript ---- */
  if (!window.structuredClone) {
    window.structuredClone = function (value) {
      const seen = new WeakMap();
      const copy = (v) => {
        if (v === null || typeof v !== 'object') return v;
        if (seen.has(v)) return seen.get(v);
        if (v instanceof Date) return new Date(v.getTime());
        if (v instanceof RegExp) return new RegExp(v.source, v.flags);
        if (v instanceof ArrayBuffer) return v.slice(0);
        if (ArrayBuffer.isView(v)) return new v.constructor(v.buffer.slice(0), v.byteOffset, v.length);
        if (typeof Blob !== 'undefined' && v instanceof Blob) return v;
        if (v instanceof Map) { const m = new Map(); seen.set(v, m); v.forEach((x, k) => m.set(copy(k), copy(x))); return m; }
        if (v instanceof Set) { const s = new Set(); seen.set(v, s); v.forEach((x) => s.add(copy(x))); return s; }
        const out = Array.isArray(v) ? [] : {};
        seen.set(v, out);
        for (const k of Object.keys(v)) out[k] = copy(v[k]);
        return out;
      };
      return copy(value);
    };
  }
  if (window.crypto && !crypto.randomUUID) {
    crypto.randomUUID = function () {
      const b = crypto.getRandomValues(new Uint8Array(16));
      b[6] = (b[6] & 15) | 64;
      b[8] = (b[8] & 63) | 128;
      const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
      return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
    };
  }
  const at = function (n) {
    n = Math.trunc(n) || 0;
    if (n < 0) n += this.length;
    return n < 0 || n >= this.length ? undefined : this[n];
  };
  for (const type of [Array, String, Object.getPrototypeOf(Int8Array)])
    if (!type.prototype.at) Object.defineProperty(type.prototype, 'at', { value: at, writable: true, configurable: true });
  if (!Object.hasOwn) Object.hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  if (!window.AudioContext && window.webkitAudioContext) window.AudioContext = window.webkitAudioContext;
  if (!window.BroadcastChannel) {
    window.BroadcastChannel = class { constructor() { this.onmessage = null; } postMessage() {} close() {} addEventListener() {} removeEventListener() {} };
  }

  /* ---- Stylesheets ---- */
  const force = /[?&]legacy=1\b/.test(location.search);
  const has = (p, v) => !!(window.CSS && CSS.supports && CSS.supports(p, v));
  const noMix = force || !has('color', 'color-mix(in srgb, red, blue)'),
    noDvh = force || !has('height', '1dvh'),
    noInset = force || !has('inset', '0'),
    noBackdrop = force || !has('backdrop-filter', 'blur(1px)');
  if (!noMix && !noDvh && !noInset && !noBackdrop) return;

  const root = document.documentElement,
    probe = document.createElement('canvas').getContext('2d');

  // The argument list of the function whose "(" is at `open`: [end index, top-level comma-separated parts].
  function args(text, open) {
    let depth = 0, start = open + 1;
    const parts = [];
    for (let i = open; i < text.length; i++) {
      const c = text[i];
      if (c === '(') depth++;
      else if (c === ')' && --depth === 0) { parts.push(text.slice(start, i).trim()); return [i, parts]; }
      else if (c === ',' && depth === 1) { parts.push(text.slice(start, i).trim()); start = i + 1; }
    }
    return [-1, parts];
  }
  function vars(text, depth) {
    let at = text.indexOf('var(');
    while (at !== -1) {
      const [end, parts] = args(text, at + 3);
      if (end === -1) break;
      let value = getComputedStyle(root).getPropertyValue(parts[0]).trim();
      if (!value) value = parts.slice(1).join(',');
      text = text.slice(0, at) + (depth > 8 ? value : mixes(vars(value, depth + 1), depth + 1)) + text.slice(end + 1);
      at = text.indexOf('var(');
    }
    return text;
  }
  function rgba(color) {
    probe.fillStyle = '#000000';
    probe.fillStyle = color;
    const v = probe.fillStyle;
    if (v[0] === '#') return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16), 1];
    const m = v.match(/[\d.]+/g) || [0, 0, 0, 0];
    return [+m[0], +m[1], +m[2], m[3] === undefined ? 1 : +m[3]];
  }
  function mixOf(parts, depth) {
    const read = (s) => {
      const m = /^(.*?)\s+([\d.]+)%$/.exec(s) || /^()([\d.]+)%\s+(.*)$/.exec(s);
      if (!m) return [s, null];
      return [m[1] || m[3], +m[2] / 100];
    };
    let [c1, p1] = read(parts[1] || ''), [c2, p2] = read(parts[2] || '');
    if (p1 === null && p2 === null) p1 = p2 = 0.5;
    else if (p1 === null) p1 = 1 - p2;
    else if (p2 === null) p2 = 1 - p1;
    const total = p1 + p2 || 1;
    p1 /= total;
    p2 /= total;
    const a = rgba(mixes(vars(c1, depth), depth)), b = rgba(mixes(vars(c2, depth), depth)),
      alpha = a[3] * p1 + b[3] * p2,
      ch = (i) => (alpha ? Math.round((a[i] * a[3] * p1 + b[i] * b[3] * p2) / alpha) : 0);
    return 'rgba(' + ch(0) + ',' + ch(1) + ',' + ch(2) + ',' + +alpha.toFixed(3) + ')';
  }
  function mixes(text, depth) {
    let at = text.indexOf('color-mix(');
    while (at !== -1) {
      const [end, parts] = args(text, at + 9);
      if (end === -1) break;
      text = text.slice(0, at) + mixOf(parts, (depth || 0) + 1) + text.slice(end + 1);
      at = text.indexOf('color-mix(', at);
    }
    return text;
  }
  // Rewrites that do not depend on the current theme.
  function plain(css) {
    if (noDvh) css = css.replace(/(\d)dvh\b/g, '$1vh');
    if (noBackdrop) css = css.replace(/(^|[;{\s])backdrop-filter:([^;}]+)/g, '$1-webkit-backdrop-filter:$2;backdrop-filter:$2');
    if (noInset) css = css.replace(/(^|[;{\s])inset:\s*([^;}]+?)(\s*!important)?(?=[;}])/g, (all, lead, value, imp) => {
      const v = value.trim().split(/\s+/), i = imp || '',
        top = v[0], right = v[1] || top, bottom = v[2] || top, left = v[3] || right;
      return lead + 'top:' + top + i + ';right:' + right + i + ';bottom:' + bottom + i + ';left:' + left + i;
    });
    return css;
  }

  const sheets = [];
  let busy = false;
  // Stored text first, so var() reads each custom property's own source, then everything resolved for this theme.
  function paint() {
    if (!sheets.length) return;
    busy = true;
    for (const s of sheets) s.el.textContent = s.plain;
    getComputedStyle(root).color;
    for (const s of sheets) {
      s.written = s.plain.indexOf('color-mix(') === -1 ? s.plain : mixes(s.plain, 0);
      s.el.textContent = s.written;
    }
    watcher.takeRecords();
    busy = false;
  }
  function adopt(el) {
    if (sheets.some((s) => s.el === el)) return false;
    sheets.push({ el, plain: plain(el.textContent), written: '' });
    return true;
  }
  let timer = 0;
  const later = () => { clearTimeout(timer); timer = setTimeout(paint, 30); };
  const watcher = new MutationObserver((records) => {
    if (busy) return;
    let changed = false;
    for (const r of records) {
      const node = r.target.nodeType === 1 ? r.target : r.target.parentNode;
      if (node && node.tagName === 'STYLE') {
        const known = sheets.find((s) => s.el === node);
        if (known) {
          // The app rewrites some styles on every render; the same text only needs its resolved copy back.
          const text = node.textContent;
          if (text === known.written) continue;
          const fresh = plain(text);
          if (fresh !== known.plain) { known.plain = fresh; changed = true; }
          else node.textContent = known.written;
        }
        else changed = adopt(node) || changed;
      }
      for (const n of r.addedNodes || []) {
        if (n.tagName === 'STYLE') changed = adopt(n) || changed;
        else if (n.tagName === 'LINK' && n.rel === 'stylesheet') link(n);
      }
    }
    if (changed) later();
  });
  function link(el) {
    if (el.dataset.mzLegacy) return;
    el.dataset.mzLegacy = '1';
    fetch(el.href).then((r) => r.text()).then((css) => {
      const style = document.createElement('style');
      style.textContent = css;
      el.parentNode.insertBefore(style, el);
      adopt(style);
      const sheet = sheets.find((x) => x.el === style);
      sheet.written = sheet.plain;
      style.textContent = sheet.plain;
      el.remove();
      later();
    }).catch(() => {});
  }
  function start() {
    document.querySelectorAll('link[rel="stylesheet"]').forEach(link);
    document.querySelectorAll('style').forEach(adopt);
    watcher.observe(document.head, { childList: true, subtree: true, characterData: true });
    later();
  }
  // Theme and dark mode change the colours, so resolve again whenever they change.
  let themeKey = '';
  new MutationObserver(() => {
    const key = root.className + '|' + (root.getAttribute('style') || '') + '|' + (root.getAttribute('data-theme') || '');
    if (key !== themeKey) { themeKey = key; later(); }
  }).observe(root, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
  if (window.matchMedia) {
    const dark = matchMedia('(prefers-color-scheme: dark)');
    if (dark.addEventListener) dark.addEventListener('change', later);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
