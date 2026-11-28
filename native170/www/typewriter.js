'use strict';
// 3.4.1: an AI's new reply appears character by character, like it is being typed (only replies that arrive while
// the chat is open; older messages show at once). The bubble keeps its final height from the start, so the chat
// doesn't jump while it fills in, and a repaint in the middle just continues where it was. Tables, pictures and
// stickers show at once; only the text is typed out. Turned off with prefers-reduced-motion.
{
  const seen = new Map();      // chat id → Set of message ids already on screen
  const typing = new Map();    // message id → { start, ms }
  let frame = 0;
  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  const aiChat = () => typeof chatId === 'string' && chatId && !chatId.startsWith('human:') && !chatId.startsWith('feedback');
  const messages = () => [...document.querySelectorAll('.message-scroll .message[data-message-id]:not(.mine)')];
  const textNodes = (el) => {
    const out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement?.closest('.chat-table,.chat-svg,.chat-code,.message-time,.message-meta,time,.mz-think,.reactions') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT) });
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.nodeValue) out.push(n);
    return out;
  };
  const prepare = (el) => {
    const bubble = el.querySelector('.bubble'); if (!bubble || bubble.classList.contains('sticker-only') || bubble.classList.contains('photo-only')) return null;
    if (bubble._tw) return bubble._tw;
    const nodes = textNodes(bubble), full = nodes.map((n) => n.nodeValue), total = full.reduce((s, t) => s + t.length, 0);
    if (total < 2) return null;
    bubble.style.minHeight = bubble.offsetHeight + 'px';
    bubble._tw = { bubble, nodes, full, total };
    return bubble._tw;
  };
  const show = (tw, count) => {
    let left = count;
    tw.nodes.forEach((n, i) => { const t = tw.full[i]; const k = Math.max(0, Math.min(t.length, left)); n.nodeValue = t.slice(0, k); left -= t.length; });
  };
  const finish = (tw) => { tw.nodes.forEach((n, i) => { n.nodeValue = tw.full[i]; }); tw.bubble.style.minHeight = ''; tw.bubble._tw = null; };
  const step = () => {
    frame = 0;
    const now = performance.now();
    for (const el of messages()) {
      const id = el.dataset.messageId, job = typing.get(id); if (!job) continue;
      const tw = prepare(el); if (!tw) { typing.delete(id); continue; }
      const p = Math.min(1, (now - job.start) / job.ms);
      if (p >= 1) { finish(tw); typing.delete(id); } else show(tw, Math.ceil(tw.total * p));
    }
    for (const [id, job] of typing) if (now - job.start > job.ms + 500) typing.delete(id);
    if (typing.size) frame = requestAnimationFrame(step);
  };
  const scan = () => {
    if (!aiChat() || reduced() || state?.settings?.mzTypewriter === false) return;
    const list = messages(); if (!list.length) return;
    let known = seen.get(chatId);
    if (!known) { seen.set(chatId, new Set(list.map((m) => m.dataset.messageId))); return; }
    for (const el of list) {
      const id = el.dataset.messageId;
      if (known.has(id)) continue;
      known.add(id);
      const len = (el.querySelector('.bubble')?.textContent || '').length;
      if (len < 2) continue;
      typing.set(id, { start: performance.now(), ms: Math.min(2600, Math.max(400, len * 32)) });
    }
    if (typing.size) { step(); if (!frame) frame = requestAnimationFrame(step); }
  };
  const before = render;
  render = function (...a) { const r = before.apply(this, a); try { scan(); if (typing.size) step(); } catch {} return r; };
  // replies can also be added without a full render (live updates)
  try { new MutationObserver(() => { if (aiChat()) scan(); }).observe(document.getElementById('app'), { childList: true, subtree: true }); } catch {}
  window.mzTypewriter = { scan, typing };
}
