"use strict";
/* Minimal QR encoder: byte mode, error-correction level M, versions 1-7
   (up to ~120 payload bytes) — enough for short login codes. The matrix
   builder was verified module-for-module against a reference encoder.
   Exposes window.mzQrMatrix(text) -> {size, mod} (mod[y][x] booleans)
   and window.mzDrawQr(canvas, text, px). */
window.mzQr = (() => {
  const EXP = new Array(512), LOG = new Array(256);
  { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; }
  const mul = (a, b) => (a && b) ? EXP[(LOG[a] + LOG[b]) % 255] : 0;
  // Generator polynomial (low->high coefficients), product of (x + a^i).
  const genPoly = (n) => { let p = [1]; for (let i = 0; i < n; i++) { const np = new Array(p.length + 1).fill(0); for (let j = 0; j < p.length; j++) { np[j] ^= mul(p[j], EXP[i]); np[j + 1] ^= p[j]; } p = np; } return p; };
  const rsEc = (data, ecLen) => {
    const gen = genPoly(ecLen); // low->high, gen[ecLen] = 1
    const div = []; for (let i = ecLen - 1; i >= 0; i--) div.push(gen[i]); // high->low, leading term excluded
    const res = new Array(ecLen).fill(0);
    for (const d of data) { const f = d ^ res.shift(); res.push(0); for (let i = 0; i < ecLen; i++) res[i] ^= mul(div[i], f); }
    return res;
  };
  // version: blocks, codewords per block, ec per block, remainder bits, alignment centers
  const TABLE = [
    null,
    { b: 1, per: 16, ec: 10, rem: 0, al: [] },
    { b: 1, per: 28, ec: 16, rem: 7, al: [6, 18] },
    { b: 1, per: 44, ec: 26, rem: 7, al: [6, 22] },
    { b: 2, per: 32, ec: 18, rem: 7, al: [6, 26] },
    { b: 2, per: 43, ec: 24, rem: 7, al: [6, 30] },
    { b: 4, per: 27, ec: 16, rem: 7, al: [6, 34] },
    { b: 4, per: 31, ec: 18, rem: 0, al: [6, 22, 38] },
  ];
  const encodeData = (bytes) => {
    for (let v = 1; v <= 7; v++) {
      const t = TABLE[v], cap = t.b * t.per;
      if (bytes.length + 2 > cap) continue;
      const bits = [];
      const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
      push(0b0100, 4); push(bytes.length, 8);
      for (const by of bytes) push(by, 8);
      const capBits = cap * 8;
      for (let i = Math.min(4, capBits - bits.length); i > 0; i--) bits.push(0);
      while (bits.length % 8) bits.push(0);
      const pads = [0xec, 0x11];
      for (let p = 0; bits.length < capBits; p++) push(pads[p % 2], 8);
      const cw = [];
      for (let i = 0; i < bits.length; i += 8) { let v8 = 0; for (let j = 0; j < 8; j++) v8 = (v8 << 1) | bits[i + j]; cw.push(v8); }
      const blocks = [], ecs = [];
      for (let b = 0; b < t.b; b++) { const data = cw.slice(b * t.per, (b + 1) * t.per); blocks.push(data); ecs.push(rsEc(data, t.ec)); }
      const out = [];
      for (let i = 0; i < t.per; i++) for (let b = 0; b < t.b; b++) out.push(blocks[b][i]);
      for (let i = 0; i < t.ec; i++) for (let b = 0; b < t.b; b++) out.push(ecs[b][i]);
      const bitArr = [];
      for (const c of out) for (let i = 7; i >= 0; i--) bitArr.push((c >>> i) & 1);
      for (let i = 0; i < t.rem; i++) bitArr.push(0);
      return { version: v, bits: bitArr };
    }
    return null;
  };
  const formatBits = (mask) => { const d = mask; let rem = d; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537); return ((d << 10) | rem) ^ 0x5412; };
  const versionBits = (v) => { let rem = v; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25); return (v << 12) | rem; };
  const build = (version, dataBits, mask) => {
    const size = version * 4 + 17;
    const mod = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, v) => { if (x >= 0 && x < size && y >= 0 && y < size) { mod[y][x] = v; fn[y][x] = true; } };
    // timing
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const d = Math.max(Math.abs(dx), Math.abs(dy)); set(cx + dx, cy + dy, d !== 2 && d !== 4); } };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    // alignment
    const al = TABLE[version].al;
    for (const x of al) for (const y of al) {
      if ((x === al[0] && y === al[0]) || (x === al[al.length - 1] && y === al[0]) || (x === al[0] && y === al[al.length - 1])) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
    // reserve format info areas (values drawn after masking)
    const drawFormat = (m) => {
      const bits = formatBits(m), get = (i) => ((bits >>> i) & 1) === 1;
      for (let i = 0; i <= 5; i++) set(8, i, get(i));
      set(8, 7, get(6)); set(8, 8, get(7)); set(7, 8, get(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, get(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, get(i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, get(i));
      set(8, size - 8, true);
    };
    drawFormat(mask);
    if (version >= 7) {
      const bits = versionBits(version);
      for (let i = 0; i < 18; i++) { const bit = ((bits >>> i) & 1) === 1; set(size - 11 + (i % 3), Math.floor(i / 3), bit); set(Math.floor(i / 3), size - 11 + (i % 3), bit); }
    }
    // data placement
    let idx = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
          if (!fn[y][x]) { mod[y][x] = idx < dataBits.length ? dataBits[idx++] === 1 : false; }
        }
      }
    }
    // apply mask to data modules
    if (mask >= 0) {
      const cond = [
        (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0,
        (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
        (x, y) => (x * y) % 2 + (x * y) % 3 === 0, (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
        (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
      ][mask];
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && cond(x, y)) mod[y][x] = !mod[y][x];
      drawFormat(mask);
    }
    return { size, mod };
  };
  const penalty = (m) => {
    const { size, mod } = m; let score = 0;
    const run = (arr) => { let s = 0, color = arr[0], len = 1; for (let i = 1; i < arr.length; i++) { if (arr[i] === color) len++; else { if (len >= 5) s += len - 2; color = arr[i]; len = 1; } } if (len >= 5) s += len - 2; return s; };
    for (let i = 0; i < size; i++) { score += run(mod[i]); score += run(mod.map(r => r[i])); }
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) if (mod[y][x] === mod[y][x + 1] && mod[y][x] === mod[y + 1][x] && mod[y][x] === mod[y + 1][x + 1]) score += 3;
    const pat = (arr) => { let s = 0; for (let i = 0; i + 7 <= arr.length; i++) { if (arr[i] && !arr[i + 1] && arr[i + 2] && arr[i + 3] && arr[i + 4] && !arr[i + 5] && arr[i + 6]) { const before = i >= 4 && !arr[i - 1] && !arr[i - 2] && !arr[i - 3] && !arr[i - 4]; const after = i + 11 <= arr.length && !arr[i + 7] && !arr[i + 8] && !arr[i + 9] && !arr[i + 10]; if (before || after) s += 40; } } return s; };
    for (let i = 0; i < size; i++) { score += pat(mod[i]); score += pat(mod.map(r => r[i])); }
    let dark = 0; for (const row of mod) for (const c of row) if (c) dark++;
    const total = size * size, k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    if (k > 0) score += k * 10;
    return score;
  };
  const matrix = (text, forceMask) => {
    const bytes = [...new TextEncoder().encode(text)];
    const enc = encodeData(bytes);
    if (!enc) return null;
    if (forceMask !== undefined && forceMask >= 0) return build(enc.version, enc.bits, forceMask);
    let best = null, bestScore = Infinity;
    for (let m = 0; m < 8; m++) { const cand = build(enc.version, enc.bits, m); const s = penalty(cand); if (s < bestScore) { bestScore = s; best = cand; } }
    return best;
  };
  const draw = (canvas, text, px) => {
    const m = matrix(text);
    if (!m) return false;
    const quiet = 4, cells = m.size + quiet * 2, scale = Math.max(1, Math.floor(px / cells));
    canvas.width = cells * scale; canvas.height = cells * scale;
    const g = canvas.getContext("2d");
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = "#241f2e";
    for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.mod[y][x]) g.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
    return true;
  };
  return { matrix, draw };
})();
window.mzQrMatrix = window.mzQr.matrix;
window.mzDrawQr = window.mzQr.draw;
