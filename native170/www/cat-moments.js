'use strict';
// 3.4.4: the three cats post Moments too — only posts written in advance (the user sends the photos and says which cat
// and what the post says; they go in POSTS below, photos in assets/cats/moments/). No AI is used.
// The posts appear in the cats' Moments while the cat theme is on, and are taken out again in every other theme.
{
  const W = window.WebEngine;
  // { id: unique, cat: 'mz-cat-orange' | 'mz-cat-tabby' | 'mz-cat-siamese', date: 'YYYY-MM-DDTHH:MM',
  //   text: ['中文', 'English'], images: ['cats/moments/lion-1.jpg', …] (up to 9) }
  const POSTS = [];
  const PREFIX = 'mz-catpost-';
  const catOn = () => document.documentElement.classList.contains('mz-cat');
  let busy = false;
  const sync = async () => {
    if (busy || !W || window.MizukiStaffEdition) return; busy = true;
    try {
      const s = await W.read(), on = catOn(), now = Date.now();
      const have = new Set((s.moments || []).filter((m) => String(m.id).startsWith(PREFIX)).map((m) => m.id));
      const want = on ? POSTS.filter((p) => Date.parse(p.date) <= now && s.ais.some((a) => a.id === p.cat)) : [];
      const add = want.filter((p) => !have.has(PREFIX + p.id)), drop = [...have].filter((id) => !want.some((p) => PREFIX + p.id === id));
      if (!add.length && !drop.length) return;
      await W.edit((x) => {
        x.moments = (x.moments || []).filter((m) => !drop.includes(m.id));
        for (const p of add) x.moments.push({ id: PREFIX + p.id, author: p.cat, text: mzT(...p.text), images: p.images || [], time: Date.parse(p.date), likes: [], comments: [], mzCatPost: true });
      });
      state = await W.view(); render();
    } catch {} finally { busy = false; }
  };
  const applyBefore = applyTheme;
  applyTheme = function (...a) { const r = applyBefore.apply(this, a); setTimeout(sync, 1500); return r; };
  setInterval(sync, 10 * 60000); setTimeout(sync, 3000);
  window.mzCatMoments = { POSTS, sync };
}
