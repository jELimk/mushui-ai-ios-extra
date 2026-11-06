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
  actions.playlistNew = () => showModal('建立歌單', '<label for="mzPlaylistName">名稱</label><input id="mzPlaylistName" maxlength="60"><label for="mzPlaylistVisibility">誰看得到</label><select id="mzPlaylistVisibility"><option value="private">私人（只有自己）</option><option value="public">公開（好友看得到）</option></select><p id="mzPlaylistError" class="inline-error"></p><div class="sheet-actions"><button class="pill primary" data-action="playlistCreate">建立</button></div>');
  actions.playlistCreate = async () => {
    try {
      apply(await api({ action: 'create', name: document.querySelector('#mzPlaylistName').value, visibility: document.querySelector('#mzPlaylistVisibility').value }));
      closeModal(); render();
    } catch (e) { document.querySelector('#mzPlaylistError').textContent = clean(e); }
  };
  function openList(id) {
    const p = byId(id);
    if (!p) return closeModal();
    const edit = p.canEdit, songs = p.songs.map((x, i) => `<div class="mz-queue-row"><button class="setting-row" data-playlistplay="${esc(id)}:${i}"><span class="user-content">${esc(x.title || x.provider)}${x.addedBy ? `<small>${esc(x.addedBy)} 加入</small>` : ''}</span></button>${edit ? `<button class="pill" aria-label="上移" data-playlistmove="${esc(id)}:${i}:-1" ${i ? '' : 'disabled'}>↑</button><button class="pill" aria-label="下移" data-playlistmove="${esc(id)}:${i}:1" ${i === p.songs.length - 1 ? 'disabled' : ''}>↓</button><button class="pill" aria-label="移除" data-playlistremove="${esc(id)}:${i}">×</button>` : ''}</div>`).join('');
    const mine = p.ais.filter((a) => state.ais.some((x) => x.id === a.id));
    showModal(p.name, `<p class="help">${label(p)} · ${esc(p.ownerName)}</p><div class="mz-queue">${songs || '<p class="help">還沒有歌曲。</p>'}</div><div class="flex mz-playlist-actions">${p.songs.length ? `<button class="pill primary" data-playlistall="${esc(id)}">播放全部</button>` : ''}${edit ? `<button class="pill" data-playlistsearch="${esc(id)}">搜尋加入</button><button class="pill" data-playlistcurrent="${esc(id)}">加入正在聽的歌</button>` : ''}${edit && mine.length ? `<button class="pill" data-playlistai="${esc(id)}">請 AI 加歌</button>` : ''}${p.mine ? `<button class="pill" data-playlistedit="${esc(id)}">設定</button>` : ''}</div><p id="mzPlaylistError" class="inline-error"></p>`);
  }
  function settings(id) {
    const p = byId(id);
    const check = (name, value, text, on) => `<label class="flex"><input type="checkbox" name="${name}" value="${esc(value)}" data-name="${esc(text)}" ${on ? 'checked' : ''}> <span class="user-content">${esc(text)}</span></label>`;
    const friends = humanData().friends.filter((f) => !f.official).map((f) => check('mzPlaylistEditor', f.id, f.name, p.editors.includes(f.id))).join('');
    const ais = state.ais.map((a) => check('mzPlaylistAI', a.id, a.name, p.ais.some((x) => x.id === a.id))).join('');
    showModal('歌單設定', `<label for="mzPlaylistName">名稱</label><input id="mzPlaylistName" maxlength="60" value="${esc(p.name)}"><label for="mzPlaylistVisibility">誰看得到</label><select id="mzPlaylistVisibility"><option value="private" ${p.visibility === 'private' ? 'selected' : ''}>私人（只有自己）</option><option value="public" ${p.visibility === 'public' ? 'selected' : ''}>公開（好友看得到）</option></select>${friends ? `<div class="section-label">可以一起編輯的好友</div>${friends}` : ''}${ais ? `<div class="section-label">可以一起編輯的 AI</div>${ais}` : ''}<p id="mzPlaylistError" class="inline-error"></p><div class="sheet-actions"><button class="pill danger" data-playlistdelete="${esc(id)}">刪除歌單</button><button class="pill primary" data-playlistsave="${esc(id)}">儲存</button></div>`);
  }
  // An AI picks a song it would add, in character. Only the title goes to search; nothing plays by itself.
  async function aiPick(id) {
    const p = byId(id), s = await W.read(), names = p.songs.map((x) => x.title).slice(-30);
    let added = 0;
    for (const member of p.ais) {
      const a = s.ais.find((x) => x.id === member.id);
      if (!a) continue;
      const raw = await W.complete(s.settings, W.system(a) + '\n你正在和使用者一起編輯歌單「' + p.name + '」。依你的個性和喜好，選一首真實存在、適合這個歌單的歌。只回 JSON {query:"歌名 歌手"}。', [{ role: 'user', content: JSON.stringify({ songs: names }) }]);
      const query = String(W.json(raw).query || '').trim();
      if (!query) continue;
      const found = await W.humanRequest('/v1/listen/search', { q: query, provider: 'youtube' });
      const item = found.results?.[0];
      if (!item) continue;
      apply(await api({ action: 'add', id, song: { ...item, addedBy: a.name } }));
      names.push(item.title);
      added++;
    }
    toast(added ? 'AI 加了 ' + added + ' 首歌' : 'AI 這次沒有找到歌', 2600);
  }
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
        apply(await api({ action: 'update', id: save, name: document.querySelector('#mzPlaylistName').value, visibility: document.querySelector('#mzPlaylistVisibility').value, editors: picked('mzPlaylistEditor').map((x) => x.value), ais: picked('mzPlaylistAI').map((x) => ({ id: x.value, name: x.dataset.name })) }));
        return openList(save);
      }
    } catch (x) { const box = document.querySelector('#mzPlaylistError'); if (box) box.textContent = clean(x); else toast(clean(x)); }
  });
}
