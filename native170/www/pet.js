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
    cats: [], cat: null, pullDay: '', ownSkins: [], ownAccs: [], surprise: null, surpriseWeek: '', note: null, xp: 0, feeds: 0, week: '', weekFeeds: 0, since: Date.now(),
    keys: { top1: 'w', top2: 'a', top3: 's', top4: 'd', mid1: '1', mid2: '2', mid3: '3', mid4: 'shift', bottom1: 'esc', bottom2: 'space', bottom3: 'backspace' }, play: false };
  const load = () => { try { return { ...DEF, ...JSON.parse(localStorage.getItem('mz-pet') || '{}') }; } catch { return { ...DEF }; } };
  let S = load();
  const save = () => { try { localStorage.setItem('mz-pet', JSON.stringify(S)); } catch {} bc.postMessage({ t: 'state' }); };
  const zh = () => S.lang !== 'en';
  const T = (a, b) => (zh() ? a : b);
  // DLC: members + unlimited accounts (the main app writes mz-pet-unlock from /v1/ai-limits)
  const unlocked = () => { try { return localStorage.getItem('mz-pet-unlock') === '1'; } catch { return false; } };
  // prices in 沐水幣 (everyone pays, members too). FREE_TEST: the user tests first, nothing is taken yet.
  const FREE_TEST = true, PRICE = { skin: 78000, acc: 27000, food: 2000, pull: 7000 }, money = (n) => Number(n).toLocaleString();
  const coins = () => { try { return Number(localStorage.getItem('mz-coins') || 0) || 0; } catch { return 0; } };
  const owns = (kind, k) => kind === 'skin' ? !SKINS[k]?.dlc || (S.ownSkins || []).includes(k) : !ACCS[k]?.dlc || (S.ownAccs || []).includes(k);
  const pay = (n) => { if (FREE_TEST) return true; if (coins() < n) return false; bc.postMessage({ t: 'spend', n }); return true; };

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
    jellyfish: { psd: 'Accessory-Jellyfish', zh: '水母', en: 'Jellyfish' }, angel: { psd: 'Accessory-Angel', zh: '天使光環', en: 'Halo', dlc: true },
    devil: { psd: 'Accessory-Devil', zh: '惡魔', en: 'Devil', dlc: true }, bow: { psd: 'Accessory-Bow-DLC', zh: '蝴蝶結', en: 'Bow', dlc: true },
    cat: { psd: 'Accessory-Cat-Ears-DLC', zh: '貓耳', en: 'Cat ears', dlc: true }, scarf: { psd: 'Accessory-Scarf-DLC', zh: '圍巾', en: 'Scarf', dlc: true },
  };
  const FOODS = [['Free', 'Takoyaki', 'Food-Takoyaki', 0, '章魚燒', 'Takoyaki'], ['Free', 'MatchaBBT', 'Food-MatchaBBT', 0, '抹茶珍奶', 'Matcha bubble tea'], ['Free', 'Peach', 'Food-Peach', 0, '水蜜桃', 'Peach'], ['Free', 'Lemon', 'Food-Lemon', 0, '檸檬', 'Lemon'],
    ['Buy', 'Cookie', 'Food-Cookie-Buy', 1, '餅乾', 'Cookie'], ['Buy', 'Hamburger', 'Food-Hamburger-Buy', 1, '漢堡', 'Burger'], ['Buy', 'Mint-Chocolate-Ice-Cream', 'Food-Mint-Chocolate-Ice-Cream-Buy', 1, '薄荷冰淇淋', 'Mint ice'], ['Buy', 'Chocolate-Cake', 'Food-Chocolate-Cake-Buy', 1, '巧克力蛋糕', 'Choco cake'], [null, 'Udon', 'Food-Udon-DLC', 1, '烏龍麵', 'Udon']];
  const CATS = { A: ['黑白貓', 'Tux cat'], B: ['白貓', 'White cat'], C: ['灰貓', 'Grey cat'] };
  const weekKey = () => { const d = new Date(), j = new Date(d.getFullYear(), 0, 1); return d.getFullYear() + '-' + Math.floor(((d - j) / 86400000 + j.getDay()) / 7); };
  const okSkin = (k) => SKINS[k] && owns('skin', k) ? k : 'jeli';
  const okAcc = (k) => (k && ACCS[k] && owns('acc', k) ? k : null);
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
  const keep = (el, str) => { el.textContent = ''; for (const part of String(str).split(/([(（][^()（）]{1,16}[)）]|\d[\d,]*)/)) { if (!part) continue; if (/^[(（].*[)）]$|^\d[\d,]*$/.test(part)) { const sp = document.createElement('span'); sp.style.whiteSpace = 'nowrap'; sp.style.display = 'inline-block'; sp.textContent = part; el.appendChild(sp); } else el.appendChild(document.createTextNode(part)); } };
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

  // the petting hand is a page element that follows the pointer every move (smooth, not tied to the 67 ms frames)
  const HAND = Object.assign(document.createElement('img'), { src: 'pet/img/' + one('Hand', '1') + '.png' }); Object.assign(HAND.style, { position: 'fixed', pointerEvents: 'none', imageRendering: 'pixelated', display: 'none', zIndex: 5 }); document.body.appendChild(HAND);
  const HB = box(one('Hand', '1')) || { l: 0, t: 0, r: 21, b: 21 };
  const handAt = (e, s) => { document.body.classList.add('hand'); Object.assign(HAND.style, { display: 'block', width: 22 * s + 'px', height: 22 * s + 'px', transform: `translate(${e.clientX - ((HB.l + HB.r) / 2) * s}px, ${e.clientY - ((HB.t + HB.b) / 2) * s}px)`, left: '0', top: '0' }); };
  const handOff = () => { document.body.classList.remove('hand'); HAND.style.display = 'none'; };
  window.mzPetTip = tip;
  if (VIEW === 'pet') return petView();
  if (VIEW === 'page') return pageView();
  if (VIEW === 'menu') return menuView();
  if (VIEW === 'book') return bookView();
  if (VIEW === 'cat') return catView();

  // ================================================================ the pet
  function petView() {
    const FW = (() => { const b = box(one('Time', 'Stopwatch', 'Floor')); return b ? b.r - b.l + 1 : 36; })();
    const PX = Math.max(40, FW + 5), PY = 40, CW = PX + 72, CH = 124; // pet 64×64 at (40,40); bubble above; stopwatch on her left; cat on her right; clock under her
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
    // which part of the clock / stopwatch is under the pointer
    const watchPart = (p) => {
      if (!S.time) return null;
      if (clockMode === 'clock') { const h = one('Time', 'Clock'), b = box(h); return b && inBox(h, p.x - clockOff(b).x, p.y - clockOff(b).y, 1) ? 'clock' : null; }
      const fl = one('Time', 'Stopwatch', 'Floor'), b = box(fl); if (!b) return null; const o = watchOff(b), x = p.x - o.x, y = p.y - o.y;
      if (inBox(one('Time', 'Stopwatch', 'Stopwatch', 'Normal'), x, y, 2)) return 'up';
      if (inBox(one('Time', 'Stopwatch', 'Timer', 'Normal'), x, y, 2)) return 'down';
      return inBox(fl, x, y, 1) ? 'digits' : null;
    };
    const watchLabel = (k) => ({ clock: T('點一下：碼錶', 'Click: stopwatch'), up: watch.run ? T('左鍵暫停｜右鍵歸零', 'Left: pause | Right: reset') : T('計時：左鍵開始｜右鍵歸零', 'Count up: left start | right reset'),
      down: timer.run ? T('左鍵暫停', 'Left: pause') : T('倒數：左鍵開始', 'Countdown: left start'), digits: T('右鍵 +5 分｜左鍵 −5 分｜雙擊回時鐘', 'Right +5 min | Left −5 min | Double-click: clock') }[k] || '');
    const watchHit = (p, e) => {
      const k = watchPart(p); if (!k) return false;
      if (k === 'clock') { if (e.button === 0) clockMode = 'watch'; return true; }
      if (k === 'up') { if (e.button === 2) { watch = { run: false, at: 0, acc: 0 }; } else if (e.button === 0) { if (watch.run) { watch.acc += Date.now() - watch.at; watch.run = false; } else { watch.run = true; watch.at = Date.now(); timer.run = false; } } }
      if (k === 'down' && e.button === 0) { if (timer.run) { timer.left = (timer.end - Date.now()) / 1000; timer.run = false; } else if (timer.left > 0) { timer.run = true; timer.end = Date.now() + timer.left * 1000; watch.run = false; watch.acc = 0; } }
      if (k === 'digits' && !timer.run && !watch.run) { if (e.button === 2) timer.left = Math.min(180 * 60, timer.left + 300); else if (e.button === 0) { if (e.detail >= 2) { clockMode = 'clock'; return true; } timer.left = Math.max(0, timer.left - 300); } watch.acc = 0; }
      else if (k === 'digits' && e.button === 0 && e.detail >= 2) clockMode = 'clock';
      tip(watchLabel(k), e); return true;
    };
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
      if (S.time) {
        if (clockMode === 'clock') { const h = one('Time', 'Clock'), b = box(h); if (b) { const o = clockOff(b); draw(h, o.x, o.y); const d = new Date(); split('clock', String(d.getHours()).padStart(2, '0'), String(d.getMinutes()).padStart(2, '0'), b, o, 6); } }
        else { const h = one('Time', 'Stopwatch', 'Floor'), b = box(h); if (b) { const o = watchOff(b); draw(h, o.x, o.y); draw(one('Time', 'Stopwatch', 'Stopwatch', watch.run ? 'Press' : 'Normal'), o.x, o.y); draw(one('Time', 'Stopwatch', 'Timer', timer.run ? 'Press' : 'Normal'), o.x, o.y);
          const sec = Math.max(0, Math.floor(timer.run ? (timer.end - Date.now()) / 1000 : watch.run || watch.acc ? (watch.acc + (watch.run ? Date.now() - watch.at : 0)) / 1000 : timer.left));
          split('clock', String(Math.floor(sec / 60)).padStart(2, '0'), String(sec % 60).padStart(2, '0'), b, o, 8); } }
      } else { text('clocka', '', 0, 0, 0, s); text('clockb', '', 0, 0, 0, s); }
    }
    const stopPet = () => { if (!hair) return; hair = false; back = []; for (let i = petF ?? 0; i >= 0; i--) back.push(i); if (heart) heartEnd = true; handOff(); };
    const opaque = (x, y) => { if (x < 0 || y < 0 || x >= CW || y >= CH) return false; try { return X.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3] > 10; } catch { return true; } };
    const setThrough = (v) => { if (through === v) return; through = v; D('through', { on: v }); };

    C.addEventListener('contextmenu', (e) => e.preventDefault());
    C.addEventListener('pointerdown', (e) => {
      const p = pos(e, s);
      if (!menu && watchHit(p, e)) return;
      if (menu) { const hit = Object.keys(menuItems).find((k) => inBox(menuItems[k], p.x - PX, p.y - PY, 4)); menu = false; tip(''); if (e.button <= 2 && hit) act(hit); return; }
      if (e.button === 2) { menu = true; menuF = 0; menuHover = null; return; }
      if (e.button !== 0) return;
      C.setPointerCapture(e.pointerId);
      clickOk = true; pressAt = now(); revs = 0; dir = 0; anchorX = e.screenX;
      if (!S.play && p.y - PY < 23 && p.y >= PY - 2) { hair = true; hairAt = now(); back = []; mouse = p; handAt(e, s); return; }
      drag = { sx: e.screenX, sy: e.screenY, wx: window.screenX, wy: window.screenY };
    });
    C.addEventListener('pointermove', (e) => {
      const p = pos(e, s); mouse = p; if (hair) handAt(e, s);
      if (menu) { const hit = Object.keys(menuItems).find((k) => inBox(menuItems[k], p.x - PX, p.y - PY, 4)); menuHover = hit; tip(hit ? T(...menuLabel[hit]) : '', e); }
      else if (!drag && !hair) { const k = watchPart(p); if (k) tip(watchLabel(k), e); else if (TIP.style.display === 'block' && !menu) tip(''); }
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
      if (m.t === 'state') { const old = S; S = load(); if (S.cat !== old.cat) D('cat', { on: !!(S.cat && (S.cats || []).includes(S.cat)) }); if (S.scale !== old.scale) { s = S.scale; tipS = s; size(CW, CH, s); D('size', { w: Math.round(CW * s), h: Math.round(CH * s) }); } if (S.top !== old.top) D('top', { on: S.top }); applyAudio(); }
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
    D('size', { w: CW * s, h: CH * s }); D('top', { on: S.top }); D('cat', { on: !!(S.cat && (S.cats || []).includes(S.cat)) });
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
    // shop: 1 food (top four free; others open the Buy-Food card), 2 accessories, 3 your cats, 4 cat draw (7000)
    let stab = 1, shopHover = null, pull = null, buy = null, pullAnim = null;
    const money = (n) => Number(n).toLocaleString();
    const FREE4 = 4;
    const shopItems = () => {
      if (stab === 1) return FOODS.map(([g, n, psd, , zh1, en1], i) => ({ id: n, path: g ? ['Food', g, n] : ['Food', n], lab: T(zh1, en1) + (i >= FREE4 ? '\n' + money(PRICE.food) : ''), act: () => { if (i < FREE4) bc.postMessage({ t: 'feed', psd }); else buy = { food: i }; } }));
      if (stab === 2) return [['Free', 'Jellyfish', 'jellyfish'], ['Free', 'Angel', 'angel'], ['Free', 'Devil', 'devil'], ['DLC', 'Bow', 'bow'], ['DLC', 'Cat-Ears', 'cat'], ['DLC', 'Scarf', 'scarf']].map(([g, n, k]) => ({ id: n, path: ['Accessory', g, n], lit: S.acc === k, lab: T(ACCS[k].zh, ACCS[k].en) + (owns('acc', k) ? '' : '\n' + money(PRICE.acc)),
        act: () => { if (!owns('acc', k)) { if (!pay(PRICE.acc)) return say(T('沐水幣不夠喔', 'Not enough coins')); S.ownAccs = [...new Set([...(S.ownAccs || []), k])]; } S.acc = S.acc === k ? null : k; save(); } }));
      if (stab === 3) return ['A', 'B', 'C'].filter((c) => (S.cats || []).includes(c)).map((c) => ({ id: c, path: ['Accessory', 'Pull', c + '-Cat'], dy: catDy(), lit: S.cat === c, lab: T(...CATS[c]), act: () => { S.cat = S.cat === c ? null : c; save(); } }));
      return [];
    };
    const catDy = () => { const a = box(L('Shop-Page', 'Accessory', 'Free', 'Jellyfish', '100')), b = box(L('Shop-Page', 'Accessory', 'Pull', 'A-Cat', '100')); return a && b ? a.t - b.t : 0; }; // cats sit on the first row
    const say = (str) => tip(str, lastE || { clientX: 192, clientY: 160 });
    const itemAt = (p) => shopItems().find((x) => inBox(L('Shop-Page', ...x.path, '100'), p.x, p.y - (x.dy || 0), 2));
    const shopAt = (p) => { const tb = [1, 2, 3, 4].find((k) => inBox(L('Shop-Page', 'Menu', String(k), '100'), p.x, p.y, 2)); if (tb) return { tab: tb }; const it = itemAt(p); return it ? { id: it.id, it } : null; };
    const BUYF = FOODS.slice(FREE4, FREE4 + 4); // the four foods on the Buy-Food card
    const pullPart = (p) => ['Pull', 'No', 'Yes', 'Money'].find((n) => inBox(L('Shop-Page', 'Pull', n), p.x, p.y, 1));
    const buyPart = (p) => { for (let i = 0; i < 4; i++) if (inBox(L('Shop-Page', 'Buy-Food', 'Choose-Food', BUYF[i][1], 'Large'), p.x, p.y, 1)) return 'f' + i; return ['No', 'Yes'].find((n) => inBox(L('Shop-Page', 'Buy-Food', n), p.x, p.y, 1)); };
    const barText = (id, str, layer, px = 5) => { const b = box(layer); if (b) text(id, str, b.l + 1, b.t + (b.b - b.t) / 2 - px * 0.62, b.r - b.l - 1, s, px, 0, 'center'); };
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
        const ids = [];
        if (buy) {
          const BF = ['Shop-Page', 'Buy-Food']; draw(L(...BF, 'Choose')); draw(L(...BF, 'Floor')); draw(L(...BF, 'Slider1'));
          BUYF.forEach(([, n], i) => draw(L(...BF, 'Choose-Food', n, buy.food === FREE4 + i || shopHover?.id === 'f' + i ? 'Large' : 'Small')));
          draw(L(...BF, 'Money')); draw(L(...BF, 'No')); draw(L(...BF, 'Yes'));
          const mb = box(L(...BF, 'Money')); if (mb) { text('shop-money', coins() >= 10000 ? (coins() / 1000).toFixed(1).replace(/.0$/, '') + 'k' : money(coins()), mb.l + 2, mb.t + (mb.b - mb.t) / 2 - 2.8, mb.r - mb.l - 16, s, 4.6, 0, 'right'); ids.push('shop-money'); }
          barText('shop-no', T('取消', 'No'), L(...BF, 'No')); barText('shop-yes', money(PRICE.food), L(...BF, 'Yes'), 4.5); ids.push('shop-no', 'shop-yes');
        } else if (stab === 4) {
          draw(L('Shop-Page', 'Pull', 'Floor'));
          if (pullAnim) { const f = seq('Pull-' + pullAnim.cat + '-Cat'), fb = box(L('Shop-Page', 'Pull', 'Floor')); if (fb) draw(f[Math.min(pullAnim.i, f.length - 1)], Math.round((fb.l + fb.r) / 2 - 16 + (pullAnim.i < 4 ? (pullAnim.i % 2 ? 1 : -1) : 0)), Math.round((fb.t + fb.b) / 2 - 16)); }
          draw(L('Shop-Page', 'Pull', 'Pull')); draw(L('Shop-Page', 'Pull', 'Money'));
          if (pull) { draw(L('Shop-Page', 'Pull', 'No')); draw(L('Shop-Page', 'Pull', 'Yes')); barText('shop-no', T('取消', 'No'), L('Shop-Page', 'Pull', 'No'), 4.2); barText('shop-yes', T('確定', 'Yes'), L('Shop-Page', 'Pull', 'Yes'), 4.2); ids.push('shop-no', 'shop-yes'); }
          const mb = box(L('Shop-Page', 'Pull', 'Money')); if (mb) { text('shop-money', coins() >= 10000 ? (coins() / 1000).toFixed(1).replace(/.0$/, '') + 'k' : money(coins()), mb.l + 2, mb.t + (mb.b - mb.t) / 2 - 2.8, mb.r - mb.l - 16, s, 4.6, 0, 'right'); ids.push('shop-money'); }
          const pb = box(L('Shop-Page', 'Pull', 'Pull')); if (pb) { text('shop-cost', money(PRICE.pull), pb.l, pb.t - 0.5, pb.r - pb.l - 8, s, 4.2, 0, 'right'); text('shop-pull', T('抽卡', 'Draw'), pb.l + 1, pb.b - 6, pb.r - pb.l - 1, s, 4.5, 0, 'center'); ids.push('shop-cost', 'shop-pull'); }
        } else {
          for (const it of shopItems()) draw(L('Shop-Page', ...it.path, it.lit || shopHover?.id === it.id ? '100' : '20'), 0, it.dy || 0);
          if (stab === 3 && !shopItems().length) { text('shop-none', T('還沒有貓咪，去第四頁抽一隻吧', 'No cats yet. Draw one on page 4'), 30, 28, 92, s, 5.5, 14, 'center'); ids.push('shop-none'); }
        }
        for (const id of ['shop-money', 'shop-no', 'shop-yes', 'shop-cost', 'shop-pull', 'shop-none', 'shop-soon']) if (!ids.includes(id)) text(id, '', 0, 0, 0, s);
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
        if (pullAnim) return;
        if (buy) {
          const k = buyPart(p);
          if (k?.[0] === 'f') { buy.food = FREE4 + +k[1]; return paint(); }
          if (k === 'No') { buy = null; return paint(); }
          if (k === 'Yes') { if (!pay(PRICE.food)) { say(T('沐水幣不夠喔', 'Not enough coins')); return; } bc.postMessage({ t: 'feed', psd: FOODS[buy.food][2] }); buy = null; return paint(); }
          return;
        }
        const h = shopAt(p); if (h?.tab) { stab = h.tab; pull = null; return paint(); }
        if (stab === 4) {
          const k = pullPart(p);
          if (k === 'Pull' && !pull) { pull = {}; return paint(); }
          if (k === 'No') { pull = null; return paint(); }
          if (k === 'Yes' && pull) {
            if (!pay(PRICE.pull)) { say(T('沐水幣不夠喔', 'Not enough coins')); return; }
            const left = ['A', 'B', 'C'].filter((c) => !(S.cats || []).includes(c)), c = rnd(left.length ? left : ['A', 'B', 'C']), n = seq('Pull-' + c + '-Cat').length;
            pull = null; pullAnim = { cat: c, i: 0 };
            const iv = setInterval(() => { pullAnim.i++; paint(); if (pullAnim.i >= n + 10) { clearInterval(iv); S = load(); S.cats = [...new Set([...(S.cats || []), c])]; S.cat = c; save(); say(T('抽到了 ' + CATS[c][0] + '！', 'You got ' + CATS[c][1] + '!')); pullAnim = null; paint(); } }, 140);
            return paint();
          }
          return;
        }
        if (h?.it) { h.it.act(); return paint(); }
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
      if (page === 'shop' && !pullAnim) {
        if (buy) { const k = buyPart(p); const sh = k?.[0] === 'f' ? { id: k } : null; if ((sh?.id || null) !== (shopHover?.id || null)) { shopHover = sh; paint(); } if (!lab && k) lab = k[0] === 'f' ? T(BUYF[+k[1]][4], BUYF[+k[1]][5]) : k === 'No' ? T('取消', 'Cancel') : T('買下並餵她', 'Buy and feed'); }
        else { const h = shopAt(p); if ((h?.tab || h?.id || null) !== (shopHover?.tab || shopHover?.id || null)) { shopHover = h; paint(); } if (!lab && h?.tab) lab = [T('食物', 'Food'), T('掛件', 'Accessory'), T('我的貓咪', 'My cats'), T('抽貓咪', 'Cat draw')][h.tab - 1]; if (!lab && h?.it) lab = h.it.lab;
          if (!lab && stab === 4) { const k = pullPart(p); lab = { Pull: T('抽一次\n7,000', 'Draw\n7,000'), No: T('取消', 'Cancel'), Yes: T('確定抽卡', 'Draw now'), Money: T('你的沐水幣', 'Your coins') }[k] || ''; } }
      }
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

  // ================================================================ her cat, in its own window (drag it anywhere)
  function catView() {
    const s = Math.max(2, Math.round(S.scale)), CWc = 32, CHc = 32; size(CWc, CHc, s); tipS = s;
    let frame = 0, petting = false, at = 0, f = null, back = [], heart = false, heartEnd = false, hf = 0, drag = null, through = null;
    const cat = () => S.cat; const art = (k) => seq(k + '-Cat'), pet = (k) => seq('Pet-' + k + '-Cat');
    const opaque = (x, y) => { try { return X.getImageData(Math.floor(x), Math.floor(y), 1, 1).data[3] > 10; } catch { return true; } };
    const thr = (v) => { if (v !== through) { through = v; D('through', { on: v }); } };
    setInterval(() => {
      frame++; const c = cat(); if (!c) return;
      if (petting) { f = Math.min(pet(c).length - 1, Math.floor((now() - at) / 0.18)); if (now() - at >= 4 && !heart) { heart = true; heartEnd = false; hf = 0; } } // eyes stay shut while petted
      else if (back.length) f = back.shift(); else f = null;
      if (heart) { hf++; const n = seq('Pet-Cat-Heart').length; if (heartEnd && hf >= n) heart = false; else hf %= n; }
      X.clearRect(0, 0, CWc, CHc);
      if (f !== null) draw(pet(c)[f]); else { const a = art(c); draw(a[frame % a.length]); }
      if (heart) draw(seq('Pet-Cat-Heart')[hf]);
    }, 67);
    C.addEventListener('contextmenu', (e) => e.preventDefault());
    C.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return; C.setPointerCapture(e.pointerId); const p = pos(e, s);
      if (p.y < 16) { petting = true; at = now(); back = []; handAt(e, s); return; } // top half = pet her head
      drag = { sx: e.screenX, sy: e.screenY, wx: window.screenX, wy: window.screenY };
    });
    C.addEventListener('pointermove', (e) => { const p = pos(e, s); if (petting) return handAt(e, s); if (drag) return D('move', { x: Math.round(drag.wx + e.screenX - drag.sx), y: Math.round(drag.wy + e.screenY - drag.sy) }); thr(!opaque(p.x, p.y)); tip(p.y < 16 ? T('按住摸頭', 'Hold to pet') : T('拖著走', 'Drag me'), e); });
    const up = () => { if (petting) { petting = false; for (let i = f ?? 0; i >= 0; i--) back.push(i); if (heart) heartEnd = true; handOff(); } if (drag) D('catSaved', { x: window.screenX, y: window.screenY }); drag = null; };
    C.addEventListener('pointerup', up); C.addEventListener('pointercancel', up); C.addEventListener('pointerleave', () => { if (!petting && !drag) { thr(true); tip(''); } });
    bc.onmessage = ({ data: m }) => { if (m.t === 'state') S = load(); };
  }

  // ================================================================ the notebook — the original jELi book, rewritten
  // purple: her profile, info, Lv / exp / 沐水幣, weekly surprise pack · yellow: calendar, to-do (= Mizuki 待辦), sticky note
  // blue: looks to wear / buy, accessories (5 pages, later pages coming soon). Rects follow the original layout.
  function bookView() {
    const s = 3, TOP = 40; size(128, 128, s); C.style.marginTop = TOP * s + 'px'; TXT.style.top = TOP * s + 'px'; tipTop = TOP * s; tipS = s;
    let thru = null; document.addEventListener('pointermove', (e) => { const v = e.target !== C; if (v !== thru) { thru = v; D('through', { on: v }); } });
    const F1 = (...q) => one('Book-First-Page', ...q), F2 = (...q) => one('Book-Second-Page', ...q), F3 = (...q) => one('Book-Third-Page', ...q), BK = (...q) => one('Book', ...q);
    const R = (x, y, w, h) => ({ l: x, t: y, r: x + w - 1, b: y + h - 1 }), inR = (r, p) => r && p.x >= r.l && p.x <= r.r && p.y >= r.t && p.y <= r.b;
    const grow = (h, n) => { const b = box(h); return b && R(b.l - n, b.t - n, b.r - b.l + 1 + 2 * n, b.b - b.t + 1 + 2 * n); };
    let tab = 1, hover = null, lastE = null, bdrag = null, month = 0, todos = [], input = '', target = 'todo', noteDrag = false, addDown = false;
    let unlockAnim = null, surpriseAnim = null, blueItem = 0, bluePage = 1;
    const STYLES = Object.keys(SKINS);
    let styleIdx = Math.max(0, STYLES.indexOf(okSkin(S.skin)));
    const style = () => STYLES[styleIdx];
    const portrait = (k) => ({ jeli: F1('Left', 'Skin', 'jELi'), jeli2: F1('Left', 'Skin', 'jELi'), peach: F1('Left', 'Skin', 'DLC', 'Cake'), matcha: F1('Left', 'Skin', 'DLC', 'Matcha') }[k]);
    const dayKey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const ask = () => bc.postMessage({ t: 'todo', op: 'list', day: dayKey(new Date()) });
    const cal = () => { const n = new Date(), m = n.getMonth() + month; return [n.getFullYear() + Math.floor(m / 12), ((m % 12) + 12) % 12]; };
    const dayRect = (y, m, d) => { const i = new Date(y, m, 1).getDay() + d - 1; return R(10 + (i % 7) * 7, 53 + Math.floor(i / 7) * 9, 7, 8); };
    const lineR = (i) => { const b = box(F2('Right', 'Line')); return b ? R(b.l + 4, b.t - 1 + i * 12, b.r - b.l - 7, b.b - b.t + 8) : R(85, 45 + i * 12, 28, 11); };
    const inputR = () => { const b = box(F2('Right', 'Floor')); return b ? R(b.l + 9, b.t + 1, b.r - b.l - 12, b.b - b.t) : R(90, 29, 24, 14); };
    const noteB = () => box(F2('Right', 'Note'));
    const noteR = () => { const n = S.note, b = noteB(); return n && b && R(n.x, n.y, b.r - b.l + 1, b.b - b.t + 1); };
    const clampNote = (p) => { const b = noteB() || { l: 0, t: 0, r: 31, b: 25 }; return { x: Math.max(66, Math.min(128 - (b.r - b.l + 1) - 1, Math.round(p.x))), y: Math.max(45, Math.min(128 - (b.b - b.t + 1) - 1, Math.round(p.y))) }; };
    const INFO = { birthday: [R(18, 84, 48, 10), '08/27誕生。她從小細胞慢慢成長為水母。', 'Born 08/27. A tiny cell slowly grew into the jellyfish she is now.'], age: [R(18, 95, 48, 10), '6207歲。她見過古老世界，所以有點疏離。', 'Age 6207. Ancient worlds made her seem a little distant.'], body: [R(18, 105, 50, 11), '136cm/32kg。擬態太耗能，身形一直都很小。', '136cm/32kg. Mimicry costs energy, so she remains very small.'] };
    const SURPRISE = { Jellyfish: ['jELi 的本體，只會給信任的人看。', 'Her true form, only for people she trusts.'], Bow: ['她很喜歡的蝴蝶結，在袖子最上方。', 'A favourite bow on the top of her sleeve.'], 'Thigh-Ring': ['維持人類雙腿的腿環，上面有貓咪圈。', 'The leg ring that keeps her legs human.'], Choker: ['限制力量的脖圈，所以穿高領。', 'A collar that limits her power, hidden by a high collar.'] };
    const BLUE = ['peach', 'matcha'], BLUEART = { peach: 'Skin-Cake', matcha: 'Skin-Matcha' };
    const CARDS = [R(82, 42, 16, 21), R(101, 42, 16, 21), R(82, 68, 16, 21), R(101, 68, 16, 21), R(82, 94, 16, 21), R(101, 94, 16, 21)];
    const CARDACC = ['jellyfish', 'angel', 'devil', 'bow', 'cat', 'scarf'];
    const strike = (id) => { const el = document.getElementById('t-' + id); if (el) el.style.textDecoration = 'line-through'; };
    const T6 = (str, r, px = 5.5, align = 'left', id) => text(id, str, r.l, r.t + (r.b - r.t + 1) / 2 - px * 0.62, r.r - r.l + 1, s, px, 0, align);
    const short = (v, n = 15) => [...String(v)].length > n ? [...String(v)].slice(0, n - 1).join('') + '…' : String(v);
    const buySkin = (k) => { if (!pay(PRICE.skin)) return tip(T('沐水幣不夠喔', 'Not enough coins'), lastE || { clientX: 100, clientY: 200 }); unlockAnim = { k, i: 0, page: tab }; };

    function paint() {
      X.clearRect(0, 0, 128, 128); X.imageSmoothingEnabled = false;
      const used = [];
      const tx = (id, ...a) => { used.push(id); T6(a[0], a[1], a[2], a[3], id); };
      draw(BK('Floor'));
      for (const k of [1, 2, 3]) draw(BK(String(k), tab === k || hover === 'tab' + k ? 'Press' : 'Normal'));
      draw(BK('Close'));
      if (tab === 1) {
        const k = style(), owned = owns('skin', k);
        if (owned && S.skin !== k) { S.skin = k; save(); }
        if (styleIdx > 0) draw(F1('Left', 'Previous', hover === 'prev' ? 'Large' : 'Small'));
        if (styleIdx < STYLES.length - 1) draw(F1('Left', 'Next', hover === 'next' ? 'Large' : 'Small'));
        draw(F1('Left', 'Skin-Floor')); draw(F1('Left', 'Left-Floor'));
        if (portrait(k)) draw(portrait(k)); else { const f = seq(SKINS[k].idle), sb = box(F1('Left', 'Skin-Floor')); if (sb) X.drawImage(img(f[0]), 0, 0, 64, 64, sb.l + 1, sb.t + 1, sb.r - sb.l - 1, sb.b - sb.t - 1); }
        tx('b1-name', T(SKINS[k].zh, SKINS[k].en), R(13, 72, 40, 10), 6, 'center');
        tx('b1-bd', '08/27', R(22, 87, 40, 7)); tx('b1-age', T('6207歲', '6207 years'), R(22, 97, 44, 7)); tx('b1-body', '136cm/32kg', R(22, 107, 42, 8));
        if (unlockAnim?.page === 1) { const f = seq('Book-First-Page', 'Left', 'Unlock'); draw(f[Math.min(unlockAnim.i, f.length - 1)]); }
        else if (!owned) { draw(F1('Left', 'Lock-Skin')); draw(F1('Left', 'Lock')); }
        draw(F1('Right', 'Floor'));
        tx('b1-who', 'jELi', R(82, 33, 34, 9), 6, 'center'); tx('b1-lv', 'Lv.', R(85, 48, 14, 8), 5);
        const exp = S.feeds || 0; draw(F1('Right', 'XP-Bar', String(Math.min(10, (exp % 10) + 1))));
        tx('b1-exp', String(exp), R(100, 47, 14, 8), 5.5, 'right');
        const c = coins(); tx('b1-coin', c >= 100000 ? Math.floor(c / 1000) + 'k' : String(c), R(86, 66, 20, 8), 5, 'right');
        if (surpriseAnim) { const f = seq('Book-First-Page', 'Right', 'Blind', surpriseAnim.k); draw(f[Math.min(surpriseAnim.i, f.length - 1)]); }
        else if (S.surprise) { const f = seq('Book-First-Page', 'Right', 'Blind', S.surprise); draw(f[f.length - 1]); }
      } else if (tab === 2) {
        const [y, m] = cal(), days = new Date(y, m + 1, 0).getDate(), now = new Date(), today = y === now.getFullYear() && m === now.getMonth() ? now.getDate() : 0;
        draw(F2('Left', 'Previous', hover === 'prev' ? 'Large' : 'Small')); draw(F2('Left', 'Next', hover === 'next' ? 'Large' : 'Small')); draw(F2('Left', 'Line'));
        tx('b2-ym', y + '/' + String(m + 1).padStart(2, '0'), R(21, 35, 29, 7), 5.5, 'center');
        for (let d = 1; d <= 31; d++) { const id = 'b2-d' + d; if (d > days) continue; const r = dayRect(y, m, d); if (d === today) { const tb = box(F2('Left', 'Today')); if (tb) draw(F2('Left', 'Today'), Math.round(r.l + (r.r - r.l + 1 - (tb.r - tb.l + 1)) / 2 - tb.l), Math.round(r.t + (r.b - r.t + 1 - (tb.b - tb.t + 1)) / 2 - tb.t)); } tx(id, String(d), r, 4.2, 'center'); }
        draw(F2('Right', 'Floor')); draw(F2('Right', 'Plus-Press', addDown || hover === 'add' ? '2' : '1'));
        const rows = Math.max(1, Math.min(3, todos.length)); for (let r = 0; r < rows; r++) draw(F2('Right', 'Line'), 0, r * 12);
        todos.slice(0, 3).forEach((it, r) => { tx('b2-t' + r, short(it.title), lineR(r), 5); if (it.done) strike('b2-t' + r); const el = document.getElementById('t-b2-t' + r); if (el) el.style.color = it.done ? '#c9aee6' : hover === 'todo' + r ? '#9b5fd6' : '#7f45ba'; });
        if (target === 'todo' && input) tx('b2-in', short(input), inputR(), 5, 'center');
        else if (target === 'todo' && hover !== 'add') tx('b2-in', T('在這裡打字', 'Type here'), inputR(), 4.6, 'center');
        { const el = document.getElementById('t-b2-in'); if (el) el.style.color = input ? '#7f45ba' : '#c9aee6'; }
        draw(F2('Right', 'Note-Press', noteDrag || hover === 'pull' ? '2' : '1'));
        const nr = noteR(); if (nr) { const b = noteB(); draw(F2('Right', 'Note'), nr.l - b.l, nr.t - b.t); used.push('b2-note'); text('b2-note', (target === 'note' ? input : S.note.text) || '', nr.l + 7, nr.t + 6, nr.r - nr.l - 9, s, 4.6, nr.b - nr.t - 8); }
      } else {
        const k = BLUE[blueItem], owned = owns('skin', k), f = seq('Book-Third-Page', 'Left', 'DLC', BLUEART[k]);
        if (blueItem > 0) draw(F3('Left', 'Previous', hover === 'prev' ? 'Large' : 'Small'));
        if (blueItem < BLUE.length - 1) draw(F3('Left', 'Next', hover === 'next' ? 'Large' : 'Small'));
        draw(F3('Left', 'Floor'));
        if (unlockAnim?.page === 3) { draw(f[Math.min(unlockAnim.i, f.length - 1)]); const u = seq('Book-Third-Page', 'Left', 'Unlock'); draw(u[Math.min(unlockAnim.i, u.length - 1)]); }
        else { draw(f[f.length - 1]); if (!owned) { draw(F3('Left', 'Lock-Skin')); draw(F3('Left', 'Lock')); } }
        if (bluePage > 1) draw(F3('Right', 'Previous', hover === 'rprev' ? 'Large' : 'Small'));
        if (bluePage < 5) draw(seq('Book-Third-Page', 'Right', 'Next')[0]);
        tx('b3-page', bluePage + ' /5', R(88, 28, 23, 8), 5, 'center');
        draw(F3('Right', 'Line')); draw(F3('Right', 'Floor'));
        if (bluePage === 1) { draw(F3('Right', 'Accessory')); draw(F3('Right', 'Accessory-DLC', ['bow', 'cat', 'scarf'].some((a) => owns('acc', a)) ? '100' : '20'));
          X.strokeStyle = '#7f45ba'; CARDS.forEach((r, n) => { if (S.acc === CARDACC[n] || hover === 'card' + n) X.strokeRect(r.l - 0.5, r.t - 0.5, r.r - r.l + 2, r.b - r.t + 2); }); }
        else CARDS.forEach((r, n) => { tx('b3-c' + n, 'COM\nING\nSOON', r, 4, 'center'); const el = document.getElementById('t-b3-c' + n); if (el) { el.style.whiteSpace = 'pre'; el.style.opacity = '.5'; el.style.top = r.t * s + 'px'; } });
      }
      for (const el of [...TXT.children]) if (!used.includes(el.id.slice(2))) el.remove();
    }
    const hitAt = (p) => {
      if (inR(R(101, 8, 18, 18), p)) return 'close';
      for (const [k, r] of [[1, R(10, 8, 18, 18)], [2, R(27, 8, 18, 18)], [3, R(44, 8, 18, 18)]]) if (inR(r, p)) return 'tab' + k;
      if (inR(R(62, 22, 14, 95), p)) return 'spine';
      if (tab === 1) {
        if (styleIdx > 0 && inR(grow(F1('Left', 'Previous', 'Large'), 7), p)) return 'prev';
        if (styleIdx < STYLES.length - 1 && inR(grow(F1('Left', 'Next', 'Large'), 7), p)) return 'next';
        if (!owns('skin', style()) && inR(grow(F1('Left', 'Lock'), 6), p)) return 'unlock';
        for (const k of Object.keys(INFO)) if (inR(INFO[k][0], p)) return 'info-' + k;
        if (inR(grow(F1('Right', 'Blind', 'Bow', '100'), 8), p)) return 'surprise';
      } else if (tab === 2) {
        if (inR(grow(F2('Left', 'Previous', 'Large'), 7), p)) return 'prev'; if (inR(grow(F2('Left', 'Next', 'Large'), 7), p)) return 'next';
        for (let r = 0; r < Math.min(3, todos.length); r++) if (inR(lineR(r), p)) return 'todo' + r;
        if (inR(noteR(), p)) return 'note';
        if (inR(grow(F2('Right', 'Plus-Press', '2'), 1), p)) return 'add';
        if (inR(inputR(), p)) return 'input';
        if (inR(grow(F2('Right', 'Note-Press', '1'), 5), p)) return 'pull';
      } else {
        if (blueItem > 0 && inR(grow(F3('Left', 'Previous', 'Large'), 7), p)) return 'prev'; if (blueItem < BLUE.length - 1 && inR(grow(F3('Left', 'Next', 'Large'), 7), p)) return 'next';
        if (bluePage > 1 && inR(grow(F3('Right', 'Previous', 'Large'), 7), p)) return 'rprev'; if (bluePage < 5 && inR(grow(seq('Book-Third-Page', 'Right', 'Next')[0], 7), p)) return 'rnext';
        if (inR(grow(F3('Left', 'Lock'), 6), p)) return 'unlock';
        if (bluePage === 1) for (let n = 0; n < 6; n++) if (inR(CARDS[n], p)) return 'card' + n;
      }
      return null;
    };
    const label = (h) => {
      if (!h) return ''; const own = (a) => owns('acc', a);
      if (h === 'close') return T('關閉本子', 'Close'); if (h === 'spine') return T('這裡不能點喔～', 'Nothing here~');
      if (h.startsWith('tab')) return [T('資料', 'Profile'), T('行事曆', 'Calendar'), T('造型', 'Looks')][h[3] - 1];
      if (h === 'prev' || h === 'rprev') return T('上一頁', 'Back'); if (h === 'next' || h === 'rnext') return T('下一頁', 'Next');
      if (h === 'unlock') return T('解鎖\n' + money(PRICE.skin), 'Unlock\n' + money(PRICE.skin));
      if (h.startsWith('info-')) return T(INFO[h.slice(5)][1], INFO[h.slice(5)][2]);
      if (h === 'surprise') return S.surprise ? T(...SURPRISE[S.surprise]) : S.surpriseWeek === weekKey() ? T('這週已經開過囉', 'Opened this week') : T('驚喜包：每週一次', 'Weekly surprise pack');
      if (h.startsWith('todo')) return T('左鍵完成｜右鍵刪除', 'Left: done | Right: delete');
      if (h === 'add') return T('新增', 'Add'); if (h === 'input') return T('打字新增待辦', 'Type a to-do');
      if (h === 'pull') return T('拉出便條', 'Pull a note'); if (h === 'note') return T('左鍵寫字｜雙擊清空｜右鍵刪除', 'Left: write | Double: clear | Right: delete');
      if (h.startsWith('card')) { const a = CARDACC[+h[4]]; return T(ACCS[a].zh, ACCS[a].en) + (own(a) ? '' : '\n' + money(PRICE.acc)); }
      return '';
    };
    const onMove = (e) => {
      const p = pos(e, s);
      if (noteDrag) { const c = clampNote(p); S.note = { ...(S.note || {}), x: c.x, y: c.y, text: S.note?.text || '' }; return paint(); }
      if (bdrag) return D('move', { x: Math.round(bdrag.wx + e.screenX - bdrag.sx), y: Math.round(bdrag.wy + e.screenY - bdrag.sy) });
      const h = hitAt(p); if (h !== hover) { hover = h; paint(); } tip(label(h), e);
    };
    const reHover = () => setTimeout(() => lastE && onMove(lastE), 30);
    const anim = (o, n, done, ms = 110) => { const iv = setInterval(() => { o.i++; paint(); if (o.i >= n) { clearInterval(iv); done(); paint(); reHover(); } }, ms); };
    C.addEventListener('pointermove', (e) => { lastE = e; onMove(e); });
    C.addEventListener('pointerleave', () => { lastE = null; hover = null; tip(''); paint(); });
    C.addEventListener('auxclick', (e) => e.preventDefault());
    C.addEventListener('contextmenu', (e) => e.preventDefault());
    C.addEventListener('dblclick', (e) => { const h = hitAt(pos(e, s)); if (tab === 2 && h === 'note') { S.note.text = ''; input = ''; target = 'note'; save(); paint(); } });
    C.addEventListener('pointerdown', (e) => {
      if (e.button === 3 || e.button === 4) { e.preventDefault(); tab = Math.max(1, Math.min(3, tab + (e.button === 3 ? -1 : 1))); paint(); return; } // side buttons: page back / forward
      const p = pos(e, s), h = hitAt(p);
      if (e.button === 2 && tab === 2) { if (h === 'note') { S.note = null; target = 'todo'; input = ''; save(); } else if (h?.startsWith('todo')) bc.postMessage({ t: 'todo', op: 'delete', day: dayKey(new Date()), id: todos[+h[4]]?.id }); paint(); reHover(); return; }
      if (e.button !== 0 || unlockAnim || surpriseAnim) return;
      if (h === 'close') return D('bookClose');
      if (h === 'spine') return;
      if (h?.startsWith('tab')) { tab = +h[3]; if (tab === 2) ask(); }
      else if (tab === 1) {
        if (h === 'prev' || h === 'next') { styleIdx += h === 'next' ? 1 : -1; }
        if (h === 'unlock') { buySkin(style()); if (unlockAnim) anim(unlockAnim, seq('Book-First-Page', 'Left', 'Unlock').length + 2, () => { S = load(); S.ownSkins = [...new Set([...(S.ownSkins || []), unlockAnim.k])]; S.skin = unlockAnim.k; save(); unlockAnim = null; }); }
        if (h === 'surprise' && !S.surprise && S.surpriseWeek !== weekKey()) { const k = rnd(Object.keys(SURPRISE)); surpriseAnim = { k, i: 0 }; anim(surpriseAnim, seq('Book-First-Page', 'Right', 'Blind', k).length + 1, () => { S = load(); S.surprise = k; S.surpriseWeek = weekKey(); save(); surpriseAnim = null; }, 160); }
      } else if (tab === 2) {
        if (h === 'prev' || h === 'next') month += h === 'next' ? 1 : -1;
        if (h?.startsWith('todo')) bc.postMessage({ t: 'todo', op: 'toggle', day: dayKey(new Date()), id: todos[+h[4]]?.id });
        if (h === 'note') { target = 'note'; input = S.note?.text || ''; }
        if (h === 'input') { target = 'todo'; input = ''; }
        if (h === 'add') { addDown = true; target = 'todo'; if (input.trim()) bc.postMessage({ t: 'todo', op: 'add', day: dayKey(new Date()), title: input }); input = ''; }
        if (h === 'pull') { noteDrag = true; target = 'note'; input = ''; const c = clampNote(p); S.note = { x: c.x, y: c.y, text: '' }; C.setPointerCapture(e.pointerId); }
        KEYIN.focus();
      } else {
        if (h === 'prev' || h === 'next') blueItem = Math.max(0, Math.min(BLUE.length - 1, blueItem + (h === 'next' ? 1 : -1)));
        if (h === 'rprev' || h === 'rnext') bluePage = Math.max(1, Math.min(5, bluePage + (h === 'rnext' ? 1 : -1)));
        if (h === 'unlock') { const k = BLUE[blueItem]; if (owns('skin', k)) { S.skin = k; save(); } else { buySkin(k); if (unlockAnim) anim(unlockAnim, seq('Book-Third-Page', 'Left', 'Unlock').length + 2, () => { S = load(); S.ownSkins = [...new Set([...(S.ownSkins || []), unlockAnim.k])]; S.skin = unlockAnim.k; save(); unlockAnim = null; }); } }
        if (h?.startsWith('card')) { const a = CARDACC[+h[4]]; if (!owns('acc', a)) { if (!pay(PRICE.acc)) return tip(T('沐水幣不夠喔', 'Not enough coins'), e); S.ownAccs = [...new Set([...(S.ownAccs || []), a])]; } S.acc = S.acc === a ? null : a; save(); }
      }
      if (!h) { bdrag = { sx: e.screenX, sy: e.screenY, wx: window.screenX, wy: window.screenY }; C.setPointerCapture(e.pointerId); return; }
      paint(); reHover();
    });
    C.addEventListener('pointerup', () => { if (noteDrag) save(); noteDrag = false; addDown = false; bdrag = null; paint(); });
    // typing goes to the to-do input or the sticky note (an invisible field so Chinese input methods work)
    const KEYIN = Object.assign(document.createElement('input'), { autocomplete: 'off' }); Object.assign(KEYIN.style, { position: 'fixed', left: '-50px', top: '0', width: '10px', opacity: '0' }); document.body.appendChild(KEYIN);
    KEYIN.addEventListener('input', () => { if (KEYIN.value.length > 80) KEYIN.value = KEYIN.value.slice(0, 80); input = KEYIN.value; if (target === 'note' && S.note) { S.note.text = input; } paint(); });
    KEYIN.addEventListener('keydown', (k) => { if (k.key === 'Enter' && !k.isComposing) { if (target === 'todo' && input.trim()) bc.postMessage({ t: 'todo', op: 'add', day: dayKey(new Date()), title: input }); if (target === 'note') save(); input = ''; KEYIN.value = ''; paint(); } });
    const focusType = () => { KEYIN.value = input; KEYIN.focus(); };
    C.addEventListener('click', () => { if (tab === 2) focusType(); });
    bc.onmessage = ({ data: m }) => { if (m.t === 'state') { const note = S.note; S = load(); if (noteDrag) S.note = note; } if (m.t === 'todos') todos = m.items || []; paint(); };
    ask(); setInterval(paint, 1000); paint();
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
