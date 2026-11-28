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
  const ui = { view: 'day', sel: key(new Date()), month: null, open: true }; // 3.4.4: the whole month by default
  const save = async (fn) => { await W.edit((s) => { s.settings.mzTodos ||= []; fn(s.settings.mzTodos); }); state = await W.view(); };
  const leftCount = () => { const k = key(new Date()); return todos().filter((t) => (t.weekly ? on(t, k) && !doneOn(t, k) : !t.done)).length; };
  window.mzTodoLeft = leftCount;
  // 3.4.4: the jELi pet's notebook (another window) lists / adds / ticks the same to-dos
  { const pc = window.BroadcastChannel ? new BroadcastChannel('mz-pet') : null;
    const send = (day) => { const k = day || key(new Date()); pc?.postMessage({ t: 'todos', day: k, items: todos().filter((t) => !t.date || t.date === k || on(t, k)).map((t) => ({ id: t.id, title: t.title || '', done: doneOn(t, k) })) }); };
    if (pc) pc.onmessage = async ({ data: m }) => {
      if (m?.t !== 'todo' || !window.WebEngine) return;
      const k = /^\d{4}-\d{2}-\d{2}$/.test(m.day || '') ? m.day : key(new Date());
      if (m.op === 'add' && String(m.title || '').trim()) await save((a) => a.push({ id: crypto.randomUUID?.() || String(Date.now()), created: Date.now(), done: false, title: String(m.title).trim().slice(0, 80), date: k }));
      if (m.op === 'toggle') await save((a) => { const t = a.find((x) => x.id === m.id); if (!t) return; if (t.weekly) { t.doneDays ||= []; const i = t.doneDays.indexOf(k); i < 0 ? t.doneDays.push(k) : t.doneDays.splice(i, 1); } else t.done = !t.done; });
      send(k); if (m.op !== 'list' && typeof render === 'function') render();
    }; }
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
<div class="mz-segs" style="--seg:${['day', 'all', 'none'].indexOf(ui.view)}">${seg('day', '日程', 'Calendar')}${seg('all', '全部', 'All')}${seg('none', '未安排 · ' + unscheduled.length, 'Unscheduled · ' + unscheduled.length)}</div><div class="mz-todo">${main}</div>`;
  };
  const show = () => { showModal(mzT('待辦與行事曆', 'To-do & calendar'), `<div class="mz-todo-wrap">${body()}</div>`); };
  // 3.4.4: changes are drawn inside the open popup (re-opening it made it flash); `slide` = -1 / 1 moves the changed
  // part out the way the finger went and the new one in from the other side
  const wrap = () => document.querySelector('.sheet .mz-todo-wrap');
  const refresh = (slide = 0, part = '') => {
    const w = wrap(); if (!w) return show();
    const sheet = w.closest('.sheet'), keep = sheet?.scrollTop || 0;
    const draw = () => {
      const was = w.querySelector('.mz-segs')?.style.getPropertyValue('--seg');
      w.innerHTML = body(); if (sheet) sheet.scrollTop = keep;
      const segs = w.querySelector('.mz-segs'), now = segs?.style.getPropertyValue('--seg');
      if (segs && was !== undefined && was !== now) { segs.style.setProperty('--seg', was); void segs.offsetWidth; segs.style.setProperty('--seg', now); }
    };
    const target = () => (part ? w.querySelector(part) : null);
    const t = slide && target();
    if (!t || matchMedia('(prefers-reduced-motion: reduce)').matches) return draw();
    const width = t.clientWidth || 300;
    t.style.transition = 'transform .15s cubic-bezier(.4,0,1,1), opacity .15s'; t.style.transform = `translateX(${-slide * width * 0.6}px)`; t.style.opacity = '0';
    setTimeout(() => {
      draw(); const n = target(); if (!n) return;
      n.style.transition = 'none'; n.style.transform = `translateX(${slide * width * 0.6}px)`; n.style.opacity = '0'; void n.offsetWidth;
      n.style.transition = 'transform .28s cubic-bezier(.2,.9,.3,1.05), opacity .2s'; n.style.transform = ''; n.style.opacity = '';
    }, 140);
  };
  const VIEWS = ['day', 'all', 'none'];
  const moveMonth = (n) => {
    const d = parse(ui.sel);
    if (ui.open) { const m = ui.month ? parse(ui.month) : new Date(d.getFullYear(), d.getMonth(), 1); m.setMonth(m.getMonth() + n); ui.month = key(m); ui.sel = key(m); }
    else { d.setDate(d.getDate() + 7 * n); ui.sel = key(d); }
    refresh(n, '.mz-cal-grid');
  };
  const moveView = (n) => { const i = VIEWS.indexOf(ui.view) + n; if (i < 0 || i >= VIEWS.length) return false; ui.view = VIEWS[i]; refresh(n, '.mz-todo'); return true; };
  // swipe: on the calendar = another month (or week); anywhere else in the popup = 日程 / 全部 / 未安排; mouse drags too
  let sw = null, swallow = false;
  const swStart = (x, y, t) => { if (!t.closest?.('.sheet .mz-todo-wrap') || t.closest('input,textarea,select')) return; sw = { x, y, dx: 0, cal: !!t.closest('.mz-cal'), axis: '' }; };
  const swMove = (x, y, ev) => {
    if (!sw) return; const dx = x - sw.x, dy = y - sw.y;
    if (!sw.axis && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) sw.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'y';
    if (sw.axis !== 'x') return; if (ev?.cancelable) ev.preventDefault(); sw.dx = dx;
    const t = wrap()?.querySelector(sw.cal ? '.mz-cal-grid' : '.mz-todo'); if (t) { t.style.transition = 'none'; t.style.transform = `translateX(${dx * 0.6}px)`; }
  };
  const swEnd = () => {
    if (!sw) return; const d = sw; sw = null; if (d.axis !== 'x') return;
    const t = wrap()?.querySelector(d.cal ? '.mz-cal-grid' : '.mz-todo');
    const dir = d.dx < 0 ? 1 : -1, go = Math.abs(d.dx) > 50;
    const back = () => { if (t) { t.style.transition = 'transform .22s cubic-bezier(.2,.8,.2,1)'; t.style.transform = ''; } };
    swallow = Math.abs(d.dx) > 6; setTimeout(() => (swallow = false), 80);
    if (!go) return back();
    if (d.cal) moveMonth(dir); else if (!moveView(dir)) back();
  };
  document.addEventListener('touchstart', (e) => { if (e.touches.length === 1) swStart(e.touches[0].clientX, e.touches[0].clientY, e.target); }, { passive: true, capture: true });
  document.addEventListener('touchmove', (e) => { if (sw) swMove(e.touches[0].clientX, e.touches[0].clientY, e); }, { passive: false, capture: true });
  document.addEventListener('touchend', swEnd, { capture: true });
  document.addEventListener('mousedown', (e) => { if (e.button === 0) swStart(e.clientX, e.clientY, e.target); }, true);
  document.addEventListener('mousemove', (e) => { if (sw) { if (!(e.buttons & 1)) return swEnd(); swMove(e.clientX, e.clientY, e); } }, true);
  document.addEventListener('mouseup', () => { if (sw) swEnd(); }, true);
  document.addEventListener('click', (e) => { if (swallow && e.target.closest?.('.sheet .mz-todo-wrap')) { e.preventDefault(); e.stopImmediatePropagation(); swallow = false; } }, true);
  actions.mzTodo = () => { ui.view = 'day'; ui.sel = key(new Date()); ui.month = ui.open ? key(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) : null; show(); };
  const form = (t = {}) => showModal(t.id ? mzT('編輯事項', 'Edit item') : mzT('新增事項', 'New item'), `<label class="mz-field"><span>${mzT('事項', 'What')}</span><input id="mzTdTitle" maxlength="80" value="${esc(t.title || '')}"></label>
