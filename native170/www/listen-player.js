'use strict';
// Runs on the server's https page, not inside the app: YouTube refuses to play for an app page with no web address.
(() => {
  const q = new URLSearchParams(location.search), provider = q.get('p'), media = q.get('id') || '', start = Math.max(0, Math.floor(+q.get('t') || 0));
  document.documentElement.classList.toggle('mz-player-compact',q.get('compact')==='1');
  window.addEventListener('message',(e)=>{if(e.source===parent&&e.data?.mizukiListen&&e.data.type==='layout')document.documentElement.classList.toggle('mz-player-compact',!!e.data.compact);});
  const root = document.getElementById('player');
  const tell = (data) => parent.postMessage({ mizukiListen: true, ...data }, '*');
  const frame = (src) => {
    const el = document.createElement('iframe');
    el.src = src;
    el.allow = 'autoplay; encrypted-media; fullscreen';
    el.referrerPolicy = 'strict-origin-when-cross-origin';
    root.append(el);
    tell({ type: 'ready', control: false });
  };
  if (provider === 'bilibili' && /^BV[0-9A-Za-z]{8,14}$/.test(media)) return frame('https://player.bilibili.com/player.html?bvid=' + media + '&autoplay=1&high_quality=1&danmaku=0&t=' + start);
  if (provider === 'spotify' && /^(track|album|playlist|episode)\/[A-Za-z0-9]{10,40}$/.test(media)) return frame('https://open.spotify.com/embed/' + media);
  if (provider === 'apple' && /^[a-z]{2}\/(album|playlist|song)\/[^/]+\/[\w.-]+(\?i=\d+)?$/.test(media)) return frame('https://embed.music.apple.com/' + media);
  if (provider === 'kkbox' && /^(song|album|playlist)\/[\w-]{6,40}$/.test(media)) return frame('https://widget.kkbox.com/v1/?id=' + media.split('/')[1] + '&type=' + media.split('/')[0] + '&terr=TW&lang=TC');
  if (!['youtube', 'ytmusic'].includes(provider) || !/^[\w-]{6,20}$/.test(media)) return tell({ type: 'error' });

  let player = null, quietUntil = 0;
  const now = () => player?.getCurrentTime?.() || 0;
  const send = () => {
    if (Date.now() < quietUntil || !player) return;
    const s = player.getPlayerState();
    if (s === 1 || s === 2) tell({ type: 'state', playing: s === 1, position: now() });
  };
  window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('player', {
      videoId: media,
      playerVars: { autoplay: 1, playsinline: 1, start, rel: 0, controls: 0 },
      events: {
        onReady: () => { player.playVideo(); tell({ type: 'ready', control: true }); },
        onStateChange: (e) => { if (e.data === 0) tell({ type: 'ended' }); else send(); },
        onError: (e) => tell({ type: 'error', code: e.data }),
      },
    });
  };
  // A jump is the only change with no state event, so compare where the song is with where it should be.
  let last = 0, lastAt = Date.now();
  setInterval(() => {
    if (!player?.getPlayerState) return;
    const t = now(), passed = (Date.now() - lastAt) / 1000, playing = player.getPlayerState() === 1;
    if (Math.abs(t - last - (playing ? passed : 0)) > 2) send();
    last = t; lastAt = Date.now();
  }, 1000);
  window.addEventListener('message', (e) => {
    if (e.source !== parent || !e.data?.mizukiListen || e.data.type === 'layout' || !player?.seekTo) return;
    const d = e.data, playing = player.getPlayerState() === 1;
    quietUntil = Date.now() + 1500;
    if (d.position != null && Math.abs(now() - d.position) > 2) player.seekTo(d.position, true);
    if (d.playing && !playing) player.playVideo();
    if (!d.playing && playing) player.pauseVideo();
  });
  const api = document.createElement('script');
  api.src = 'https://www.youtube.com/iframe_api';
  document.head.append(api);
})();
