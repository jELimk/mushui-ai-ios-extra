'use strict';
// Compose the AI settings menu once, after all its existing controls have been added.
{
  const before = actions.chatOptions;
  actions.chatOptions = function (...args) {
    const result = before.apply(this, args);
    const chat = state.chats.find(item => item.id === chatId);
    const sheet = document.querySelector('#overlay .sheet');
    if (!chat || !sheet) return result;
    const error = sheet.querySelector('#modalError');
    if (!error) return result;
    const find = selector => sheet.querySelector(selector);
    const branch = el => {
      while (el && el.parentElement !== sheet) el = el.parentElement;
      return el;
    };
    const remove = selector => branch(find(selector))?.remove();
    for (const selector of ['[data-generatephoto]', '[data-designai]', '[data-action="formatHelp"]', '[data-toggleaispecial]']) remove(selector);

    const options = document.createElement('div');
    options.className = 'mz-ai-chat-options';
    const row = (action, zh, en) => {
      const button = document.createElement('button');
      button.className = 'setting-choice full';
      button.dataset.action = action;
      button.textContent = mzT(zh,en) + '　›';
      return button;
    };
    function move(selector) {
      const node = find(selector);
      if (node) options.append(node);
    }
    move('[data-action="searchThisChat"]');
    if (chat.members.length === 1) options.append(row('mzHome', '我們的主頁', 'Our page'));
    const call = branch(find('[data-callai]') || find('[data-action="gptLiveMenu"]'));
    if (call) options.append(call);
    options.append(row('mzChatPhotos', '生成照片', 'Generate photos'));
    const character = chat.members.length === 1 && ai(chat.members[0]);
    if (character) {
      const thinking = document.createElement('template');
      thinking.innerHTML = window.mzThinkChatCard?.(character) || '';
      options.append(thinking.content);
    }
    move('[data-action="mzAiStickers"]');
    move('[data-action="chatPermissions"]');
    options.append(row('mzOfflineSetup', '生成離線回覆', 'Prepare offline replies'));
    sheet.querySelector('.sheet-title').after(options);
    window.mzPlaceThinking?.();
    return result;
  };

  const characters = () => state.chats.find(item => item.id === chatId)?.members.map(id => ai(id)).filter(Boolean) || [];
  actions.mzChatPhotos = () => showModal(mzT('生成照片','Generate photos'), characters().map(a => `<section class="card">
    <h3>${esc(a.name)}</h3><div class="mz-photo-choices">
    <button class="pill" data-generatephoto="${esc(a.id)}">${mzT('生成日常照片','Daily photo')}</button>
    <button class="pill" data-designai="${esc(a.id)}" data-kind="avatar">${mzT('更換頭像圖片','New avatar')}</button>
    <button class="pill" data-designai="${esc(a.id)}" data-kind="cover">${mzT('更換朋友圈背景圖片','New Moments cover')}</button>
    </div></section>`).join('') + `<p class="help">${mzT('需設定可生圖的模型，會使用 API 額度。','Requires an image model and uses API credits.')}</p>`);
  const preparing = new Set();
  actions.mzOfflineSetup = () => showModal(mzT('生成離線回覆','Prepare offline replies'),
    `<p class="help">${mzT('連網生成後，這部裝置離線時也能使用。','Generate online to use the replies offline on this device.')}</p>` +
    characters().map(a => `<button class="setting-choice full" data-mzoffline="${esc(a.id)}" ${preparing.has(a.id) ? 'disabled' : ''}><span>${esc(a.name)}</span> <span>${WebEngine.hasOfflineReplies(a.id) ? mzT('重新生成','Regenerate') : mzT('生成','Generate')}</span></button>`).join(''));
  document.addEventListener('click', async e => {
    const button = e.target.closest('[data-mzoffline]');
    const id = button?.dataset.mzoffline;
    const a = id && state.ais.find(item => item.id === id);
    if (!a || preparing.has(id)) return;
    preparing.add(id);
    button.disabled = true;
    const label = button.lastElementChild;
    label.textContent = mzT('正在生成…','Generating…');
    try {
      await WebEngine.prepareOfflineReplies(state.settings, a);
      toast(mzT('離線回覆已儲存','Offline replies saved'));
    } catch (error) {
      if (button.isConnected) modalError(error); else toast(error.message);
    } finally {
      preparing.delete(id);
      button.disabled = false;
      label.textContent = WebEngine.hasOfflineReplies(id) ? mzT('重新生成','Regenerate') : mzT('生成','Generate');
    }
  });
}
