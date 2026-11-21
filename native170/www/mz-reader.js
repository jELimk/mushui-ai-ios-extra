'use strict';
// 3.4.2: read a Moments post or a single message enlarged, with 沐讀 (Mudoo)'s reading settings —
// text settings only — font, size, line spacing, letter spacing, paragraph spacing, first-line indent, side margins,
// justify (the page keeps the theme's own colours). Settings change live and are remembered on this device.
//  - Moments: tap a post (not its buttons, pictures or comments).
//  - Chat: right-click a message (long-press on phones) → 「放大閱讀」 in the message menu.
{
  const KEY = 'mz-reader-v1';
  const DEF = { font: 'system', fontSize: 20, lineHeight: 1.8, letterSpacing: 0.02, paraSpacing: 0.6, indent: 0, marginX: 24, justify: true };
  let S = { ...DEF };
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
  const FONTS = [
    ['system', '系統黑體', 'Sans', '-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft JhengHei",sans-serif'],
    ['serif', '系統明體', 'Serif', '"Songti TC","PMingLiU","MingLiU","Noto Serif TC","Source Han Serif TC",serif'],
    ['kai', '系統楷體', 'Kai', '"Kaiti TC","STKaiti","DFKai-SB","BiauKai","KaiTi",serif'],
    ['pixel', '像素體', 'Pixel', 'zpix,monospace'],
    ['jason', '清松手寫體', 'Jason Handwriting', 'MzJason,sans-serif'],
    ['chenyu', '辰宇落雁體', 'ChenYu Luoyan', 'MzChenyu,serif'],
    ['genjyuu', '源柔哥德', 'GenJyuu Gothic', 'MzGenjyuu,sans-serif'],
    ['zhuque', '朱雀仿宋', 'Zhuque Fangsong', 'MzZhuque,serif'],
    ['cyber', '賽博體', 'Cyber', 'MzCyber,zpix,monospace'],
  ];
  const SAMPLE = '沐讀書籍啦 Mood 278';
  let box = null;

  const paint = () => {
    if (!box) return;
    const f = FONTS.find((x) => x[0] === S.font) || FONTS[0];
    const art = box.querySelector('.mz-rd-text');
    Object.assign(art.style, { fontFamily: f[3], fontSize: S.fontSize + 'px', lineHeight: String(S.lineHeight), letterSpacing: S.letterSpacing + 'em', textAlign: S.justify ? 'justify' : 'left', paddingLeft: S.marginX + 'px', paddingRight: S.marginX + 'px' });
    art.style.setProperty('--ps', S.paraSpacing + 'em'); art.style.setProperty('--indent', S.indent + 'em');
    box.querySelectorAll('[data-rdfont]').forEach((b) => b.classList.toggle('on', b.dataset.rdfont === S.font));
    box.querySelectorAll('[data-rdindent]').forEach((b) => b.classList.toggle('on', Number(b.dataset.rdindent) === S.indent));
    const j = box.querySelector('[data-rdjustify]'); if (j) j.classList.toggle('on', !!S.justify);
  };
  const slider = (k, min, max, step, fmt, zh, en) => `<label class="mz-rd-row"><span>${mzT(zh, en)}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${S[k]}" data-rdk="${k}" data-fmt="${fmt}"><b>${show(fmt, S[k])}</b></label>`;
  const show = (fmt, v) => (fmt === 'px' ? v + ' px' : fmt === 'em' ? Number(v).toFixed(2) + ' em' : fmt === 'em1' ? Number(v).toFixed(1) + ' em' : Number(v).toFixed(1));
  const panel = () => `<div class="mz-rd-panel" hidden>
<div class="mz-rd-group"><small>${mzT('字體', 'Font')}</small><div class="mz-rd-chips">${FONTS.map((f) => `<button type="button" data-rdfont="${f[0]}" style="font-family:${esc(f[3])}"><b>${mzT(f[1], f[2])}</b><span>${SAMPLE}</span></button>`).join('')}</div></div>
<div class="mz-rd-group"><small>${mzT('排版', 'Layout')}</small>
${slider('fontSize', 12, 40, 1, 'px', '字體大小', 'Font size')}
${slider('lineHeight', 1.2, 2.4, 0.1, 'n', '行距', 'Line spacing')}
${slider('letterSpacing', 0, 0.2, 0.01, 'em', '字距', 'Letter spacing')}
${slider('paraSpacing', 0, 1.5, 0.1, 'em1', '段距', 'Paragraph spacing')}
<div class="mz-rd-row"><span>${mzT('段首縮排', 'Indent')}</span><div class="mz-rd-seg">${[0, 1, 2].map((n) => `<button type="button" data-rdindent="${n}">${mzT(n + ' 字', n + ' ch')}</button>`).join('')}</div></div>
${slider('marginX', 8, 64, 2, 'px', '左右邊距', 'Side margins')}
<div class="mz-rd-row"><span>${mzT('兩端對齊', 'Justify')}</span><button type="button" class="switch" data-rdjustify aria-label="${mzT('兩端對齊', 'Justify')}"></button></div>
<button type="button" class="mz-rd-reset" data-rdreset>${mzT('恢復預設', 'Reset')}</button>
</div></div>`;

  const open = ({ title = '', sub = '', text = '', images = [] }) => {
    close();
    box = document.createElement('section');
    box.id = 'mz-reader'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', mzT('放大閱讀', 'Reader'));
    const paras = String(text || '').split(/\n+/).map((t) => t.trim()).filter(Boolean);
    box.innerHTML = `<header class="mz-rd-top"><button type="button" class="mz-rd-btn" data-rdclose aria-label="${mzT('關閉', 'Close')}">✕</button><div class="mz-rd-title"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div><button type="button" class="mz-rd-btn mz-rd-aa" data-rdpanel aria-label="${mzT('閱讀設定', 'Reading settings')}">Aa</button></header>
<div class="mz-rd-scroll"><article class="mz-rd-text user-content">${paras.map((t) => `<p>${esc(t)}</p>`).join('') || `<p class="mz-rd-empty">${mzT('（沒有文字）', '(No text)')}</p>`}</article>${images.length ? `<div class="mz-rd-imgs">${images.map((src) => `<img src="${esc(src)}" alt="" loading="lazy">`).join('')}</div>` : ''}</div>${panel()}`;
    let edgeStart = null;
    box.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      edgeStart = e.touches.length === 1 && touch.clientX <= 28 && !e.target.closest('input,button') ? touch : null;
    }, { passive: true });
    box.addEventListener('touchend', (e) => {
      const start = edgeStart;
      edgeStart = null;
      const touch = e.changedTouches[0];
      if (!start || !touch || start.identifier !== touch.identifier) return;
      const dx = touch.clientX - start.clientX, dy = touch.clientY - start.clientY;
      if (dx > 45 && dx > Math.abs(dy) * 1.3) backReader();
    }, { passive: true });
    box.addEventListener('touchcancel', () => { edgeStart = null; }, { passive: true });
    document.body.append(box);
    paint();
    requestAnimationFrame(() => box?.classList.add('in'));
  };
  const close = () => { if (!box) return; const b = box; box = null; b.classList.remove('in'); setTimeout(() => b.remove(), 180); };
  const setPanel = (panel, open) => {
    panel.hidden = !open;
    box.classList.toggle('mz-rd-open', open);
  };
  const backReader = () => {
    if (!box) return false;
    const panel = box.querySelector('.mz-rd-panel');
    if (!panel.hidden) setPanel(panel, false);
    else close();
    return true;
  };
  window.mzReader = { open, close, isOpen: () => !!box };

  document.addEventListener('click', (e) => {
    if (box && box.contains(e.target)) {
      const t = e.target;
      if (t.closest('[data-rdclose]')) return backReader();
      if (t.closest('[data-rdpanel]')) { const p = box.querySelector('.mz-rd-panel'); setPanel(p, p.hidden); return; }
      const f = t.closest('[data-rdfont]'); if (f) { S.font = f.dataset.rdfont; save(); return paint(); }
      const n = t.closest('[data-rdindent]'); if (n) { S.indent = Number(n.dataset.rdindent); save(); return paint(); }
      if (t.closest('[data-rdjustify]')) { S.justify = !S.justify; save(); return paint(); }
      if (t.closest('[data-rdreset]')) { S = { ...DEF }; save(); box.querySelectorAll('[data-rdk]').forEach((i) => { i.value = S[i.dataset.rdk]; i.nextElementSibling.textContent = show(i.dataset.fmt, S[i.dataset.rdk]); }); return paint(); }
      if (t.closest('.mz-rd-scroll')) { const pn = box.querySelector('.mz-rd-panel'); if (!pn.hidden) setPanel(pn, false); }
      return;
    }
    // a Moments post: tap anywhere on it except its buttons, links, pictures, comments and inputs
    const m = e.target.closest?.('#app .moment');
    if (!m || e.target.closest('button,a,input,textarea,select,img,video,.photos,.comments,.meta,.moment-actions,.like,[data-action],[contenteditable]')) return;
    if (String(getSelection?.() || '').trim()) return; // selecting text, not opening
    const textEl = m.querySelector('.moment-main > .text, .text');
    const text = textEl?.innerText || '';
    if (!text.trim()) return;
    const name = m.querySelector('.moment-main h3, h3')?.innerText || '';
    const when = m.querySelector('.meta span')?.innerText || '';
    const images = [...m.querySelectorAll('.photos img')].map((i) => i.currentSrc || i.src).filter(Boolean).slice(0, 27);
    open({ title: name, sub: when, text, images });
  });
  document.addEventListener('input', (e) => {
    const i = e.target.closest?.('#mz-reader [data-rdk]'); if (!i) return;
    S[i.dataset.rdk] = Number(i.value); i.nextElementSibling.textContent = show(i.dataset.fmt, S[i.dataset.rdk]); paint(); save();
  });
  document.addEventListener('keydown', (e) => {
    if (!box || !['Escape', 'BrowserBack'].includes(e.key)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    backReader();
  }, true);
  if (typeof window.goBack === 'function') {
    const back = window.goBack;
    window.goBack = function (...a) { return backReader() || back.apply(this, a); };
  }

  // the message menu (right-click on a computer, long-press on phones) gets 「放大閱讀」
  if (typeof messageActions === 'function') {
    const before = messageActions;
    messageActions = function (id, ...rest) {
      const r = before.call(this, id, ...rest);
      try {
        const m = typeof messageById === 'function' ? messageById(id) : null;
        const text = String(m?.text || '').trim();
        const sheet = document.querySelector('#overlay .sheet');
        if (m && text && sheet && !sheet.querySelector('[data-mzread]')) {
          const btn = document.createElement('button');
          btn.type = 'button'; btn.className = 'setting-choice full mz-read-entry'; btn.dataset.mzread = id;
          btn.innerHTML = `<span><b>${mzT('放大閱讀', 'Read enlarged')}</b><small>${mzT('調字體、字距和行距', 'Font and spacing')}</small></span><span>Aa</span>`;
          const anchor = sheet.querySelector('.sheet-title');
          anchor ? anchor.after(btn) : sheet.prepend(btn);
        }
      } catch {}
      return r;
    };
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-mzread]'); if (!b) return;
    const m = typeof messageById === 'function' ? messageById(b.dataset.mzread) : null; if (!m) return;
    let who = '';
    try { who = m.author === 'me' ? mzT('我', 'Me') : (typeof person === 'function' ? person(m.author)?.name : '') || ''; } catch {}
    closeModal?.();
    open({ title: who, sub: m.time && typeof ago === 'function' ? ago(m.time) : '', text: m.text, images: (m.images || []).filter((x) => typeof x === 'string' && !x.startsWith('media:')) });
  });

  const css = document.createElement('style');
  css.textContent = `
#mz-reader{position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;background:var(--bg);color:var(--ink);--rd-ink:var(--ink);opacity:0;transform:translateY(12px);transition:opacity .18s,transform .18s}
#mz-reader.in{opacity:1;transform:none}
.mz-rd-top{display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top) + 10px) 14px 10px;border-bottom:1px solid color-mix(in srgb,var(--rd-ink) 12%,transparent)}
.mz-rd-title{flex:1;min-width:0;display:grid;text-align:center}.mz-rd-title b{font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mz-rd-title small{opacity:.6;font-size:12px}
.mz-rd-btn{flex:none;width:40px;height:40px;border:0;border-radius:50%;background:color-mix(in srgb,var(--rd-ink) 8%,transparent);color:inherit;font-size:16px;font-weight:700;display:grid;place-items:center;padding:0}
.mz-rd-aa{font-family:serif;font-size:17px}
#mz-reader.mz-rd-open .mz-rd-aa{background:var(--accent);color:#fff}
.mz-rd-scroll{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:24px 0 calc(env(safe-area-inset-bottom) + 40px)}
.mz-rd-text{max-width:760px;margin:0 auto;word-break:normal;overflow-wrap:anywhere;line-break:strict}
.mz-rd-text p{margin:0 0 var(--ps,.6em);text-indent:var(--indent,0)}
.mz-rd-imgs{max-width:760px;margin:18px auto 0;padding:0 16px;display:grid;gap:10px}
.mz-rd-imgs img{width:100%;border-radius:12px;display:block}
.mz-rd-panel{position:absolute;left:0;right:0;bottom:0;max-height:64vh;overflow-y:auto;padding:16px 16px calc(env(safe-area-inset-bottom) + 18px);background:var(--surface,#fff);color:var(--ink);border-radius:20px 20px 0 0;box-shadow:0 -10px 30px -12px #0005;display:grid;gap:14px}
.mz-rd-panel[hidden]{display:none}
.mz-rd-group{display:grid;gap:8px}.mz-rd-group>small{color:var(--muted);font-size:12px;letter-spacing:.06em}
.mz-rd-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.mz-rd-chips button{display:grid;gap:2px;text-align:left;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:transparent;color:inherit}
.mz-rd-chips button span{font-size:12px;opacity:.7}
.mz-rd-chips button.on,.mz-rd-seg button.on{outline:2px solid var(--accent);outline-offset:-2px}
.mz-rd-row{display:grid;grid-template-columns:88px 1fr 66px;align-items:center;gap:10px;font-size:14px}
.mz-rd-row b{font-weight:400;font-size:12px;color:var(--muted);text-align:right;font-variant-numeric:tabular-nums}
.mz-rd-row input[type=range]{width:100%;accent-color:var(--accent)}
.mz-rd-row .switch{justify-self:start}
.mz-rd-seg{display:flex;gap:6px}.mz-rd-seg button{flex:1;padding:7px 0;border-radius:10px;border:1px solid var(--line);background:transparent;color:inherit}
.mz-rd-reset{justify-self:center;border:0;background:none;color:var(--muted);font-size:13px;padding:6px 10px}
.mz-read-entry span:last-child{font-family:serif;font-weight:700;font-size:17px;color:var(--accent)}
#app .moment .moment-main>.text{cursor:zoom-in}
`;
  document.head.append(css);
}
