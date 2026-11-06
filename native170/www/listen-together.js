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
    ['ytmusic', '可免費／廣告，會員內容需登入', 'https://music.youtube.com/'],
    ['spotify', '免費／會員內容，依平台提供', 'https://open.spotify.com/'],
    ['apple', '完整歌曲需會員，可選免費試聽', 'https://music.apple.com/'],
    ['kkbox', '完整歌曲需會員，可選免費試聽', 'https://www.kkbox.com/'],
  ];
  const linkOf = (p, m) => ({ local: 'mizuki-local://' + m, youtube: 'https://youtu.be/' + m, ytmusic: 'https://music.youtube.com/watch?v=' + m, spotify: 'https://open.spotify.com/' + m, bilibili: 'https://www.bilibili.com/video/' + m, apple: 'https://music.apple.com/' + m, kkbox: 'https://www.kkbox.com/tw/tc/' + m }[p]);
  const recent = () => { try { return JSON.parse(localStorage.getItem('mzRecentSongs') || '[]'); } catch { return []; } };
  const remember = (song) => { try { localStorage.setItem('mzRecentSongs', JSON.stringify([song, ...recent().filter((x) => x.url !== song.url)].slice(0, 20))); } catch {} };
  const accessPrefs=()=>{try{return JSON.parse(localStorage.getItem('mzListenAccess')||'{}');}catch{return{};}};
  const defaultAccess=(provider)=>['apple','kkbox'].includes(provider)?'member':'free';
  const selectedAccess=(provider,requested)=>requested||((document.querySelector('#mzSearchProvider')?.value===provider&&document.querySelector('#mzSearchAccess')?.value)||accessPrefs()[provider]||defaultAccess(provider));
  const saveAccess=(provider,access)=>localStorage.setItem('mzListenAccess',JSON.stringify({...accessPrefs(),[provider]:access}));
  let switching = false, remoteSession = null, loadingRemote = false, listenFrom = '', pollTurn = 0, endTimer = 0, searchInto = null;
  const ended = new Set();
  const MODES = { list: '順序循環', one: '單曲循環', shuffle: '隨機播放' }, MODES_EN = { list: 'Loop list', one: 'Repeat one', shuffle: 'Shuffle' };
  const publishQueue = () => { if (live && !live.solo) post({ action: 'queue', queue }).catch((e) => toast(clean(e))); };
  let queue = (() => { try { return JSON.parse(localStorage.getItem('mzSongQueue') || '[]'); } catch { return []; } })();
  const saveQueue = () => { localStorage.setItem('mzSongQueue', JSON.stringify(queue)); publishQueue(); };
  const addQueue = (item) => { item={...item,access:item.access||selectedAccess(item.provider)};const index=queue.findIndex((x)=>x.url===item.url);if(index<0){queue.push(item);saveQueue();}else if(queue[index].access!==item.access){queue[index]={...queue[index],...item};saveQueue();} };
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
  function releasePlayer() {
    const audio=audioEl();
    if(audio){quiet=Date.now()+1500;audio.pause();const src=audio.src;audio.removeAttribute('src');audio.load();if(src)URL.revokeObjectURL(src);}
    panel()?.remove();
  }
  async function pushState(playing, position) {
    if (!live || live.ready === false) return;
    live.playing = playing;
    notice();
    if (live.solo) return;
    try {
      const r = await post({ action: 'update', playing, position });
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
    if (!el) return;
    const big = el.classList.contains('mz-big'), visible = tab === 'music' && !chatId && !page;
    const hasVideo = live && ['youtube','ytmusic','bilibili'].includes(live.provider);
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
    el.insertAdjacentHTML('beforeend', '<div class="mz-listen-controls"><button class="pill" data-action="listenPlaybackToggle">播放／暫停</button><button class="pill" data-action="listenPrevious">上一首</button><button class="pill" data-action="listenQueue">播放清單／切歌</button><button class="pill" data-action="listenNext">下一首</button><button class="pill" data-action="listenMode"></button></div>');
    el.querySelector('.mz-listen-head strong').textContent = song();
    el.querySelector('h3').textContent = song();
    el.querySelector('p.small').textContent = notes[live.provider] || '';
    const frame = el.querySelector('iframe');
    if (live.ready === false) { const gate=document.createElement('div');gate.className='mz-listen-login-gate';gate.innerHTML='<p class="help">'+esc((live.waitingForLogin||[]).join('、'))+' 尚未登入或沒有有效會員，等待全部真人成員完成登入。</p><button class="pill primary" data-action="listenAccounts">聽歌平台登入</button>';frame.replaceWith(gate); } else if (live.provider === 'local') {
      const audio = document.createElement('audio');
      audio.controls = true;
      frame.replaceWith(audio);
      loadLocal(audio);
    } else frame.src = server() + '/assets/listen-player.html?p=' + live.provider + '&id=' + encodeURIComponent(live.media) + '&t=' + Math.floor(live.start || 0) + '&compact=' + (wasBig ? '0' : '1');
    document.body.append(el);
    drawPeople();
    tick();
    report();
    paint();
    place();
    notice();
    window.mizukiTranslate?.(el);
    clearTimeout(endTimer);
    // Bilibili and Apple Music don't report the end of a song, so go by its length.
    if (live.duration > 0 && !['youtube', 'ytmusic', 'local'].includes(live.provider)) endTimer = setTimeout(autoNext, Math.max(5, live.duration - (live.start || 0) + 3) * 1000);
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
    const label = (english() ? '♪ Listening to ' : '♪ 正在聽 ') + text;
    if (el.textContent !== label) el.textContent = label;
  };
  function paint() {
    const mine = document.querySelector('.wx-profile-main');
    line(mine?.parentElement, song(), mine);
    if (chatId) line(document.querySelector('.conversation > header.top'), song() || remoteSession?.title || (chatId.startsWith('human:') ? window.MizukiPresence?.friends?.[chatId.slice(6)]?.listening || '' : ''));
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
      const turn = ++pollTurn, r = await W.humanRequest('/v1/listen'), s = r.session;
      if (turn !== pollTurn) return;
      skew = r.now - Date.now();
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
        live = { id: s.id, host: s.host, access:s.access, requiresMembership:s.requiresMembership, ready:s.ready, waitingForLogin:s.waitingForLogin, playing:s.playing, provider: s.provider, media: s.media, title: s.title, members: s.members, ais: s.ais, start: target(s), at: s.at, chats: [] };
        show();
        return;
      }
      if (s.provider !== live.provider || s.media !== live.media || s.ready !== live.ready || s.access !== live.access) {
        Object.assign(live, { access:s.access,requiresMembership:s.requiresMembership,ready:s.ready,waitingForLogin:s.waitingForLogin,provider: s.provider, media: s.media, title: s.title, start: target(s), playing: s.playing, at: s.at, members: s.members, ais: s.ais });
        show();
        if (tab === 'music' && !chatId && !page) render();
        return;
      }
      if (JSON.stringify(live.waitingForLogin) !== JSON.stringify(s.waitingForLogin)) { live.waitingForLogin=s.waitingForLogin; const message=panel()?.querySelector('.mz-listen-login-gate p'); if(message) message.textContent=(s.waitingForLogin||[]).join('、')+' 尚未登入或沒有有效會員，等待全部真人成員完成登入。'; }
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

  async function switchSong(url,requestedAccess,knownTitle='') {
    if (switching) return;
    if (!live) return startSong(url, '');
    switching = true;
    try {
      const local = url.startsWith('mizuki-local://'), media = local ? url.slice(15) : '';
      const item = local ? localList.find((x) => x.hash === media) : await W.humanRequest('/v1/listen/info', { url });
      if (!item) throw Error('你還沒有導入這首本地音樂');
      item.title ||= knownTitle;
      if (!local) url=linkOf(item.provider,item.media);
      const access=local?'free':selectedAccess(item.provider,requestedAccess);
      if(!local)saveAccess(item.provider,access);
      if (live.solo && (!local || humanData().connected)) {
        // Upgrade an offline solo player when the account is connected.
        if (!humanData().connected) throw Error('請先登入帳號');
        const r = await post({ action: 'start', ...(local ? { local: media } : { url }), title: item.title,access });
        Object.assign(live, r.session, { solo: false, start: 0, duration: item.duration || 0 });
      } else if (live.solo) Object.assign(live, { provider: 'local', media, title: item.title, start: 0, playing: true, duration: 0 });
      else {
        const r = await post({ action: 'switch', ...(local ? { local: media } : { url }), title: item.title,access });
        Object.assign(live, r.session, { start: 0, duration: item.duration || 0 });
      }
      window.mzAiEvent?.('listen', song(), myAis());
      const entry = { url, access, title: live.title || NAMES[live.provider], provider: live.provider };
      addQueue(entry); remember(entry);
      show(); closeModal();
      if (tab === 'music' && !chatId && !page) render();
    } finally { switching = false; }
  }
  const playQueued = async (direction) => {
    if (!queue.length) return toast('先將歌曲加入播放清單');
    const index = live ? queue.findIndex((x) => x.url === linkOf(live.provider, live.media) || (x.provider === live.provider && x.media === live.media)) : -1;
    const next = index < 0 ? 0 : (index + direction + queue.length) % queue.length;
    try { await switchSong(queue[next].url,queue[next].access,queue[next].title); } catch (e) { toast(clean(e)); }
  };
  // The list loops by itself; only the host moves everyone on, so two players never skip twice.
  const autoNext = () => {
    if (!live || !(live.solo || live.host === humanData().me?.id)) return;
    if (live.mode === 'one') return switchSong(linkOf(live.provider, live.media), live.access, live.title).catch((e) => toast(clean(e)));
    if (live.mode === 'shuffle' && queue.length > 1) {
      const here = queue.findIndex((x) => x.url === linkOf(live.provider, live.media));
      let next = here;
      while (next === here) next = Math.floor(Math.random() * queue.length);
      return switchSong(queue[next].url, queue[next].access, queue[next].title).catch((e) => toast(clean(e)));
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
  actions.listenAccounts = async () => {
    try {
      const r=await W.humanRequest('/v1/music-auth');
      showModal('聽歌平台登入','<p class="help">每台裝置需要分別授權。只有會員內容需要全部真人成員登入；免費／廣告內容可選不登入，試聽依平台提供。AI 不需要平台帳號。</p>'+r.platforms.map((x)=>`<div class="mz-queue-row"><span class="spacer">${NAMES[x.provider]}<small class="help">${x.loggedIn?(x.premium===false?'已登入 · 尚無有效會員':x.premium===true?'已登入 · 已確認會員':'已登入 · 會員資格由平台確認'):x.configured?'尚未登入':'尚未登入 · 等待平台設定'}</small></span><button class="pill" data-musiclogin="${x.provider}">${x.loggedIn?'重新登入':'登入'}</button><button class="pill" data-musicguest="${x.provider}">不登入</button>${x.loggedIn?`<button class="pill" data-musiclogout="${x.provider}">登出</button>`:''}</div>`).join(''));
    } catch(e){toast(clean(e));}
  };
  document.addEventListener('click',async(e)=>{
    const guest=e.target.closest('[data-musicguest]');
    if(guest){const provider=guest.dataset.musicguest;saveAccess(provider,['apple','kkbox'].includes(provider)?'preview':'free');actions.listenSearch();document.querySelector('#mzSearchProvider').value=provider;updateSearchAccess();return;}
    const login=e.target.closest('[data-musiclogin]'),logout=e.target.closest('[data-musiclogout]');
    if(!login&&!logout)return;
    try{
      const r=await W.humanRequest('/v1/music-auth',{action:login?'login':'logout',provider:login?.dataset.musiclogin||logout.dataset.musiclogout});
      if(r.pendingSetup)return toast(r.message,5000);
      if(r.url){if(window.Desktop)await Desktop.invoke('openLink',{url:r.url,browser:'system'});else window.open(r.url,'_blank','noopener');toast('完成平台授權後返回 App，登入狀態會自動更新',4000);}
      else actions.listenAccounts();
    }catch(e){toast(clean(e));}
  });
  function updateSearchAccess() {
    const provider=document.querySelector('#mzSearchProvider')?.value,select=document.querySelector('#mzSearchAccess');if(!provider||!select)return;
    const options=['youtube','bilibili'].includes(provider)?[['free','免費／廣告（不登入）']]:['apple','kkbox'].includes(provider)?[['member','會員完整播放（需登入）'],['preview','免費試聽（不登入，平台提供時）']]:[['free','免費／廣告（不登入，依平台提供）'],['member','會員內容（一起聽時所有人需登入）']];
    select.innerHTML=options.map(([id,label])=>`<option value="${id}">${label}</option>`).join('');
    const preferred=accessPrefs()[provider]||defaultAccess(provider);if(options.some(([id])=>id===preferred))select.value=preferred;
    window.mizukiTranslate?.(select);
  }
  document.addEventListener('change',(e)=>{if(e.target.id==='mzSearchProvider')updateSearchAccess();if(e.target.id==='mzSearchAccess')saveAccess(document.querySelector('#mzSearchProvider').value,e.target.value);});
  actions.listenSearch = () => {
    listenFrom = '';
    searchInto = null;
    showModal('搜尋歌曲', `<label>平台</label><select id="mzSearchProvider">${[['youtube','YouTube'],...SERVICES.filter((x) => x[0] !== 'youtube').map(([id]) => [id,NAMES[id]])].map(([id,name]) => `<option value="${id}">${name}</option>`).join('')}</select><label for="mzSearchAccess">播放模式</label><select id="mzSearchAccess"></select><label for="mzSongSearch">歌名或歌手</label><input id="mzSongSearch" type="search" placeholder="搜尋歌曲"><button class="pill primary" data-action="listenSearchRun">搜尋</button><p id="mzSongSearchStatus" class="help"></p><div id="mzSongResults"></div><button class="link-button" data-action="listenPasteUrl">使用歌曲網址</button>`);
    updateSearchAccess();
  };
  const searchSite = (provider,q) => ({ youtube:'https://www.youtube.com/results?search_query=',ytmusic:'https://music.youtube.com/search?q=',bilibili:'https://search.bilibili.com/all?keyword=',spotify:'https://open.spotify.com/search/',apple:'https://music.apple.com/tw/search?term=',kkbox:'https://www.kkbox.com/tw/tc/search.php?word=' }[provider] + encodeURIComponent(q));
  async function nativeSearch(provider,q) {
    if (!window.Desktop) throw Error('目前搜尋服務無法連線，請稍後重試；App 版可直接使用內置平台搜尋');
    const result = await Desktop.invoke('musicSearch', { url:searchSite(provider,q) });
    if (!result?.url || result.cancelled) return;
    await startSong(result.url.replace(/^http:/,'https:'), listenFrom);
  }
  actions.listenNativeSearch = async () => {
    const provider=document.querySelector('#mzSearchProvider')?.value||'youtube',q=document.querySelector('#mzSongSearch')?.value.trim();
    if (!q) return;
    try { await nativeSearch(provider,q); } catch(e) { toast(clean(e)); }
  };
  actions.listenSearchRun = async () => {
    const input = document.querySelector('#mzSongSearch'), status = document.querySelector('#mzSongSearchStatus'), box = document.querySelector('#mzSongResults');
    const q = input?.value.trim(), provider = document.querySelector('#mzSearchProvider')?.value, serial = ++searchCounter;
    if (!q) return;
    status.textContent = '搜尋中…'; box.innerHTML = '';
    try {
      const r = await W.humanRequest('/v1/listen/search', { q, provider });
      if (serial !== searchCounter || !box.isConnected) return;
      if (r.browse) { status.textContent = '正在開啟內置平台搜尋，點歌曲即可選取。'; await nativeSearch(provider,q); return; }
      searchResults = r.results;
      status.textContent = searchResults.length ? '點播放立即切換；＋加入播放清單。平台的會員與廣告限制仍適用。' : '找不到歌曲，試試其他關鍵字或平台。';
      if (!searchResults.length && window.Desktop) status.insertAdjacentHTML('beforeend','<button class="pill" data-action="listenNativeSearch">使用內置平台搜尋</button>');
      box.innerHTML = searchResults.map((x,i) => `<div class="mz-queue-row"><button class="setting-row" data-listensearchplay="${i}"><span class="user-content"><b>${esc(x.title)}</b><small>${esc(x.artist)}</small></span></button><button class="pill" data-listensearchadd="${i}" aria-label="加入播放清單">＋</button></div>`).join('');
    } catch (e) { if (serial === searchCounter && status.isConnected) { status.textContent = clean(e); if (window.Desktop) { status.insertAdjacentHTML('beforeend','<button class="pill" data-action="listenNativeSearch">使用內置平台搜尋</button>'); } } }
  };
  document.addEventListener('keydown', (e) => { if (e.target.id === 'mzSongSearch' && e.key === 'Enter') { e.preventDefault(); actions.listenSearchRun(); } });
  document.addEventListener('click', (e) => {
    const play = e.target.closest('[data-listensearchplay]'), add = e.target.closest('[data-listensearchadd]');
    if (play) { const item = searchResults[+play.dataset.listensearchplay]; if (item) startSong(item.url, listenFrom, undefined, item.title).catch((e) => toast(clean(e))); }
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
    live = { id: s.id, host: s.host, access:s.access, requiresMembership:s.requiresMembership, ready:s.ready, waitingForLogin:s.waitingForLogin, playing:s.playing, provider: 'local', media: hash, title: s.title, members: s.members, ais: s.ais, at: s.at, chats: [] };
    show();
    publishQueue();
    if (tab === 'music' && !chatId) render();
    noticeBusy(r);
    await tellPeople(peers, group);
    const chat = state.chats.find((c) => c.id === from);
    if (chat) await tellChat(from, chat.members);
  }
  async function startSong(url, from,requestedAccess,knownTitle='') {
    if (live) return switchSong(url,requestedAccess,knownTitle);
    listenFrom = '';
    if (url.startsWith('mizuki-local://')) return startLocal(url.slice(15), from);
    if (!humanData().connected) throw Error('請先登入帳號');
    const info = await W.humanRequest('/v1/listen/info', { url });
    info.title ||= knownTitle;
    url=linkOf(info.provider,info.media);
    const access=selectedAccess(info.provider,requestedAccess);saveAccess(info.provider,access);
    const group = from.startsWith('hgroup:') ? from.slice(7) : '', peers = from.startsWith('human:') ? [from.slice(6)] : [];
    const r = await post({ action: 'start', url, title: info.title, access, peers, ...(group ? { group } : {}) }), s = r.session;
    live = { id: s.id, host: s.host, access:s.access, requiresMembership:s.requiresMembership, ready:s.ready, waitingForLogin:s.waitingForLogin, playing:s.playing, provider: s.provider, media: s.media, title: s.title, members: s.members, ais: s.ais, at: s.at, chats: [], mode: s.mode || 'list', duration: info.duration || 0 };
    url = linkOf(s.provider, s.media);
    addQueue({ url, access, title: s.title || NAMES[s.provider], provider: s.provider, media: s.media });
    remember({ url, access, title: s.title || NAMES[s.provider], provider: s.provider });
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
  actions.listenImport = async () => {
    try {
      if (await pickSong()) toast('已導入本地音樂');
    } catch (e) { toast(e.message || '導入失敗'); }
  };

  // The Music tab: pick a service, see who you're listening with, go back to a recent song.
  window.musicView = () => {
    const others = live ? otherPeople() : [];
    const bar = live ? `<div class="card mz-music-now"><div class="mz-music-summary"><p class="user-content"><b>${esc(others.length ? '正和 ' + others.map((p) => p.name).join('、') + ' 一起聽' : '正在聽')}</b>${esc('《' + song() + '》')}</p><p class="small">${live.provider==='local'?'本地音樂':live.access==='member'?'會員內容':live.access==='preview'?'免費試聽':'免費／廣告，依平台提供'}</p><div class="flex"><button class="pill" data-action="listenOpen">打開</button><button class="pill" data-action="listenQueue">切歌／排序</button><button class="pill" data-action="listenMode">${MODES[live.mode || 'list']}</button><button class="pill" data-action="listenInvite">邀請</button><button class="pill" data-action="listenEnd">結束</button></div></div><div class="mz-music-preview ${['youtube','ytmusic','bilibili'].includes(live.provider)?'':'mz-no-video'}" aria-label="正在播放的畫面"></div></div>` : '';
    const tiles = SERVICES.map(([id, tag]) => `<button class="mz-music-tile" data-listenservice="${id}"><b>${NAMES[id]}</b><small>${tag}</small></button>`).join('');
    const list = recent().map((x, i) => `<div class="mz-queue-row"><button class="setting-row" data-listenrecent="${i}"><span class="user-content mz-recent-title"><b>${esc(x.title && x.title !== NAMES[x.provider] ? x.title : '未命名歌曲')}</b><small>${esc(NAMES[x.provider] || '')}</small></span></button><button class="pill" data-listenaddrecent="${i}">＋</button></div>`).join('');
    return header('聽歌', '在 App 內搜尋歌曲，再邀請 AI 或好友一起聽。') + `<div class="content">${remoteSession ? `<div class="card"><p class="user-content">正在 ${esc(remoteSession.deviceName)} 聽《${esc(remoteSession.title)}》</p><button class="pill primary" data-action="listenTakeover">切換到此裝置</button></div>` : ''}${bar}<div class="flex"><button class="pill primary" data-action="listenSearch">搜尋歌曲</button><button class="pill" data-action="listenAccounts">聽歌平台登入</button><button class="pill" data-action="listenQueue">播放清單／排序</button></div><div class="section-label">選擇平台</div><div class="mz-music-grid">${tiles}</div><div class="section-label">本地音樂</div><div class="card"><p class="help">可以離線自己聽。和 AI 或人類一起聽要有網路；和人類聽時，對方也要導入同一個檔案。</p>${localList.map((x) => `<div class="mz-local-row"><button class="setting-row" data-listenlocal="${esc(x.hash)}"><span class="user-content">${esc(x.title)}</span></button><button class="pill" data-listenaddlocal="${esc(x.hash)}">＋</button><button class="pill" data-listenlocaldel="${esc(x.hash)}">刪除</button></div>`).join('')}<button class="pill full" data-action="listenImport">導入本地音樂</button></div>${window.mzPlaylistsHtml?.() || ''}${list ? `<div class="section-label">最近聽過</div><div class="card">${list}</div>` : ''}</div>`;
  };
  document.addEventListener('click', async (e) => {
    const move = e.target.closest('[data-listenmove]'), remove = e.target.closest('[data-listenremove]'), queued = e.target.closest('[data-listenqueue]'), addRecent = e.target.closest('[data-listenaddrecent]'), addLocal = e.target.closest('[data-listenaddlocal]');
    if (move) { const [i, d] = move.dataset.listenmove.split(':').map(Number), j = i + d; if (j >= 0 && j < queue.length) { [queue[i], queue[j]] = [queue[j], queue[i]]; saveQueue(); actions.listenQueue(); } return; }
    if (remove) { queue.splice(+remove.dataset.listenremove, 1); saveQueue(); actions.listenQueue(); return; }
    if (queued) return switchSong(queue[+queued.dataset.listenqueue].url,queue[+queued.dataset.listenqueue].access,queue[+queued.dataset.listenqueue].title).catch((x) => toast(clean(x)));
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
    const service = e.target.closest('[data-listenservice]'), again = e.target.closest('[data-listenrecent]'), card = e.target.closest('[data-listencard]');
    if (service) {
      actions.listenSearch();
      document.querySelector('#mzSearchProvider').value = service.dataset.listenservice;updateSearchAccess();
    }
    if (again) {
      startSong(recent()[+again.dataset.listenrecent].url, '',recent()[+again.dataset.listenrecent].access,recent()[+again.dataset.listenrecent].title).catch((x) => toast(clean(x)));
    }
    if (card) {
      if (live) return switchSong(card.dataset.listencard,undefined,card.querySelector('b')?.textContent||'').catch((x) => toast(clean(x)));
      const pending = await W.humanRequest('/v1/listen').catch(() => null);
      if (pending?.session && !pending.session.joined) { invite = pending.session; return actions.listenJoin(); }
      // An old card only plays the song. It never brings anyone along.
      startSong(card.dataset.listencard, '').catch((x) => toast(clean(x)));
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
    current: () => (live ? { url: linkOf(live.provider, live.media), title: song(), provider: live.provider, access: live.access } : null),
    playList: async (items, at) => {
      if (!items.length) return;
      queue = items.map((x) => ({ ...x }));
      localStorage.setItem('mzSongQueue', JSON.stringify(queue));
      publishQueue();
      await startSong(items[at].url, '', items[at].access, items[at].title);
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
