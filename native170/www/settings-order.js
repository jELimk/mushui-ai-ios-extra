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
  { const c = document.createElement('style'); c.textContent = '.mz-lang-pick .setting-row{border-radius:12px}.mz-lang-pick .mz-lang-on{background:color-mix(in srgb,var(--accent) 16%,transparent)!important;font-weight:700;color:var(--accent-deep,var(--accent))}.mz-lang-dot{width:22px;height:22px;border-radius:50%;border:2px solid var(--line);margin-left:auto;flex:none}.mz-lang-on .mz-lang-dot{border-color:var(--accent);background:var(--accent) url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Cpath d=%27M6 12.5l4 4 8-9%27 fill=%27none%27 stroke=%27white%27 stroke-width=%273%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E") center/16px no-repeat}'; document.head.append(c); }
  // 3.4.4: 語言 opens a popup (like 帳號) instead of a page
  const LANGS = () => [['system', mzT('跟隨系統', 'Follow system')], ['zh-Hant', '繁體中文'], ['en', 'English']];
  const langSheet = () => {
    const cur = state?.settings?.uiLanguage || 'system';
    showModal(mzT('語言', 'Language'), `<p class="help">${mzT('每個語言都以自己的語言顯示，例如 English 永遠顯示 English。', 'Each language is shown in itself — English always reads English.')}</p><div class="card mz-lang-pick">${LANGS().map(([v, l]) => `<button class="setting-row ${cur === v ? 'mz-lang-on' : ''}" data-mzlangpick="${v}"><span class="label">${l}</span><span class="mz-lang-dot"></span></button>`).join('')}</div>`);
  };
  document.addEventListener('click', async (e) => {
    const row = e.target.closest?.('#app .setting-row[data-page="language"]');
    if (row) { e.preventDefault(); e.stopImmediatePropagation(); langSheet(); return; }
    const pickBtn = e.target.closest?.('[data-mzlangpick]');
    if (!pickBtn) return;
    e.preventDefault(); e.stopImmediatePropagation();
    try {
      const value = pickBtn.dataset.mzlangpick;
      await WebEngine.edit((s) => (s.settings.uiLanguage = value));
      state = await call('load'); draft = structuredClone(state.settings);
      closeModal(); render();
    } catch (err) { toast?.(err.message || String(err)); }
  }, true);
})();
