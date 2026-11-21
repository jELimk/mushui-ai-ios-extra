'use strict';
// Friends' Moments. Public posts and the cover go to the server, and friends' posts and covers come back here.
// "Only me" and partly visible posts never leave this device.
{
  const W = WebEngine, STORE = 'friend-moments', RECENT = 7 * 86400000;
  let store = { cursor: 0, rcursor: 0, posts: [], covers: {}, reacts: {} }, pushing = false, pulling = false, loaded = false;
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
        const r = await W.humanRequest('/v1/moments?since=' + store.cursor + '&rsince=' + (store.rcursor || 0));
        // 3.4.1: likes and comments on people's posts (yours and your friends').
        if (Array.isArray(r.reacts)) { store.reacts ||= {}; for (const x of r.reacts) { changed = true; if (x.deleted) delete store.reacts[x.key]; else store.reacts[x.key] = x; } store.rcursor = r.rcursor || store.rcursor; }
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

  // 3.4.1: people's posts can be liked and commented on. The reactions live on the server (so the author and
  // their other friends see them); your own public posts show what friends left on them too.
  const safeId = (id) => /^[\w-]+$/.test(id);
  const meId = () => humanData().me?.id || '';
  const reactsFor = (owner, id) => {
    const likes = [], comments = [];
    for (const x of Object.values(store.reacts || {})) {
      if (x.postOwner !== owner || x.post !== id) continue;
      const who = x.actor === meId() ? 'me' : 'human:' + x.actor;
      if (x.kind === 'like') likes.push(who); else comments.push({ author: who, text: x.text, time: x.time, key: x.key });
    }
    comments.sort((a, b) => a.time - b.time);
    return { likes, comments };
  };
  let friendPosts = new Map();
  const momentsBefore = momentsView;
  momentsView = function () {
    if (!state || momentProfileId === 'official-mushui') return momentsBefore();
    const friends = friendIds(), mine = meId();
    const shown = store.posts.filter((p) => friends.has(p.owner) && safeId(p.id)).map((p) => ({ id: p.id, owner: p.owner, author: 'human:' + p.owner, text: p.text, images: p.images, spoilerImages: p.spoilerImages, time: p.time, ...reactsFor(p.owner, p.id) }));
    friendPosts = new Map(shown.map((p) => [p.id, p.owner]));
    const keep = state.moments, realPerson = person;
    // Your own posts: add what friends left on them.
    const own = mine ? keep.map((p) => { if (p.author !== 'me') return p; const r = reactsFor(mine, p.id); if (!r.likes.length && !r.comments.length) return p; return { ...p, likes: [...p.likes, ...r.likes.filter((x) => !p.likes.includes(x))], comments: [...p.comments, ...r.comments].sort((a, b) => a.time - b.time) }; }) : keep;
    if (!shown.length && own === keep) return momentsBefore();
    const friendCard = (id) => { const f = humanFriend(String(id).slice(6)); return { id, name: f.name || Object.values(store.reacts || {}).find((x) => 'human:' + x.actor === id)?.actorName || String(id).slice(6), avatar: f.avatar || '' }; };
    state.moments = [...own, ...shown];
    person = (id) => (String(id).startsWith('human:') ? friendCard(id) : realPerson(id));
    try { return momentsBefore(); } finally { state.moments = keep; person = realPerson; }
  };
  // Likes and comments on a friend's post go to the server instead of this device's own Moments.
  const react = async (body) => {
    const r = await W.humanRequest('/v1/moments', body);
    await pull();
    render();
    return r;
  };
  document.addEventListener('click', async (e) => {
    const b = e.target.closest?.('[data-like],[data-comment],[data-submitcomment]');
    if (!b) return;
    const id = b.dataset.like || b.dataset.comment || b.dataset.submitcomment, owner = friendPosts.get(id);
    if (!owner) return;
    e.preventDefault(); e.stopImmediatePropagation();
    try {
      if (b.dataset.like) await react({ action: 'like', owner, id });
      else if (b.dataset.comment) showModal(mzT('留句話', 'Leave a comment'), `<textarea id="commentText" placeholder="${mzT('想說點什麼…', 'Say something…')}" maxlength="1000"></textarea><div class="sheet-actions"><button class="pill primary" data-submitcomment="${esc(id)}">${mzT('送出留言', 'Send')}</button></div>`);
      else { const text = document.querySelector('#commentText')?.value || ''; await react({ action: 'comment', owner, id, text }); closeModal(); render(); }
    } catch (err) { toast(String(err.message || err).replace(/^.*HTTP \d+[：:]\s*/, '')); }
  }, true);
}
