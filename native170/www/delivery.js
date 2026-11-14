'use strict';
// 3.4.0: virtual food delivery. An AI or a friend can "order delivery" for you, like sending a gift: it costs no
// 沐水幣 and nothing is really ordered. It travels as a gift card with delivery: true, so accepting, declining, syncing
// and the server all work exactly as gifts do; only how it looks and how it's sent are its own.
{
  const W = window.WebEngine;
  if (typeof paths === 'object' && !paths.delivery) paths.delivery = 'M3 7h11v8H3zM14 10h4l3 3v2h-7zM6.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z';
  const isDelivery = (c) => !!c && (c.delivery === true || c.delivery === 'True' || c.delivery === 'true' || c.type === 'delivery');
  const PICKS = [['珍珠奶茶', 'Bubble tea'], ['炸雞', 'Fried chicken'], ['拉麵', 'Ramen'], ['披薩', 'Pizza'], ['蛋糕', 'Cake'], ['鹹酥雞', 'Taiwanese popcorn chicken'], ['壽司', 'Sushi'], ['熱湯', 'Hot soup']];

  // AI replies may say {type:"delivery", ...}; it is stored as a gift that knows it's a delivery.
  const canonicalBefore = W.canonicalCard;
  W.canonicalCard = (c) => {
    if (!isDelivery(c)) return canonicalBefore(c);
    const base = canonicalBefore({ ...c, type: 'gift', title: c.title || c.food || c.item });
    if (!base) return null;
    return { ...base, delivery: true, shop: W.clean(String(c.shop || c.store || '').slice(0, 40), 40) };
  };

  // The AI may order delivery the same way it sends a gift.
  const systemBefore = W.system;
  W.system = (a) => systemBefore(a) + (state?.settings?.virtualCards ? '\n虛擬外送：除了轉帳、紅包、禮物，card 也可以是 {type:delivery,title:餐點,shop:店家,note:留言}，代表你幫對方點了一份虛擬外送（不花沐水幣、不會真的送餐，就像送禮物）。對方說餓、想吃什麼、很累或心情不好時，偶爾依個性幫他點，不要每次都點。' : '');

  // How a delivery card looks: its own name, icon, shop line and wording; still the gift's buttons underneath.
  const cardBefore = virtualCardHtml;
  virtualCardHtml = function (m) {
    const html = cardBefore(m), c = m?.virtualCard;
    if (!html || !isDelivery(c)) return html;
    const shop = c.shop ? `<div class="small mz-delivery-shop">${esc(c.shop)} · ${mzT('外送員已出發', 'On the way')}</div>` : `<div class="small mz-delivery-shop">${mzT('外送員已出發', 'On the way')}</div>`;
    return html
      .replace(/^<div class="virtual-card /, '<div class="virtual-card mz-delivery-card ')
      .replace(icon('gift'), icon('delivery'))
      .replace('<strong>虛擬禮物</strong>', `<strong>${mzT('虛擬外送', 'Virtual delivery')}</strong>`)
      .replace(/(<div class="virtual-value">[\s\S]*?<\/div>)/, '$1' + shop)
      .replace('收下禮物', mzT('收下外送', 'Accept delivery'))
      .replace('已接收這份禮物', mzT('已收下這份外送', 'Delivery received'))
      .replace('純虛擬沐水幣 · 無現金價值', mzT('純虛擬外送 · 不花沐水幣 · 不會真的送餐', 'Virtual only · costs no coins · nothing is really delivered'));
  };

  // Ordering for someone: the composer's + menu gets 點外送 next to 送禮.
  const menuBefore = syncComposerPanel;
  syncComposerPanel = function (...args) {
    const r = menuBefore.apply(this, args);
    try {
      const gift = document.querySelector('.composer-menu [data-action="sendVirtualGift"]');
      if (gift && !document.querySelector('.composer-menu [data-action="sendVirtualDelivery"]')) gift.insertAdjacentHTML('afterend', `<button type="button" data-action="sendVirtualDelivery">${icon('delivery')}<span>${mzT('點外送', 'Order delivery')}</span></button>`);
      // The menu fills two rows a page at a time (4 per row), read left to right; later pages are a swipe away.
      [...document.querySelectorAll('.composer-menu > button')].forEach((b, i) => { const page = Math.floor(i / 8), w = i % 8; b.style.order = String(page * 8 + (w % 4) * 2 + Math.floor(w / 4)); });
    } catch {}
    return r;
  };
  actions.sendVirtualDelivery = () => {
    showModal(mzT('點外送', 'Order delivery'), `<p class="help">${mzT('幫對方點一份虛擬外送，就像送禮物：只在 App 內顯示，不花沐水幣，也不會真的送餐。', "Order a virtual delivery for them, like a gift: it only shows in the app, costs no 沐水幣, and nothing is really delivered.")}</p>
      <div class="mz-delivery-picks">${PICKS.map(([zh, en]) => `<button class="chip" type="button" data-deliverypick="${esc(mzT(zh, en))}">${esc(mzT(zh, en))}</button>`).join('')}</div>
      <label for="mzDeliveryFood">${mzT('餐點', 'Food')}</label><input id="mzDeliveryFood" maxlength="100" placeholder="${mzT('例如：珍珠奶茶', 'e.g. Bubble tea')}">
      <label for="mzDeliveryShop">${mzT('店家（可不填）', 'Shop (optional)')}</label><input id="mzDeliveryShop" maxlength="40">
      <label for="mzDeliveryNote">${mzT('附言', 'Note')}</label><input id="mzDeliveryNote" maxlength="300" placeholder="${mzT('例如：吃飽再睡喔', 'e.g. Eat before you sleep')}">
      <button class="pill primary" type="button" data-action="mzDeliveryAdd">${mzT('加入待傳', 'Add to message')}</button>`);
  };
  document.addEventListener('click', (e) => {
    const pick = e.target.closest?.('[data-deliverypick]');
    if (!pick) return;
    const input = document.querySelector('#mzDeliveryFood');
    if (input) input.value = pick.dataset.deliverypick;
  });
  actions.mzDeliveryAdd = () => {
    const title = document.querySelector('#mzDeliveryFood')?.value.trim(), shop = document.querySelector('#mzDeliveryShop')?.value.trim() || '', note = document.querySelector('#mzDeliveryNote')?.value.trim() || '';
    if (!title) { toast(mzT('先填要點的餐點', 'Fill in the food first')); return; }
    cardDrafts[chatId] = { type: 'gift', delivery: true, title, shop, note, status: 'pending' };
    closeModal(); composerMenuOpen = ''; render();
  };
  // Sent with no text, a delivery says what it is (a gift would say "送你一份虛擬禮物").
  const sendBefore = sendMessage;
  sendMessage = function (...args) {
    try { const d = cardDrafts[chatId]; if (isDelivery(d) && !(chatDrafts[chatId] || '').trim()) chatDrafts[chatId] = mzT('幫你點了外送：', 'Ordered you a delivery: ') + d.title + mzT('。', '.'); } catch {}
    return sendBefore.apply(this, args);
  };
}
