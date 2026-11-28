'use strict';
// 3.4.4: friends' chat photos live on the server (original, never deleted). Old messages still holding a full photo
// on this device switch to the server link, so the device keeps only the short link.
{
  const W = window.WebEngine;
  const link = async () => {
    try {
      if (!humanData().connected) return;
      const r = await W.humanRequest('/v1/messages/images'), map = r?.images || {};
      const s = await W.read(), need = (s.human?.messages || []).some((m) => map[m.id] && (m.images || []).some((x) => String(x).startsWith('data:')));
      if (!need) return;
      await W.edit((x) => { for (const m of x.human.messages) if (map[m.id] && (m.images || []).some((v) => String(v).startsWith('data:'))) m.images = map[m.id]; });
      state = await call('load'); render();
    } catch {}
  };
  setTimeout(link, 8000); setTimeout(link, 120000);
}
