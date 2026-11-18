'use strict';
// 3.4.0: an AI can have 16 stickers of its own. It picks 16 of 48 chibi expressions (the meanings were written by the
// app's owner from three 嗚のQ版表情包 template sheets), by its personality, and each is drawn in its own look.
// They're kept on the AI (so they sync with the account) and it can send them like any sticker, in private chats and groups.
{
  const W = window.WebEngine;
  // [id, meaning (what it says), pose (how it looks)]
  const FACES = [
    ['p1', '哼哼我真厲害／我真聰明／我是天才', 'eyes closed proudly, hand on chin, smug little smile, very pleased with itself'],
    ['p2', '有點無語', 'deadpan half-closed eyes, flat mouth, sweat drop, staring at a phone'],
    ['p3', '被嚇哭了', 'startled, wide teary eyes, trembling, tears streaming, shock marks'],
    ['p4', '做錯事了，搓搓手', 'guilty, rubbing hands together nervously, teary eyes, sweat drop'],
    ['p5', '開心溫暖地喝茶', 'happily sipping a warm cup of tea, eyes closed, steam rising'],
    ['p6', '吐舌頭略略略', 'pulling down one eyelid and sticking tongue out teasingly'],
    ['p7', '被捏臉，有點痛', 'cheek being pinched by a hand, wincing, one tear'],
    ['p8', '生氣', 'angry, furrowed brows, gritted teeth, fist raised'],
    ['p9', '在茶杯裡裝可愛', 'sitting inside a teacup acting cute, one eye winking, small hearts'],
    ['p10', '怎麼可以這樣、不可以這樣（但很可愛）', 'pouting with big round shiny eyes, cheeks puffed, cutely protesting'],
    ['p11', '我就是神、我就是歌神', 'wearing cool pixel sunglasses, holding a microphone, confident'],
    ['p12', '居然是這樣（正經）', 'serious blank stare with wide eyes, small open mouth, realising something'],
    ['p13', '小寶寶吃奶嘴', 'like a baby with a pacifier, eyes closed peacefully'],
    ['p14', '哦～是嗎～？', 'smug half-lidded eyes, doubtful self-satisfied smile, "oh really?"'],
    ['p15', '哭哭', 'crying, teary eyes, hand at mouth'],
    ['p16', '喝酒', 'drinking from a big beer mug, eyes squeezed shut happily'],
    ['b1', '愛心', 'winking and hugging a big heart'],
    ['b2', '生氣指你', 'angry, pointing a finger right at you'],
    ['b3', '載入中', 'frozen blank stare, a loading spinner around its head'],
    ['b4', '嘿嘿開心', 'eyes closed with a big happy grin, sparkle marks'],
    ['b5', '哭哭', 'crying loudly, tears and runny nose'],
    ['b6', '偷看', 'peeking from behind a wall, only half the face showing'],
    ['b7', '滾（比中指）', 'laughing with eyes closed while showing a cartoon middle finger'],
    ['b8', '名偵探推理中', 'detective deduction pose, one sharp eye, finger on chin'],
    ['b9', '哇好喜歡', 'sparkling starry eyes, hands at mouth, amazed and delighted'],
    ['b10', '被摸摸頭很開心', 'a hand patting its head, eyes closed happily, little hearts'],
    ['b11', '睡大覺', 'sleeping soundly under a blanket, "zzz"'],
    ['b12', '哈哈我根本不在乎（比雙中指）', 'smug half-lidded eyes, laughing, showing two cartoon middle fingers'],
    ['b13', '你是想死嗎（拿刀威脅）', 'sweet smile while holding a kitchen knife threateningly (cartoon, playful)'],
    ['b14', '餓了吃飯飯', 'holding a fork and spoon, mouth wide open, hungry'],
    ['b15', '哭哭', 'holding back tears, wobbly mouth, sweat'],
    ['b16', '真的被嚇到了', 'screaming in shock, huge eyes, mouth wide open'],
    ['k1', '像貓咪一樣哈氣', 'hissing like an angry cat, small fangs'],
    ['k2', '對不起我做錯事了', 'apologetic, hands on head, sheepish, sweat drops'],
    ['k3', '好舒服', 'blissful and comfy, eyes closed, wearing a bear-ear hood, bubbles'],
    ['k4', '微笑拿刀看著你', 'smiling sweetly with eyes closed, a knife held beside its face (cartoon)'],
    ['k5', '笑死哈哈', 'laughing hard with squeezed eyes, pointing'],
    ['k6', '吃餅乾開心', 'happily nibbling a cookie, winking'],
    ['k7', '你認真的嗎', 'one big eye and one small eye, flat mouth, "are you serious?"'],
    ['k8', '嫌棄比中指', 'disgusted face, showing a cartoon middle finger'],
    ['k9', '超喜歡', 'blushing, hugging itself, overjoyed'],
    ['k10', '祝你一路順遂、上天保佑', 'angel halo above the head, eyes closed, hands together praying'],
    ['k11', '拜託求求你', 'begging with puppy eyes, peeking over an edge, paws together'],
    ['k12', '生氣', 'angry, anger vein mark, scrunched face'],
    ['k13', '喝茶：喔好、已讀', 'calmly sipping tea, indifferent eyes, "ok, read"'],
    ['k14', '超喜歡好可愛', 'eyes squeezed shut happily, hearts all around'],
    ['k15', '呵呵好喔', 'forced smile, eyes closed, a bead of sweat'],
    ['k16', '我懂你', 'smug knowing look, finger guns'],
  ];
  const BY_ID = Object.fromEntries(FACES.map((f) => [f[0], f]));
  window.mzStickerFaces = FACES;

  const imageSettings = (st) => ({ ...st, provider: st.imageProvider, baseUrl: st.imageBaseUrl, geminiNative: st.imageProvider === 'Gemini' });
  // A sticker is small and keeps its colours: 320 px WebP.
  const shrink = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 320; c.getContext('2d').drawImage(img, 0, 0, 320, 320); resolve(c.toDataURL('image/webp', 0.86)); };
    img.onerror = () => reject(Error(mzT('圖片讀取失敗', "Couldn't read the image")));
    img.src = src;
  });

  // The AI picks its 16 by personality.
  async function choose(a, st) {
    const list = FACES.map(([id, meaning]) => id + '=' + meaning).join('；');
    let ids = [];
    try {
      const raw = await W.complete(st, '你是' + a.name + '。個性：' + a.personality + '\n從下面 48 種表情包裡，挑出最像你、你最常會用的 16 種（依個性，不用平均）。只回 JSON {"ids":["p1",...]}。', [{ role: 'user', content: list }]);
      ids = (W.json(raw).ids || []).map(String).filter((x) => BY_ID[x]);
    } catch {}
    ids = [...new Set(ids)];
    for (const [id] of FACES) { if (ids.length >= 16) break; if (!ids.includes(id)) ids.push(id); }
    return ids.slice(0, 16);
  }

  async function draw(a, st, face) {
    const [, meaning, pose] = face;
    const prompt = 'A cute sticker of this character, shown from the chest up only (head, shoulders and hands; no legs, not a full-body chibi), bold clean black outlines, soft flat colours, plain white background, square, centred, no text, no frame.\n'
      + 'Character (keep every detail of the look): ' + (a.appearance || ('looks like their personality: ' + a.personality)) + '\n'
      + 'Expression and pose: ' + pose + '. Meaning: ' + meaning + '.';
    const s = imageSettings(st), gemini = s.geminiNative;
    const body = gemini ? { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'] } } : { model: st.imageModel, prompt, n: 1, size: '1024x1024', ...(!String(st.imageModel).startsWith('gpt-image') ? { response_format: 'b64_json' } : {}) };
    const raw = await W.proxy(s, gemini ? '/models/' + encodeURIComponent(st.imageModel) + ':generateContent' : '/images/generations', body, true);
    const encoded = gemini ? (raw.candidates || []).flatMap((c) => c.content?.parts || []).map((p) => p.inlineData || p.inline_data).find(Boolean)?.data : raw.data?.[0]?.b64_json;
    if (!encoded) throw Error(mzT('模型沒有傳回圖片', 'The model sent back no image'));
    return shrink('data:image/png;base64,' + encoded);
  }

  const running = new Set();
  // Makes (or remakes) all 16, one at a time; the ones already made stay if a later one fails.
  window.mzMakeAiStickers = async (aiId) => {
    if (running.has(aiId)) return toast(mzT('表情包正在生成中', 'Stickers are already being made'));
    running.add(aiId);
    try {
      await W.ensureAppearance?.(aiId).catch(() => {});
      const s = await W.read(), a = W.find(s.ais, aiId), st = s.settings;
      const ids = await choose(a, st), made = [];
      let failed = 0, lastError = '';
      for (let i = 0; i < ids.length; i++) {
        toast(mzT(`正在生成 ${a.name} 的表情包 ${i + 1}/${ids.length}…`, `Making ${a.name}'s stickers ${i + 1}/${ids.length}…`), 60000);
        try { made.push({ id: ids[i], meaning: BY_ID[ids[i]][1], image: await draw(a, st, BY_ID[ids[i]]) }); }
        catch (e) { failed++; lastError = e.message || String(e); if (failed >= 3 && !made.length) break; }
        // Saved as they come, so a long run never loses what's done.
        if (made.length) await W.edit((x) => { const b = x.ais.find((v) => v.id === aiId); if (b) b.stickers = made.slice(); });
      }
      state = await call('load');
      render();
      if (!made.length) throw Error(lastError || mzT('沒有生成任何表情包', 'No stickers were made'));
      toast(failed ? mzT(`表情包完成 ${made.length} 張，${failed} 張失敗`, `${made.length} stickers made, ${failed} failed`) : mzT(`${a.name} 的 16 張表情包完成了`, `${a.name}'s 16 stickers are ready`), 4000);
    } finally { running.delete(aiId); }
  };

  // The AI's sticker page: from the chat's options.
  actions.mzAiStickers = () => {
    const id = chatId, a = state.ais.find((x) => x.id === id) || (state.chats.find((c) => c.id === id)?.members.length === 1 ? ai(state.chats.find((c) => c.id === id).members[0]) : null);
    if (!a) return;
    const list = a.stickers || [];
    showModal(mzT('AI 的表情包', "AI's stickers"), `<p class="help">${mzT(`${esc(a.name)} 會依個性從 48 種表情裡挑 16 種，畫成自己的樣子。聊天和群組裡它都可以傳，也可以傳你的表情包。生成會使用圖片設定，16 張可能產生費用。`, `${esc(a.name)} picks 16 of 48 expressions by personality and draws them in its own look. It can send them (and yours) in chats and groups. Making them uses your image settings, 16 pictures, which may cost credit.`)}</p>
      ${list.length ? `<div class="mz-ai-sticker-grid">${list.map((x) => `<figure><img src="${esc(x.image)}" alt=""><figcaption class="small">${esc(x.meaning)}</figcaption></figure>`).join('')}</div>` : `<p class="help">${mzT('還沒有表情包。', 'No stickers yet.')}</p>`}
      <div class="sheet-actions">${list.length ? `<button class="pill danger" type="button" data-mzaistickersdel="${esc(a.id)}">${mzT('刪除', 'Delete')}</button>` : ''}<button class="pill primary" type="button" data-mzaistickersmake="${esc(a.id)}">${list.length ? mzT('重新生成', 'Make again') : mzT('生成 16 張表情包', 'Make 16 stickers')}</button></div>`);
  };
  document.addEventListener('click', async (e) => {
    const make = e.target.closest('[data-mzaistickersmake]'), del = e.target.closest('[data-mzaistickersdel]');
    if (make) { closeModal(); window.mzMakeAiStickers(make.dataset.mzaistickersmake).catch((x) => toast(mzT('表情包生成失敗：', "Couldn't make stickers: ") + (x.message || x), 6000)); }
    if (del) { const id = del.dataset.mzaistickersdel; await W.edit((s) => { const a = s.ais.find((v) => v.id === id); if (a) delete a.stickers; }); state = await call('load'); closeModal(); render(); toast(mzT('已刪除 AI 的表情包', "AI's stickers deleted")); }
  });
  // Entry in an AI chat's options.
  const optionsBefore = chatOptions;
  chatOptions = function (...args) {
    const r = optionsBefore.apply(this, args);
    try {
      const sheet = document.querySelector('.sheet');
      const c = state.chats.find((x) => x.id === chatId);
      if (sheet && c?.members.length === 1 && state.ais.some((a) => a.id === c.members[0]) && !sheet.querySelector('[data-action="mzAiStickers"]'))
        sheet.insertAdjacentHTML('beforeend', `<button class="setting-choice" data-action="mzAiStickers">${mzT('AI 的表情包', "AI's stickers")}　›</button>`);
    } catch {}
    return r;
  };
  actions.chatOptions = chatOptions;
  // The page above needs the AI behind this chat.
  const pageFor = actions.mzAiStickers;
  actions.mzAiStickers = () => { const c = state.chats.find((x) => x.id === chatId); if (c?.members.length === 1) { const keep = chatId; chatId = c.members[0]; try { pageFor(); } finally { chatId = keep; } } };

  // New or imported AI: one more choice in the setup window.
  const setupBefore = importSetupModal;
  importSetupModal = function (...args) {
    setupBefore(...args);
    const anchor = document.querySelector('#importGenerateVoice')?.closest('label') || document.querySelector('#importGenerateCover')?.closest('label');
    if (anchor && !document.querySelector('#importGenerateStickers')) anchor.insertAdjacentHTML('afterend', `<label class="flex"><input id="importGenerateStickers" type="checkbox"> ${mzT('依個性生成 AI 自己的表情包（16 張）', 'Make the AI its own stickers from its personality (16)')}</label>`);
  };
  let generating = false;
  const generateBefore = actions.generateImportedAI;
  actions.generateImportedAI = async (...args) => {
    const id = pendingImportedAI, want = !!document.querySelector('#importGenerateStickers')?.checked;
    generating = true;
    let r;
    try { r = await generateBefore(...args); } finally { generating = false; }
    if (want && id) window.mzMakeAiStickers(id).catch((x) => toast(mzT('表情包生成失敗：', "Couldn't make stickers: ") + (x.message || x), 6000));
    return r;
  };
  // Only stickers was ticked: the original skips straight to done, so it's started here too.
  const finishBefore = actions.finishImportedAI;
  actions.finishImportedAI = async (...args) => {
    const id = pendingImportedAI, want = !generating && !!document.querySelector('#importGenerateStickers')?.checked;
    const r = await finishBefore(...args);
    if (want && id) window.mzMakeAiStickers(id).catch((x) => toast(mzT('表情包生成失敗：', "Couldn't make stickers: ") + (x.message || x), 6000));
    return r;
  };
}
