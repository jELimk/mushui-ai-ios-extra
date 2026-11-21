'use strict';
// 3.4.1: the memory sea chart. What an AI remembers about you, drawn as a chart of islands: one island per area
// (daily life, mood, relationships, study & work, interests, dreams), bigger the more there is, each memory a dot.
// The memories are what you told this AI (your messages, with their dates) plus its long-term memory summary split
// into sentences; they are sorted into areas on the device by keywords (no model is asked). Search, filter by the
// last 14 / 30 days, tap an island to see only that area, tap a memory to jump to that message in the chat.
{
  const AREAS = [
    { id: 'daily', zh: '日常', en: 'Daily', x: 255, y: 330, re: /吃|喝|飯|餐|睡覺|起床|洗澡|上班|下班|出門|回家|天氣|買|逛|做飯|外送|火鍋|咖啡|奶茶|散步|打掃|eat|sleep|home|work out/i },
    { id: 'mood', zh: '心情', en: 'Mood', x: 105, y: 170, re: /難過|開心|好累|累了|煩|焦慮|哭|生氣|孤單|寂寞|壓力|睡不著|失眠|心情|崩潰|害怕|緊張|快樂|委屈|難受|想死|好想|emo|sad|happy|tired|anxious/i },
    { id: 'people', zh: '關係', en: 'People', x: 220, y: 210, re: /朋友|家人|媽|爸|哥|姐|弟|妹|男友|女友|喜歡你|愛你|吵架|分手|同事|室友|老公|老婆|約會|想你|閨蜜|friend|family|mom|dad|love/i },
    { id: 'study', zh: '學業工作', en: 'Study & work', x: 95, y: 70, re: /考試|作業|報告|上課|學校|老師|論文|工作|老闆|面試|專案|加班|讀書|學習|成績|開會|期末|exam|school|homework|job|boss/i },
    { id: 'hobby', zh: '興趣', en: 'Interests', x: 285, y: 95, re: /遊戲|音樂|聽歌|電影|動漫|畫畫|拍照|旅行|運動|健身|看書|追劇|唱歌|跳舞|小說|打球|cosplay|game|music|movie|anime|travel/i },
    { id: 'dream', zh: '夢境', en: 'Dreams', x: 85, y: 320, re: /夢|做夢|夢到|夢見|dream/i },
  ];
  const areaOf = (text) => { for (const a of AREAS.slice(1)) if (a.re.test(text)) return a.id; return 'daily'; };
  const name = (a) => mzT(a.zh, a.en);
  const collect = (aiId) => {
    const out = [];
    for (const c of state.chats || []) {
      if (!(c.members || []).includes(aiId) || (c.members || []).length !== 1) continue;
      for (const m of c.messages || []) {
        const t = String(m.text || '').trim();
        if (m.author !== 'me' || t.length < 4 || m.callEvent || m.system || /^https?:\/\//.test(t)) continue;
        out.push({ text: t.slice(0, 160), time: m.time || 0, area: areaOf(t), chat: c.id, id: m.id });
      }
      const rec = c.memories?.[aiId];
      if (rec?.summary) for (const s of String(rec.summary).split(/[。！？\n]+/).map((x) => x.trim()).filter((x) => x.length >= 6)) out.push({ text: s.slice(0, 160), time: rec.updatedAt || 0, area: areaOf(s), chat: c.id, long: true });
    }
    return out.sort((a, b) => b.time - a.time);
  };
  // a soft irregular island outline (the same for an area every time)
  const blob = (cx, cy, r, seed) => {
    let d = '', pts = 18;
    for (let k = 0; k <= pts; k++) {
      const t = (k % pts) / pts * Math.PI * 2, wob = 1 + 0.18 * Math.sin(t * 3 + seed) + 0.1 * Math.cos(t * 5 + seed * 2);
      const x = cx + Math.cos(t) * r * wob, y = cy + Math.sin(t) * r * 0.82 * wob;
      d += (k ? ' L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return d + 'Z';
  };
  let view = null;   // { aiId, all, q, days, area }
  const shown = () => {
    const now = Date.now(), q = view.q.trim().toLowerCase();
    return view.all.filter((e) => (!view.days || now - e.time <= view.days * 86400000) && (!view.area || e.area === view.area) && (!q || e.text.toLowerCase().includes(q)));
  };
  const chart = () => {
    const list = view.all.filter((e) => !view.days || Date.now() - e.time <= view.days * 86400000);
    const count = (id) => list.filter((e) => e.area === id).length;
    const islands = AREAS.map((a, i) => {
      const n = count(a.id), r = 26 + Math.min(44, Math.sqrt(n) * 7), on = view.area === a.id;
      const rings = [1, 0.72, 0.46].map((f, k) => `<path d="${blob(a.x, a.y, r * f, i * 1.7 + k)}" class="mz-mm-ring r${k}"/>`).join('');
      const dots = list.filter((e) => e.area === a.id).slice(0, 26).map((e, k) => { const t = k * 2.399, rr = r * 0.85 * Math.sqrt((k + 1) / 27); return `<circle cx="${(a.x + Math.cos(t) * rr).toFixed(1)}" cy="${(a.y + 14 + Math.sin(t) * rr * 0.6).toFixed(1)}" r="1.6" class="mz-mm-dot"/>`; }).join('');
      return `<g class="mz-mm-island${on ? ' on' : ''}${n ? '' : ' empty'}" data-mmarea="${a.id}" role="button" tabindex="0">${rings}${dots}<text x="${a.x}" y="${a.y - 6}" class="mz-mm-anchor">⚓</text><text x="${a.x}" y="${a.y + 12}" class="mz-mm-name">${esc(name(a))}</text><text x="${a.x}" y="${a.y + 26}" class="mz-mm-count">${n} ${mzT('條', '')}</text></g>`;
    }).join('');
    const grid = Array.from({ length: 9 }, (_, k) => `<line x1="${k * 45}" y1="0" x2="${k * 45}" y2="420" class="mz-mm-grid"/>`).join('') + Array.from({ length: 10 }, (_, k) => `<line x1="0" y1="${k * 45}" x2="360" y2="${k * 45}" class="mz-mm-grid"/>`).join('');
    return `<svg class="mz-mm-chart" viewBox="0 0 360 420" aria-label="${mzT('記憶海圖', 'Memory chart')}">${grid}<text x="335" y="28" class="mz-mm-compass">N</text><path d="M335 32 l-5 14 l5 -4 l5 4 z" class="mz-mm-compass"/>${islands}</svg>`;
  };
  const listHtml = () => {
    const items = shown().slice(0, 120);
    if (!items.length) return `<p class="help">${mzT('沒有符合的記憶。', 'No memories match.')}</p>`;
    return items.map((e) => { const a = AREAS.find((x) => x.id === e.area); return `<button class="mz-mm-item" type="button" ${e.id ? `data-mmjump="${esc(e.chat)}|${esc(e.id)}"` : ''}><span class="mz-mm-tag">${esc(name(a))}${e.long ? ' · ' + mzT('長期記憶', 'long-term') : ''}</span><span class="mz-mm-text user-content">${esc(e.text)}</span><time>${e.time ? new Date(e.time).toLocaleDateString() : ''}</time></button>`; }).join('');
  };
  const paint = () => {
    const box = document.querySelector('.mz-mm'); if (!box || !view) return;
    box.querySelector('.mz-mm-map').innerHTML = chart();
    box.querySelector('.mz-mm-list').innerHTML = listHtml();
    box.querySelectorAll('[data-mmdays]').forEach((b) => b.classList.toggle('selected', String(view.days) === b.dataset.mmdays));
    const head = box.querySelector('.mz-mm-head'); if (head) head.textContent = view.area ? name(AREAS.find((a) => a.id === view.area)) + ' · ' + shown().length + mzT(' 條', '') : mzT(`共 ${shown().length} 條`, `${shown().length} in all`);
  };
  actions.mzMemoryMap = (aiId) => {
    if (typeof aiId !== 'string' || !aiId) { const c = state.chats.find((x) => x.id === chatId); aiId = c?.members?.length === 1 ? c.members[0] : ''; }
    const a = state.ais.find((x) => x.id === aiId); if (!a) { toast(mzT('打開一位 AI 的聊天室再看記憶海圖', 'Open a chat with one AI first')); return; }
    view = { aiId, all: collect(aiId), q: '', days: 0, area: '' };
    showModal(mzT('記憶海圖', 'Memory chart') + ' · ' + esc(a.name), `<div class="mz-mm"><div class="search mz-mm-search">${icon('search')}<input id="mzMmSearch" placeholder="${mzT('搜尋記憶', 'Search memories')}" autocomplete="off"></div>
<div class="mz-mm-chips"><button class="chip selected" type="button" data-mmdays="0">${mzT('全部', 'All')}</button><button class="chip" type="button" data-mmdays="14">${mzT('近 14 天', '14 days')}</button><button class="chip" type="button" data-mmdays="30">${mzT('近 30 天', '30 days')}</button></div>
<div class="mz-mm-map"></div><p class="small mz-mm-head"></p><div class="mz-mm-list"></div>
<p class="small">${mzT('依你跟這位 AI 說過的話與長期記憶，在這台裝置上用關鍵字分類。點島嶼只看那一區，再點一次看全部。', 'From what you told this AI and its long-term memory, sorted by keywords on this device. Tap an island for that area, tap again for all.')}</p></div>`);
    paint();
  };
  document.addEventListener('input', (e) => { if (e.target.id === 'mzMmSearch' && view) { view.q = e.target.value; const box = document.querySelector('.mz-mm-list'); if (box) box.innerHTML = listHtml(); const head = document.querySelector('.mz-mm-head'); if (head) head.textContent = mzT(`共 ${shown().length} 條`, `${shown().length} in all`); } });
  document.addEventListener('click', (e) => {
    if (!view || !e.target.closest?.('.mz-mm')) return;
    const days = e.target.closest('[data-mmdays]'); if (days) { view.days = +days.dataset.mmdays; paint(); return; }
    const isl = e.target.closest('[data-mmarea]'); if (isl) { view.area = view.area === isl.dataset.mmarea ? '' : isl.dataset.mmarea; paint(); return; }
    const jump = e.target.closest('[data-mmjump]');
    if (jump) {
      const [chat, id] = jump.dataset.mmjump.split('|');
      closeModal(); view = null;
      if (chatId !== chat) { tab = 'chats'; page = ''; chatId = chat; render(); }
      setTimeout(() => { const el = document.querySelector(`.message[data-message-id="${CSS.escape(id)}"]`); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('mz-mm-flash'); setTimeout(() => el.classList.remove('mz-mm-flash'), 1600); } else toast(mzT('這則訊息比較舊，往上滑可以找到', 'This message is older; scroll up to find it')); }, 120);
    }
  });
  // entry points: the waterline sheet and the chat header area
  const wl = actions.mzWaterline;
  if (wl) actions.mzWaterline = (...a) => { wl(...a); document.querySelector('.mz-wl-sheet')?.insertAdjacentHTML('beforeend', `<div class="sheet-actions"><button class="pill primary" type="button" data-action="mzMemoryMap">${mzT('打開記憶海圖', 'Open memory chart')}</button></div>`); };
  const css = document.createElement('style');
  css.textContent = `.mz-mm-search{margin:0 0 8px}.mz-mm-chips{display:flex;gap:6px;margin-bottom:8px}
.mz-mm-map{border-radius:18px;overflow:hidden;background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 7%,var(--surface,#fff)),color-mix(in srgb,var(--accent) 3%,var(--surface,#fff)))}
.mz-mm-chart{display:block;width:100%;height:auto;max-height:50vh}
.mz-mm-grid{stroke:color-mix(in srgb,var(--ink) 7%,transparent);stroke-width:.5}
.mz-mm-compass{fill:color-mix(in srgb,var(--ink) 35%,transparent);font-size:11px;text-anchor:middle}
.mz-mm-island{cursor:pointer}.mz-mm-island.empty{opacity:.45}
.mz-mm-ring{fill:none;stroke:color-mix(in srgb,var(--accent) 45%,transparent);stroke-width:1}
.mz-mm-ring.r0{fill:color-mix(in srgb,var(--accent) 10%,transparent)}.mz-mm-ring.r2{fill:color-mix(in srgb,var(--accent) 12%,transparent)}
.mz-mm-island.on .mz-mm-ring{stroke:var(--accent);stroke-width:1.6}.mz-mm-island.on .mz-mm-ring.r0{fill:color-mix(in srgb,var(--accent) 22%,transparent)}
.mz-mm-dot{fill:color-mix(in srgb,var(--ink) 45%,transparent)}
.mz-mm-anchor{font-size:15px;text-anchor:middle;fill:var(--accent-deep)}
.mz-mm-name{font-size:11px;font-weight:700;text-anchor:middle;fill:var(--ink)}.mz-mm-count{font-size:9px;text-anchor:middle;fill:var(--muted)}
.mz-mm-head{margin:10px 2px 4px}
.mz-mm-list{display:flex;flex-direction:column;gap:6px;max-height:34vh;overflow:auto}
.mz-mm-item{display:grid;grid-template-columns:1fr auto;gap:2px 8px;text-align:left;padding:9px 12px;border-radius:14px;border:0;background:var(--soft);color:var(--ink);font:inherit}
.mz-mm-tag{grid-column:1;font-size:11px;color:var(--accent-deep);font-weight:650}.mz-mm-item time{grid-row:1;grid-column:2;font-size:11px;color:var(--muted)}
.mz-mm-text{grid-column:1/-1;font-size:13px;line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.message.mz-mm-flash .bubble{box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 45%,transparent)!important;transition:box-shadow .3s}`;
  document.head.append(css);
}
