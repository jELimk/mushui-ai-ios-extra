'use strict';
// 3.4.0: pick several photos at once (up to 9 per chat message or Moments post) instead of one at a time.
// The system picker opens with multi-select; each photo is shrunk the same way a single one was.
{
  const pickFiles = (accept) => new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept; input.multiple = true; input.hidden = true;
    document.body.append(input);
    let done = false;
    const finish = (files) => { if (done) return; done = true; input.remove(); resolve(files); };
    input.oncancel = () => finish([]);
    input.onchange = () => finish([...(input.files || [])]);
    input.click();
  });
  const readImage = async (file, max) => {
    if (file.size > 30 * 1024 * 1024) throw Error(mzT('圖片太大', 'Image too large'));
    const url = URL.createObjectURL(file);
    try { return await WebEngine.normalize(url, max); } finally { URL.revokeObjectURL(url); }
  };
  const tooMany = (n) => toast(mzT(`最多 ${n} 張，多的沒有加入`, `Up to ${n} photos; the rest were left out`));
  window.mzPickImages = async (room, max, moments = false) => {
    if (room <= 0) return [];
    const files = (await pickFiles('image/*')).filter((f) => !f.type || f.type.startsWith('image/'));
    if (files.length > room) tooMany(max);
    const out = [];
    for (const f of files.slice(0, room)) { try { out.push(await readImage(f, moments ? 2048 : undefined)); } catch (e) { toast(e.message); } }
    return out;
  };

  // Chat: the photo button and the photo choice in the camera sheet.
  const chatPhotos = async () => {
    const id = chatId, have = (photoDrafts[id] || []).length;
    if (have >= 9) { toast(mzT('一次最多 9 張照片', 'Up to 9 photos at a time')); return; }
    const imgs = await window.mzPickImages(9 - have, 9);
    if (!imgs.length) return;
    (photoDrafts[id] ??= []).push(...imgs);
    if (chatId === id) render();
  };
  actions.chatPhoto = chatPhotos;
  actions.chooseChatImage = async () => { closeModal(); await chatPhotos(); };

  // Chat → 上傳 → 圖片・影片: several photos and videos together.
  actions.uploadChatMedia = async () => {
    closeModal();
    const target = chatId, files = await pickFiles('image/*,video/*');
    if (!files.length) return;
    let skipped = false;
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        if ((photoDrafts[target] || []).length >= 9) { skipped = true; continue; }
        try { (photoDrafts[target] ??= []).push(await readImage(file)); } catch (e) { toast(e.message); }
      } else {
        try { await addChatAttachment(file); } catch (e) { toast(e.message); }
      }
    }
    if (skipped) tooMany(9);
    if (chatId === target) render();
  };

  // Moments: the ＋ in the new-post window.
  actions.postImage = async () => {
    if (typeof posting === 'undefined') return;
    const imgs = await window.mzPickImages(9 - posting.images.length, 9, true);
    if (!imgs.length) return;
    posting.images.push(...imgs);
    const box = document.querySelector('#draftPhotos');
    if (box && typeof draftPhotos === 'function') box.innerHTML = draftPhotos();
  };
}
