'use strict';
// 3.4.1: bring a playlist over from another music app. Paste its share link (NetEase, QQ Music, Spotify, Apple Music,
// KKBOX, YouTube Music…) or the song names. The AI reads out the songs, then looks for each one on Bilibili: the same
// song first; if there is none, a close version (a cover, a live take) marked as a stand-in. Before anything is saved
// the person goes through the list, can play any song to check it (previews don't count as listening history), untick
// wrong ones, and only then import. The AI compares names, uploaders and lengths; it can't hear the audio itself.
{
  const W = WebEngine;
  const MAX = 80;
  let job = null, previewing = '', previewFrame = null;
  const L = () => window.mzListenNative || {};
  const mins = (s) => (s ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : '');
  const bvid = (url) => (String(url || '').match(/BV[0-9A-Za-z]{8,14}/) || [''])[0];
  const NOTICE = () => mzT('沐水會請 AI 在 Bilibili 幫你找每一首歌：先找同一首；沒有的話，會找相似的版本（例如翻唱、現場版）代替，代替的歌會用較淡的字顯示。AI 是比對歌名、歌手、影片標題和長度，沒辦法真的聽聲音，所以導入前請先點 ▶ 試聽確認。試聽不會算進聽歌紀錄。',
    'The AI looks for each song on Bilibili: the same song first, and if there is none, a close version (a cover or a live take) as a stand-in, shown in fainter text. The AI compares names, uploaders, titles and lengths; it can\'t hear the audio, so play ▶ each song to check before importing. Previews don\'t count as listening history.');

  // The 歌單 card on the Music tab gets an import button.
  const listsHtml = window.mzPlaylistsHtml;
  if (listsHtml) window.mzPlaylistsHtml = () => {
    const html = listsHtml();
    if (!html) return html;
    const btn = `<button class="pill full mz-import-btn" data-action="mzImportStart">${mzT('導入其他 App 的歌單', 'Import a playlist from another app')}</button>`;
    const end = html.lastIndexOf('</div>');
    return end > 0 ? html.slice(0, end) + btn + html.slice(end) : html + btn;
  };

  actions.mzImportStart = () => {
    showModal(mzT('導入歌單', 'Import a playlist'), `<p class="help">${NOTICE()}</p>
      <label for="mzImportText">${mzT('歌單連結或歌名', 'Playlist link or song names')}</label>
      <textarea id="mzImportText" rows="6" placeholder="${mzT('貼上其他 App 分享的歌單連結，或一行一首歌名（例如：晴天 - 周杰倫）', 'Paste a playlist link shared from another app, or one song per line (e.g. Yesterday - The Beatles)')}"></textarea>
      <label for="mzImportName">${mzT('新歌單名稱（可不填）', 'New playlist name (optional)')}</label>
      <input id="mzImportName" maxlength="60">
      <p id="mzImportError" class="inline-error"></p>
      <div class="sheet-actions"><button class="pill primary" data-action="mzImportFind">${mzT('開始尋找', 'Find the songs')}</button></div>`);
  };

  // 1. Read out the songs: a link is fetched by the server (music sites only), then the AI picks the songs out.
  async function readSongs(text) {
    let source = text, name = '';
    const link = text.match(/https?:\/\/\S+/), lines = text.split(/\n+/).map((x) => x.trim()).filter((x) => x && !/^https?:\/\//.test(x));
    if (link && lines.length < 3) {
      const page = await W.humanRequest('/v1/listen/otherlist', { url: text });
      source = page.text || ''; name = page.name || '';
      // 3.4.1: Spotify, Apple Music, YouTube / YT Music and NetEase come back as a real song list — no AI needed
      if (Array.isArray(page.songs) && page.songs.length)
        return { name, songs: page.songs.map((x) => ({ title: String(x.title || '').trim(), artist: String(x.artist || '').trim() })).filter((x) => x.title).slice(0, MAX) };
    }
    const s = await W.read();
    let songs = [];
    try {
      const raw = await W.complete(s.settings, '你在幫使用者把其他音樂 App 的歌單搬過來。從使用者給的內容找出歌單裡的歌曲，照原本的順序，不要自己加歌，也不要把歌手當成歌名。最多 ' + MAX + ' 首。只回 JSON {"name":"歌單名稱（沒有就空字串）","songs":[{"title":"歌名","artist":"歌手"}]}', [{ role: 'user', content: source.slice(0, 40000) }]);
      const j = W.json(raw) || {};
      songs = (j.songs || []).map((x) => ({ title: String(x.title || '').trim(), artist: String(x.artist || '').trim() })).filter((x) => x.title);
      name = name || String(j.name || '');
    } catch {}
    // Without the AI, plain lines still work: 「歌名 - 歌手」.
    if (!songs.length && !link) songs = lines.map((x) => { const [t, ...a] = x.split(/\s+[-–—－]\s+|\s*\/\s*/); return { title: t.trim(), artist: a.join(' ').trim() }; }).filter((x) => x.title);
    return { name, songs: songs.slice(0, MAX) };
  }

  // 2. Bilibili candidates for one song: the song itself, plus covers in case the original isn't there.
  async function candidates(song) {
    const q = (song.title + ' ' + song.artist).trim();
    const [a, b] = await Promise.all([L().search(q).catch(() => []), L().search(song.title + ' 翻唱 cover').catch(() => [])]);
    const seen = new Set(), out = [];
    for (const x of [...a.slice(0, 6), ...b.slice(0, 3)]) if (x?.url && !seen.has(x.url)) { seen.add(x.url); out.push(x); }
    return out;
  }

  // 3. The AI chooses, a few songs at a time: same song, a stand-in, or nothing.
  async function judge(batch, settings) {
    const ask = batch.map((x) => ({ i: x.i, want: { title: x.song.title, artist: x.song.artist }, candidates: x.found.map((c, n) => ({ n, title: c.title, uploader: c.artist, seconds: c.duration })) }));
    try {
      const raw = await W.complete(settings, '你在幫使用者替每一首歌挑一支 Bilibili 影片。同一首歌（原唱、官方 MV、歌詞版、音質好的轉載都算）就選它並標 "same"；沒有同一首時，選最接近的版本（翻唱、cover、現場版、改編）並標 "similar"；都不合適就標 "none"。不要選串燒、合集、教學、reaction、或長度明顯不對（超過 12 分鐘）的影片。只回 JSON {"picks":[{"i":0,"n":0,"kind":"same"}]}', [{ role: 'user', content: JSON.stringify(ask) }]);
      const picks = (W.json(raw) || {}).picks || [];
      for (const x of batch) {
        const p = picks.find((y) => +y.i === x.i);
        const c = p && p.kind !== 'none' ? x.found[+p.n] : null;
        x.pick = c || null; x.kind = c ? (p.kind === 'similar' ? 'similar' : 'same') : 'none';
      }
    } catch {
      // No AI answer: only a candidate whose title contains the song name counts.
      for (const x of batch) {
        const c = x.found.find((f) => f.title.toLowerCase().includes(x.song.title.toLowerCase()));
        x.pick = c || null; x.kind = c ? 'same' : 'none';
      }
    }
  }

  const progress = (text) => { const el = document.querySelector('#mzImportProgress'); if (el) el.textContent = text; };
  actions.mzImportFind = async () => {
    const text = document.querySelector('#mzImportText')?.value.trim(), wanted = document.querySelector('#mzImportName')?.value.trim();
    const err = document.querySelector('#mzImportError');
    if (!text) { if (err) err.textContent = mzT('請先貼上歌單連結或歌名', 'Paste a link or song names first'); return; }
    if (!humanData().connected) { if (err) err.textContent = mzT('請先登入帳號', 'Sign in first'); return; }
    showModal(mzT('導入歌單', 'Import a playlist'), `<p class="help" id="mzImportProgress">${mzT('正在讀取歌單…', 'Reading the playlist…')}</p>`);
    let list;
    try { list = await readSongs(text); }
    catch (e) { progress(String(e.message || e).replace(/^.*HTTP \d+[：:]\s*/, '')); return; }
    if (!list.songs.length) { progress(mzT('沒有讀到歌曲。可以改成直接貼上歌名，一行一首。', 'No songs found. Try pasting the song names, one per line.')); return; }
    const s = await W.read();
    const items = list.songs.map((song, i) => ({ i, song, found: [], pick: null, kind: 'none' }));
    let done = 0;
    for (let k = 0; k < items.length; k += 3) {
      await Promise.all(items.slice(k, k + 3).map(async (x) => { x.found = await candidates(x.song); done++; progress(mzT('正在 Bilibili 尋找 ' + done + ' / ' + items.length + '…', 'Searching Bilibili ' + done + ' / ' + items.length + '…')); }));
    }
    progress(mzT('AI 正在挑選最接近的版本…', 'The AI is picking the closest versions…'));
    const withFound = items.filter((x) => x.found.length);
    for (let k = 0; k < withFound.length; k += 8) await judge(withFound.slice(k, k + 8), s.settings);
    job = { name: wanted || list.name || mzT('導入的歌單', 'Imported playlist'), items, keep: new Set(items.filter((x) => x.pick).map((x) => x.i)) };
    review();
  };

  // 4. The check before saving.
  function review() {
    const rows = job.items.map((x) => {
      const want = esc(x.song.title) + (x.song.artist ? ' · ' + esc(x.song.artist) : '');
      if (!x.pick) return `<div class="mz-import-row none"><span class="mz-import-text"><b>${want}</b><small>${mzT('Bilibili 上找不到', 'Not found on Bilibili')}</small></span></div>`;
      return `<div class="mz-import-row ${x.kind}"><input type="checkbox" data-importkeep="${x.i}" ${job.keep.has(x.i) ? 'checked' : ''} aria-label="${mzT('導入這首', 'Import this song')}"><span class="mz-import-text"><b>${want}</b><span class="user-content">${esc(x.pick.title)}${x.pick.duration ? ' · ' + mins(x.pick.duration) : ''}</span>${x.kind === 'similar' ? `<small>${mzT('相似版本（代替）', 'A close version (stand-in)')}</small>` : ''}</span><button class="pill" type="button" data-importplay="${x.i}" aria-label="${mzT('試聽', 'Preview')}">${previewing === bvid(x.pick.url) ? '■' : '▶'}</button></div>`;
    }).join('');
    const found = job.items.filter((x) => x.pick).length, similar = job.items.filter((x) => x.kind === 'similar').length;
    showModal(mzT('檢查歌單', 'Check the playlist'), `<p class="help">${mzT('找到 ' + found + ' / ' + job.items.length + ' 首' + (similar ? '，其中 ' + similar + ' 首是相似版本（字比較淡）' : '') + '。請點 ▶ 試聽，取消勾選不對的歌，再按導入。試聽不會算進聽歌紀錄。', found + ' of ' + job.items.length + ' found' + (similar ? ', ' + similar + ' of them close versions (fainter text)' : '') + '. Play ▶ to check, untick wrong ones, then import. Previews don\'t count as listening history.')}</p>
      <label for="mzImportName2">${mzT('歌單名稱', 'Playlist name')}</label><input id="mzImportName2" maxlength="60" value="${esc(job.name)}">
      <div class="mz-import-preview" ${previewing ? '' : 'hidden'}><div class="mz-import-video"></div></div>
      <div class="mz-import-list">${rows}</div>
      <p id="mzImportError" class="inline-error"></p>
      <div class="sheet-actions"><button class="pill" data-action="mzImportCancel">${mzT('取消', 'Cancel')}</button><button class="pill primary" data-action="mzImportSave" ${job.keep.size ? '' : 'disabled'}>${mzT('導入 ' + job.keep.size + ' 首', 'Import ' + job.keep.size)}</button></div>`);
    if (previewing) placePreview();
  }

  // Previews: a player in the sheet on a computer; on a phone the native video view laid over the same spot.
  function placePreview() {
    const box = document.querySelector('.mz-import-video');
    if (!box || !previewing) return;
    box.closest('.mz-import-preview').hidden = false;
    if (L().on) {
      const r = box.getBoundingClientRect();
      Desktop.invoke('listenPlayer', { url: 'https://player.bilibili.com/player.html?bvid=' + previewing + '&autoplay=1&high_quality=0&danmaku=0&t=1', x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height), clipTop: 0, clipBottom: 0, moving: false, show: true, boot: L().boot }).catch(() => {});
      return;
    }
    if (!previewFrame || !previewFrame.isConnected) { previewFrame = document.createElement('iframe'); previewFrame.allow = 'autoplay; encrypted-media'; previewFrame.title = mzT('試聽', 'Preview'); box.append(previewFrame); }
    const src = L().player ? L().player(previewing) : 'https://player.bilibili.com/player.html?bvid=' + previewing + '&autoplay=1&danmaku=0&t=1';
    if (!previewFrame.src.includes(previewing)) previewFrame.src = src;
  }
  function stopPreview() {
    if (!previewing) return;
    previewing = '';
    if (previewFrame) { previewFrame.src = 'about:blank'; previewFrame.remove(); previewFrame = null; }
    if (L().on) { Desktop.invoke('listenPlayer', { url: '', x: -4000, y: 0, width: 320, height: 180, clipTop: 0, clipBottom: 0, moving: false, show: false }).catch(() => {}); L().reset?.(); }
  }
  // Leaving the sheet any way stops the preview.
  const closeBefore = closeModal;
  closeModal = function (...a) { stopPreview(); return closeBefore.apply(this, a); };
  // The sheet's ✕ calls the action directly (it kept the original function), so that path stops it too.
  if (actions.closeModal) { const closeAction = actions.closeModal; actions.closeModal = function (...a) { stopPreview(); return closeAction.apply(this, a); }; }

  document.addEventListener('click', (e) => {
    const play = e.target.closest?.('[data-importplay]');
    if (play && job) {
      const x = job.items[+play.dataset.importplay], id = bvid(x?.pick?.url);
      if (!id) return;
      if (previewing === id) { stopPreview(); review(); return; }
      if (L().on && L().busy?.()) { toast(mzT('正在一起聽歌時不能試聽，先停止播放再試', 'Stop the song that is playing to preview')); return; }
      stopPreview(); previewing = id; review();
    }
  });
  document.addEventListener('change', (e) => {
    const box = e.target.closest?.('[data-importkeep]');
    if (!box || !job) return;
    const i = +box.dataset.importkeep;
    if (box.checked) job.keep.add(i); else job.keep.delete(i);
    const btn = document.querySelector('[data-action="mzImportSave"]');
    if (btn) { btn.disabled = !job.keep.size; btn.textContent = mzT('導入 ' + job.keep.size + ' 首', 'Import ' + job.keep.size); }
  });
  document.addEventListener('input', (e) => { if (e.target.id === 'mzImportName2' && job) job.name = e.target.value; });
  actions.mzImportCancel = () => { job = null; closeModal(); };

  // 5. Save: a new private playlist with the ticked songs, in the original order.
  actions.mzImportSave = async () => {
    if (!job || !job.keep.size) return;
    const btn = document.querySelector('[data-action="mzImportSave"]'), err = document.querySelector('#mzImportError');
    if (btn) { btn.disabled = true; btn.textContent = mzT('導入中…', 'Importing…'); }
    stopPreview();
    try {
      const name = (job.name || mzT('導入的歌單', 'Imported playlist')).slice(0, 60);
      const made = await W.humanRequest('/v1/playlists', { action: 'create', name, visibility: 'private' });
      const list = [...(made.mine || [])].reverse().find((p) => p.name === name);
      if (!list) throw Error(mzT('建立歌單失敗', "Couldn't create the playlist"));
      let added = 0;
      for (const x of job.items) if (job.keep.has(x.i) && x.pick) {
        try { await W.humanRequest('/v1/playlists', { action: 'add', id: list.id, song: { ...x.pick, addedBy: mzT('導入', 'Import') } }); added++; } catch {}
      }
      job = null;
      closeBefore();
      window.mzPlaylistsReload?.();
      toast(mzT('已導入 ' + added + ' 首歌到「' + name + '」', 'Imported ' + added + ' songs into “' + name + '”'), 4000);
      render();
    } catch (e) {
      if (err) err.textContent = String(e.message || e).replace(/^.*HTTP \d+[：:]\s*/, '');
      if (btn) { btn.disabled = false; btn.textContent = mzT('導入 ' + job.keep.size + ' 首', 'Import ' + job.keep.size); }
    }
  };

  const css = document.createElement('style');
  css.textContent = `
.mz-import-btn{margin-top:8px}
.mz-import-list{display:flex;flex-direction:column;gap:2px;max-height:46dvh;overflow:auto;margin:10px 0}
.mz-import-row{display:flex;align-items:center;gap:10px;padding:10px 2px;border-bottom:1px solid var(--line)}
.mz-import-row:last-child{border-bottom:0}
.mz-import-row input{flex:0 0 auto;margin:0}
.mz-import-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.mz-import-text b{font-size:14px;font-weight:600}
.mz-import-text span,.mz-import-text small{font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mz-import-row.similar .mz-import-text b,.mz-import-row.similar .mz-import-text span{opacity:.55}
.mz-import-row.none{opacity:.5}
.mz-import-row .pill{min-width:44px;padding:8px 12px}
.mz-import-preview{margin:10px 0}
.mz-import-video{position:relative;width:100%;aspect-ratio:16/9;border-radius:16px;overflow:hidden;background:#000}
.mz-import-video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
`;
  document.head.append(css);
}
