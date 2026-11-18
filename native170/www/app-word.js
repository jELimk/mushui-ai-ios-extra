'use strict';
// 3.4.0: the Chinese interface writes "APP" instead of "App" everywhere (screens, windows, notices). People's own
// messages and posts are left exactly as written. English keeps normal English ("app").
{
  const WORD = /(^|[^A-Za-z])App(?![A-Za-z])/g;
  const SKIP = '.bubble,.user-content,.moment,.moment-text,textarea,script,style,[contenteditable]';
  const english = () => document.documentElement.lang?.startsWith('en') || window.MushuiLocale === 'en';
  const fix = (root) => {
    if (!root || english()) return;
    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.nodeValue.includes('App') && !n.parentElement?.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
      const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const n of nodes) n.nodeValue = n.nodeValue.replace(WORD, '$1APP');
      for (const el of root.querySelectorAll('[placeholder*="App"],[title*="App"],[aria-label*="App"]')) {
        if (el.closest(SKIP.replace(',textarea', ''))) continue;
        for (const a of ['placeholder', 'title', 'aria-label']) { const v = el.getAttribute(a); if (v && v.includes('App')) el.setAttribute(a, v.replace(WORD, '$1APP')); }
      }
    } catch {}
  };
  if (typeof pageNames === 'object') pageNames.privacy = '隱私與 App 鎖';
  const renderBefore = render;
  render = function (...args) { const r = renderBefore.apply(this, args); fix(document.getElementById('app')); fix(document.getElementById('overlay')); return r; };
  const modalBefore = showModal;
  showModal = function (...args) { const r = modalBefore.apply(this, args); fix(document.getElementById('overlay')); return r; };
  const toastBefore = toast;
  toast = function (text, ...rest) { return toastBefore.call(this, typeof text === 'string' && !english() ? text.replace(WORD, '$1APP') : text, ...rest); };
  window.mzAppWord = fix;
}
