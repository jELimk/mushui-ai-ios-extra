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
  ];
  const CYBER_FONT = ['cyber', '賽博朋克', 'Cyberpunk', 'ui-monospace,"Cascadia Mono",Consolas,"Roboto Mono",monospace'];
  window.MZ_MORE_FONTS = FONTS;
  const css = document.createElement('style');
  // 3.4.4: 辰宇落雁體 draws small — it is scaled up a quarter (size-adjust) wherever it is used, so it reads like the others
  const ADJ = { chenyu: '125%' };
  css.textContent = FONTS.map((f) => `@font-face{font-family:${f[3]};src:url("${f[4]}") format("woff2");font-display:swap${ADJ[f[0]] ? ";size-adjust:" + ADJ[f[0]] : ""}}`).join('\n') +
    '\n.mz-font-btn{font-size:15px}';
  document.head.append(css);
  // the font buttons in Appearance (after the pixel one); each shows its own look
  const pageBefore = appearancePage;
  appearancePage = function (...a) {
    let html = pageBefore.apply(this, a);
    const cur = (typeof draft !== 'undefined' && draft ? draft : state.settings).font;
    const btns = FONTS.map((f) => `<button data-font="${f[0]}" class="mz-font-btn ${cur === f[0] ? 'selected' : ''}" style="font-family:${f[3]},sans-serif">${mzT(f[1], f[2])}</button>`).join('') +
      `<button data-font="cyber" class="mz-font-btn ${cur === 'cyber' ? 'selected' : ''}" style="font-family:${CYBER_FONT[3]}">${mzT(CYBER_FONT[1], CYBER_FONT[2])}</button>`;
    html = html.replace(/(<button data-font="zpix"[^>]*>)[^<]*(<\/button>)/, `$1${mzT('像素體', 'Pixel')}$2${btns}`);
    html = html.replace(/zpix 為你提供的像素字體，缺字會使用裝置字體補上。/, mzT('像素體是縫合像素字體；清松手寫體、辰宇落雁體、源柔哥德、朱雀仿宋都是可以自由使用的開源字體。缺字會用裝置字體補上。', 'The pixel font is Fusion Pixel; all the fonts here are open-licence. Missing characters use the device font.'));
    return html;
  };
  // apply the chosen one (life.js only knows system / zpix / custom)
  const fam = (k) => FONTS.find((f) => f[0] === k);
  const applyBefore = applyTheme;
  applyTheme = function (...a) {
    const r = applyBefore.apply(this, a);
    try { const s = (typeof draft !== 'undefined' && draft) || state.settings, f = fam(s.font); if (s.font === 'cyber') document.documentElement.style.setProperty('--app-font', CYBER_FONT[3]); else if (f) document.documentElement.style.setProperty('--app-font', `"${f[3]}",-apple-system,"Segoe UI",sans-serif`); } catch {}
    return r;
  };
}
