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
  // Playback modes: off plays through the list once; list loops it; one repeats a song; shuffle jumps around;
  // smart picks what this person is likely to enjoy and adds new songs to the list.
  const MODE_NAMES = { off: ['關閉循環', 'Repeat off'], list: ['循環播放清單', 'Repeat list'], one: ['單曲循環', 'Repeat one'], shuffle: ['隨機播放', 'Shuffle'], smart: ['個人化播放：依你的喜好挑歌，也會加進歌單', 'Personalized: picks songs you like and adds them to the list'] };
  const EQ_SHAPE = Array.from({ length: 4 }, () => [.5, 1, 1, .5, 1, .5, .2, .5, .2]).flat();
  const svg = (inner, solid) => `<svg viewBox="0 0 24 24" aria-hidden="true" ${solid ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'}>${inner}</svg>`;
  const SHUFFLE = '<path d="M3 7h3.6c1.5 0 2.9.7 3.8 1.9l3.2 4.2c.9 1.2 2.3 1.9 3.8 1.9H21M3 17h3.6c1.5 0 2.9-.7 3.8-1.9l.7-.9M14.400 9.200l.2-.3C15.500 7.700 16.900 7 18.400 7H21M18 4l3 3-3 3M18 12l3 3-3 3"/>';
  const REPEAT = '<path d="M17 2l3 3-3 3M20 5H8a5 5 0 0 0-5 5v1M7 22l-3-3 3-3M4 19h12a5 5 0 0 0 5-5v-1"/>';
  const KEYS = { shuffle: svg(SHUFFLE), smart: svg(SHUFFLE + '<path fill="currentColor" stroke="none" d="M7 .5l1 2.700 2.700 1-2.700 1-1 2.700-1-2.700-2.700-1 2.700-1z"/>'), repeat: svg(REPEAT), one: svg(REPEAT + '<text x="12" y="15.500" font-size="9" font-weight="700" text-anchor="middle" fill="currentColor" stroke="none">1</text>'), previous: svg('<path d="M19 5v14L8 12zM5 5h2.500v14H5z"/>', true), next: svg('<path d="M5 5v14l11-7zM16.500 5H19v14h-2.500z"/>', true), play: svg('<path d="M8 5v14l11-7z"/>', true), pause: svg('<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>', true) };
  const publishQueue = () => { if (live && !live.solo) post({ action: 'queue', queue }).catch((e) => toast(clean(e))); };
  let queue = (() => { try { return kept(JSON.parse(localStorage.getItem('mzSongQueue') || '[]')); } catch { return []; } })();
  const saveQueue = () => { localStorage.setItem('mzSongQueue', JSON.stringify(queue)); publishQueue(); };
  const addQueue = (item) => { if(!queue.some((x)=>x.url===item.url)){queue.push(item);saveQueue();} };
  let live = null, skew = 0, trip = 0, settle = 0, offered = '', polling = false, invite = null, quiet = 0, localList = [], lastNotice = '';
  const notes = { bilibili: '暫停和進度條會同步給大家，音量只影響你自己。' };
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
    listenToAudio(el);
  }
  // The little ıllılı.ı. above the play button follows the real sound on a computer, for local songs and Bilibili videos.
  // Phones can't reach the video's sound, so there it moves by itself while playing.
  let eqContext = null, eqReader = null, eqVideo = null, eqAsking = false, eqLevels = EQ_SHAPE.map(() => .15);
  // Phones too: the sound is only sent through the meter once the meter can really play, so it never goes silent.
  function listenToAudio(el) {
    eqReader = null;
    try {
      eqContext?.close().catch(() => {});
      const context = eqContext = new AudioContext();
      const hook = () => {
        if (context !== eqContext || context.state !== 'running' || el.__mzMeter) return;
        el.__mzMeter = true;
        const reader = context.createAnalyser(); reader.fftSize = 64; reader.smoothingTimeConstant = .7;
        const source = context.createMediaElementSource(el);
        source.connect(reader); reader.connect(context.destination);
        eqReader = reader;
      };
      context.resume().then(hook).catch(() => {});
      el.addEventListener('play', () => context.resume().then(hook).catch(() => {}));
    } catch { eqReader = null; }
  }
  // A computer can tell when the video never arrived, and a black box with no reason is the worst answer.
  const NO_VIDEO = ['這台裝置載不到 Bilibili 影片，請確認能打開 bilibili.com', 'This device can\'t load the Bilibili video. Check that bilibili.com opens.'];
  function watchVideo(media) {
    if (!window.MushuiDesktop || live?.provider !== 'bilibili') return;
    eqVideo = null;
    setTimeout(() => {
      const shield = panel()?.querySelector('.mz-listen-shield');
      if (live?.media === media && live.playing !== false && !eqVideo && shield) shield.textContent = NO_VIDEO[english() ? 1 : 0];
    }, 15000);
  }
  function drawEq() {
    const box = panel()?.querySelector('.mz-eq-bars');
    if (!box || !live || !panel().classList.contains('mz-big')) return;
    const playing = live.playing !== false, audio = audioEl();
    // Where the real sound can't be read, the bars only move while something is actually playing.
    const sounding = audio ? !audio.paused && audio.currentTime > 0 : nativeState === 'playing';
    let bins = audio && eqReader ? new Uint8Array(eqReader.frequencyBinCount) : null;
    if (bins && playing) eqReader.getByteFrequencyData(bins);
    if (!audio && nativeVideo && nativeLevels?.length) bins = nativeLevels;
    if (!audio && window.MushuiDesktop && window.Desktop) {
      if (!eqAsking && playing) { eqAsking = true; Desktop.invoke('listenLevels').then((r) => { eqVideo = r; const shield = panel()?.querySelector('.mz-listen-shield'); if (r && shield && NO_VIDEO.includes(shield.textContent)) shield.textContent = ''; }).catch(() => { eqVideo = null; }).finally(() => { eqAsking = false; }); }
      bins = eqVideo;
    }
    const count = box.children.length, top = bins ? bins.length - 1 : 0;
    [...box.children].forEach((bar, i) => {
      // Bands are spread out of order, and the quiet high ones lifted, so it reads as ıllılı.ı. instead of a slope.
      const band = (i * 11) % count / count, heard = bins ? Math.min(1, bins[Math.floor(Math.pow(band, 1.7) * top)] / 215 * (1 + band * 2.2)) * (.45 + .55 * EQ_SHAPE[i]) : sounding ? EQ_SHAPE[i] * (.35 + Math.random() * .65) : 0;
      eqLevels[i] += ((playing ? Math.max(.12, heard) : .12) - eqLevels[i]) * .55;
      bar.style.transform = `scaleY(${eqLevels[i].toFixed(2)})`;
    });
  }
  setInterval(drawEq, 110);
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
  const touchPlayer = window.AndroidHost || window.IOSHost ? '&touch=1' : '';
  // Bilibili's phone player only plays once it has cookies, and an embedded frame can't get them. Its computer player works
  // from the first visit, on iPhone too. So phones run that one in a native view laid over the frame's spot, and the frame
  // only says where to sit and what to show.
  const nativeVideo = !!(window.IOSHost || window.AndroidHost);
  const showVideo = (frame, src) => { if (nativeVideo) frame.dataset.src = src; else frame.src = src; };
  // 3.3.8: on phones the small player in the Music tab is sound only. A native view over a scrolling page always trailed
  // behind (it shook, then went black while hidden), so there it plays out of sight. The full player page doesn't scroll
  // and still shows the video. Computers show it in both.
  if (nativeVideo) document.documentElement.classList.add('mz-phone-audio');
  // 3.4.0: this runs inside the phone's player page from the moment it loads (the app injects it), so the video starts
  // as soon as it can instead of waiting for the next check, the song's end is told to the app right away (also in the
  // background, where the app's own timers are held back), and the sound levels for ıllılı are read where the video is.
  const NATIVE_BOOT = `window.__mzBoot=1;(function(){var st={s:'loading',t:0,lv:[]},ctx=null,an=null,hooked=null;window.__mzListen=st;function css(){if(document.getElementById('mz-only-video')||!document.head)return;var s=document.createElement('style');s.id='mz-only-video';s.textContent='html,body{background:#000}[class*=bpx-player-top],[class*=bpx-player-control],[class*=bpx-player-toast],[class*=bpx-player-state],[class*=bpx-player-sending],[class*=bpx-player-ending],[class*=bpx-player-dialog],[class*=bpx-player-tooltip],[class*=bpx-player-relation],[class*=bpx-player-enter]{display:none!important}';document.head.appendChild(s);}function tell(){try{if(window.MizukiListen)window.MizukiListen.ended();}catch(e){}try{window.webkit.messageHandlers.mzListen.postMessage('ended');}catch(e){}}function tick(){try{css();var v=document.querySelector('video');if(!v){st.s='loading';return;}v.setAttribute('playsinline','');v.setAttribute('webkit-playsinline','');if(String(v.currentSrc||v.src).indexOf('error.mp4')>=0){st.s='error';return;}if(v.muted)v.muted=false;if(!v.__mzEnd){v.__mzEnd=1;v.addEventListener('ended',function(){st.s='ended';tell();});}if(v.ended){st.s='ended';return;}if(v.paused){var p=v.play();if(p&&p.catch)p.catch(function(){});st.s='paused';return;}st.t=v.currentTime;st.s=v.currentTime>0&&v.readyState>2?'playing':'loading';if(ctx&&ctx.state==='suspended')ctx.resume();if(st.s==='playing'&&hooked!==v&&String(v.currentSrc||'').indexOf('blob:')===0&&window.AudioContext){hooked=v;var c=ctx||(ctx=new AudioContext());c.resume().then(function(){if(c.state!=='running'||hooked!==v)return;var a=c.createAnalyser();a.fftSize=64;a.smoothingTimeConstant=.7;var src=c.createMediaElementSource(v);src.connect(a);a.connect(c.destination);an=a;}).catch(function(){});}if(an){var b=new Uint8Array(an.frequencyBinCount);an.getByteFrequencyData(b);st.lv=Array.prototype.slice.call(b,1,25);}}catch(e){}}setInterval(tick,150);tick();})();`;
  const NATIVE_CHECK = `(()=>{if(!window.__mzBoot){${NATIVE_BOOT}}var s=window.__mzListen||{};return [s.s||'loading',(+s.t||0).toFixed(1),(s.lv||[]).join('.')].join('|');})()`;
  window.mzListenCheck = NATIVE_CHECK;
  let nativeTime = 0, nativeLevels = null, nativeEndedFor = '', nativeFirst = true;
  const tabBarTop = () => { const r = document.querySelector('.nav')?.getBoundingClientRect(); return r && r.width > r.height && r.top > innerHeight / 2 ? r.top : innerHeight; };
  let nativeScrollAt = 0, nativeSent = '', nativeUrl = '', nativeState = '', nativeFails = 0, nativeReading = false;
  function placeNative() {
    const frame = player(), src = frame?.dataset.src, box = frame?.parentElement?.getBoundingClientRect(), found = src && src !== 'about:blank' ? new URL(src).searchParams : null;
    const url = found ? 'https://player.bilibili.com/player.html?bvid=' + found.get('id') + '&autoplay=1&high_quality=1&danmaku=0&t=' + Math.max(1, Math.floor(+found.get('t') || 0)) + '&mzs=' + (found.get('s') || '') : '';
    // The native view sits above the page, so the part that has scrolled under the title or the tab bar is cut off there too.
    const big = panel()?.classList.contains('mz-big'), top = big ? 0 : Math.max(0, document.querySelector('.page > header.top, .page header.top')?.getBoundingClientRect().bottom || 0), bottom = big ? innerHeight : tabBarTop();
    const clipTop = box ? Math.max(0, Math.round(top - box.top)) : 0, clipBottom = box ? Math.max(0, Math.round(box.bottom - bottom)) : 0;
    // Whole pixels only: fractions that change by a hair on every check made the video hop back and forth.
    const px = (v) => Math.round(v || 0);
    // A view laid over the page always trails a scrolling page by a frame or two, which looked like shaking.
    // So while the page moves the video is only made see-through (it keeps playing), and comes back where it belongs once it stops.
    const moving = Date.now() - nativeScrollAt < 220;
    if (nativeVideo && !big) {
      const hidden = { url, x: -4000, y: 0, width: 320, height: 180, clipTop: 0, clipBottom: 0, moving: false, show: !!url, boot: NATIVE_BOOT, ...(url && nativeFirst ? { keep: true } : {}) }, text = JSON.stringify(hidden);
      if (url) nativeFirst = false;
      if (url !== nativeUrl) { nativeUrl = url; nativeFails = 0; nativeState = ''; }
      if (text !== nativeSent) { nativeSent = text; Desktop.invoke('listenPlayer', hidden).catch(() => {}); }
      return;
    }
    const place = { url, x: px(box?.left), y: px(box?.top), width: px(box?.width), height: px(box?.height), clipTop, clipBottom, moving, show: !!box?.width && box.right > 0 && (box.height - clipTop - clipBottom) > 8 && !document.querySelector('#overlay .modal-backdrop, .call-overlay:not(.mz-min)'), boot: NATIVE_BOOT, ...(url && nativeFirst ? { keep: true } : {}) }, sent = JSON.stringify(place);
    if (url) nativeFirst = false;
    if (url !== nativeUrl) { nativeUrl = url; nativeFails = 0; nativeState = ''; }
    if (sent === nativeSent) return;
    nativeSent = sent;
    Desktop.invoke('listenPlayer', place).catch(() => {});
  }
  async function readNative() {
    if (!nativeUrl || nativeReading) { if (!nativeUrl) nativeState = ''; return; }
    nativeReading = true;
    try {
      const [found, time, levels] = String((await Desktop.invoke('listenPlayerState', { script: NATIVE_CHECK }))?.state || '').split('|');
      nativeState = found || ''; nativeTime = +time || 0;
      nativeLevels = levels ? levels.split('.').map(Number) : null;
      if (nativeState === 'playing') videoAt(nativeTime);
      if (nativeState === 'ended' && nativeEndedFor !== nativeUrl) { nativeEndedFor = nativeUrl; window.mzListenEnded(); }
      if (nativeState !== 'error') return;
      if (++nativeFails <= 3) await Desktop.invoke('listenPlayer', { ...JSON.parse(nativeSent), reload: true });
      else if (nativeFails === 4) toast(english() ? 'This video can\'t play here. Try another one.' : '這部影片無法播放，請換一首');
    } catch { nativeState = ''; } finally { nativeReading = false; }
  }
  // While the page scrolls, the video follows on every frame instead of catching up four times a second.
  let nativeFrame = 0, nativeSettle = 0;
  const followNative = (e) => {
    if (!nativeVideo) return;
    if (e?.type === 'scroll') { nativeScrollAt = Date.now(); clearTimeout(nativeSettle); nativeSettle = setTimeout(placeNative, 240); }
    if (nativeFrame) return;
    nativeFrame = requestAnimationFrame(() => { nativeFrame = 0; placeNative(); });
  };
  if (nativeVideo) { setInterval(placeNative, 250); setInterval(readNative, 300); document.addEventListener('scroll', followNative, { capture: true, passive: true }); window.addEventListener('resize', followNative); }
  // On a phone the first tap goes to Bilibili's player. Taps inside it can't be seen from here, except that the page loses focus.
  function tapHint() {
    if (!touchPlayer || nativeVideo) return;
    const shield = panel()?.querySelector('.mz-listen-shield');
    if (!shield) return;
    shield.textContent = english() ? 'Tap the video to start' : '點一下影片開始播放';
    const clear = () => { if (/點一下|Tap the/.test(shield.textContent)) shield.textContent = ''; window.removeEventListener('blur', clear); };
    window.addEventListener('blur', clear);
    setTimeout(clear, 12000);
  }
  const playerSrc = (start) => server() + '/assets/listen-player.html?p=' + live.provider + '&id=' + encodeURIComponent(live.media) + '&t=' + Math.max(1, Math.floor(start || 0)) + '&s=' + Date.now() + '&compact=1' + touchPlayer;
  // 3.4.0: the bar stays put until the video really plays, then follows the video's own time.
  const clock = () => (live.pos || 0) + (live.playing !== false && !live.waitVideo ? (Date.now() - (live.posAt || Date.now())) / 1000 : 0);
  function waitForVideo() {
    if (!live || live.provider === 'local') return;
    live.waitVideo = live.playing !== false;
    live.waitSince = Date.now();
    // A browser can't look inside the player; it just gives the video a moment.
    if (!nativeVideo && !window.MushuiDesktop) setTimeout(() => { if (live?.waitVideo) videoAt(live.pos || 0); }, 2500);
  }
  function videoAt(t) {
    if (!live || live.provider === 'local' || live.playing === false) return;
    const was = live.waitVideo;
    live.waitVideo = false;
    if (t > 0) { live.pos = t; live.posAt = Date.now(); }
    if (was) { live.posAt = Date.now(); armEnd(live.pos || 0); tick(); }
  }
  window.mzListenEnded = () => { if (live && live.provider !== 'local') { clearTimeout(endTimer); autoNext(); } };
  // Computers read the video's own time from the player frame.
  setInterval(() => {
    if (!live || live.provider === 'local' || live.playing === false || !window.MushuiDesktop || !window.Desktop) return;
    Desktop.invoke('listenProbe').then((r) => { if (r?.playing) videoAt(+r.t || 0); if (r?.ended && live?.waitVideo === false) window.mzListenEnded(); }).catch(() => {});
  }, 500);
  // Never stuck: after half a minute the bar moves anyway.
  setInterval(() => { if (live?.waitVideo && Date.now() - (live.waitSince || 0) > 30000) videoAt(live.pos || 0); }, 2000);
  const armEnd = (at) => { clearTimeout(endTimer); if (live.duration > 0 && live.provider !== 'local' && !live.waitVideo) endTimer = setTimeout(autoNext, Math.max(5, live.duration - (at || 0) + 3) * 1000); };
  // Volume is each person's own, and only computers need this: phones have their volume keys.
  const hearing = () => { try { const v = +localStorage.getItem('mzListenVolume'); return Number.isFinite(v) && localStorage.getItem('mzListenVolume') !== null ? v : 100; } catch { return 100; } };
  const volumeControl = () => !window.MushuiDesktop ? '' : `<label class="mz-listen-volume"><span aria-hidden="true">𖦤</span><input class="mz-listen-seek" data-listen-volume type="range" min="0" max="100" value="${hearing()}" step="1" aria-label="音量"></label>`;
  const sendVolume = (v) => { if (window.MushuiDesktop && window.Desktop) Desktop.invoke('listenVolume', { volume: v / 100 }).catch(() => {}); };
  document.addEventListener('input', (e) => {
    if (!e.target.matches?.('[data-listen-volume]')) return;
    try { localStorage.setItem('mzListenVolume', e.target.value); } catch {}
    sendVolume(+e.target.value);
  });
  function setVideo(playing, at) {
    if (!live || live.provider === 'local') return;
    Object.assign(live, { playing, pos: at, posAt: Date.now() });
    const frame = player(), shield = panel()?.querySelector('.mz-listen-shield');
    if (frame) showVideo(frame, playing ? playerSrc(at) : 'about:blank');
    waitForVideo();
    if (nativeVideo) placeNative();
    if (shield) shield.textContent = playing ? '' : (english() ? 'Paused' : '已暫停');
    if (playing) tapHint();
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
    const hasVideo = live?.provider === 'bilibili' && !(nativeVideo && !el.classList.contains('mz-big'));
    const slot = visible && hasVideo && document.querySelector('.mz-music-preview');
    const layout = big ? 'full' : 'video-only';
    el.dataset.playerLayout = layout;
    el.classList.toggle('mz-away', !big && !slot);
    el.classList.toggle('mz-docked', !big && !!slot);
    if (big || !slot) { if (el.dataset.dockRect) { for (const name of ['left', 'top', 'width', 'height']) el.style.removeProperty(name); delete el.dataset.dockRect; } el.style.removeProperty('clip-path'); delete el.dataset.clipped; }
    if (!big && slot) {
      const r = slot.getBoundingClientRect();
      const rect = [r.left, r.top, r.width, r.height].map((x) => Math.round(x * 10) / 10).join(',');
      if (el.dataset.dockRect !== rect) { el.dataset.dockRect = rect; Object.assign(el.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); }
      // It floats over the page, so whatever has scrolled under the title or the tab bar is cut off.
      const over = Math.max(0, (document.querySelector('.page > header.top, .page header.top')?.getBoundingClientRect().bottom || 0) - r.top), under = Math.max(0, r.bottom - tabBarTop());
      el.style.clipPath = over || under ? `inset(${over}px 0 ${under}px 0)` : '';
      if (over || under) el.dataset.clipped = '1'; else delete el.dataset.clipped;
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
  // Bilibili refuses plain requests for a video's details, so they're read the way its own pages do, out of sight.
  const INFO_PAGE = `(()=>{const d=window.__INITIAL_STATE__&&window.__INITIAL_STATE__.videoData;return JSON.stringify(d&&d.duration?[{title:d.title||'',duration:d.duration}]:[]);})()`;
  const infoQuick = (media) => `fetch('https://api.bilibili.com/x/web-interface/view?bvid=${media}',{credentials:'include'}).then(r=>r.json()).then(d=>JSON.stringify(d.data&&d.data.duration?[{title:d.data.title||'',duration:d.data.duration}]:[])).catch(()=>'[]')`;
  const infoKnown = new Map();
  const videoInfo = async (media) => {
    if (infoKnown.has(media)) return infoKnown.get(media);
    let info = { title: '', duration: 0 };
    if (window.Desktop && /^BV[0-9A-Za-z]{8,14}$/.test(media)) {
      const r = await Desktop.invoke('musicSearchList', { url: window.MushuiDesktop ? 'https://search.bilibili.com/video?keyword=music' : 'https://www.bilibili.com/video/' + media, script: INFO_PAGE, quick: infoQuick(media) }).catch(() => null);
      const x = r?.results?.[0];
      if (x) info = { title: String(x.title || '').slice(0, 160), duration: +x.duration || 0 };
    }
    if (info.duration) infoKnown.set(media, info);
    return info;
  };
  // Everyone needs the length: it drives the shared progress bar and the replay when the song ends.
  async function learnLength() {
    const media = live?.media;
    if (!media || live.provider !== 'bilibili') return;
    if (!live.duration) {
      const info = await videoInfo(media);
      if (!live || live.media !== media || !info.duration) return;
      live.duration = info.duration;
      if (live.playing !== false) armEnd(clock());
      tick();
    }
    if (!live.solo) post({ action: 'duration', media, duration: live.duration }).catch(() => {});
  }

  const groupFace = (id) => {
    for (const g of (typeof MizukiGroups !== 'undefined' ? MizukiGroups : null)?.data?.groups || []) { const p = (g.members || []).find((m) => m.id === id); if (p) return p; }
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
    el.insertAdjacentHTML('beforeend', `<div class="mz-listen-controls"><div class="mz-eq" aria-hidden="true"><span>✩♬ ₊˚.</span><b class="mz-eq-bars">${'<i></i>'.repeat(EQ_SHAPE.length)}</b><span>⋆☾⋆⁺₊✧</span></div><div class="mz-listen-seekrow"><span class="mz-listen-clock"></span><input class="mz-listen-seek" type="range" min="0" max="100" value="0" step="1" aria-label="播放進度">${volumeControl()}</div><div class="mz-player-keys"><button class="mz-key" type="button" data-action="listenShuffle"></button><button class="mz-key" type="button" data-action="listenPrevious" aria-label="上一首">${KEYS.previous}</button><button class="mz-key mz-key-play" type="button" data-action="listenPlaybackToggle"></button><button class="mz-key" type="button" data-action="listenNext" aria-label="下一首">${KEYS.next}</button><button class="mz-key" type="button" data-action="listenRepeat"></button></div></div>`);
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
      // Only the picture shows. Bilibili's bar is cropped away and the picture takes no clicks: everything is on the app's own controls.
      const box = document.createElement('div');
      box.className = 'mz-listen-video';
      frame.before(box); box.append(frame);
      box.insertAdjacentHTML('beforeend', '<div class="mz-listen-shield"></div>');
      showVideo(frame, playerSrc(live.start));
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
    waitForVideo();
    if (!live.waitVideo) armEnd(live.pos);
    if (nativeVideo) placeNative();
    if (live.provider !== 'local' && live.playing === false) setVideo(false, live.pos);
    learnLength();
    if (live.provider !== 'local' && live.playing !== false) tapHint();
    watchVideo(live.media);
  }
  let volumeBeat = 0;
  // A bar across the top of the screen stays above this page, so the page's buttons sit just under it.
  function placeHead() {
    const head = panel()?.querySelector('.mz-listen-head');
    if (!head) return;
    let below = 0;
    if (panel().classList.contains('mz-big')) for (const bar of [document.querySelector('#mzCallBar'), document.querySelector('#mzListenBand')]) {
      const r = bar?.getBoundingClientRect();
      if (r?.height && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === bar) below = Math.max(below, r.bottom);
    }
    head.style.top = below ? below + 8 + 'px' : '';
  }
  setInterval(placeHead, 500);
  const tick = () => {
    const el = panel();
    if (!el || !live) return;
    const time = el.querySelector('.mz-listen-time'), minutes = Math.floor((Date.now() - live.startedAt) / 60000), en = english();
    const big = el.classList.contains('mz-big'), text = en ? (minutes ? 'Together for ' + minutes + ' min' : 'Just started') : (minutes ? '一起聽了 ' + minutes + ' 分鐘' : '剛開始一起聽');
    if (time.textContent !== text) time.textContent = text;
    const toggle = el.querySelector('[data-action="listenToggle"]'), label = big ? (en ? 'Shrink' : '縮小') : (en ? 'Open' : '展開');
    if (toggle.textContent !== label) toggle.textContent = label;
    const mode = live.mode || 'off', say = (name) => MODE_NAMES[name][en ? 1 : 0], key = (action, on, icon, name) => { const b = el.querySelector(`[data-action="${action}"]`); if (!b) return; if (b.dataset.icon !== icon) { b.dataset.icon = icon; b.innerHTML = KEYS[icon]; } b.classList.toggle('is-on', on); b.setAttribute('aria-label', say(name)); b.title = say(name); };
    key('listenShuffle', mode === 'shuffle' || mode === 'smart', mode === 'smart' ? 'smart' : 'shuffle', mode === 'smart' ? 'smart' : 'shuffle');
    key('listenRepeat', mode === 'list' || mode === 'one', mode === 'one' ? 'one' : 'repeat', mode === 'one' ? 'one' : mode === 'list' ? 'list' : 'off');
    const pause = el.querySelector('.mz-key-play'), icon = live.playing !== false ? 'pause' : 'play';
    if (pause && pause.dataset.icon !== icon) { pause.dataset.icon = icon; pause.innerHTML = KEYS[icon]; pause.setAttribute('aria-label', icon === 'pause' ? (en ? 'Pause' : '暫停') : (en ? 'Resume' : '繼續')); }
    const seek = el.querySelector('.mz-listen-seek:not([data-listen-volume])'), row = el.querySelector('.mz-listen-seekrow'), length = live.duration || 0;
    if (row) row.hidden = live.provider === 'local';
    if (seek) { seek.hidden = !length; el.querySelector('.mz-listen-clock').hidden = !length; }
    // The video element comes and goes as the player loads, so the volume is set again now and then.
    if (window.MushuiDesktop && live.provider !== 'local' && !(++volumeBeat % 3)) sendVolume(hearing());
    if (seek && length && document.activeElement !== seek) { const at = Math.min(length, clock()); seek.max = length; seek.value = at; seek.style.setProperty('--range-progress', at / length * 100 + '%'); const mm = (x) => Math.floor(x / 60) + ':' + String(Math.floor(x % 60)).padStart(2, '0'); el.querySelector('.mz-listen-clock').textContent = 'ᯓ‎♪ ' + mm(at); }
  };
  const spotOf = () => (live ? readSpots()[live.provider + ':' + live.media] || 0 : 0);
  const drawResume = () => {
    const el = panel();
    if (!el || !live) return;
    let b = el.querySelector('.mz-listen-resume');
    const spot = spotOf(), now = live.provider === 'local' ? (audioEl()?.currentTime || 0) : clock(), show = spot > 0 && now < spot - 5 && !live.resumeUsed;
    if (!show) { b?.remove(); return; }
    const mm = (x) => Math.floor(x / 60) + ':' + String(Math.floor(x % 60)).padStart(2, '0'), text = (english() ? 'Jump to where you left off · ' : '跳到上次的進度 · ') + mm(spot);
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'pill mz-listen-resume'; b.dataset.action = 'listenResumeSpot'; (el.querySelector('.mz-listen-controls') || el).before(b); }
    if (b.textContent !== text) b.textContent = text;
  };
  setInterval(drawResume, 1000);
  actions.listenResumeSpot = () => {
    if (!live) return;
    const at = spotOf(), playing = live.playing !== false;
    live.resumeUsed = true;
    panel()?.querySelector('.mz-listen-resume')?.remove();
    if (!at) return;
    const el = audioEl();
    if (el) { el.currentTime = at; return; }
    setVideo(playing, at);
    pushState(playing, at);
  };
  // Bilibili's own bar only moves this device, so this is the one that moves everyone.
  document.addEventListener('change', (e) => {
    if (!e.target.matches?.('.mz-listen-seek:not([data-listen-volume])') || !live) return;
    const at = +e.target.value, playing = live.playing !== false;
    e.target.blur();
    setVideo(playing, at);
    pushState(playing, at);
  });
  setInterval(tick, 1000);
  let modeHold = 0;
  const setMode = (next) => {
    if (!live) return;
    live.mode = next; modeHold = Date.now() + 2500;
    tick();
    if (!live.solo) post({ action: 'mode', mode: next }).catch((e) => toast(clean(e)));
  };
  actions.listenShuffle = () => { const m = live?.mode; setMode(m === 'shuffle' ? 'smart' : m === 'smart' ? 'off' : 'shuffle'); };
  actions.listenRepeat = () => { const m = live?.mode; setMode(m === 'list' ? 'one' : m === 'one' ? 'off' : 'list'); };
  actions.listenPlaybackToggle = () => window.mzListenToggle();
  actions.listenToggle = () => { panel()?.classList.toggle('mz-big'); tick(); place(); };
  const SPOTS = 'mzListenSpots';
  const readSpots = () => { try { return JSON.parse(localStorage.getItem(SPOTS) || '{}'); } catch { return {}; } };
  function rememberSpot() {
    if (!live?.media) return;
    const at = live.provider === 'local' ? (audioEl()?.currentTime || 0) : clock(), length = live.duration || 0, spots = readSpots();
    if (at > 15 && (!length || at < length - 10)) spots[live.provider + ':' + live.media] = Math.floor(at); else delete spots[live.provider + ':' + live.media];
    const keys = Object.keys(spots); for (const k of keys.slice(0, Math.max(0, keys.length - 50))) delete spots[k];
    try { localStorage.setItem(SPOTS, JSON.stringify(spots)); } catch {}
  }
  function stop(message) {
    clearTimeout(endTimer);
    rememberSpot();
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
    line(mine, song());
    // The band across the top is the one place that names the song.
    const top = document.querySelector('.desktop-shell') || document.querySelector('#app'), hearing = song() || remoteSession?.title || '';
    let band = document.querySelector('#mzListenBand');
    if (top && hearing) {
      if (!band) { band = document.createElement('button'); band.id = 'mzListenBand'; band.type = 'button'; band.className = 'mz-listening user-content'; band.dataset.action = 'listenReturn'; }
      if (band.parentElement !== top) top.prepend(band);
      const text = listeningLabel() + ' · ' + hearing;
      if (band.textContent !== text) band.textContent = text;
    } else band?.remove();
    // The band takes its height from the page below it, so the composer and nav stay on screen.
    document.querySelector('#app')?.classList.toggle('mz-banded', !!document.querySelector('#app > #mzListenBand'));
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
        live = { id: s.id, host: s.host, playing:s.playing, provider: s.provider, media: s.media, title: s.title, members: s.members, ais: s.ais, start: target(s), at: s.at, chats: [], duration: s.duration || 0 };
        show();
        return;
      }
      if (live.switchUntil > Date.now()) return;
      if (s.provider !== live.provider || s.media !== live.media) {
        Object.assign(live, { provider: s.provider, media: s.media, title: s.title, start: target(s), playing: s.playing, at: s.at, members: s.members, ais: s.ais, duration: s.duration || 0 });
        show();
        if (tab === 'music' && !chatId && !page) render();
        return;
      }
      live.members = s.members;
      live.ais = s.ais;
      if (s.duration && !live.duration) { live.duration = s.duration; tick(); }
      if (Date.now() >= modeHold) live.mode = s.mode || 'off';
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
    rememberSpot();
    if (switching) return;
    if (!live) return startSong(url, '');
    switching = true;
    try {
      const local = url.startsWith('mizuki-local://'), media = local ? url.slice(15) : '';
      // 3.4.0: a Bilibili song starts right away. The server, the title and the length catch up in the background,
      // instead of the song waiting for all three first.
      const bv = !local && !live.solo ? (String(url).match(/BV[0-9A-Za-z]{10}/) || [])[0] : '';
      if (bv) {
        const hold = Date.now() + 15000;
        Object.assign(live, { provider: 'bilibili', media: bv, title: knownTitle || '', start: 0, playing: true, duration: +knownLength || 0, switchUntil: hold, resumeUsed: false });
        url = linkOf('bilibili', bv);
        window.mzAiEvent?.('listen', song(), myAis());
        const entry = { url, title: live.title || NAMES.bilibili, provider: 'bilibili', media: bv, duration: live.duration || 0 };
        addQueue(entry); remember(entry);
        show(); closeModal();
        if (tab === 'music' && !chatId && !page) render();
        (async () => {
          try {
            const r = await post({ action: 'switch', url, title: live.title });
            if (live?.media === bv && r.session) { Object.assign(live, { id: r.session.id, host: r.session.host, members: r.session.members, ais: r.session.ais, at: r.session.at, mine: r.session.at }); drawPeople(); }
          } catch (e) { toast(clean(e)); } finally { if (live?.media === bv) live.switchUntil = 0; }
          if (!live?.title && live?.media === bv) {
            const info = await videoInfo(bv).catch(() => ({}));
            if (live?.media === bv && info.title) { live.title = info.title; const el = panel(); if (el) { el.querySelector('.mz-listen-head strong').textContent = song(); el.querySelector('h3').textContent = song(); } notice(); paint(); }
          }
        })();
        return;
      }
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
  // The same song again, from the top, for everyone.
  function replay() {
    const audio = audioEl();
    if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); return; }
    setVideo(true, 0);
    pushState(true, 0);
  }
  // Personalized: the list's best match that hasn't played yet; when none is left, a similar song joins the list.
  const heard = new Set();
  async function smartNext(here) {
    let next = tasteOrder(queue.filter((x) => x.url !== here && !heard.has(x.url)))[0];
    if (!next) {
      const word = String(live.title || '').replace(/[【\[(（].*?[】\])）]/g, ' ').trim().split(/\s+/).slice(0, 3).join(' ').slice(0, 30);
      next = tasteOrder((word ? await deviceSearch(word, 'recommend', 1) : []).filter((x) => x.url !== here && !heard.has(x.url)))[0];
      if (next) addQueue(next);
    }
    if (next) return switchSong(next.url, next.title, next.duration);
    heard.clear();
    replay();
  }
  const autoNext = () => {
    if (!live || !(live.solo || live.host === humanData().me?.id)) return;
    const here = linkOf(live.provider, live.media);
    heard.add(here);
    if (live.mode === 'smart') return smartNext(here).catch((e) => toast(clean(e)));
    const last = queue.findIndex((x) => x.url === here) === queue.length - 1, alone = !queue.some((x) => x.url !== here);
    if (live.mode === 'one' || (live.mode === 'list' && alone)) return replay();
    if ((live.mode || 'off') === 'off' && (alone || last)) return;
    if (live.mode === 'shuffle' && queue.length > 1) {
      const at = queue.findIndex((x) => x.url === here);
      let next = at;
      while (next === at) next = Math.floor(Math.random() * queue.length);
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
    searchSort = 'recommend'; searchPage = 1; searchWord = '';
    if (window.MushuiDesktop && window.Desktop) Desktop.invoke('musicSearchList', { url: searchSite('music', 'recommend', 1), script: '[]', warm: true }).catch(() => {});
    showModal('搜尋歌曲', `<label for="mzSongSearch">歌名或歌手</label><input id="mzSongSearch" type="search" placeholder="歌名、歌手，或貼上 Bilibili 分享內容"><button class="pill primary" data-action="listenSearchRun">搜尋</button><div class="flex mz-search-sort"><button class="pill" data-listensort="recommend">推薦</button><button class="pill" data-listensort="hot">熱門</button><button class="pill" data-listensort="new">新發佈</button></div><p id="mzSongSearchStatus" class="help"></p><div id="mzSongResults"></div><div id="mzSongPager" class="flex mz-search-pager"></div><button class="link-button" data-action="listenPasteUrl">使用歌曲網址</button>`);
  };
  const ORDERS = { recommend: 'totalrank', hot: 'click', new: 'pubdate' }, PER_PAGE = 30;
  const searchSite = (q, sort, page) => 'https://search.bilibili.com/video?keyword=' + encodeURIComponent(q) + (sort === 'recommend' ? '' : '&order=' + ORDERS[sort]) + (page > 1 ? '&page=' + page + '&o=' + (page - 1) * PER_PAGE : '');
  // This device reads the normal search page out of sight and the songs are listed here, so no extra window opens.
  // The server is usually refused by Bilibili, which is why the device goes first.
  const READ_RESULTS = `(()=>{const seen=new Set(),out=[];for(const a of document.querySelectorAll('a[href*="/video/BV"]')){const m=a.href.match(/\/video\/(BV[0-9A-Za-z]{8,14})/);if(!m||seen.has(m[1]))continue;const card=a.closest('.bili-video-card,.video-list-item,.v-card')||a,name=card.querySelector('.bili-video-card__info--tit,h3,.title'),title=((name&&(name.getAttribute('title')||name.textContent))||a.title||a.textContent||'').trim();if(!title)continue;seen.add(m[1]);out.push({title,artist:((card.querySelector('.bili-video-card__info--author,.up-name,.author')||{}).textContent||'').trim(),time:((card.querySelector('.bili-video-card__stats__duration,.duration')||{}).textContent||'').trim(),url:'https://www.bilibili.com/video/'+m[1],provider:'bilibili'});if(out.length>=${PER_PAGE})break;}return JSON.stringify(out);})()`;
  // Once a page is open the same search takes a moment: it asks Bilibili the way that page itself does.
  const quickRead = (q, sort, page) => `fetch('https://api.bilibili.com/x/web-interface/search/type?search_type=video&page_size=${PER_PAGE}&keyword=${encodeURIComponent(q)}&order=${ORDERS[sort]}&page=${page}',{credentials:'include'}).then(r=>r.json()).then(d=>{const t=document.createElement('textarea'),plain=x=>{t.innerHTML=String(x||'').replace(/<[^>]+>/g,'');return t.value;};return JSON.stringify(((d.data&&d.data.result)||[]).filter(x=>x.bvid).map(x=>({title:plain(x.title),artist:x.author||'',time:x.duration||'',url:'https://www.bilibili.com/video/'+x.bvid,provider:'bilibili'})));}).catch(()=>'[]')`;
  const secondsOf = (text) => String(text || '').split(':').reduce((sum, part) => sum * 60 + (+part || 0), 0);
  async function deviceSearch(q, sort, page) {
    if (!window.Desktop) return [];
    const r = await Desktop.invoke('musicSearchList', { url: searchSite(q, sort, page), script: READ_RESULTS, quick: quickRead(q, sort, page) }).catch(() => null);
    return (r?.results || []).map((x) => ({ ...x, duration: secondsOf(x.time) }));
  }
  // 推薦: what this person listens to decides the order. Someone who plays English songs and searches 翻唱 sees English covers first.
  const titleKind = (t) => /[\u3040-\u30ff]/.test(t) ? 'ja' : /[\uac00-\ud7af]/.test(t) ? 'ko' : (t.match(/[a-z]/gi) || []).length > (t.match(/[\u4e00-\u9fff]/g) || []).length * 2 ? 'en' : 'zh';
  const wordsIn = (t) => [...(t.toLowerCase().match(/[a-z]{3,}/g) || []), ...[...t.replace(/[^\u4e00-\u9fff]/g, '')].map((c, i, all) => c + (all[i + 1] || '')).filter((x) => x.length === 2)];
  function tasteOrder(list) {
    const heard = [...recent(), ...favorites()].map((x) => String(x.title || '')).filter(Boolean);
    if (!heard.length) return list;
    const kinds = {}, words = {};
    for (const t of heard) { kinds[titleKind(t)] = (kinds[titleKind(t)] || 0) + 1; for (const w of wordsIn(t)) words[w] = (words[w] || 0) + 1; }
    const score = (t) => 2 * (kinds[titleKind(t)] || 0) / heard.length + Math.min(1, wordsIn(t).reduce((sum, w) => sum + (words[w] ? 1 : 0), 0) / 5);
    return list.map((x, i) => ({ x, i, s: score(x.title) })).sort((a, b) => b.s - a.s || a.i - b.i).map((r) => r.x);
  }
  window.mzTasteOrder = tasteOrder;
  // Sharing from Bilibili gives 「【title】 link」. Only the link matters; the title saves looking it up.
  const pastedLink = (text) => (text.match(/https?:\/\/[^\s，。、！？「」【】（）()<>"']*(?:bilibili\.com|b23\.tv|bili2233\.cn)[^\s，。、！？「」【】（）()<>"']*/i) || [])[0] || '';
  const pastedTitle = (text) => (text.match(/【(.+?)】/)?.[1] || '').replace(/[-_]哔哩哔哩.*$/, '').trim();
  let searchSort = 'recommend', searchPage = 1, searchWord = '';
  const found = new Map();
  const paintSort = () => document.querySelectorAll('[data-listensort]').forEach((b) => b.classList.toggle('primary', b.dataset.listensort === searchSort));
  actions.listenSearchRun = async () => {
    const input = document.querySelector('#mzSongSearch'), status = document.querySelector('#mzSongSearchStatus'), box = document.querySelector('#mzSongResults');
    const q = input?.value.trim(), serial = ++searchCounter;
    if (!q) return;
    const link = pastedLink(q);
    if (link) {
      status.textContent = '正在開啟…';
      try { await startSong(link, listenFrom, pastedTitle(q)); if (modal) closeModal(); } catch (e) { status.textContent = clean(e); }
      return;
    }
    if (q !== searchWord) { searchWord = q; searchPage = 1; }
    status.textContent = '搜尋中…'; box.innerHTML = '';
    const pager = document.querySelector('#mzSongPager'); if (pager) pager.innerHTML = '';
    paintSort();
    try {
      const key = [q, searchSort, searchPage].join('|');
      let list = found.get(key);
      if (!list) {
        list = await deviceSearch(q, searchSort, searchPage);
        if (serial !== searchCounter || !box.isConnected) return;
        if (!list.length) list = (await W.humanRequest('/v1/listen/search', { q, sort: searchSort, page: searchPage })).results || [];
        if (serial !== searchCounter || !box.isConnected) return;
        if (list.length) found.set(key, list);
      }
      searchResults = searchSort === 'recommend' ? tasteOrder(list) : list;
      if (pager) pager.innerHTML = (searchPage > 1 ? '<button class="pill" data-listenpage="-1">上一頁</button>' : '') + (searchResults.length ? `<span class="small">第 ${searchPage} 頁</span>` : '') + (searchResults.length >= 15 ? '<button class="pill" data-listenpage="1">下一頁</button>' : '');
      status.textContent = searchResults.length ? '點一下立即播放；＋加入播放清單。' : '找不到歌曲，試試其他關鍵字。';
      box.closest('.sheet')?.scrollTo?.({ top: 0 });
      box.innerHTML = searchResults.map((x,i) => `<div class="mz-queue-row"><button class="setting-row" data-listensearchplay="${i}"><span class="user-content"><b>${esc(x.title)}</b><small>${esc(x.artist)}</small></span></button><button class="pill" data-listensearchadd="${i}" aria-label="加入播放清單">＋</button></div>`).join('');
    } catch (e) { if (serial === searchCounter && status.isConnected) status.textContent = clean(e); }
  };
  document.addEventListener('keydown', (e) => { if (e.target.id === 'mzSongSearch' && e.key === 'Enter') { e.preventDefault(); actions.listenSearchRun(); } });
  document.addEventListener('click', (e) => {
    const play = e.target.closest('[data-listensearchplay]'), add = e.target.closest('[data-listensearchadd]'), sort = e.target.closest('[data-listensort]'), turn = e.target.closest('[data-listenpage]');
    if (sort) { searchSort = sort.dataset.listensort; searchPage = 1; paintSort(); if (document.querySelector('#mzSongSearch')?.value.trim()) actions.listenSearchRun(); }
    if (turn) { searchPage = Math.max(1, searchPage + +turn.dataset.listenpage); actions.listenSearchRun(); }
    if (play) { const item = searchResults[+play.dataset.listensearchplay]; if (item) startSong(item.url, listenFrom, item.title, item.duration).catch((e) => toast(clean(e))); }
    if (add) { const item = searchResults[+add.dataset.listensearchadd]; if (item) { if (searchInto) searchInto(item).catch((e) => toast(clean(e))); else { addQueue(item); toast('已加入播放清單'); } } }
  });
  actions.listenTogether = () => { composerMenuOpen = ''; syncComposerPanel(); actions.listenSearch(); listenFrom = chatId; };
  actions.listenPasteUrl = () => showModal('歌曲網址', '<label>網址</label><input id="mzListenUrl" type="text" autocapitalize="off" spellcheck="false" placeholder="貼上 Bilibili 分享內容"><p id="mzListenError" class="inline-error"></p><button class="pill primary" data-action="listenStart">播放</button>');
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
    live = { id: s.id, host: s.host, playing:s.playing, provider: s.provider, media: s.media, title: s.title, members: s.members, ais: s.ais, at: s.at, chats: [], mode: s.mode || 'off', duration: info.duration || 0 };
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
  actions.listenLibrary = () => showModal('Bilibili 公開歌單', '<p class="help">貼上任何人的公開收藏夾、合集、系列或個人空間連結就能讀取，不一定要是自己的。</p><label for="mzLibraryUrl">網址</label><input id="mzLibraryUrl" type="text" autocapitalize="off" spellcheck="false" placeholder="貼上分享內容"><button class="pill primary full" data-action="listenLibraryRead">讀取</button><p id="mzLibraryError" class="inline-error"></p><div id="mzLibraryFolders"></div><div id="mzLibrarySongs"></div>');
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
    const bar = live ? `<div class="card mz-music-now"><div class="mz-music-summary"><p class="user-content"><b>${esc(others.length ? '正和 ' + others.map((p) => p.name).join('、') + ' 一起聽' : '正在聽')}</b>${esc('《' + song() + '》')}</p><p class="small">${NAMES[live.provider]}</p><div class="flex"><button class="pill" data-action="listenOpen">打開</button><button class="pill" data-action="listenQueue">切歌／排序</button><button class="pill" data-action="listenFavorite">${isFavorite(linkOf(live.provider, live.media)) ? '♥ 已收藏' : '♡ 收藏'}</button><button class="pill" data-action="listenInvite">邀請</button><button class="pill" data-action="listenEnd">結束</button></div></div><div class="mz-music-preview ${live.provider==='bilibili'?'':'mz-no-video'}" aria-label="正在播放的畫面"></div></div>` : '';
    setTimeout(nameRecent, 300);
    const songRow = (x, i, kind) => `<div class="mz-queue-row"><button class="setting-row" data-listen${kind}="${i}"><span class="user-content mz-recent-title"><b>${esc(x.title && x.title !== NAMES[x.provider] ? x.title : x.named ? x.url.replace(/^https:\/\/(www\.)?/, '') : '讀取歌名中…')}</b><small>${esc(NAMES[x.provider] || '')}</small></span></button><button class="pill" aria-label="收藏" data-listenfav="${kind}:${i}">${isFavorite(x.url) ? '♥' : '♡'}</button>${kind === 'recent' ? `<button class="pill" aria-label="加入播放清單" data-listenaddrecent="${i}">＋</button><button class="pill" aria-label="刪除" data-listendelrecent="${i}">×</button>` : ''}</div>`;
    const list = recent().map((x, i) => songRow(x, i, 'recent')).join(''), saved = favorites().map((x, i) => songRow(x, i, 'saved')).join('');
    return header('聽歌', english() ? 'Search Bilibili videos, then invite an AI or a friend to listen with you.' : '搜尋 Bilibili 影片，再邀請 AI 或好友一起聽。') + `<div class="content">${remoteSession ? `<div class="card"><p class="user-content">正在 ${esc(remoteSession.deviceName)} 聽《${esc(remoteSession.title)}》</p><button class="pill primary" data-action="listenTakeover">切換到此裝置</button></div>` : ''}${bar}<div class="flex"><button class="pill primary" data-action="listenSearch">搜尋歌曲</button><button class="pill" data-action="listenAccounts">Bilibili 登入</button><button class="pill" data-action="listenQueue">播放清單／排序</button></div><div class="section-label">本地音樂</div><div class="card"><p class="help">可以離線自己聽。和 AI 或人類一起聽要有網路；和人類聽時，對方也要導入同一個檔案。</p>${localList.map((x) => `<div class="mz-local-row"><button class="setting-row" data-listenlocal="${esc(x.hash)}"><span class="user-content">${esc(x.title)}</span></button><button class="pill" data-listenaddlocal="${esc(x.hash)}">＋</button><button class="pill" data-listenlocaldel="${esc(x.hash)}">刪除</button></div>`).join('')}<button class="pill full" data-action="listenImport">導入本地音樂</button></div>${window.mzPlaylistsHtml?.() || ''}<div class="section-label">收藏</div><div class="card">${saved || '<p class="help">按 ♡ 把歌曲加入收藏。</p>'}<button class="pill full" data-action="listenLibrary">讀取 Bilibili 公開歌單</button></div>${list ? `<div class="section-label">最近聽過</div><div class="card">${list}<button class="pill full" data-action="listenClearRecent">清除全部最近聽過</button></div>` : ''}</div>`;
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
    const groups = [...((typeof MizukiGroups !== 'undefined' ? MizukiGroups : null)?.data?.groups || []).map((g) => row('g:' + g.id, g.name)), ...state.chats.filter((c) => c.members.length > 1).map((c) => row('c:' + c.id, title(c)))];
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

  // 3.4.0: songs that came in without a title (imported lists, pasted links, a slow lookup) showed "Bilibili".
  // Their real video title is looked up quietly, one at a time, for the song playing and the play queue.
  const titleCache = new Map();
  const bare = (x) => !x?.title || x.title === NAMES[x.provider];
  window.mzSongTitle = async (provider, media) => {
    if (provider !== 'bilibili' || !media) return '';
    if (titleCache.has(media)) return titleCache.get(media);
    let title = '';
    try { title = (await videoInfo(media)).title || ''; } catch {}
    if (!title && humanData().connected) { try { title = (await W.humanRequest('/v1/listen/info', { url: linkOf(provider, media) })).title || ''; } catch {} }
    if (title) titleCache.set(media, title);
    return title;
  };
  let naming = false;
  setInterval(async () => {
    if (naming) return;
    const playing = live && live.provider === 'bilibili' && bare(live) ? live : null;
    const waiting = queue.find((x) => x.provider === 'bilibili' && bare(x) && !x.untitled);
    const target = playing || waiting;
    if (!target) return;
    naming = true;
    try {
      const media = target.media || String(target.url || '').split('/video/')[1]?.split(/[/?]/)[0];
      const title = await window.mzSongTitle('bilibili', media);
      if (!title) { if (target !== live) target.untitled = true; return; }
      if (target === live) { live.title = title; tick(); paint?.(); notice?.(); if (tab === 'music' && !chatId && !page) render(); }
      else { target.title = title; saveQueue(); }
    } finally { naming = false; }
  }, 4000);

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
