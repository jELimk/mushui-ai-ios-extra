'use strict';
// 3.4.1: chatting by text during an AI call (from the user's screenshot of another app's call screen).
//  - What you say and what the AI says show up as bubbles on the call screen while you talk (live transcript).
//  - A keyboard button opens a text box: what you type is sent into the call, and the AI answers out loud.
//  - A mute button turns your microphone off and on.
// GPT-Live calls: the transcript comes from the session's own transcript events; typed text goes in as a note the
// AI hears right away. The older record-then-reply calls: each recognised voice piece and each typed line is saved
// like before, and the AI answers all of it after hanging up (it says so in the box).
{
  const W = window.WebEngine;
  const cur = () => (VoiceUI.ai && !VoiceUI.ai.ending ? VoiceUI.ai : null);
  const live = (c) => !!c?.liveSession;
  const log = (c) => (c.mzLog ||= []);
  const add = (c, who, text, { typed = false, join = false } = {}) => {
    text = String(text || ''); if (!text.trim() && !join) return;
    const L = log(c), last = L[L.length - 1], now = Date.now();
    if (join && last && last.who === who && !last.typed && now - last.at < 1600) { last.text += text; last.at = now; }
    else if (text.trim()) L.push({ who, text: join ? text.trimStart() : text, typed, at: now });
    if (L.length > 80) L.splice(0, L.length - 80);
    draw();
  };
  // live transcript (GPT-Live): our own listener next to the call's
  const watch = (c) => {
    if (!c?.dc || c.mzWatch) return; c.mzWatch = true;
    c.dc.addEventListener('message', (e) => {
      let x; try { x = JSON.parse(e.data); } catch { return; }
      if (x.type === 'session.input_transcript.delta') add(c, 'me', x.delta || '', { join: true });
      else if (x.type === 'session.output_transcript.delta') add(c, 'ai', x.delta || '', { join: true });
    });
  };
  // the older calls: every recognised voice piece goes through voiceNote
  const callBefore = call;
  call = async function (name, args, ...rest) {
    const r = await callBefore.call(this, name, args, ...rest);
    try { const c = cur(); if (name === 'voiceNote' && c && args?.id === c.chat && !args.mzTyped) add(c, 'me', args.text); } catch {}
    return r;
  };

  // ---------- the screen ----------
  const ICON = {
    keys: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M7 10h.01M10.5 10h.01M14 10h.01M17 10h.01M7 14h10"/></svg>',
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>',
    micOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 9.5V6a3 3 0 0 0-5.6-1.5M9 9v2a3 3 0 0 0 4.7 2.5M5.5 11a6.5 6.5 0 0 0 10.4 5.2M18.5 11a6.4 6.4 0 0 1-.6 2.7M12 17.5V21M4 4l16 16"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12 20 4l-6 16-2.5-6.5Z"/></svg>',
  };
  const muted = (c) => !!c?.media?.getAudioTracks?.().some((t) => !t.enabled);
  const btns = (c) => `${c.media ? `<button type="button" class="pill mz-aic-btn ${muted(c) ? 'on' : ''}" data-action="mzAicMute" aria-label="${mzT('麥克風', 'Microphone')}">${muted(c) ? ICON.micOff : ICON.mic}<small>${muted(c) ? mzT('已靜音', 'Muted') : mzT('麥克風', 'Mic')}</small></button>` : ''}<button type="button" class="pill mz-aic-btn ${c.mzKeys ? 'on' : ''}" data-action="mzAicKeys" aria-label="${mzT('打字', 'Type')}">${ICON.keys}<small>${mzT('打字', 'Type')}</small></button>`;
  const draw = () => {
    const c = cur(), el = typeof callOverlay !== 'undefined' ? callOverlay : null;
    if (!el?.isConnected) return;
    if (!c) { el.classList.remove('mz-aic'); el.querySelector('.mz-aic-log')?.remove(); el.querySelector('.mz-aic-bar')?.remove(); return; }
    watch(c);
    el.classList.add('mz-aic');
    let box = el.querySelector('.mz-aic-log');
    if (!box) { box = document.createElement('div'); box.className = 'mz-aic-log'; box.setAttribute('aria-live', 'polite'); (el.querySelector('.mz-call-actions') || el.lastElementChild)?.before(box); }
    const L = log(c), name = ai(c.ai)?.name || 'AI';
    const html = L.length
      ? L.map((m) => `<div class="mz-aic-msg ${m.who}${m.typed ? ' typed' : ''}"><span>${esc(m.text)}</span></div>`).join('')
      : `<p class="mz-aic-empty">${live(c) ? mzT(`說的話會在這裡變成文字，也可以按「打字」傳文字給 ${name}。`, `What you both say shows up here as text. Tap "Type" to send ${name} a message.`) : mzT('說的話辨識後會出現在這裡；打字的內容會跟語音一起，掛斷後 AI 再回覆。', 'Recognised speech shows up here; typed lines are saved with it and the AI answers after you hang up.')}</p>`;
    el.classList.toggle('mz-aic-has', L.length > 0);
    if (box.dataset.v !== html) {
      const atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
      box.dataset.v = html; box.innerHTML = html;
      if (atEnd || !box.dataset.seen) { box.scrollTop = box.scrollHeight; box.dataset.seen = '1'; }
    }
    let bar = el.querySelector('.mz-aic-bar');
    if (c.mzKeys && !bar) {
      bar = document.createElement('form'); bar.className = 'mz-aic-bar';
      bar.innerHTML = `<textarea rows="1" enterkeyhint="send" placeholder="${mzT('打字給 ' + name + '…', 'Message ' + name + '…')}"></textarea><button type="submit" aria-label="${mzT('傳送', 'Send')}">${ICON.send}</button>`;
      box.after(bar);
      const ta = bar.querySelector('textarea');
      ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(96, ta.scrollHeight) + 'px'; });
      ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); bar.requestSubmit(); } });
      bar.addEventListener('submit', (e) => { e.preventDefault(); const t = ta.value.trim(); if (!t) return; ta.value = ''; ta.style.height = ''; sendText(t); });
      setTimeout(() => ta.focus(), 30);
    } else if (!c.mzKeys && bar) bar.remove();
  };
  const sendText = async (text) => {
    const c = cur(); if (!c) return;
    add(c, 'me', text, { typed: true });
    try {
      if (live(c)) {
        c.dc?.send(JSON.stringify({ type: 'session.commentary.append', event_id: 'typed_' + Date.now(), delegation_id: null, content: `對方在通話中打字傳來：「${text.slice(0, 1000)}」。請把它當成對方剛剛說的話，自然地用語音回應。` }));
        await W.edit((s) => { const chat = s.chats.find((x) => x.id === c.chat); if (chat) W.append(chat, 'me', '［GPT-Live 通話・打字］' + text, { liveVoice: true }); });
      } else {
        await call('voiceNote', { id: c.chat, text, mzTyped: true }); c.count = (c.count || 0) + 1;
      }
    } catch (e) { toast(mzT('沒有傳出去：', 'Not sent: ') + (e?.message || e), 4000); }
  };
  actions.mzAicKeys = () => { const c = cur(); if (!c) return; c.mzKeys = !c.mzKeys; refresh(); };
  actions.mzAicMute = () => { const c = cur(); if (!c?.media) return; const off = !muted(c); c.media.getAudioTracks().forEach((t) => { t.enabled = off ? false : true; }); refresh(); toast(off ? mzT('麥克風已關閉', 'Mic off') : mzT('麥克風已開啟', 'Mic on'), 1400); };
  // the buttons live in the call's own action row, before 掛斷
  let lastArgs = null;
  const refresh = () => { if (lastArgs) callScreen(...lastArgs); else draw(); };
  const screenBefore = callScreen;
  callScreen = function (name, status, buttons, ...rest) {
    const c = cur();
    lastArgs = [name, status, buttons, ...rest];
    if (c && buttons && /endAIVoice/.test(buttons)) buttons = btns(c) + buttons;
    else if (!c) lastArgs = null;
    const r = screenBefore.call(this, name, status, buttons, ...rest);
    try { draw(); } catch {}
    return r;
  };
  setInterval(() => { try { if (cur()) draw(); } catch {} }, 1000);

  const css = document.createElement('style');
  css.textContent = `
.call-overlay.mz-aic .mz-aic-log{position:absolute;z-index:4;left:16px;right:16px;top:calc(env(safe-area-inset-top) + 16vh + 190px);bottom:calc(env(safe-area-inset-bottom) + 150px);overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:6px 2px;scrollbar-width:thin;-webkit-mask:linear-gradient(transparent,#000 18px);mask:linear-gradient(transparent,#000 18px)}
.call-overlay.mz-aic.mz-aic-has .mz-call-id{top:calc(env(safe-area-inset-top) + 7vh)}
.call-overlay.mz-aic.mz-aic-has .mz-call-id .mz-face{transform:scale(.72);transform-origin:50% 100%}
.call-overlay.mz-aic.mz-aic-has .mz-aic-log{top:calc(env(safe-area-inset-top) + 7vh + 168px)}
.call-overlay.mz-aic:has(.mz-aic-bar) .mz-aic-log{bottom:calc(env(safe-area-inset-bottom) + 214px)}
.mz-aic-msg{display:flex;max-width:100%}.mz-aic-msg.me{justify-content:flex-end}
.mz-aic-msg span{max-width:78%;padding:9px 13px;border-radius:18px;font-size:15px;line-height:1.45;text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;background:#ffffff26;color:#fff;border:1px solid #ffffff1f}
.mz-aic-msg.me span{background:var(--accent);color:#fff;border-color:transparent;border-bottom-right-radius:6px}
.mz-aic-msg.ai span{border-bottom-left-radius:6px}
.mz-aic-msg.typed span::after{content:"⌨";margin-left:6px;opacity:.6;font-size:11px}
.mz-aic-empty{margin:auto 8px;color:#ffffffa6;font-size:13px;line-height:1.6}
.mz-aic-bar{position:absolute;z-index:6;left:16px;right:16px;bottom:calc(env(safe-area-inset-bottom) + 150px);display:flex;gap:8px;align-items:flex-end;margin:0;padding:6px;border-radius:24px;background:#ffffff1f;border:1px solid #ffffff2e}
.mz-aic-bar textarea{flex:1;min-height:38px;max-height:96px;resize:none;border:0;outline:0;background:transparent;color:#fff;font:inherit;font-size:15px;padding:9px 10px;line-height:1.35}
.mz-aic-bar textarea::placeholder{color:#ffffff80}
.mz-aic-bar button{flex:none;width:38px;height:38px;border:0;border-radius:50%;display:grid;place-items:center;background:var(--accent);color:#fff;padding:0}
.mz-aic-bar svg,.mz-aic-btn svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.mz-aic-bar button svg{fill:currentColor;stroke:none;width:18px;height:18px}
.call-overlay .mz-aic-btn{display:inline-flex;flex-direction:column;align-items:center;gap:4px;min-width:64px;background:#ffffff1f;color:#fff;border:1px solid #ffffff2e}
.call-overlay .mz-aic-btn small{font-size:11px;opacity:.85}
.call-overlay .mz-aic-btn.on{background:#fff;color:#111}
.call-overlay.mz-min .mz-aic-log,.call-overlay.mz-min .mz-aic-bar{display:none}
`;
  document.head.append(css);
}
