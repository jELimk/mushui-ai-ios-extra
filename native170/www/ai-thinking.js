'use strict';
// 3.4.0: see what the AI was thinking before it replied. Off by default; turned on in Settings → AI 的日常.
// Models that think on their own (DeepSeek and other reasoning models) hand their reasoning back with the reply; other
// models are asked, only while this is on, for a short inner thought in <think>…</think> before the reply. Either way the
// thought never ends up in the reply itself: it's kept on the message and shown folded under the AI's bubble.
{
  const W = window.WebEngine;
  const on = () => !!state?.settings?.showThinking;
  const THINK = /<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi;
  let native = '', pending = null;

  // The reasoning that reasoning models return beside the reply.
  const proxyBefore = W.proxy;
  W.proxy = async (...args) => {
    const r = await proxyBefore(...args);
    try { const m = r?.choices?.[0]?.message; native = String(m?.reasoning_content || m?.reasoning || '').trim(); } catch { native = ''; }
    return r;
  };
  // Only chat replies (one-to-one and group) ask for and keep a thought; memory summaries and other background calls don't.
  const ASK = '\n思考過程：回覆前，先用 <think> 和 </think> 包住你心裡真正的想法（第一人稱、依你的個性，1～3 句、80 字內，例如你怎麼理解對方的話、想怎麼回）。<think> 之後才是給對方的回覆，回覆的格式照原本的規則。';
  const isReply = (system) => typeof system === 'string' && (system.includes('聊天室記憶：') || system.includes('混合群組聊天'));
  // Every reply comes back clean; the thought is kept aside for the message about to be saved.
  const completeBefore = W.complete;
  W.complete = async (...args) => {
    const reply = isReply(args[1]);
    if (reply && on()) args[1] = args[1] + ASK;
    native = '';
    const text = await completeBefore(...args);
    let thought = native;
    const clean = String(text ?? '').replace(THINK, (_, t) => { if (!thought) thought = t.trim(); return ''; }).replace(/^[\s\S]*?<\/think>/i, '').trim();
    thought = String(thought || '').trim().slice(0, 4000);
    if (reply) pending = thought && !(W.harmfulReply?.(thought)) ? { text: thought, at: Date.now() } : null;
    return clean;
  };
  window.mzTakeThinking = () => { const p = pending; pending = null; return p && Date.now() - p.at < 120000 ? p.text : ''; };

  // One-to-one chats: the thought is stored on the first message of the reply.
  const appendBefore = W.append;
  W.append = (chat, author, text, extra = {}) => {
    const m = appendBefore(chat, author, text, extra);
    try { if (m && author !== 'me' && !m.system && on()) { const t = window.mzTakeThinking(); if (t) m.thinking = t; } } catch {}
    return m;
  };

  // Groups: the thought stays on this device, keyed by the message's id.
  const KEY = 'mzGroupThinking';
  const readGroup = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
  window.mzKeepGroupThinking = (clientId) => {
    const t = on() ? window.mzTakeThinking() : '';
    if (!t || !clientId) return;
    const all = readGroup(); all[clientId] = t;
    const keys = Object.keys(all); for (const k of keys.slice(0, Math.max(0, keys.length - 300))) delete all[k];
    try { localStorage.setItem(KEY, JSON.stringify(all)); } catch {}
  };

  // Shown folded under the AI's bubble: "思考過程 ›", tap to open.
  const thoughtOf = (row) => {
    const id = row.dataset.messageId || '';
    if (id.startsWith('hg-')) {
      const m = (typeof MizukiGroups !== 'undefined' ? MizukiGroups : null)?.data?.messages?.find((x) => 'hg-' + x.id === id);
      return m?.client ? readGroup()[m.client] || '' : '';
    }
    return typeof messageById === 'function' ? messageById(id)?.thinking || '' : '';
  };
  const draw = () => {
    if (!on()) { document.querySelectorAll('.mz-thinking').forEach((x) => x.remove()); return; }
    for (const row of document.querySelectorAll('.conversation .message[data-message-id]:not(.mine)')) {
      if (row.querySelector('.mz-thinking')) continue;
      const t = thoughtOf(row);
      if (!t) continue;
      const body = row.querySelector('.message-body') || row;
      const box = document.createElement('details');
      box.className = 'mz-thinking';
      box.innerHTML = `<summary>${mzT('思考過程', 'Thinking')}</summary><p></p>`;
      box.querySelector('p').textContent = t;
      (body.querySelector('.bubble') || body.lastElementChild)?.after(box);
    }
  };
  const renderBefore = render;
  render = function (...args) { const r = renderBefore.apply(this, args); try { draw(); } catch {} return r; };
  new MutationObserver(() => { try { if (on() && document.querySelector('.conversation .message[data-message-id]:not(.mine):not(:has(.mz-thinking))')) draw(); } catch {} }).observe(document.body, { childList: true, subtree: true });

  // The switch, on the AI's daily-life settings page.
  const lifeBefore = lifePage;
  lifePage = function () {
    return lifeBefore() + `<div class="card">${toggle('showThinking', mzT('顯示 AI 思考過程', "Show the AI's thinking"), mzT('在 AI 的訊息下面可以點開看它回覆前在想什麼。會讓回覆多用一點 API 額度；會自己思考的模型（例如 DeepSeek）會顯示它真正的思考。', 'Tap under an AI message to see what it was thinking before it replied. Uses a little more API credit; models that reason on their own (such as DeepSeek) show their real reasoning.'))}</div>`;
  };
}
