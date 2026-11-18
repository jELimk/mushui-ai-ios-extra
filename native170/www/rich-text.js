'use strict';
// 3.4.1: tables and diagrams in chat messages. On top of the existing formatting (headings, quotes, lists, code):
//  - Markdown tables (a header row, a |---| line, then rows) become real tables (scrolls sideways when wide);
//  - ```svg code blocks and bare <svg>…</svg> become the drawn picture. The SVG is cleaned first: only drawing
//    elements stay (no scripts, links, images, foreign content or event handlers), so a message can't run code.
{
  const ALLOWED = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'defs', 'lineargradient', 'radialgradient', 'stop', 'marker', 'title', 'desc', 'clippath', 'mask', 'pattern', 'symbol']);
  const cleanSvg = (raw) => {
    if (raw.length > 60000) return '';
    let doc;
    try { doc = new DOMParser().parseFromString(raw, 'image/svg+xml'); } catch { return ''; }
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) return '';
    const walk = (el) => {
      for (const child of [...el.children]) {
        if (!ALLOWED.has(child.nodeName.toLowerCase())) { child.remove(); continue; }
        walk(child);
      }
      for (const a of [...el.attributes]) {
        const n = a.name.toLowerCase(), v = a.value;
        const external = /url\(\s*['"]?\s*(?!#)/i.test(v) || /javascript:|data:/i.test(v);
        if (n.startsWith('on') || n === 'href' || n === 'xlink:href' || n === 'src' || (n === 'style' && /url\(|expression|@import/i.test(v)) || external) el.removeAttribute(a.name);
      }
    };
    walk(root);
    root.removeAttribute('width'); root.removeAttribute('height');
    if (!root.getAttribute('viewBox')) root.setAttribute('viewBox', '0 0 400 240');
    root.setAttribute('role', 'img');
    return new XMLSerializer().serializeToString(root);
  };
  const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const isSep = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
  const isRow = (line) => /^\s*\|.*\|\s*$/.test(line) || (line.includes('|') && line.split('|').length >= 3);
  const table = (rows) => {
    const head = cells(rows[0]), align = cells(rows[1]).map((c) => (/^:-+:$/.test(c) ? 'center' : /-+:$/.test(c) ? 'right' : ''));
    const td = (tag, c, i) => `<${tag}${align[i] ? ` style="text-align:${align[i]}"` : ''}>${inlineMarkup(c)}</${tag}>`;
    return `<div class="chat-table"><table><thead><tr>${head.map((c, i) => td('th', c, i)).join('')}</tr></thead><tbody>${rows.slice(2).map((r) => `<tr>${cells(r).map((c, i) => td('td', c, i)).join('')}</tr>`).join('')}</tbody></table></div>`;
  };
  const before = chatMarkup;
  chatMarkup = function (text) {
    const src = String(text || '');
    if (!/\|/.test(src) && !/<svg|```svg/i.test(src)) return before(src);
    const lines = src.split('\n'), out = [];
    let plain = [];
    const flush = () => { if (plain.length) { out.push(before(plain.join('\n'))); plain = []; } };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // ```svg … ```
      if (/^\s*```\s*svg\s*$/i.test(line)) {
        const end = lines.findIndex((l, k) => k > i && /^\s*```\s*$/.test(l));
        if (end > i) { const svg = cleanSvg(lines.slice(i + 1, end).join('\n')); if (svg) { flush(); out.push(`<div class="chat-svg">${svg}</div>`); i = end; continue; } }
      }
      // a bare <svg …> … </svg>
      if (/^\s*<svg[\s>]/i.test(line)) {
        const end = lines.findIndex((l, k) => k >= i && /<\/svg>\s*$/i.test(l));
        if (end >= i) { const svg = cleanSvg(lines.slice(i, end + 1).join('\n')); if (svg) { flush(); out.push(`<div class="chat-svg">${svg}</div>`); i = end; continue; } }
      }
      // a table: header row, separator, rows
      if (isRow(line) && i + 1 < lines.length && isSep(lines[i + 1])) {
        let end = i + 2;
        while (end < lines.length && isRow(lines[end]) && !isSep(lines[end])) end++;
        flush(); out.push(table(lines.slice(i, end))); i = end - 1; continue;
      }
      plain.push(line);
    }
    flush();
    return out.join('');
  };
  const css = document.createElement('style');
  css.textContent = `.chat-table{max-width:100%;overflow-x:auto;margin:6px 0;-webkit-overflow-scrolling:touch}
.chat-table table{border-collapse:collapse;font-size:.92em;min-width:60%}
.chat-table th,.chat-table td{border:1px solid color-mix(in srgb,currentColor 18%,transparent);padding:5px 9px;text-align:left;vertical-align:top}
.chat-table th{background:color-mix(in srgb,currentColor 7%,transparent);font-weight:650}
.chat-svg{margin:6px 0;max-width:min(100%,520px)}
.chat-svg svg{display:block;width:100%;height:auto;max-height:420px}`;
  document.head.append(css);
  window.mzCleanSvg = cleanSvg;
}
