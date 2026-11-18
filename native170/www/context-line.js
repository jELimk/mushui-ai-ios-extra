'use strict';
// 3.4.1: the context waterline. In a chat with one AI, a thin line under the header shows how full the AI's short-term
// memory is: the AI reads the latest messages (its memory size, 80 by default), and when the messages since the last
// tidy-up reach 80 % of that, older ones are folded into long-term memory. Tap it for the numbers: messages the AI
// reads now, roughly how many words / tokens, how many more until the next tidy-up, and when the last one was.
{
  const info = () => {
    if (typeof chatId !== 'string' || !chatId || chatId.startsWith('human:') || !state?.chats) return null;
    const c = state.chats.find((x) => x.id === chatId);
    if (!c || (c.members || []).length !== 1) return null;
    const aiId = c.members[0], a = state.ais.find((x) => x.id === aiId); if (!a) return null;
    const n = state.settings.unifiedMemory ? state.settings.memory || 80 : a.memory || 80;
    const msgs = (c.messages || []).filter((m) => !m.callEvent);
    const rec = c.memories?.[aiId];
    const through = rec ? msgs.findIndex((m) => m.id === rec.throughId) : -1;
    const all = (c.messages || []), start = rec ? all.findIndex((m) => m.id === rec.throughId) + 1 : 0;
    const pending = Math.max(0, all.length - start), trigger = Math.ceil(n * 0.8);
    const reading = msgs.slice(Math.max(through + 1, msgs.length - n));
    const chars = reading.reduce((s, m) => s + String(m.text || '').length + (m.images?.length ? 40 : 0), 0) + String(rec?.summary || '').length;
    return { a, n, pending, trigger, reading: reading.length, chars, tokens: Math.round(chars * 0.75), level: Math.min(1, pending / trigger), rec, left: Math.max(0, trigger - pending) };
  };
  const paint = () => {
    const top = document.querySelector('.conversation > .top'); if (!top) return;
    let el = document.querySelector('.conversation > .mz-waterline');
    const i = info();
    if (!i) { el?.remove(); return; }
    const pct = Math.round(i.level * 100), warn = i.level >= 0.85;
    const html = `<span class="mz-wl-bar"><i style="width:${pct}%"></i></span><span class="mz-wl-text">${mzT('吃水', 'Context')} ${pct}%</span>`;
    if (!el) { el = document.createElement('button'); el.type = 'button'; el.className = 'mz-waterline'; el.dataset.action = 'mzWaterline'; top.after(el); }
    el.classList.toggle('warn', warn);
    el.setAttribute('aria-label', mzT(`記憶用量 ${pct}%，再 ${i.left} 則會自動整理`, `Context ${pct}%, tidies up in ${i.left} more messages`));
    if (el.dataset.v !== html) { el.dataset.v = html; el.innerHTML = html; }
  };
  actions.mzWaterline = () => {
    const i = info(); if (!i) return;
    const when = i.rec?.time || i.rec?.updatedAt;
    showModal(mzT('上下文吃水線', 'Context waterline'), `<div class="mz-wl-sheet">
<div class="mz-wl-big"><span class="mz-wl-bar"><i style="width:${Math.round(i.level * 100)}%"></i></span><b>${Math.round(i.level * 100)}%</b></div>
<p>${mzT(`${esc(i.a.name)} 現在會讀最近 <b>${i.reading}</b> 則訊息（上限 ${i.n} 則），大約 <b>${i.chars.toLocaleString()}</b> 字（≈ ${i.tokens.toLocaleString()} tokens）。`, `${esc(i.a.name)} now reads the latest <b>${i.reading}</b> messages (up to ${i.n}), about <b>${i.chars.toLocaleString()}</b> characters (≈ ${i.tokens.toLocaleString()} tokens).`)}</p>
<p>${i.left ? mzT(`再 <b>${i.left}</b> 則訊息，比較舊的對話就會自動整理成長期記憶。`, `In <b>${i.left}</b> more messages, older chat is tidied into long-term memory.`) : mzT('已經到整理的時候了，下一次回覆時會自動整理。', 'It is time to tidy up; it happens with the next reply.')}</p>
<p class="small">${i.rec ? mzT(`長期記憶已整理到 ${when ? new Date(when).toLocaleString() : '之前的對話'}。`, `Long-term memory tidied up to ${when ? new Date(when).toLocaleString() : 'earlier chat'}.`) : mzT('還沒有整理過長期記憶。', 'No long-term memory tidy-up yet.')} ${mzT('記憶上限可以在角色資料的「記憶」調整。', 'The memory size can be changed in the role profile\'s Memory.')}</p></div>`);
  };
  const before = render;
  render = function (...a) { const r = before.apply(this, a); try { paint(); } catch {} return r; };
  const css = document.createElement('style');
  css.textContent = `.mz-waterline{display:flex;align-items:center;gap:8px;width:100%;margin:0;padding:3px 16px 4px;border:0;background:transparent;color:var(--muted);font-size:11px;cursor:pointer}
.mz-wl-bar{position:relative;flex:1;height:3px;border-radius:3px;background:color-mix(in srgb,var(--accent) 16%,transparent);overflow:hidden}
.mz-wl-bar i{position:absolute;inset:0 auto 0 0;border-radius:3px;background:var(--accent);transition:width .4s}
.mz-waterline.warn .mz-wl-bar i{background:#e8a33d}
.mz-wl-text{flex:none;font-variant-numeric:tabular-nums}
.mz-wl-big{display:flex;align-items:center;gap:12px;margin:4px 0 12px}.mz-wl-big .mz-wl-bar{height:8px}.mz-wl-big b{font-size:20px}
.mz-wl-sheet p{line-height:1.7}`;
  document.head.append(css);
}
