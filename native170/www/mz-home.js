'use strict';
// 3.4.1: 「我們的主頁」 — one page for you and one AI (from the AI chat's ⋯ sheet, at the top).
// Both avatars, 認識的第 N 天 (counted from your first message, or a day you choose), how many messages you've
// exchanged, letters, diary entries and finished to-dos, and the doors to 信 / 日記 / 記憶海圖 / 待辦.
{
  const W = window.WebEngine, DAY = 86400000;
  const aiOf = (id) => state.ais.find((a) => a.id === id);
  const chatOf = (id) => state.chats.find((c) => (c.members || []).length === 1 && c.members[0] === id);
  const startOf = (a) => {
    if (a.mzMetAt) return a.mzMetAt;
    const first = (chatOf(a.id)?.messages || []).find((m) => m.time)?.time;
    return first || a.created || Date.now();
  };
  const daysSince = (t) => { const a = new Date(t), b = new Date(); a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0); return Math.round((b - a) / DAY) + 1; };
  const svg = (d) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  const ICON = { mail: 'M3 6h18v12H3z M3 7l9 7 9-7', book: 'M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z M5 17a3 3 0 0 1 3-3h11', map: 'M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3z M9 4v13 M15 7v13', cal: 'M4 6h16v14H4z M4 10h16 M8 3v5 M16 3v5' };
  const row = (action, icon, title, sub, dot) => `<button class="mz-home-row" data-mzhomego="${action}"><span class="mz-home-ic">${svg(ICON[icon])}${dot ? '<i></i>' : ''}</span><span class="mz-home-t"><b>${title}</b><small>${sub}</small></span><span class="chevron">›</span></button>`;
  actions.mzHome = (aiId) => {
    const a = aiOf(aiId || state.chats.find((c) => c.id === chatId)?.members?.[0]); if (!a) return;
    const h = humanData(), me = h.me || {}, myName = me.name || state.settings.nickname || mzT('我', 'Me'), myPic = me.avatar || state.settings.avatar || '';
    const c = chatOf(a.id), msgs = (c?.messages || []).filter((m) => !m.callEvent && (m.text || m.images?.length));
    const letters = a.letters || [], diary = a.diary || [], unread = letters.filter((l) => !l.read).length;
    const mem = c?.memories?.[a.id]?.summary || '', memCount = mem ? mem.split(/[。！？\n]+/).filter((x) => x.trim().length > 3).length : 0;
    const start = startOf(a), d = new Date(start), en = window.MushuiLocale === 'en';
    const from = d.toLocaleDateString(en ? 'en' : 'zh-TW', { month: 'long', day: 'numeric', weekday: 'long' });
    const left = window.mzTodoLeft?.() || 0, doneTodos = window.mzTodoDone?.() || 0;
    showModal(mzT('我們的主頁', 'Our page'), `<section class="card mz-home-hero">
<div class="mz-home-pair"><div>${avatar({ name: myName, avatar: myPic })}<b>${esc(myName)}</b><small>${mzT('我', 'Me')}</small></div><span class="mz-home-spark">✧</span><div>${avatar(a)}<b>${esc(a.name)}</b><small>TA</small></div></div>
<h3 class="mz-home-days">${mzT(`認識的第 ${daysSince(start)} 天`, `Day ${daysSince(start)} together`)}</h3>
<button class="mz-home-from" data-mzhomedate="${esc(a.id)}">${mzT(`從 ${from} 算起 · 點這裡改`, `Since ${from} · tap to change`)}</button>
<div class="mz-home-stats"><div><b>${msgs.length.toLocaleString()}</b><small>${mzT('句話', 'messages')}</small></div><div><b>${letters.length}</b><small>${mzT('封信', 'letters')}</small></div><div><b>${diary.length}</b><small>${mzT('篇 TA 的日記', 'diary entries')}</small></div><div><b>${doneTodos}</b><small>${mzT('件做完的事', 'things done')}</small></div></div></section>
<div class="mz-home-rows">
${row('letters', 'mail', mzT('信', 'Letters'), letters.length ? mzT(`${letters.length} 封信${unread ? ` · ${unread} 封沒看` : ''}`, `${letters.length} letters${unread ? ` · ${unread} unread` : ''}`) : mzT('還沒有信', 'No letters yet'), unread)}
${row('diary', 'book', mzT('日記', 'Diary'), diary.length ? mzT(`${esc(a.name)} 寫了 ${diary.length} 篇`, `${diary.length} entries`) : mzT('還沒有日記', 'No diary yet'))}
${row('memory', 'map', mzT('記憶', 'Memory'), memCount ? mzT(`${esc(a.name)} 記著 ${memCount} 件事`, `${memCount} things remembered`) : mzT('打開記憶海圖', 'Open the memory sea chart'))}
${row('todo', 'cal', mzT('待辦', 'To-do'), left ? mzT(`還有 ${left} 件`, `${left} left`) : mzT('今天都做完了', 'All done for today'))}
</div>`);
    document.querySelector('.sheet')?.setAttribute('data-mzhome', a.id);
  };
  document.addEventListener('click', async (e) => {
    const go = e.target.closest('[data-mzhomego]'), dt = e.target.closest('[data-mzhomedate]');
    if (go) {
      const id = go.closest('[data-mzhome]')?.dataset.mzhome, k = go.dataset.mzhomego;
      if (k === 'letters') actions.mzLetters(id); else if (k === 'diary') actions.mzDiary(id); else if (k === 'memory') actions.mzMemoryMap?.(id); else if (k === 'todo') actions.mzTodo();
    }
    if (dt) {
      const id = dt.dataset.mzhomedate, a = aiOf(id), d = new Date(startOf(a));
      const v = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      showModal(mzT('從哪一天算起', 'Count from which day'), `<label class="mz-field"><span>${mzT('認識的那一天', 'The day you met')}</span><input id="mzHomeDate" type="date" value="${v}" max="${new Date().toISOString().slice(0, 10)}"></label><div class="sheet-actions"><button class="pill" data-mzhomereset="${esc(id)}">${mzT('用第一則訊息', 'Use the first message')}</button><button class="pill primary" data-mzhomesave="${esc(id)}">${mzT('儲存', 'Save')}</button></div>`);
    }
    const sv = e.target.closest('[data-mzhomesave]'), rs = e.target.closest('[data-mzhomereset]');
    if (sv || rs) {
      const id = (sv || rs).dataset[sv ? 'mzhomesave' : 'mzhomereset'], val = document.getElementById('mzHomeDate')?.value;
      const t = sv && val ? new Date(val + 'T00:00:00').getTime() : null;
      await W.edit((s) => { const x = s.ais.find((q) => q.id === id); if (!x) return; if (t) x.mzMetAt = t; else delete x.mzMetAt; });
      state = await W.view(); actions.mzHome(id);
    }
  });
  // entry: the AI chat's ⋯ sheet, first thing
  try {
    new MutationObserver(() => {
      const sheet = document.querySelector('#overlay .sheet'); if (!sheet || sheet.querySelector('.mz-home-entry')) return;
      if (!sheet.querySelector('[data-action="deleteChat"]') || typeof chatId !== 'string' || chatId.startsWith('human:')) return;
      const c = state.chats.find((x) => x.id === chatId); if (!c || (c.members || []).length !== 1) return;
      const a = aiOf(c.members[0]); if (!a) return;
      const unread = (a.letters || []).filter((l) => !l.read).length;
      const b = document.createElement('button'); b.className = 'setting-choice full mz-home-entry'; b.dataset.action = 'mzHome';
      b.innerHTML = `<span>${mzT('我們的主頁', 'Our page')}${unread ? ` <span class="mz-home-badge">${unread}</span>` : ''}</span><span>${mzT(`認識的第 ${daysSince(startOf(a))} 天`, `Day ${daysSince(startOf(a))}`)} ›</span>`;
      const first = sheet.querySelector(':scope > .card, :scope > .mz-wl-card'); first ? first.before(b) : sheet.append(b);
    }).observe(document.getElementById('overlay'), { childList: true, subtree: true });
  } catch {}
  const css = document.createElement('style');
  css.textContent = `.mz-home-hero{text-align:center;padding:20px 14px 16px}
.mz-home-pair{display:flex;align-items:center;justify-content:center;gap:18px}
.mz-home-pair>div{display:grid;justify-items:center;gap:4px;min-width:0}.mz-home-pair .avatar{width:74px;height:74px;font-size:26px}
.mz-home-pair small{color:var(--muted);font-size:12px}.mz-home-spark{color:var(--accent);font-size:20px;align-self:flex-start;margin-top:24px}
.mz-home-days{margin:16px 0 2px;color:var(--accent-deep,var(--accent));font-size:20px}
.mz-home-from{border:0;background:none;color:var(--muted);font-size:12px;padding:2px 6px}
.mz-home-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:14px}
.mz-home-stats b{display:block;font-size:20px;font-variant-numeric:tabular-nums}.mz-home-stats small{color:var(--muted);font-size:11px}
.mz-home-rows{display:grid;gap:10px;margin-top:12px}
.mz-home-row{display:flex;align-items:center;gap:12px;width:100%;padding:14px;border:1px solid var(--line);border-radius:18px;background:var(--surface,#fff);color:var(--ink);text-align:left}
.mz-home-ic{position:relative;flex:none;width:36px;height:36px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 12%,transparent);color:var(--accent-deep,var(--accent))}
.mz-home-ic i{position:absolute;top:-2px;right:-2px;width:9px;height:9px;border-radius:50%;background:#e5484d}
.mz-home-t{flex:1;display:grid;gap:2px;min-width:0}.mz-home-t small{color:var(--muted)}
.mz-home-entry{display:flex;justify-content:space-between;align-items:center;width:100%}
.mz-home-badge{display:inline-grid;place-items:center;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#e5484d;color:#fff;font-size:11px;font-variant-numeric:tabular-nums}`;
  document.head.append(css);
}
