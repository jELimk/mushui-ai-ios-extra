'use strict';
// AI 記帳: say what you spent in a sentence and the AI files it; the wallet page adds it up by week, month and year.
// These are the person's real-life expenses, kept with the account. Amounts are shown in 沐水幣 as the unit, but this
// never touches the virtual coin balance: one number stands for real money, and only the person needs to know that.
// settings.ledger: {id:{t,amount,category,note,at,gone}}. A deleted entry stays as gone:true so it can't come back from another device.
(() => {
  const W = WebEngine, CATEGORIES = ['餐飲', '交通', '購物', '娛樂', '居家', '醫療', '學習', '其他'];
  const NAMES_EN = { 餐飲: 'Food', 交通: 'Transport', 購物: 'Shopping', 娛樂: 'Fun', 居家: 'Home', 醫療: 'Health', 學習: 'Learning', 其他: 'Other' };
  let period = 'month', advice = '';
  const label = (c) => mzT(c, NAMES_EN[c] || c);
  const entries = () => Object.entries(state.settings.ledger || {}).filter(([, e]) => !e.gone).map(([id, e]) => ({ id, ...e })).sort((a, b) => b.at - a.at);
  const money = (n) => Math.round(n * 100) / 100;
  const coins = (n) => money(n).toLocaleString() + mzT(' 沐水幣', ' Mizuki coins');

  function since(kind, now = new Date()) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (kind === 'week') d.setDate(d.getDate() - (d.getDay() + 6) % 7);
    if (kind === 'month') d.setDate(1);
    if (kind === 'year') d.setMonth(0, 1);
    return d.getTime();
  }
  const within = (kind) => entries().filter((e) => e.at >= since(kind));
  const total = (list) => money(list.reduce((sum, e) => sum + e.amount, 0));
  window.mzLedgerMonth = () => total(within('month'));

  function view() {
    const list = within(period), sum = total(list), byKind = {};
    for (const e of list) byKind[e.category] = (byKind[e.category] || 0) + e.amount;
    const kinds = Object.entries(byKind).sort((a, b) => b[1] - a[1]);
    const tabs = [['week', mzT('本週', 'This week')], ['month', mzT('本月', 'This month')], ['year', mzT('今年', 'This year')]].map(([k, name]) => `<button class="pill ${k === period ? 'primary' : ''}" data-ledgerperiod="${k}">${name}</button>`).join('');
    return `<div class="flex mz-ledger-tabs">${tabs}</div><div class="card wx-wallet-card"><span class="small">${mzT('總共花了', 'Total spent')}</span><strong>${coins(sum)}</strong></div><p class="small">${mzT('這裡記的是現實中的真實花費，單位用沐水幣顯示，不會扣你的沐水幣餘額。', 'This tracks your real-life spending. Amounts are shown in Mizuki coins and never touch your coin balance.')}</p>${kinds.map(([c, n]) => `<div class="mz-ledger-kind"><span>${esc(label(c))}</span><i style="--share:${sum ? Math.round(n / sum * 100) : 0}%"></i><b>${coins(n)}</b></div>`).join('')}<label for="mzLedgerText">${mzT('說一句話記帳', 'Tell the AI what you spent')}</label><input id="mzLedgerText" type="text" placeholder="${mzT('例如：午餐花了 120、昨天搭車 30', 'For example: lunch 120, bus yesterday 30')}"><div class="flex"><button class="pill primary" data-action="aiLedgerAdd">${mzT('記下來', 'Save')}</button>${list.length ? `<button class="pill" data-action="aiLedgerAdvice">${mzT('請 AI 看看', 'Ask the AI')}</button>` : ''}</div><p id="mzLedgerStatus" class="small user-content">${esc(advice)}</p><div class="mz-ledger-list">${list.slice(0, 50).map((e) => `<div class="mz-queue-row"><span class="spacer user-content">${esc(e.note || label(e.category))}<small class="help">${new Date(e.at).toLocaleDateString()} · ${esc(label(e.category))}</small></span><b>${coins(e.amount)}</b><button class="pill" data-ledgerdelete="${esc(e.id)}" aria-label="${mzT('刪除', 'Delete')}">×</button></div>`).join('') || `<p class="help">${mzT('這段時間還沒有記錄。', 'Nothing recorded for this period yet.')}</p>`}</div>`;
  }
  const open = () => showModal(mzT('AI 記帳', 'AI expense tracker'), view());
  actions.aiLedger = () => { advice = ''; open(); };

  // Used when the AI can't be reached: every number in the sentence is one expense, with the words before it as its name.
  function plainRead(text) {
    const out = [];
    for (const m of text.matchAll(/([^\d，,、。;；\n]*?)\s*(\d+(?:\.\d+)?)\s*(?:沐水幣|元|塊|块|nt|twd)?/gi)) out.push({ amount: +m[2], category: '其他', note: m[1].trim(), daysAgo: /昨天|yesterday/i.test(m[1]) ? 1 : 0 });
    return out;
  }
  const clean = (items) => (Array.isArray(items) ? items : []).map((x) => ({ amount: money(+x.amount), category: CATEGORIES.includes(x.category) ? x.category : '其他', note: String(x.note || '').slice(0, 80), daysAgo: Math.max(0, Math.min(366, Math.floor(+x.daysAgo || 0))) })).filter((x) => x.amount > 0 && x.amount < 1e8);
  window.mzLedgerClean = clean; window.mzLedgerPlain = plainRead;

  async function save(items) {
    const now = Date.now();
    await W.edit((s) => {
      s.settings.ledger ||= {};
      for (const x of items) { const day = new Date(); day.setDate(day.getDate() - x.daysAgo); s.settings.ledger['e' + now.toString(36) + Math.random().toString(36).slice(2, 7)] = { t: now, amount: x.amount, category: x.category, note: x.note, at: x.daysAgo ? day.getTime() : now }; }
    });
    state = await call('load');
  }

  actions.aiLedgerAdd = async () => {
    const text = document.querySelector('#mzLedgerText')?.value.trim(), status = document.querySelector('#mzLedgerStatus');
    if (!text) return;
    status.textContent = mzT('AI 正在記帳…', 'The AI is saving this…');
    let items = [];
    try {
      const s = await W.read();
      const raw = await W.complete(s.settings, '你是記帳助手，把使用者現實生活的真實花費拆開記錄，金額照使用者說的數字。只回 JSON：{"items":[{"amount":數字,"category":"' + CATEGORIES.join('／') + '其中之一","note":"簡短名稱","daysAgo":幾天前的整數，今天是0}]}。沒有金額就回空陣列。不要猜金額。', [{ role: 'user', content: text }]);
      items = clean(W.json(raw)?.items);
    } catch {}
    if (!items.length) items = clean(plainRead(text));
    if (!items.length) { status.textContent = mzT('沒有讀到金額，試試「午餐 120」。', 'No amount found. Try “lunch 120”.'); return; }
    await save(items);
    advice = mzT('已記下 ' + items.length + ' 筆', 'Saved ' + items.length + (items.length > 1 ? ' items' : ' item'));
    open();
  };

  actions.aiLedgerAdvice = async () => {
    const status = document.querySelector('#mzLedgerStatus'), list = within(period);
    status.textContent = mzT('AI 正在看…', 'The AI is reading…');
    try {
      const s = await W.read();
      const lines = list.slice(0, 80).map((e) => new Date(e.at).toLocaleDateString() + ' ' + e.category + ' ' + (e.note || '') + ' ' + e.amount).join('\n');
      advice = String(await W.complete(s.settings, '你是溫柔的記帳助手。資料是使用者現實生活的真實花費，金額單位稱為沐水幣。用兩三句繁體中文說這段時間錢主要花在哪、和一個實際的小建議。只根據資料，不要編造，也不提供投資建議。', [{ role: 'user', content: lines }])).trim();
    } catch (e) { advice = mzT('AI 暫時無法回覆：', 'The AI can\'t reply right now: ') + e.message; }
    open();
  };

  document.addEventListener('click', async (e) => {
    const tab = e.target.closest('[data-ledgerperiod]'), gone = e.target.closest('[data-ledgerdelete]');
    if (tab) { period = tab.dataset.ledgerperiod; advice = ''; open(); }
    if (gone) {
      const id = gone.dataset.ledgerdelete;
      await W.edit((s) => { const entry = s.settings.ledger?.[id]; if (entry) s.settings.ledger[id] = { ...entry, gone: true, t: Date.now() }; });
      state = await call('load'); advice = ''; open();
    }
  });
  document.addEventListener('keydown', (e) => { if (e.target.id === 'mzLedgerText' && e.key === 'Enter' && !e.isComposing) { e.preventDefault(); actions.aiLedgerAdd(); } });
})();
