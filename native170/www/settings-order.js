// Settings home order (the user, 3.4.3). Rows are added by many older files, so the final order is set here, after them:
//   專屬於你的陪伴: 語言 → 模型與 API → 記憶 → AI 的日常 → 外觀
//   通知與裝置: 聊天 → 通知 → 提示音 → 隱私與 APP 鎖 → 裝置
//   資料與帳號 (last section): 帳號 → 備份與還原 → 關於      (讓日常更像你 is emptied and removed)
(() => {
  const ORDER = {
    api: ['language', 'api', 'memory', 'life', 'appearance'],
    notifications: ['chat', 'notifications', 'coins', 'privacy', 'devices'],
    backup: ['humanAccount', 'backup', 'about'],
  };
  const key = (b) => b.dataset.page || b.dataset.action || '';
  const fix = () => {
    const root = document.querySelector('#app');
    const row = (k) => root?.querySelector(`.card > .setting-row[data-page="${k}"], .card > .setting-row[data-action="${k}"]`);
    const cards = {};
    for (const k of Object.keys(ORDER)) cards[k] = row(k)?.parentElement;
    if (!cards.api || !cards.notifications || !cards.backup) return;
    for (const [k, list] of Object.entries(ORDER)) {
      const card = cards[k];
      for (const id of list) { const r = row(id); if (r && r.parentElement !== card) card.appendChild(r); }
      const rows = [...card.children].filter((b) => b.matches('.setting-row'));
      const rank = (b) => { const i = list.indexOf(key(b)); return i < 0 ? 50 : i; };
      const want = [...rows].sort((a, b) => rank(a) - rank(b));
      if (want.some((b, i) => b !== rows[i])) want.forEach((b) => card.appendChild(b));
    }
    // drop sections left without rows, then keep 資料與帳號 as the last section
    root.querySelectorAll('.content > .section-label + .card').forEach((card) => {
      if (!card.querySelector('.setting-row')) { card.previousElementSibling.remove(); card.remove(); }
    });
    const card = cards.backup, label = card.previousElementSibling;
    if (!label?.matches('.section-label')) return;
    let last = null; for (const c of card.parentElement.querySelectorAll(':scope > .section-label + .card')) last = c;
    if (last && last !== card) last.after(label, card);
  };
  const before = render;
  render = function (...a) { const r = before.apply(this, a); try { fix(); } catch {} return r; };
  try { new MutationObserver(() => { try { fix(); } catch {} }).observe(document.querySelector('#app'), { childList: true, subtree: true }); } catch {}
  window.mzSettingsOrder = fix;
})();
