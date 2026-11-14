'use strict';
// 3.4.0: an AI's look can come from a picture you upload. The picture is read once by the model that sees images and
// written down as the AI's fixed appearance (hair, eyes, build, clothes…), so every photo, avatar, background and
// sticker it makes follows that look. The picture itself is kept beside it.
{
  const W = window.WebEngine;
  const ASK = '這張圖是一個角色的外觀參考。請只描述這個角色的外貌，讓之後生成的圖片保持一樣：性別感、年齡感、髮型與髮色、臉型、眼睛（顏色與形狀）、膚色、身形、配件、常穿的衣著與顏色、整體畫風（真人照片或插畫）。用繁體中文條列，不超過 400 字，不要描述背景，不要猜看不到的地方。';

  async function useLook(id) {
    const image = await pickImage(1024);
    if (!image) return;
    toast(mzT('正在讀取圖片裡的外觀…', 'Reading the look from the picture…'), 20000);
    const s = await W.read();
    const text = String(await W.see(s.settings, [image], ASK) || '').trim();
    if (!text || /看不清楚|看不到|無法辨識/.test(text) && text.length < 40) throw Error(mzT('讀不出這張圖的外觀，換一張清楚一點的', "Couldn't read a look from this picture. Try a clearer one."));
    await W.edit((x) => { const a = W.find(x.ais, id); a.appearance = W.clean(text, 5000); a.appearanceLocked = true; a.appearanceImage = image; });
    state = await call('load');
    memoryModal(id);
    toast(mzT('外觀已依圖片設定', 'Look set from the picture'));
  }

  // In the AI's memory window, under the fixed appearance.
  const memoryBefore = memoryModal;
  memoryModal = function (id) {
    memoryBefore(id);
    try {
      const a = ai(id), box = document.querySelector('#fixedAppearance')?.closest('.card');
      if (!box || box.querySelector('[data-mzlookupload]')) return;
      box.insertAdjacentHTML('beforeend', `${a.appearanceImage ? `<img class="mz-look-image" src="${esc(a.appearanceImage)}" alt="">` : ''}<button class="pill" type="button" data-mzlookupload="${esc(id)}">${a.appearance ? mzT('用圖片換成自訂外觀', 'Use a picture for a custom look') : mzT('上傳圖片設定外觀', 'Upload a picture for the look')}</button><p class="small">${mzT('上傳一張角色圖片，AI 會照著圖片的樣子設定外觀，之後的照片、頭像、背景和表情包都會跟著這個樣子。', "Upload a picture of the character; its look is set from it, and later photos, avatars, covers and stickers follow it.")}</p>`);
    } catch {}
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mzlookupload]');
    if (!b) return;
    const id = b.dataset.mzlookupload, a = ai(id);
    const go = () => useLook(id).catch((x) => toast(x.message || String(x), 6000));
    if (a?.appearance) confirmModal(mzT('換成自訂外觀', 'Custom look'), mzT('會用圖片的樣子取代目前鎖定的外貌，確定嗎？', 'This replaces the locked appearance with the look from the picture. Continue?'), go);
    else go();
  });
}
