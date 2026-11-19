'use strict';
// 3.4.1: to-do and calendar (我 → 待辦與行事曆, and from 「我們的主頁」).
//  - 日程: this week's row (tap ⌄ to open the whole month), dots on days with something, the chosen day's list
//  - 全部: everything by date; 未安排: items without a date
//  - items: title, date (optional), start–end time, place, "every week" (for classes), done / not done
//  - your AIs are told today's plan in their prompt, so they can remind you or ask how it went
// Stored in settings.mzTodos (synced with the account like other settings).
{
  const W = window.WebEngine;
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'], WEEK_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const key = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const parse = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const todos = () => state?.settings?.mzTodos || [];
  // does an item happen on day k? (a dated item on its day; a weekly one on the same weekday from its first day)
  const on = (t, k) => t.date && (t.date === k || (t.weekly && k >= t.date && parse(k).getDay() === parse(t.date).getDay()));
  const doneOn = (t, k) => (t.weekly ? (t.doneDays || []).includes(k) : !!t.done);
  const dayItems = (k) => todos().filter((t) => on(t, k)).sort((a, b) => (a.start || '99').localeCompare(b.start || '99'));
  const ui = { view: 'day', sel: key(new Date()), month: null, open: false };
  const save = async (fn) => { await W.edit((s) => { s.settings.mzTodos ||= []; fn(s.settings.mzTodos); }); state = await W.view(); };
  const leftCount = () => { const k = key(new Date()); return todos().filter((t) => (t.weekly ? on(t, k) && !doneOn(t, k) : !t.done)).length; };
  window.mzTodoLeft = leftCount;
  window.mzTodoDone = () => todos().reduce((n, t) => n + (t.weekly ? (t.doneDays || []).length : t.done ? 1 : 0), 0);

  const item = (t, k) => {
    const done = k ? doneOn(t, k) : t.weekly ? false : !!t.done;
    const when = [t.start && (t.start + (t.end ? '–' + t.end : '')), t.place].filter(Boolean).join(' · ') || (t.date ? (t.weekly ? mzT('每週', 'Weekly') : '') : mzT('未安排', 'Unscheduled'));
    return `<div class="mz-todo-item ${done ? 'done' : ''}"><button class="mz-todo-check" data-mztodocheck="${esc(t.id)}|${k || ''}" aria-label="${mzT('完成', 'Done')}">${done ? '✓' : ''}</button><button class="mz-todo-main" data-mztodoedit="${esc(t.id)}"><strong>${esc(t.title)}</strong><small>${esc(when)}${t.weekly ? ' ↻' : ''}</small></button></div>`;
  };
  const calendar = () => {
    const sel = parse(ui.sel), base = ui.month ? parse(ui.month) : new Date(sel.getFullYear(), sel.getMonth(), 1), today = key(new Date()), en = window.MushuiLocale === 'en';
    const cell = (d) => { const k = key(d), has = dayItems(k).length, other = d.getMonth() !== base.getMonth();
      return `<button class="mz-cal-day ${k === ui.sel ? 'sel' : ''} ${k === today ? 'today' : ''} ${other ? 'other' : ''}" data-mzday="${k}"><span>${d.getDate()}</span>${has ? '<i></i>' : ''}</button>`; };
    let days = [];
    if (ui.open) { const first = new Date(base.getFullYear(), base.getMonth(), 1), start = new Date(first); start.setDate(1 - first.getDay());
      for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); if (i >= 35 && d.getMonth() !== base.getMonth()) break; days.push(d); } }
    else { const start = new Date(sel); start.setDate(sel.getDate() - sel.getDay()); for (let i = 0; i < 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); days.push(d); } }
    const title = en ? base.toLocaleDateString('en', { year: 'numeric', month: 'long' }) : `${base.getFullYear()}年${base.getMonth() + 1}月`;
    return `<section class="card mz-cal"><div class="mz-cal-head"><button class="mz-cal-title" data-mzcaltoggle>${title} <span>${ui.open ? '⌃' : '⌄'}</span></button><span class="spacer"></span><button class="icon-button" data-mzcalmove="-1" aria-label="${mzT('上一個', 'Previous')}">‹</button><button class="pill" data-mzcaltoday>${mzT('今天', 'Today')}</button><button class="icon-button" data-mzcalmove="1" aria-label="${mzT('下一個', 'Next')}">›</button></div>
<div class="mz-cal-grid">${(en ? WEEK_EN : WEEK).map((w) => `<span class="mz-cal-w">${w}</span>`).join('')}${days.map(cell).join('')}</div><button class="mz-cal-grip" data-mzcaltoggle aria-label="${mzT('展開或收起月曆', 'Open or close the month')}"></button></section>`;
  };
  const body = () => {
    const unscheduled = todos().filter((t) => !t.date), seg = (v, zh, en) => `<button class="mz-seg ${ui.view === v ? 'selected' : ''}" data-mztodoview="${v}">${mzT(zh, en)}</button>`;
    let main = '';
    if (ui.view === 'day') {
      const list = dayItems(ui.sel), label = ui.sel === key(new Date()) ? mzT('今天的安排', "Today's plan") : (window.MushuiLocale === 'en' ? parse(ui.sel).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : `${parse(ui.sel).getMonth() + 1}月${parse(ui.sel).getDate()}日的安排`);
      main = calendar() + `<div class="mz-todo-h"><b>${label}</b><small>${list.length} ${mzT('項', 'items')}</small></div>` + (list.map((t) => item(t, ui.sel)).join('') || `<p class="help mz-todo-none">${mzT('這天沒有安排。點右上角「＋」加一項。', 'Nothing this day. Tap ＋ to add one.')}</p>`);
    } else if (ui.view === 'all') {
      const dated = todos().filter((t) => t.date).sort((a, b) => a.date.localeCompare(b.date) || (a.start || '').localeCompare(b.start || ''));
      main = dated.map((t) => `<div class="mz-todo-date">${esc(t.date)}${t.weekly ? ' ↻' : ''}</div>` + item(t, t.weekly ? key(new Date()) : '')).join('') || `<p class="help">${mzT('還沒有任何事項。', 'Nothing yet.')}</p>`;
    } else main = unscheduled.map((t) => item(t, '')).join('') || `<p class="help">${mzT('沒有未安排的事項。', 'Nothing unscheduled.')}</p>`;
    return `<div class="mz-todo-top"><span class="small">${mzT(`還有 ${leftCount()} 件`, `${leftCount()} left`)}</span><button class="pill primary" data-mztodoadd>＋ ${mzT('新增', 'Add')}</button></div>
<div class="mz-segs">${seg('day', '日程', 'Calendar')}${seg('all', '全部', 'All')}${seg('none', '未安排 · ' + unscheduled.length, 'Unscheduled · ' + unscheduled.length)}</div><div class="mz-todo">${main}</div>`;
  };
  const show = () => { showModal(mzT('待辦與行事曆', 'To-do & calendar'), body()); };
  const refresh = () => { const box = document.querySelector('.sheet .mz-todo')?.closest('.sheet'); if (!box) return show(); const keep = box.scrollTop; show(); const n = document.querySelector('.sheet'); if (n) n.scrollTop = keep; };
  actions.mzTodo = () => { ui.view = 'day'; ui.sel = key(new Date()); ui.month = null; show(); };
  const form = (t = {}) => showModal(t.id ? mzT('編輯事項', 'Edit item') : mzT('新增事項', 'New item'), `<label class="mz-field"><span>${mzT('事項', 'What')}</span><input id="mzTdTitle" maxlength="80" value="${esc(t.title || '')}"></label>
<label class="mz-field"><span>${mzT('日期（不填就是未安排）', 'Date (empty = unscheduled)')}</span><input id="mzTdDate" type="date" value="${esc(t.date || (t.id ? '' : ui.sel))}"></label>
<div class="mz-todo-row"><label class="mz-field"><span>${mzT('開始', 'Start')}</span><input id="mzTdStart" type="time" value="${esc(t.start || '')}"></label><label class="mz-field"><span>${mzT('結束', 'End')}</span><input id="mzTdEnd" type="time" value="${esc(t.end || '')}"></label></div>
<label class="mz-field"><span>${mzT('地點', 'Place')}</span><input id="mzTdPlace" maxlength="60" value="${esc(t.place || '')}"></label>
<label class="check-row"><span>${mzT('每週重複（例如課程）', 'Every week (e.g. a class)')}</span><input id="mzTdWeekly" type="checkbox" ${t.weekly ? 'checked' : ''}></label>
<div class="sheet-actions">${t.id ? `<button class="pill danger" data-mztododel="${esc(t.id)}">${mzT('刪除', 'Delete')}</button>` : ''}<button class="pill" data-mztodoback>${mzT('取消', 'Cancel')}</button><button class="pill primary" data-mztodosave="${esc(t.id || '')}">${mzT('儲存', 'Save')}</button></div>`);
  document.addEventListener('click', async (e) => {
    const q = (s) => e.target.closest(s);
    let b;
    if ((b = q('[data-mztodoview]'))) { ui.view = b.dataset.mztodoview; refresh(); }
    else if ((b = q('[data-mzday]'))) { ui.sel = b.dataset.mzday; const d = parse(ui.sel); if (ui.open && ui.month && parse(ui.month).getMonth() !== d.getMonth()) ui.month = key(new Date(d.getFullYear(), d.getMonth(), 1)); refresh(); }
    else if (q('[data-mzcaltoggle]')) { ui.open = !ui.open; ui.month = ui.open ? key(new Date(parse(ui.sel).getFullYear(), parse(ui.sel).getMonth(), 1)) : null; refresh(); }
    else if ((b = q('[data-mzcalmove]'))) {
      const n = Number(b.dataset.mzcalmove), d = parse(ui.sel);
      if (ui.open) { const m = ui.month ? parse(ui.month) : new Date(d.getFullYear(), d.getMonth(), 1); m.setMonth(m.getMonth() + n); ui.month = key(m); ui.sel = key(m); }
      else { d.setDate(d.getDate() + 7 * n); ui.sel = key(d); }
      refresh();
    }
    else if (q('[data-mzcaltoday]')) { ui.sel = key(new Date()); ui.month = ui.open ? key(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) : null; refresh(); }
    else if (q('[data-mztodoadd]')) form();
    else if ((b = q('[data-mztodoedit]'))) form(todos().find((t) => t.id === b.dataset.mztodoedit));
    else if (q('[data-mztodoback]')) show();
    else if ((b = q('[data-mztodocheck]'))) {
      const [id, k] = b.dataset.mztodocheck.split('|');
      await save((list) => { const t = list.find((x) => x.id === id); if (!t) return; if (t.weekly && k) { t.doneDays ||= []; t.doneDays = t.doneDays.includes(k) ? t.doneDays.filter((x) => x !== k) : [...t.doneDays, k].slice(-200); } else t.done = !t.done; });
      refresh();
    }
    else if ((b = q('[data-mztododel]'))) { const id = b.dataset.mztododel; await save((list) => { const i = list.findIndex((x) => x.id === id); if (i >= 0) list.splice(i, 1); }); show(); toast(mzT('已刪除', 'Deleted')); }
    else if ((b = q('[data-mztodosave]'))) {
      const v = (id) => document.getElementById(id)?.value.trim() || '', title = v('mzTdTitle');
      if (!title) { toast(mzT('先寫下事項', 'Write what it is first')); return; }
      const data = { title, date: v('mzTdDate'), start: v('mzTdStart'), end: v('mzTdEnd'), place: v('mzTdPlace'), weekly: !!document.getElementById('mzTdWeekly')?.checked };
      if (data.weekly && !data.date) data.date = ui.sel;
      const id = b.dataset.mztodosave;
      await save((list) => { if (id) Object.assign(list.find((x) => x.id === id) || {}, data); else list.push({ id: crypto.randomUUID?.() || String(Date.now()), created: Date.now(), done: false, ...data }); });
      if (data.date) ui.sel = data.date;
      ui.view = data.date ? 'day' : 'none'; show();
    }
  });
  // Me page entry
  const renderBefore = render;
  render = function (...a) {
    const r = renderBefore.apply(this, a);
    try {
      if (tab === 'settings' && !page && !chatId && !document.querySelector('[data-action="mzTodo"]')) {
        const group = document.querySelector('#app .wx-menu-group');
        group?.insertAdjacentHTML('afterbegin', `<button class="wx-menu-row" data-action="mzTodo"><span class="wx-menu-icon color" aria-hidden="true"><svg class="icon" viewBox="0 0 24 24"><path d="M4 6h16v14H4z M4 10h16 M8 3v5 M16 3v5 M8 14l2.5 2.5L16 13"/></svg></span><b>${mzT('待辦與行事曆', 'To-do & calendar')}</b><span class="spacer"></span><small>${leftCount() ? mzT(`還有 ${leftCount()} 件`, `${leftCount()} left`) : ''}</small><span class="chevron">›</span></button>`);
      }
    } catch {}
    return r;
  };
  // the AIs know today's plan
  const systemBefore = W.system;
  W.system = function (a, ...rest) {
    let s = systemBefore.call(this, a, ...rest);
    try {
      const k = key(new Date()), now = new Date(), hm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      const plan = dayItems(k).map((t) => `${t.start ? t.start + (t.end ? '–' + t.end : '') + ' ' : ''}${t.title}${t.place ? '（' + t.place + '）' : ''}${doneOn(t, k) ? '［已完成］' : t.end && t.end < hm ? '［時間已過］' : ''}`);
      const loose = todos().filter((t) => !t.date && !t.done).slice(0, 6).map((t) => t.title);
      if (plan.length || loose.length) s += `\n使用者的行程（現在 ${hm}）：${plan.length ? '今天 ' + plan.join('；') : '今天沒有安排'}${loose.length ? '。還沒排時間的待辦：' + loose.join('、') : ''}。可以自然地關心、提醒或問進度，但不要每次都提。`;
    } catch {}
    return s;
  };
  const css = document.createElement('style');
  css.textContent = `.mz-todo-top{display:flex;align-items:center;justify-content:space-between;margin:0 0 10px}
.mz-cal{padding:12px 12px 6px;margin:12px 0}.mz-cal-head{display:flex;align-items:center;gap:6px;margin-bottom:8px}
.mz-cal-title{border:0;background:none;font-weight:700;font-size:17px;color:var(--ink);padding:4px}.mz-cal-title span{font-size:12px;color:var(--muted)}
.mz-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px;text-align:center}
.mz-cal-w{font-size:11px;color:var(--muted);padding:2px 0 6px}
.mz-cal-day{position:relative;border:0;background:none;color:var(--ink);height:42px;display:grid;place-items:center;font-variant-numeric:tabular-nums}
.mz-cal-day span{display:grid;place-items:center;width:32px;height:32px;border-radius:50%}
.mz-cal-day.today span{color:var(--accent-deep,var(--accent));font-weight:700}
.mz-cal-day.sel span{background:var(--accent);color:#fff}
.mz-cal-day.other{opacity:.38}
.mz-cal-day i{position:absolute;bottom:2px;left:50%;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:var(--accent)}
.mz-cal-grip{display:block;width:36px;height:5px;margin:6px auto 2px;border:0;border-radius:3px;background:var(--line);padding:0}
.mz-todo-h{display:flex;justify-content:space-between;align-items:baseline;margin:14px 2px 8px}
.mz-todo-item{display:flex;align-items:center;gap:10px;padding:10px 12px;margin:0 0 8px;border:1px solid var(--line);border-radius:16px;background:var(--surface,#fff)}
.mz-todo-check{flex:none;width:26px;height:26px;border-radius:50%;border:2px solid var(--accent);background:transparent;color:#fff;font-size:14px;padding:0}
.mz-todo-item.done .mz-todo-check{background:var(--accent)}
.mz-todo-item.done strong{text-decoration:line-through;opacity:.55}
.mz-todo-main{flex:1;min-width:0;display:grid;gap:2px;text-align:left;border:0;background:none;color:var(--ink);padding:0}
.mz-todo-main strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mz-todo-main small{color:var(--muted);font-variant-numeric:tabular-nums}
.mz-todo-date{font-size:12px;color:var(--muted);margin:12px 2px 6px;font-variant-numeric:tabular-nums}
.mz-todo-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mz-field{display:grid;gap:6px;margin:0 0 12px}.mz-field>span{font-size:13px;color:var(--muted)}
.mz-todo .mz-todo-none{text-align:center;margin:18px 0}`;
  document.head.append(css);
}
