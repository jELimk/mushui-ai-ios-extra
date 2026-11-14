'use strict';
// 3.3.2: playlists. Private, public to friends, edited with friends, or with AIs adding songs they would pick.
{
  const W = WebEngine;
  let lists = { mine: [], shared: [], friends: [] }, loadedAt = 0, loading = false;
  const api = (body) => W.humanRequest('/v1/playlists', body);
  const all = () => [...lists.mine, ...lists.shared, ...lists.friends];
  const byId = (id) => all().find((x) => x.id === id);
  const clean = (e) => String(e.message).replace(/^.*HTTP \d+[：:]\s*/, '');
  const onMusic = () => tab === 'music' && !chatId && !page;
  async function refresh(force) {
    if (loading || !humanData().connected || (!force && Date.now() - loadedAt < 15000)) return;
    loading = true;
    try {
      const next = await api();
      const changed = JSON.stringify(next) !== JSON.stringify(lists);
      lists = next; loadedAt = Date.now();
      if (changed && onMusic() && !modal) render();
    } catch {} finally { loading = false; }
  }
  const apply = (next) => { lists = next; loadedAt = Date.now(); };
  const label = (p) => (p.editors.length || p.ais.length ? '多人編輯' : p.visibility === 'public' ? '公開' : '私人');
  const row = (p) => `<button class="setting-row" data-playlist="${esc(p.id)}"><span class="user-content">${esc(p.name)}</span><small>${label(p)} · ${p.songs.length} 首${p.mine ? '' : ' · ' + esc(p.ownerName)}</small></button>`;

  window.mzPlaylistsHtml = () => {
    refresh();
    if (!humanData().connected) return '';
    const rows = all().map(row).join('');
    return `<div class="section-label">歌單</div><div class="card">${rows || '<p class="help">建立歌單，收藏想一起聽的歌。</p>'}<button class="pill full" data-action="playlistNew">建立歌單</button></div>`;
  };
  actions.playlistNew = () => showModal('建立歌單', '<label for="mzPlaylistName">名稱</label><input id="mzPlaylistName" maxlength="60"><label for="mzPlaylistVisibility">誰看得到</label><select id="mzPlaylistVisibility"><option value="private">私人（只有自己）</option><option value="public">公開（好友看得到）</option></select><p class="help">建立後可以在歌單裡邀請 AI 或好友一起編輯。</p><p id="mzPlaylistError" class="inline-error"></p><div class="sheet-actions"><button class="pill primary" data-action="playlistCreate">建立</button></div>');
  actions.playlistCreate = async () => {
    try {
      apply(await api({ action: 'create', name: document.querySelector('#mzPlaylistName').value, visibility: document.querySelector('#mzPlaylistVisibility').value }));
      closeModal(); render();
    } catch (e) { document.querySelector('#mzPlaylistError').textContent = clean(e); }
  };
  function openList(id) {
    const p = byId(id);
    if (!p) return closeModal();
    const edit = p.canEdit, songs = p.songs.map((x, i) => `<div class="mz-queue-row"><button class="setting-row" data-playlistplay="${esc(id)}:${i}"><span class="user-content" ${x.title ? '' : `data-mzsongtitle="${esc(x.media || String(x.url || '').split('/video/')[1] || '')}"`}>${esc(x.title || mzT('讀取標題中…', 'Loading title…'))}${x.addedBy ? `<small>${esc(x.addedBy)} 加入</small>` : ''}</span></button>${edit ? `<button class="pill" aria-label="上移" data-playlistmove="${esc(id)}:${i}:-1" ${i ? '' : 'disabled'}>↑</button><button class="pill" aria-label="下移" data-playlistmove="${esc(id)}:${i}:1" ${i === p.songs.length - 1 ? 'disabled' : ''}>↓</button><button class="pill" aria-label="移除" data-playlistremove="${esc(id)}:${i}">×</button>` : ''}</div>`).join('');
    const mine = p.ais.filter((a) => state.ais.some((x) => x.id === a.id));
    showModal(p.name, `<p class="help">${label(p)} · ${esc(p.ownerName)}</p><div class="mz-queue">${songs || '<p class="help">還沒有歌曲。</p>'}</div><div class="flex mz-playlist-actions">${p.songs.length ? `<button class="pill primary" data-playlistall="${esc(id)}">播放全部</button>` : ''}${edit ? `<button class="pill" data-playlistsearch="${esc(id)}">搜尋加入</button><button class="pill" data-playlistcurrent="${esc(id)}">加入正在聽的歌</button>` : ''}${edit && mine.length ? `<button class="pill" data-playlistai="${esc(id)}">請 AI 加歌</button>` : ''}${p.mine ? `<button class="pill" data-playlistedit="${esc(id)}">邀請 AI 或好友編輯</button>` : ''}</div><p id="mzPlaylistError" class="inline-error"></p>`);
  }
  function settings(id) {
    const p = byId(id);
    const check = (name, value, text, on) => `<label class="flex"><input type="checkbox" name="${name}" value="${esc(value)}" data-name="${esc(text)}" ${on ? 'checked' : ''}> <span class="user-content">${esc(text)}</span></label>`;
    const friends = humanData().friends.filter((f) => !f.official).map((f) => check('mzPlaylistEditor', f.id, f.name, p.editors.includes(f.id))).join('');
    const ais = state.ais.map((a) => check('mzPlaylistAI', a.id, a.name, p.ais.some((x) => x.id === a.id))).join('');
    showModal('歌單設定', `<label for="mzPlaylistName">名稱</label><input id="mzPlaylistName" maxlength="60" value="${esc(p.name)}"><label for="mzPlaylistVisibility">誰看得到</label><select id="mzPlaylistVisibility"><option value="private" ${p.visibility === 'private' ? 'selected' : ''}>私人（只有自己）</option><option value="public" ${p.visibility === 'public' ? 'selected' : ''}>公開（好友看得到）</option></select>${friends ? `<div class="section-label">可以一起編輯的好友</div>${friends}` : ''}${ais ? `<div class="section-label">可以一起編輯的 AI</div>${ais}` : ''}<p id="mzPlaylistError" class="inline-error"></p><div class="sheet-actions"><button class="pill danger" data-playlistdelete="${esc(id)}">刪除歌單</button><button class="pill primary" data-playlistsave="${esc(id)}">儲存</button></div>`);
  }
  // An AI picks a song it would add, in character. Only the title goes to search; nothing plays by itself.
  async function aiPick(id, only) {
    const p = byId(id), s = await W.read(), names = p.songs.map((x) => x.title).slice(-30);
    let added = 0;
    for (const member of p.ais.filter((x) => !only || only.includes(x.id))) {
      const a = s.ais.find((x) => x.id === member.id);
      if (!a) continue;
      // 3.4.0: the AI decides how many songs to add (1 to 10) and which, by its personality, every time it's asked.
      const raw = await W.complete(s.settings, W.system(a) + '\n你正在和使用者一起編輯歌單「' + p.name + '」。依你的個性和喜好，決定這次要加幾首（1～10 首，看你有多想加）以及加哪些：真實存在、適合這個歌單、Bilibili 上找得到、不要和已有的重複。只回 JSON {queries:["歌名 歌手", ...]}。', [{ role: 'user', content: JSON.stringify({ songs: names }) }]);
      const reply = W.json(raw), queries = (Array.isArray(reply.queries) ? reply.queries : [reply.query]).map((q) => String(q || '').trim()).filter(Boolean).slice(0, 10);
      for (const query of queries) {
        const found = await W.humanRequest('/v1/listen/search', { q: query }).catch(() => ({}));
        const item = (found.results || []).find((x) => !byId(id)?.songs.some((y) => y.url === x.url));
        if (!item) continue;
        try { apply(await api({ action: 'add', id, song: { ...item, addedBy: a.name } })); } catch { break; }
        names.push(item.title);
        added++;
      }
    }
    toast(added ? 'AI 加了 ' + added + ' 首歌' : 'AI 這次沒有找到歌', 2600);
  }
  // 3.4.0: inviting friends to edit sends each of them a card. One message goes to everyone; tapping a person gives
  // them a message of their own.
  const INVITE = /^邀請你一起編輯歌單[：:]\s*(.*?)\n([\s\S]*?)\n?mizuki-playlist:\/\/([\w-]+)\s*$/;
  let inviting = null;
  function inviteCard(id, people, aiIds = []) {
    inviting = { id, people, own: {}, aiIds };
    const rows = people.map((p) => `<button type="button" class="setting-row" data-playlistinviteone="${esc(p.id)}"><span class="user-content">${esc(p.name)}</span><small data-playlistinvitewhat="${esc(p.id)}">${mzT('使用共同訊息', 'Same message')}</small></button><textarea class="mz-invite-own" data-playlistinviteown="${esc(p.id)}" maxlength="300" rows="2" hidden placeholder="${mzT('只給這個人的訊息', 'A message just for them')}"></textarea>`).join('');
    showModal(mzT('邀請一起編輯', 'Invite to edit'), `<p class="help">${mzT('會傳一張歌單卡片給下面的好友。可以加一段訊息一起傳（可不填），大家收到的都一樣；想單獨改某個人的，點一下那個人。', 'Each friend below gets a playlist card. You can add a message (optional); everyone gets the same one. Tap a person to write them their own.')}</p><label for="mzPlaylistInviteNote">${mzT('一起傳的訊息', 'Message')}</label><textarea id="mzPlaylistInviteNote" maxlength="300" rows="2"></textarea><div class="mz-queue">${rows}</div><div class="sheet-actions"><button class="pill" type="button" data-playlistinviteskip="${esc(id)}">${mzT('不傳', 'Don\'t send')}</button><button class="pill primary" type="button" data-playlistinvitesend="${esc(id)}">${mzT('傳送邀請', 'Send invite')}</button></div>`);
  }
  async function sendInvites() {
    const p = byId(inviting.id), shared = document.querySelector('#mzPlaylistInviteNote')?.value.trim() || '';
    for (const person of inviting.people) {
      const box = document.querySelector(`[data-playlistinviteown="${CSS.escape(person.id)}"]`), note = box && !box.hidden ? box.value.trim() : shared;
      const text = '邀請你一起編輯歌單：' + (p?.name || '') + '\n' + (note ? note + '\n' : '') + 'mizuki-playlist://' + inviting.id;
      // An AI gets the card in its own chat and answers it like any message.
      if (person.ai) {
        let chat = state.chats.find((c) => c.members.length === 1 && c.members[0] === person.id)?.id;
        if (!chat) chat = (await mutate('newChat', { members: [person.id] }).catch(() => ({}))).chatId;
        if (chat) await call('send', { id: chat, text, images: [] }).then((r) => { if (r?.state) state = r.state; }).catch(() => {});
      } else await call('human', { action: 'send', id: person.id, text, images: [], clientMessageId: crypto.randomUUID() }).catch(() => {});
    }
    toast(mzT('已傳送邀請', 'Invites sent'));
  }
  // The card in the chat: tap to open the playlist.
  function decorate() {
    for (const bubble of document.querySelectorAll('.message .bubble:not([data-playlistcarded])')) {
      if (!bubble.textContent.includes('mizuki-playlist://')) continue;
      const hit = INVITE.exec((bubble.innerText || bubble.textContent).trim());
      if (!hit) continue;
      bubble.dataset.playlistcarded = '1';
      bubble.classList.add('mz-song-bubble');
      bubble.innerHTML = `<button class="mz-song-card" data-playlistcard="${esc(hit[3])}"><span class="mz-song-cover">${icon('music')}</span><span class="mz-song-text user-content"><b>${esc(hit[1] || mzT('歌單', 'Playlist'))}</b><small>${mzT('邀請你一起編輯歌單', 'Invites you to edit a playlist')}</small>${hit[2].trim() ? `<span class="mz-playlist-note">${esc(hit[2].trim())}</span>` : ''}</span><span class="mz-song-play" aria-hidden="true"></span></button>`;
    }
  }
  const renderBeforeCards = render;
  render = function (...args) { const r = renderBeforeCards.apply(this, args); try { decorate(); } catch {} return r; };
  setInterval(() => { try { decorate(); } catch {} }, 1500);
  document.addEventListener('click', async (e) => {
    const card = e.target.closest('[data-playlistcard]'), one = e.target.closest('[data-playlistinviteone]');
    if (one) {
      const id = one.dataset.playlistinviteone, box = document.querySelector(`[data-playlistinviteown="${CSS.escape(id)}"]`), what = document.querySelector(`[data-playlistinvitewhat="${CSS.escape(id)}"]`);
      if (box) { box.hidden = !box.hidden; if (!box.hidden) { box.value ||= document.querySelector('#mzPlaylistInviteNote')?.value || ''; box.focus(); } }
      if (what) what.textContent = box && !box.hidden ? mzT('單獨的訊息', 'Own message') : mzT('使用共同訊息', 'Same message');
      return;
    }
    if (e.target.closest('[data-playlistinvitesend],[data-playlistinviteskip]')) {
      const id = inviting?.id, aiIds = inviting?.aiIds || [], sending = !!e.target.closest('[data-playlistinvitesend]');
      if (sending) { try { await sendInvites(); } catch (x) { toast(clean(x)); } }
      inviting = null; openList(id);
      // Invited AIs then add songs of their own.
      if (aiIds.length) aiPick(id, aiIds).then(() => openList(id)).catch((x) => toast(clean(x)));
      return;
    }
    if (!card) return;
    try { if (!byId(card.dataset.playlistcard)) { loadedAt = 0; await refresh(true); } if (!byId(card.dataset.playlistcard)) return toast(mzT('找不到這個歌單，可能已被刪除或移除了你', 'This playlist is gone, or you were removed from it')); openList(card.dataset.playlistcard); } catch (x) { toast(clean(x)); }
  });
  document.addEventListener('click', async (e) => {
    const hit = (name) => e.target.closest('[data-' + name + ']')?.dataset[name];
    const open = hit('playlist'), play = hit('playlistplay'), all_ = hit('playlistall'), move = hit('playlistmove'), remove = hit('playlistremove'), search = hit('playlistsearch'), current = hit('playlistcurrent'), edit = hit('playlistedit'), save = hit('playlistsave'), drop = hit('playlistdelete'), pick = hit('playlistai');
    if (!open && !play && !all_ && !move && !remove && !search && !current && !edit && !save && !drop && !pick) return;
    try {
      if (open) return openList(open);
      if (edit) return settings(edit);
      if (play) { const [id, i] = play.split(':'); closeModal(); return await window.mzListenApi.playList(byId(id).songs, +i); }
      if (all_) { closeModal(); return await window.mzListenApi.playList(byId(all_).songs, 0); }
      if (move) { const [id, i, d] = move.split(':'); apply(await api({ action: 'move', id, index: +i, delta: +d })); return openList(id); }
      if (remove) { const [id, i] = remove.split(':'); apply(await api({ action: 'remove', id, index: +i })); return openList(id); }
      if (search) { window.mzListenApi.searchInto(async (song) => { apply(await api({ action: 'add', id: search, song })); toast('已加入歌單'); }); return; }
      if (current) { const song = window.mzListenApi.current(); if (!song) return toast('目前沒有正在聽的歌'); apply(await api({ action: 'add', id: current, song })); return openList(current); }
      if (pick) { await aiPick(pick); return openList(pick); }
      if (drop) { apply(await api({ action: 'delete', id: drop })); closeModal(); return render(); }
      if (save) {
        const picked = (name) => [...document.querySelectorAll('input[name="' + name + '"]:checked')];
        const had = byId(save).ais.map((a) => a.id), hadPeople = [...byId(save).editors];
        apply(await api({ action: 'update', id: save, name: document.querySelector('#mzPlaylistName').value, visibility: document.querySelector('#mzPlaylistVisibility').value, editors: picked('mzPlaylistEditor').map((x) => x.value), ais: picked('mzPlaylistAI').map((x) => ({ id: x.value, name: x.dataset.name })) }));
        const fresh = picked('mzPlaylistAI').map((x) => x.value).filter((id) => !had.includes(id));
        const newPeople = [...picked('mzPlaylistEditor').map((x) => ({ id: x.value, name: x.dataset.name })).filter((x) => !hadPeople.includes(x.id)), ...fresh.map((id) => ({ id, name: ai(id)?.name || 'AI', ai: true }))];
        if (newPeople.length) inviteCard(save, newPeople, fresh);
        else openList(save);
        // An AI that was just invited joins in straight away (after its card, when there is one).
        if (fresh.length && !newPeople.length) aiPick(save, fresh).then(() => openList(save)).catch((x) => toast(clean(x)));
        return;
      }
    } catch (x) { const box = document.querySelector('#mzPlaylistError'); if (box) box.textContent = clean(x); else toast(clean(x)); }
  });
}

// Songs saved without a title get their video title filled in on screen.
setInterval(() => {
  for (const el of document.querySelectorAll('[data-mzsongtitle]:not([data-mzfilled])')) {
    el.dataset.mzfilled = '1';
    window.mzSongTitle?.('bilibili', el.dataset.mzsongtitle).then((t) => { if (el.isConnected) el.firstChild.textContent = t || 'Bilibili'; }).catch(() => {});
  }
}, 1200);
