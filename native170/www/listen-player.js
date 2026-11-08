'use strict';
// Runs on the server's https page, so the embedded player sees a normal web address.
(() => {
  const q = new URLSearchParams(location.search), provider = q.get('p'), media = q.get('id') || '', start = Math.max(0, Math.floor(+q.get('t') || 0));
  document.documentElement.classList.toggle('mz-player-compact',q.get('compact')==='1');
  document.documentElement.classList.toggle('mz-player-touch',q.get('touch')==='1');
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
  if (provider !== 'bilibili' || !/^BV[0-9A-Za-z]{8,14}$/.test(media)) return tell({ type: 'error' });
  frame('https://player.bilibili.com/player.html?bvid=' + media + '&autoplay=1&high_quality=1&danmaku=0&t=' + start);
})();
