'use strict';
// 3.4.2: more app fonts, all open-licence (SIL OFL 1.1, free for commercial use), trimmed to common characters
// (Big5 level 1 + GB2312 level 1 + kana + Latin + punctuation) so the app stays small; anything missing falls back
// to the device font. The pixel font is now 縫合像素字體 Fusion Pixel (OFL) instead of zpix, so the app can be published;
// its setting key stays "zpix" so people who chose it keep it.
//   清松手寫體 JasonHandwriting · 辰宇落雁體 ChenYuluoyan · 源柔ゴシック GenJyuuGothic · 朱雀仿宋 Zhuque Fangsong
{
  const FONTS = [
    ['jason', '清松手寫體', 'Jason Handwriting', 'MzJason', 'fonts/mz-jason.woff2'],
    ['chenyu', '辰宇落雁體', 'ChenYu Luoyan', 'MzChenyu', 'fonts/mz-chenyu.woff2'],
    ['genjyuu', '源柔哥德', 'GenJyuu Gothic', 'MzGenjyuu', 'fonts/mz-genjyuu.woff2'],
    ['zhuque', '朱雀仿宋', 'Zhuque Fangsong', 'MzZhuque', 'fonts/mz-zhuque.woff2'],
    ['cyber', '賽博體', 'Cyber', 'MzCyber', 'fonts/mz-cyber.woff2'], // Share Tech Mono (OFL) + pixel CJK
  ];
  window.MZ_MORE_FONTS = FONTS;
  const families = { system: 'system-ui,sans-serif', zpix: 'zpix,system-ui,sans-serif', custom: 'MushuiCustom,system-ui,sans-serif' };
  for (const [id,,,face] of FONTS) families[id] = face + ',system-ui,sans-serif';
  let fontRequest = 0;
  window.mzSelectFont = async (id) => {
    if (!draft || !families[id]) return;
    const request = ++fontRequest, currentPage = page;
    try { await document.fonts.load('16px ' + families[id], '沐水字体 abc 278'); } catch { return; }
    if (request !== fontRequest || tab !== 'settings' || page !== currentPage || !draft) return;
    if (draft.font === id) return;
    draft.font = id;
    dirty = true;
    applyTheme();
    document.querySelectorAll('[data-font]').forEach(b => b.classList.toggle('selected', b.dataset.font === id));
    window.mzSettingsAutosave?.schedule();
  };
  const css = document.createElement('style');
  const ADJ = { chenyu: '145%' };
  css.textContent = FONTS.map((f) => `@font-face{font-family:${f[3]};src:url("${f[4]}") format("woff2");font-display:swap${ADJ[f[0]] ? ";size-adjust:" + ADJ[f[0]] : ""}}`).join('\n') +
    '\n.mz-font-btn{font-size:15px}' +
    Object.entries(families).map(([id,family]) => `button[data-font="${id}"]{font-family:${family}}`).join('');
  document.head.append(css);
  // the font buttons in Appearance (after the pixel one); each shows its own look
  const pageBefore = appearancePage;
  appearancePage = function (...a) {
    let html = pageBefore.apply(this, a);
    const cur = (typeof draft !== 'undefined' && draft ? draft : state.settings).font;
    const btns = FONTS.map((f) => `<button data-font="${f[0]}" class="mz-font-btn ${cur === f[0] ? 'selected' : ''}" >${mzT(f[1], f[2])}</button>`).join('');
    html = html.replace(/(<button data-font="zpix"[^>]*>)[^<]*(<\/button>)/, `$1${mzT('像素體', 'Pixel')}$2${btns}`);
    html = html.replace(/zpix 為你提供的像素字體，缺字會使用裝置字體補上。/, mzT('像素體是縫合像素字體；清松手寫體、辰宇落雁體、源柔哥德、朱雀仿宋都是可以自由使用的開源字體。缺字會用裝置字體補上。', 'The pixel font is Fusion Pixel; all the fonts here are open-licence. Missing characters use the device font.'));
    return html;
  };
  // apply the chosen one (life.js only knows system / zpix / custom)
  const fam = (k) => FONTS.find((f) => f[0] === k);
  const applyBefore = applyTheme;
  applyTheme = function (...a) {
    const r = applyBefore.apply(this, a);
    try { const s = (typeof draft !== 'undefined' && draft) || state.settings, f = fam(s.font); document.documentElement.toggleAttribute('data-mz-cyber-font',s.font==='cyber'); if (f) document.documentElement.style.setProperty('--app-font', `"${f[3]}",${f[0] === 'cyber' ? '"zpix",' : ''}-apple-system,"Segoe UI",sans-serif`); } catch {}
    return r;
  };
}
