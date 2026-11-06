'use strict';
// 3.2.2: listen together. A room on the server holds who is listening and where the song is; AIs join as names on the
// room and are told what is playing. Exactly two listeners share a pair of earbuds. The player runs on the server's
// page (listen-player.js) so the embedded player sees a normal web address.
{
  const W = WebEngine, NAMES = { local: '本地音樂', bilibili: 'Bilibili' };
  // What each service asks of the people listening, shown before they choose it.
  const SERVICES = [['bilibili', '沒有廣告', 'https://www.bilibili.com/']];
  const linkOf = (p, m) => ({ local: 'mizuki-local://' + m, bilibili: 'https://www.bilibili.com/video/' + m }[p]);
  const kept = (list) => list.filter((x) => NAMES[x.provider]);
  const recent = () => { try { return kept(JSON.parse(localStorage.getItem('mzRecentSongs') || '[]')); } catch { return []; } };
  const remember = (song) => { try { localStorage.setItem('mzRecentSongs', JSON.stringify([song, ...recent().filter((x) => x.url !== song.url)].slice(0, 20))); } catch {} };
  const saveRecent = (list) => { try { localStorage.setItem('mzRecentSongs', JSON.stringify(list)); } catch {} };
  const favorites = () => { try { return kept(JSON.parse(localStorage.getItem('mzFavoriteSongs') || '[]')); } catch { return []; } };
  const saveFavorites = (list) => { try { localStorage.setItem('mzFavoriteSongs', JSON.stringify(list)); } catch {} };
  const isFavorite = (url) => favorites().some((x) => x.url === url);
  const toggleFavorite = (song) => { const list = favorites(), had = list.some((x) => x.url === song.url); saveFavorites(had ? list.filter((x) => x.url !== song.url) : [{ url: song.url, title: song.title, provider: song.provider, duration: song.duration || 0 }, ...list].slice(0, 500)); toast(had ? '已取消收藏' : '已加入收藏'); };
  const LOGIN_PAGE = 'https://passport.bilibili.com/login', APP_PACKAGE = 'tv.danmaku.bili', APP_SCHEME = 'bilibili://', APP_STORE_ID = '1517062289';
  const browser = () => state.settings.defaultBrowser || 'system';
  const openOutside = async (url) => {
    if (window.Desktop && !window.IOSHost) return Desktop.invoke('openLink', { url, browser: browser() });
    if (window.IOSHost) return Desktop.invoke('openApp', { scheme: url, store: url });
    window.open(url, '_blank', 'noopener');
  };
  const openService = async () => {
    if (window.AndroidHost) return Desktop.invoke('openApp', { package: APP_PACKAGE, store: 'https://play.google.com/store/apps/details?id=' + APP_PACKAGE, browser: browser() });
    if (window.IOSHost) return Desktop.invoke('openApp', { scheme: APP_SCHEME, store: 'https://apps.apple.com/app/id' + APP_STORE_ID });
    return openOutside(LOGIN_PAGE);
  };
  const webLogins = () => { try { return JSON.parse(localStorage.getItem('mzMusicWeb') || '{}'); } catch { return {}; } };
  let switching = false, remoteSession = null, loadingRemote = false, listenFrom = '', pollTurn = 0, endTimer = 0, searchInto = null;
  const ended = new Set();
  const MODES = { list: '順序循環', one: '單曲循環', shuffle: '隨機播放' }, MODES_EN = { list: 'Loop list', one: 'Repeat one', shuffle: 'Shuffle' };
  const publishQueue = () => { if (live && !live.solo) post({ action: 'queue', queue }).catch((e) => toast(clean(e))); };
  let queue = (() => { try { return kept(JSON.parse(localStorage.getItem('mzSongQueue') || '[]')); } catch { return []; } })();
  const saveQueue = () => { localStorage.setItem('mzSongQueue', JSON.stringify(queue)); publishQueue(); };
  const addQueue = (item) => { if(!queue.some((x)=>x.url===item.url)){queue.push(item);saveQueue();} };
  let live = null, skew = 0, trip = 0, settle = 0, offered = '', polling = false, invite = null, quiet = 0, localList = [], lastNotice = '';
  const notes = { bilibili: '點影片或按「暫停」，大家會一起暫停和繼續。' };
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
  function releasePlayer() {
    const audio=audioEl();
    if(audio){quiet=Date.now()+1500;audio.pause();const src=audio.src;audio.removeAttribute('src');audio.load();if(src)URL.revokeObjectURL(src);}
    panel()?.remove();
  }
  // Everyone follows the server's clock. Small drift is eased out by speed so nobody hears a jump; only large drift seeks.
  function steer(audio, where) {
    if (!audio.duration || where >= audio.duration) return;
    const drift = audio.currentTime - where;
    if (Math.abs(drift) > 0.5) { quiet = Date.now() + 1500; audio.playbackRate = 1; audio.currentTime = where; return; }
    audio.playbackRate = Math.abs(drift) < 0.04 ? 1 : 1 - Math.max(-0.05, Math.min(0.05, drift));
  }
  async function pushState(playing, position) {
    if (!live) return;
    live.playing = playing;
    notice();
    if (live.solo) return;
    settle = Date.now() + 1500;
    try {
      // The server stamps the time on arrival, so say where the song will be by then.
      const r = await post({ action: 'update', playing, position: position + (playing ? trip / 2000 : 0) });
      if (live && r.session) live.at = live.mine = r.session.at;
    } catch {}
  }
  async function loadLocal(el) {
    const media = live?.media;
    const song = await songs('readonly', (s) => s.get(media)).catch(() => null);
    if (!el.isConnected || live?.media !== media) return;
    if (!song) return toast('找不到這首本地音樂');
    el.src = URL.createObjectURL(new Blob([song.data], { type: song.type }));
    el.currentTime = live.start || 0;
    quiet = Date.now() + 1500;
    el.play().catch(() => {});
    const changed = () => { if (Date.now() >= quiet) pushState(!el.paused, el.currentTime); };
    el.addEventListener('play', changed);
    el.addEventListener('pause', changed);
    el.addEventListener('seeked', changed);
    el.addEventListener('ended', autoNext);
  }
  // The phone's notification bar and lock screen, like any music app.
  function notice() {
    const others = live ? otherPeople().map((p) => p.name) : [];
    const text = live ? (others.length ? (english() ? 'With ' : '和 ') + others.join('、') + (english() ? '' : ' 一起聽') : NAMES[live.provider]) : '';
    const sig = JSON.stringify([song(), text, live?.playing !== false]);
    if (sig === lastNotice) return;
    lastNotice = sig;
    if (window.Desktop && (window.AndroidHost || window.IOSHost)) Desktop.invoke('listenNotice', { active: !!live, title: song(), text, playing: live?.playing !== false }).catch(() => {});
    try {
      if (navigator.mediaSession) navigator.mediaSession.metadata = live ? new MediaMetadata({ title: song(), artist: text }) : null;
    } catch {}
  }
  // Bilibili's player takes no commands from outside. Pausing unloads it for everyone at the same spot, and resuming
  // loads it again from there, so all of this goes through the app's own button.
  const playerSrc = (start) => server() + '/assets/listen-player.html?p=' + live.provider + '&id=' + encodeURIComponent(live.media) + '&t=' + Math.floor(start || 0) + '&compact=' + (window.mzListenExpanded?.() === false ? '1' : '0');
  const clock = () => (live.pos || 0) + (live.playing !== false ? (Date.now() - (live.posAt || Date.now())) / 1000 : 0);
  const armEnd = (at) => { clearTimeout(endTimer); if (live.duration > 0 && live.provider !== 'local') endTimer = setTimeout(autoNext, Math.max(5, live.duration - (at || 0) + 3) * 1000); };
  function setVideo(playing, at) {
    if (!live || live.provider === 'local') return;
    Object.assign(live, { playing, pos: at, posAt: Date.now() });
    const frame = player(), shield = panel()?.querySelector('.mz-listen-shield');
    if (frame) frame.src = playing ? playerSrc(at) : 'about:blank';
    if (shield) shield.textContent = playing ? '' : (english() ? 'Paused' : '已暫停');
    if (playing) armEnd(at); else clearTimeout(endTimer);
  }
  window.mzListenToggle = () => {
    if (!live) return;
    const el = audioEl(), playing = !(live.playing !== false);
    if (el) { playing ? el.play().catch(() => {}) : el.pause(); return; }
    const at = clock();
    setVideo(playing, at);
    pushState(playing, at);
  };
  try { for (const name of ['play', 'pause']) navigator.mediaSession?.setActionHandler(name, () => window.mzListenToggle()); } catch {}
  // Only the Music tab shows the player; everywhere else it keeps playing out of sight.
  const place = () => {
    const el = panel();
    if (!el) return;
    const big = el.classList.contains('mz-big'), visible = tab === 'music' && !chatId && !page;
    const hasVideo = live?.provider === 'bilibili';
    const slot = visible && hasVideo && document.querySelector('.mz-music-preview');
    const layout = big ? 'full' : 'video-only';
    if (el.dataset.playerLayout !== layout) { el.dataset.playerLayout=layout; player()?.contentWindow?.postMessage({mizukiListen:true,type:'layout',compact:!big},'*'); }
    el.classList.toggle('mz-away', !big && !slot);
    el.classList.toggle('mz-docked', !big && !!slot);
    if (big || !slot) { if (el.dataset.dockRect) { for (const name of ['left', 'top', 'width', 'height']) el.style.removeProperty(name); delete el.dataset.dockRect; } }
    if (!big && slot) {
      const r = slot.getBoundingClientRect();
      const rect = [r.left, r.top, r.width, r.height].map((x) => Math.round(x * 10) / 10).join(',');
      if (el.dataset.dockRect !== rect) { el.dataset.dockRect = rect; Object.assign(el.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); }
    }
  };
  window.addEventListener('resize', place);
  document.addEventListener('scroll', place, true);
  window.mzListenExpanded = () => !!panel()?.classList.contains('mz-big');
  window.mzListenSetExpanded = (big) => { panel()?.classList.toggle('mz-big', !!big); tick(); place(); };
  const backBeforeListen = window.goBack;
  window.goBack = () => {
    if (!modal && window.mzListenExpanded()) { window.mzListenSetExpanded(false); return true; }
    return backBeforeListen?.();
  };


  // The server is sometimes refused by Bilibili, so this device asks too.
  const videoInfo = async (media) => {
    if (!window.Desktop) return { title: '', duration: 0 };
    try { const r = await Desktop.invoke('http', { url: 'https://api.bilibili.com/x/web-interface/view?bvid=' + encodeURIComponent(media), method: 'GET', channel: 'account' }); return { title: String(r?.value?.data?.title || '').slice(0, 160), duration: +r?.value?.data?.duration || 0 }; } catch { return { title: '', duration: 0 }; }
  };

  const groupFace = (id) => {
    for (const g of window.MizukiGroups?.data?.groups || []) { const p = (g.members || []).find((m) => m.id === id); if (p) return p; }
    return null;
  };
  // Everyone actually listening, this person first.
  function people() {
    const me = humanData().me?.id;
    const humans = (live?.members || []).filter((m) => m.joined).map((m) => ({ ...(m.id === me ? humanData().me : { ...(groupFace(m.id) || {}), ...humanFriend(m.id) }), id: m.id, name: m.name, joinedAt: m.joinedAt || 0 }));
    if (!humans.some((p) => p.id === me)) humans.push({ ...(me ? humanData().me : person('me')), id: me || 'me', joinedAt: 0 });
    const ais = (live?.ais || []).map((a) => ({ ...(a.owner === me && state.ais.some((x) => x.id === a.id) ? ai(a.id) : { name: a.name, avatar: '' }), id: 'ai:' + a.owner + ':' + a.id, joinedAt: a.joinedAt || 0 }));
    return [...humans, ...ais].sort((a, b) => a.joinedAt - b.joinedAt || String(a.id).localeCompare(String(b.id)));
  }
  const otherPeople = () => people().filter((p) => p.id !== (humanData().me?.id || 'me'));

  function drawPeople() {
    const el = panel();
    if (!el || !live) return;
    const list = people(), waiting = (live.members || []).filter((m) => !m.joined).length, sig = JSON.stringify([list.map((p) => [p.id, p.name, p.avatar, p.joinedAt]), waiting, english()]);
    if (el.dataset.people === sig) return;
    el.dataset.people = sig;
    const box = el.querySelector('.mz-listen-people'), en = english(), others = otherPeople();
    if (list.length === 2) {
      box.innerHTML = `<div class="mizuki-rel-portraits user-content"><span class="mizuki-rel-avatar">${avatar(list[0])}</span><span class="mizuki-rel-avatar">${avatar(list[1])}</span></div><svg class="mz-earbuds" viewBox="0 0 160 40" aria-hidden="true"><path d="M44 8C48 26 66 28 80 32M116 8C112 26 94 28 80 32M80 32V40"/><circle cx="44" cy="7" r="6"/><circle cx="116" cy="7" r="6"/></svg>`;
    } else {
      box.innerHTML = `<div class="mz-listen-row user-content">${list.slice(0, 10).map((p) => avatar(p)).join('')}</div>`;
    }
    el.querySelector('.mz-listen-with').textContent = list.length === 1 ? (en ? 'Waiting for someone to join' : '等待有人加入') : list.length === 2 ? others[0].name : (en ? list.length + ' listening together' : list.length + ' 人一起聽');
    el.querySelector('.mz-listen-wait').textContent = waiting ? (en ? waiting + ' invited' : '已邀請 ' + waiting + ' 人') : '';
  }
  function show() {
    const wasBig = panel() ? window.mzListenExpanded() : true;
    releasePlayer();
    const el = document.createElement('section');
    el.id = 'mzListen';
    live.startedAt ||= Date.now();
    el.className = wasBig ? 'mz-big' : '';
    el.innerHTML = `<div class="mz-listen-head"><button class="pill" data-action="listenToggle"></button><strong class="user-content"></strong><button class="pill" data-action="listenQueue">切歌</button><button class="pill" data-action="listenInvite">邀請</button><button class="pill" data-action="listenEnd">結束</button></div><div class="mz-listen-people"></div><p class="mz-listen-with user-content"></p><p class="mz-listen-time"></p><p class="mz-listen-wait"></p><iframe allow="autoplay; encrypted-media; fullscreen" referrerpolicy="strict-origin-when-cross-origin"></iframe><h3 class="user-content"></h3><p class="small"></p>`;
    el.insertAdjacentHTML('beforeend', `<div class="mz-listen-controls"><button class="pill" data-action="listenPlaybackToggle">暫停</button><button class="pill" data-action="listenPrevious">上一首</button><button class="pill" data-action="listenQueue">播放清單／切歌</button><button class="pill" data-action="listenNext">下一首</button><button class="pill" data-action="listenMode"></button></div>`);
    el.querySelector('.mz-listen-head strong').textContent = song();
    el.querySelector('h3').textContent = song();
    el.querySelector('p.small').textContent = notes[live.provider] || '';
    const frame = el.querySelector('iframe');
    if (live.provider === 'local') {
      const audio = document.createElement('audio');
      audio.controls = true;
      frame.replaceWith(audio);
      loadLocal(audio);
    } else {
      // Tapping the picture pauses for everyone. The strip along the bottom stays free for Bilibili's volume and fullscreen.
      const box = document.createElement('div');
      box.className = 'mz-listen-video';
      frame.before(box); box.append(frame);
      box.insertAdjacentHTML('beforeend', '<button class="mz-listen-shield" type="button" data-action="listenPlaybackToggle" aria-label="暫停或繼續"></button>');
      frame.src = server() + '/assets/listen-player.html?p=' + live.provider + '&id=' + encodeURIComponent(live.media) + '&t=' + Math.floor(live.start || 0) + '&compact=' + (wasBig ? '0' : '1');
    }
    document.body.append(el);
    drawPeople();
    tick();
    report();
    paint();
    place();
    notice();
    window.mizukiTranslate?.(el);
    // Bilibili doesn't report the end of a video, so go by its length.
    live.pos = live.start || 0; live.posAt = Date.now();
    armEnd(live.pos);
    if (live.provider !== 'local' && live.playing === false) setVideo(false, live.pos);
  }
  const tick = () => {
    const el = panel();
    if (!el || !live) return;
    const time = el.querySelector('.mz-listen-time'), minutes = Math.floor((Date.now() - live.startedAt) / 60000), en = english();
    const big = el.classList.contains('mz-big'), text = en ? (minutes ? 'Together for ' + minutes + ' min' : 'Just started') : (minutes ? '一起聽了 ' + minutes + ' 分鐘' : '剛開始一起聽');
    if (time.textContent !== text) time.textContent = text;
    const toggle = el.querySelector('[data-action="listenToggle"]'), label = big ? (en ? 'Shrink' : '縮小') : (en ? 'Open' : '展開');
    if (toggle.textContent !== label) toggle.textContent = label;
    const mode = el.querySelector('[data-action="listenMode"]'), name = (en ? MODES_EN : MODES)[live.mode || 'list'];
    if (mode && mode.textContent !== name) mode.textContent = name;
    const pause = el.querySelector('.mz-listen-controls [data-action="listenPlaybackToggle"]'), word = live.playing !== false ? (en ? 'Pause' : '暫停') : (en ? 'Resume' : '繼續');
    if (pause && pause.textContent !== word) pause.textContent = word;
  };
  setInterval(tick, 1000);
  actions.listenMode = async () => {
    if (!live) return;
    const order = ['list', 'one', 'shuffle'], next = order[(order.indexOf(live.mode || 'list') + 1) % 3];
    live.mode = next;
    tick();
    if (!live.solo) post({ action: 'mode', mode: next }).catch((e) => toast(clean(e)));
    if (tab === 'music' && !chatId && !page) render();
  };
  actions.listenPlaybackToggle = () => window.mzListenToggle();
  actions.listenToggle = () => { panel()?.classList.toggle('mz-big'); tick(); place(); };
  function stop(message) {
    clearTimeout(endTimer);
    live = null;
    releasePlayer();
    report();
    paint();
    notice();
    if (tab === 'music' && !chatId && !page) render();
    if (message) toast(message, 3000);
  }
  // Shown beside the status, so a status the person set stays exactly as it was.
  const report = () => { if (!remoteSession && humanData().connected) post({ action: 'now', title: song() }).catch(() => {}); };
  const listeningLabel = () => (english() ? '♪ Listening' : '♪ 正在聽歌');
  const line = (host, text, after) => {
    let el = host?.querySelector(':scope > .mz-music-listening');
    const hasActivity = !!text || !!host?.querySelector('.mz-group-call-status');
    if (host && host.classList.contains('mz-has-listening') !== hasActivity) host.classList.toggle('mz-has-listening', hasActivity);
    if (!text) return el?.remove();
    if (!host) return;
    if (!el) {
      el = document.createElement('button');
      el.type = 'button';
      el.dataset.action = 'listenReturn';
      el.className = 'mz-listening mz-music-listening user-content';
      if (after) after.after(el); else host.append(el);
    }
    const label = listeningLabel();
    if (el.textContent !== label) el.textContent = label;
  };
  function paint() {
    const mine = document.querySelector('.wx-profile-main');
    line(mine?.parentElement, song(), mine);
    // The band across the top is the one place that names the song.
    const top = document.querySelector('.desktop-shell') || document.querySelector('#app'), hearing = song() || remoteSession?.title || '';
    let band = document.querySelector('#mzListenBand');
    if (top && hearing) {
      if (!band) { band = document.createElement('button'); band.id = 'mzListenBand'; band.type = 'button'; band.className = 'mz-listening user-content'; band.dataset.action = 'listenReturn'; }
      if (band.parentElement !== top) top.prepend(band);
      const text = listeningLabel() + ' · ' + hearing;
      if (band.textContent !== text) band.textContent = text;
    } else band?.remove();
    if (chatId) line(document.querySelector('.conversation > header.top'), chatId.startsWith('human:') ? window.MizukiPresence?.friends?.[chatId.slice(6)]?.listening || '' : '');
    const card = document.querySelector('.sheet .human-profile'), who = window.pendingContactNoteId;
    if (card && who) line(card, window.MizukiPresence?.friends?.[who]?.listening || '');
  }
  setInterval(paint, 3000);
  window.mzListenPaint = paint;
  const renderBeforeBand = render; render = function () { renderBeforeBand(); paint(); };
  setInterval(() => { if (live) report(); }, 45000);

  async function poll() {
    if (polling || !state || !humanData().connected) return;
    polling = true;
    try {
      if (live?.solo) return;
      const sent = Date.now(), turn = ++pollTurn, r = await W.humanRequest('/v1/listen'), s = r.session, back = Date.now();
      if (turn !== pollTurn) return;
      // The fastest round trips say the most about the clock; the slower ones were held up on the way.
      if (!trip || back - sent <= trip * 1.5) { skew = r.now - (sent + back) / 2; trip = back - sent; } else trip *= 1.05;
      // A room this person ended stays ended, even if the server didn't get the message the first time.
      if (s?.joined && ended.has(s.id)) { post({ action: 'leave', force: true }).catch(() => {}); return; }
      if (s && !s.joined) ended.delete(s.id);
      if (s?.joined && s.activeHere === false) {
        const changed = !!live || remoteSession?.id !== s.id || remoteSession?.title !== s.title || remoteSession?.deviceName !== s.deviceName;
        remoteSession = s;
        if (live) { releasePlayer(); live = null; notice(); paint(); }
        if (changed && !modal && tab === 'music' && !chatId && !page) render();
        return;
      }
      if (remoteSession) { remoteSession = null; if (tab === 'music' && !chatId && !page) render(); }
      if (s?.queue?.length && JSON.stringify(s.queue) !== JSON.stringify(queue)) { queue = s.queue; localStorage.setItem('mzSongQueue', JSON.stringify(queue)); }
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
        live = { id: s.id, host: s.host, playing:s.playing, provider: s.provider, media: s.media, title: s.title, members: s.members, ais: s.ais, start: target(s), at: s.at, chats: [] };
        show();
        return;
      }
      if (s.provider !== live.provider || s.media !== live.media) {
        Object.assign(live, { provider: s.provider, media: s.media, title: s.title, start: target(s), playing: s.playing, at: s.at, members: s.members, ais: s.ais });
        show();
        if (tab === 'music' && !chatId && !page) render();
        return;
      }
      live.members = s.members;
      live.ais = s.ais;
      live.mode = s.mode || 'list';
      drawPeople();
      notice();
      if (s.at !== live.at) {
        live.at = s.at;
        if (s.at !== live.mine) {
          live.playing = s.playing;
          const audio = audioEl(), where = target(s);
          if (audio) {
            quiet = Date.now() + 1500;
            if (Math.abs(audio.currentTime - where) > 0.25) audio.currentTime = where;
            if (s.playing) audio.play().catch(() => {}); else audio.pause();
          } else setVideo(s.playing, where);
          notice();
        }
      }
      const audio = audioEl();
      if (audio && s.playing && !audio.paused && Date.now() >= quiet && Date.now() >= settle) steer(audio, target(s));
    } catch {} finally { polling = false; }
  }
  setInterval(() => { if (live) poll(); }, 1000);
  setInterval(() => { if (!live && !document.hidden) poll(); }, 6000);

  window.addEventListener('message', async (e) => {
    if (e.source !== player()?.contentWindow || !e.data?.mizukiListen || !live) return;
    if (e.data.type === 'ready') { delete panel().dataset.playerLayout; place(); }
    if (e.data.type === 'error') toast('這首歌不能在 App 裡播放，請換一首', 3500);
    if (e.data.type === 'state') pushState(e.data.playing, e.data.position);
    if (e.data.type === 'ended') autoNext();
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

  async function switchSong(url,knownTitle='',knownLength=0) {
    if (switching) return;
    if (!live) return startSong(url, '');
    switching = true;
    try {
      const local = url.startsWith('mizuki-local://'), media = local ? url.slice(15) : '';
      const item = local ? localList.find((x) => x.hash === media) : await W.humanRequest('/v1/listen/info', { url });
      if (!item) throw Error('你還沒有導入這首本地音樂');
      item.title ||= knownTitle || (local ? '' : (await videoInfo(item.media)).title);
      item.duration ||= knownLength || (local ? 0 : (await videoInfo(item.media)).duration);
      if (!local) url=linkOf(item.provider,item.media);
      if (live.solo && (!local || humanData().connected)) {
        // Upgrade an offline solo player when the account is connected.
        if (!humanData().connected) throw Error('請先登入帳號');
        const r = await post({ action: 'start', ...(local ? { local: media } : { url }), title: item.title });
        Object.assign(live, r.session, { solo: false, start: 0, duration: item.duration || 0 });
      } else if (live.solo) Object.assign(live, { provider: 'local', media, title: item.title, start: 0, playing: true, duration: 0 });
      else {
        const r = await post({ action: 'switch', ...(local ? { local: media } : { url }), title: item.title });
        Object.assign(live, r.session, { start: 0, duration: item.duration || 0 });
      }
      window.mzAiEvent?.('listen', song(), myAis());
      const entry = { url, title: live.title || NAMES[live.provider], provider: live.provider, duration: live.duration || 0 };
      addQueue(entry); remember(entry);
      show(); closeModal();
      if (tab === 'music' && !chatId && !page) render();
    } finally { switching = false; }
  }
  const playQueued = async (direction) => {
    if (!queue.length) return toast('先將歌曲加入播放清單');
    const index = live ? queue.findIndex((x) => x.url === linkOf(live.provider, live.media) || (x.provider === live.provider && x.media === live.media)) : -1;
    const next = index < 0 ? 0 : (index + direction + queue.length) % queue.length;
    try { await switchSong(queue[next].url,queue[next].title,queue[next].duration); } catch (e) { toast(clean(e)); }
  };
  // The list loops by itself; only the host moves everyone on, so two players never skip twice.
  const autoNext = () => {
    if (!live || !(live.solo || live.host === humanData().me?.id)) return;
    if (live.mode === 'one') return switchSong(linkOf(live.provider, live.media), live.title, live.duration).catch((e) => toast(clean(e)));
    if (live.mode === 'shuffle' && queue.length > 1) {
      const here = queue.findIndex((x) => x.url === linkOf(live.provider, live.media));
      let next = here;
      while (next === here) next = Math.floor(Math.random() * queue.length);
      return switchSong(queue[next].url, queue[next].title, queue[next].duration).catch((e) => toast(clean(e)));
    }
    return playQueued(1);
  };
  actions.listenNext = () => playQueued(1);
  actions.listenPrevious = () => playQueued(-1);
  actions.listenQueue = () => {
    showModal('播放清單／切歌', '<p class="help">點歌曲立即切換；用上下按鈕調整播放順序。</p><div class="mz-queue">' + queue.map((x, i) => `<div class="mz-queue-row"><button class="setting-row" data-listenqueue="${i}"><span class="user-content">${esc(x.title)}</span></button><button class="pill" aria-label="上移" data-listenmove="${i}:-1" ${i === 0 ? 'disabled' : ''}>↑</button><button class="pill" aria-label="下移" data-listenmove="${i}:1" ${i === queue.length - 1 ? 'disabled' : ''}>↓</button><button class="pill" aria-label="移除" data-listenremove="${i}">×</button></div>`).join('') + '</div><label>加入歌曲網址</label><input id="mzQueueUrl" type="url" placeholder="https://"><p id="mzQueueError" class="inline-error"></p><button class="pill" data-action="listenQueueAdd">加入清單</button><p class="help">也可以從聽歌頁的最近聽過或本地音樂加入。</p>');
  };
  actions.listenQueueAdd = async () => {
    const url = document.querySelector('#mzQueueUrl')?.value.trim();
    if (!url) return;
    try { const info = await W.humanRequest('/v1/listen/info', { url }); addQueue({ url: linkOf(info.provider, info.media), media: info.media, title: info.title || NAMES[info.provider], provider: info.provider }); actions.listenQueue(); }
    catch (e) { document.querySelector('#mzQueueError').textContent = clean(e); }
  };
  let searchResults = [], searchCounter = 0;
  actions.listenAccounts = () => {
    const state_ = webLogins().bilibili, line = state_?.signedIn ? '已登入' : state_?.opened ? '登入完成後，按「我已登入」' : state_?.guest ? '不登入' : '尚未選擇', phone = window.AndroidHost || window.IOSHost;
    showModal('Bilibili 登入', `<p class="help">可以選登入或不登入，都能聽。${phone ? '登入會開啟 Bilibili App；沒有安裝就開啟下載頁。' : '登入會開啟你選擇的瀏覽器。'}</p><div class="mz-queue-row"><span class="spacer">Bilibili<small class="help">${line}</small></span>${state_?.opened ? '<button class="pill primary" data-action="listenLoggedIn">我已登入</button>' : ''}<button class="pill" data-action="listenLogin">${state_?.signedIn ? '重新登入' : '登入'}</button><button class="pill" data-action="listenGuest">不登入</button></div>`);
  };
  actions.listenLogin = async () => {
    try { await openService(); localStorage.setItem('mzMusicWeb', JSON.stringify({ bilibili: { opened: true } })); actions.listenAccounts(); } catch (e) { toast(clean(e)); }
  };
  // The login happens outside the app, which can't see it, so the person tells us when it's done.
  actions.listenLoggedIn = () => { localStorage.setItem('mzMusicWeb', JSON.stringify({ bilibili: { signedIn: true } })); actions.listenAccounts(); };
  actions.listenGuest = () => { localStorage.setItem('mzMusicWeb', JSON.stringify({ bilibili: { guest: true } })); actions.listenAccounts(); };
  actions.listenSearch = () => {
    listenFrom = '';
    searchInto = null;
    showModal('搜尋歌曲', `<label for="mzSongSearch">歌名或歌手</label><input id="mzSongSearch" type="search" placeholder="搜尋歌曲"><button class="pill primary" data-action="listenSearchRun">搜尋</button><p id="mzSongSearchStatus" class="help"></p><div id="mzSongResults"></div><button class="link-button" data-action="listenPasteUrl">使用歌曲網址</button>`);
  };
  const searchSite = (q) => 'https://search.bilibili.com/all?keyword=' + encodeURIComponent(q);
  // This device reads the normal search page out of sight and the songs are listed here, so no extra window opens.
  // The server is usually refused by Bilibili, which is why the device goes first.
  const READ_RESULTS = `(()=>{const seen=new Set(),out=[];for(const a of document.querySelectorAll('a[href*="/video/BV"]')){const m=a.href.match(/\/video\/(BV[0-9A-Za-z]{8,14})/);if(!m||seen.has(m[1]))continue;const card=a.closest('.bili-video-card,.video-list-item,.v-card')||a,name=card.querySelector('.bili-video-card__info--tit,h3,.title'),title=((name&&(name.getAttribute('title')||name.textContent))||a.title||a.textContent||'').trim();if(!title)continue;seen.add(m[1]);out.push({title,artist:((card.querySelector('.bili-video-card__info--author,.up-name,.author')||{}).textContent||'').trim(),time:((card.querySelector('.bili-video-card__stats__duration,.duration')||{}).textContent||'').trim(),url:'https://www.bilibili.com/video/'+m[1],provider:'bilibili'});if(out.length>=20)break;}return JSON.stringify(out);})()`;
  const secondsOf = (text) => String(text || '').split(':').reduce((sum, part) => sum * 60 + (+part || 0), 0);
  async function deviceSearch(q) {
    if (!window.Desktop) return [];
    const r = await Desktop.invoke('musicSearchList', { url: searchSite(q), script: READ_RESULTS }).catch(() => null);
    return (r?.results || []).map((x) => ({ ...x, duration: secondsOf(x.time) }));
  }
  actions.listenSearchRun = async () => {
    const input = document.querySelector('#mzSongSearch'), status = document.querySelector('#mzSongSearchStatus'), box = document.querySelector('#mzSongResults');
    const q = input?.value.trim(), serial = ++searchCounter;
    if (!q) return;
    status.textContent = '搜尋中…'; box.innerHTML = '';
    try {
      let found = await deviceSearch(q);
      if (serial !== searchCounter || !box.isConnected) return;
      if (!found.length) found = (await W.humanRequest('/v1/listen/search', { q })).results || [];
      if (serial !== searchCounter || !box.isConnected) return;
      searchResults = found;
      status.textContent = searchResults.length ? '點一下立即播放；＋加入播放清單。' : '找不到歌曲，試試其他關鍵字。';
      box.innerHTML = searchResults.map((x,i) => `<div class="mz-queue-row"><button class="setting-row" data-listensearchplay="${i}"><span class="user-content"><b>${esc(x.title)}</b><small>${esc(x.artist)}</small></span></button><button class="pill" data-listensearchadd="${i}" aria-label="加入播放清單">＋</button></div>`).join('');
    } catch (e) { if (serial === searchCounter && status.isConnected) status.textContent = clean(e); }
  };
  document.addEventListener('keydown', (e) => { if (e.target.id === 'mzSongSearch' && e.key === 'Enter') { e.preventDefault(); actions.listenSearchRun(); } });
  document.addEventListener('click', (e) => {
    const play = e.target.closest('[data-listensearchplay]'), add = e.target.closest('[data-listensearchadd]');
    if (play) { const item = searchResults[+play.dataset.listensearchplay]; if (item) startSong(item.url, listenFrom, item.title, item.duration).catch((e) => toast(clean(e))); }
    if (add) { const item = searchResults[+add.dataset.listensearchadd]; if (item) { if (searchInto) searchInto(item).catch((e) => toast(clean(e))); else { addQueue(item); toast('已加入播放清單'); } } }
  });
  actions.listenTogether = () => { composerMenuOpen = ''; syncComposerPanel(); actions.listenSearch(); listenFrom = chatId; };
  actions.listenPasteUrl = () => showModal('歌曲網址', '<label>網址</label><input id="mzListenUrl" type="url" placeholder="https://"><p id="mzListenError" class="inline-error"></p><button class="pill primary" data-action="listenStart">播放</button>');
  async function startLocal(hash, from) {
    if (live) return switchSong('mizuki-local://' + hash);
    listenFrom = '';
    const song = localList.find((x) => x.hash === hash);
    if (song) addQueue({ url: 'mizuki-local://' + hash, title: song.title, provider: 'local', media: hash });
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
    live = { id: s.id, host: s.host, playing:s.playing, provider: 'local', media: hash, title: s.title, members: s.members, ais: s.ais, at: s.at, chats: [] };
    show();
    publishQueue();
    if (tab === 'music' && !chatId) render();
    noticeBusy(r);
    await tellPeople(peers, group);
    const chat = state.chats.find((c) => c.id === from);
    if (chat) await tellChat(from, chat.members);
  }
  async function startSong(url, from,knownTitle='',knownLength=0) {
    if (live) return switchSong(url,knownTitle,knownLength);
    listenFrom = '';
    if (url.startsWith('mizuki-local://')) return startLocal(url.slice(15), from);
    if (!humanData().connected) throw Error('請先登入帳號');
    const info = await W.humanRequest('/v1/listen/info', { url });
    info.title ||= knownTitle || (await videoInfo(info.media)).title;
    info.duration ||= knownLength || (await videoInfo(info.media)).duration;
    url=linkOf(info.provider,info.media);
    const group = from.startsWith('hgroup:') ? from.slice(7) : '', peers = from.startsWith('human:') ? [from.slice(6)] : [];
    const r = await post({ action: 'start', url, title: info.title, peers, ...(group ? { group } : {}) }), s = r.session;
    live = { id: s.id, host: s.host, playing:s.playing, provider: s.provider, media: s.media, title: s.title, members: s.members, ais: s.ais, at: s.at, chats: [], mode: s.mode || 'list', duration: info.duration || 0 };
    url = linkOf(s.provider, s.media);
    addQueue({ url, title: s.title || NAMES[s.provider], provider: s.provider, media: s.media, duration: info.duration || 0 });
    remember({ url, title: s.title || NAMES[s.provider], provider: s.provider, duration: info.duration || 0 });
    closeModal();
    show();
    publishQueue();
    if (tab === 'music' && !chatId) render();
    noticeBusy(r);
    window.mzAiEvent?.('listen', song(), state.chats.find((c) => c.id === from)?.members || []);
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
    try { await startSong(url, listenFrom); } catch (e) { if (error) error.textContent = clean(e); }
  };
  actions.listenOpenSite = () => {
    const url = window.mzListenSite;
    if (window.Desktop) Desktop.invoke('openLink', { url, browser: state.settings.defaultBrowser || 'system' }).catch(() => window.open(url, '_blank', 'noopener'));
    else window.open(url, '_blank', 'noopener');
  };
  actions.listenTakeover = async () => {
    if (loadingRemote) return;
    loadingRemote = true;
    try {
      const r = await W.humanRequest('/v1/listen'), s = r.session;
      if (!s?.joined) throw Error('這場一起聽已經結束');
      if (s.provider === 'local' && !localList.some((x) => x.hash === s.media)) { invite = s; actions.listenImportTakeover = async () => { const hash = await pickSong(); if (hash !== s.media) return toast('請導入相同的音樂檔案'); closeModal(); actions.listenTakeover(); }; showModal('需要同一個音樂檔案', '<p class="help">本地音樂不會上傳。先導入手機上正在播放的同一個檔案，再切換裝置。</p><button class="pill" data-action="listenImportTakeover">導入並接手</button>'); return; }
      await post({ action: 'takeover' });
      remoteSession = null;
      await poll();
      if (tab === 'music') render();
    } catch (e) { toast(clean(e)); } finally { loadingRemote = false; }
  };
  actions.listenReturn = async () => { if (live) return actions.listenOpen(); await navigate('music'); };
  actions.listenOpen = () => { panel()?.classList.add('mz-big'); tick(); place(); };
  actions.listenFavorite = () => { if (live) { toggleFavorite({ url: linkOf(live.provider, live.media), title: song(), provider: live.provider, duration: live.duration }); render(); } };
  actions.listenClearRecent = () => confirmModal('清除最近聽過', '全部最近聽過都會刪除，歌單和收藏不受影響。', () => { saveRecent([]); closeModal(); render(); });
  let librarySongs = [];
  const showLibrary = (songs) => {
    librarySongs = songs;
    const box = document.querySelector('#mzLibrarySongs');
    if (box) box.innerHTML = (songs.length ? '<button class="pill full" data-action="listenLibraryAll">全部加入播放清單</button>' : '<p class="help">這裡沒有歌曲。</p>') + songs.map((x, i) => `<div class="mz-queue-row"><button class="setting-row" data-listenlibplay="${i}"><span class="user-content mz-recent-title"><b>${esc(x.title)}</b><small>${esc(x.artist || '')}</small></span></button><button class="pill" aria-label="收藏" data-listenlibsave="${i}">♡</button></div>`).join('');
  };
  const showFolders = (folders) => {
    const box = document.querySelector('#mzLibraryFolders');
    if (box) box.innerHTML = folders.map((x) => `<button class="setting-choice full user-content" data-listenfolderurl="${esc(x.url)}">${esc(x.title)}（${x.count || 0}）</button>`).join('');
  };
  actions.listenLibrary = () => showModal('Bilibili 公開歌單', '<p class="help">貼上任何人的公開收藏夾、合集、系列或個人空間連結就能讀取，不一定要是自己的。</p><label for="mzLibraryUrl">網址</label><input id="mzLibraryUrl" type="url" autocapitalize="off" spellcheck="false" placeholder="https://"><button class="pill primary full" data-action="listenLibraryRead">讀取</button><p id="mzLibraryError" class="inline-error"></p><div id="mzLibraryFolders"></div><div id="mzLibrarySongs"></div>');
  const readList = async (url) => {
    const error = document.querySelector('#mzLibraryError');
    error.textContent = '讀取中…';
    try {
      const r = await W.humanRequest('/v1/listen/import', { url });
      error.textContent = '';
      if (r.folders) showFolders(r.folders); else showLibrary(r.songs);
    } catch (x) { error.textContent = clean(x); }
  };
  actions.listenLibraryRead = () => { const url = document.querySelector('#mzLibraryUrl')?.value.trim(); if (url) readList(url); };
  actions.listenLibraryAll = () => { for (const x of librarySongs) addQueue(x); toast('已加入播放清單'); };
  actions.listenImport = async () => {
    try {
      if (await pickSong()) toast('已導入本地音樂');
    } catch (e) { toast(e.message || '導入失敗'); }
  };

  let namingRecent = false;
  async function nameRecent() {
    if (namingRecent || !humanData().connected) return;
    const list = recent(), item = list.find((x) => !x.named && !x.url.startsWith('mizuki-local') && (!x.title || x.title === NAMES[x.provider]));
    if (!item) return;
    namingRecent = true;
    try {
      const info = await W.humanRequest('/v1/listen/info', { url: item.url });
      item.named = true;
      item.title = info.title || (await videoInfo(info.media)).title || item.title;
      saveRecent(list);
      if (tab === 'music' && !chatId && !page && !modal) render();
    } catch { item.named = true; saveRecent(list); } finally { namingRecent = false; }
  }
  // The Music tab: pick a service, see who you're listening with, go back to a recent song.
  window.musicView = () => {
    const others = live ? otherPeople() : [];
    const bar = live ? `<div class="card mz-music-now"><div class="mz-music-summary"><p class="user-content"><b>${esc(others.length ? '正和 ' + others.map((p) => p.name).join('、') + ' 一起聽' : '正在聽')}</b>${esc('《' + song() + '》')}</p><p class="small">${NAMES[live.provider]}</p><div class="flex"><button class="pill" data-action="listenOpen">打開</button><button class="pill" data-action="listenQueue">切歌／排序</button><button class="pill" data-action="listenFavorite">${isFavorite(linkOf(live.provider, live.media)) ? '♥ 已收藏' : '♡ 收藏'}</button><button class="pill" data-action="listenMode">${MODES[live.mode || 'list']}</button><button class="pill" data-action="listenInvite">邀請</button><button class="pill" data-action="listenEnd">結束</button></div></div><div class="mz-music-preview ${live.provider==='bilibili'?'':'mz-no-video'}" aria-label="正在播放的畫面"></div></div>` : '';
    setTimeout(nameRecent, 300);
    const songRow = (x, i, kind) => `<div class="mz-queue-row"><button class="setting-row" data-listen${kind}="${i}"><span class="user-content mz-recent-title"><b>${esc(x.title && x.title !== NAMES[x.provider] ? x.title : x.named ? x.url.replace(/^https:\/\/(www\.)?/, '') : '讀取歌名中…')}</b><small>${esc(NAMES[x.provider] || '')}</small></span></button><button class="pill" aria-label="收藏" data-listenfav="${kind}:${i}">${isFavorite(x.url) ? '♥' : '♡'}</button>${kind === 'recent' ? `<button class="pill" aria-label="加入播放清單" data-listenaddrecent="${i}">＋</button><button class="pill" aria-label="刪除" data-listendelrecent="${i}">×</button>` : ''}</div>`;
    const list = recent().map((x, i) => songRow(x, i, 'recent')).join(''), saved = favorites().map((x, i) => songRow(x, i, 'saved')).join('');
    return header('聽歌', '搜尋 Bilibili 影片，再邀請 AI 或好友一起聽。') + `<div class="content">${remoteSession ? `<div class="card"><p class="user-content">正在 ${esc(remoteSession.deviceName)} 聽《${esc(remoteSession.title)}》</p><button class="pill primary" data-action="listenTakeover">切換到此裝置</button></div>` : ''}${bar}<div class="flex"><button class="pill primary" data-action="listenSearch">搜尋歌曲</button><button class="pill" data-action="listenAccounts">Bilibili 登入</button><button class="pill" data-action="listenQueue">播放清單／排序</button></div><div class="section-label">本地音樂</div><div class="card"><p class="help">可以離線自己聽。和 AI 或人類一起聽要有網路；和人類聽時，對方也要導入同一個檔案。</p>${localList.map((x) => `<div class="mz-local-row"><button class="setting-row" data-listenlocal="${esc(x.hash)}"><span class="user-content">${esc(x.title)}</span></button><button class="pill" data-listenaddlocal="${esc(x.hash)}">＋</button><button class="pill" data-listenlocaldel="${esc(x.hash)}">刪除</button></div>`).join('')}<button class="pill full" data-action="listenImport">導入本地音樂</button></div>${window.mzPlaylistsHtml?.() || ''}<div class="section-label">收藏</div><div class="card">${saved || '<p class="help">按 ♡ 把歌曲加入收藏。</p>'}<button class="pill full" data-action="listenLibrary">讀取 Bilibili 公開歌單</button></div>${list ? `<div class="section-label">最近聽過</div><div class="card">${list}<button class="pill full" data-action="listenClearRecent">清除全部最近聽過</button></div>` : ''}</div>`;
  };
  document.addEventListener('click', async (e) => {
    const libPlay = e.target.closest('[data-listenlibplay]'), libSave = e.target.closest('[data-listenlibsave]'), fav = e.target.closest('[data-listenfav]'), delRecent = e.target.closest('[data-listendelrecent]'), savedPlay = e.target.closest('[data-listensaved]');
    const folderUrl = e.target.closest('[data-listenfolderurl]');
    if (folderUrl) return readList(folderUrl.dataset.listenfolderurl);
    if (libPlay) { const x = librarySongs[+libPlay.dataset.listenlibplay]; closeModal(); return startSong(x.url, '', x.title, x.duration).catch((y) => toast(clean(y))); }
    if (libSave) { const x = librarySongs[+libSave.dataset.listenlibsave]; if (!isFavorite(x.url)) toggleFavorite(x); return; }
    if (fav) { const [kind, i] = fav.dataset.listenfav.split(':'); toggleFavorite((kind === 'recent' ? recent() : favorites())[+i]); return render(); }
    if (delRecent) { const list = recent(); list.splice(+delRecent.dataset.listendelrecent, 1); saveRecent(list); return render(); }
    if (savedPlay) { const x = favorites()[+savedPlay.dataset.listensaved]; return startSong(x.url, '', x.title, x.duration).catch((y) => toast(clean(y))); }
    const move = e.target.closest('[data-listenmove]'), remove = e.target.closest('[data-listenremove]'), queued = e.target.closest('[data-listenqueue]'), addRecent = e.target.closest('[data-listenaddrecent]'), addLocal = e.target.closest('[data-listenaddlocal]');
    if (move) { const [i, d] = move.dataset.listenmove.split(':').map(Number), j = i + d; if (j >= 0 && j < queue.length) { [queue[i], queue[j]] = [queue[j], queue[i]]; saveQueue(); actions.listenQueue(); } return; }
    if (remove) { queue.splice(+remove.dataset.listenremove, 1); saveQueue(); actions.listenQueue(); return; }
    if (queued) return switchSong(queue[+queued.dataset.listenqueue].url,queue[+queued.dataset.listenqueue].title,queue[+queued.dataset.listenqueue].duration).catch((x) => toast(clean(x)));
    if (addRecent) { addQueue(recent()[+addRecent.dataset.listenaddrecent]); return toast('已加入播放清單'); }
    if (addLocal) { const x = localList.find((x) => x.hash === addLocal.dataset.listenaddlocal); if (x) addQueue({ url: 'mizuki-local://' + x.hash, title: x.title, media: x.hash, provider: 'local' }); return toast('已加入播放清單'); }
    const playLocal = e.target.closest('[data-listenlocal]'), dropLocal = e.target.closest('[data-listenlocaldel]');
    if (playLocal) {
      return startLocal(playLocal.dataset.listenlocal, '').catch((x) => toast(clean(x)));
    }
    if (dropLocal) {
      if (live?.media === dropLocal.dataset.listenlocaldel) return toast('這首正在播放');
      await songs('readwrite', (s) => s.delete(dropLocal.dataset.listenlocaldel)).catch(() => {});
      return refreshLocal();
    }
    const again = e.target.closest('[data-listenrecent]'), card = e.target.closest('[data-listencard]');
    if (again) {
      startSong(recent()[+again.dataset.listenrecent].url, '',recent()[+again.dataset.listenrecent].title,recent()[+again.dataset.listenrecent].duration).catch((x) => toast(clean(x)));
    }
    if (card) {
      if (live) return switchSong(card.dataset.listencard,card.querySelector('b')?.textContent||'').catch((x) => toast(clean(x)));
      const pending = await W.humanRequest('/v1/listen').catch(() => null);
      if (pending?.session && !pending.session.joined) { invite = pending.session; return actions.listenJoin(); }
      // An old card only plays the song. It never brings anyone along.
      startSong(card.dataset.listencard, '', card.querySelector('b')?.textContent||'').catch((x) => toast(clean(x)));
    }
  });

  // Song invitations look like a card, not a link. The text stays plain so older versions can still read it.
  const INVITE = /^(?:邀請你一起聽|想和你一起聽)[：:]\s*(.*?)\s*(https:\/\/\S+|mizuki-local:\/\/[0-9a-f]{64})\s*$/s;
  function decorate() {
    for (const bubble of document.querySelectorAll('.message .bubble:not([data-song])')) {
      const hit = INVITE.exec(bubble.textContent.trim());
      if (!hit) continue;
      bubble.dataset.song = '1';
      const url = hit[2], site = SERVICE_OF(url);
      bubble.classList.add('mz-song-bubble');
      bubble.innerHTML = `<button class="mz-song-card" data-listencard="${esc(url)}"><span class="mz-song-cover">${icon('music')}</span><span class="mz-song-text user-content"><b>${esc(hit[1] || site)}</b><small>${esc(site)} · 一起聽</small></span><span class="mz-song-play" aria-hidden="true"></span></button>`;
    }
  }
  const SERVICE_OF = (url) => (url.startsWith('mizuki-local') ? NAMES.local : NAMES.bilibili);
  const baseRender = render;
  render = function () { baseRender(); decorate(); place(); tick(); drawPeople(); paint(); if(panel()) window.mizukiTranslate?.(panel()); };

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
    pollTurn++;
    if (live?.id) ended.add(live.id);
    stop();
    if (!solo) await post({ action: 'leave', force: true }).catch(() => {});
    for (const chat of new Set(chats)) await chatLine(chat, '結束一起聽歌');
  };

  window.mzListenApi = {
    current: () => (live ? { url: linkOf(live.provider, live.media), title: song(), provider: live.provider, duration: live.duration || 0 } : null),
    playList: async (items, at) => {
      if (!items.length) return;
      queue = items.map((x) => ({ ...x }));
      localStorage.setItem('mzSongQueue', JSON.stringify(queue));
      publishQueue();
      await startSong(items[at].url, '', items[at].title, items[at].duration);
      publishQueue();
    },
    searchInto: (fn) => { actions.listenSearch(); searchInto = fn; },
  };

  // Every AI can see this, like a status. It can't hear the audio, so all it has is the title.
  const context = W.context;
  W.context = (s, a, c) => {
    const out = context(s, a, c);
    if (!live || s.settings.personVisibility?.['ai:' + a.id]?.hideStatus) return out;
    const mine = myAis().includes(a.id), names = otherPeople().map((p) => p.name).filter((n) => n !== a.name), minutes = Math.max(1, Math.round((Date.now() - live.startedAt) / 60000));
    const who = (mine ? '和你' + (names.length ? '、' : '') : names.length ? '和 ' : '') + names.join('、') + (mine || names.length ? '一起' : '自己');
    out.push({ role: 'user', content: '［系統資訊，不是使用者說的話：使用者正在' + who + '聽「' + song() + '」（' + NAMES[live.provider] + '），已經聽了約 ' + minutes + ' 分鐘。你只知道歌名，聽不到聲音，不要編造歌詞或細節。你可以從歌名猜這首歌的情緒，但那只是猜測。如果聽起來難過或低落，而且符合你的個性和你們的關係，可以主動關心，例如問怎麼突然聽這首、是不是不開心；不要每次都問。］' });
    return out;
  };
}
