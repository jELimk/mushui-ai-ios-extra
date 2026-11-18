'use strict';
// 3.3.2: AIs notice what the user does. Posting, setting a status or playing a song can prompt a message from an AI
// whose personality fits, without continuous companionship being on. Each AI decides for itself and may stay quiet.
{
  const W = WebEngine, COOLDOWN = 15 * 60000, MOST = 3;
  const last = new Map();
  const words = { moment: '使用者剛發了朋友圈：', status: '使用者剛把狀態改成：', listen: '使用者剛開始聽：' };
  const lastTime = (s, a) => s.chats.find((c) => c.members.length === 1 && c.members[0] === a.id)?.messages.at(-1)?.time || 0;

  async function react(kind, text, skip = []) {
    const s = await W.read();
    if (s.settings.aiEventMessages === false || !String(text || '').trim()) return;
    const hidden = (a) => kind !== 'moment' && s.settings.personVisibility?.['ai:' + a.id]?.hideStatus;
    const ready = s.ais.filter((a) => !hidden(a) && !skip.includes(a.id) && Date.now() - (last.get(a.id) || 0) >= COOLDOWN).sort((x, y) => lastTime(s, y) - lastTime(s, x)).slice(0, MOST);
    for (const a of ready) {
      const chat = s.chats.find((c) => c.members.length === 1 && c.members[0] === a.id);
      if (chat && W.active?.has(chat.id)) continue;
      last.set(a.id, Date.now());
      try {
        const raw = await W.complete(s.settings, W.system(a) + '\n依你的個性和你們的關係，決定要不要因為這件事主動傳一則訊息。不是每次都要傳；不符合你的個性就不傳。只回 JSON {send:true或false,text:訊息內容}。', [...W.textOnly(W.context(s, a, chat || { messages: [] })), { role: 'user', content: '［系統資訊，不是使用者說的話：' + words[kind] + String(text).slice(0, 500) + '］' }]);
        const choice = W.json(raw), message = String(choice.text || '').trim();
        if (choice.send !== true || !message || W.harmfulReply?.(message)) continue;
        let id = '';
        await W.edit((x) => { const c = W.dm(x, a.id); id = c.id; W.append(c, a.id, W.clean(message, 5000)); if (chatId !== c.id) c.unread = (c.unread || 0) + 1; });
        window.mushui171Sound?.('notice');
        window.mushuiMobileNotice?.({ title: a.name, body: message, tag: 'ai-event-' + Date.now() });
        state = await call('load');
        if (chatId === id || !chatId) render();
      } catch {}
    }
  }
  window.mzAiEvent = (kind, text, skip) => { react(kind, text, skip).catch(() => {}); };

  const mutateBase = W.mutate;
  W.mutate = async (d) => {
    const before = d.action === 'settings' ? (await W.read()).settings.myStatus?.text : '';
    const result = await mutateBase(d);
    if (d.action === 'post' && !d.visibleTo?.length) window.mzAiEvent('moment', d.text || '（發了照片）');
    if (d.action === 'post' && d.visibleTo?.length) window.mzAiEvent('moment', d.text || '（發了照片）', (await W.read()).ais.filter((a) => !d.visibleTo.includes(a.id)).map((a) => a.id));
    const status = d.action === 'settings' ? d.settings?.myStatus?.text : '';
    if (status && status !== before) window.mzAiEvent('status', status);
    return result;
  };
}
