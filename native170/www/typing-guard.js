'use strict';
// Fast typing on phones. Every redraw used to build a new message box, so the keyboard lost track of it for a moment:
// the first letters typed right after sending vanished, and redraws from syncing made typing feel sticky.
// Now (1) redraws that aren't needed wait until typing pauses, and (2) the box being typed in is kept, not rebuilt.
// Loaded last, so it wraps every other render.
{
  const FIELD = '.composer textarea[data-input="message"]';
  const PAUSE = 1200;
  let lastKey = 0, waiting = 0, holder = null;
  document.addEventListener('input', (e) => { if (e.target.matches?.(FIELD)) lastKey = Date.now(); }, true);
  document.addEventListener('compositionupdate', (e) => { if (e.target.matches?.(FIELD)) lastKey = Date.now(); }, true);
  const canMove = typeof Element.prototype.moveBefore === 'function';
  const draftOf = () => (typeof chatDrafts === 'object' && chatId ? chatDrafts[chatId] || '' : null);

  const inner = render;
  render = function (...args) {
    const box = document.querySelector(FIELD), typing = box && box === document.activeElement;
    // Something the screen must show now (sending clears the box, switching chats) changes the draft; a sync doesn't.
    const settled = !typing || draftOf() === null || draftOf() === box.value;
    if (typing && settled && box.value && Date.now() - lastKey < PAUSE) {
      clearTimeout(waiting);
      waiting = setTimeout(() => render(), PAUSE - (Date.now() - lastKey) + 30);
      return;
    }
    clearTimeout(waiting);
    // Chrome (Android) can move an element without losing focus or the keyboard's place in it.
    if (!typing || !canMove) return inner.apply(this, args);
    const chat = chatId, home = box.parentNode, next = box.nextSibling;
    if (!holder) { holder = document.createElement('div'); holder.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden'; document.body.append(holder); }
    try { holder.moveBefore(box, null); } catch { return inner.apply(this, args); }
    try { return inner.apply(this, args); }
    finally {
      const fresh = document.querySelector(FIELD);
      try {
        if (fresh && chatId === chat) {
          for (const name of ['placeholder', 'class', 'rows', 'aria-label', 'enterkeyhint']) { const v = fresh.getAttribute(name); if (v === null) box.removeAttribute(name); else box.setAttribute(name, v); }
          if (draftOf() !== null && box.value !== draftOf()) { box.value = draftOf(); box.style.height = fresh.style.height; }
          fresh.parentNode.moveBefore(box, fresh);
          fresh.remove();
          if (document.activeElement !== box) box.focus({ preventScroll: true });
        } else if (!fresh && chatId === chat && home?.isConnected) {
          // This redraw left the composer in place: put the box back, with what the draft now says.
          if (draftOf() !== null && box.value !== draftOf()) { box.value = draftOf(); if (!box.value) box.style.height = ''; }
          home.moveBefore(box, next?.parentNode === home ? next : null);
          if (document.activeElement !== box) box.focus({ preventScroll: true });
        }
        else box.remove();
      } catch { box.remove(); }
    }
  };
}
