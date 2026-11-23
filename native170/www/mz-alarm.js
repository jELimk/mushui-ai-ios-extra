'use strict';
// 3.4.4: 鬧鐘 (alarms). 我 → 鬧鐘 lists them (on / off, repeat days, a label, who set it). Your AIs can set one when you
// ask, and on their own when they see something in your calendar (mz-todo.js already tells them today's plan): they
// write [鬧鐘:07:30 起床], [鬧鐘:2026-11-21 14:00 開會] or [鬧鐘:每天 07:30 起床] / 平日 / 週末, the tag is taken out of the
// message and the alarm is saved. Stored in settings.mzAlarms (synced with the account); each device rings by itself.
// It rings while Mizuki is running (open, or kept alive in the background); a phone can stop a closed app from ringing.
{
  const W = window.WebEngine;
  const pad = (n) => String(n).padStart(2, '0');
  const key = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const alarms = () => state?.settings?.mzAlarms || [];
  const save = async (fn) => { await W.edit((s) => { s.settings.mzAlarms ||= []; fn(s.settings.mzAlarms); }); state = await W.view(); };
  const DAYS = ['日', '一', '二', '三', '四', '五', '六'], DAYS_EN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const repeatText = (a) => {
    if (a.date) return a.date;
    const d = a.days || [];
    if (!d.length) return mzT('一次', 'Once');
    if (d.length === 7) return mzT('每天', 'Every day');
    if (d.join() === '1,2,3,4,5') return mzT('平日', 'Weekdays');
    if (d.join() === '0,6') return mzT('週末', 'Weekends');
    return d.map((x) => mzT('週' + DAYS[x], DAYS_EN[x])).join(' ');
  };
  // when does it ring next (null = never again)
  const next = (a, from = new Date()) => {
    const [h, m] = String(a.time || '').split(':').map(Number); if (!(h >= 0) || !(m >= 0)) return null;
    if (a.date) { const [y, mo, d] = a.date.split('-').map(Number); const t = new Date(y, mo - 1, d, h, m); return t > from - 60000 ? t : null; }
    for (let i = 0; i < 8; i++) {
      const t = new Date(from); t.setDate(from.getDate() + i); t.setHours(h, m, 0, 0);
      if (t < from - 60000) continue;
      if (!(a.days || []).length || a.days.includes(t.getDay())) return t;
    }
    return null;
  };

  // ---------- the AIs set alarms ----------
  let speaker = '';
  const sysBefore = W.system;
  W.system = function (a, ...rest) {
    speaker = a?.id || '';
    let s = sysBefore.call(this, a, ...rest);
    try {
      if (window.mzCatFriends?.isCat?.(a?.id)) return s;
      const list = alarms().filter((x) => x.on !== false).slice(0, 8).map((x) => `${x.time} ${repeatText(x)}${x.label ? ' ' + x.label : ''}`);
      s += `\n鬧鐘：使用者要求或行程需要時可主動設，回覆中告知。寫 [鬧鐘:07:30 起床]、[鬧鐘:2026-11-21 14:00 開會]、[鬧鐘:每天|平日|週末 07:30 名稱]，最多兩個，不重複。${list.length ? '已有：' + list.join('；') : ''}`;
    } catch {}
    return s;
  };
  const TAG = /[\[［【]\s*鬧鐘\s*[:：]\s*([^\]］】]{3,60})[\]］】]/g;
  const parse = (inside) => {
    const t = inside.trim();
    let m = t.match(/^(\d{4}-\d{1,2}-\d{1,2})\s+(\d{1,2})[:：](\d{2})\s*(.*)$/);
    if (m) { const [y, mo, d] = m[1].split('-').map(Number); return { date: `${y}-${pad(mo)}-${pad(d)}`, time: `${pad(+m[2])}:${m[3]}`, label: m[4].trim() }; }
    m = t.match(/^(每天|每日|平日|工作日|週末|周末)?\s*(\d{1,2})[:：](\d{2})\s*(.*)$/);
    if (!m) return null;
    const days = !m[1] ? null : /每/.test(m[1]) ? [0, 1, 2, 3, 4, 5, 6] : /平日|工作/.test(m[1]) ? [1, 2, 3, 4, 5] : [0, 6];
    const a = { time: `${pad(+m[2])}:${m[3]}`, label: m[4].trim() };
    if (days) a.days = days; else { const n = next({ ...a, days: [] }); if (n) a.date = key(n); }
    return +m[2] < 24 && +m[3] < 60 ? a : null;
  };
  const packetBefore = W.replyPacket;
  if (typeof packetBefore === 'function') {
    W.replyPacket = function (raw, ...rest) {
      const packet = packetBefore.call(this, raw, ...rest);
      try {
        const found = [];
        const strip = (x) => String(x).replace(TAG, (all, inside) => { const a = parse(inside); if (a && found.length < 2) found.push(a); return a ? '' : all; }).replace(/[ \t]{2,}/g, ' ').trim();
        packet.messages = (packet.messages || []).map(strip).filter(Boolean);
        if (typeof packet.text === 'string') packet.text = strip(packet.text);
        if (found.length) {
          const by = speaker, name = (typeof ai === 'function' && ai(by)?.name) || '';
          setTimeout(() => save((list) => {
            for (const a of found) if (!list.some((x) => x.time === a.time && (x.date || '') === (a.date || '') && String(x.days || '') === String(a.days || '')))
              list.push({ id: crypto.randomUUID?.() || String(Date.now() + Math.random()), on: true, by, byName: name, created: Date.now(), ...a });
          }).then(() => { try { toast(mzT(`${name || 'AI'} 幫你設了鬧鐘 ⏰ ${found.map((a) => a.time).join('、')}`, `${name || 'AI'} set an alarm ⏰ ${found.map((a) => a.time).join(', ')}`), 2600); } catch {} }).catch(() => {}), 0);
        }
      } catch {}
      return packet;
    };
  }

  // ---------- ringing ----------
  const FIRED = 'mz-alarm-fired';
  const fired = () => { try { return JSON.parse(localStorage.getItem(FIRED) || '{}'); } catch { return {}; } };
  let ringing = null, snoozes = {};
  const ring = (a, when) => {
    if (ringing) return;
    const el = document.createElement('div'); el.id = 'mz-alarm-ring';
    el.innerHTML = `<div class="mz-ar-box"><div class="mz-ar-time">${esc(a.time)}</div><b>${esc(a.label || mzT('鬧鐘', 'Alarm'))}</b>${a.byName ? `<small>${esc(mzT(`${a.byName} 幫你設的`, `Set by ${a.byName}`))}</small>` : ''}
<div class="mz-ar-row"><button class="pill" data-mzalarm="snooze">${mzT('5 分鐘後再叫我', 'Snooze 5 min')}</button><button class="pill primary" data-mzalarm="stop">${mzT('關掉', 'Stop')}</button></div></div>`;
    document.body.append(el);
    let n = 0; const beep = () => { try { if (typeof playQueuedSound === 'function') playQueuedSound('ringtone'); } catch {} };
    beep(); const timer = setInterval(() => { if (++n > 20) stop(); else beep(); }, 3000);
    const stop = () => { clearInterval(timer); el.remove(); ringing = null; };
    ringing = { a, stop };
    try { if (document.hidden) window.mushuiMobileNotice?.({ title: '⏰ ' + (a.label || mzT('鬧鐘', 'Alarm')), body: a.time, tag: 'alarm-' + a.id }); } catch {}
    try { navigator.vibrate?.([400, 200, 400, 200, 400]); } catch {}
  };
  const check = () => {
    try {
      const now = new Date(), f = fired();
      for (const a of alarms()) {
        if (a.on === false) continue;
        const [h, m] = a.time.split(':').map(Number);
        const due = (!a.date || a.date === key(now)) && (!(a.days || []).length || a.days.includes(now.getDay())) && now.getHours() === h && now.getMinutes() === m;
        const tag = a.id + '@' + key(now) + ' ' + a.time;
        if (due && !f[tag]) { f[tag] = Date.now(); try { localStorage.setItem(FIRED, JSON.stringify(Object.fromEntries(Object.entries(f).slice(-200)))); } catch {} ring(a, now); }
        const s = snoozes[a.id]; if (s && Date.now() >= s) { delete snoozes[a.id]; ring(a, now); }
      }
    } catch {}
  };
  setInterval(check, 15000); setTimeout(check, 3000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });

  // ---------- 我 → 鬧鐘 ----------
  const row = (a) => {
    const n = next(a);
    return `<div class="mz-alarm-item ${a.on === false ? 'off' : ''}"><button class="mz-alarm-main" data-mzalarmedit="${esc(a.id)}"><strong>${esc(a.time)}</strong><small>${esc(repeatText(a))}${a.label ? ' · ' + esc(a.label) : ''}${a.byName ? ' · ' + esc(mzT(a.byName + ' 設的', 'by ' + a.byName)) : ''}${n ? '' : ' · ' + mzT('已過', 'Passed')}</small></button><button class="mz-alarm-sw ${a.on === false ? '' : 'on'}" data-mzalarmtoggle="${esc(a.id)}" role="switch" aria-checked="${a.on !== false}" aria-label="${mzT('開關', 'On / off')}"><i></i></button></div>`;
  };
  const list = () => {
    const items = alarms().slice().sort((x, y) => x.time.localeCompare(y.time));
    return `<div class="mz-alarm-top"><span class="small">${mzT('也可以直接跟 AI 說「幫我設 7 點的鬧鐘」', 'You can also ask your AI: “set an alarm for 7”')}</span><button class="pill primary" data-mzalarmadd>＋ ${mzT('新增', 'Add')}</button></div>
<div class="mz-alarm-list">${items.map(row).join('') || `<p class="help mz-alarm-none">${mzT('還沒有鬧鐘。', 'No alarms yet.')}</p>`}</div><p class="help">${mzT('沐水開著（或在背景執行）時會響；手機關掉 App 可能就不會響。', 'Rings while Mizuki is open or running in the background; a phone may stop a closed app from ringing.')}</p>`;
  };
  const show = () => showModal(mzT('鬧鐘', 'Alarms'), `<div class="mz-alarm-wrap">${list()}</div>`);
  const redraw = () => { const w = document.querySelector('.sheet .mz-alarm-wrap'); if (w) w.innerHTML = list(); else show(); };
  actions.mzAlarm = show;
  const form = (a = {}) => {
    const days = a.days || [];
    showModal(a.id ? mzT('編輯鬧鐘', 'Edit alarm') : mzT('新增鬧鐘', 'New alarm'), `<label class="mz-field"><span>${mzT('時間', 'Time')}</span><input id="mzAlTime" type="time" value="${esc(a.time || '07:30')}"></label>
<label class="mz-field"><span>${mzT('名稱', 'Label')}</span><input id="mzAlLabel" maxlength="40" value="${esc(a.label || '')}" placeholder="${mzT('起床、吃藥、上課…', 'Wake up, medicine, class…')}"></label>
<div class="mz-field"><span>${mzT('重複（不選就是響一次）', 'Repeat (none = once)')}</span><div class="mz-al-days">${DAYS.map((d, i) => `<button class="chip ${days.includes(i) ? 'selected' : ''}" data-mzalday="${i}">${mzT(d, DAYS_EN[i])}</button>`).join('')}</div></div>
<div class="sheet-actions">${a.id ? `<button class="pill danger" data-mzalarmdel="${esc(a.id)}">${mzT('刪除', 'Delete')}</button>` : ''}<button class="pill" data-mzalarmback>${mzT('取消', 'Cancel')}</button><button class="pill primary" data-mzalarmsave="${esc(a.id || '')}">${mzT('儲存', 'Save')}</button></div>`);
  };
  document.addEventListener('click', async (e) => {
    const q = (s) => e.target.closest?.(s); let b;
    if ((b = q('[data-mzalarm]'))) {
      const r = ringing; if (!r) return; r.stop();
      if (b.dataset.mzalarm === 'snooze') { snoozes[r.a.id] = Date.now() + 5 * 60000; toast(mzT('5 分鐘後再叫你 (｡•ᴗ•｡)', 'See you in 5 minutes (｡•ᴗ•｡)'), 1600); }
      else if (r.a.date) await save((l) => { const x = l.find((y) => y.id === r.a.id); if (x) x.on = false; });
      return;
    }
    if (q('[data-mzalarmadd]')) return form();
    if ((b = q('[data-mzalarmedit]'))) return form(alarms().find((x) => x.id === b.dataset.mzalarmedit));
    if (q('[data-mzalarmback]')) return show();
    if ((b = q('[data-mzalday]'))) { b.classList.toggle('selected'); return; }
    if ((b = q('[data-mzalarmtoggle]'))) { const id = b.dataset.mzalarmtoggle; await save((l) => { const x = l.find((y) => y.id === id); if (x) { x.on = x.on === false; if (x.on && x.date && !next(x)) { const n = next({ ...x, date: '', days: [] }); if (n) x.date = key(n); } } }); return redraw(); }
    if ((b = q('[data-mzalarmdel]'))) { const id = b.dataset.mzalarmdel; await save((l) => { const i = l.findIndex((x) => x.id === id); if (i >= 0) l.splice(i, 1); }); toast(mzT('已刪除', 'Deleted')); return show(); }
    if ((b = q('[data-mzalarmsave]'))) {
      const time = document.getElementById('mzAlTime')?.value || ''; if (!/^\d{2}:\d{2}$/.test(time)) { toast(mzT('先選時間', 'Pick a time first')); return; }
      const label = document.getElementById('mzAlLabel')?.value.trim() || '';
      const days = [...document.querySelectorAll('.sheet [data-mzalday].selected')].map((x) => Number(x.dataset.mzalday));
      const id = b.dataset.mzalarmsave;
      const data = { time, label, days, date: '' };
      if (!days.length) { const n = next({ time, days: [] }); data.date = n ? key(n) : ''; }
      await save((l) => { if (id) Object.assign(l.find((x) => x.id === id) || {}, data, { on: true }); else l.push({ id: crypto.randomUUID?.() || String(Date.now()), on: true, by: 'me', created: Date.now(), ...data }); });
      return show();
    }
  });
  window.mzAlarms = { parse, next, check, ring };
  const css = document.createElement('style');
  css.textContent = `.mz-alarm-top{display:flex;align-items:center;gap:10px;justify-content:space-between;margin:0 0 10px}.mz-alarm-top .small{flex:1}
.mz-alarm-item{display:flex;align-items:center;gap:10px;padding:12px 14px;margin:0 0 8px;border:1px solid var(--line);border-radius:16px;background:var(--surface,#fff)}
.mz-alarm-item.off{opacity:.5}
.mz-alarm-main{flex:1;min-width:0;display:grid;gap:2px;text-align:left;border:0;background:none;color:var(--ink);padding:0}
.mz-alarm-main strong{font-size:26px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:.02em}.mz-alarm-main small{color:var(--muted)}
.mz-alarm-sw{flex:none;width:46px;height:28px;border-radius:999px;border:0;padding:3px;background:var(--line);position:relative;transition:background .2s}
.mz-alarm-sw i{display:block;width:22px;height:22px;border-radius:50%;background:#fff;box-shadow:0 1px 3px #0003;transition:transform .3s var(--mz-duang,cubic-bezier(.3,1.4,.5,1))}
.mz-alarm-sw.on{background:var(--accent)}.mz-alarm-sw.on i{transform:translateX(18px)}
.mz-alarm-none{text-align:center;margin:18px 0}
.mz-al-days{display:flex;flex-wrap:wrap;gap:6px}.mz-al-days .chip{min-width:40px}
#mz-alarm-ring{position:fixed;inset:0;z-index:2147483300;display:grid;place-items:center;background:color-mix(in srgb,var(--bg) 70%,#0008);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.mz-ar-box{width:min(88vw,340px);padding:26px 22px;border-radius:26px;background:var(--surface,#fff);color:var(--ink);text-align:center;box-shadow:0 20px 60px #0005;display:grid;gap:8px}
.mz-ar-time{font-size:54px;font-weight:700;font-variant-numeric:tabular-nums;animation:mz-ar 1s ease-in-out infinite}
@keyframes mz-ar{50%{transform:rotate(-3deg) scale(1.04)}}
.mz-ar-box small{color:var(--muted)}.mz-ar-row{display:flex;gap:10px;justify-content:center;margin-top:10px}
@media (prefers-reduced-motion:reduce){.mz-ar-time{animation:none}}`;
  document.head.append(css);
}
