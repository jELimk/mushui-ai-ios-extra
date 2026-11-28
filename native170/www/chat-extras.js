'use strict';
// Recall a sent message and link chat avatars to the author's Moments.
{
  const group = () => chatId?.startsWith('hgroup:');
  const groupMessage = id => MizukiGroups.data.messages.find(m => String(m.id) === String(id).replace(/^hg-/, '') && m.gid === chatId.slice(7));
  const notice = (name) => mzT(name + ' 已撤回訊息', name + ' recalled a message');
  window.mzRecallNotice = notice;
  const ownMessage = m => !!m && !m.recalled && !m.system &&
    (group() ? m.sender === mizukiMe() && !m.aiAuthor : messageAuthor(m) === 'me');
  window.mzCanRecall = id => ownMessage(group() ? groupMessage(id) : messageById(id));
  const menuBefore = messageActions;
  messageActions = function (id) {
    const m = group() ? groupMessage(id) : messageById(id);
    if (!m || m.recalled) return;
    const own = ownMessage(m);
    if (!group()) menuBefore(id);
    else if (own) showModal(mzT('訊息操作','Message actions'), '');
    if (!own) return;
    const sheet = document.querySelector('#overlay .sheet');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'setting-choice danger';
    button.dataset.action = 'mzRecallMessage';
    button.dataset.recallId = String(m.id);
    button.textContent = mzT('撤回訊息','Recall message');
    sheet?.querySelector('#modalError')?.before(button);
  };
  actions.mzRecallMessage = () => {
    const id = document.querySelector('#overlay .sheet [data-recall-id]')?.dataset.recallId;
    if (!id) return;
    const room = chatId;
    confirmModal(mzT('撤回訊息','Recall message'),mzT('原訊息將從聊天室移除，並留下撤回通知。','The chat will replace the original message with a recall notice.'),async () => {
      if (room.startsWith('hgroup:')) {
        const result = await mizukiApi('/v1/groups/recall', { group:room.slice(7),messageId:id });
        const cached = MizukiGroups.data.messages.find(m => String(m.id) === id && m.gid === room.slice(7));
        if (cached) Object.assign(cached,result.message,{audio:null,files:[],aiAuthor:null});
        await WebEngine.put('hgroups-' + MizukiGroups.owner,MizukiGroups.data);
      } else {
        const result = await call('messageAction',{ id:room,messageId:id,action:'recall' });
        state = result.state;
      }
      if (replyDrafts[room]?.id === id) delete replyDrafts[room];
      if (editDrafts[room] === id) { delete editDrafts[room]; delete chatDrafts[room]; }
      closeModal();
      render();
    });
  };
  const wrapAvatar = (face, id) => {
    if (!face || !id || face.closest('button')) return;
    const button = document.createElement('button');
    button.className = 'mz-chat-avatar';
    button.type = 'button';
    button.dataset.mzChatMoments = id;
    button.setAttribute('aria-label',mzT('查看朋友圈','View Moments'));
    face.replaceWith(button);
    button.append(face);
  };
  const before = render;
  render = function (...args) {
    const result = before.apply(this,args);
    if (!chatId) return result;
    const ch = !isHumanChat() && !group() ? state.chats.find(x => x.id === chatId) : null;
    const human = isHumanChat() ? chatId.slice(6) : '';
    const header = document.querySelector('.conversation > .top');
    const headerAvatar = header?.querySelector(':scope > button.group-header-avatar');
    if (headerAvatar && ch?.members.length === 1) {
      delete headerAvatar.dataset.momentprofile;
      headerAvatar.dataset.mzChatMoments = ch.members[0];
    } else wrapAvatar(header?.querySelector(':scope > .avatar'),human ? 'human:' + human : ch?.members.length === 1 ? ch.members[0] : '');
    const key = group() ? 'hg-' : human ? 'human-' : '';
    const source = group() ? MizukiGroups.data.messages : activeChat()?.messages || [];
    const messages = new Map(source.map(m => [key + m.id,m]));
    window.mzValidatePhotoViewer?.(id => !!messages.get(id)?.recalled);
    for (const row of document.querySelectorAll('.conversation .message[data-message-id]')) {
      const m = messages.get(row.dataset.messageId);
      if (!m) continue;
      if (m.recalled) {
        if (!row.classList.contains('mz-recalled')) {
          row.className = 'mz-recalled';
          row.textContent = notice(m.recallName || messageOwnerName(m));
        }
        continue;
      }
      if (m.system || m.callEvent || m.author === 'system' || row.matches('.call-event,.mz-star-event,.mizuki-system-notice')) {
        row.querySelectorAll(':scope > :is(.avatar,.message-author,.mz-chat-avatar)').forEach(face => face.remove());
        continue;
      }
      const id = group() ? m.aiAuthor?.id || (m.sender === mizukiMe() ? 'me' : 'human:' + m.sender) : messageAuthor(m);
      const existing = row.querySelector(':scope > .message-author[data-momentprofile]');
      if (existing && id) {
        delete existing.dataset.momentprofile;
        existing.dataset.mzChatMoments = id;
        existing.setAttribute('aria-label',mzT('查看朋友圈','View Moments'));
      } else wrapAvatar(row.querySelector(':scope > .avatar'),id);
    }
    return result;
  };
  document.addEventListener('click',e => {
    const button = e.target.closest('[data-mz-chat-moments]');
    if (!button) return;
    const id = button.dataset.mzChatMoments;
    mzOpenMoments(id === 'human:' + MIZUKI_OFFICIAL_ID ? MIZUKI_OFFICIAL_ID : id);
  },true);

}
