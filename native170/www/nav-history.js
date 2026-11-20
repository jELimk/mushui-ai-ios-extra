'use strict';
// 3.4.0 r11: going back goes to the screen you came from. A → B → C, back from C is B, then A. If B was a profile
// window (say a contact you opened in 聯絡人), it opens again: 聯絡人 → a contact → their Moments, back returns to
// 聯絡人 with that contact open, not to the Moments home. Tapping a bottom tab starts over.
{
  const MAX = 20;
  let stack = [], last = null, backing = false, tabJump = 0, tapAt = 0;
  let opener = null; // the profile window open right now: { kind: 'ai' | 'human', id, key, closedAt }
  const route = () => ({ tab, page, chatId, momentProfileId: typeof momentProfileId === 'undefined' ? 'me' : momentProfileId });
  const keyOf = (r) => [r.tab, r.page, r.chatId, r.momentProfileId].join('|');

  // Which profile window is open, so it can come back.
  if (typeof contactModal === 'function') {
    const contactBefore = contactModal;
    contactModal = function (id, ...rest) { const r = contactBefore.call(this, id, ...rest); opener = { kind: 'ai', id, key: last ? keyOf(last) : '', closedAt: 0 }; return r; };
  }
  document.addEventListener('click', (e) => {
    tapAt = Date.now();
    const b = e.target.closest?.('[data-humancontact]');
    if (b && !b.closest('#overlay')) setTimeout(() => { if (modal) opener = { kind: 'human', id: b.dataset.humancontact, key: last ? keyOf(last) : '', closedAt: 0 }; }, 0);
    if (e.target.closest?.('[data-tab]')) tabJump = Date.now();
  }, true);
  const closeBefore = closeModal;
  closeModal = function (...args) { if (opener && !opener.closedAt) opener.closedAt = Date.now(); return closeBefore.apply(this, args); };

  function note() {
    const now = route(), was = last;
    last = now;
    if (!was || keyOf(was) === keyOf(now)) return;
    if (backing) { const left = keyOf(was); stack = stack.filter((f) => f.to !== left); return; }
    if (Date.now() - tabJump < 1500) { stack = []; tabJump = 0; return; }
    // Moving inside one settings area, or from one chat straight to another, isn't a step deeper.
    if (was.tab === now.tab && was.chatId === now.chatId && was.momentProfileId === now.momentProfileId) return;
    if (was.chatId && now.chatId && was.tab === now.tab) return;
    const fromKey = keyOf(was);
    // One tap can render twice on its way (Moments home first, then the profile): that's still one step.
    const top = stack[stack.length - 1];
    if (top && top.to === fromKey && top.tap === tapAt && Date.now() - top.at < 1500) { top.to = keyOf(now); return; }
    const reopen = opener && opener.key === fromKey && (!opener.closedAt || Date.now() - opener.closedAt < 1500) ? { kind: opener.kind, id: opener.id } : null;
    stack.push({ from: was, reopen, to: keyOf(now), at: Date.now(), tap: tapAt });
    if (stack.length > MAX) stack.shift();
  }
  const renderBefore = render;
  render = function (...args) { const r = renderBefore.apply(this, args); try { note(); } catch {} return r; };

  function reopen(r) {
    if (!r) return;
    if (r.kind === 'ai' && (state?.ais || []).some((a) => a.id === r.id)) { try { contactModal(r.id); } catch {} return; }
    if (r.kind === 'human') {
      const b = document.createElement('button');
      b.type = 'button'; b.hidden = true; b.dataset.humancontact = r.id;
      document.body.append(b); b.click(); b.remove();
    }
  }
  // Back to the screen before this one, if this one was reached from it.
  window.mzHistoryBack = function () {
    const top = stack[stack.length - 1];
    if (!top || top.to !== keyOf(route())) return false;
    stack.pop();
    backing = true;
    try {
      if (modal) closeModal();
      ({ tab, page, chatId } = top.from);
      if (typeof momentProfileId !== 'undefined') momentProfileId = top.from.momentProfileId;
      if (typeof momentReturnChat !== 'undefined') momentReturnChat = '';
      if (typeof coverExpanded !== 'undefined') coverExpanded = false;
      render();
    } finally { backing = false; }
    last = route();
    opener = null;
    setTimeout(() => reopen(top.reopen), 30);
    return true;
  };
  // The back buttons on screens, the phone's back gesture/key, and the swipe all use it first.
  const BACKS = new Set(['back', 'closeChat', 'momentsHome']);
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-action]');
    if (!b || !BACKS.has(b.dataset.action) || b.closest('#overlay')) return;
    if (window.mzHistoryBack()) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    // Not one of ours: the screen's own back runs, and whatever it leaves isn't returned to later.
    backing = true;
    setTimeout(() => { backing = false; }, 0);
  }, true);
  const goBackBefore = window.goBack;
  window.goBack = function (...args) {
    if (!modal && window.mzHistoryBack()) return true;
    backing = true;
    try { return goBackBefore?.apply(this, args); } finally { setTimeout(() => { backing = false; }, 0); }
  };
  if (state) last = route();
}
