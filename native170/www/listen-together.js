'use strict';
// 3.2.2: listen together. A room on the server holds who is listening and where the song is; AIs join as names on the
// room and are told what is playing. Exactly two listeners share a pair of earbuds. The player runs on the server's
// page (listen-player.js) because YouTube won't play for an app page.
{
  const W = WebEngine, NAMES = { local: '本地音樂', youtube: 'YouTube', ytmusic: 'YouTube Music', spotify: 'Spotify', apple: 'Apple Music', kkbox: 'KKBOX', bilibili: 'Bilibili' };
  // What each service asks of the people listening, shown before they choose it.
  const SERVICES = [
    ['youtube', '有廣告', 'https://www.youtube.com/'],
    ['bilibili', '沒有廣告', 'https://www.bilibili.com/'],
    ['ytmusic', '雙方都要會員', 'https://music.youtube.com/'],
    ['spotify', '雙方都要會員', 'https://open.spotify.com/'],
    ['apple', '雙方都要會員', 'https://music.apple.com/'],
    ['kkbox', '雙方都要會員', 'https://www.kkbox.com/'],
  ];
  const linkOf = (p, m) => ({ local: 'mizuki-local://' + m, youtube: 'https://youtu.be/' + m, ytmusic: 'https://music.youtube.com/watch?v=' + m, spotify: 'https://open.spotify.com/' + m, bilibili: 'https://www.bilibili.com/video/' + m, apple: 'https://music.apple.com/' + m, kkbox: 'https://www.kkbox.com/tw/tc/' + m }[p]);
  const recent = () => { try { return JSON.parse(localStorage.getItem('mzRecentSongs') || '[]'); } catch { return []; } };
  const remember = (song) => { try { localStorage.setItem('mzRecentSongs', JSON.stringify([song, ...recent().filter((x) => x.url !== song.url)].slice(0, 20))); } catch {} };
  let live = null, skew = 0, offered = '', polling = false, invite = null, quiet = 0, localList = [], lastNotice = '';
  const notes = { spotify: '要各自按播放，暫停不會同步；沒會員可能只能聽片段。', apple: '要各自按播放，暫停不會同步；沒會員可能只能聽片段。', kkbox: '要各自按播放，暫停不會同步；沒會員可能只能聽片段。', bilibili: '只會同步開始的位置，暫停不會同步。', ytmusic: '播放、暫停和跳轉都會同步。' };
  const server = () => String(humanData().serverUrl || window.MIZUKI_SERVER || location.origin).replace(/\/+$/, '');
  const panel = () => document.querySelector('#mzListen');
  const player = () => panel()?.querySelector('iframe');
  const target = (s) => s.position + (s.playing ? Math.max(0, Date.now() + skew - s.at) / 1000 : 0);
  const english = () => document.documentElement.lang.startsWith('en');
  const clean = (e) => String(e.message).replace(/^.*HTTP \d+[：:]\s*/, '');
  const post = (body) => W.humanRequest('/v1/listen', body);
  const song = () => (live ? live.title || NAMES[live.provider] : '');
  const myAis = () => (live?.ais || []).filter((a) => a.owner === humanData().me?.id).map((a) => a.id);

  // Local music stays in this device's own database. Two people match on the file's fingerprint, not its name.
  const openDb = () => new Promise((resolve, reject) => {
    const q = indexedDB.open('mizuki-music', 1);
    q.onupgradeneeded = () => q.result.createObjectStore('songs', { keyPath: 'hash' });
    q.onsuccess = () => resolve(q.result);
    q.onerror = () => reject(q.error);
  });
  const songs = async (mode, work) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const t = db.transaction('songs', mode), q = work(t.objectStore('songs'));
      t.oncomplete = () => { db.close(); resolve(q.result); };
      t.onerror = t.onabort = () => { db.close(); reject(t.error || Error('音樂儲存失敗')); };
    });
  };
  const refreshLocal = async () => {
    const all = await songs('readonly', (s) => s.getAll()).catch(() => []);
    localList = all.map(({ hash, title }) => ({ hash, title })).sort((a, b) => a.title.localeCompare(b.title));
    if (tab === 'music' && !chatId && !page) render();
  };
  setTimeout(refreshLocal, 1500);
  const pickSong = () => new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*,.mp3,.m4a,.flac,.wav,.ogg,.aac';
    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) return resolve('');
        if (file.size > 200 * 1024 * 1024) throw Error('音樂檔案不能超過 200 MB');
        const data = await file.arrayBuffer(), digest = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
        const hash = [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
        await songs('readwrite', (s) => s.put({ hash, title: file.name.replace(/\.[^.]+$/, '').slice(0, 160), type: file.type || 'audio/mpeg', data }));
        await refreshLocal();
        resolve(hash);
      } catch (e) { reject(e); }
    };
    input.click();
  });
  const audioEl = () => panel()?.querySelector('audio');
  async function pushState(playing, position) {
    if (!live) return;
    live.playing = playing;
    notice();
    if (live.solo) return;
    try {
      const r = await post({ action: 'update', playing, position });
      if (live && r.session) live.at = live.mine = r.session.at;
    } catch {}
  }
  async function loadLocal(el) {
    const song = await songs('readonly', (s) => s.get(live.media)).catch(() => null);
    if (!song) return toast('找不到這首本地音樂');
    el.src = URL.createObjectURL(new Blob([song.data], { type: song.type }));
    el.currentTime = live.start || 0;
    quiet = Date.now() + 1500;
    el.play().catch(() => {});
    const changed = () => { if (Date.now() >= quiet) pushState(!el.paused, el.currentTime); };
    el.addEventListener('play', changed);
    el.addEventListener('pause', changed);
    el.addEventListener('seeked', changed);
  }
  // The phone's notification bar and lock screen, like any music app.
  function notice() {
    const others = live ? people().slice(1).map((p) => p.name) : [];
    const text = live ? (others.length ? (english() ? 'With ' : '和 ') + others.join('、') + (english() ? '' : ' 一起聽') : NAMES[live.provider]) : '';
    const sig = JSON.stringify([song(), text, live?.playing !== false]);
    if (sig === lastNotice) return;
    lastNotice = sig;
    if (window.Desktop && (window.AndroidHost || window.IOSHost)) Desktop.invoke('listenNotice', { active: !!live, title: song(), text, playing: live?.playing !== false }).catch(() => {});
    try {
      if (navigator.mediaSession) navigator.mediaSession.metadata = live ? new MediaMetadata({ title: song(), artist: text }) : null;
    } catch {}
  }
  window.mzListenToggle = () => {
    if (!live) return;
    const el = audioEl(), playing = !(live.playing !== false);
    if (el) { playing ? el.play().catch(() => {}) : el.pause(); return; }
    live.playing = playing;
    player()?.contentWindow?.postMessage({ mizukiListen: true, playing, position: null }, '*');
    notice();
  };
  try { for (const name of ['play', 'pause']) navigator.mediaSession?.setActionHandler(name, () => window.mzListenToggle()); } catch {}
  // Only the Music tab shows the player; everywhere else it keeps playing out of sight.
  const place = () => {
    const el = panel();
    if (el) el.classList.toggle('mz-away', !el.classList.contains('mz-big') && !(tab === 'music' && !chatId && !page));
  };

  const groupFace = (id) => {
    for (const g of window.MizukiGroups?.data?.groups || []) { const p = (g.members || []).find((m) => m.id === id); if (p) return p; }
    return null;
  };
  // Everyone actually listening, this person first.
  function people() {
    const me = humanData().me?.id;
    const humans = (live?.members || []).filter((m) => m.joined && m.id !== me).map((m) => ({ ...(groupFace(m.id) || {}), ...humanFriend(m.id), name: m.name }));
    const ais = (live?.ais || []).map((a) => (a.owner === me && state.ais.some((x) => x.id === a.id) ? ai(a.id) : { name: a.name, avatar: '' }));
    return [humanData().me?.id ? humanData().me : person('me'), ...humans, ...ais];
  }
  function drawPeople() {
    const el = panel();
    if (!el || !live) return;
    const list = people(), waiting = (live.members || []).filter((m) => !m.joined).length, sig = JSON.stringify([list.map((p) => p.name + (p.avatar || '').length), waiting]);
    if (el.dataset.people === sig) return;
    el.dataset.people = sig;
    const box = el.querySelector('.mz-listen-people'), en = english(), others = list.slice(1);
    if (list.length === 2) {
      box.innerHTML = `<div class="mizuki-rel-portraits user-content"><span class="mizuki-rel-avatar">${avatar(list[0])}</span><span class="mizuki-rel-avatar">${avatar(list[1])}</span></div><svg class="mz-earbuds" viewBox="0 0 160 40" aria-hidden="true"><path d="M44 8C48 26 66 28 80 32M116 8C112 26 94 28 80 32M80 32V40"/><circle cx="44" cy="7" r="6"/><circle cx="116" cy="7" r="6"/></svg>`;
    } else {
      box.innerHTML = `<div class="mz-listen-row user-content">${list.slice(0, 10).map((p) => avatar(p)).join('')}</div>`;
    }
    el.querySelector('.mz-listen-with').textContent = list.length === 1 ? (en ? 'Waiting for someone to join' : '等待有人加入') : list.length === 2 ? others[0].name : (en ? list.length + ' listening together' : list.length + ' 人一起聽');
    el.querySelector('.mz-listen-wait').textContent = waiting ? (en ? waiting + ' invited' : '已邀請 ' + waiting + ' 人') : '';
  }
  function show() {
    panel()?.remove();
    const el = document.createElement('section');
    el.id = 'mzListen';
    live.startedAt ||= Date.now();
    el.className = 'mz-big';
    el.innerHTML = `<div class="mz-listen-head"><button class="pill" data-action="listenToggle"></button><strong class="user-content"></strong><button class="pill" data-action="listenInvite">邀請</button><button class="pill" data-action="listenEnd">結束</button></div><div class="mz-listen-people"></div><p class="mz-listen-with user-content"></p><p class="mz-listen-time"></p><p class="mz-listen-wait"></p><iframe allow="autoplay; encrypted-media; fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe><h3 class="user-content"></h3><p class="small"></p>`;
    el.querySelector('.mz-listen-head strong').textContent = song();
    el.querySelector('h3').textContent = song();
    el.querySelector('p.small').textContent = notes[live.provider] || '';
    const frame = el.querySelector('iframe');
    if (live.provider === 'local') {
      const audio = document.createElement('audio');
      audio.controls = true;
      frame.replaceWith(audio);
      loadLocal(audio);
    } else frame.src = server() + '/assets/listen-player.html?p=' + live.provider + '&id=' + encodeURIComponent(live.media) + '&t=' + Math.floor(live.start || 0);
    document.body.append(el);
    drawPeople();
    tick();
    report();
    paint();
    place();
    notice();
  }
  const tick = () => {
    const el = panel();
    if (!el || !live) return;
    const time = el.querySelector('.mz-listen-time'), minutes = Math.floor((Date.now() - live.startedAt) / 60000), en = english();
    const big = el.classList.contains('mz-big'), text = en ? (minutes ? 'Together for ' + minutes + ' min' : 'Just started') : (minutes ? '一起聽了 ' + minutes + ' 分鐘' : '剛開始一起聽');
    if (time.textContent !== text) time.textContent = text;
    const toggle = el.querySelector('[data-action="listenToggle"]'), label = big ? (en ? 'Shrink' : '縮小') : (en ? 'Open' : '展開');
    if (toggle.textContent !== label) toggle.textContent = label;
  };
  setInterval(tick, 1000);
  actions.listenToggle = () => { panel()?.classList.toggle('mz-big'); tick(); place(); };
  function stop(message) {
    live = null;
    const audio = audioEl();
    if (audio?.src) URL.revokeObjectURL(audio.src);
    panel()?.remove();
    report();
    paint();
    notice();
    if (tab === 'music' && !chatId && !page) render();
    if (message) toast(message, 3000);
  }
  // Shown beside the status, so a status the person set stays exactly as it was.
  const report = () => { if (humanData().connected) post({ action: 'now', title: song() }).catch(() => {}); };
  const line = (host, text, after) => {
    let el = host?.querySelector(':scope > .mz-listening');
    host?.classList.toggle('mz-has-listening', !!text);
    if (!text) return el?.remove();
    if (!host) return;
    if (!el) {
      el = document.createElement('small');
      el.className = 'mz-listening user-content';
      if (after) after.after(el); else host.append(el);
    }
    const label = (english() ? '♪ Listening to ' : '♪ 正在聽 ') + text;
    if (el.textContent !== label) el.textContent = label;
  };
  function paint() {
    const mine = document.querySelector('.wx-profile-main');
    line(mine?.parentElement, song(), mine);
    if (chatId.startsWith('human:')) line(document.querySelector('.conversation > header.top'), window.MizukiPresence?.friends?.[chatId.slice(6)]?.listening || '');
    const card = document.querySelector('.sheet .human-profile'), who = window.pendingContactNoteId;
    if (card && who) line(card, window.MizukiPresence?.friends?.[who]?.listening || '');
  }
  setInterval(paint, 3000);
  setInterval(() => { if (live) report(); }, 45000);

  async function poll() {
    if (polling || !state || !humanData().connected) return;
    polling = true;
    try {
      if (live?.solo) return;
      const r = await W.humanRequest('/v1/listen'), s = r.session;
      skew = r.now - Date.now();
      if (!s) {
        if (live) stop('一起聽歌已結束');
        return;
      }
      if (!s.joined) {
        invite = s;
        if (offered !== s.id && !live) {
          offered = s.id;
          const host = s.members.find((m) => m.id === s.host)?.name || s.host;
          showModal('一起聽歌', `<p class="help">${esc(host)} 邀請你一起聽：${esc(s.title || NAMES[s.provider])}</p><div class="sheet-actions"><button class="pill" data-action="listenDecline">不要</button><button class="pill primary" data-action="listenJoin">加入</button></div>`);
        }
        return;
      }
      if (!live) {
        live = { id: s.id, provider: s.provider, media: s.media, title: s.title, members: s.members, ais: s.ais, start: target(s), at: s.at, chats: [] };
        show();
        return;
      }
      live.members = s.members;
      live.ais = s.ais;
      drawPeople();
      notice();
      if (s.at !== live.at) {
        live.at = s.at;
        if (s.at !== live.mine) {
          live.playing = s.playing;
          const audio = audioEl(), where = target(s);
          if (audio) {
            quiet = Date.now() + 1500;
            if (Math.abs(audio.currentTime - where) > 2) audio.currentTime = where;
            if (s.playing) audio.play().catch(() => {}); else audio.pause();
          } else player()?.contentWindow?.postMessage({ mizukiListen: true, playing: s.playing, position: where }, '*');
          notice();
        }
      }
    } catch {} finally { polling = false; }
  }
  setInterval(() => { if (live) poll(); }, 2000);
  setInterval(() => { if (!live && !document.hidden) poll(); }, 6000);

  window.addEventListener('message', async (e) => {
    if (e.source !== player()?.contentWindow || !e.data?.mizukiListen || !live) return;
    if (e.data.type === 'error') toast('這首歌不能在 App 裡播放，請換一首', 3500);
    if (e.data.type === 'state') pushState(e.data.playing, e.data.position);
  });

  async function chatLine(chat, text) {
    await W.edit((s) => { const c = s.chats.find((x) => x.id === chat); if (c) W.append(c, 'system', text, { callEvent: true }); });
    state = await call('load');
    if (chatId === chat) render();
  }
  // Tells the AIs in one chat; they answer in that chat like any message.
  async function tellChat(chat, ids) {
    if (!live) return;
    const r = await post({ action: 'ais', ais: ids.map((id) => ({ id, name: ai(id).name })) });
    if (r.session) live.ais = r.session.ais;
    drawPeople();
    live.chats.push(chat);
    await chatLine(chat, '開始一起聽歌');
    await call('send', { id: chat, text: '想和你一起聽：' + song() + '\n' + linkOf(live.provider, live.media) }).then((x) => { state = x.state; if (chatId === chat) render(); }).catch(() => {});
  }
  async function dmFor(id) {
    let chat = '';
    await W.edit((s) => { chat = W.dm(s, id).id; });
    state = await call('load');
    return chat;
  }
  const noticeBusy = (r) => { if (r.busy?.length) toast('有 ' + r.busy.length + ' 人正在聽別的歌，沒有邀請到', 3000); };
  async function tellPeople(peers, group) {
    const text = '邀請你一起聽：' + song() + '\n' + linkOf(live.provider, live.media);
    for (const id of peers) await call('human', { action: 'send', id, text, images: [], clientMessageId: crypto.randomUUID() }).catch(() => {});
    if (group) await mizukiApi('/v1/groups/send', { group, text, images: [], sticker: null, clientId: 'g' + crypto.randomUUID().replaceAll('-', '') }).catch(() => {});
  }

  actions.listenTogether = () => {
    composerMenuOpen = '';
    syncComposerPanel();
    if (live) return actions.listenInvite();
    showModal('一起聽歌', '<p class="help">貼上 YouTube、YouTube Music、Spotify、Apple Music、KKBOX 或 Bilibili 的網址。開始後可以再邀請更多人，最多 10 人。</p><label>網址</label><input id="mzListenUrl" type="url" autocapitalize="off" spellcheck="false" placeholder="https://"><p id="mzListenError" class="inline-error"></p><div class="sheet-actions"><button class="pill primary" data-action="listenStart">開始</button></div>');
  };
  async function startLocal(hash, from) {
    const song = localList.find((x) => x.hash === hash);
    if (!song) throw Error('你還沒有導入這首本地音樂');
    closeModal();
    if (!navigator.onLine || !humanData().connected) {
      live = { solo: true, provider: 'local', media: hash, title: song.title, members: [], ais: [], chats: [] };
      show();
      if (tab === 'music' && !chatId) render();
      return;
    }
    const group = from.startsWith('hgroup:') ? from.slice(7) : '', peers = from.startsWith('human:') ? [from.slice(6)] : [];
    const r = await post({ action: 'start', local: hash, title: song.title, peers, ...(group ? { group } : {}) }), s = r.session;
    live = { id: s.id, provider: 'local', media: hash, title: s.title, members: s.members, ais: s.ais, at: s.at, chats: [] };
    show();
    if (tab === 'music' && !chatId) render();
    noticeBusy(r);
    await tellPeople(peers, group);
    const chat = state.chats.find((c) => c.id === from);
    if (chat) await tellChat(from, chat.members);
  }
  async function startSong(url, from) {
    if (url.startsWith('mizuki-local://')) return startLocal(url.slice(15), from);
    if (!humanData().connected) throw Error('請先登入帳號');
    const info = await W.humanRequest('/v1/listen/info', { url });
    const group = from.startsWith('hgroup:') ? from.slice(7) : '', peers = from.startsWith('human:') ? [from.slice(6)] : [];
    const r = await post({ action: 'start', url, title: info.title, peers, ...(group ? { group } : {}) }), s = r.session;
    live = { id: s.id, provider: s.provider, media: s.media, title: s.title, members: s.members, ais: s.ais, at: s.at, chats: [] };
    remember({ url, title: s.title || NAMES[s.provider], provider: s.provider });
    closeModal();
    show();
    if (tab === 'music' && !chatId) render();
    noticeBusy(r);
    await tellPeople(peers, group);
    const chat = state.chats.find((c) => c.id === from);
    if (chat) await tellChat(from, chat.members);
    else if (group) {
      const ais = (MizukiGroups.data.groups.find((g) => g.id === group)?.ais || []).map((a) => a.id).filter((id) => state.ais.some((x) => x.id === id));
      if (ais.length) await post({ action: 'ais', ais: ais.map((id) => ({ id, name: ai(id).name })) }).then((x) => { if (live && x.session) live.ais = x.session.ais; drawPeople(); });
    }
  }
  actions.listenStart = async () => {
    const url = document.querySelector('#mzListenUrl')?.value.trim(), error = document.querySelector('#mzListenError');
    if (!url) return;
    try { await startSong(url, chatId); } catch (e) { if (error) error.textContent = clean(e); }
  };
  actions.listenOpenSite = () => {
    const url = window.mzListenSite;
    if (window.Desktop) Desktop.invoke('openLink', { url, browser: state.settings.defaultBrowser || 'system' }).catch(() => window.open(url, '_blank', 'noopener'));
    else window.open(url, '_blank', 'noopener');
  };
  actions.listenOpen = () => { panel()?.classList.add('mz-big'); tick(); place(); };
  actions.listenImport = async () => {
    try {
      if (await pickSong()) toast('已導入本地音樂');
    } catch (e) { toast(e.message || '導入失敗'); }
  };

  // The Music tab: pick a service, see who you're listening with, go back to a recent song.
  window.musicView = () => {
    const others = live ? people().slice(1) : [];
    const bar = live ? `<div class="card mz-music-now"><p class="user-content"><b>${esc(others.length ? '正和 ' + others.map((p) => p.name).join('、') + ' 一起聽' : '正在聽')}</b>${esc('《' + song() + '》')}</p><div class="flex"><button class="pill" data-action="listenOpen">打開</button><button class="pill" data-action="listenInvite">邀請</button><button class="pill" data-action="listenEnd">結束</button></div></div>` : '';
    const tiles = SERVICES.map(([id, tag]) => `<button class="mz-music-tile" data-listenservice="${id}"><b>${NAMES[id]}</b><small>${tag}</small></button>`).join('');
    const list = recent().map((x, i) => `<button class="setting-row" data-listenrecent="${i}"><span class="user-content">${esc(x.title)}</span><small>${esc(NAMES[x.provider] || '')}</small></button>`).join('');
    return header('聽歌', '選一個平台，再邀請 AI 或好友一起聽。') + `<div class="content">${bar}<div class="section-label">選擇平台</div><div class="mz-music-grid">${tiles}</div><div class="section-label">本地音樂</div><div class="card"><p class="help">可以離線自己聽。和 AI 或人類一起聽要有網路；和人類聽時，對方也要導入同一個檔案。</p>${localList.map((x) => `<div class="mz-local-row"><button class="setting-row" data-listenlocal="${esc(x.hash)}"><span class="user-content">${esc(x.title)}</span></button><button class="pill" data-listenlocaldel="${esc(x.hash)}">刪除</button></div>`).join('')}<button class="pill full" data-action="listenImport">導入本地音樂</button></div>${list ? `<div class="section-label">最近聽過</div><div class="card">${list}</div>` : ''}</div>`;
  };
  document.addEventListener('click', async (e) => {
    const playLocal = e.target.closest('[data-listenlocal]'), dropLocal = e.target.closest('[data-listenlocaldel]');
    if (playLocal) {
      if (live) return toast('請先結束現在的一起聽歌');
      return startLocal(playLocal.dataset.listenlocal, '').catch((x) => toast(clean(x)));
    }
    if (dropLocal) {
      if (live?.media === dropLocal.dataset.listenlocaldel) return toast('這首正在播放');
      await songs('readwrite', (s) => s.delete(dropLocal.dataset.listenlocaldel)).catch(() => {});
      return refreshLocal();
    }
    const service = e.target.closest('[data-listenservice]'), again = e.target.closest('[data-listenrecent]'), card = e.target.closest('[data-listencard]');
    if (service) {
      const [id, tag, site] = SERVICES.find((x) => x[0] === service.dataset.listenservice);
      window.mzListenSite = site;
      if (live) return toast('請先結束現在的一起聽歌');
      showModal(NAMES[id], `<p class="help">${tag}。${notes[id] || '播放、暫停和跳轉都會同步。'}</p><button class="pill full" data-action="listenOpenSite">打開 ${NAMES[id]} 找歌</button><label>貼上歌曲網址</label><input id="mzListenUrl" type="url" autocapitalize="off" spellcheck="false" placeholder="https://"><p id="mzListenError" class="inline-error"></p><div class="sheet-actions"><button class="pill primary" data-action="listenStart">開始</button></div>`);
    }
    if (again) {
      if (live) return toast('請先結束現在的一起聽歌');
      startSong(recent()[+again.dataset.listenrecent].url, '').catch((x) => toast(clean(x)));
    }
    if (card) {
      if (live) return actions.listenOpen();
      const pending = await W.humanRequest('/v1/listen').catch(() => null);
      if (pending?.session && !pending.session.joined) { invite = pending.session; return actions.listenJoin(); }
      startSong(card.dataset.listencard, chatId).catch((x) => toast(clean(x)));
    }
  });

  // Song invitations look like a card, not a link. The text stays plain so older versions can still read it.
  const INVITE = /^(?:邀請你一起聽|想和你一起聽)[：:]\s*(.*?)\s*(https:\/\/\S+|mizuki-local:\/\/[0-9a-f]{64})\s*$/s;
  function decorate() {
    for (const bubble of document.querySelectorAll('.message .bubble:not([data-song])')) {
      const hit = INVITE.exec(bubble.textContent.trim());
      if (!hit) continue;
      bubble.dataset.song = '1';
      const url = hit[2], id = /(?:youtu\.be\/|[?&]v=)([\w-]{6,20})/.exec(url)?.[1], site = SERVICE_OF(url);
      bubble.classList.add('mz-song-bubble');
      bubble.innerHTML = `<button class="mz-song-card" data-listencard="${esc(url)}"><span class="mz-song-cover">${id ? `<img src="https://i.ytimg.com/vi/${esc(id)}/mqdefault.jpg" alt="">` : icon('music')}</span><span class="mz-song-text user-content"><b>${esc(hit[1] || site)}</b><small>${esc(site)} · 一起聽</small></span><span class="mz-song-play" aria-hidden="true"></span></button>`;
    }
  }
  const SERVICE_OF = (url) => (url.startsWith('mizuki-local') ? NAMES.local : /music\.youtube/.test(url) ? NAMES.ytmusic : /youtu/.test(url) ? NAMES.youtube : /spotify/.test(url) ? NAMES.spotify : /bilibili/.test(url) ? NAMES.bilibili : /apple/.test(url) ? NAMES.apple : NAMES.kkbox);
  const baseRender = render;
  render = function () { baseRender(); decorate(); place(); };

  actions.listenInvite = () => {
    if (live?.solo) return toast('邀請 AI 或別人一起聽需要網路');
    const inRoom = new Set((live?.members || []).map((m) => m.id)), aiIn = new Set((live?.ais || []).map((a) => a.id));
    const row = (value, name) => `<label class="flex"><input type="checkbox" name="mzListenPick" value="${esc(value)}"> <span class="user-content">${esc(name)}</span></label>`;
    const groups = [...(window.MizukiGroups?.data?.groups || []).map((g) => row('g:' + g.id, g.name)), ...state.chats.filter((c) => c.members.length > 1).map((c) => row('c:' + c.id, title(c)))];
    const friends = humanData().friends.filter((f) => !f.official && !inRoom.has(f.id)).map((f) => row('h:' + f.id, f.name));
    const ais = state.ais.filter((a) => !aiIn.has(a.id)).map((a) => row('a:' + a.id, a.name));
    const part = (name, rows) => (rows.length ? `<div class="section-label">${name}</div>${rows.join('')}` : '');
    showModal('邀請一起聽', part('群組', groups) + part('好友', friends) + part('AI', ais) + '<p id="mzListenError" class="inline-error"></p><div class="sheet-actions"><button class="pill primary" data-action="listenInviteSend">邀請</button></div>');
  };
  actions.listenInviteSend = async () => {
    const picks = [...document.querySelectorAll('input[name="mzListenPick"]:checked')].map((e) => [e.value.slice(0, 1), e.value.slice(2)]), error = document.querySelector('#mzListenError');
    if (!picks.length || !live) return;
    try {
      const peers = picks.filter((p) => p[0] === 'h').map((p) => p[1]);
      if (peers.length) { const r = await post({ action: 'invite', peers }); noticeBusy(r); await tellPeople(peers); }
      for (const [kind, id] of picks) {
        if (kind === 'g') { const r = await post({ action: 'invite', group: id }); noticeBusy(r); await tellPeople([], id); }
      }
      closeModal();
      for (const [kind, id] of picks) {
        if (kind === 'a') await tellChat(await dmFor(id), [id]);
        if (kind === 'c') await tellChat(id, state.chats.find((c) => c.id === id).members);
      }
      await poll();
    } catch (e) { if (error) error.textContent = clean(e); else toast(clean(e)); }
  };
  actions.listenJoin = async () => {
    closeModal();
    if (invite?.provider === 'local' && !localList.some((x) => x.hash === invite.media)) {
      return showModal('需要同一個檔案', `<p class="help">要一起聽《${esc(invite.title)}》，你也要導入同一個音樂檔案。</p><div class="sheet-actions"><button class="pill" data-action="listenDecline">不要</button><button class="pill primary" data-action="listenImportJoin">導入檔案</button></div>`);
    }
    await post({ action: 'join' }).catch((e) => toast(clean(e)));
    await poll();
  };
  actions.listenImportJoin = async () => {
    try {
      const hash = await pickSong();
      if (!hash) return;
      if (hash !== invite?.media) return toast('這不是同一個檔案，請導入對方的那一個', 3500);
      actions.listenJoin();
    } catch (e) { toast(e.message || '導入失敗'); }
  };
  actions.listenDecline = async () => {
    closeModal();
    await post({ action: 'leave' }).catch(() => {});
  };
  actions.listenEnd = async () => {
    const chats = live?.chats || [];
    const solo = live?.solo;
    stop();
    if (!solo) await post({ action: 'leave' }).catch(() => {});
    for (const chat of new Set(chats)) await chatLine(chat, '結束一起聽歌');
  };

  // Every AI can see this, like a status. It can't hear the audio, so all it has is the title.
  const context = W.context;
  W.context = (s, a, c) => {
    const out = context(s, a, c);
    if (!live || s.settings.personVisibility?.['ai:' + a.id]?.hideStatus) return out;
    const mine = myAis().includes(a.id), names = people().slice(1).map((p) => p.name).filter((n) => n !== a.name), minutes = Math.max(1, Math.round((Date.now() - live.startedAt) / 60000));
    const who = (mine ? '和你' + (names.length ? '、' : '') : names.length ? '和 ' : '') + names.join('、') + (mine || names.length ? '一起' : '自己');
    out.push({ role: 'user', content: '［系統資訊，不是使用者說的話：使用者正在' + who + '聽「' + song() + '」（' + NAMES[live.provider] + '），已經聽了約 ' + minutes + ' 分鐘。你只知道歌名，聽不到聲音，不要編造歌詞或細節。你可以從歌名猜這首歌的情緒，但那只是猜測。如果聽起來難過或低落，而且符合你的個性和你們的關係，可以主動關心，例如問怎麼突然聽這首、是不是不開心；不要每次都問。］' });
    return out;
  };
}
