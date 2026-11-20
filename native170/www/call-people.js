'use strict';
// 3.4.0: the call screen shows who is in the call the same way listening together does. Calling a friend shows you
// first; when they join, their picture appears beside yours with the shared earbuds. With an AI, or with more people,
// it's just the row of pictures (no earbuds).
{
  const meFace = () => { const h = humanData?.().me; return h ? { ...h, name: h.name || state?.settings?.nickname || '我' } : (typeof person === 'function' ? person('me') : { name: '我' }); };
  const EARBUDS = '<svg class="mz-earbuds" viewBox="0 0 160 40" aria-hidden="true"><path d="M44 8C48 26 66 28 80 32M116 8C112 26 94 28 80 32M80 32V40"/><circle cx="44" cy="7" r="6"/><circle cx="116" cy="7" r="6"/></svg>';
  function who() {
    const c = VoiceUI.rtc, nat = typeof MZC === 'object' ? MZC.native : null;
    if (VoiceUI.ai?.ai) return { list: [meFace(), ai(VoiceUI.ai.ai)], duo: false };
    const peerId = c?.peer || nat?.peer;
    if (!peerId) return null;
    const peer = humanFriend(peerId), incoming = c ? !!(c.offer && !c.pc) : false;
    const joined = c ? !!(c.connected || c.connectedAt) : !!nat?.connectedAt;
    if (incoming) return { list: [peer], duo: false };
    return joined ? { list: [meFace(), peer], duo: true } : { list: [meFace()], duo: false };
  }
  function draw() {
    const el = typeof callOverlay !== 'undefined' ? callOverlay : null;
    if (!el?.isConnected) return;
    const w = who();
    if (!w) return;
    const html = w.duo
      ? `<div class="mizuki-rel-portraits user-content"><span class="mizuki-rel-avatar">${avatar(w.list[0])}</span><span class="mizuki-rel-avatar">${avatar(w.list[1])}</span></div>${EARBUDS}`
      : `<div class="mz-listen-row user-content">${w.list.map((p) => avatar(p)).join('')}</div>`;
    let box = el.querySelector('.mz-call-people');
    if (!box) {
      box = document.createElement('div');
      box.className = 'mz-call-people';
      const anchor = el.querySelector('.mz-call-id .mz-face') || el.querySelector('h2');
      if (!anchor) return;
      anchor.before(box);
      el.classList.add('mz-has-people');
    }
    if (box.dataset.v !== html) { box.dataset.v = html; box.innerHTML = html; }
  }
  const screenBefore = callScreen;
  callScreen = function (...args) { const r = screenBefore.apply(this, args); try { draw(); } catch {} return r; };
  setInterval(() => { try { draw(); } catch {} }, 1000);
}
