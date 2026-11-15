'use strict';
// Friends' Moments. Public posts and the cover go to the server, and friends' posts and covers come back here.
// "Only me" and partly visible posts never leave this device.
{
  const W = WebEngine, STORE = 'friend-moments', RECENT = 7 * 86400000;
  let store = { cursor: 0, posts: [], covers: {} }, pushing = false, pulling = false, loaded = false;
  const failed = new Map();
  const ready = () => !!(state && humanData().connected && humanData().me?.id);
  const sentKey = () => 'mzMomentsSent:' + humanData().me.id;
  const readSent = () => { try { return JSON.parse(localStorage.getItem(sentKey()) || '{}'); } catch { return {}; } };
  const writeSent = (sent) => { try { localStorage.setItem(sentKey(), JSON.stringify(sent)); } catch {} };
  const coverMark = (cover) => (cover ? cover.length + ':' + cover.slice(-32) : '');
  const friendIds = () => new Set(humanData().friends.map((f) => f.id));

  async function push() {
    if (pushing || !ready()) return;
    pushing = true;
    try {
      const sent = readSent(), now = Date.now();
      for (const p of state.moments) {
        if (p.author !== 'me' || p.visibleTo || sent[p.id] || now - p.time > RECENT || (failed.get(p.id) || 0) >= 3) continue;
        try {
          await W.humanRequest('/v1/moments', { action: 'post', id: p.id, text: p.text || '', images: p.images || [], spoilerImages: !!p.spoilerImages, time: p.time });
          sent[p.id] = 1;
          writeSent(sent);
        } catch (e) { failed.set(p.id, (failed.get(p.id) || 0) + 1); }
      }
      // A device with no posts at all may simply not have loaded them yet, so nothing is taken back from there.
      if (state.moments.length) for (const id of Object.keys(sent)) {
        if (id === '__cover' || state.moments.some((p) => p.id === id)) continue;
        await W.humanRequest('/v1/moments', { action: 'delete', id });
        delete sent[id];
        writeSent(sent);
      }
      const cover = state.settings.cover || '', mark = coverMark(cover);
      if ((sent.__cover || '') !== mark && (failed.get('__cover') || 0) < 3) {
        try { await W.humanRequest('/v1/moments', { action: 'cover', cover }); sent.__cover = mark; writeSent(sent); }
        catch (e) { failed.set('__cover', (failed.get('__cover') || 0) + 1); }
      }
    } catch {} finally { pushing = false; }
  }

  async function pull() {
    if (pulling || !ready()) return;
    pulling = true;
    try {
      if (!loaded) { store = { ...store, ...((await W.get(STORE)) || {}) }; loaded = true; }
      let changed = false, more = true;
      while (more) {
        const r = await W.humanRequest('/v1/moments?since=' + store.cursor);
        for (const item of r.items) {
          changed = true;
          if (item.kind === 'cover') { if (item.deleted) delete store.covers[item.owner]; else store.covers[item.owner] = item.images[0]; continue; }
          store.posts = store.posts.filter((p) => !(p.owner === item.owner && p.id === item.id));
          if (!item.deleted) store.posts.push(item);
        }
        store.cursor = r.cursor;
        more = r.more;
      }
      if (!changed) return;
      store.posts = store.posts.sort((a, b) => b.time - a.time).slice(0, 200);
      await W.put(STORE, store);
      if (tab === 'moments' && !chatId && !page && !modal) render();
    } catch {} finally { pulling = false; }
  }

  setInterval(push, 15000);
  setInterval(pull, 30000);
  setTimeout(() => { push(); pull(); }, 4000);
  const publishBefore = actions.publish; actions.publish = async (...args) => { const r = await publishBefore(...args); push(); return r; };
  const coverBefore = actions.cover; actions.cover = async (...args) => { const r = await coverBefore(...args); push(); return r; };
  const refreshBefore = actions.refreshMoments; actions.refreshMoments = async (...args) => { await Promise.all([pull(), push()]); return refreshBefore(...args); };

  window.mzFriendCover = (id) => store.covers[id] || '';

  // Friends' posts are read-only here: likes and comments live on each person's own device.
  const safeId = (id) => /^[\w-]+$/.test(id);
  const momentsBefore = momentsView;
  momentsView = function () {
    if (!state || momentProfileId === 'official-mushui') return momentsBefore();
    const friends = friendIds(), shown = store.posts.filter((p) => friends.has(p.owner) && safeId(p.id)).map((p) => ({ id: p.id, author: 'human:' + p.owner, text: p.text, images: p.images, spoilerImages: p.spoilerImages, time: p.time, likes: [], comments: [] }));
    if (!shown.length) return momentsBefore();
    const keep = state.moments, realPerson = person;
    const friendCard = (id) => { const f = humanFriend(String(id).slice(6)); return { id, name: f.name || String(id).slice(6), avatar: f.avatar || '' }; };
    state.moments = [...keep, ...shown];
    person = (id) => (String(id).startsWith('human:') ? friendCard(id) : realPerson(id));
    try {
      let html = momentsBefore();
      for (const p of shown) html = html.replace(new RegExp('<button data-like="' + p.id + '"[^>]*>[\\s\\S]*?</button>'), '').replace(new RegExp('<button data-comment="' + p.id + '"[^>]*>[\\s\\S]*?</button>'), '');
      return html;
    } finally { state.moments = keep; person = realPerson; }
  };
}
