'use strict';
// These controls are per device, like the theme and glass effect.
{
  const root = document.documentElement;
  const theme = () => (draft || state?.settings)?.theme;
  const keys = { cat: 'mz-cat-bubbles', jelly: 'mz-jelly-bubbles' };
  const enabled = (id) => { try { return localStorage.getItem(keys[id]) !== 'off'; } catch { return true; } };
  const before = applyTheme;
  const sync = () => {
    const id = theme();
    root.classList.toggle('mz-cat-bubbles', id === 'cat' && enabled('cat'));
    root.classList.toggle('mz-jelly-bubbles', id === 'jelly' && root.classList.contains('mz-glass') && enabled('jelly'));
  };
  applyTheme = function (...args) { const result = before.apply(this, args); sync(); return result; };
  window.mzThemeBubbleControl = () => {
    const id = theme();
    if (!keys[id]) return '';
    const title = id === 'cat' ? mzT('貓咪氣泡框', 'Cat bubbles') : mzT('泡泡氣泡框', 'Jelly bubbles');
    const hint = id === 'cat' ? mzT('可與玻璃效果一起使用。', 'Works with or without glass.') : mzT('搭配海月水母的玻璃效果。', 'Uses Moon Jelly glass.');
    const on = enabled(id);
    return `<div class="toggle-row"><div><h3>${title}</h3><p class="small">${hint}</p></div><button type="button" class="switch ${on ? 'on' : ''}" role="switch" aria-label="${title}" aria-checked="${on}" data-action="mzToggleThemeBubble"></button></div>`;
  };
  actions.mzToggleThemeBubble = (button) => {
    const id = theme();
    if (!keys[id]) return;
    const on = !enabled(id);
    try { localStorage.setItem(keys[id], on ? 'on' : 'off'); } catch { return; }
    sync();
    const control = button?.closest?.('button') || document.querySelector('[data-action="mzToggleThemeBubble"]');
    control?.classList.toggle('on', on);
    control?.setAttribute('aria-checked', String(on));
  };
}
