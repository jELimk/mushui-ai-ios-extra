'use strict';
// 3.4.1: going back returns to the popup you came from.
//  - popup → popup (chat ⋯ → 我們的主頁 → 信): back (phone back / swipe / ‹) steps back one popup at a time;
//    ✕ or tapping outside still closes them all.
//  - popup → page (a button in a popup opens a page): back from that page opens the popup again.
// A popup is reopened by the same action that opened it (so it is built fresh), or from its saved content.
{
  let shown = null;          // the popup on screen now: { name, body, footer, action, scroll }
  let stack = [];            // popups under it (popup → popup)
  let justClosed = null;     // the popup just closed by code (not by the user), and when
  let lastAction = '', lastActionAt = 0, userCloseAt = 0, backAt = 0, restoring = false, popupClickAt = 0;
  const pages = [];          // { from, to, popup, stack } when a popup led to a page
  const route = () => [tab, page, chatId, typeof momentProfileId === 'undefined' ? '' : momentProfileId].join('|');
  let lastRoute = '', restoreGeneration = 0;

  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('[data-action]');
    lastAction = a?.dataset.action || '';
    lastActionAt = a ? Date.now() : 0;
    if (e.target.closest?.('.nav [data-tab]')) { pages.length = 0; justClosed = null; restoreGeneration++; }
    // ✕, or a tap on the dimmed area outside the popup: the user is done with all of them
    if (e.target.closest?.('#overlay [data-action="closeModal"]') || e.target.classList?.contains('modal-backdrop')) userCloseAt = Date.now();
    // 3.4.2: a button inside the popup that is not a close button — only this may lead from the popup to a page
    else {
      const b = e.target.closest?.('#overlay .sheet button, #overlay .sheet a, #overlay .sheet [data-action]');
      const label = (b?.getAttribute('aria-label') || '') + ' ' + (b?.textContent || '').trim();
      if (b && !/^(✕|×|x)$/i.test((b.textContent || '').trim()) && !/關閉|取消|close|cancel/i.test(label)) { popupClickAt = Date.now(); userCloseAt = 0; }
    }
    backAt = e.target.closest?.('[data-action="back"],[data-action="closeChat"],[data-action="momentsHome"]') ? Date.now() : 0;
  }, true);

  // 3.4.2: tapping the dimmed area outside any popup closes it (press and release both outside the sheet, so dragging
  // out of a text box while selecting doesn't close it)
  let downOnBackdrop = false;
  document.addEventListener('pointerdown', (e) => { downOnBackdrop = !!e.target.classList?.contains('modal-backdrop'); }, true);
  document.addEventListener('click', (e) => {
    if (!downOnBackdrop || !e.target.classList?.contains('modal-backdrop') || !modal) return;
    downOnBackdrop = false; userCloseAt = Date.now();
    try { typeof actions.closeModal === 'function' ? actions.closeModal() : closeModal(); } catch { closeModal(); }
  });
  const showBefore = showModal;
  showModal = function (name, body, footer = '', ...rest) {
    if (!restoring) {
      const prev = modal ? shown : justClosed && Date.now() - justClosed.at < 400 ? justClosed.popup : null;
      if (prev && prev.name !== name) {
        const i = stack.findIndex((p) => p.name === name);
        if (i >= 0) stack = stack.slice(0, i);   // opening one that is already under: go back to it
        else stack.push({ ...prev, scroll: document.querySelector('#overlay .sheet')?.scrollTop || 0 });
        if (stack.length > 8) stack.shift();
      }
      if (!modal && !(justClosed && Date.now() - justClosed.at < 400)) stack = [];
    }
    justClosed = null;
    const r = showBefore.call(this, name, body, footer, ...rest);
    const action = Date.now() - lastActionAt < 600 && typeof actions[lastAction] === 'function' && lastAction !== 'closeModal' ? lastAction : (shown?.name === name ? shown.action : '');
    // a popup with live parts (the camera, a video call) can't be rebuilt from saved content: never reopen it
    const live = /mzCamVideo|<video[^>]*autoplay|data-nostack/.test(String(body || ''));
    shown = live ? null : { name, body, footer, action };
    if (live) { stack = []; justClosed = null; }
    return r;
  };
  const closeBefore = closeModal;
  closeModal = function (...a) {
    // closed by ✕, the backdrop, back, Esc, its own close button or by code without a tap inside: it's gone for good
    if (Date.now() - userCloseAt < 400 || Date.now() - popupClickAt > 500) { if (!restoring) { stack = []; justClosed = null; } }
    else if (shown) justClosed = { popup: { ...shown, scroll: document.querySelector('#overlay .sheet')?.scrollTop || 0 }, at: Date.now(), stack: stack.slice() };
    const r = closeBefore.apply(this, a);
    if (!modal) shown = null;
    return r;
  };
  const open = (p) => {
    restoring = true;
    try {
      if (p.action && typeof actions[p.action] === 'function') actions[p.action]();
      if (!modal) showModal(p.name, p.body, p.footer);
    } catch { try { showModal(p.name, p.body, p.footer); } catch {} }
    finally {
      if (shown?.name === p.name) shown.action = p.action;
      restoring = false;
    }
    setTimeout(() => { const s = document.querySelector('#overlay .sheet'); if (s && p.scroll) s.scrollTop = p.scroll; }, 30);
  };

  // popup → page, and back again
  const renderBefore = render;
  render = function (...a) {
    const was = lastRoute, r = renderBefore.apply(this, a);
    try {
      const now = route(); lastRoute = now;
      if (was && now !== was) {
        const generation = ++restoreGeneration;
        const top = pages[pages.length - 1];
        if (top && top.to === was && top.from === now && Date.now() - backAt < 900) {
          pages.pop();
          setTimeout(() => { if (generation === restoreGeneration && route() === now && !modal) { stack = top.stack; open(top.popup); } }, 80);
        } else if (justClosed && Date.now() - justClosed.at < 600 && Date.now() - backAt > 900) {
          pages.push({ from: was, to: now, popup: justClosed.popup, stack: justClosed.stack });
          if (pages.length > 10) pages.shift();
          justClosed = null;
        }
      }
    } catch {}
    return r;
  };
  const goBackBefore = window.goBack;
  window.goBack = function (...a) {
    if (window.mzClosePhotoViewer?.()) return true;
    backAt = Date.now();
    restoreGeneration++;
    if (modal && stack.length) { const prev = stack.pop(); restoring = true; try { closeBefore(); } finally { restoring = false; } shown = null; open(prev); return true; }
    if (modal) { stack = []; popupClickAt = 0; justClosed = null; }
    return goBackBefore?.apply(this, a);
  };
  lastRoute = route();
}
