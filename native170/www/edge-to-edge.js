'use strict';
// Expose Android system bars separately so CSS can combine them with the viewport safe area.
{
  const root = document.documentElement;
  window.mzApplyInsets = () => {
    try {
      const h = window.AndroidHost; if (!h || typeof h.insets !== 'function') return;
      const [t, b] = String(h.insets() || '0,0').split(',').map((x) => Math.max(0, Number(x) || 0));
      const useVars = t > 0 || b > 0;
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
html.mz-e2e #toast{margin-bottom:var(--mz-sab)}
`;
  document.head.append(css);
}
