'use strict';
// 3.4.4: the look is per device (the user: two Android phones on the same account can each show a different theme).
// Account sync excludes these fields. Native storage also keeps the choice across iOS loopback ports.
{
  const KEY = 'mz-device-look', FIELDS = ['theme', 'glassEffect'];
  let current = null;
  try { current = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
  if (!Object.hasOwn(themes, current?.theme)) current = null;
  const read = () => current && { ...current };
  const write = (s, chosen = false) => {
    if (!s) return;
    const v = {}; for (const f of FIELDS) if (f in s) v[f] = s[f];
    if (!Object.hasOwn(themes, v.theme)) return;
    if (current && FIELDS.every(f => current[f] === v[f])) return;
    current = v;
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {}
    if (chosen && window.IOSHost) WebEngine.put(KEY,v).catch(error => toast(error.message));
  };
  const restore = (target = state, includeDraft = true) => {
    const loc = current, s = target?.settings;
    if (!s) return;
    if (!loc) { write({ theme: 'lilac', glassEffect: false, ...s }); return; }  // first run on this device: keep what it has now
    for (const f of FIELDS) if (f in loc) s[f] = loc[f];
    // Keep open settings and incoming account state on the same device theme.
    if (includeDraft && draft) for (const f of FIELDS) if (f in loc) draft[f] = loc[f];
  };
  if (window.IOSHost) window.mzLoadDeviceLook = async () => {
    try {
      const saved = await WebEngine.get(KEY);
      if (Object.hasOwn(themes,saved?.theme)) write(saved);
      else if (current) await WebEngine.put(KEY,current);
    } catch {}
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
