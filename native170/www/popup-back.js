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
  let lastAction = '', lastActionAt = 0, userCloseAt = 0, backAt = 0, restoring = false;
  const pages = [];          // { from, to, popup, stack } when a popup led to a page
  const route = () => [tab, page, chatId, typeof momentProfileId === 'undefined' ? '' : momentProfileId].join('|');
  let lastRoute = '';

  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('[data-action]');
    if (a) { lastAction = a.dataset.action; lastActionAt = Date.now(); }
    // ✕, or a tap on the dimmed area outside the popup: the user is done with all of them
    if (e.target.closest?.('#overlay [data-action="closeModal"]') || e.target.classList?.contains('modal-backdrop')) userCloseAt = Date.now();
    if (e.target.closest?.('[data-action="back"],[data-action="closeChat"],[data-action="momentsHome"]')) backAt = Date.now();
  }, true);

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
    shown = { name, body, footer, action };
    return r;
  };
  const closeBefore = closeModal;
  closeModal = function (...a) {
    if (Date.now() - userCloseAt < 400) { stack = []; justClosed = null; }
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
    finally { restoring = false; }
    setTimeout(() => { const s = document.querySelector('#overlay .sheet'); if (s && p.scroll) s.scrollTop = p.scroll; }, 30);
  };

  // popup → page, and back again
  const renderBefore = render;
  render = function (...a) {
    const was = lastRoute, r = renderBefore.apply(this, a);
    try {
      const now = route(); lastRoute = now;
      if (was && now !== was) {
        const top = pages[pages.length - 1];
        if (top && top.to === was && top.from === now && Date.now() - backAt < 900) {
          pages.pop();
          setTimeout(() => { if (!modal) { stack = top.stack; open(top.popup); } }, 80);
        } else if (justClosed && Date.now() - justClosed.at < 1500 && Date.now() - backAt > 900) {
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
    backAt = Date.now();
    if (modal && stack.length) { const prev = stack.pop(); restoring = true; try { closeBefore(); } finally { restoring = false; } shown = null; open(prev); return true; }
    if (modal) stack = [];
    return goBackBefore?.apply(this, a);
  };
  lastRoute = route();
}
