'use strict';
// 3.3.8: AIs can send the built-in stickers too, in one-to-one chats and in groups.
// The model writes [表情包:png-3] where it wants one; that tag is taken out of the text and the sticker is sent with it.
{
  const W = window.WebEngine;
  const TAG = /[\[［【(（]\s*(?:傳了一張|传了一张|發了一張)?\s*(?:表情包|貼圖|贴图|sticker)\s*[:：]?\s*([^\]］】)）\n]{1,60})[\]］】)）]/gi;
  const nameOf = (id) => String(window.StickerMeanings?.[id] || '').split('：')[0];
  // The ID if one is written, otherwise the sticker whose name appears (longest name first, so 動態生氣 beats 生氣).
  const norm = (inside) => {
    const id = /(png|gif)\s*[-_]\s*(\d{1,2})/i.exec(inside);
    if (id) return id[1].toLowerCase() + '-' + id[2];
    const ids = (typeof stickerCatalog !== 'undefined' ? stickerCatalog : []).map((s) => s.id).filter((x) => nameOf(x)).sort((a, b) => nameOf(b).length - nameOf(a).length);
    return ids.find((x) => inside.includes(nameOf(x))) || '';
  };
  const MARK = /\[\[mzsticker:((?:png|gif)-\d{1,2})\]\]/;
  const valid = (id) => { try { return !!W.sticker({ id }); } catch { return false; } };
  const list = () => (typeof stickerCatalog !== 'undefined' ? stickerCatalog : []).map((s) => s.id + '=' + String(window.StickerMeanings?.[s.id] || s.name).split('：')[0]).join('；');

  const systemBefore = W.system;
  // Not during calls: a sticker can't be spoken.
  const inCall = () => !!document.querySelector('.call-overlay, #mzCallBar');
  const KAOMOJI = '\n顏文字：使用者常用顏文字，例如 (｡•ᴗ•｡)、( ੭ ˙ᗜ˙ )੭、(｡>﹏<｡)、ᓚ₍⑅^..^₎♡。這些是用符號拼成的表情，不是亂碼或打錯字。請看出它的情緒（開心、害羞、撒嬌、難過、驚訝…）並自然回應，不要說看不懂；你也可以依個性偶爾用顏文字。';
  W.system = (a) => systemBefore(a) + KAOMOJI + (inCall() ? '' : '\n表情包：跟真人聊天一樣，偶爾在適合的時候傳一個表情包（大約每 4～6 則訊息一次，不要每則都用），只寫 [表情包:ID]，例如 [表情包:png-3]，括號裡不要加名字，一次最多一個；也可以只傳表情包不打字。可用的表情包：' + list() + '。');

  // The tag comes out of the text; the sticker rides on the last message as a marker the save step turns into a real sticker.
  const packetBefore = W.replyPacket;
  // A card written out as text ([純虛擬心意卡片：{"type":"redpacket",...}]) becomes the real card, even when it runs
  // across several messages.
  const CARD = /[\[［【(（]?\s*純虛擬心意卡片\s*[:：]\s*(\{[^{}]*\})\s*[\]］】)）]?/;
  const takeCard = (packet) => {
    const SEP = '\u0001', joined = packet.messages.join(SEP), hit = CARD.exec(joined);
    if (!hit) return;
    let card = null;
    try { card = JSON.parse(hit[1].split(SEP).join('')); } catch {}
    if (card && typeof card === 'object' && !packet.card) {
      if (card.amount != null) card.amount = Number(String(card.amount).replace(/[^0-9.]/g, ''));
      packet.card = card;
    }
    packet.messages = joined.replace(hit[0], '').split(SEP).map((x) => x.trim()).filter(Boolean);
    // A card needs a line to ride on.
    if (!packet.messages.length && packet.card) packet.messages.push('送你的～');
  };
  W.replyPacket = (raw) => {
    const packet = packetBefore(raw);
    takeCard(packet);
    let found = null;
    packet.messages = packet.messages.map((text) => String(text).replace(TAG, (all, inside) => { const id = norm(inside); if (!valid(id)) return all; if (!found) found = id; return ''; }).replace(/[ \t]{2,}/g, ' ').trim());
    const kept = packet.messages.filter(Boolean);
    packet.sticker = found;
    if (found) {
      if (kept.length) kept[kept.length - 1] += '[[mzsticker:' + found + ']]';
      else kept.push('[[mzsticker:' + found + ']]');
    }
    packet.messages = kept;
    if (typeof packet.text === 'string') packet.text = packet.text.replace(TAG, (all, inside) => (valid(norm(inside)) ? '' : all)).trim();
    return packet;
  };

  // One-to-one chats: the marker becomes the message's sticker.
  const appendBefore = W.append;
  W.append = (chat, author, text, extra = {}) => {
    const hit = MARK.exec(String(text ?? ''));
    if (!hit || author === 'me') return appendBefore(chat, author, text, extra);
    const m = appendBefore(chat, author, String(text).replace(MARK, '').trim(), extra);
    if (m) m.sticker = { id: hit[1] };
    return m;
  };

  // For other code (groups): split a reply into its text and sticker.
  window.mzAiSticker = (text) => {
    const s = String(text ?? '');
    let id = null;
    const clean = s.replace(MARK, (_, x) => { id = x; return ''; }).replace(TAG, (all, inside) => { const x = norm(inside); if (!valid(x)) return all; if (!id) id = x; return ''; }).trim();
    return { text: clean, sticker: id };
  };
}
