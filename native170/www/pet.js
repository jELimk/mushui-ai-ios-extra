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
  const DEF = { lang: /^en/i.test(navigator.language) ? 'en' : 'zh', skin: 'jeli', acc: null, scale: 3, top: true, stars: true, time: false,
    vol: 0.6, track: 0, mode: 'loop', noise: { rain: 0, fire: 0, wind: 0, thunder: 0 },
    cats: [], cat: null, pullDay: '', xp: 0, feeds: 0, week: '', weekFeeds: 0, since: Date.now(),
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
  const FOODS = [['Free', 'Takoyaki', 'Food-Takoyaki', 0, '章魚燒', 'Takoyaki'], ['Free', 'MatchaBBT', 'Food-MatchaBBT', 0, '抹茶奶茶', 'Matcha'], ['Free', 'Peach', 'Food-Peach', 0, '水蜜桃', 'Peach'], ['Free', 'Lemon', 'Food-Lemon', 0, '檸檬', 'Lemon'],
    ['Buy', 'Cookie', 'Food-Cookie-Buy', 1, '餅乾', 'Cookie'], ['Buy', 'Hamburger', 'Food-Hamburger-Buy', 1, '漢堡', 'Burger'], ['Buy', 'Mint-Chocolate-Ice-Cream', 'Food-Mint-Chocolate-Ice-Cream-Buy', 1, '薄荷冰淇淋', 'Mint ice'], ['Buy', 'Chocolate-Cake', 'Food-Chocolate-Cake-Buy', 1, '巧克力蛋糕', 'Choco cake'], [null, 'Udon', 'Food-Udon-DLC', 1, '烏龍麵', 'Udon']];
  const CATS = { A: ['黑白貓', 'Tux cat'], B: ['白貓', 'White cat'], C: ['灰貓', 'Grey cat'] };
  const weekKey = () => { const d = new Date(), j = new Date(d.getFullYear(), 0, 1); return d.getFullYear() + '-' + Math.floor(((d - j) / 86400000 + j.getDay()) / 7); };
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
  const text = (id, str, x, y, w, s, px = 6, maxH = 0, align = 'left') => {
    let el = document.getElementById('t-' + id); if (!str) { el?.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 't-' + id; TXT.appendChild(el); }
    Object.assign(el.style, { left: x * s + 'px', top: y * s + 'px', width: w * s + 'px', wordBreak: /[　-鿿＀-￯]/.test(str) ? 'break-all' : 'normal', whiteSpace: maxH ? 'pre-wrap' : 'nowrap', overflow: 'hidden', textAlign: align, textWrap: 'balance' }); keep(el, str);
    el.style.paddingTop = '0'; el.style.boxSizing = 'border-box'; fit(el, px, s, w, maxH || 7);
    if (maxH) el.style.paddingTop = Math.max(0, (maxH * s - el.scrollHeight) / 2) + 'px';
  };
  // hover label = the user's Details-Pop-Up frame with the text inside; the smallest frame the text fits in
  let tipS = 3, tipTop = 0; const tipC = document.createElement('canvas'), tipT = document.createElement('div'); tipC.width = 45; tipC.height = 50; TIP.append(tipC, tipT);
  const tip = (str, e) => {
    if (!str) { TIP.style.display = 'none'; return; }
    const s = tipS; TIP.style.display = 'block'; keep(tipT, str);
    let kind, b;
    for (kind of ['Small', 'Medium', 'Large']) {
      b = box(one('Details-Pop-Up', kind)); const w = b.r - b.l + 1, h = b.b - b.t + 1;
      Object.assign(tipT.style, { position: 'absolute', left: 2 * s + 'px', top: 2 * s + 'px', width: (w - 4) * s + 'px', height: (h - 7) * s + 'px', display: 'block', textAlign: 'center', textWrap: 'balance', color: '#7f45ba', lineHeight: '1.15', wordBreak: /[　-鿿＀-￯]/.test(str) ? 'break-all' : 'normal', whiteSpace: 'pre-wrap' });
      tipT.style.paddingTop = '0'; tipT.style.boxSizing = 'border-box';
      if (fit(tipT, 6, s, w - 4, h - 7)) break;
    }
    { const H = (b.b - b.t + 1 - 7) * s; tipT.style.height = 'auto'; const inner = tipT.scrollHeight; tipT.style.height = H + 'px'; tipT.style.paddingTop = Math.max(0, (H - inner) / 2) + 'px'; }
    const h = one('Details-Pop-Up', kind), x = tipC.getContext('2d'); x.clearRect(0, 0, 45, 50); x.drawImage(img(h), 0, 0);
    Object.assign(tipC.style, { width: 45 * s + 'px', height: 50 * s + 'px', imageRendering: 'pixelated', position: 'absolute', left: -b.l * s + 'px', top: -b.t * s + 'px' });
    const w = (b.r - b.l + 1) * s, hh = (b.b - b.t + 1) * s;
    // the frame sits above the pointer, kept inside the window (the settings window has a clear strip on top for it)
    Object.assign(TIP.style, { width: w + 'px', height: hh + 'px', left: Math.max(0, Math.min(e.clientX - w / 2, innerWidth - w)) + 'px', top: Math.max(0, Math.min(e.clientY - hh - 3, tipTop ? tipTop - hh : 1e9)) + 'px' });
  };

  window.mzPetTip = tip;
  if (VIEW === 'pet') return petView();
  if (VIEW === 'page') return pageView();
  if (VIEW === 'menu') return menuView();
  if (VIEW === 'book') return bookView();

  // ================================================================ the pet
  function petView() {
    const FW = (() => { const b = box(one('Time', 'Stopwatch', 'Floor')); return b ? b.r - b.l + 1 : 36; })();
    const PX = Math.max(40, FW + 5), PY = 40, CW = PX + 96, CH = 124; // pet 64×64 at (40,40); bubble above; stopwatch on her left; cat on her right; clock under her
    let s = S.scale; tipS = s; size(CW, CH, s);
    // 3.4.4: she speaks like the official 沐水 account — warm, a little playful, kaomoji, never tsundere
    const LINES = { zh: { angry: ['頭好暈～慢一點嘛 (＠_＠)', '晃得我要變水滴了啦～', '輕輕的就好嘛 (｡>﹏<｡)', '再晃要飄走囉～'], touch: ['嘿嘿，被摸頭了 (｡•ᴗ•｡)', '找沐水嗎？我在喔～', '好舒服～再一下下', '頭髮要被摸亂啦 (*´∀`)', '沐水一直都在喔！', '今天也辛苦了～', '嗯？要聊聊天嗎？'], idle: ['陪沐水聊一下嘛～', '沐水在這裡等你喔 (｡•ᴗ•｡)', '想你了～來看看我？', '今天過得好嗎？', '有沒有想跟我說的？', '偷偷看你一下 (・ω・)'], reminder: ['記得喝水喔～ ᓚ₍⑅^..^₎♡', '休息一下眼睛吧 (｡•ᴗ•｡)', '起來伸個懶腰～', '坐姿挺一點點喔！', '深呼吸～慢慢來', '累了就休息一下吧～'] },
      en: { angry: ['So dizzy~ slow down (＠_＠)', 'I might turn into a drop~', 'Gently, please (｡>﹏<｡)', 'I will float away~'], touch: ['Hehe, a head pat (｡•ᴗ•｡)', 'Looking for me? I am here~', 'That feels nice~', 'You will mess up my hair!', 'Mizuki is always here!', 'You did great today~', 'Hm? Want to chat?'], idle: ['Chat with me a little?', 'I am waiting here (｡•ᴗ•｡)', 'Missed you~ come see me?', 'How was your day?', 'Anything to tell me?', 'Peeking at you (・ω・)'], reminder: ['Drink some water~ ᓚ₍⑅^..^₎♡', 'Rest your eyes (｡•ᴗ•｡)', 'Time for a stretch~', 'Sit up a little!', 'Deep breath~ take it slow', 'Tired? Take a short break~'] } };
    const KEYART = { top1: ['Top', 'W'], top2: ['Top', 'A'], top3: ['Top', 'S'], top4: ['Top', 'D'], mid1: ['Middle', '1'], mid2: ['Middle', '2'], mid3: ['Middle', '3'], mid4: ['Middle', 'Shift'], bottom1: ['Bottom', 'ESC'], bottom2: ['Bottom', 'Space'], bottom3: ['Bottom', 'Backspace'] };
    const PRESS = ['High', 'Medium', 'Low', 'Medium'];
    let frame = 0, hair = false, hairAt = 0, petF = null, back = [], heart = false, heartEnd = false, heartF = 0;
    let menu = false, menuF = 0, menuHover = null, bubble = null, mouse = null, trans = null, keyJelly = null, keyF = 0, pressed = null, pressF = 0;
    let drag = null, clickOk = false, pressAt = 0, revs = 0, dir = 0, anchorX = 0, lastAngry = 0, lastTouch = 0, through = null;
    let nextIdle = now() + 600, nextRemind = now() + 162;
    let food = null, foodF = 0, catPet = 0, clockMode = 'clock', watch = { run: false, at: 0, acc: 0 }, timer = { run: false, end: 0, left: 25 * 60 };
    const CATX = PX + 64, CATY = PY + 32;
    const catOn = () => S.cat && (S.cats || []).includes(S.cat) && CATS[S.cat];
    const clockOff = (b) => ({ x: Math.round(PX + 32 - (b.l + b.r) / 2), y: Math.round(PY + 66 - b.t) }); // centred under her, below the keyboard
    const watchOff = (b) => ({ x: Math.round(PX - 2 - b.r), y: Math.round(PY + 32 - (b.t + b.b) / 2) }); // middle of her left side
    // digits sit either side of the colon that is drawn in the art: 11 ： 12
    const split = (id, a, c, b, o, px) => { const mid = o.x + (b.l + b.r) / 2, y = o.y + (b.t + b.b) / 2 - px * 0.62, gap = 5; text(id + 'a', a, mid - gap - 20, y, 20, s, px, 0, 'right'); text(id + 'b', c, mid + gap, y, 20, s, px, 0, 'left'); };
    const mmss = (sec) => { sec = Math.max(0, Math.floor(sec)); return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); };

    const say = (str, sec = 3.6) => { bubble = { str, until: now() + sec }; };
    const line = (mood) => { if (S.play) return; if (mood === 'touch') { if (bubble || now() - lastTouch < 1.2) return; lastTouch = now(); } say(rnd(LINES[zh() ? 'zh' : 'en'][mood])); };
    window.mzPetSay = (str) => say(String(str).slice(0, 60), 5); // the main app can speak through her (new messages…)
    const skin = () => SKINS[okSkin(S.skin)];
    const menuItems = { book: one('Right-Click', 'Book', '3'), settings: one('Right-Click', 'Setting', '3'), close: one('Right-Click', 'Close', '3') };
    const menuLabel = { book: ['本子', 'Book'], settings: ['設定', 'Settings'], close: ['關閉', 'Close'] };

    const setMode = (play) => {
      if (play === S.play || trans) return;
      if (play) stopPet(); // her line stays until it ends
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
      if (food) { foodF++; if (foodF >= seq(food).length) { food = null; { const wk = weekKey(); S = load(); S.feeds = (S.feeds || 0) + 1; S.xp = (S.xp || 0) + 10; if (S.week !== wk) { S.week = wk; S.weekFeeds = 0; } S.weekFeeds++; save(); } say(rnd([T('好好吃～謝謝你 (｡•ᴗ•｡)', 'Yummy~ thank you (｡•ᴗ•｡)'), T('吃飽飽了～', 'So full~'), T('最喜歡你了 ᓚ₍⑅^..^₎♡', 'Love you ᓚ₍⑅^..^₎♡')])); } }
      if (timer.run && Date.now() >= timer.end) { timer.run = false; timer.left = 25 * 60; say(T('時間到囉～休息一下吧 (｡•ᴗ•｡)', 'Time is up~ take a break (｡•ᴗ•｡)'), 6); }
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
        draw(one('Pop-Up', kind), PX - 3, 0);
        const b = box(one('Pop-Up', kind)) || { l: 2, t: 2, r: 66, b: 30 };
        text('bubble', bubble.str, PX - 3 + b.l + 4, b.t + 3, b.r - b.l - 8, s, 6, b.b - b.t - 10);
      } else text('bubble', '', 0, 0, 0, s);
      if (!S.play && food) { const f = seq(food), st = seq('Food-Stars'); draw(f[Math.min(foodF, f.length - 1)], PX, PY); draw(st[foodF % st.length], PX, PY); }
      if (catOn()) { const c = S.cat; if (now() < catPet) { const pf = seq('Pet-' + c + '-Cat'), hf = seq('Pet-Cat-Heart'); draw(pf[frame % pf.length], CATX, CATY); draw(hf[frame % hf.length], CATX, CATY); } else { const f = seq(c + '-Cat'); draw(f[frame % f.length], CATX, CATY); } }
      if (S.time) {
        if (clockMode === 'clock') { const h = one('Time', 'Clock'), b = box(h); if (b) { const o = clockOff(b); draw(h, o.x, o.y); const d = new Date(); split('clock', String(d.getHours()).padStart(2, '0'), String(d.getMinutes()).padStart(2, '0'), b, o, 6); } }
        else { const h = one('Time', 'Stopwatch', 'Floor'), b = box(h); if (b) { const o = watchOff(b); draw(h, o.x, o.y); draw(one('Time', 'Stopwatch', 'Stopwatch', watch.run ? 'Press' : 'Normal'), o.x, o.y); draw(one('Time', 'Stopwatch', 'Timer', timer.run ? 'Press' : 'Normal'), o.x, o.y);
          const sec = Math.max(0, Math.floor(timer.run ? (timer.end - Date.now()) / 1000 : watch.run || watch.acc ? (watch.acc + (watch.run ? Date.now() - watch.at : 0)) / 1000 : timer.left));
          split('clock', String(Math.floor(sec / 60)).padStart(2, '0'), String(sec % 60).padStart(2, '0'), b, o, 8); } }
      } else { text('clocka', '', 0, 0, 0, s); text('clockb', '', 0, 0, 0, s); }
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
      if (catOn() && p.x >= CATX && p.y >= CATY && p.y < CATY + 32) { catPet = now() + 1.6; return; }
      const cb = box(one('Time', 'Clock')), wb = box(one('Time', 'Stopwatch', 'Floor'));
      if (S.time && clockMode === 'clock' && cb && inBox(one('Time', 'Clock'), p.x - clockOff(cb).x, p.y - clockOff(cb).y, 1)) { clockMode = 'watch'; return; }
      if (S.time && clockMode === 'watch' && wb && inBox(one('Time', 'Stopwatch', 'Floor'), p.x - watchOff(wb).x, p.y - watchOff(wb).y, 1)) {
        const b = wb, o = watchOff(b);
        if (o && inBox(one('Time', 'Stopwatch', 'Stopwatch', 'Normal'), p.x - o.x, p.y - o.y, 2)) { if (watch.run) { watch.acc += Date.now() - watch.at; watch.run = false; } else { watch.run = true; watch.at = Date.now(); timer.run = false; } return; }
        if (o && inBox(one('Time', 'Stopwatch', 'Timer', 'Normal'), p.x - o.x, p.y - o.y, 2)) { if (timer.run) { timer.left = (timer.end - Date.now()) / 1000; timer.run = false; } else { timer.run = true; timer.end = Date.now() + timer.left * 1000; watch.run = false; watch.acc = 0; } return; }
        clockMode = 'clock'; watch = { run: false, at: 0, acc: 0 }; return;
      }
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
      if (k === 'book') return D('book');
    };
    window.mzPetAct = act;

    // ---- music + white noise (they live here so they keep playing when the settings window is closed) ----
    let sizeQ = false;
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
    const playTrack = (i, start = true) => { if (listening()) { say(T('沐水正在聽歌喔', 'Mizuki is playing songs'), 3); return report(); } S.track = (i + TRACKS.length) % TRACKS.length; save(); music.src = 'pet/music/' + TRACKS[S.track][0] + '.opus'; if (start) music.play().catch(() => {}); report(); };
    const report = () => bc.postMessage({ t: 'music', active: !!music.getAttribute('src'), playing: !music.paused, i: S.track, pos: music.currentTime || 0, dur: music.duration || 0 });
    // while Mizuki plays songs (一起聽歌) the pet's music stays off; white noise is fine
    const listening = () => { try { return localStorage.getItem('mz-listening') === '1'; } catch { return false; } };
    music.addEventListener('ended', () => { if (S.mode === 'single') { music.currentTime = 0; music.play(); } else playTrack(S.mode === 'shuffle' ? Math.floor(Math.random() * TRACKS.length) : S.track + 1); });
    music.addEventListener('play', report); music.addEventListener('pause', report);
    setInterval(report, 1000);
    bc.onmessage = ({ data: m }) => {
      if (m.t === 'listen' && m.on) music.pause();
      if (m.t === 'scale' && m.v > 1) { s = m.v; tipS = s; size(CW, CH, s); if (!sizeQ) { sizeQ = true; setTimeout(() => { sizeQ = false; D('size', { w: Math.round(CW * s), h: Math.round(CH * s) }); }, 33); } }
      if (m.t === 'feed' && !S.play && !food && seq(m.psd).length) { food = m.psd; foodF = 0; }
      if (m.t === 'state') { const old = S; S = load(); if (S.scale !== old.scale) { s = S.scale; tipS = s; size(CW, CH, s); D('size', { w: Math.round(CW * s), h: Math.round(CH * s) }); } if (S.top !== old.top) D('top', { on: S.top }); applyAudio(); }
      if (m.t === 'cmd') {
        if (m.op === 'play') { if (listening()) playTrack(S.track); else if (!music.getAttribute('src')) playTrack(S.track); else music.play().catch(() => {}); }
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
    let liveQ = false;
    const setVal = (k, v) => { v = Math.max(0, Math.min(1, v)); if (k === 'vol') S.vol = v; else if (k === 'scale') { S.scale = Math.round((2 + v * 4) * 100) / 100; if (!liveQ) { liveQ = true; requestAnimationFrame(() => { liveQ = false; bc.postMessage({ t: 'scale', v: S.scale }); }); } return; } else S.noise[k] = v; save(); };
    const drawSlider = (sl, v) => {
      draw(sl.line); const b = box(sl.line), pb = box(sl.point); if (!b || !pb) return;
      if (horiz(sl)) draw(sl.point, Math.round(b.l + v * (b.r - b.l) - (pb.l + pb.r) / 2), 0);
      else draw(sl.point, 0, Math.round(b.b - v * (b.b - b.t) - (pb.t + pb.b) / 2));
    };
    const fromSlider = (sl, p) => { const b = box(sl.line); return horiz(sl) ? (p.x - b.l) / Math.max(1, b.r - b.l) : (b.b - p.y) / Math.max(1, b.b - b.t); };
    const nearSlider = (sl, p) => { const b = box(sl.line); return b && p.x >= b.l - 4 && p.x <= b.r + 4 && p.y >= b.t - 4 && p.y <= b.b + 4; };
    const listX = () => { const dv = box(L('Music-Page', 'Divider')); return dv ? dv.r + 4 : 30; };
    const listW = () => { const fl = box(L('Music-Page', 'Floor')); return (fl ? fl.l - 3 : 118) - listX(); };
    const allRows = () => TRACKS.map((tr, i) => ({ label: T(tr[1], tr[2]), on: i === mstate.i && mstate.playing, i }));
    const rows = () => allRows().slice(mpage * 4, mpage * 4 + 4);
    const tabAt = (p) => [1, 2, 3, 4].find((k) => inBox(L('Music-Page', 'Menu', String(k), '100'), p.x, p.y, 2)) || null;
    const rowAt = (p) => { if (p.x < listX() || p.x > listX() + listW()) return null; let best = null; rows().forEach((_, n) => { if (Math.abs(p.y - rowY(n)) <= 5) best = n; }); return best; };
    const rowY = (n) => { const b = box(L('Music-Page', 'Menu', String(n + 1), '100')); return b ? (b.t + b.b) / 2 : 14 + n * 11; };
    // shop: 1 food (free ones feed her, the rest are for members), 2 accessories, 3 cats (one free draw a day), 4 soon
    let stab = 1, shopHover = null, pull = null;
    const today = () => new Date().toISOString().slice(0, 10);
    const shopItems = () => {
      if (stab === 1) return FOODS.map(([g, n, psd, dlc, zh1, en1]) => ({ id: n, path: g ? ['Food', g, n] : ['Food', n], locked: !!dlc && !unlocked(), lab: T(zh1, en1), act: () => bc.postMessage({ t: 'feed', psd }) }));
      if (stab === 2) return [['Free', 'Jellyfish', 'jellyfish'], ['Free', 'Angel', 'angel'], ['Free', 'Devil', 'devil'], ['DLC', 'Bow', 'bow'], ['DLC', 'Cat-Ears', 'cat'], ['DLC', 'Scarf', 'scarf']].map(([g, n, k]) => ({ id: n, path: ['Accessory', g, n], lit: S.acc === k, locked: !!ACCS[k].dlc && !unlocked(), lab: T(ACCS[k].zh, ACCS[k].en), act: () => { S.acc = S.acc === k ? null : k; save(); } }));
      if (stab === 3) return ['A', 'B', 'C'].map((c) => ({ id: c, path: ['Accessory', 'Pull', c + '-Cat'], lit: S.cat === c, lab: (S.cats || []).includes(c) ? T(...CATS[c]) : T('抽一隻貓', 'Draw a cat'), act: () => { if ((S.cats || []).includes(c)) { S.cat = S.cat === c ? null : c; save(); } else pull = {}; } }));
      return [];
    };
    const shopAt = (p) => { const tb = [1, 2, 3, 4].find((k) => inBox(L('Shop-Page', 'Menu', String(k), '100'), p.x, p.y, 2)); if (tb) return { tab: tb }; const it = shopItems().find((x) => inBox(L('Shop-Page', ...x.path, '100'), p.x, p.y, 2)); return it ? { id: it.id, it } : null; };
    const TOGART = ['Stars', 'Keep-Up', 'Time'];
    const tog = () => { const order = TOGART.map((n) => [n, box(L('Setting-Page', n, 'Green'))?.t ?? 0]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
      return [['play', order[0], '鍵盤模式', 'Keyboard'], ['top', order[1], '桌寵置頂', 'On top'], ['time', order[2], '顯示時間', 'Clock']]; };
    const flip = (k) => { if (k === 'play') { bc.postMessage({ t: 'cmd', op: 'mode' }); S.play = !S.play; } else { S[k] = !S[k]; save(); } };
    // keyboard settings: Key.psd keyboard + Key-Setting label boxes; click a key, then press the new key
    const KROWS = [['Top', ['W', 'A', 'S', 'D'], 'top'], ['Middle', ['1', '2', '3', 'Shift'], 'mid'], ['Bottom', ['ESC', 'Space', 'Backspace'], 'bottom']];
    const KSLOTS = KROWS.flatMap(([row, ks, pre]) => ks.map((k, i) => ({ row, k, slot: pre + (i + 1), lab: L('Key-Setting', row, String(i + 1)) })));
    const KX = 32; let keyHover = null, keyWait = null;
    const keyAt = (p) => KSLOTS.find((o) => inBox(L('Key', o.row, 'Normal', o.k), p.x - KX, p.y, 1)) || null;
    const keyName = (c) => ({ shift: 'Shift', space: 'Space', esc: 'Esc', backspace: '⌫' }[c] || String(c).toUpperCase());
    document.addEventListener('keydown', (e) => {
      if (!keyWait) return; e.preventDefault();
      const c = e.key === ' ' ? 'space' : e.key === 'Escape' ? 'esc' : e.key === 'Backspace' ? 'backspace' : e.key === 'Shift' ? 'shift' : e.key.length === 1 && /[a-z0-9]/i.test(e.key) ? e.key.toLowerCase() : null;
      if (!c) return;
      for (const x of KEYS) if (S.keys[x] === c) S.keys[x] = S.keys[keyWait.slot]; // swap if already used
      S.keys[keyWait.slot] = c; keyWait = null; save(); paint();
    });
    const ML = { mode: () => L('Music-Line', 'Mode', { loop: 'Loop', single: 'Single', shuffle: 'Shuffle' }[S.mode]), play: () => L('Music-Line', 'Switch2', mstate.playing ? 'Pause' : 'Play'), prev: () => L('Music-Line', 'Switch', 'Previous'), next: () => L('Music-Line', 'Switch', 'Next') };

    function paint() {
      if (page !== hist[hi]) { if (!nav) { hist = hist.slice(0, hi + 1); hist.push(page); hi = hist.length - 1; } } nav = false;
      X.clearRect(0, 0, 128, 64);
      draw(L('Page', 'Floor')); for (const d of ['Green', 'Yellow', 'Red']) draw(L('Page', d));
      for (const id of [...TXT.children].map((x) => x.id.slice(2))) if (!id.startsWith(page)) text(id, '', 0, 0, 0, s);
      if (page === 'home') {
        for (const k of Object.keys(HOME)) draw(homeArt(k, hover === k));
        if (mstate.active) { draw(L('Music-Line', 'Floor')); draw(L('Music-Line', 'Progress-Bar', 'Line'));
        const lb = box(L('Music-Line', 'Progress-Bar', 'Line')), pb = box(L('Music-Line', 'Progress-Bar', 'Point'));
        if (lb && pb) draw(L('Music-Line', 'Progress-Bar', 'Point'), Math.round(lb.l + (mstate.dur ? mstate.pos / mstate.dur : 0) * (lb.r - lb.l) - (pb.l + pb.r) / 2), 0);
        for (const f of Object.values(ML)) draw(f()); }
      } else if (page === 'settings') {
        drawSlider(SL.vol, val('vol')); drawSlider(SL.scale, val('scale'));
        for (const [k, n, a, b] of tog()) { const h = L('Setting-Page', n, S[k] ? 'Green' : 'Red'); draw(h); const bb = box(h); if (bb) text('settings-' + k, T(a, b), bb.r + 3, (bb.t + bb.b) / 2 - 3.5, 122 - bb.r - 3, s, 6); }
        draw(L('Setting-Page', 'Key')); draw(L('Setting-Page', 'Decoration'));
        for (const k of ['vol', 'scale']) { const b = box(SL[k].line); if (b) text('settings-' + k, k === 'vol' ? T('音樂音量', 'Music volume') : T('桌寵大小', 'Pet size'), b.l, b.b + 2, b.r - b.l + 1, s, 6, 0, 'center'); }
        const kb = box(L('Setting-Page', 'Key')); if (kb) text('settings-key', T('鍵盤設定', 'Keys'), kb.l + 2, (kb.t + kb.b) / 2 - 3, kb.r - kb.l - 3, s, 5.5, 0, 'center');
        // language (the empty box at the left): the chosen one is darker
        const sl = box(SL.vol.line), dc = box(L('Setting-Page', 'Decoration')), lx = 6, lw = (sl ? sl.l : 34) - 10, ly = 16;
        text('settings-zh', '繁中', lx, ly, lw, s, 6, 0, 'center'); text('settings-en', 'EN', lx, ly + 11, lw, s, 6, 0, 'center');
        for (const [id, on] of [['zh', S.lang !== 'en'], ['en', S.lang === 'en']]) { const el = document.getElementById('t-settings-' + id); if (el) el.style.color = on ? '#7f45ba' : '#c9aee6'; }
      } else if (page === 'keys') {
        draw(L('Key', 'Floor'), KX, 0);
        for (const o of KSLOTS) draw(L('Key', o.row, 'Normal', o.k), KX, 0);
        const o = keyWait || keyHover;
        if (o) { draw(o.lab, KX, 0); const b = box(o.lab); if (b) text('keys-lab', keyWait ? T('按新的鍵', 'Press a key') : keyName(S.keys[o.slot]), KX + b.l, b.t + 1, b.r - b.l + 1, s, 6, 0, 'center'); }
        else text('keys-lab', '', 0, 0, 0, s);
        text('keys-help', T('點一個鍵，再按新的鍵', 'Click a key, then press a new one'), 6, 15, 116, s, 6, 0, 'center');
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
        draw(L('Shop-Page', 'Divider'));
        for (let k = 1; k <= 4; k++) draw(L('Shop-Page', 'Menu', String(k), stab === k || shopHover?.tab === k ? '100' : '20'));
        { const pt = box(L('Shop-Page', 'Point')), tb = box(L('Shop-Page', 'Menu', String(stab), '100')); if (pt && tb) draw(L('Shop-Page', 'Point'), 0, Math.round((tb.t + tb.b) / 2 - (pt.t + pt.b) / 2)); }
        for (const it of shopItems()) draw(L('Shop-Page', ...it.path, it.lit || shopHover?.id === it.id && !it.locked ? '100' : '20'));
        if (stab === 4) text('shop-soon', T('敬請期待', 'Soon'), 40, 28, 80, s, 6, 0, 'center'); else text('shop-soon', '', 0, 0, 0, s);
        if (pull) {
          draw(L('Shop-Page', 'Pull', 'Floor'));
          if (pull.anim !== undefined) { const f = seq('Pull-' + pull.cat + '-Cat'), fb = box(L('Shop-Page', 'Pull', 'Floor')); if (fb) draw(f[Math.min(pull.anim, f.length - 1)], Math.round((fb.l + fb.r) / 2 - 16), Math.round((fb.t + fb.b) / 2 - 16)); }
          else { draw(L('Shop-Page', 'Pull', 'Pull')); draw(L('Shop-Page', 'Pull', 'Yes')); draw(L('Shop-Page', 'Pull', 'No')); draw(L('Shop-Page', 'Pull', 'Money')); const mb = box(L('Shop-Page', 'Pull', 'Money')); if (mb) text('shop-money', T('免費', 'Free'), mb.l, mb.t + (mb.b - mb.t) / 2 - 3, mb.r - mb.l + 1, s, 5, 0, 'center'); }
        } else text('shop-money', '', 0, 0, 0, s);
      }
    }
    const dot = (p) => ['Red', 'Yellow', 'Green'].find((d) => inBox(L('Page', d), p.x, p.y, 2));
    // side mouse buttons: back / forward between pages (never clicks anything); wheel scrolls the music list
    let hist = ['home'], hi = 0, nav = false;
    C.addEventListener('auxclick', (e) => e.preventDefault());
    C.addEventListener('wheel', (e) => { if (page === 'music' && allRows().length > 4) { mpage = e.deltaY > 0 ? 1 : 0; paint(); reHover(); } }, { passive: true });
    C.addEventListener('pointerdown', (e) => {
      if (e.button === 3 || e.button === 4) { e.preventDefault(); const to = hi + (e.button === 3 ? -1 : 1); if (to >= 0 && to < hist.length) { hi = to; page = hist[hi]; nav = true; tip(''); paint(); } return; }
      const p = pos(e, s), d = dot(p);
      if (d === 'Red') return D('pageClose');
      if (d === 'Yellow') return D('pageMin');
      if (d === 'Green') { page = 'home'; return paint(); }
      if (page === 'home') {
        const k = Object.keys(HOME).find((x) => inBox(homeArt(x, false), p.x, p.y, 2)); if (k) { page = k; return paint(); }
        if (mstate.active && inBox(ML.play(), p.x, p.y)) return bc.postMessage({ t: 'cmd', op: mstate.playing ? 'pause' : 'play' });
        if (mstate.active && inBox(ML.prev(), p.x, p.y)) return bc.postMessage({ t: 'cmd', op: 'prev' });
        if (mstate.active && inBox(ML.next(), p.x, p.y)) return bc.postMessage({ t: 'cmd', op: 'next' });
        if (mstate.active && inBox(ML.mode(), p.x, p.y)) { S.mode = { loop: 'single', single: 'shuffle', shuffle: 'loop' }[S.mode]; save(); return paint(); }
        const lb = box(L('Music-Line', 'Progress-Bar', 'Line')); if (lb && p.x >= lb.l && p.x <= lb.r && Math.abs(p.y - lb.t) < 4) return bc.postMessage({ t: 'cmd', op: 'seek', f: (p.x - lb.l) / Math.max(1, lb.r - lb.l) });
      } else if (page === 'settings') {
        for (const k of ['vol', 'scale']) if (nearSlider(SL[k], p)) { slide = [SL[k], k]; setVal(k, fromSlider(SL[k], p)); C.setPointerCapture(e.pointerId); return paint(); }
        for (const [k, n] of tog()) { const bb = box(L('Setting-Page', n, 'Green')); if (bb && p.y >= bb.t - 3 && p.y <= bb.b + 3 && p.x >= bb.l - 3 && p.x <= 124) { flip(k); return paint(); } }
        if (inBox(L('Setting-Page', 'Key'), p.x, p.y)) { page = 'keys'; return paint(); }
        const sl = box(SL.vol.line); if (p.x < (sl ? sl.l - 3 : 32) && p.y >= 13 && p.y < 37) { S.lang = p.y < 26 ? 'zh' : 'en'; save(); return paint(); }
      } else if (page === 'shop') {
        if (pull) {
          if (pull.anim !== undefined) return;
          if (inBox(L('Shop-Page', 'Pull', 'No'), p.x, p.y, 2)) { pull = null; return paint(); }
          if (inBox(L('Shop-Page', 'Pull', 'Yes'), p.x, p.y, 2) || inBox(L('Shop-Page', 'Pull', 'Pull'), p.x, p.y, 2)) {
            if (S.pullDay === today()) { pull = null; tip(T('明天再來抽', 'Come back tomorrow'), e); return paint(); }
            const left = ['A', 'B', 'C'].filter((c) => !(S.cats || []).includes(c)), c = rnd(left.length ? left : ['A', 'B', 'C']);
            pull = { cat: c, anim: 0 }; const n = seq('Pull-' + c + '-Cat').length;
            const iv = setInterval(() => { pull.anim++; paint(); if (pull.anim >= n + 8) { clearInterval(iv); S.cats = [...new Set([...(S.cats || []), c])]; S.cat = c; S.pullDay = today(); save(); pull = null; paint(); } }, 120);
            return paint();
          }
          return;
        }
        const h = shopAt(p); if (h?.tab) { stab = h.tab; return paint(); }
        if (h?.it) { if (h.it.locked) { tip(T('會員限定', 'Members only'), e); return; } h.it.act(); return paint(); }
      } else if (page === 'keys') {
        const o = keyAt(p); if (o) { keyWait = o; return paint(); }
      } else if (page === 'noise') {
        for (const [k] of NOISE) if (nearSlider(NS[k], p)) { slide = [NS[k], k]; setVal(k, fromSlider(NS[k], p)); C.setPointerCapture(e.pointerId); return paint(); }
      } else if (page === 'music') {
        const tb = tabAt(p); if (tb) return paint();
        const fl = box(L('Music-Page', 'Floor')); if (fl && p.x >= fl.l - 3) { mpage = allRows().length > 4 ? (mpage + 1) % 2 : 0; return paint(); }
        const n = rowAt(p); if (n !== null) { const r = rows()[n]; if (r.noise) { S.noise[r.noise] = r.on ? 0 : 0.5; save(); } else bc.postMessage({ t: 'cmd', op: r.on ? 'pause' : 'pick', i: r.i }); return paint(); }
      }
      // empty space drags the window
      pdrag = { sx: e.screenX, sy: e.screenY, wx: window.screenX, wy: window.screenY }; C.setPointerCapture(e.pointerId);
    });
    let lastE = null;
    const reHover = () => { if (lastE && !slide && !pdrag) setTimeout(() => onMove(lastE), 30); };
    C.addEventListener('pointermove', (e) => { lastE = e; onMove(e); });
    function onMove(e) {
      const p = pos(e, s);
      if (slide) { setVal(slide[1], fromSlider(slide[0], p)); return paint(); }
      if (pdrag) return D('move', { x: Math.round(pdrag.wx + e.screenX - pdrag.sx), y: Math.round(pdrag.wy + e.screenY - pdrag.sy) });
      const h = page === 'home' ? Object.keys(HOME).find((x) => inBox(homeArt(x, false), p.x, p.y, 2)) || null : null;
      const labels = { settings: ['設定', 'Settings'], noise: ['白噪音', 'Noise'], music: ['音樂', 'Music'], shop: ['商店', 'Shop'] };
      const d = dot(p), dl = { Red: ['關閉', 'Close'], Yellow: ['縮小', 'Hide'], Green: ['回主頁', 'Home'] };
      let lab = h ? T(...labels[h]) : d ? T(...dl[d]) : '';
      if (page === 'keys') { const o = keyAt(p); if (o !== keyHover) { keyHover = o; paint(); } }
      if (page === 'shop' && !pull) { const h = shopAt(p); if ((h?.tab || h?.id || null) !== (shopHover?.tab || shopHover?.id || null)) { shopHover = h; paint(); } if (!lab && h?.tab) lab = [T('食物', 'Food'), T('掛件', 'Accessory'), T('貓咪', 'Cats'), T('敬請期待', 'Soon')][h.tab - 1]; if (!lab && h?.it) lab = h.it.locked ? T('會員限定', 'Members only') : h.it.lab; }
      if (page === 'shop' && pull && !lab) { if (inBox(L('Shop-Page', 'Pull', 'Yes'), p.x, p.y, 2) || inBox(L('Shop-Page', 'Pull', 'Pull'), p.x, p.y, 2)) lab = T('抽貓咪', 'Draw'); if (inBox(L('Shop-Page', 'Pull', 'No'), p.x, p.y, 2)) lab = T('取消', 'Cancel'); }
      if (!lab && page === 'settings') { for (const k of ['vol', 'scale']) if (nearSlider(SL[k], p)) lab = k === 'vol' ? T('音樂音量', 'Volume') : T('桌寵大小', 'Size'); for (const [k, n, a1, b1] of tog()) if (inBox(L('Setting-Page', n, 'Green'), p.x, p.y, 3)) lab = (S[k] ? T('關閉', 'Off') : T('開啟', 'On')); if (inBox(L('Setting-Page', 'Key'), p.x, p.y)) lab = T('打開', 'Open'); }
      if (page === 'music') { const tb = tabAt(p), n = rowAt(p); if (tb !== hoverTab || n !== hoverRow) { hoverTab = tb; hoverRow = n; paint(); } if (!lab && tb) lab = [T('音樂', 'Music'), T('敬請期待', 'Soon'), T('敬請期待', 'Soon'), T('敬請期待', 'Soon')][tb - 1]; if (!lab && n !== null) lab = rows()[n].on ? T('暫停', 'Pause') : T('播放', 'Play'); }
      if (!lab && page === 'noise') for (const [k, , a1, b1] of NOISE) if (nearSlider(NS[k], p)) lab = T(a1, b1);
      if (!lab && page === 'home') { const ml = { play: [mstate.playing ? '暫停' : '播放', mstate.playing ? 'Pause' : 'Play'], prev: ['上一首', 'Back'], next: ['下一首', 'Next'], mode: [{ loop: '順序', single: '單曲', shuffle: '隨機' }[S.mode], { loop: 'Order', single: 'Repeat', shuffle: 'Shuffle' }[S.mode]] }; if (mstate.active) for (const k of Object.keys(ml)) if (inBox(ML[k](), p.x, p.y)) lab = T(...ml[k]); }
      tip(lab, e);
      if (h !== hover) { hover = h; paint(); }
    }
    C.addEventListener('pointerup', () => { if (slide?.[1] === 'scale') save(); slide = null; pdrag = null; reHover(); });
    C.addEventListener('pointerleave', () => { lastE = null; tip(''); });
    C.addEventListener('contextmenu', (e) => e.preventDefault());
    bc.onmessage = ({ data: m }) => { if (m.t === 'state') S = load(); if (m.t === 'music') { const was = mstate.playing; mstate = m; if (was !== m.playing) reHover(); } if (m.t === 'state') reHover(); paint(); };
    bc.postMessage({ t: 'cmd', op: 'ask' });
    setInterval(() => { anim++; if (page === 'home') paint(); }, 400);
    paint();
  }

  // ================================================================ the notebook (Book art, 128×128)
  function bookView() {
    const s = 3, TOP = 40; size(128, 128, s); C.style.marginTop = TOP * s + 'px'; TXT.style.top = TOP * s + 'px'; tipTop = TOP * s; tipS = s;
    let thru = null; document.addEventListener('pointermove', (e) => { const v = e.target !== C; if (v !== thru) { thru = v; D('through', { on: v }); } });
    let tab = 1, hover = null, bdrag = null, lastE = null, day = new Date(), todos = [], noteText = '', adding = false, accPage = 0;
    const B = (...p) => one(...p), F1 = (...p) => one('Book-First-Page', ...p), F2 = (...p) => one('Book-Second-Page', ...p), F3 = (...p) => one('Book-Third-Page', ...p);
    const dayKey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const ask = () => bc.postMessage({ t: 'todo', op: 'list', day: dayKey(day) });
    const skins = () => Object.keys(SKINS);
    const stepSkin = (d) => { const all = skins(); let i = all.indexOf(okSkin(S.skin)); for (let n = 0; n < all.length; n++) { i = (i + d + all.length) % all.length; if (!SKINS[all[i]].dlc || unlocked()) break; } S.skin = all[i]; save(); };
    const portrait = () => ({ jeli: F1('Left', 'Skin', 'jELi'), jeli2: F1('Left', 'Skin', 'jELi'), peach: F1('Left', 'Skin', 'DLC', 'Cake'), matcha: F1('Left', 'Skin', 'DLC', 'Matcha') }[okSkin(S.skin)] || F1('Left', 'Skin', 'jELi'));
    const NOTES = { zh: ['今天也很棒喔！', '記得喝水～', '沐水一直都在 ♡', '慢慢來就好', '你辛苦了～', '休息一下吧', '明天會更好的！', '有我陪你 (｡•ᴗ•｡)'], en: ['You did great today!', 'Drink some water~', 'Mizuki is always here ♡', 'Take it slow', 'You worked hard~', 'Take a little break', 'Tomorrow will be better!', 'I am with you (｡•ᴗ•｡)'] };
    const ACCGRID = [['jellyfish', 0], ['angel', 1], ['devil', 2], ['bow', 3], ['cat', 4], ['scarf', 5]];
    const cell = (i) => ({ l: i % 2 ? 101 : 83, t: [43, 68, 94][Math.floor(i / 2)], r: i % 2 ? 116 : 98, b: [63, 88, 114][Math.floor(i / 2)] });
    const at = (b, p, pad = 1) => b && p.x >= b.l - pad && p.x <= b.r + pad && p.y >= b.t - pad && p.y <= b.b + pad;
    function paint() {
      X.clearRect(0, 0, 128, 128); X.imageSmoothingEnabled = false;
      for (const id of [...TXT.children].map((x) => x.id.slice(2))) if (!id.startsWith('b' + tab)) text(id, '', 0, 0, 0, s);
      draw(B('Book', 'Floor'));
      for (const k of [1, 2, 3]) draw(B('Book', String(k), tab === k || hover === 'tab' + k ? 'Press' : 'Normal'));
      draw(B('Book', 'Close'));
      const lv = Math.floor((S.xp || 0) / 100) + 1, days = Math.max(1, Math.ceil((Date.now() - (S.since || Date.now())) / 86400000));
      if (tab === 1) {
        draw(F1('Left', 'Left-Floor')); draw(F1('Left', 'Skin-Floor')); draw(portrait());
        if (SKINS[okSkin(S.skin)].dlc && !unlocked()) { draw(F1('Left', 'Lock-Skin')); draw(F1('Left', 'Lock')); }
        draw(F1('Left', 'Next', hover === 'next' ? 'Large' : 'Small')); draw(F1('Left', 'Previous', hover === 'prev' ? 'Large' : 'Small'));
        const sk = SKINS[okSkin(S.skin)];
        text('b1-name', T(sk.zh, sk.en), 12, 72, 48, s, 6, 0, 'center');
        text('b1-a', 'Lv.' + lv, 22, 86.5, 40, s, 5.5); text('b1-b', T('餵食 ' + (S.feeds || 0) + ' 次', 'Fed ' + (S.feeds || 0)), 22, 95.5, 40, s, 5.5); text('b1-c', T('陪伴 ' + days + ' 天', days + ' days'), 22, 105.5, 40, s, 5.5);
        draw(F1('Right', 'Floor'));
        const xpf = Math.floor(((S.xp || 0) % 100) / 10); if (xpf > 0) draw(F1('Right', 'XP-Bar', String(xpf)));
        text('b1-xp', (S.xp || 0) % 100 + ' / 100', 84, 54.5, 30, s, 5, 0, 'center');
        // weekly surprise picture: shows more with every meal this week (20 % per meal)
        const pics = ['Bow', 'Thigh-Ring', 'Choker', 'Jellyfish'], pic = pics[Math.abs([...weekKey()].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 4];
        const n = S.week === weekKey() ? Math.min(5, S.weekFeeds || 0) : 0; if (n) draw(F1('Right', 'Blind', pic, String(n * 20)));
      } else if (tab === 2) {
        draw(F2('Left', 'Line')); draw(F2('Left', 'Next', hover === 'dnext' ? 'Large' : 'Small')); draw(F2('Left', 'Previous', hover === 'dprev' ? 'Large' : 'Small'));
        const isToday = dayKey(day) === dayKey(new Date());
        text('b2-date', (day.getMonth() + 1) + ' / ' + day.getDate(), 20, 36, 30, s, 6, 0, 'center');
        if (isToday) draw(F2('Left', 'Today'));
        text('b2-day', T(isToday ? '今天' : '日' + '一二三四五六'[day.getDay()] && '週' + '日一二三四五六'[day.getDay()], isToday ? 'Today' : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getDay()]), 18, 53, 30, s, 5.5);
        text('b2-count', T('待辦 ' + todos.filter((x) => !x.done).length + ' 件', todos.filter((x) => !x.done).length + ' to do'), 12, 66, 44, s, 5.5, 0, 'center');
        draw(F2('Right', 'Floor')); draw(F2('Right', 'Plus-Press', adding || hover === 'plus' ? '2' : '1'));
        todos.slice(0, 3).forEach((it, i) => { draw(F2('Right', 'Line'), 0, i * 9); text('b2-t' + i, (it.done ? '✓ ' : '') + it.title, 84, 45 + i * 9, 32, s, 5); const el = document.getElementById('t-b2-t' + i); if (el) el.style.color = it.done ? '#c9aee6' : hover === 'row' + i ? '#9b5fd6' : '#7f45ba'; });
        for (let i = todos.slice(0, 3).length; i < 3; i++) text('b2-t' + i, !todos.length && i === 0 ? T('沒有待辦', 'Nothing to do') : '', 84, 45, 32, s, 5);
        draw(F2('Right', 'Note-Press', hover === 'note' ? '2' : '1'));
        if (noteText) { draw(F2('Right', 'Note')); text('b2-note', noteText, 85, 82, 28, s, 5, 18, 'center'); } else text('b2-note', '', 0, 0, 0, s);
      } else {
        draw(F3('Left', 'Floor')); draw(F3('Right', 'Floor')); draw(F3('Right', 'Line'));
        const k = okSkin(S.skin), dlc = { peach: 'Skin-Cake', matcha: 'Skin-Matcha' }[k];
        if (dlc) { const f = seq('Book-Third-Page', 'Left', 'DLC', dlc); draw(f[Math.floor(Date.now() / 200) % f.length]); }
        else { const f = seq(SKINS[k].idle), im = img(f[Math.floor(Date.now() / 67) % f.length]); X.drawImage(im, 0, 0, 64, 64, 6, 66, 52, 52); }
        if (!dlc) text('b3-name', T(SKINS[k].zh, SKINS[k].en), 12, 46, 44, s, 6, 0, 'center'); else text('b3-name', '', 0, 0, 0, s);
        if (SKINS[k].dlc && !unlocked()) { draw(F3('Left', 'Lock-Skin')); draw(F3('Left', 'Lock')); }
        draw(F3('Left', 'Previous', hover === 'sprev' ? 'Large' : 'Small')); draw(F3('Left', 'Next', hover === 'snext' ? 'Large' : 'Small'));
        draw(F3('Right', 'Accessory')); draw(F3('Right', 'Accessory-DLC', unlocked() ? '100' : '20'));
        X.strokeStyle = '#7f45ba'; X.lineWidth = 1;
        ACCGRID.forEach(([a], i) => { const c = cell(i); if (S.acc === a) X.strokeRect(c.l - 1.5, c.t - 1.5, c.r - c.l + 3, c.b - c.t + 3); });
      }
    }
    const hitAt = (p) => {
      if (inBox(B('Book', 'Close'), p.x, p.y, 1)) return 'close';
      for (const k of [1, 2, 3]) if (inBox(B('Book', String(k), 'Normal'), p.x, p.y, 1)) return 'tab' + k;
      if (tab === 1) { if (inBox(F1('Left', 'Next', 'Large'), p.x, p.y, 2)) return 'next'; if (inBox(F1('Left', 'Previous', 'Large'), p.x, p.y, 2)) return 'prev'; if (inBox(portrait(), p.x, p.y, 0)) return 'card'; }
      if (tab === 2) { if (inBox(F2('Left', 'Next', 'Large'), p.x, p.y, 2)) return 'dnext'; if (inBox(F2('Left', 'Previous', 'Large'), p.x, p.y, 2)) return 'dprev'; if (inBox(F2('Right', 'Plus-Press', '1'), p.x, p.y, 1)) return 'plus'; if (inBox(F2('Right', 'Note-Press', '1'), p.x, p.y, 1)) return 'note'; for (let i = 0; i < Math.min(3, todos.length); i++) if (p.x >= 80 && p.x <= 118 && p.y >= 44 + i * 9 && p.y < 53 + i * 9) return 'row' + i; }
      if (tab === 3) { if (inBox(F3('Left', 'Next', 'Large'), p.x, p.y, 2)) return 'snext'; if (inBox(F3('Left', 'Previous', 'Large'), p.x, p.y, 2)) return 'sprev'; for (let i = 0; i < 6; i++) if (at(cell(i), p)) return 'acc' + i; }
      return null;
    };
    const label = (h) => {
      if (!h) return '';
      if (h === 'close') return T('關閉', 'Close'); if (h.startsWith('tab')) return [T('資料', 'Profile'), T('待辦', 'To-do'), T('收藏', 'Collection')][h[3] - 1];
      if (h === 'next' || h === 'snext') return T('下一個', 'Next'); if (h === 'prev' || h === 'sprev') return T('上一個', 'Back');
      if (h === 'dnext') return T('明天', 'Next day'); if (h === 'dprev') return T('昨天', 'Day before');
      if (h === 'plus') return T('新增待辦', 'Add'); if (h === 'note') return T('抽紙條', 'A note');
      if (h === 'card') return T(SKINS[okSkin(S.skin)].zh, SKINS[okSkin(S.skin)].en);
      if (h.startsWith('row')) return todos[+h[3]]?.done ? T('取消完成', 'Undo') : T('完成', 'Done');
      if (h.startsWith('acc')) { const a = ACCGRID[+h[3]][0]; return ACCS[a].dlc && !unlocked() ? T('會員限定', 'Members only') : T(ACCS[a].zh, ACCS[a].en); }
      return '';
    };
    const onMove = (e) => { const p = pos(e, s); if (bdrag) return D('move', { x: Math.round(bdrag.wx + e.screenX - bdrag.sx), y: Math.round(bdrag.wy + e.screenY - bdrag.sy) }); const h = hitAt(p); if (h !== hover) { hover = h; paint(); } tip(label(h), e); };
    C.addEventListener('pointermove', (e) => { lastE = e; onMove(e); });
    C.addEventListener('pointerleave', () => { lastE = null; hover = null; tip(''); paint(); });
    C.addEventListener('auxclick', (e) => e.preventDefault());
    C.addEventListener('contextmenu', (e) => e.preventDefault());
    C.addEventListener('pointerdown', (e) => {
      if (e.button === 3 || e.button === 4) { e.preventDefault(); tab = Math.max(1, Math.min(3, tab + (e.button === 3 ? -1 : 1))); paint(); return; } // side buttons: page back / forward
      if (e.button !== 0) return;
      const h = hitAt(pos(e, s));
      if (!h) { bdrag = { sx: e.screenX, sy: e.screenY, wx: window.screenX, wy: window.screenY }; C.setPointerCapture(e.pointerId); return; }
      if (h === 'close') return D('bookClose');
      if (h.startsWith('tab')) { tab = +h[3]; if (tab === 2) ask(); }
      if (h === 'next' || h === 'snext') stepSkin(1); if (h === 'prev' || h === 'sprev') stepSkin(-1);
      if (h === 'dnext' || h === 'dprev') { day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + (h === 'dnext' ? 1 : -1)); ask(); }
      if (h === 'note') noteText = rnd(NOTES[zh() ? 'zh' : 'en']);
      if (h === 'plus') { adding = true; const inp = document.createElement('input'); Object.assign(inp.style, { position: 'fixed', left: 82 * s + 'px', top: (TOP + 29) * s + 'px', width: 32 * s + 'px', height: 12 * s + 'px', font: 5 * s + 'px mzPetPixel', color: '#7f45ba', background: '#fbf6ff', border: '0', outline: '0', padding: '0 4px' }); inp.placeholder = T('寫下待辦', 'New to-do'); document.body.appendChild(inp); inp.focus();
        const done = (ok) => { if (ok && inp.value.trim()) bc.postMessage({ t: 'todo', op: 'add', day: dayKey(day), title: inp.value }); inp.remove(); adding = false; paint(); };
        inp.addEventListener('keydown', (k) => { if (k.key === 'Enter' && !k.isComposing) done(true); if (k.key === 'Escape') done(false); }); inp.addEventListener('blur', () => done(true)); }
      if (h.startsWith('row')) bc.postMessage({ t: 'todo', op: 'toggle', day: dayKey(day), id: todos[+h[3]]?.id });
      if (h.startsWith('acc')) { const a = ACCGRID[+h[3]][0]; if (ACCS[a].dlc && !unlocked()) return tip(T('會員限定', 'Members only'), e); S.acc = S.acc === a ? null : a; save(); }
      paint(); if (lastE) setTimeout(() => lastE && onMove(lastE), 30);
    });
    C.addEventListener('pointerup', () => { bdrag = null; });
    bc.onmessage = ({ data: m }) => { if (m.t === 'state') S = load(); if (m.t === 'todos' && m.day === dayKey(day)) todos = m.items || []; paint(); };
    ask(); setInterval(() => { if (tab === 3) paint(); }, 100); paint();
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
      items.push(null);
      if (petOn) items.push(['page', T('桌寵設定', 'Pet settings')], ['book', T('本子', 'Notebook')], ['mode', S.play ? T('切換成陪伴模式', 'Companion mode') : T('切換成鍵盤模式', 'Keyboard mode')], ['petClose', T('關閉桌寵', 'Close the pet')]);
      else items.push(['petOpen', T('打開桌寵', 'Open the pet')]);
      items.push(null, ['quit', T('完全退出', 'Quit')]);
      m.innerHTML = `<b>${name}</b><hr>` + items.map((x) => (x ? `<button data-k="${x[0]}">${x[1]}</button>` : '<hr>')).join('');
      await D('menuSize', { h: m.offsetHeight + 8 });
      return m.offsetHeight + 8;
    };
    m.addEventListener('click', async (e) => {
      const k = e.target.closest('button')?.dataset.k; if (!k) return;
      if (k === 'petOpen') await D('open');
      if (k === 'mode') bc.postMessage({ t: 'cmd', op: 'mode' });
      if (k === 'book') bc.postMessage({ t: 'cmd', op: 'act', k: 'book' });
      D('menuPick', { k });
    });
    window.mzPetMenuRefresh = build;
    build();
  }
})();
