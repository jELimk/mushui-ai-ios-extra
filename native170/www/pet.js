'use strict';
// 3.4.4 jELi desktop pet (desktop only). One file, three views: ?view=pet (the pet), page (its settings window), menu
// (Mizuki's tray menu in the pet's own style). Art = the user's PSD layers exported to pet/pet.json + pet/img/*.png
// (full-canvas layers, bottom → top = play order). See art/desktop-pet/PLAN.md.
(async () => {
  const VIEW = new URLSearchParams(location.search).get('view') || 'pet';
  const D = (cmd, d = {}) => (window.Desktop?.invoke ? Desktop.invoke('mzPet', { cmd, ...d }) : Promise.resolve(null));
  const C = document.getElementById('c'), X = C.getContext('2d'), TXT = document.getElementById('txt'), TIP = document.getElementById('tip');
  const bc = new BroadcastChannel('mz-pet');
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];
  const now = () => performance.now() / 1000;

  // ---- saved state (shared by every pet window through localStorage) ----
  const KEYS = ['top1', 'top2', 'top3', 'top4', 'mid1', 'mid2', 'mid3', 'mid4', 'bottom1', 'bottom2', 'bottom3'];
  const DEF = { lang: /^en/i.test(navigator.language) ? 'en' : 'zh', skin: 'jeli', acc: null, scale: 3, top: true, stars: true, time: true,
    vol: 0.6, track: 0, mode: 'loop', noise: { rain: 0, fire: 0, wind: 0, thunder: 0 },
    keys: { top1: 'w', top2: 'a', top3: 's', top4: 'd', mid1: '1', mid2: '2', mid3: '3', mid4: 'shift', bottom1: 'esc', bottom2: 'space', bottom3: 'backspace' }, play: false };
  const load = () => { try { return { ...DEF, ...JSON.parse(localStorage.getItem('mz-pet') || '{}') }; } catch { return { ...DEF }; } };
  let S = load();
  const save = () => { try { localStorage.setItem('mz-pet', JSON.stringify(S)); } catch {} bc.postMessage({ t: 'state' }); };
  const zh = () => S.lang !== 'en';
  const T = (a, b) => (zh() ? a : b);
  // DLC: members + unlimited accounts (the main app writes mz-pet-unlock from /v1/ai-limits)
  const unlocked = () => { try { return localStorage.getItem('mz-pet-unlock') === '1'; } catch { return false; } };

  // ---- art ----
  const M = await (await fetch('pet/pet.json')).json();
  const IM = {}, BOX = {};
  const node = (psd, ...p) => { let k = M[psd]?.k || [], n = null; for (const s of p) { n = k.find((x) => x.n === s); if (!n) return null; k = n.k || []; } return n; };
  const seq = (psd, ...p) => {
    const out = [], walk = (k) => { for (const x of k) x.i ? out.push(x.i) : x.k && walk(x.k); };
    if (!p.length) walk(M[psd]?.k || []); else { const n = node(psd, ...p); if (n) n.i ? out.push(n.i) : walk(n.k || []); }
    return out;
  };
  const one = (psd, ...p) => seq(psd, ...p)[0];
  const img = (h) => IM[h] || (IM[h] = Object.assign(new Image(), { src: 'pet/img/' + h + '.png' }));
  // alpha box of a layer = its hit area
  const box = (h) => {
    if (!h) return null; if (BOX[h]) return BOX[h]; const i = img(h); if (!i.complete || !i.width) return null;
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0);
    const d = x.getImageData(0, 0, i.width, i.height).data; let l = 1e9, t = 1e9, r = -1, b = -1;
    for (let y = 0; y < i.height; y++) for (let xx = 0; xx < i.width; xx++) if (d[(y * i.width + xx) * 4 + 3] > 8) { l = Math.min(l, xx); r = Math.max(r, xx); t = Math.min(t, y); b = Math.max(b, y); }
    return (BOX[h] = r < 0 ? { l: 0, t: 0, r: -1, b: -1 } : { l, t, r, b });
  };
  const inBox = (h, x, y, pad = 2) => { const b = box(h); return !!b && x >= b.l - pad && x <= b.r + pad && y >= b.t - pad && y <= b.b + pad; };
  await Promise.all([...new Set(Object.keys(M).flatMap((p) => seq(p)))].map((h) => new Promise((r) => { const i = img(h); if (i.complete) r(); else { i.onload = r; i.onerror = r; } })));
  await document.fonts.load('12px mzPetPixel').catch(() => {});

  const SKINS = {
    jeli: { idle: 'Skin-jELi', pet: 'Pet-jELi', zh: 'jELi', en: 'jELi' },
    jeli2: { idle: 'jELi-2', pet: 'Pet-jELi-2', zh: 'jELi（發呆）', en: 'jELi (daydream)' },
    matcha: { idle: 'Skin-Matcha', pet: 'Pet-Matcha', zh: '抹茶', en: 'Matcha' },
    peach: { idle: 'Skin-Peach', pet: 'Pet-Cake', zh: '水蜜桃', en: 'Peach' },
    angel: { idle: 'Skin-Angle-DLC', pet: 'Pet-Angle-DLC', zh: '天使', en: 'Angel', dlc: true },
  };
  const ACCS = {
    jellyfish: { psd: 'Accessory-Jellyfish', zh: '水母', en: 'Jellyfish' }, angel: { psd: 'Accessory-Angel', zh: '天使光環', en: 'Halo' },
    devil: { psd: 'Accessory-Devil', zh: '惡魔', en: 'Devil' }, bow: { psd: 'Accessory-Bow-DLC', zh: '蝴蝶結', en: 'Bow', dlc: true },
    cat: { psd: 'Accessory-Cat-Ears-DLC', zh: '貓耳', en: 'Cat ears', dlc: true }, scarf: { psd: 'Accessory-Scarf-DLC', zh: '圍巾', en: 'Scarf', dlc: true },
  };
  const okSkin = (k) => SKINS[k] && (!SKINS[k].dlc || unlocked()) ? k : 'jeli';
  const okAcc = (k) => (k && ACCS[k] && (!ACCS[k].dlc || unlocked()) ? k : null);
  // music: the user's own names; every file is loudness-normalised (-16 LUFS) so 100 % is the same loudness
  const TRACKS = [['traditional', '傳統純音樂', 'Traditional'], ['classical', '古典純音樂', 'Classical'], ['guitar', '吉他純音樂', 'Guitar'],
    ['jazz', '爵士純音樂', 'Jazz'], ['game', '遊戲純音樂', 'Game'], ['piano', '鋼琴純音樂', 'Piano']];
  const NOISE = [['rain', 'Rain', '雨聲白噪音', 'Rain'], ['fire', 'Fire', '篝火白噪音', 'Fire'], ['wind', 'Wind', '風聲白噪音', 'Wind'], ['thunder', 'Thunder', '雷雨白噪音', 'Storm']];

  // ---- canvas helpers ----
  let W = 0, H = 0;
  const size = (w, h, s) => { W = w; H = h; C.width = w; C.height = h; C.style.width = w * s + 'px'; C.style.height = h * s + 'px'; };
  const draw = (h, ox = 0, oy = 0, a = 1) => { if (!h) return; X.globalAlpha = a; X.drawImage(img(h), ox, oy); X.globalAlpha = 1; };
  const pos = (e, s) => ({ x: e.offsetX / s, y: e.offsetY / s });
  // text always fits its place: it shrinks (down to 3.4 px) until it fits the width and maxH (logical px)
  const fit = (el, px, s, maxW, maxH) => { for (let f = Math.max(px, 5); f >= 5; f -= 0.25) { el.style.fontSize = f * s + 'px'; if (el.scrollWidth <= maxW * s + 1 && (!maxH || el.scrollHeight <= maxH * s + 1)) return true; } return false; };
  // a kaomoji (or any short bracketed bit) never breaks in the middle: it moves to the next line as a whole
  const keep = (el, str) => { el.textContent = ''; for (const part of String(str).split(/([(（][^()（）]{1,16}[)）])/)) { if (!part) continue; if (/^[(（].*[)）]$/.test(part)) { const sp = document.createElement('span'); sp.style.whiteSpace = 'nowrap'; sp.style.display = 'inline-block'; sp.textContent = part; el.appendChild(sp); } else el.appendChild(document.createTextNode(part)); } };
  const text = (id, str, x, y, w, s, px = 6, maxH = 0) => {
    let el = document.getElementById('t-' + id); if (!str) { el?.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 't-' + id; TXT.appendChild(el); }
    Object.assign(el.style, { left: x * s + 'px', top: y * s + 'px', width: w * s + 'px', wordBreak: /[　-鿿＀-￯]/.test(str) ? 'break-all' : 'normal', whiteSpace: maxH ? 'pre-wrap' : 'nowrap', overflow: 'hidden' }); keep(el, str);
    fit(el, px, s, w, maxH || 7);
  };
  // hover label = the user's Details-Pop-Up frame with the text inside; the smallest frame the text fits in
  let tipS = 3, tipTop = 0; const tipC = document.createElement('canvas'), tipT = document.createElement('div'); tipC.width = 45; tipC.height = 50; TIP.append(tipC, tipT);
  const tip = (str, e) => {
    if (!str) { TIP.style.display = 'none'; return; }
    const s = tipS; TIP.style.display = 'block'; keep(tipT, str);
    let kind, b;
    for (kind of ['Small', 'Medium', 'Large']) {
      b = box(one('Details-Pop-Up', kind)); const w = b.r - b.l + 1, h = b.b - b.t + 1;
      Object.assign(tipT.style, { position: 'absolute', left: 2 * s + 'px', top: 2 * s + 'px', width: (w - 4) * s + 'px', textAlign: 'center', color: '#7f45ba', lineHeight: '1.15', wordBreak: /[　-鿿＀-￯]/.test(str) ? 'break-all' : 'normal', whiteSpace: 'pre-wrap' });
      if (fit(tipT, 6, s, w - 4, h - 7)) break;
    }
    const h = one('Details-Pop-Up', kind), x = tipC.getContext('2d'); x.clearRect(0, 0, 45, 50); x.drawImage(img(h), 0, 0);
    Object.assign(tipC.style, { width: 45 * s + 'px', height: 50 * s + 'px', imageRendering: 'pixelated', position: 'absolute', left: -b.l * s + 'px', top: -b.t * s + 'px' });
    const w = (b.r - b.l + 1) * s, hh = (b.b - b.t + 1) * s;
    // the frame sits above the pointer, kept inside the window (the settings window has a clear strip on top for it)
    Object.assign(TIP.style, { width: w + 'px', height: hh + 'px', left: Math.max(0, Math.min(e.clientX - w / 2, innerWidth - w)) + 'px', top: Math.max(0, Math.min(e.clientY - hh - 3, tipTop ? tipTop - hh : 1e9)) + 'px' });
  };

  if (VIEW === 'pet') return petView();
  if (VIEW === 'page') return pageView();
  if (VIEW === 'menu') return menuView();

  // ================================================================ the pet
  function petView() {
    const PX = 8, PY = 40, CW = 80, CH = 104; // pet canvas 64×64 sits at (8,40); the bubble goes above it
    let s = S.scale; size(CW, CH, s);
    const LINES = { zh: { angry: ['別晃我啦！', '我不是玩具！', '差不多夠了！', '再這樣我要生氣了！'], touch: ['走開啦！（轉頭）', '你很煩欸！（鼓嘴）', '又摸我頭，討厭鬼！（害羞）', '哎呀，別碰我！（跺腳）', '不要一直戳我啦，笨蛋！', '只有一下下可以啦…', '再摸我會臉紅啦！'], idle: ['理理我... ;-:', '不要人家了嗎QQ', '別不理人家嘛...QQ', '想聽你的聲音...', '陪我一下嘛...', '看我一下下就好...'], reminder: ['喝水啦，笨蛋！', '休息一下啦...', '快起來伸展！', '眼睛休息一下啦。', '坐姿給我調好。', '慢慢呼吸一下。'] },
      en: { angry: ['Hey, stop shaking me!', 'I am not your toy!', 'Cut it out already!', 'That is enough!'], touch: ['Hey, back off!', 'You are so annoying!', 'Stop touching my head, dummy!', 'H-hey, do not touch me!', 'Quit poking me... dummy!', 'I said no! ...maybe just a little.', 'Do not make me blush!'], idle: ['Keep me company...', 'Are you ignoring me...?', 'Do not leave me alone...', 'I miss your voice...', 'Stay with me, okay?', 'Look at me for a bit...'], reminder: ['Drink water. Hmph!', 'Rest, dummy...', 'Stretch. Now!', 'Your eyes need a break.', 'Sit up straight already.', 'Breathe slowly for me.'] } };
    const KEYART = { top1: ['Top', 'W'], top2: ['Top', 'A'], top3: ['Top', 'S'], top4: ['Top', 'D'], mid1: ['Middle', '1'], mid2: ['Middle', '2'], mid3: ['Middle', '3'], mid4: ['Middle', 'Shift'], bottom1: ['Bottom', 'ESC'], bottom2: ['Bottom', 'Space'], bottom3: ['Bottom', 'Backspace'] };
    const PRESS = ['High', 'Medium', 'Low', 'Medium'];
    let frame = 0, hair = false, hairAt = 0, petF = null, back = [], heart = false, heartEnd = false, heartF = 0;
    let menu = false, menuF = 0, menuHover = null, bubble = null, mouse = null, trans = null, keyJelly = null, keyF = 0, pressed = null, pressF = 0;
    let drag = null, clickOk = false, pressAt = 0, revs = 0, dir = 0, anchorX = 0, lastAngry = 0, lastTouch = 0, through = null;
    let nextIdle = now() + 600, nextRemind = now() + 162;

    const say = (str, sec = 3.6) => { bubble = { str, until: now() + sec }; };
    const line = (mood) => { if (S.play) return; if (mood === 'touch') { if (bubble || now() - lastTouch < 1.2) return; lastTouch = now(); } say(rnd(LINES[zh() ? 'zh' : 'en'][mood])); };
    window.mzPetSay = (str) => say(String(str).slice(0, 60), 5); // the main app can speak through her (new messages…)
    const skin = () => SKINS[okSkin(S.skin)];
    const menuItems = { book: one('Right-Click', 'Book', '3'), settings: one('Right-Click', 'Setting', '3'), close: one('Right-Click', 'Close', '3') };
    const menuLabel = { book: ['本子', 'Book'], settings: ['設定', 'Settings'], close: ['關閉', 'Close'] };

    const setMode = (play) => {
      if (play === S.play || trans) return;
      if (play) { stopPet(); bubble = null; }
      trans = { psd: play ? 'Key-Appear' : 'Key-Disappear', i: 0, to: play };
      if (!play) { S.play = false; save(); nextIdle = now() + 600; nextRemind = now() + 162; D('keys', { on: false }); }
    };
    window.mzPetMode = () => setMode(!S.play);
    const keyHit = (slot) => { if (!S.play || !KEYART[slot]) return; keyJelly = slot; keyF = 0; pressed = slot; pressF = 0; };
    window.mzPetKey = keyHit; // from the main process (bound keys only, while play mode is on)

    function tick() {
      frame++;
      const t = now();
      if (hair) { petF = Math.min(2, Math.floor((t - hairAt) / 0.18)); if (t - hairAt >= 5 && !heart) { heart = true; heartEnd = false; heartF = 0; } }
      else if (back.length) petF = back.shift(); else petF = null;
      if (heart) { const n = seq('Pet-Heart').length; heartF++; if (heartEnd && heartF >= n) { heart = false; heartF = 0; } else heartF %= n; }
      if (menu && menuF < 2) menuF++;
      if (!S.play && !hair && !drag && !menu && !bubble) { if (t >= nextRemind) { line('reminder'); nextRemind = t + 162; } else if (t >= nextIdle) { line('idle'); nextIdle = t + 600; } }
      if (bubble && t > bubble.until) bubble = null;
      if (keyJelly) { keyF += 2; if (keyF >= seq('Key-Jellyfish', ...KEYART[keyJelly]).length) keyJelly = null; }
      if (pressed) { pressF++; if (pressF >= PRESS.length) pressed = null; }
      if (trans) { trans.i++; if (trans.i >= seq(trans.psd).length) { if (trans.to) { S.play = true; save(); D('keys', { on: true, keys: S.keys }); } trans = null; } }
      paint();
    }
    function paint() {
      X.clearRect(0, 0, CW, CH);
      const sk = skin(), petting = petF !== null;
      const idle = seq(sk.idle); if (!petting) draw(idle[frame % idle.length], PX, PY);
      const acc = okAcc(S.acc) ? seq(ACCS[okAcc(S.acc)].psd) : [];
      if (S.play || !S.play && trans?.to) {
        if (acc.length) draw(acc[frame % acc.length], PX, PY);
        if (S.stars) { const st = seq('Key-Stars'); draw(st[frame % st.length], PX, PY); }
        if (S.play) {
          draw(one('Key', 'Floor'), PX, PY);
          for (const [slot, [row, k]] of Object.entries(KEYART)) draw(pressed === slot ? one('Key', row, 'Press', PRESS[Math.min(pressF, 3)], k) : one('Key', row, 'Normal', k), PX, PY);
          if (keyJelly) { const j = seq('Key-Jellyfish', ...KEYART[keyJelly]); draw(j[Math.min(keyF, j.length - 1)], PX, PY); }
        }
      } else {
        if (acc.length && !petting) draw(acc[frame % acc.length], PX, PY);
        if (petting) { const p = seq(sk.pet); draw(p[Math.min(petF, p.length - 1)], PX, PY); }
        if (heart) draw(seq('Pet-Heart')[heartF], PX, PY);
      }
      if (trans) { const f = seq(trans.psd); draw(f[Math.min(trans.i, f.length - 1)], PX, PY); }
      if (menu) for (const k of ['book', 'settings', 'close']) draw(one('Right-Click', { book: 'Book', settings: 'Setting', close: 'Close' }[k], String(Math.min(3, menuF + 1))), PX, PY);
      if (bubble) {
        const n = [...bubble.str].length, kind = n > 14 ? 'Large' : n > 7 ? 'Medium' : 'Small';
        draw(one('Pop-Up', kind), 5, 0);
        const b = box(one('Pop-Up', kind)) || { l: 2, t: 2, r: 66, b: 30 };
        text('bubble', bubble.str, 5 + b.l + 3, b.t + 6, b.r - b.l - 6, s, 6, b.b - b.t - 12);
      } else text('bubble', '', 0, 0, 0, s);
      if (hair && mouse) draw(one('Hand', '1'), Math.round(mouse.x - 11), Math.round(mouse.y - 11));
    }
    const stopPet = () => { if (!hair) return; hair = false; back = []; for (let i = petF ?? 0; i >= 0; i--) back.push(i); if (heart) heartEnd = true; document.body.classList.remove('hand'); };
    const opaque = (x, y) => { if (x < 0 || y < 0 || x >= CW || y >= CH) return false; try { return X.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3] > 10; } catch { return true; } };
    const setThrough = (v) => { if (through === v) return; through = v; D('through', { on: v }); };

    C.addEventListener('contextmenu', (e) => e.preventDefault());
    C.addEventListener('pointerdown', (e) => {
      const p = pos(e, s);
      if (menu) { const hit = Object.keys(menuItems).find((k) => inBox(menuItems[k], p.x - PX, p.y - PY, 4)); menu = false; tip(''); if (e.button <= 2 && hit) act(hit); return; }
      if (e.button === 2) { menu = true; menuF = 0; menuHover = null; return; }
      if (e.button !== 0) return;
      C.setPointerCapture(e.pointerId);
      clickOk = true; pressAt = now(); revs = 0; dir = 0; anchorX = e.screenX;
      if (!S.play && p.y - PY < 23 && p.y >= PY - 2) { hair = true; hairAt = now(); back = []; mouse = p; document.body.classList.add('hand'); return; }
      drag = { sx: e.screenX, sy: e.screenY, wx: window.screenX, wy: window.screenY };
    });
    C.addEventListener('pointermove', (e) => {
      const p = pos(e, s); mouse = p;
      if (menu) { const hit = Object.keys(menuItems).find((k) => inBox(menuItems[k], p.x - PX, p.y - PY, 4)); menuHover = hit; tip(hit ? T(...menuLabel[hit]) : '', e); }
      if (drag || hair) {
        if (Math.abs(e.screenX - anchorX) + 0 > 8 && now() - pressAt > 0) clickOk = clickOk && Math.hypot(e.screenX - (drag?.sx ?? e.screenX), e.screenY - (drag?.sy ?? e.screenY)) <= 8;
        // shaking: 20 left-right turns while dragging → she gets cross
        if (drag && now() - lastAngry > 5) { const dx = e.screenX - anchorX; if (Math.abs(dx) >= 42) { const d = dx > 0 ? 1 : -1; if (dir && d !== dir && ++revs >= 20) { line('angry'); lastAngry = now(); revs = 0; } dir = d; anchorX = e.screenX; } }
      }
      if (drag) D('move', { x: Math.round(drag.wx + e.screenX - drag.sx), y: Math.round(drag.wy + e.screenY - drag.sy) });
      if (!drag && !hair) setThrough(!menu && !opaque(p.x, p.y));
    });
    const up = (e) => {
      const wasHair = hair, quick = clickOk && now() - pressAt <= 0.45 && (!drag || Math.hypot(e.screenX - drag.sx, e.screenY - drag.sy) <= 8);
      stopPet(); if (drag) D('saved', { x: window.screenX, y: window.screenY }); drag = null;
      if (e.button === 0 && (wasHair || quick)) line('touch');
      clickOk = false;
    };
    C.addEventListener('pointerup', up);
    C.addEventListener('pointercancel', up);
    C.addEventListener('pointerleave', () => { if (!drag && !hair) setThrough(true); if (!menu) tip(''); });
    C.addEventListener('dblclick', () => setMode(!S.play));
    document.addEventListener('keydown', (e) => {
      if (!S.play || e.repeat) return;
      const k = e.key === ' ' ? 'space' : e.key === 'Escape' ? 'esc' : e.key.toLowerCase();
      const slot = KEYS.find((x) => S.keys[x] === k); if (slot) keyHit(slot);
    });
    const act = (k) => {
      if (k === 'close') return D('close');
      if (k === 'settings') return D('page', { page: 'home' });
      if (k === 'book') say(T('本子下一版開放喔！', 'Notebook: next update!'), 4);
    };
    window.mzPetAct = act;

    // ---- music + white noise (they live here so they keep playing when the settings window is closed) ----
    const music = new Audio(); music.preload = 'auto';
    const noise = {};
    const applyAudio = () => {
      music.volume = Math.max(0, Math.min(1, S.vol));
      for (const [k] of NOISE) {
        const v = S.noise[k] || 0;
        if (v > 0 && !noise[k]) { noise[k] = new Audio('pet/music/' + k + '.opus'); noise[k].loop = true; }
        if (noise[k]) { noise[k].volume = Math.min(1, v); if (v > 0) noise[k].play().catch(() => {}); else noise[k].pause(); }
      }
    };
    const playTrack = (i, start = true) => { S.track = (i + TRACKS.length) % TRACKS.length; save(); music.src = 'pet/music/' + TRACKS[S.track][0] + '.opus'; if (start) music.play().catch(() => {}); report(); };
    const report = () => bc.postMessage({ t: 'music', playing: !music.paused, i: S.track, pos: music.currentTime || 0, dur: music.duration || 0 });
    music.addEventListener('ended', () => { if (S.mode === 'single') { music.currentTime = 0; music.play(); } else playTrack(S.mode === 'shuffle' ? Math.floor(Math.random() * TRACKS.length) : S.track + 1); });
    music.addEventListener('play', report); music.addEventListener('pause', report);
    setInterval(report, 1000);
    bc.onmessage = ({ data: m }) => {
      if (m.t === 'state') { const old = S; S = load(); if (S.scale !== old.scale) { s = S.scale; size(CW, CH, s); D('size', { w: CW * s, h: CH * s }); } if (S.top !== old.top) D('top', { on: S.top }); applyAudio(); }
      if (m.t === 'cmd') {
        if (m.op === 'play') { if (!music.src) playTrack(S.track); else music.play().catch(() => {}); }
        if (m.op === 'pause') music.pause();
        if (m.op === 'next') playTrack(S.mode === 'shuffle' ? Math.floor(Math.random() * TRACKS.length) : S.track + 1);
        if (m.op === 'prev') playTrack(S.track - 1);
        if (m.op === 'pick') playTrack(m.i);
        if (m.op === 'seek' && music.duration) music.currentTime = m.f * music.duration;
        if (m.op === 'mode') setMode(!S.play);
        if (m.op === 'act') act(m.k);
        if (m.op === 'ask') report();
      }
    };
    applyAudio();
    D('size', { w: CW * s, h: CH * s }); D('top', { on: S.top });
    if (S.play) { S.play = false; setMode(true); }
    setInterval(tick, 67);
  }

  // ================================================================ settings window (Page art, 128×64)
  function pageView() {
    const s = 3, TOP = 40; size(128, 64, s); C.style.marginTop = TOP * s + 'px'; TXT.style.top = TOP * s + 'px'; tipTop = TOP * s;
    let thru = null; document.addEventListener('pointermove', (e) => { const v = e.target !== C; if (v !== thru) { thru = v; D('through', { on: v }); } });
    let mtab = 1, mpage = 0, hoverTab = null, hoverRow = null, pdrag = null, page = 'home', hover = null, anim = 0, mstate = { playing: false, i: S.track, pos: 0, dur: 0 }, slide = null;
    const L = (...p) => one(...p);
    const HOME = { settings: ['Setting'], noise: ['White-Noise'], music: ['Music'], shop: ['Shop'] };
    const homeArt = (k, big) => k === 'noise' ? seq('Page-Setting', 'White-Noise', big ? 'Large' : 'Small')[anim % 2] : L('Page-Setting', ...HOME[k], big ? 'Large' : 'Small');
    const slider = (psd, ...p) => ({ line: L(psd, ...p, 'Line'), point: L(psd, ...p, 'Point') });
    const SL = { vol: slider('Setting-Page', 'Sound'), scale: slider('Setting-Page', 'Size') };
    const NS = Object.fromEntries(NOISE.map(([k, n]) => [k, slider('White-Noise-Page', n)]));
    const horiz = (sl) => { const b = box(sl.line); return b && b.r - b.l >= b.b - b.t; };
    const val = (k) => (k === 'vol' ? S.vol : k === 'scale' ? (S.scale - 2) / 4 : S.noise[k] || 0);
    const setVal = (k, v) => { v = Math.max(0, Math.min(1, v)); if (k === 'vol') S.vol = v; else if (k === 'scale') S.scale = Math.round((2 + v * 4) * 2) / 2; else S.noise[k] = v; save(); };
    const drawSlider = (sl, v) => {
      draw(sl.line); const b = box(sl.line), pb = box(sl.point); if (!b || !pb) return;
      if (horiz(sl)) draw(sl.point, Math.round(b.l + v * (b.r - b.l) - (pb.l + pb.r) / 2), 0);
      else draw(sl.point, 0, Math.round(b.b - v * (b.b - b.t) - (pb.t + pb.b) / 2));
    };
    const fromSlider = (sl, p) => { const b = box(sl.line); return horiz(sl) ? (p.x - b.l) / Math.max(1, b.r - b.l) : (b.b - p.y) / Math.max(1, b.b - b.t); };
    const nearSlider = (sl, p) => { const b = box(sl.line); return b && p.x >= b.l - 4 && p.x <= b.r + 4 && p.y >= b.t - 4 && p.y <= b.b + 4; };
    const listX = () => { const dv = box(L('Music-Page', 'Divider')); return dv ? dv.r + 4 : 30; };
    const listW = () => { const fl = box(L('Music-Page', 'Floor')); return (fl ? fl.l - 3 : 118) - listX(); };
    const allRows = () => mtab === 2 ? NOISE.map(([k, , a1, b1]) => ({ label: T(a1, b1), on: (S.noise[k] || 0) > 0, noise: k })) : TRACKS.map((tr, i) => ({ label: T(tr[1], tr[2]), on: i === mstate.i && mstate.playing, i }));
    const rows = () => allRows().slice(mpage * 4, mpage * 4 + 4);
    const tabAt = (p) => [1, 2, 3, 4].find((k) => inBox(L('Music-Page', 'Menu', String(k), '100'), p.x, p.y, 2)) || null;
    const rowAt = (p) => { if (p.x < listX() || p.x > listX() + listW()) return null; let best = null; rows().forEach((_, n) => { if (Math.abs(p.y - rowY(n)) <= 5) best = n; }); return best; };
    const rowY = (n) => { const b = box(L('Music-Page', 'Menu', String(n + 1), '100')); return b ? (b.t + b.b) / 2 : 14 + n * 11; };
    const TOG = { stars: ['Stars', '星星', 'Stars'], top: ['Keep-Up', '置頂', 'On top'], time: ['Time', '時間', 'Clock'] };
    const ML = { mode: () => L('Music-Line', 'Mode', { loop: 'Loop', single: 'Single', shuffle: 'Shuffle' }[S.mode]), play: () => L('Music-Line', 'Switch2', mstate.playing ? 'Pause' : 'Play'), prev: () => L('Music-Line', 'Switch', 'Previous'), next: () => L('Music-Line', 'Switch', 'Next') };

    function paint() {
      X.clearRect(0, 0, 128, 64);
      draw(L('Page', 'Floor')); for (const d of ['Green', 'Yellow', 'Red']) draw(L('Page', d));
      for (const id of [...TXT.children].map((x) => x.id.slice(2))) if (!id.startsWith(page)) text(id, '', 0, 0, 0, s);
      if (page === 'home') {
        for (const k of Object.keys(HOME)) draw(homeArt(k, hover === k));
        draw(L('Music-Line', 'Floor')); draw(L('Music-Line', 'Progress-Bar', 'Line'));
        const lb = box(L('Music-Line', 'Progress-Bar', 'Line')), pb = box(L('Music-Line', 'Progress-Bar', 'Point'));
        if (lb && pb) draw(L('Music-Line', 'Progress-Bar', 'Point'), Math.round(lb.l + (mstate.dur ? mstate.pos / mstate.dur : 0) * (lb.r - lb.l) - (pb.l + pb.r) / 2), 0);
        for (const f of Object.values(ML)) draw(f());
      } else if (page === 'settings') {
        drawSlider(SL.vol, val('vol')); drawSlider(SL.scale, val('scale'));
        for (const [k, [n, a, b]] of Object.entries(TOG)) { const h = L('Setting-Page', n, S[k] ? 'Green' : 'Red'); draw(h); }
        draw(L('Setting-Page', 'Key')); draw(L('Setting-Page', 'Decoration'));
      } else if (page === 'noise') {
        draw(L('White-Noise-Page', 'Icon'));
        for (const [k] of NOISE) drawSlider(NS[k], val(k));
      } else if (page === 'music') {
        // left: the four face tabs (1 music, 2 white noise, 3–4 later); right of the divider: 4 rows per page + scrollbar
        draw(L('Music-Page', 'Divider')); draw(L('Music-Page', 'Floor')); draw(L('Music-Page', mpage ? 'Slider2' : 'Slider1'));
        for (let k = 1; k <= 4; k++) draw(L('Music-Page', 'Menu', String(k), mtab === k || hoverTab === k ? '100' : '20'));
        const pt = box(L('Music-Page', 'Point')), tb = box(L('Music-Page', 'Menu', String(mtab), '100')); if (pt && tb) draw(L('Music-Page', 'Point'), 0, Math.round((tb.t + tb.b) / 2 - (pt.t + pt.b) / 2));
        rows().forEach((r, n) => text('music-' + n, (r.on ? '♪ ' : '') + r.label, listX(), rowY(n) - 4, listW(), s, 6));
        for (let n = rows().length; n < 4; n++) text('music-' + n, '', 0, 0, 0, s);
        [...TXT.querySelectorAll('[id^="t-music-"]')].forEach((el, n) => { const r = rows()[n]; if (r) el.style.color = r.on ? '#7f45ba' : hoverRow === n ? '#9b5fd6' : '#b993dd'; });      } else if (page === 'shop') {
        text('shop-soon', T('商店下一版開放', 'Shop: next update'), 10, 26, 108, s, 5.5);
      }
    }
    const dot = (p) => ['Red', 'Yellow', 'Green'].find((d) => inBox(L('Page', d), p.x, p.y, 2));
    C.addEventListener('pointerdown', (e) => {
      const p = pos(e, s), d = dot(p);
      if (d === 'Red') return D('pageClose');
      if (d === 'Yellow') return D('pageMin');
      if (d === 'Green') { page = 'home'; return paint(); }
      if (page === 'home') {
        const k = Object.keys(HOME).find((x) => inBox(homeArt(x, false), p.x, p.y, 2)); if (k) { page = k; return paint(); }
        if (inBox(ML.play(), p.x, p.y)) return bc.postMessage({ t: 'cmd', op: mstate.playing ? 'pause' : 'play' });
        if (inBox(ML.prev(), p.x, p.y)) return bc.postMessage({ t: 'cmd', op: 'prev' });
        if (inBox(ML.next(), p.x, p.y)) return bc.postMessage({ t: 'cmd', op: 'next' });
        if (inBox(ML.mode(), p.x, p.y)) { S.mode = { loop: 'single', single: 'shuffle', shuffle: 'loop' }[S.mode]; save(); return paint(); }
        const lb = box(L('Music-Line', 'Progress-Bar', 'Line')); if (lb && p.x >= lb.l && p.x <= lb.r && Math.abs(p.y - lb.t) < 4) return bc.postMessage({ t: 'cmd', op: 'seek', f: (p.x - lb.l) / Math.max(1, lb.r - lb.l) });
      } else if (page === 'settings') {
        for (const k of ['vol', 'scale']) if (nearSlider(SL[k], p)) { slide = [SL[k], k]; setVal(k, fromSlider(SL[k], p)); C.setPointerCapture(e.pointerId); return paint(); }
        for (const [k, [n]] of Object.entries(TOG)) if (inBox(L('Setting-Page', n, 'Green'), p.x, p.y, 3)) { S[k] = !S[k]; save(); return paint(); }
        if (inBox(L('Setting-Page', 'Key'), p.x, p.y)) { S.lang = S.lang === 'en' ? 'zh' : 'en'; save(); return paint(); }
      } else if (page === 'noise') {
        for (const [k] of NOISE) if (nearSlider(NS[k], p)) { slide = [NS[k], k]; setVal(k, fromSlider(NS[k], p)); C.setPointerCapture(e.pointerId); return paint(); }
      } else if (page === 'music') {
        const tb = tabAt(p); if (tb) { if (tb <= 2) { mtab = tb; mpage = 0; } return paint(); }
        const fl = box(L('Music-Page', 'Floor')); if (fl && p.x >= fl.l - 3) { mpage = allRows().length > 4 ? (mpage + 1) % 2 : 0; return paint(); }
        const n = rowAt(p); if (n !== null) { const r = rows()[n]; if (r.noise) { S.noise[r.noise] = r.on ? 0 : 0.5; save(); } else bc.postMessage({ t: 'cmd', op: r.on ? 'pause' : 'pick', i: r.i }); return paint(); }
      }
      // empty space drags the window
      pdrag = { sx: e.screenX, sy: e.screenY, wx: window.screenX, wy: window.screenY }; C.setPointerCapture(e.pointerId);
    });
    C.addEventListener('pointermove', (e) => {
      const p = pos(e, s);
      if (slide) { setVal(slide[1], fromSlider(slide[0], p)); return paint(); }
      if (pdrag) return D('move', { x: Math.round(pdrag.wx + e.screenX - pdrag.sx), y: Math.round(pdrag.wy + e.screenY - pdrag.sy) });
      const h = page === 'home' ? Object.keys(HOME).find((x) => inBox(homeArt(x, false), p.x, p.y, 2)) || null : null;
      const labels = { settings: ['設定', 'Settings'], noise: ['白噪音', 'Noise'], music: ['音樂', 'Music'], shop: ['商店', 'Shop'] };
      const d = dot(p), dl = { Red: ['關閉', 'Close'], Yellow: ['縮小', 'Hide'], Green: ['回主頁', 'Home'] };
      let lab = h ? T(...labels[h]) : d ? T(...dl[d]) : '';
      if (!lab && page === 'settings') { for (const k of ['vol', 'scale']) if (nearSlider(SL[k], p)) lab = k === 'vol' ? T('音量', 'Volume') : T('大小', 'Size'); for (const [k, [n, a1, b1]] of Object.entries(TOG)) if (inBox(L('Setting-Page', n, 'Green'), p.x, p.y, 3)) lab = T(a1, b1); if (inBox(L('Setting-Page', 'Key'), p.x, p.y)) lab = T('中文', 'EN'); }
      if (page === 'music') { const tb = tabAt(p), n = rowAt(p); if (tb !== hoverTab || n !== hoverRow) { hoverTab = tb; hoverRow = n; paint(); } if (!lab && tb) lab = [T('音樂', 'Music'), T('白噪音', 'Noise'), T('敬請期待', 'Soon'), T('敬請期待', 'Soon')][tb - 1]; if (!lab && n !== null) lab = rows()[n].on ? T('暫停', 'Pause') : T('播放', 'Play'); }
      if (!lab && page === 'noise') for (const [k, , a1, b1] of NOISE) if (nearSlider(NS[k], p)) lab = T(a1, b1);
      if (!lab && page === 'home') { const ml = { play: [mstate.playing ? '暫停' : '播放', mstate.playing ? 'Pause' : 'Play'], prev: ['上一首', 'Back'], next: ['下一首', 'Next'], mode: [{ loop: '順序', single: '單曲', shuffle: '隨機' }[S.mode], { loop: 'Order', single: 'Repeat', shuffle: 'Shuffle' }[S.mode]] }; for (const k of Object.keys(ml)) if (inBox(ML[k](), p.x, p.y)) lab = T(...ml[k]); }
      tip(lab, e);
      if (h !== hover) { hover = h; paint(); }
    });
    C.addEventListener('pointerup', () => { slide = null; pdrag = null; });
    C.addEventListener('pointerleave', () => tip(''));
    C.addEventListener('contextmenu', (e) => e.preventDefault());
    bc.onmessage = ({ data: m }) => { if (m.t === 'state') S = load(); if (m.t === 'music') mstate = m; paint(); };
    bc.postMessage({ t: 'cmd', op: 'ask' });
    setInterval(() => { anim++; if (page === 'home') paint(); }, 400);
    paint();
  }

  // ================================================================ Mizuki tray menu, in the pet's own style
  function menuView() {
    C.remove();
    document.body.style.cssText += ';background:transparent';
    const st = document.createElement('style');
    st.textContent = `#m{margin:4px;background:#e9d7ff;color:#5b2e86;border:2px solid #b985ee;border-radius:10px;padding:6px;font-size:13px;box-shadow:0 4px 14px #5b2e8633}
#m b{display:block;padding:6px 10px 8px;font-weight:normal;color:#7f45ba}
#m hr{border:0;height:1px;background:#c69cf3;margin:4px 6px}
#m button{all:unset;display:block;box-sizing:border-box;width:100%;padding:7px 16px 7px 10px;border-radius:8px;cursor:pointer;font-family:mzPetPixel,monospace}
#m button:hover{background:#cfadff;color:#3d1a61}`;
    document.head.appendChild(st);
    const m = document.createElement('div'); m.id = 'm'; document.body.appendChild(m);
    const build = async () => {
      S = load();
      const info = (await D('menuInfo')) || {}, petOn = !!info.petOpen, name = info.name || 'Mizuki';
      const items = [['open', T('打開沐水', 'Open Mizuki')]];
      if (petOn) items.push(null, ['page', T('桌寵設定', 'Pet settings')], ['book', T('本子', 'Notebook')], ['mode', S.play ? T('切換成陪伴模式', 'Companion mode') : T('切換成鍵盤模式', 'Keyboard mode')],
        ['skin', T('換造型：', 'Look: ') + T(SKINS[okSkin(S.skin)].zh, SKINS[okSkin(S.skin)].en)], ['acc', T('掛件：', 'Accessory: ') + (okAcc(S.acc) ? T(ACCS[S.acc].zh, ACCS[S.acc].en) : T('無', 'None'))], ['petClose', T('關閉桌寵', 'Close the pet')]);
      items.push(null, ['quit', T('完全退出', 'Quit')]);
      m.innerHTML = `<b>${name}</b><hr>` + items.map((x) => (x ? `<button data-k="${x[0]}">${x[1]}</button>` : '<hr>')).join('');
      D('menuSize', { h: m.offsetHeight + 8 });
    };
    m.addEventListener('click', async (e) => {
      const k = e.target.closest('button')?.dataset.k; if (!k) return;
      if (k === 'skin' || k === 'acc') {
        S = load();
        if (k === 'skin') { const all = Object.keys(SKINS).filter((x) => !SKINS[x].dlc || unlocked()); S.skin = all[(all.indexOf(okSkin(S.skin)) + 1) % all.length]; }
        else { const all = [null, ...Object.keys(ACCS).filter((x) => !ACCS[x].dlc || unlocked())]; S.acc = all[(all.indexOf(okAcc(S.acc)) + 1) % all.length]; }
        save(); return build();
      }
      if (k === 'mode') bc.postMessage({ t: 'cmd', op: 'mode' });
      if (k === 'book') bc.postMessage({ t: 'cmd', op: 'act', k: 'book' });
      D('menuPick', { k });
    });
    window.mzPetMenuRefresh = build;
    build();
  }
})();
