'use strict';
// 3.4.0: an AI's Moments background can be changed by you, from a photo or by having the AI make a new one, and its
// avatar and background are generated one at a time, so one failing never stops the other.
{
  const W = window.WebEngine;
  const isAi = (id) => !!id && (state.ais || []).some((a) => a.id === id);

  // Generating a picture needs a one-to-one chat with the AI; a temporary one is made and removed if there was none.
  async function generateFor(aiId, kind) {
    let target = state.chats.find((c) => c.members.length === 1 && c.members[0] === aiId), temporary = '';
    if (!target) { const r = await mutate('newChat', { members: [aiId] }); temporary = r.chatId; }
    try { const r = await call('generate', { id: temporary || target.id, aiId, kind }); state = r.state; }
    finally { if (temporary) await mutate('deleteChat', { id: temporary }).catch(() => {}); }
  }
  window.mzGenerateIdentity = generateFor;

  const coverBefore = actions.cover;
  actions.cover = async (...args) => {
    if (!isAi(momentProfileId)) return coverBefore(...args);
    const a = ai(momentProfileId);
    showModal(mzT('朋友圈背景', 'Moments cover'), `<p class="help">${esc(a.name)}${mzT(' 的朋友圈背景。', "'s Moments cover.")}</p>
      <div class="sheet-actions"><button class="pill" type="button" data-action="mzAiCoverView">${mzT('查看', 'View')}</button><button class="pill" type="button" data-action="mzAiCoverPick">${mzT('選擇照片', 'Choose a photo')}</button><button class="pill primary" type="button" data-action="mzAiCoverMake">${mzT('讓 AI 依個性生成', 'Let the AI make one')}</button></div>
      <p class="small">${mzT('生成會使用圖片生成設定，可能產生費用。', 'Making one uses your image settings and may cost API credit.')}</p>`);
  };
  actions.mzAiCoverView = () => { closeModal(); coverExpanded = true; positionCover(true); };
  actions.mzAiCoverPick = async () => {
    const id = momentProfileId; closeModal();
    const image = await pickImage(); if (!image) return;
    await W.edit((s) => { W.images([image], 1); W.find(s.ais, id).cover = image; });
    state = await call('load'); render();
    toast(mzT('朋友圈背景已更換', 'Moments cover changed'), 1200);
  };
  actions.mzAiCoverMake = async () => {
    const id = momentProfileId; closeModal();
    toast(mzT('正在生成新的朋友圈背景…', 'Making a new Moments cover…'), 4000);
    try { await generateFor(id, 'cover'); render(); toast(mzT('朋友圈背景已生成', 'New Moments cover ready')); }
    catch (e) { toast(mzT('背景生成失敗：', "Couldn't make the cover: ") + (e.message || e), 6000); }
  };
}
