'use strict';
// 3.4.4 desktop only: 沐水's room. The room window is the official chat on its own (?room=1): its header on top, the
// room (frames mz-room/1-12, rounded) in the middle, the composer below; no Windows frame, closed from its ⋯.
// The room window plays everything itself; the main window only opens / closes it (and holds the reply for shorts).
// 回訊息 (A): 1→2→3, waits at 3 for the reply, then 2→1.
// 刷短影音 (B): 1…7 → 6 → 5 → 8 → 9 → 10, opens her own 9:16 window, then replies and scrolls by herself:
// a frame of ONLY that window goes to the official model: watch / next / not interested / like / save / follow.
{
  if (!window.Desktop) { window.mzRoomDesk = null; } else {
    const ROOM = new URLSearchParams(location.search).get('room') === '1';
    const W = window.WebEngine, OFF = () => (typeof MIZUKI_OFFICIAL_ID !== 'undefined' ? MIZUKI_OFFICIAL_ID : 'mizuki');
    const D = (cmd, d = {}) => Desktop.invoke('mzRoom', { cmd, ...d }).catch(() => false);
    const S = (cmd, d = {}) => Desktop.invoke('mzShorts', { cmd, ...d });
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const cfg = () => { try { return JSON.parse(localStorage.getItem('mzMushui') || '{}'); } catch { return {}; } };
    // [match, name, feed] — guest only; IG / FB / X need an account, so they're not here
    const PLAT = [
      [/抖音|tiktok/i, 'TikTok', 'https://www.tiktok.com/foryou'],
      [/youtube|yt|shorts/i, 'YouTube', 'https://www.youtube.com/shorts'],
      [/threads|脆/i, 'Threads', 'https://www.threads.net/'],
    ];
    const SHORTS = /(刷|滑|看)(一下|一點|點|些|一會)?.{0,8}(短影音|短影片|短視頻|reels?|shorts?|抖音|tiktok|threads|脆|youtube|yt)|(短影音|reels?|shorts?|抖音|tiktok).{0,4}(刷|滑)/i;
    const TO_PC = /(去|走到|走去|坐到|坐去|回到)(電腦|桌子|書桌)(前|那)?/;
    const NO_GUEST = /(刷|滑|看).{0,8}(ig|instagram|哀居|fb|facebook|臉書|推特|twitter|\bx\b)/i;
    const STOP = /(別|不要|不用|不想|停|關掉|先不).{0,3}(刷|滑|看)|不再?(刷|滑|看)了|(刷|看)(夠|完)了|回床|去睡|stop (scrolling|watching)/i;
    const openShorts = (p, url) => S('open', { url, name: p[1], dark: !!cfg().shortsDark });
    // the next message to the official account waits for her when she has to open the app first (both windows)
    const send = W.humanRequest;
    let shorts = null;
    W.humanRequest = async function (path, body, ...rest) {
      const ask = path === '/v1/messages' && body?.to === OFF() && String(body.text || '');
      if (ask && SHORTS.test(ask) && !shorts) {
        try { await send.call(this, '/v1/official/hold', {}); } catch {}
        const r = await send.call(this, path, body, ...rest);
        if (!ROOM && !(await D('isOpen'))) { D('open', { chat: 'human:' + OFF(), go: ask }).then((v) => { if (v) window.mzRoomOpened?.(); }); }
        return r;
      }
      if (ask && NO_GUEST.test(ask) && !SHORTS.test(ask)) { try { await send.call(this, '/v1/official/hold', {}); } catch {} const r = await send.call(this, path, body, ...rest); go('使用者想看的平台（IG／FB／X）不登入不能看，沐水只用訪客身分刷，所以請他改叫你刷 TikTok、YouTube 或 Threads（脆）。只回一兩句。'); return r; }
      return send.call(this, path, body, ...rest);
    };
    const go = (note) => send.call(W, '/v1/official/go', { note }).catch(() => {});

    if (!ROOM) {
      // main window: the 沐水 button opens / closes the room window
      let open = false;
      D('isOpen').then((v) => { open = !!v; });
      const mark = () => document.querySelectorAll('[data-mzmushui="toggle"]').forEach((x) => x.classList.toggle('selected', open));
      window.mzRoomClosed = () => { open = false; mark(); };
      window.mzRoomOpened = () => { open = true; mark(); };
      window.mzShortsClosed = () => {};
      window.mzRoomDesk = {
        PLAT, get open() { return open; },
        toggle: async () => { if (open) { await D('close'); open = false; } else open = !!(await D('open', { chat: 'human:' + OFF(), bg: '#f9f5fa' })); mark(); },
        onSend() {}, onReply() {},
      };
    } else {
      // room window: the stage between the header and the composer
      document.documentElement.classList.add('mz-room-win');
      const stage = document.createElement('div'); stage.className = 'mz-room-stage';
      stage.innerHTML = '<div class="mzr-card"><img src="mz-room/1.webp" alt=""><img class="b" alt=""></div>';
      for (let n = 1; n <= 14; n++) { const i = new Image(); i.src = `mz-room/${n}.webp`; }
      const imgs = stage.querySelectorAll('img');
      let top = 0, frame = 1, q = Promise.resolve(), waiting = false;
      const show = async (n, ms) => {
        if (n === frame) return;
        const old = imgs[top], nu = imgs[1 - top];
        nu.src = `mz-room/${n}.webp`;
        try { await nu.decode(); } catch {}
        nu.style.zIndex = 2; old.style.zIndex = 1;
        nu.animate([{ opacity: 0, filter: 'blur(6px)' }, { opacity: 1, filter: 'blur(0)' }], { duration: ms, easing: 'ease-in-out', fill: 'forwards' });
        await wait(ms);
        nu.style.opacity = 1; nu.getAnimations().forEach((a) => a.cancel()); old.style.opacity = 0; top = 1 - top; frame = n;
      };
      // every animation waits in one line; the idle blink is part of it, so nothing cuts into a blink
      let pending = 0;
      const play = (list, ms = 240, hold = 90) => { pending++; return (q = q.then(async () => { for (const n of (typeof list === 'function' ? list() : list)) { await show(n, ms); await wait(hold); } }).finally(() => { pending--; })); };
      // in bed (frame 1): blink like the chat background — 2, a short pause, 3 — open eyes 0.8–1.5 s between rounds (13 half, 14 closed)
      let canBlink = false; { const t14 = new Image(); t14.onload = () => { canBlink = true; }; t14.src = 'mz-room/14.webp'; }
      const blink = async () => { await show(13, 70); await show(14, 70); await wait(40); await show(13, 70); await show(1, 90); };
      const cycle = async () => { for (const k of [2, 3]) { for (let i = 0; i < k; i++) { await blink(); await wait(80); } if (k === 2) await wait(200); } };
      (async () => { for (;;) { await wait(800 + Math.random() * 700); if (canBlink && frame === 1 && !pending) { pending++; await (q = q.then(cycle).finally(() => { pending--; })); } } })();
      const atPc = () => frame >= 8 && frame <= 10;
      // back to bed: stand up, stretch, turn to the bed, climb on, sit, lie down
      const BED = [10, 9, 8, 5, 6, 7, 6, 5, 11, 12, 4, 1];
      const back = () => play(() => atPc() ? BED.slice(BED.indexOf(frame) + 1) : frame > 1 ? [2, 1] : [], 170, 70);
      // with the phone first (asked by message) / straight there (⋯)
      const PC_PHONE = [1, 2, 3, 4, 5, 6, 7, 6, 5, 8, 9, 10], PC_WALK = [1, 4, 5, 6, 7, 6, 5, 8, 9, 10];
      const toPc = (list) => play(() => (atPc() ? [] : list), 170, 70);
      // the card is exactly the picture's shape (1448 × 1086), as big as fits; only the corners are rounded
      const size = () => { const c = stage.firstElementChild, s = getComputedStyle(stage), w = stage.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight), h = stage.clientHeight - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom); if (w <= 0 || h <= 0) return; const k = Math.min(w / 1448, h / 1086); c.style.width = Math.floor(1448 * k) + 'px'; c.style.height = Math.floor(1086 * k) + 'px'; };
      try { new ResizeObserver(size).observe(stage); } catch { addEventListener('resize', size); }
      const place = () => {
        const conv = document.querySelector('.conversation'), comp = conv?.querySelector('.composer');
        if (comp && stage.nextElementSibling !== comp) comp.before(stage);
        size();
      };
      const renderBefore = render;
      render = function (...a) { const r = renderBefore.apply(this, a); try { place(); } catch {} return r; };
      window.mzShortsClosed = () => { shorts = null; };       // she stays at the computer until told to stop
      const stopShorts = () => { const was = shorts; shorts = null; if (was) S('close').catch(() => {}); if (atPc()) back(); };
      const startShorts = async (text) => {
        const p = PLAT.find(([re]) => re.test(text)) || PLAT[0], [, name, url, site, login] = p;
        await toPc(PC_PHONE);
        let ok = false;
        try { ok = await openShorts(p, url); } catch {}
        await wait(3500);
        go(ok ? `沐水用訪客身分打開了 ${name}，開始自己刷了。只回一句很短的話（15 字內）。` : `沐水想打開 ${name}，但沒打開成功。只回一句很短的話。`);
        if (ok) { shorts = { name }; loop(shorts); }
      };
      const loop = async (me) => {
        await wait(4000);
        while (shorts === me) {
          let next = 8000;
          try {
            const image = await S('shot');
            if (image) {
              const r = await send.call(W, '/v1/official/watch', { image, platform: me.name });
              if (r.action === 'next') await S('next');
              else if (r.action === 'not_interested') { await S('dislike').catch(() => false); await wait(600); await S('next'); }
              next = r.action === 'watch' ? r.seconds * 1000 : 2500 + Math.random() * 2500;
            }
          } catch { next = 12000; }
          await wait(next);
        }
      };
      // ⋯ play: A blink, B phone (quick), C walk to the computer (stays there), D up, stretch, back to bed
      window.mzRoomPlay = (k) => {
        if (shorts) return;
        if (k === 'D') return play(() => atPc() ? BED.slice(BED.indexOf(frame) + 1) : [4, 5, 6, 7, 6, 5, 11, 12, 4, 1], 170, 70);
        if (k === 'C') return toPc(PC_WALK);
        if (k === 'A') { pending++; q = q.then(() => (atPc() ? 0 : cycle())).finally(() => { pending--; }); }
        else if (k === 'B') { play(() => (atPc() ? [] : [2, 3]), 150, 50); play(() => (atPc() ? [] : [3]), 150, 2600); play(() => (atPc() ? [] : [2, 1]), 150, 50); }
      };
      const first = new URLSearchParams(location.search).get('go');
      if (first) setTimeout(() => window.mzRoomDesk?.onSend({ text: first, fromGo: true }), 2500);
      window.mzRoomDesk = {
        PLAT, open: true, room: true,
        toggle: () => Desktop.invoke('closeWindow'),
        onSend(m) {
          const t = String(m?.text || '');
          if ((shorts || atPc()) && STOP.test(t)) return stopShorts();
          if (SHORTS.test(t)) { if (!shorts) return startShorts(t); return go(`沐水已經在刷 ${shorts.name} 了。只回一句很短的話。`); }
          if (TO_PC.test(t) && !atPc()) return toPc(PC_PHONE);
          if (shorts || atPc() || waiting) return;
          waiting = true; play([1, 2, 3]);
        },
        onReply() { if (!waiting) return; waiting = false; q = q.then(() => wait(200)); play([2, 1]); },
      };
      const css = document.createElement('style');
      css.textContent = `html.mz-room-win body::before,html.mz-room-win body::after{display:none!important}html.mz-room-win #app{margin-top:0!important;height:var(--app-height,100dvh)!important}html.mz-room-win #overlay{top:0!important}
html.mz-room-win .conversation .message-scroll,html.mz-room-win .mizuki-official-actions{display:none!important}
html.mz-room-win .conversation{-webkit-app-region:drag}html.mz-room-win .conversation :is(button,a,input,textarea,.composer,.mzr-card){-webkit-app-region:no-drag}
html.mz-room-win .conversation{padding-top:14px!important;padding-bottom:14px!important;box-sizing:border-box}
.mz-room-stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:10px 18px}
.mzr-card{position:relative;flex:none;border-radius:22px;overflow:hidden;box-shadow:0 10px 30px #0002}
.mzr-card img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;will-change:opacity,filter}.mzr-card .b{opacity:0}`;
      document.head.append(css);
    }
  }
}
