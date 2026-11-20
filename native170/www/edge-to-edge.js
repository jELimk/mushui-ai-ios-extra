'use strict';
// 3.4.2: Android edge to edge. The Android app now draws the page under the status bar and the navigation bar, so
// the app's own background fills the whole screen (no plain strips above and below). The heights of those bars come
// from AndroidHost.insets() ("top,bottom" in CSS px). If this WebView already reports them through
// env(safe-area-inset-*), the normal CSS handles it; otherwise they are set here as --mz-sat / --mz-sab.
{
  const root = document.documentElement;
  const envTop = () => {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
    document.body.append(d);
    const v = [parseFloat(getComputedStyle(d).paddingTop) || 0, parseFloat(getComputedStyle(d).paddingBottom) || 0];
    d.remove(); return v;
  };
  window.mzApplyInsets = () => {
    try {
      const h = window.AndroidHost; if (!h || typeof h.insets !== 'function') return;
      const [t, b] = String(h.insets() || '0,0').split(',').map((x) => Math.max(0, Number(x) || 0));
      const [et, eb] = envTop();
      const useVars = (t > 0 && et < 1) || (b > 0 && eb < 1);
      root.classList.toggle('mz-e2e', useVars);
      root.style.setProperty('--mz-sat', (useVars ? t : 0) + 'px');
      root.style.setProperty('--mz-sab', (useVars ? b : 0) + 'px');
    } catch {}
  };
  if (window.AndroidHost) {
    const go = () => window.mzApplyInsets();
    if (document.body) go(); else document.addEventListener('DOMContentLoaded', go);
    addEventListener('resize', go);
    setTimeout(go, 600);
  }
  const css = document.createElement('style');
  css.textContent = `
html.mz-e2e #app{padding-top:var(--mz-sat)!important;padding-bottom:var(--mz-sab)!important;box-sizing:border-box}
html.mz-e2e body .modal-backdrop>.sheet{padding-bottom:calc(30px + var(--mz-sab))!important}
html.mz-e2e :is(.call-overlay,#mz-reader,#mz-kao){padding-top:var(--mz-sat);padding-bottom:var(--mz-sab);box-sizing:border-box}
html.mz-e2e #toast{margin-bottom:var(--mz-sab)}
`;
  document.head.append(css);
}
