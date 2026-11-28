'use strict';
// 3.4.4: one clear "chosen" look for every selectable button, in every theme: filled with the theme colour,
// readable text (dark text when the theme colour is light), bold, a soft ring; pills / chips also get a ✓;
// colour swatches get a thick outline. Loaded last so theme styles can't wash it out.
{
  const probe = document.createElement('i');
  probe.style.cssText = 'position:absolute;width:0;height:0;color:var(--accent)';
  const ink = () => {
    try {
      if (!probe.isConnected) document.body.append(probe);
      const m = /(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)/.exec(getComputedStyle(probe).color);
      if (!m) return;
      let [r, g, b] = m.slice(1, 4).map(Number); if (r <= 1 && g <= 1 && b <= 1) { r *= 255; g *= 255; b *= 255; }
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      document.documentElement.style.setProperty('--mz-sel-ink', lum > 0.62 ? '#16121c' : '#ffffff');
    } catch {}
  };
  const renderBefore = render;
  render = function (...a) { const r = renderBefore.apply(this, a); ink(); return r; };
  setTimeout(ink, 500);
  const S = ':is(.pill,.chip,.setting-choice,.mz-seg,.mz-font-btn,.mz-status-row,.model-grid>button,.provider-grid>button,[data-modelpick])';
  const css = document.createElement('style');
  css.textContent = `:root ${S}.selected,:root ${S}[aria-pressed="true"],:root .macaron-option[aria-selected="true"]{background:var(--accent)!important;background-image:none!important;color:var(--mz-sel-ink,#fff)!important;border-color:var(--accent)!important;font-weight:700!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 40%,transparent),0 4px 14px color-mix(in srgb,var(--accent) 32%,transparent)!important;opacity:1!important}
:root ${S}.selected :is(span,small,b,strong,svg){color:inherit!important}
:root :is(.pill,.chip).selected::before{content:"✓";margin-right:5px;font-weight:800}
:root .swatch.selected{outline:3px solid var(--ink,#2b2238)!important;outline-offset:3px!important;transform:scale(1.08)}`;
  document.head.append(css);
}
