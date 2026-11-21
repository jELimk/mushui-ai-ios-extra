'use strict';
// 3.4.4: the look is per device (the user: two Android phones on the same account can each show a different theme).
// Settings still sync with the account, but the theme and the 玻璃效果 switch are remembered on this device and always
// win over whatever another device saved. Dark mode was already per device (release211, localStorage).
{
  const KEY = 'mz-device-look', FIELDS = ['theme', 'glassEffect'];
  let current = null;
  try { current = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
  const read = () => current && { ...current };
  const write = (s) => {
    if (!s) return;
    const v = {}; for (const f of FIELDS) if (f in s) v[f] = s[f];
    if (!('theme' in v)) return;
    if (current && FIELDS.every(f => current[f] === v[f])) return;
    current = v;
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {}
  };
  // put this device's look back into the shared settings (after a sync brought another device's)
  const restore = () => {
    const loc = current, s = typeof state !== 'undefined' ? state?.settings : null;
    if (!s) return;
    if (!loc) { write(s); return; }  // first run on this device: keep what it has now
    for (const f of FIELDS) if (f in loc) s[f] = loc[f];
    // Keep open settings and incoming account state on the same device theme.
    if (draft) for (const f of FIELDS) if (f in loc) draft[f] = loc[f];
  };
  const applyBefore = applyTheme;
  applyTheme = function (...a) { try { restore(); } catch {} return applyBefore.apply(this, a); };
  const callBefore = call;
  call = async function (op, data, ...rest) {
    if (op === 'mutate' && data?.action === 'settings' && data.settings && current) data = { ...data, settings: { ...data.settings, ...current } };
    const r = await callBefore.call(this, op, data, ...rest);
    return r;
  };
  const renderBefore = render;
  render = function (...a) { try { restore(); } catch {} return renderBefore.apply(this, a); };
  window.mzDeviceLook = { read, write, restore };
}
