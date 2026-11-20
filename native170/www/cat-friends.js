'use strict';
// 3.4.2: the cat theme's three cats are also contacts: 小獅 Lion (orange), 玉米 Teddy (tabby), 屁屁 Lapis (Siamese). Chatting with them only ever gets meows: each cat
// has its own set of preset meows, and each reply adds a random cat kaomoji. They never call any AI (no tokens used).
// They are created the first time the cat theme is on, and hidden from Contacts and Chats in every other theme.
// Their chats go to the server (users are told once that the official team can see them); in 水沐 the three cat
// rooms show every user's lines with that cat, read only — staff never write into them.
{
  const W = window.WebEngine;
  const face = (fur, ear, mark, eyes) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect width='40' height='40' fill='#fbf3e6'/><path d='M7 31 C5 25 6 18 8 12 L10 5 L16.5 11 C18.8 10.4 21.2 10.4 23.5 11 L30 5 L32 12 C34 18 35 25 33 31 C30 35 25 36.5 20 36.5 C15 36.5 10 35 7 31 Z' fill='${fur}' stroke='#3b302b' stroke-width='2.2' stroke-linejoin='round'/><path d='M11 12 L12 8 L14.5 11 Z M29 12 L28 8 L25.5 11 Z' fill='${ear}'/>${mark}${eyes}<path d='M18.6 25.6 h2.8 l-1.4 1.6 Z' fill='#3b302b'/><path d='M20 27.2 q-1.6 2.2 -3.4 .6 M20 27.2 q1.6 2.2 3.4 .6' fill='none' stroke='#3b302b' stroke-width='1.3' stroke-linecap='round'/></svg>`);
  const dots = "<circle cx='14.5' cy='22' r='1.9' fill='#3b302b'/><circle cx='25.5' cy='22' r='1.9' fill='#3b302b'/>";
  const happy = "<path d='M12 22.5 q2.5 -3 5 0 M23 22.5 q2.5 -3 5 0' fill='none' stroke='#3b302b' stroke-width='1.6' stroke-linecap='round'/>";
  const sleepy = "<path d='M12 21.5 q2.5 2.4 5 0 M23 21.5 q2.5 2.4 5 0' fill='none' stroke='#3b302b' stroke-width='1.6' stroke-linecap='round'/>";
  const CATS = [
    { id: 'mz-cat-orange', name: ['小獅', 'Lion'], photo: 'cats/lion.jpg', avatar: face('#f6b26b', '#f5b3a0', "<path d='M18 14 l.8 3 M20 13.5 v3.4 M22 14 l-.8 3' stroke='#e3913f' stroke-width='1.6' stroke-linecap='round'/>", dots),
      meows: [['喵～', 'Meow~'], ['喵喵！', 'Mew mew!'], ['喵嗚～', 'Mrrow~'], ['咪？', 'Mew?'], ['喵喵喵！', 'Meow meow meow!'], ['呼嚕嚕…', 'Purrr…'], ['喵！（蹭蹭）', 'Meow! (rubs against you)'], ['喵～～～', 'Meooow~']] },
    { id: 'mz-cat-tabby', name: ['玉米', 'Teddy'], photo: 'cats/teddy.jpg?v=2', avatar: face('#c4ae90', '#e9b3a4', "<path d='M17.5 14 l.8 3 M20 13.5 v3.4 M22.5 14 l-.8 3 M8 21 h3 M29 21 h3' stroke='#6b5947' stroke-width='1.6' stroke-linecap='round'/>", happy),
      meows: [['喵？', 'Meow?'], ['咪…', 'Mew…'], ['喵喵？', 'Mew mew?'], ['喵（探頭）', 'Meow (peeks)'], ['喵嗚…', 'Mrrow…'], ['喵！', 'Meow!'], ['咪咪～', 'Mew mew~']] },
    { id: 'mz-cat-siamese', name: ['屁屁', 'Lapis'], photo: 'cats/lapis.jpg', avatar: face('#f4ebe0', '#86766f', "<ellipse cx='20' cy='26' rx='7' ry='5' fill='#a89890' opacity='.5'/>", sleepy),
      meows: [['喵…zzz', 'Mew…zzz'], ['呼嚕…', 'Purr…'], ['喵嗷～', 'Mraow~'], ['喵…', 'Mew…'], ['嗷嗚～', 'Awoo~'], ['（翻身）喵', '(rolls over) mew'], ['喵——', 'Meeeow']] },
  ];
  const isCat = (id) => CATS.some((c) => c.id === id);
  // what the contact page shows; the words 「沐水家的胖貓貓」 also mark every AI request about a cat (answered here, never sent)
  const MARK = '沐水家的胖貓貓';
  // what the contact page shows (the user: only name, breed, age, birthday, weight — the personalities are for writing replies)
  const ABOUT = {
    'mz-cat-orange': ['品種：橘貓\n年齡：三歲\n生日：10/30\n體重：5 公斤（11 磅）', 'Breed: orange tabby\nAge: 3\nBirthday: 30 Oct\nWeight: 5 kg (11 lb)'],
    'mz-cat-tabby': ['品種：虎斑貓\n年齡：五個月\n生日：06/08\n體重：4 公斤（8.8 磅）', 'Breed: tabby\nAge: 5 months\nBirthday: 8 Jun\nWeight: 4 kg (8.8 lb)'],
    'mz-cat-siamese': ['品種：暹羅貓\n年齡：兩歲\n生日：12/17\n體重：7 公斤（15.4 磅）', 'Breed: Siamese\nAge: 2\nBirthday: 17 Dec\nWeight: 7 kg (15.4 lb)'],

  };
  // the stored persona keeps the 「沐水家的胖貓貓」 mark, so any AI request about a cat is caught by W.proxy below
  const personaOf = (id) => MARK + '・' + mzT(...(CATS.find((c) => c.id === id)?.name || ['', ''])) + ' ' + mzT(...ABOUT[id]).replace(/\n/g, '，');
  const SLEEP = { 'mz-cat-orange': [[0, 7], [13, 15]], 'mz-cat-tabby': [[23, 24], [0, 6], [15, 17]], 'mz-cat-siamese': [[6, 12], [15, 16]] };
  const asleep = (id, d = new Date()) => (SLEEP[id] || []).some(([a, b]) => d.getHours() >= a && d.getHours() < b);
  // meal times (hour, minute from, minute to) — never inside a sleep time
  const MEALS = { 'mz-cat-orange': [[7, 30], [18, 30]], 'mz-cat-tabby': [[7, 30], [18, 30]], 'mz-cat-siamese': [[12, 30], [18, 30]] };
  const eating = (id, d = new Date()) => (MEALS[id] || []).some(([h, len]) => d.getHours() === h && d.getMinutes() < len);
  // drinking: a few times a day at different times each day (4 times, 5 minutes each, only while awake and not eating);
  // the times come from the date and the cat, so every device agrees without saving anything
  const drinkTimes = (id, d = new Date()) => {
    let seed = 0; const key = id + d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
    for (const ch of key) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    const out = [];
    for (let tries = 0; out.length < 4 && tries < 60; tries++) {
      const m = Math.floor(rnd() * 1440), t = new Date(d); t.setHours(Math.floor(m / 60), m % 60, 0, 0);
      if (!asleep(id, t) && !eating(id, t) && out.every((x) => Math.abs(x - m) > 90)) out.push(m);
    }
    return out;
  };
  const drinking = (id, d = new Date()) => { const now = d.getHours() * 60 + d.getMinutes(); return drinkTimes(id, d).some((m) => now >= m && now < m + 5); };
  const daySeed = (key, d = new Date()) => { let x = 0; for (const ch of key + d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate()) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return () => ((x = (x * 1103515245 + 12345) >>> 0) / 4294967296); };
  const fightTimes = (d = new Date()) => { const r = daySeed('fight', d), out = []; for (let i = 0; i < 3; i++) out.push(8 * 60 + Math.floor(r() * 170)); return out; };
  const fighting = (id, d = new Date()) => (id === 'mz-cat-orange' || id === 'mz-cat-tabby') && !asleep(id, d) && !eating(id, d) && fightTimes(d).some((m) => { const now = d.getHours() * 60 + d.getMinutes(); return now >= m && now < m + 10; });
  window.mzCatTimes = { daySeed, fightTimes, fighting };
  const status = (id) => asleep(id) ? mzT('正在睡覺', 'is asleep') : eating(id) ? mzT('正在吃飯', 'is eating') : fighting(id) ? (id === 'mz-cat-orange' ? mzT('正在跟玉米打架', 'is fighting with Teddy') : mzT('正在跟小獅打架', 'is fighting with Lion')) : drinking(id) ? mzT('正在喝水', 'is drinking water') : '';
  window.mzCatStatus = status; window.mzCatDrinkTimes = drinkTimes;
  const WAKE = /醒|起床|起來|wake|get up/i;
  const catOn = () => document.documentElement.classList.contains('mz-cat');
  window.mzCatFriends = { CATS, isCat };

  // the user's own photo when there is one (a square JPEG), else the drawn face as PNG
  const photoUrl = async (path) => { try { const b = await (await fetch(path)).blob(); return await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result).replace(/^data:[^;]*;/, 'data:image/jpeg;')); r.onerror = () => ok(''); r.readAsDataURL(b); }); } catch { return ''; } };
  const toPng = (svgUrl) => new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { try { const c = document.createElement('canvas'); c.width = c.height = 160; c.getContext('2d').drawImage(img, 0, 0, 160, 160); resolve(c.toDataURL('image/png')); } catch { resolve(''); } };
    img.onerror = () => resolve(''); img.src = svgUrl;
  });
  // create them once, the first time the cat theme is on
  let ensuring = false;
  const ensure = async () => {
    if (ensuring || (!catOn() && !window.MizukiStaffEdition) || !W) return; ensuring = true;
    try {
      const s = await W.read(); const missing = CATS.filter((c) => !s.ais.some((a) => a.id === c.id));
      // their names follow the app language (小獅 / Lion …)
      const renamed = CATS.filter((c) => { const a = s.ais.find((x) => x.id === c.id); return a && (a.name !== mzT(...c.name) || (a.mzCatAvatar || '') !== (c.photo || 'drawn') || !/^data:image\/(png|jpeg);base64,/.test(a.avatar || '') || a.persona !== personaOf(c.id)); });
      for (const c of CATS) c.png ||= (c.photo ? await photoUrl(c.photo) : '') || await toPng(c.avatar);
      if (!missing.length && !renamed.length) return;
      await W.edit((x) => {
        for (const c of missing) if (!x.ais.some((a) => a.id === c.id)) x.ais.push({ id: c.id, name: mzT(...c.name), avatar: c.png || '', mzCatAvatar: c.photo || 'drawn', persona: personaOf(c.id), memory: [], appearance: personaOf(c.id), appearanceLocked: true, summary: '', mzCatFriend: true });
        for (const c of renamed) { const a = x.ais.find((q) => q.id === c.id); if (a) Object.assign(a, { name: mzT(...c.name), avatar: c.png || a.avatar, mzCatAvatar: c.photo || 'drawn', persona: personaOf(c.id), appearance: personaOf(c.id), appearanceLocked: true }); }
      });
      state = await W.view(); render();
    } catch {} finally { ensuring = false; }
  };
  const applyBefore = applyTheme;
  applyTheme = function (...a) { const r = applyBefore.apply(this, a); setTimeout(ensure, 0); return r; };
  setTimeout(ensure, 800);

  // personalities (the user's own cats):
  //  小獅 Lion   clingy — but try to hold him and he runs off; keep holding him and he gets cross and bites hard
  //  屁屁 Lapis  moody — just woken up he lets anyone pet him; awake, he hisses when touched
  //  玉米 Teddy  easy-going — pet him all you like; pet him for long and he thinks it's play and nibbles you
  const HUG = /抱|摟|hug|cuddle|hold/i, PET = /擼|摸|揉|撫|拍拍|蹭|pet|stroke|rub|scratch/i;
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const said = (m) => (typeof m?.content === 'string' ? m.content : Array.isArray(m?.content) ? m.content.map((x) => x.text || '').join(' ') : '');
  const mood = (id, msgs) => {
    const mine = msgs.filter((m) => m.role === 'user').map(said);
    const last = mine[mine.length - 1] || '';
    const streak = (re) => { let n = 0; for (let i = mine.length - 1; i >= 0 && re.test(mine[i]); i--) n++; return n; };
    const st = asleep(id) ? 'sleep' : eating(id) ? 'eat' : drinking(id) ? 'drink' : 'awake';
    if (fighting(id)) {
      if (id === 'mz-cat-orange') return pick([['喵嗷！（正在跟玉米扭打，沒空理你）', 'MRAOW! (wrestling with Teddy, no time for you)'], ['（撲向玉米）嗯嗯嗯嗯……', '(pounces on Teddy) mmm-mmm-mmm…'], ['（尾巴炸開，跟玉米對峙中）', '(tail puffed, staring Teddy down)']]);
      return pick([['喵！（被小獅追著跑）', 'Mew! (being chased by Lion)'], ['（跳到小獅身上咬耳朵）', '(jumps on Lion and bites his ear)'], ['喵喵！（打架中，等等再說）', 'Mew mew! (fighting — later!)']]);
    }
    const written = window.mzCatReply?.(id, last, { state: st, streak: streak(new RegExp(PET.source + '|' + HUG.source, 'i')) });
    if (written) return written;
    if (drinking(id)) {
      const key = 'mz-cat-drink-' + id, now = Date.now();
      let pk = { n: 0, at: 0 }; try { pk = JSON.parse(localStorage.getItem(key) || '{"n":0,"at":0}'); } catch {}
      pk = now - pk.at > 10 * 60000 ? { n: 1, at: now } : { n: pk.n + 1, at: now };
      try { localStorage.setItem(key, JSON.stringify(pk)); } catch {}
      if (pk.n >= 2 || PET.test(last) || HUG.test(last)) {
        if (id === 'mz-cat-orange') return pick([['喵！（喝水被打擾，伸手抓你一下）', 'Mew! (bothered while drinking, scratches you with his paw)'], ['（用爪子抓了你的手）', '(swipes at your hand with his claws)']]);
        if (id === 'mz-cat-siamese') return pick([['喵！喵！喵嗷！（生氣地叫）', 'Mew! Mew! MRAOW! (angry meowing)'], ['喵嗷——！（很不高興）', 'Mraooow! (very unhappy)']]);
        return pick([['（用手扒拉你，沒有伸爪子）喵', '(paws at you, claws in) mew'], ['（肉球推推你）喵～', '(pushes you with his paw pads) mew~']]);
      }
      return pick([['（正在喝水，舔舔舔）', '(drinking, lap lap lap)'], ['（低頭喝水中）', '(head down, drinking)'], ['舔…舔…（喝水）', 'Lap… lap… (drinking)']]);
    }
    if (eating(id)) {
      const key = 'mz-cat-meal-' + id, now = Date.now();
      let pk = { n: 0, at: 0 }; try { pk = JSON.parse(localStorage.getItem(key) || '{"n":0,"at":0}'); } catch {}
      pk = now - pk.at > 30 * 60000 ? { n: 1, at: now } : { n: pk.n + 1, at: now };
      try { localStorage.setItem(key, JSON.stringify(pk)); } catch {}
      if (pk.n >= 2 || PET.test(last) || HUG.test(last)) {
        if (id === 'mz-cat-siamese') return pick([['哈——！（吃飯不准吵）', 'Hhhh! (no bothering while I eat)'], ['（護著碗哈氣）', '(guards his bowl and hisses)']]);
        return pick([['嘶——！（吃飯被打擾，咬你一口）', 'Hssss! (bothered while eating, bites you)'], ['喵嗷！（咬了你的手，繼續吃）', 'MRAOW! (bites your hand, keeps eating)']]);
      }
      return pick([['（正在吃飯，喀滋喀滋）', '(eating, crunch crunch)'], ['（埋頭吃飯，沒空理你）', '(face in the bowl, too busy for you)'], ['喀滋…喀滋…', 'Crunch… crunch…']]);
    }
    if (asleep(id)) {
      const key = 'mz-cat-pokes-' + id, now = Date.now();
      let pk = { n: 0, at: 0 }; try { pk = JSON.parse(localStorage.getItem(key) || '{"n":0,"at":0}'); } catch {}
      pk = now - pk.at > 20 * 60000 ? { n: 1, at: now } : { n: pk.n + 1, at: now };
      try { localStorage.setItem(key, JSON.stringify(pk)); } catch {}
      if (pk.n >= 3 || (pk.n >= 2 && WAKE.test(last))) {
        try { localStorage.setItem(key, JSON.stringify({ n: 0, at: now })); } catch {}
        if (id === 'mz-cat-tabby') return pick([['喵！（被吵醒，一溜煙跑走了）', 'Mew! (woken up, dashes away)'], ['（睡眼惺忪地跑去別的房間）', '(stumbles off to another room, half asleep)']]);
        if (id === 'mz-cat-orange') return pick([['嘶——！（被吵醒，用力咬你）', 'Hssss! (woken up, bites you hard)'], ['喵嗷！（起床氣，咬了你一口）', 'MRAOW! (grumpy, bites you)']]);
        return pick([['哈——！（被吵醒，咬你一口）', 'Hhhh! (woken up, bites you)'], ['（瞪你，然後咬下去）', '(glares at you, then bites)']]);
      }
      return pick([['zzz…（睡得很熟）', 'zzz… (fast asleep)'], ['呼…呼…（翻個身繼續睡）', 'Huu… huu… (rolls over, still asleep)'], ['（耳朵動了一下，還在睡）', '(an ear twitches, still asleep)'], ['zzZ', 'zzZ']]);
    }
    if (id === 'mz-cat-orange') {
      if (HUG.test(last)) {
        const n = streak(HUG);
        if (n >= 3) return pick([['嘶——！（狠狠咬了你一口）', 'Hssss! (bites you hard)'], ['喵嗷！！（生氣地咬住你的手）', 'MRAOW!! (angrily bites your hand)'], ['（耳朵往後壓，用力咬你）哈！', '(ears back, bites hard) Hah!']]);
        if (n === 2) return pick([['喵嗚……（扭來扭去想逃）', 'Mrrr… (wriggles to get away)'], ['嗚喵！（尾巴開始甩）', 'Mrow! (tail starts lashing)']]);
        return pick([['喵！（一溜煙跑走了）', 'Mew! (dashes off)'], ['（從你手邊溜走）喵～', '(slips out of your arms) meow~'], ['喵？（躲到桌子底下）', 'Mew? (hides under the table)']]);
      }
      return pick([['喵～（蹭蹭你的腿）', 'Meow~ (rubs against your leg)'], ['喵喵！（一直跟著你）', 'Mew mew! (keeps following you)'], ['喵嗚～（趴在你旁邊）', 'Mrrow~ (flops down next to you)'], ['咪？（看著你）', 'Mew? (gazes at you)'], ['喵喵喵！', 'Meow meow meow!'], ['呼嚕嚕…（靠著你）', 'Purrr… (leans on you)']]);
    }
    if (id === 'mz-cat-siamese') {
      // "just woken up": the last time anyone talked to him was a while ago (he napped in between)
      const lastAt = Number(localStorage.getItem('mz-lapis-last') || 0), now = Date.now();
      try { localStorage.setItem('mz-lapis-last', String(now)); } catch {}
      const woke = !lastAt || now - lastAt > 30 * 60000;
      if (woke) { try { localStorage.setItem('mz-lapis-woke', String(now)); } catch {} }
      const h = new Date().getHours(), justUp = (SLEEP[id] || []).some(([, b]) => h === b % 24); // the first hour after his sleep time
      const sleepy = justUp || now - Number(localStorage.getItem('mz-lapis-woke') || 0) < 5 * 60000;
      if (PET.test(last) || HUG.test(last)) {
        if (sleepy) return pick([['呼嚕呼嚕～（剛睡醒，任你擼）', 'Purr purr~ (just woke up, lets you pet him)'], ['喵…（瞇著眼睛蹭你的手）', 'Mew… (squints and nuzzles your hand)'], ['（翻成肚子朝上）喵～', '(rolls belly-up) mew~']]);
        return pick([['哈——！', 'Hhhhh!'], ['哈！（不准碰）', 'Hah! (no touching)'], ['（炸毛）哈——', '(fur puffed) hhhh—']]);
      }
      if (sleepy) return pick([['喵…zzz', 'Mew…zzz'], ['喵嗷～（伸懶腰）', 'Mraow~ (stretches)'], ['呼嚕…', 'Purr…']]);
      return pick([['喵。', 'Meow.'], ['（瞪你一眼）喵', '(gives you a look) mew'], ['喵——', 'Meeeow'], ['（尾巴甩一甩）', '(flicks his tail)']]);
    }
    // 玉米 Teddy
    if (PET.test(last) || HUG.test(last)) {
      const n = streak(new RegExp(PET.source + '|' + HUG.source, 'i'));
      if (n >= 4) return pick([['（以為你要玩，輕輕咬你一下）喵！', '(thinks you want to play, nibbles you) Mew!'], ['喵嗚～（抱住你的手輕咬）', 'Mrrow~ (hugs your hand and nibbles)'], ['（撲過來咬咬）喵～來玩嘛', '(pounces and nibbles) mew~ play with me']]);
      return pick([['呼嚕呼嚕～', 'Purr purr~'], ['喵～（隨便你擼）', 'Meow~ (pet me all you like)'], ['（瞇眼）呼嚕…', '(eyes half closed) purr…'], ['喵～再一下', 'Mew~ a bit more']]);
    }
    return pick([['喵？', 'Meow?'], ['咪～', 'Mew~'], ['喵喵（滾來滾去）', 'Mew mew (rolls around)'], ['喵（打哈欠）', 'Mew (yawns)'], ['喵！', 'Meow!']]);
  };
  // replies: no AI call — a meow that fits the cat's personality plus a random cat kaomoji
  let speaking = null;
  const sysBefore = W.system;
  W.system = function (a, ...rest) { speaking = a && isCat(a.id) ? a.id : null; return sysBefore.call(this, a, ...rest); };
  const completeBefore = W.complete;
  W.complete = async function (...args) {
    const id = speaking; speaking = null;
    if (!id) return completeBefore.apply(this, args);
    const kao = window.mzKaomoji?.CATS?.find((k) => k[0] === 'cat')?.[4] || ['ᓚ₍⑅^..^₎♡'];
    return mzT(...mood(id, args[2] || [])) + ' ' + kao[Math.floor(Math.random() * kao.length)];
  };

  const meowFor = (text) => { const c = CATS.find((x) => text.includes(x.id)) || CATS[0], m = c.meows[Math.floor(Math.random() * c.meows.length)]; return mzT(...m); };
  if (typeof W.proxy === 'function') {
    const proxyBefore = W.proxy;
    W.proxy = async function (st, path, body, ...rest) {
      let raw = ''; try { raw = typeof body === 'string' ? body : JSON.stringify(body || ''); } catch {}
      if (raw.includes(MARK) || raw.includes("Mizuki's chubby cats")) {
        const text = meowFor(raw);
        return { choices: [{ message: { role: 'assistant', content: text } }], content: [{ type: 'text', text }], output: [{ content: [{ type: 'output_text', text }] }] };
      }
      return proxyBefore.call(this, st, path, body, ...rest);
    };
  }
  // hidden outside the cat theme (Contacts and the chat list)
  const hide = () => {
    const on = catOn();
    document.querySelectorAll('#app [data-contact]').forEach((b) => { if (isCat(b.dataset.contact)) (b.closest('.contact-entry') || b).hidden = !on; });
    document.querySelectorAll('#app .chat-row[data-chat]').forEach((b) => {
      const ch = state?.chats?.find((x) => x.id === b.dataset.chat); if (!ch || ch.members?.length !== 1 || !isCat(ch.members[0])) return;
      (b.closest('.chat-entry') || b).hidden = !on;
    });
    document.querySelectorAll('#app .mz-cgroup').forEach((g) => { const rows = g.querySelectorAll('.contact-entry'); if (rows.length) g.hidden = [...rows].every((r) => r.hidden); });
  };
  const staff = () => !!window.MizukiStaffEdition;
  const catOfChat = (id) => { const ch = state?.chats?.find((x) => x.id === id); return ch && ch.members?.length === 1 && isCat(ch.members[0]) ? ch.members[0] : ''; };

  // the line at the top (or bottom, with newest-first order) of a cat chat, and a one-time notice that the official
  // team can see these chats (the user chose: tell them once, the first time)
  const banner = () => {
    const cat = typeof chatId === 'string' ? catOfChat(chatId) : ''; const list = document.querySelector('#app .conversation .message-list');
    document.querySelector('#app .conversation .mz-waterline')?.toggleAttribute('hidden', !!cat);
    if (!cat || !list || list.querySelector('.mz-catbanner')) return;
    const b = document.createElement('div'); b.className = 'mz-catbanner';
    const st = status(cat), nm = ai(cat)?.name || '';
    b.textContent = (staff() ? mzT('使用者和沐水家胖貓貓們的聊天（只能看，不能回覆）', "Users' chats with Mizuki's chubby cats (read only)") : mzT('您目前正在跟沐水家的胖貓貓們聊天', "You're chatting with Mizuki's chubby cats")) + (st ? mzT(`・${nm}${st}`, ` · ${nm} ${st}`) : '');
    document.documentElement.classList.contains('mz-order-bottom') ? list.append(b) : list.prepend(b);
  };
  const NOTICE = 'mz-cat-notice-v2';
  const notice = () => {
    if (staff() || typeof chatId !== 'string' || !catOfChat(chatId) || modal) return;
    let seen = false; try { seen = !!localStorage.getItem(NOTICE); } catch {}
    if (seen) return;
    try { localStorage.setItem(NOTICE, '1'); } catch {}
    showModal(mzT('沐水家的胖貓貓們', "Mizuki's chubby cats"), `<p>${mzT('提醒你：在貓咪聊天室裡說的話，沐水官方看得到，用來照顧大家。官方只會看，不會插話。請不要在這裡留下密碼或很私密的資料喔 (｡•ᴗ•｡)', "Note: the Mizuki team can see what you say in the cat chats, to look after everyone. They only read and never join in. Please don't leave passwords or very private details here (｡•ᴗ•｡)")}</p>`, `<div class="sheet-actions"><button class="pill primary" data-action="closeModal">${mzT('知道了', 'Got it')}</button></div>`);
  };

  // every line of a user's cat chat goes to the server once (the user's own and the meows), so 水沐 can read them
  const SENT = 'mz-catchat-sent';
  let sent = new Set(); try { sent = new Set(JSON.parse(localStorage.getItem(SENT) || '[]')); } catch {}
  let pushing = false;
  const push = async () => {
    if (pushing || staff() || !W.humanRequest || !humanData?.()?.connected) return; pushing = true;
    try {
      for (const ch of state?.chats || []) {
        const cat = ch.members?.length === 1 && isCat(ch.members[0]) ? ch.members[0] : ''; if (!cat) continue;
        for (const m of (ch.messages || []).slice(-60)) {
          const id = String(m.id || ''); if (!id || sent.has(id) || m.system || !String(m.text || '').trim()) continue;
          await W.humanRequest('/v1/catchat', { cat, author: m.author === 'me' ? 'me' : cat, text: String(m.text), time: m.time ? Date.parse(m.time) || Date.now() : Date.now(), id });
          sent.add(id);
        }
      }
      try { localStorage.setItem(SENT, JSON.stringify([...sent].slice(-3000))); } catch {}
    } catch {} finally { pushing = false; }
  };

  // 水沐: a cat chat shows every user's lines with that cat, read only (no typing, no replies)
  let feed = { cat: '', at: 0, html: '' };
  const showFeed = async (force) => {
    const cat = typeof chatId === 'string' ? catOfChat(chatId) : ''; if (!staff() || !cat) return;
    document.querySelector('#app .conversation > .composer')?.setAttribute('hidden', '');
    const list = document.querySelector('#app .conversation .message-list'); if (!list) return;
    if (!force && feed.cat === cat && Date.now() - feed.at < 10000) { if (feed.html && !list.dataset.mzFeed) { list.innerHTML = feed.html; list.dataset.mzFeed = '1'; banner(); } return; }
    feed = { cat, at: Date.now(), html: feed.cat === cat ? feed.html : '' };
    try {
      const r = await W.humanRequest('/v1/catchat/staff?cat=' + encodeURIComponent(cat));
      const msgs = r?.messages || [];
      feed.html = msgs.length ? msgs.map((m) => `<div class="mz-catfeed ${m.author === 'me' ? 'user' : 'cat'}"><small>${esc(m.author === 'me' ? m.name : (ai(m.cat)?.name || ''))} · ${esc(typeof ago === 'function' ? ago(new Date(m.time).toISOString()) : '')}</small><span>${esc(m.text)}</span></div>`).join('')
        : `<p class="mz-catfeed-none">${mzT('還沒有人跟這隻貓聊天。', 'Nobody has chatted with this cat yet.')}</p>`;
      const now = document.querySelector('#app .conversation .message-list'); if (now && catOfChat(chatId) === cat) { now.innerHTML = feed.html; now.dataset.mzFeed = '1'; banner(); }
    } catch (e) { feed.html = `<p class="mz-catfeed-none">${esc(mzT('讀不到：', "Couldn't load: ") + (e?.message || e))}</p>`; }
  };
  setInterval(() => { try { if (staff()) showFeed(false); else push(); } catch {} }, 10000);

  // in 水沐 the cats are always there (any theme), so staff can open their rooms
  if (window.MizukiStaffEdition) setTimeout(() => { try { document.documentElement.classList.add('mz-cat-staff'); } catch {} }, 0);
  // 「小獅正在思考中…」 instead of 「對方正在輸入中…」
  const thinking = () => {
    const ch = typeof chatId === 'string' ? state?.chats?.find((x) => x.id === chatId) : null;
    if (!ch || !ch.members?.length || !ch.members.every(isCat)) return;
    const who = ch.members.length === 1 ? (ai(ch.members[0])?.name || '') : mzT('貓咪們', 'The cats');
    document.querySelectorAll('#app .conversation .typing, #app .conversation .top .small').forEach((el) => {
      for (const n of el.childNodes) if (n.nodeType === 3 && /正在輸入|typing/i.test(n.textContent)) n.textContent = mzT(`${who}正在思考中…`, `${who} is thinking…`);
    });
  };
  // cats only ever share a group with the other cats (and you); their avatars can't be changed
  const callBefore = call;
  call = async function (op, data, ...rest) {
    const kind = op === 'mutate' ? data?.action : op; // most changes arrive as call('mutate', { action, … })
    if (kind === 'newChat' && Array.isArray(data?.members) && data.members.length > 1 && data.members.some(isCat) && !data.members.every(isCat))
      throw Error(mzT('貓咪不能加入群組，只能三隻貓一起和你組一個貓咪群組。', "The cats can't join groups — only a group of just the cats and you."));
    if (kind === 'contact' && isCat(data?.id) && data && ('avatar' in data)) {
      const cur = state?.ais?.find((a) => a.id === data.id)?.avatar;
      if (data.avatar !== cur) throw Error(mzT('沐水家胖貓貓的頭像不能修改', "The cats' profile pictures can't be changed"));
    }
    return callBefore.call(this, op, data, ...rest);
  };
  if (typeof mizukiApi === 'function') {
    const apiBefore = mizukiApi;
    mizukiApi = async function (path, body, ...rest) {
      if (/\/v1\/groups\/(create|add)/.test(String(path)) && (body?.ais || []).some((a) => isCat(a?.id || a)))
        throw Error(mzT('貓咪不能加入有其他人的群組', "The cats can't join groups with other people"));
      return apiBefore.call(this, path, body, ...rest);
    };
  }
  // a cat's contact sheet is like the official account's: picture, name, who they are, and only 發送訊息 / 朋友圈
  if (typeof contactModal === 'function') {
    const sheetBefore = contactModal;
    contactModal = function (id, ...rest) {
      if (!isCat(id) || staff()) return sheetBefore.call(this, id, ...rest);
      const a = ai(id) || {};
      showModal(mzT('沐水家的胖貓貓', "Mizuki's chubby cat"), `<div class="human-profile mz-official-profile mz-cat-profile">${avatar(a, 'large')}<h2>${esc(a.name || '')}</h2><p class="help mz-cat-about">${esc(mzT(...ABOUT[id]))}</p><div class="sheet-actions"><button class="pill primary" data-startai="${esc(id)}">${mzT('發送訊息', 'Message')}</button><button class="pill" data-mzmoments="${esc(id)}">${mzT('朋友圈', 'Moments')}</button></div></div>`);
    };
  }
  const DAILY = [
    // [cat, slot key, how many times a day, window start hour, window end hour, lines]
    ['mz-cat-orange', 'night', 1, 21, 23.5, [['（跑過來找你，開始咬被子、踩被子）', '(comes looking for you, starts biting and kneading the blanket)'], ['喵～（跳上床，踩踩踩，咬被子）', 'Meow~ (hops on the bed, knead knead, bites the blanket)'], ['呼嚕嚕…（窩在你旁邊踩被子）', 'Purrr… (curls up next to you kneading the blanket)']]],
    ['mz-cat-siamese', 'midnight', 2, 0, 3, [['老吳～老吳～', 'Yowww~ yowww~'], ['老吳——老吳——（好無聊）', 'Yowwww— yowwww— (so bored)'], ['（在走廊來回走）老吳～', '(pacing the hallway) yowww~']]],
    ['mz-cat-tabby', 'door', 6, 7, 22.5, [['（扒門扒門）喵！要吃飯飯！', '(scratch scratch at the door) Mew! Food time!'], ['喵喵喵！（一直扒門要吃的）', 'Mew mew mew! (scratching the door for food)'], ['（坐在門口扒門）喵～飯飯～', '(sits by the door scratching) mew~ food~'], ['（又在扒門了）喵！', '(scratching at the door again) Mew!']]],
    ['mz-cat-orange', 'fight', 1, 8, 11, [['（早上跟玉米打起來了！）喵嗷！', '(a morning scuffle with Teddy!) MRAOW!'], ['嗯嗯嗯……（又在跟玉米打架）', 'Mmm-mmm… (fighting with Teddy again)']]],
  ];
  const slotTimes = (cat, key, n, a, b, d = new Date()) => { const r = daySeed(cat + key, d), out = []; for (let i = 0; i < n; i++) out.push(Math.round(a * 60 + r() * ((b - a) * 60))); return out.sort((x, y) => x - y); };
  let dailyBusy = false;
  const daily = async () => {
    if (dailyBusy || staff() || !catOn() || !state?.ais?.some((a) => isCat(a.id))) return; dailyBusy = true;
    try {
      const d = new Date(), now = d.getHours() * 60 + d.getMinutes(), stamp = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
      for (const [cat, key, n, a, b, lines] of DAILY) {
        if (asleep(cat, d) && key !== 'night') continue;
        if (key === 'fight' && !fightTimes(d).some((m) => now >= m && now < m + 10)) continue;
        const times = key === 'fight' ? fightTimes(d).slice(0, 1) : slotTimes(cat, key, n, a, b, d);
        times.forEach(async (t, i) => {
          const tag = `mz-cat-daily-${stamp}-${cat}-${key}-${i}`;
          if (now < t || now > t + 30) return; // only while the moment is fresh — never a pile-up later
          try { if (localStorage.getItem(tag)) return; localStorage.setItem(tag, '1'); } catch { return; }
          const m = pick(lines), text = mzT(...m), kao = window.mzKaomoji?.CATS?.find((k) => k[0] === 'cat')?.[4] || ['ᓚ₍⑅^..^₎♡'];
          const line = text + ' ' + kao[Math.floor(Math.random() * kao.length)];
          const s = await W.read(), cid = W.dm(s, cat).id;
          await W.edit((x) => { let ch = x.chats.find((c) => c.id === cid); if (!ch) { ch = s.chats.find((c) => c.id === cid); if (ch) x.chats.push(ch); } if (ch) { W.append(ch, cat, line); if (chatId !== cid) ch.unread = (ch.unread || 0) + 1; } });
          state = await W.view(); render();
          try { if (chatId !== cid) window.mushuiMobileNotice?.({ title: ai(cat)?.name || '', body: line, tag: 'cat-' + cat }); } catch {}
        });
      }
    } catch {} finally { dailyBusy = false; }
  };
  // away from the cat theme for 2+ days → each cat grumbles a little when you come back
  const SEEN = 'mz-cat-lastseen', AWAY = 2 * 86400000;
  const BACK = {
    'mz-cat-orange': [['喵！奴才你怎麼才回來，本喵等好久了…（蹭蹭你）', 'Mew! Where have you been, servant? This cat waited forever… (rubs against you)'], ['喵嗚～奴才終於回來了，本喵好無聊喔', 'Mrrow~ the servant is finally back, this cat was so bored']],
    'mz-cat-siamese': [['（背對你）哼，奴才終於想起本喵了？', '(back turned) Hmph, the servant finally remembers this cat?'], ['喵。奴才去哪了？本喵才沒有在等你', 'Mew. Where did the servant go? Not that this cat was waiting']],
    'mz-cat-tabby': [['喵喵！奴才你跑去哪裡了，本喵好無聊！', 'Mew mew! Where did you run off to, servant? This cat was so bored!'], ['喵～奴才回來了！快陪本喵玩！', 'Mew~ the servant is back! Play with this cat!']],
  };
  let backChecked = false;
  const welcomeBack = async () => {
    if (staff() || !catOn() || backChecked || !state?.ais?.some((a) => isCat(a.id))) return; backChecked = true;
    let last = 0; try { last = Number(localStorage.getItem(SEEN) || 0); } catch {}
    try { localStorage.setItem(SEEN, String(Date.now())); } catch {}
    if (!last || Date.now() - last < AWAY) return;
    const s = await W.read();
    await W.edit((x) => {
      for (const cat of Object.keys(BACK)) {
        const cid = W.dm(s, cat).id; let ch = x.chats.find((c) => c.id === cid);
        if (!ch) { ch = s.chats.find((c) => c.id === cid); if (ch) x.chats.push(ch); }
        if (ch) { const kao = window.mzKaomoji?.CATS?.find((k) => k[0] === 'cat')?.[4] || ['ᓚ₍⑅^..^₎♡']; W.append(ch, cat, mzT(...pick(BACK[cat])) + ' ' + kao[Math.floor(Math.random() * kao.length)]); ch.unread = (ch.unread || 0) + 1; }
      }
    });
    state = await W.view(); render();
  };
  // while the cat theme is on, remember that you were here; switching away and back re-checks
  setInterval(() => { try { if (catOn() && !staff()) localStorage.setItem(SEEN, String(Date.now())); else backChecked = false; } catch {} }, 60000);
  const applyBack = applyTheme;
  applyTheme = function (...a) { const r = applyBack.apply(this, a); setTimeout(() => { if (catOn()) welcomeBack(); else backChecked = false; }, 1200); return r; };
  setInterval(daily, 60000); setTimeout(daily, 4000);
  window.mzCatDaily = { DAILY, slotTimes, daily };
  // the people-group sheets never list the cats
  try {
    new MutationObserver(() => {
      document.querySelectorAll('#overlay input[name="mizukiGroupAI"]').forEach((i) => { if (isCat(i.value)) { i.checked = false; (i.closest('label') || i.parentElement).hidden = true; } });
    }).observe(document.getElementById('overlay'), { childList: true, subtree: true });
  } catch {}
  const renderBefore = render;
  render = function (...a) {
    const r = renderBefore.apply(this, a);
    try { if (!staff()) hide(); banner(); notice(); thinking(); if (staff()) showFeed(false); else setTimeout(push, 400); } catch {}
    return r;
  };
  const css = document.createElement('style');
  css.textContent = `
.mz-catbanner{margin:10px auto;max-width:86%;padding:7px 14px;border-radius:999px;text-align:center;font-size:12px;color:var(--muted);background:color-mix(in srgb,var(--accent) 9%,transparent)}
.mz-catfeed{display:grid;gap:3px;margin:8px 14px;max-width:80%}.mz-catfeed.cat{margin-left:auto;text-align:right}
.mz-catfeed small{font-size:11px;color:var(--muted)}
.mz-catfeed span{display:inline-block;padding:8px 12px;border-radius:14px;background:var(--surface,#fff);border:1px solid var(--line);white-space:pre-wrap;overflow-wrap:anywhere}
.mz-catfeed.cat span{background:color-mix(in srgb,var(--accent) 12%,var(--surface,#fff))}
.mz-catfeed-none{text-align:center;color:var(--muted);margin:30px 0}
.mz-cat-about{white-space:pre-line;line-height:1.9}
#app :is(.chat-entry,.contact-entry,.mz-cgroup,.chat-row,.contact-row)[hidden]{display:none!important}
`;
  document.head.append(css);
}
