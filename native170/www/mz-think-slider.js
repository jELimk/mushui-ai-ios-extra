'use strict';
// 3.4.1: 思考深度 (thinking depth) per AI, in the AI chat's ⋯ sheet: 低 / 中 / 高 / 最大. The knob is a glass
// magnifier lens (like the day / night switch) holding the 沐水 drop; a little smiling flame runs on the track.
// The track's scene cross-fades live while dragging: 冰山 → 春天 → 花開 → 天使.
// Tap a stop or drag the lens. The level goes into the AI's prompt (how much to think before replying).
{
  const W = window.WebEngine;
  const LV = [
    { zh: '低', en: 'Low', say: ['水滴凍成了小冰山……小火苗正悄悄靠近', 'The drop froze into an iceberg… a little flame creeps closer'], prompt: '思考深度：低。憑直覺自然地回，不用想太多，簡短輕鬆。' },
    { zh: '中', en: 'Medium', say: ['春天來了，慢慢想一想', 'Spring is here — thinking it over'], prompt: '思考深度：中。回覆前稍微想一想對方的意思和心情，再自然地回。' },
    { zh: '高', en: 'High', say: ['花開了，靈感正在冒出來', 'Flowers are out — ideas are bubbling up'], prompt: '思考深度：高。回覆前認真想清楚：對方真正想說什麼、之前聊過的相關事情、怎樣回最貼心，再回覆。' },
    { zh: '最大', en: 'Max', say: ['天使水滴上線，小火苗快跑', 'Angel drop is here — run, little flame!'], prompt: '思考深度：最大。回覆前深入、全面地思考：理解對方的話與情緒、回想記憶裡相關的事、想好最適合的回應方式，必要時提出好問題或細心的建議，再用自然的語氣回覆。' },
  ];
  const levelOf = (a) => Math.max(0, Math.min(3, Number(a?.mzThinkLevel ?? 1)));
  // the knob: the 沐水 drop (same shape as the app icon), one look per level
  const DROP = 'M60 5C52 25 20 58 20 85a40 40 0 0 0 80 0C100 58 68 25 60 5Z';
  const drop = (lv) => {
    const g = [['#e6f6ff', '#9ccfee'], ['#cdb3e0', '#a586bf'], ['#f3c1dc', '#c98bbb'], ['#fff4c2', '#f2b632']][lv];
    const face = lv === 0
      ? '<path d="M37 66 q6 5 12 0" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M45 90 q10 7 22 0" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".85"/>'
      : '<path d="M35 85q17 17 35 4t17 0q-3 27-27 28T35 85" fill="#fff" opacity=".8"/><ellipse cx="43" cy="64" rx="5" ry="8" fill="#fff" opacity=".75"/>';
    const extra = lv === 0 ? '<path d="M28 98 l6 -6 l6 6 M70 104 l5 -5 l5 5" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/><text x="88" y="30" font-size="20" fill="#7fb6dd" font-family="sans-serif">z</text>'
      : lv === 1 ? '<path d="M60 8 C66 0 78 -2 84 2 C80 10 70 14 60 12 Z" fill="#7ccf6a" stroke="#4c9a3d" stroke-width="2"/>'
        : lv === 2 ? '<g transform="translate(84 22)"><circle r="6" fill="#ffd34d"/><g fill="#ff8fb8"><circle cx="0" cy="-9" r="6"/><circle cx="9" cy="-3" r="6"/><circle cx="6" cy="8" r="6"/><circle cx="-6" cy="8" r="6"/><circle cx="-9" cy="-3" r="6"/></g><circle r="4.5" fill="#ffd34d"/></g>'
          : '<ellipse cx="60" cy="-6" rx="22" ry="6" fill="none" stroke="#f2b632" stroke-width="4"/><path d="M20 70 C2 62 0 46 6 40 C12 50 18 54 24 56 M100 70 C118 62 120 46 114 40 C108 50 102 54 96 56" fill="#fff" stroke="#f2c14e" stroke-width="3" stroke-linejoin="round"/>';
    return `<svg viewBox="-6 -16 132 166" aria-hidden="true"><defs><linearGradient id="mzd${lv}" x2=".9" y2="1"><stop stop-color="${g[0]}"/><stop offset="1" stop-color="${g[1]}"/></linearGradient></defs>${lv === 3 ? extra : ''}<path d="${DROP}" fill="url(#mzd${lv})"/>${face}<circle cx="98" cy="29" r="4" fill="${lv === 3 ? '#fff' : '#e6c8da'}"/>${lv === 3 ? '' : extra}</svg>`;
  };
  // the chaser: a little smiling flame (one big eye, a wide smile, a pink spark), no background
  const fire = (lv) => `<svg viewBox="0 0 60 66" aria-hidden="true"><path d="M23 3 C28 9 29 15 26 21 C22 29 9 35 7 48 C6 58 16 64 30 64 C44 64 53 56 53 45 C53 36 45 31 45 23 C45 20 46 18 47 16 C41 19 37 25 37 31 C33 29 32 25 34 19 C35 13 31 7 23 3 Z" fill="#e8986a"/>
<ellipse cx="21" cy="38" rx="3.4" ry="4.4" fill="#fff"/>
<path d="M18 46 C23 50 29 49 35 45 C38 43.5 41 44.5 40.5 47.5 C39.5 55 34.5 59 28.5 59 C22 59 17.5 54 18 46 Z" fill="#fff"/>
<circle cx="48" cy="12" r="2.4" fill="#f0b6c6"/>${lv === 2 ? '<path d="M8 26 q3 4 0 7 q-3 -3 0 -7 Z" fill="#7fd3ff"/>' : ''}</svg>`;
  const card = (a) => {
    const lv = levelOf(a), L = LV[lv];
    return `<section class="card mz-think-card" data-mzthink="${esc(a.id)}"><div class="mz-think-head"><b class="mz-think-lv lv${lv}">${mzT(L.zh, L.en)}</b><small>${mzT(...L.say)}</small></div>
<div class="mz-think-track" data-k="${lv}">${[0, 1, 2, 3].map((i) => `<i class="mz-think-bg b${i}" style="opacity:${i === lv ? 1 : 0}"></i>`).join('')}<span class="mz-think-steam"><i></i><i></i><i></i></span><span class="mz-think-fire">${fire(lv)}</span><button type="button" class="mz-think-knob" aria-label="${mzT('拖動調整思考深度', 'Drag to set thinking depth')}">${drop(lv)}</button></div>
<div class="mz-think-stops">${LV.map((x, i) => `<button type="button" style="--i:${i}" class="${i === lv ? 'on' : ''}" data-mzthinklv="${i}">${mzT(x.zh, x.en)}</button>`).join('')}</div>
<p class="help">${mzT('越深，回覆前想得越仔細（也會用比較多額度）。', 'Deeper means more careful replies (and a bit more API usage).')}</p></section>`;
  };
  // place the knob and the flame for a position k (0…3, may be in between) and cross-fade the four scenes.
  // The flame is solid: when the drop is dragged into it, it gets pushed along. Its home is the far right end.
  const hop = (f, big) => f.querySelector('svg')?.animate([{ transform: 'translateY(0) scale(1,1)' }, { transform: 'translateY(0) scale(1.08,.9)', offset: .2 }, { transform: `translateY(${big ? -12 : -7}px) scale(.94,1.06)`, offset: .5 }, { transform: 'translateY(0) scale(1.05,.95)', offset: .8 }, { transform: 'translateY(0) scale(1,1)' }], { duration: big ? 420 : 560, easing: 'ease-in-out' });
  const place = (t, k, live) => {
    const w = t.clientWidth - 56, kx = (k / 3) * w, home = w + 14;
    const knob = t.querySelector('.mz-think-knob'), f = t.querySelector('.mz-think-fire');
    knob.style.left = kx + 'px';
    if (t._fx == null) t._fx = home;
    if (t._fx < kx + 56) t._fx = Math.min(home, kx + 56); // pushed by the drop
    t._home = home; t._kx = kx; t._last = Date.now(); t._step = 0;
    t.classList.remove('steam');
    f.style.left = t._fx + 'px';
    f.style.opacity = String(Math.max(0, Math.min(1, (3 - k) * 2))); // 最大: gone
    const st = t.querySelector('.mz-think-steam'); if (st) st.style.left = (kx + 14) + 'px';
    t.querySelectorAll('.mz-think-bg').forEach((b, i) => { b.style.opacity = String(Math.max(0, 1 - Math.abs(k - i))); });
    t.classList.toggle('dragging', !!live);
    if (live) { const n = Math.round(k), head = t.parentElement.querySelector('.mz-think-head'); if (head && head.dataset.n !== String(n)) { head.dataset.n = n; head.innerHTML = `<b class="mz-think-lv lv${n}">${mzT(LV[n].zh, LV[n].en)}</b><small>${mzT(...LV[n].say)}</small>`; knob.innerHTML = drop(n); f.innerHTML = fire(n); } }
  };
  // chase the flame home (a scared jump, quicker)
  const chase = (t) => {
    const f = t.querySelector('.mz-think-fire'); if (!f || t._home == null) return;
    t._fx = t._home; t._last = Date.now(); t._step = 0; t.classList.remove('steam');
    f.classList.add('run'); f.style.left = t._fx + 'px'; hop(f, true);
    setTimeout(() => f.classList.remove('run'), 450);
  };
  // the flame, every 1.3 s once the slider has been left alone for 6 s:
  //  低   sneaks all the way up in little hops and steams the drop
  //  中   creeps closer, gets scared, backs off, tries again (never quite reaches)
  //  高   doesn't dare: stays at home, shivering now and then
  //  最大 gone
  setInterval(() => {
    document.querySelectorAll('.mz-think-track').forEach((t) => {
      if (t.classList.contains('dragging') || Date.now() - (t._last || 0) < 6000 || t._home == null || !t.isConnected) return;
      const f = t.querySelector('.mz-think-fire'), lv = Number(t.dataset.k) || 0; if (!f || lv === 3) return;
      if (lv === 2) { if (Math.random() < .35) f.querySelector('svg')?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(-1px)' }, { transform: 'translateX(0)' }], { duration: 380 }); return; }
      const near = t._kx + 58;
      let goal = near;
      if (lv === 1) { t._step = (t._step + 1) % 6; goal = t._step < 4 ? near + 26 : t._home; } // 4 hops in, 2 hops back
      const d = goal - t._fx;
      if (Math.abs(d) < 2) { if (lv === 0) t.classList.add('steam'); return; }
      t._fx += Math.sign(d) * Math.min(Math.abs(d), (lv === 1 && d > 0 ? 16 : 9) + Math.random() * 5);
      f.style.left = t._fx + 'px'; hop(f);
    });
  }, 1300);
  const placeAll = () => document.querySelectorAll('.mz-think-track').forEach((t) => place(t, Number(t.dataset.k) || 0, false));
  const save = async (id, lv) => {
    await W.edit((s) => { const x = s.ais.find((q) => q.id === id); if (x) x.mzThinkLevel = lv; });
    state = await W.view();
    const old = document.querySelector(`.mz-think-card[data-mzthink="${CSS.escape(id)}"]`), a = state.ais.find((q) => q.id === id);
    if (old && a) { old.outerHTML = card(a); requestAnimationFrame(placeAll); }
  };
  // in the 1-AI chat ⋯ sheet, after 「我們的主頁」
  try {
    new MutationObserver(() => {
      const sheet = document.querySelector('#overlay .sheet'); if (!sheet || sheet.querySelector('.mz-think-card')) return;
      if (!sheet.querySelector('[data-action="deleteChat"]') || typeof chatId !== 'string' || chatId.startsWith('human:')) return;
      const c = state.chats.find((x) => x.id === chatId); if (!c || (c.members || []).length !== 1) return;
      const a = state.ais.find((x) => x.id === c.members[0]); if (!a) return;
      const after = sheet.querySelector('.mz-home-entry') || sheet.querySelector('.mz-wl-card');
      if (after) after.insertAdjacentHTML('afterend', card(a)); else sheet.querySelector(':scope > .card')?.insertAdjacentHTML('beforebegin', card(a));
      requestAnimationFrame(placeAll);
    }).observe(document.getElementById('overlay'), { childList: true, subtree: true });
  } catch {}
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-mzthinklv]'); if (!b) return;
    save(b.closest('[data-mzthink]').dataset.mzthink, Number(b.dataset.mzthinklv));
  });
  // drag the jellyfish along the track; let go on the nearest stop
  let drag = null;
  document.addEventListener('pointerdown', (e) => {
    const fl = e.target.closest?.('.mz-think-fire');
    if (fl) { const t = fl.closest('.mz-think-track'); if (Number(t.dataset.k) <= 1) chase(t); return; }
    const k = e.target.closest?.('.mz-think-knob'); if (!k) return;
    const t = k.closest('.mz-think-track'); drag = { k, t, id: k.closest('[data-mzthink]').dataset.mzthink, r: t.getBoundingClientRect(), x: e.clientX, moved: false };
    try { k.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.moved && Math.abs(e.clientX - drag.x) < 4) return;
    drag.moved = true;
    const p = Math.max(0, Math.min(1, (e.clientX - drag.r.left - 28) / (drag.r.width - 56)));
    drag.k = p * 3; place(drag.t, drag.k, true);
  });
  document.addEventListener('pointerup', () => {
    if (!drag) return;
    const d = drag, before = Number(d.t.dataset.k) || 0; drag = null;
    if (!d.moved) { if (before <= 1) chase(d.t); return; } // a poke on the drop scares the flame off
    const v = Math.round(d.k ?? before);
    d.t.dataset.k = v; place(d.t, v, false);
    if (v !== before) save(d.id, v);
  });
  // into the AI's prompt
  // The level is (1) told to the AI in its prompt, and (2) for models that really can think longer, sent as the
  // model's own setting: OpenAI-style reasoning_effort low / medium / high, Claude thinking budget off / 1k / 4k / 8k.
  // A model that refuses the setting is retried once without it and remembered (only the prompt is used then).
  let pending = null;
  const sysBefore = W.system;
  W.system = function (a, ...rest) { let s = sysBefore.call(this, a, ...rest); try { if (a && a.mzThinkLevel != null) { s += '\n' + LV[levelOf(a)].prompt; pending = { lv: levelOf(a), at: Date.now() }; } } catch {} return s; };
  const refused = new Set();
  const EFFORT = ['low', 'medium', 'high', 'high'], BUDGET = [0, 1024, 4000, 8000];
  const proxyBefore = W.proxy;
  W.proxy = async function (st, path, body, ...rest) {
    const p = pending; pending = null;
    const model = String(body?.model || st?.model || '');
    if (!p || Date.now() - p.at > 4000 || !body || refused.has(model) || !/\/(chat\/completions|responses|messages)$/.test(path || '')) return proxyBefore.call(this, st, path, body, ...rest);
    const b = { ...body };
    if (path.endsWith('/messages')) { if (!BUDGET[p.lv]) return proxyBefore.call(this, st, path, body, ...rest); b.thinking = { type: 'enabled', budget_tokens: BUDGET[p.lv] }; b.max_tokens = Math.max(b.max_tokens || 1400, BUDGET[p.lv] + 1400); delete b.temperature; }
    else if (path.endsWith('/responses')) b.reasoning = { effort: EFFORT[p.lv] };
    else b.reasoning_effort = EFFORT[p.lv];
    try { return await proxyBefore.call(this, st, path, b, ...rest); }
    catch (e) { if (e && (e.status === 400 || e.status === 422 || /reasoning|thinking|unsupported|unknown|param/i.test(String(e.message || '')))) { refused.add(model); return proxyBefore.call(this, st, path, body, ...rest); } throw e; }
  };

  const css = document.createElement('style');
  css.textContent = `.mz-think-card{padding:14px}
.mz-think-head{display:grid;gap:2px;margin-bottom:10px}.mz-think-head small{color:var(--muted)}
.mz-think-lv{font-size:22px}.mz-think-lv.lv0{color:#3949ab}.mz-think-lv.lv1{color:#c2185b}.mz-think-lv.lv2{color:#ef6c00}.mz-think-lv.lv3{color:#e0a316}
.mz-think-track{position:relative;height:60px;border-radius:30px;overflow:hidden;box-shadow:inset 0 0 0 1px #0000000d}
.mz-think-bg{position:absolute;inset:0;transition:opacity .35s}
.mz-think-track.dragging .mz-think-bg,.mz-think-track.dragging .mz-think-knob,.mz-think-track.dragging .mz-think-fire{transition:none}
/* 冰山 · 春天 · 花開 · 天使 */
.mz-think-bg.b0{background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='60'%3E%3Cpath d='M10 60 L26 34 L34 42 L44 26 L60 60 Z' fill='%23ffffff' fill-opacity='.85'/%3E%3Cpath d='M70 60 L84 40 L96 60 Z' fill='%23ffffff' fill-opacity='.7'/%3E%3Ccircle cx='100' cy='14' r='1.6' fill='%23fff'/%3E%3Ccircle cx='60' cy='10' r='1.2' fill='%23fff'/%3E%3Ccircle cx='20' cy='16' r='1.4' fill='%23fff'/%3E%3C/svg%3E") 0 0/120px 60px,linear-gradient(180deg,#e9f7ff,#a9d8f2)}
.mz-think-bg.b1{background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='60'%3E%3Cpath d='M6 60 q2 -10 6 -14 M12 60 q0 -8 -3 -12 M44 60 q2 -9 6 -12 M50 60 q-1 -8 -4 -11' stroke='%234fa83d' stroke-width='2.4' fill='none' stroke-linecap='round'/%3E%3Cpath d='M30 18 c4 -6 10 -6 12 -4 c-2 6 -8 8 -12 4 Z M64 28 c4 -5 9 -5 11 -3 c-2 5 -7 7 -11 3 Z' fill='%2389d16f'/%3E%3C/svg%3E") 0 0/80px 60px,linear-gradient(180deg,#f3ffe3,#bfe9a0)}
.mz-think-bg.b2{background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='60'%3E%3Cg fill='%23ff8fb8'%3E%3Ccircle cx='20' cy='40' r='5'/%3E%3Ccircle cx='27' cy='45' r='5'/%3E%3Ccircle cx='13' cy='45' r='5'/%3E%3Ccircle cx='16' cy='52' r='5'/%3E%3Ccircle cx='24' cy='52' r='5'/%3E%3C/g%3E%3Ccircle cx='20' cy='47' r='3.5' fill='%23ffd34d'/%3E%3Cg fill='%23ffffff' fill-opacity='.9'%3E%3Ccircle cx='64' cy='16' r='4'/%3E%3Ccircle cx='70' cy='20' r='4'/%3E%3Ccircle cx='58' cy='20' r='4'/%3E%3Ccircle cx='61' cy='26' r='4'/%3E%3Ccircle cx='67' cy='26' r='4'/%3E%3C/g%3E%3Ccircle cx='64' cy='21' r='2.6' fill='%23ff8fb8'/%3E%3C/svg%3E") 0 0/90px 60px,linear-gradient(180deg,#ffeef5,#ffbcd6)}
.mz-think-bg.b3{background:radial-gradient(circle at 80% 30%,#fffef2 0 10px,transparent 30px),url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='60'%3E%3Cpath d='M20 44 C10 40 8 30 12 26 C16 32 20 34 24 35 Z M78 22 C70 18 69 10 72 7 C75 12 78 14 82 15 Z' fill='%23ffffff' stroke='%23f2c14e' stroke-width='1.2'/%3E%3Cellipse cx='52' cy='40' rx='9' ry='2.6' fill='none' stroke='%23f2b632' stroke-width='1.6'/%3E%3Cpath d='M90 46 l1.4 3 3 1.4 -3 1.4 -1.4 3 -1.4 -3 -3 -1.4 3 -1.4 Z M36 12 l1 2 2 1 -2 1 -1 2 -1 -2 -2 -1 2 -1 Z' fill='%23ffffff'/%3E%3C/svg%3E") 0 0/100px 60px,linear-gradient(180deg,#fffdf2,#ffe39a)}
.mz-think-knob{position:absolute;top:2px;left:0;z-index:2;width:56px;height:56px;padding:9px;border:3px solid #ffffffcc;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffffff,#f1f4ff 60%,#dde5ff);box-shadow:0 0 0 2px #00000030,0 6px 14px -6px #0006;overflow:visible;touch-action:none;cursor:grab;transition:left .45s cubic-bezier(.34,1.56,.64,1)}
.mz-think-track.dragging .mz-think-knob{cursor:grabbing}
.mz-think-knob svg{width:100%;height:100%;display:block;overflow:visible;filter:drop-shadow(0 1px 1px #0002)}
.mz-think-knob::before{content:'';position:absolute;left:7px;top:7px;width:20px;height:20px;border-radius:50%;border:3.5px solid transparent;border-top-color:#fffd;border-left-color:#fffd;transform:rotate(8deg);opacity:.85;pointer-events:none;z-index:1}
.mz-think-knob::after{content:'';position:absolute;right:11px;bottom:10px;width:5px;height:5px;border-radius:50%;background:#fff8;pointer-events:none}
.mz-think-fire{position:absolute;bottom:4px;left:0;width:40px;transition:left .55s cubic-bezier(.45,0,.3,1)}
.mz-think-fire{cursor:pointer;z-index:1;transition:left .55s cubic-bezier(.45,0,.3,1),opacity .3s}.mz-think-fire.run{transition:left .4s cubic-bezier(.2,.8,.3,1),opacity .3s}
.mz-think-fire svg{transform-origin:50% 100%}
.mz-think-steam{position:absolute;top:0;left:0;width:30px;height:20px;pointer-events:none;z-index:2;opacity:0;transition:opacity .6s}
.mz-think-track.steam .mz-think-steam{opacity:1}
.mz-think-steam i{position:absolute;bottom:0;width:7px;height:7px;border-radius:50%;background:#fff;opacity:0;animation:mz-steam 1.8s ease-out infinite}
.mz-think-steam i:nth-child(1){left:2px}.mz-think-steam i:nth-child(2){left:12px;animation-delay:.6s}.mz-think-steam i:nth-child(3){left:21px;animation-delay:1.2s}
@keyframes mz-steam{0%{transform:translateY(10px) scale(.6);opacity:0}30%{opacity:.85}100%{transform:translateY(-6px) scale(1.4);opacity:0}}
.mz-think-track.steam .mz-think-knob svg{animation:mz-evap 2.6s ease-in-out infinite}
@keyframes mz-evap{0%,100%{transform:scale(1)}50%{transform:scale(.86,.8) translateY(4px)}}
.mz-think-fire svg{display:block;width:100%}
.mz-think-stops{position:relative;height:30px;margin-top:6px}
.mz-think-stops button{position:absolute;top:0;left:calc(28px + var(--i) / 3 * (100% - 56px));transform:translateX(-50%);white-space:nowrap;border:0;background:none;color:var(--muted);font-size:13px;padding:4px 6px}
.mz-think-stops button.on{color:var(--ink);font-weight:700}`;
  document.head.append(css);
}
