'use strict';
// 3.4.1: settings save themselves as soon as an option changes, so there is no 儲存 button any more.
//  - switches, choices, colour swatches, sliders: saved a moment after the change;
//  - text boxes: saved when you leave the box (or pause typing for a while), so typing is never interrupted;
//  - leaving the settings page with something unsaved saves it first instead of asking to discard it.
// It uses the same saveSettings() the button used, so keys, checks and syncing all behave the same.
{
  let timer = 0, saving = false, failed = false;
  const typing = () => { const el = document.activeElement; return !!el && el.closest?.('#app') && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !/^(checkbox|radio|range|color)$/.test(el.type || ''); };
  const quietSave = async () => {
    // the button showed 「設定已儲存」 for each press; saving on every change keeps quiet instead
    const realToast = toast;
    toast = (text, ...rest) => { if (text === '設定已儲存' || text === 'Settings saved') return; return realToast(text, ...rest); };
    try { await saveSettings(); } finally { toast = realToast; }
  };
  const flush = async () => {
    clearTimeout(timer); timer = 0;
    if (saving || typeof dirty === 'undefined' || !dirty || typeof busy !== 'undefined' && busy) return;
    saving = true;
    try { await quietSave(); failed = typeof dirty !== 'undefined' && dirty; } catch { failed = true; } finally { saving = false; }
  };
  const soon = (ms = 350) => {
    if (typeof tab === 'undefined' || tab !== 'settings') return;
    clearTimeout(timer);
    timer = setTimeout(() => { if (typing()) { soon(1500); return; } flush(); }, ms);
  };
  // any change on a settings page: a click (switch, choice, swatch), a change (select, slider, file), leaving a box
  document.addEventListener('click', (e) => { if (e.target.closest?.('#app,#overlay')) { failed = false; soon(); } }, true);
  document.addEventListener('change', (e) => { if (e.target.closest?.('#app,#overlay')) { failed = false; soon(); } }, true);
  document.addEventListener('focusout', (e) => { if (e.target.closest?.('#app')) soon(200); }, true);
  // while typing: save after a longer pause, once the box is left (typing() keeps it waiting)
  document.addEventListener('input', (e) => { if (e.target.closest?.('#app')) { failed = false; soon(2500); } }, true);
  // leaving the settings: save what's there first, then go
  if (typeof navigate === 'function') {
    const navBefore = navigate;
    navigate = async function (...args) {
      if (typeof dirty !== 'undefined' && dirty && !failed) { document.activeElement?.blur?.(); await flush(); }
      return navBefore.apply(this, args);
    };
  }
  if (typeof window.goBack === 'function') {
    const backBefore = window.goBack;
    window.goBack = function (...args) {
      if (typeof dirty !== 'undefined' && dirty && !failed && tab === 'settings') { document.activeElement?.blur?.(); flush().finally(() => backBefore.apply(this, args)); return true; }
      return backBefore.apply(this, args);
    };
  }
  // no 儲存 button on the settings pages (the profile page's too)
  const css = document.createElement('style');
  css.textContent = '#app .page>.top [data-action="save"]{display:none!important}';
  document.head.append(css);
  window.mzSettingsAutosave = { flush };
}