<label class="mz-field"><span>${mzT('日期（不填就是未安排）', 'Date (empty = unscheduled)')}</span><input id="mzTdDate" type="date" value="${esc(t.date || (t.id ? '' : ui.sel))}"></label>
<div class="mz-todo-row"><label class="mz-field"><span>${mzT('開始', 'Start')}</span><input id="mzTdStart" type="time" value="${esc(t.start || '')}"></label><label class="mz-field"><span>${mzT('結束', 'End')}</span><input id="mzTdEnd" type="time" value="${esc(t.end || '')}"></label></div>
<label class="mz-field"><span>${mzT('地點', 'Place')}</span><input id="mzTdPlace" maxlength="60" value="${esc(t.place || '')}"></label>
<label class="check-row"><span>${mzT('每週重複（例如課程）', 'Every week (e.g. a class)')}</span><input id="mzTdWeekly" type="checkbox" ${t.weekly ? 'checked' : ''}></label>
<div class="sheet-actions">${t.id ? `<button class="pill danger" data-mztododel="${esc(t.id)}">${mzT('刪除', 'Delete')}</button>` : ''}<button class="pill" data-mztodoback>${mzT('取消', 'Cancel')}</button><button class="pill primary" data-mztodosave="${esc(t.id || '')}">${mzT('儲存', 'Save')}</button></div>`);
  document.addEventListener('click', async (e) => {
    const q = (s) => e.target.closest(s);
    let b;
    if ((b = q('[data-mztodoview]'))) { const n = VIEWS.indexOf(b.dataset.mztodoview) - VIEWS.indexOf(ui.view); if (n) { ui.view = b.dataset.mztodoview; refresh(Math.sign(n), '.mz-todo'); } }
    else if ((b = q('[data-mzday]'))) { ui.sel = b.dataset.mzday; const d = parse(ui.sel); if (ui.open && ui.month && parse(ui.month).getMonth() !== d.getMonth()) ui.month = key(new Date(d.getFullYear(), d.getMonth(), 1)); refresh(); }
    else if (q('[data-mzcaltoggle]')) { ui.open = !ui.open; ui.month = ui.open ? key(new Date(parse(ui.sel).getFullYear(), parse(ui.sel).getMonth(), 1)) : null; refresh(); }
    else if ((b = q('[data-mzcalmove]'))) moveMonth(Number(b.dataset.mzcalmove));
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
.mz-cal-day{position:relative;border:0;background:none;color:var(--ink);height:42px;min-width:0;padding:0;display:grid;place-items:center;font-variant-numeric:tabular-nums}
.mz-cal-day span{display:grid;place-items:center;width:32px;max-width:100%;aspect-ratio:1;line-height:1;box-sizing:border-box;border-radius:50%}
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
.mz-todo .mz-todo-none{text-align:center;margin:18px 0}
/* 3.4.4: smaller so the whole popup fits when it opens; the chosen tab has no fill (just bold + its underline) */
.mz-cal{padding:8px 10px 4px;margin:8px 0}.mz-cal-head{margin-bottom:2px;gap:8px}
html:root body .mz-cal-head>:is(.icon-button,.pill){box-sizing:border-box;height:32px!important;min-height:32px!important;margin:0!important;display:inline-flex!important;align-items:center;justify-content:center;line-height:1;vertical-align:middle}
html:root body .mz-cal-head>.icon-button{width:32px!important;min-width:32px!important;padding:0!important}
html:root body .mz-cal-head>.pill{padding:0 12px!important;font-size:13px}
.mz-cal-title{font-size:15px}.mz-cal-w{padding:0 0 2px}
.mz-cal-day{height:30px}.mz-cal-day span{width:26px;height:26px;font-size:13px}.mz-cal-day i{bottom:0}
.mz-cal-grip{margin:3px auto 1px}.mz-todo-h{margin:8px 2px 6px}
html:root:root:root:root body .sheet .mz-segs .mz-seg.mz-seg.selected.selected{background:transparent!important;box-shadow:none!important;border-color:transparent!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
html:root .sheet .mz-segs .mz-seg.selected::before{display:none!important}
.mz-todo-wrap{overflow:hidden}.mz-cal-grid,.mz-todo{will-change:transform;touch-action:pan-y}
`;
  document.head.append(css);
}
