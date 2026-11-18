'use strict';
// 3.4.0: special messages in groups. A transfer, gift or delivery goes to one person or AI in the group; a red packet
// is grabbed by whoever is fastest; a relationship request goes to one person, or to one of your own AIs.
// Each travels as an ordinary group message with a mizuki-gcard:// line, so the server and older apps carry it as text;
// taking it is another message (mizuki-gcard-ok://), so everyone sees the same state.
{
  const W = window.WebEngine;
  const TYPES = { transfer: ['轉帳', 'Transfer'], redpacket: ['紅包', 'Red packet'], gift: ['禮物', 'Gift'], delivery: ['外送', 'Delivery'], relation: ['關係邀請', 'Relationship request'] };
  const label = (t) => mzT(...(TYPES[t] || TYPES.gift));
  const groupId = () => (typeof chatId === 'string' && chatId.startsWith('hgroup:') ? chatId.slice(7) : '');
  const groups = () => (typeof MizukiGroups !== 'undefined' ? MizukiGroups : null);
  const group = (gid) => groups()?.data?.groups?.find((g) => g.id === gid);
  const me = () => humanData().me || {};
  const enc = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const dec = (s) => { try { return JSON.parse(decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))); } catch { return null; } };
  const CARD = /mizuki-gcard:\/\/([A-Za-z0-9_-]+)/, OK = /mizuki-gcard-ok:\/\/([\w-]+)\/([a-z]+)\/([\d.]*)/;
  const coins = (n) => Number(n || 0).toFixed(2);

  // Who can receive: the other people, and the group's AIs (a relationship only with your own AIs).
  function people(gid, type) {
    const g = group(gid), mine = me().id;
    const humans = (g?.members || []).filter((p) => p.id !== mine).map((p) => ({ id: p.id, name: p.name || p.id, ai: false }));
    const ais = (g?.ais || []).filter((a) => type !== 'relation' || state.ais.some((x) => x.id === a.id)).map((a) => ({ id: a.id, name: a.name || ai(a.id)?.name || 'AI', ai: true }));
    return [...humans, ...ais];
  }
  async function post(gid, text, aiId) {
    await mizukiApi('/v1/groups/send', { group: gid, text, images: [], clientId: 'g' + crypto.randomUUID().replaceAll('-', ''), ...(aiId ? { aiAuthor: { id: aiId } } : {}) });
    if (typeof mizukiGroupsSync === 'function') mizukiGroupsSync().then(() => render()).catch(() => {});
  }
  const balance = () => Number(state.settings.mushuiCoins || 0);
  async function addCoins(n) { await W.edit((s) => { s.settings.mushuiCoins = Math.max(0, Number(s.settings.mushuiCoins || 0) + n); }); state = await call('load'); }

  // The window for making one.
  function compose(type) {
    const gid = groupId(); if (!gid) return;
    const list = people(gid, type);
    if (type !== 'redpacket' && !list.length) return toast(mzT('群組裡沒有可以送的對象', 'There is no one in this group to send to'));
    const pick = type === 'redpacket' ? `<label for="mzGcCount">${mzT('幾個人可以搶', 'How many can grab it')}</label><input id="mzGcCount" type="number" min="1" max="50" value="${Math.max(1, list.filter((p) => !p.ai).length || 1)}">`
      : `<label for="mzGcTo">${mzT('給誰', 'To')}</label><select id="mzGcTo">${list.map((p) => `<option value="${esc(p.id)}" data-ai="${p.ai ? 1 : ''}">${esc(p.name)}${p.ai ? ' · AI' : ''}</option>`).join('')}</select>`;
    const value = type === 'transfer' || type === 'redpacket' ? `<label for="mzGcValue">${mzT('金額（沐水幣）', 'Amount (Mizuki coins)')}</label><input id="mzGcValue" type="number" min="0.01" max="999999.99" step="0.01"><p class="small">${mzT('目前有 ', 'You have ')}${coins(balance())}${mzT(' 沐水幣', ' coins')}</p>`
      : type === 'relation' ? `<label for="mzGcRel">${mzT('關係', 'Relationship')}</label><select id="mzGcRel">${Object.entries(relationTypes).filter(([k]) => k !== 'custom').map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select>`
      : `<label for="mzGcValue">${type === 'delivery' ? mzT('餐點', 'Food') : mzT('禮物名稱', 'Gift')}</label><input id="mzGcValue" maxlength="100">`;
    showModal(label(type), `<p class="help">${mzT('會傳到群組，大家都看得到。只在 App 內，不會真的付款或送出。', 'Sent to the group, where everyone can see it. App-only: nothing is really paid or sent.')}</p>${pick}${value}<label for="mzGcNote">${mzT('附言（可不填）', 'Note (optional)')}</label><input id="mzGcNote" maxlength="200"><p id="mzGcError" class="inline-error"></p><button class="pill primary full" type="button" data-mzgcsend="${type}">${mzT('傳送', 'Send')}</button>`);
  }
  async function send(type) {
    const gid = groupId(), note = document.querySelector('#mzGcNote')?.value.trim() || '', raw = document.querySelector('#mzGcValue')?.value.trim() || '';
    const sel = document.querySelector('#mzGcTo'), opt = sel?.selectedOptions?.[0], card = { id: crypto.randomUUID().slice(0, 12), type, from: { id: me().id, name: me().name || me().id }, note };
    if (sel) card.to = { id: sel.value, name: opt.textContent.replace(/ · AI$/, ''), ai: !!opt.dataset.ai };
    if (type === 'transfer' || type === 'redpacket') {
      const amount = Math.round(Number(raw) * 100) / 100;
      if (!(amount > 0) || amount > 999999.99) throw Error(mzT('請填有效的金額', 'Enter a valid amount'));
      if (balance() < amount) throw Error(mzT('沐水幣不足；可到設定領取每日零用幣。', 'Not enough coins; claim your daily coins in Settings.'));
      card.amount = amount;
      if (type === 'redpacket') {
        const n = Math.max(1, Math.min(50, Math.floor(+document.querySelector('#mzGcCount').value || 1)));
        // Random shares that add up to the total, decided now so everyone sees the same ones.
        let left = Math.round(amount * 100); const shares = [];
        for (let i = n; i > 1; i--) { const most = Math.max(1, Math.floor(left / i * 2) - 1), take = Math.max(1, Math.min(left - (i - 1), Math.floor(Math.random() * most) + 1)); shares.push(take); left -= take; }
        shares.push(left); card.shares = shares.map((x) => x / 100);
      }
    } else if (type === 'relation') { const k = document.querySelector('#mzGcRel').value; card.rel = k; card.title = relationTypes[k]?.label || ''; }
    else { if (!raw) throw Error(mzT('請填寫內容', 'Fill it in first')); card.title = raw; }
    const head = type === 'redpacket' ? '🧧 ' + mzT('紅包', 'Red packet') + ' · ' + coins(card.amount) : (TYPES[type] ? label(type) : '') + (card.to ? ' → ' + card.to.name : '') + (card.title ? '：' + card.title : card.amount ? '：' + coins(card.amount) : '');
    if (card.amount) await addCoins(-card.amount);
    try { await post(gid, head + (note ? '\n' + note : '') + '\nmizuki-gcard://' + enc(card)); }
    catch (e) { if (card.amount) await addCoins(card.amount); throw e; }
    // A real relationship with a person still needs their yes, through the usual request.
    if (type === 'relation' && card.to && !card.to.ai) humanCall({ action: 'relation', verb: 'invite', id: card.to.id, type: card.rel, label: card.title, anniversary: new Date().toISOString().slice(0, 10) }).catch(() => {});
    closeModal();
  }

  // What has happened to a card so far, from the group's messages.
  function takenOf(cardId) {
    return (groups()?.data?.messages || []).map((m) => OK.exec(m.text || '')).filter((x) => x && x[1] === cardId).map((x) => ({ verb: x[2], amount: +x[3] || 0 }));
  }
  function whoTook(cardId) {
    return (groups()?.data?.messages || []).filter((m) => { const x = OK.exec(m.text || ''); return x && x[1] === cardId; }).map((m) => m.aiAuthor ? 'ai:' + m.aiAuthor.id : m.sender);
  }
  async function take(card, verb, asAi) {
    const gid = groupId(), taken = takenOf(card.id);
    let amount = 0;
    if (card.type === 'redpacket') { const i = taken.length; if (i >= (card.shares || []).length) return toast(mzT('紅包已經被搶完了', 'The red packet is all gone')); amount = card.shares[i]; }
    else if (card.type === 'transfer' && verb === 'ok') amount = card.amount;
    const name = asAi ? (ai(asAi)?.name || 'AI') : (me().name || me().id);
    const what = card.type === 'relation' ? (verb === 'ok' ? mzT(`接受了 ${card.from.name} 的關係邀請（${card.title}）`, `accepted ${card.from.name}'s request (${card.title})`) : mzT(`婉拒了 ${card.from.name} 的關係邀請`, `declined ${card.from.name}'s request`))
      : card.type === 'redpacket' ? mzT(`搶到了 ${card.from.name} 的紅包 ${coins(amount)} 沐水幣`, `grabbed ${coins(amount)} coins from ${card.from.name}'s red packet`)
      : verb === 'ok' ? mzT(`收下了 ${card.from.name} 的${label(card.type)}`, `accepted ${card.from.name}'s ${label(card.type).toLowerCase()}`) : mzT(`退回了 ${card.from.name} 的${label(card.type)}`, `returned ${card.from.name}'s ${label(card.type).toLowerCase()}`);
    await post(gid, name + ' ' + what + '\nmizuki-gcard-ok://' + card.id + '/' + verb + '/' + (amount || ''), asAi);
    if (!asAi && amount) await addCoins(amount);
    if (card.type === 'relation' && !asAi && verb === 'ok') humanCall({ action: 'relation', verb: 'accept', id: card.from.id }).catch(() => {});
  }

  // Cards and the lines about them, drawn in the chat.
  const handled = new Set();
  function decorate() {
    const gid = groupId(); if (!gid) return;
    const mine = me().id;
    for (const bubble of document.querySelectorAll('.message[data-message-id^="hg-"] .bubble')) {
      const text = bubble.textContent;
      if (!text.includes('mizuki-gcard')) continue;
      const ok = OK.exec(text);
      if (ok && !bubble.dataset.mzgc) { bubble.dataset.mzgc = 'ok'; bubble.innerHTML = `<span class="mz-gc-line">${esc(text.replace(/mizuki-gcard-ok:\/\/\S+/, '').trim())}</span>`; continue; }
      const hit = CARD.exec(text), card = hit && dec(hit[1]);
      if (!card) continue;
      const taken = takenOf(card.id), took = whoTook(card.id), forMe = card.to && !card.to.ai && card.to.id === mine;
      const done = card.type === 'redpacket' ? taken.length >= (card.shares || []).length : taken.length > 0;
      const status = card.type === 'redpacket' ? mzT(`已搶 ${taken.length}/${(card.shares || []).length}`, `${taken.length}/${(card.shares || []).length} grabbed`)
        : done ? (taken[0].verb === 'ok' ? mzT('已收下', 'Accepted') : mzT('已婉拒', 'Declined')) : mzT('等待對方', 'Waiting');
      const canGrab = card.type === 'redpacket' && !done && !took.includes(mine);
      const buttons = canGrab ? `<button class="pill primary" type="button" data-mzgcgrab="${esc(card.id)}">${mzT('搶紅包', 'Grab')}</button>`
        : forMe && !done ? `<button class="pill primary" type="button" data-mzgcok="${esc(card.id)}">${card.type === 'relation' ? mzT('接受', 'Accept') : mzT('收下', 'Accept')}</button><button class="pill" type="button" data-mzgcno="${esc(card.id)}">${card.type === 'relation' ? mzT('婉拒', 'Decline') : mzT('退回', 'Return')}</button>` : '';
      const sig = JSON.stringify([taken, took, buttons]);
      if (bubble.dataset.mzgc === sig) continue;
      bubble.dataset.mzgc = sig;
      bubble._mzCard = card;
      bubble.classList.add('mz-gc-bubble');
      const value = card.amount ? coins(card.amount) + mzT(' 沐水幣', ' coins') : card.title || '';
      bubble.innerHTML = `<div class="virtual-card mz-gc-card mz-gc-${esc(card.type)}"><strong>${esc(label(card.type))}${card.to ? ' · ' + mzT('給 ', 'to ') + esc(card.to.name) : ''}</strong><div class="virtual-value">${esc(value)}</div>${card.note ? `<p>${esc(card.note)}</p>` : ''}<div class="small">${esc(status)}</div><div class="card-actions">${buttons}</div></div>`;
      // One of your own AIs answers by itself: it takes what it was given, and decides on a relationship in character.
      if (card.to?.ai && !done && state.ais.some((x) => x.id === card.to.id) && !handled.has(card.id)) { handled.add(card.id); answerAsAi(card).catch(() => handled.delete(card.id)); }
    }
  }
  async function answerAsAi(card) {
    const a = ai(card.to.id);
    if (card.type !== 'relation') return take(card, 'ok', a.id);
    let yes = true;
    try { const raw = await W.complete(state.settings, W.system(a) + '\n' + card.from.name + ' 在群組裡邀請你成為「' + card.title + '」。依你的個性和你們的相處決定接不接受。只回 JSON {accept:true或false}', [{ role: 'user', content: card.note || card.title }]); yes = W.json(raw).accept !== false; } catch {}
    await take(card, yes ? 'ok' : 'no', a.id);
    if (yes && card.from.id === me().id) { const t = relationTypes[card.rel] || {}; await mutate('relationship', { id: a.id, type: card.rel, label: card.title, aiRole: t.aiRole || '', userRole: t.userRole || '', anniversary: new Date().toISOString().slice(0, 10) }).catch(() => {}); }
  }
  const renderBefore = render;
  render = function (...args) { const r = renderBefore.apply(this, args); try { decorate(); } catch {} return r; };
  setInterval(() => { try { decorate(); } catch {} }, 1500);

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-mzgcsend],[data-mzgcgrab],[data-mzgcok],[data-mzgcno],[data-mzgcopen]');
    if (!b) return;
    try {
      if (b.dataset.mzgcopen) return compose(b.dataset.mzgcopen);
      if (b.dataset.mzgcsend) return await send(b.dataset.mzgcsend);
      const card = b.closest('.mz-gc-bubble')?._mzCard;
      if (!card) return;
      b.disabled = true;
      await take(card, b.dataset.mzgcno ? 'no' : 'ok');
    } catch (x) { const box = document.querySelector('#mzGcError'); if (box) box.textContent = x.message; else toast(x.message); b.disabled = false; }
  });

  // In a group, the + menu's money and gift buttons make the group version.
  const remap = { sendVirtualTransfer: 'transfer', sendRedPacket: 'redpacket', sendVirtualGift: 'gift', sendVirtualDelivery: 'delivery' };
  for (const [name, type] of Object.entries(remap)) {
    const before = actions[name];
    actions[name] = (...args) => (groupId() ? compose(type) : before?.(...args));
  }
  const menuBefore = syncComposerPanel;
  syncComposerPanel = function (...args) {
    const r = menuBefore.apply(this, args);
    try {
      const menu = document.querySelector('.composer-menu');
      if (menu && groupId()) {
        const have = (a) => menu.querySelector(`[data-action="${a}"]`);
        const add = (type, ico, name) => menu.insertAdjacentHTML('beforeend', `<button type="button" data-mzgcopen="${type}">${icon(ico)}<span>${name}</span></button>`);
        if (!have('sendVirtualTransfer') && !menu.querySelector('[data-mzgcopen="transfer"]')) add('transfer', 'transfer', mzT('轉帳', 'Transfer'));
        if (!have('sendRedPacket') && !menu.querySelector('[data-mzgcopen="redpacket"]')) add('redpacket', 'redpacket', mzT('發紅包', 'Red packet'));
        if (!have('sendVirtualGift') && !menu.querySelector('[data-mzgcopen="gift"]')) add('gift', 'gift', mzT('送禮', 'Gift'));
        if (!have('sendVirtualDelivery') && !menu.querySelector('[data-mzgcopen="delivery"]')) add('delivery', 'delivery', mzT('點外送', 'Delivery'));
        // 3.4.0 r11: relationship requests stay in private chats and Contacts; groups don't offer them.
      }
    } catch {}
    return r;
  };
}
