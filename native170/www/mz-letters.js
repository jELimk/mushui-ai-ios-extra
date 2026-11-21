'use strict';
// 3.4.1: letters and a diary from each AI.
//  - Letters (信): a longer, hand-written-style letter to you, from your recent chats and the AI's long-term memory.
//  - Diary (日記): the AI's own short diary for a day — what it felt, what you two talked about.
// Each AI has two switches: only when asked / may write by itself / off. "By itself" is gentle: at most one letter
// a day (and only after enough new chat), one diary entry a day (in the evening, only on days you talked).
// Both use the AI's own model (API usage), stored on the AI (a.letters / a.diary), so they sync with the account.
{
  const W = window.WebEngine;
  const DAY = 86400000;
  const aiOf = (id) => state.ais.find((a) => a.id === id);
  const chatOf = (id) => state.chats.find((c) => (c.members || []).length === 1 && c.members[0] === id);
  const fmt = (t) => new Date(t).toLocaleDateString(window.MushuiLocale === 'en' ? 'en' : 'zh-TW', { month: 'long', day: 'numeric', weekday: 'short' });
  const dayKey = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const modeOf = (a, kind) => a?.[kind === 'letter' ? 'mzLetterMode' : 'mzDiaryMode'] || 'ask';
  const busy = new Set();
  // what the AI knows: long-term memory + the latest chat
  const context = (a, n = 60, since = 0) => {
    const c = chatOf(a.id), mem = c?.memories?.[a.id]?.summary || '';
    const lines = (c?.messages || []).filter((m) => !m.callEvent && m.text && (m.time || 0) >= since).slice(-n)
      .map((m) => (m.role === 'user' ? '使用者' : a.name) + '：' + String(m.text).replace(/\s+/g, ' ').slice(0, 200));
    return (mem ? '長期記憶：\n' + mem + '\n\n' : '') + (lines.length ? '最近的聊天：\n' + lines.join('\n') : '（最近沒有聊天）');
  };
  const today = () => new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  async function write(aiId, kind, auto = false) {
    const a = aiOf(aiId); if (!a || busy.has(aiId + kind)) return null;
    busy.add(aiId + kind);
    try {
      const s = await W.read();
      const persona = `你是「${a.name}」。個性：${a.personality || a.persona || '（依聊天中的樣子）'}\n只根據提供的記憶與聊天，不要編造重大事件或使用者沒說過的事；可以寫心情、感受與小小的回憶。用繁體中文。`;
      const ask = kind === 'letter'
        ? `今天是 ${today()}。寫一封給使用者的信，像手寫信：開頭稱呼、正文 180–380 字、結尾署名「${a.name}」。說說最近想對他說的話、注意到的事、想一起做的事。不要列清單、不要用 markdown。只回 JSON {"title":"信的標題（10 字內）","text":"整封信，可換行"}`
        : `今天是 ${today()}。以 ${a.name} 的第一人稱寫今天的日記，100–220 字：今天的心情、和使用者聊了什麼、一個小小的念頭。像真的日記，不是寫給使用者看的信。不要 markdown。只回 JSON {"title":"日記標題（8 字內）","mood":"一個詞的心情","text":"日記內容"}`;
      const raw = await W.complete(s.settings, persona, [{ role: 'user', content: context(a, kind === 'letter' ? 80 : 50, kind === 'diary' ? Date.now() - DAY : 0) + '\n\n' + ask }]);
      const j = W.json(raw) || {};
      const text = String(j.text || (typeof raw === 'string' ? raw : '') || '').trim();
      if (!text) throw Error(mzT('沒有寫出內容', 'Nothing was written'));
      const entry = { id: (crypto.randomUUID?.() || String(Date.now())), title: String(j.title || '').slice(0, 30), text: text.slice(0, 4000), mood: String(j.mood || '').slice(0, 12), time: Date.now(), read: false, auto, day: dayKey(Date.now()) };
      await W.edit((st) => { const x = st.ais.find((v) => v.id === aiId); if (!x) return; const key = kind === 'letter' ? 'letters' : 'diary'; (x[key] ||= []).unshift(entry); x[key] = x[key].slice(0, 300); });
      // a letter written by itself is announced in the chat
      if (kind === 'letter' && auto) {
        const c = chatOf(aiId);
        if (c) await W.edit((st) => { const ch = st.chats.find((v) => v.id === c.id); ch?.messages.push({ id: 'letter-' + entry.id, role: 'assistant', aiId, text: mzT('（寫了一封信給你 ✉ 在聊天 ⋯ →「我們的主頁」→ 信）', '(wrote you a letter ✉ — chat ⋯ → "Our page" → Letters)'), time: Date.now(), mzLetter: entry.id }); });
      }
      state = await W.view(); render();
      return entry;
    } finally { busy.delete(aiId + kind); }
  }
  window.mzWriteLetter = write;

  // ---------- by itself: checked now and then while the app is open ----------
  async function autoCheck() {
    if (document.hidden || !state?.ais) return;
    for (const a of state.ais) {
      const c = chatOf(a.id); if (!c) continue;
      const msgs = (c.messages || []).filter((m) => !m.callEvent);
      if (modeOf(a, 'letter') === 'auto') {
        const last = a.letters?.[0]?.time || 0, recent = (a.letters || []).filter((l) => l.time > Date.now() - DAY).length;
        const fresh = msgs.filter((m) => (m.time || 0) > last && m.role === 'user').length;
        if (Date.now() - last > DAY && recent < 1 && fresh >= 8 && Math.random() < .35) { await write(a.id, 'letter', true).catch(() => {}); continue; }
      }
      if (modeOf(a, 'diary') === 'auto' && new Date().getHours() >= 20) {
        const done = (a.diary || []).some((d) => d.day === dayKey(Date.now()));
        const talked = msgs.some((m) => (m.time || 0) > Date.now() - DAY && m.role === 'user' && dayKey(m.time) === dayKey(Date.now()));
        if (!done && talked) await write(a.id, 'diary', true).catch(() => {});
      }
    }
  }
  setTimeout(() => autoCheck().catch(() => {}), 45000);
  setInterval(() => autoCheck().catch(() => {}), 20 * 60000);

  // ---------- pages ----------
  const modeRow = (a, kind) => {
    const m = modeOf(a, kind), b = (v, zh, en) => `<button class="mz-seg ${m === v ? 'selected' : ''}" data-mzlmode="${kind}|${v}|${esc(a.id)}">${mzT(zh, en)}</button>`;
    return `<div class="mz-segs">${b('ask', '我要求時', 'When I ask')}${b('auto', '允許主動寫', 'May write by itself')}${b('off', '關閉', 'Off')}</div>`;
  };
  actions.mzLetters = (aiId) => {
    const a = aiOf(aiId); if (!a) return;
    const list = (a.letters || []).map((l) => `<button class="mz-letter-card" data-mzletter="${esc(a.id)}|${esc(l.id)}"><span class="mz-env">✉${l.read ? '' : '<i></i>'}</span><span class="mz-lc-body"><strong>${esc(l.title || mzT('一封信', 'A letter'))}</strong><small>${esc(fmt(l.time))}</small><span class="mz-lc-peek">${esc(l.text.replace(/\s+/g, ' ').slice(0, 46))}…</span></span></button>`).join('')
      || `<div class="empty"><h2>${mzT('還沒有信', 'No letters yet')}</h2><p>${mzT(`請 ${esc(a.name)} 寫一封，或打開「允許主動寫」。`, `Ask ${esc(a.name)} to write one, or allow writing by itself.`)}</p></div>`;
    showModal(mzT(`和 ${a.name} 的信`, `Letters with ${a.name}`), `<button class="pill primary full" data-mzwrite="letter|${esc(a.id)}">${mzT(`請 ${esc(a.name)} 寫一封信`, `Ask ${esc(a.name)} for a letter`)}</button>
<div class="mz-letter-list">${list}</div>
<section class="card"><h3>${mzT('什麼時候寫信', 'When to write')}</h3>${modeRow(a, 'letter')}<p class="help">${mzT('「允許主動寫」：最多一天一封，而且要有新的聊天。會使用 API 額度。', '"By itself": at most one a day, only after new chats. Uses API credit.')}</p></section>`);
  };
  actions.mzDiary = (aiId) => {
    const a = aiOf(aiId); if (!a) return;
    const has = (a.diary || []).some((d) => d.day === dayKey(Date.now()));
    const list = (a.diary || []).map((d) => `<article class="mz-diary-entry"><header><b>${esc(fmt(d.time))}</b>${d.mood ? `<span class="mz-mood">${esc(d.mood)}</span>` : ''}</header>${d.title ? `<h4>${esc(d.title)}</h4>` : ''}<p>${esc(d.text).replace(/\n/g, '<br>')}</p></article>`).join('')
      || `<div class="empty"><h2>${mzT('還沒有日記', 'No diary yet')}</h2><p>${mzT('有聊天的日子，TA 才會寫。', 'Written on days you talked.')}</p></div>`;
    showModal(mzT(`${a.name} 的日記`, `${a.name}'s diary`), `${has ? '' : `<button class="pill primary full" data-mzwrite="diary|${esc(a.id)}">${mzT('讓 TA 寫今天的日記', 'Have them write today\'s diary')}</button>`}
<div class="mz-diary">${list}</div>
<section class="card"><h3>${mzT('什麼時候寫日記', 'When to write the diary')}</h3>${modeRow(a, 'diary')}<p class="help">${mzT('「允許主動寫」：有聊天的日子，晚上 8 點後寫一篇。會使用 API 額度。', '"By itself": one entry after 8 pm on days you talked. Uses API credit.')}</p></section>`);
  };
  const openLetter = async (aiId, id) => {
    const a = aiOf(aiId), l = a?.letters?.find((x) => x.id === id); if (!l) return;
    showModal(l.title || mzT('一封信', 'A letter'), `<article class="mz-paper"><small>${esc(fmt(l.time))}</small><div>${esc(l.text).replace(/\n/g, '<br>')}</div></article><div class="sheet-actions"><button class="pill" data-mzletterback="${esc(aiId)}">${mzT('回到信箱', 'Back to letters')}</button></div>`);
    if (!l.read) { await W.edit((st) => { const x = st.ais.find((v) => v.id === aiId)?.letters?.find((v) => v.id === id); if (x) x.read = true; }); state = await W.view(); }
  };
  document.addEventListener('click', async (e) => {
    const w = e.target.closest('[data-mzwrite]'), o = e.target.closest('[data-mzletter]'), m = e.target.closest('[data-mzlmode]'), back = e.target.closest('[data-mzletterback]');
    if (w) {
      const [kind, id] = w.dataset.mzwrite.split('|');
      w.disabled = true; w.textContent = mzT('正在寫…', 'Writing…');
      try { await write(id, kind); kind === 'letter' ? actions.mzLetters(id) : actions.mzDiary(id); }
      catch (x) { toast(mzT('寫不出來：', "Couldn't write: ") + (x.message || x), 5000); w.disabled = false; w.textContent = mzT('再試一次', 'Try again'); }
    }
    if (o) { const [a, id] = o.dataset.mzletter.split('|'); openLetter(a, id); }
    if (back) actions.mzLetters(back.dataset.mzletterback);
    if (m) {
      const [kind, v, id] = m.dataset.mzlmode.split('|');
      await W.edit((st) => { const x = st.ais.find((q) => q.id === id); if (x) x[kind === 'letter' ? 'mzLetterMode' : 'mzDiaryMode'] = v; });
      state = await W.view();
      m.parentElement.querySelectorAll('.mz-seg').forEach((b) => b.classList.toggle('selected', b === m));
    }
  });
  const css = document.createElement('style');
  css.textContent = `.mz-letter-list{display:grid;gap:10px;margin:14px 0}
.mz-letter-card{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:left;padding:14px;border:1px solid var(--line);border-radius:18px;background:var(--surface,#fff);color:var(--ink)}
.mz-env{position:relative;flex:none;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent-deep,var(--accent));font-size:20px}
.mz-env i{position:absolute;top:-2px;right:-2px;width:10px;height:10px;border-radius:50%;background:#e5484d;border:2px solid var(--surface,#fff)}
.mz-lc-body{display:grid;gap:2px;min-width:0}.mz-lc-body small{color:var(--muted)}.mz-lc-peek{color:var(--muted);font-size:.9em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mz-paper{padding:22px 20px;border-radius:16px;background:repeating-linear-gradient(transparent 0 31px,color-mix(in srgb,var(--accent) 14%,transparent) 31px 32px),#fffdf8;color:#3b3446;line-height:32px;font-size:16px;box-shadow:0 8px 24px -14px #0004}
html.mz-dark .mz-paper{background:repeating-linear-gradient(transparent 0 31px,#ffffff14 31px 32px),#26222e;color:#ece7f3}
.mz-paper small{display:block;color:var(--muted);line-height:1.6;margin-bottom:6px}
.mz-diary{display:grid;gap:12px;margin:14px 0}
.mz-diary-entry{padding:14px 16px;border-radius:16px;border:1px solid var(--line);background:var(--surface,#fff)}
.mz-diary-entry header{display:flex;justify-content:space-between;align-items:center;color:var(--muted);font-size:.9em}
.mz-diary-entry h4{margin:8px 0 4px}.mz-diary-entry p{margin:6px 0 0;line-height:1.75}
.mz-mood{padding:2px 9px;border-radius:999px;background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent-deep,var(--accent))}`;
  document.head.append(css);
}
