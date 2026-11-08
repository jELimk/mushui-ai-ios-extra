'use strict';
// 3.3.8: AIs can send the built-in stickers too, in one-to-one chats and in groups.
// The model writes [表情包:png-3] where it wants one; that tag is taken out of the text and the sticker is sent with it.
{
  const W = window.WebEngine;
  const TAG = /[\[［【]\s*(?:表情包|貼圖|sticker)\s*[:：]?\s*((?:png|gif)\s*[-_]\s*\d{1,2})[^\]］】\n]{0,40}[\]］】]/gi;
  const norm = (id) => id.toLowerCase().replace(/\s+/g, '').replace('_', '-');
  const MARK = /\[\[mzsticker:((?:png|gif)-\d{1,2})\]\]/;
  const valid = (id) => { try { return !!W.sticker({ id }); } catch { return false; } };
  const list = () => (typeof stickerCatalog !== 'undefined' ? stickerCatalog : []).map((s) => s.id + '=' + String(window.StickerMeanings?.[s.id] || s.name).split('：')[0]).join('；');

  const systemBefore = W.system;
  // Not during calls: a sticker can't be spoken.
  const inCall = () => !!document.querySelector('.call-overlay, #mzCallBar');
  W.system = (a) => systemBefore(a) + (inCall() ? '' : '\n表情包：跟真人聊天一樣，偶爾在適合的時候傳一個表情包（大約每 4～6 則訊息一次，不要每則都用），只寫 [表情包:ID]，例如 [表情包:png-3]，括號裡不要加名字，一次最多一個；也可以只傳表情包不打字。可用的表情包：' + list() + '。');

  // The tag comes out of the text; the sticker rides on the last message as a marker the save step turns into a real sticker.
  const packetBefore = W.replyPacket;
  W.replyPacket = (raw) => {
    const packet = packetBefore(raw);
    let found = null;
    packet.messages = packet.messages.map((text) => String(text).replace(TAG, (_, id) => { if (!found && valid(norm(id))) found = norm(id); return ''; }).replace(/[ \t]{2,}/g, ' ').trim());
    const kept = packet.messages.filter(Boolean);
    packet.sticker = found;
    if (found) {
      if (kept.length) kept[kept.length - 1] += '[[mzsticker:' + found + ']]';
      else kept.push('[[mzsticker:' + found + ']]');
    }
    packet.messages = kept;
    if (typeof packet.text === 'string') packet.text = packet.text.replace(TAG, '').trim();
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
    const clean = s.replace(MARK, (_, x) => { id = x; return ''; }).replace(TAG, (_, x) => { if (!id && valid(norm(x))) id = norm(x); return ''; }).trim();
    return { text: clean, sticker: id };
  };
}
