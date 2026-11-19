'use strict';
// 3.4.0 r10: groups look after their members.
// 1. Deleting (or losing) a group no longer wipes what its AIs remember: the group's last lines and its summary are kept
//    on each AI, and come back as that AI's own memories in every chat.
// 2. A group's face follows its members' avatars, and the owner's app tells the server when one of its AIs changes face.
// 3. Any member can upload the group's own picture (people, mixed groups); AI groups already could.
{
  const W = window.WebEngine;
  const KEEP = 8, TEXT = 2000;
  const meName = () => state?.settings?.nickname || humanData?.().me?.name || '我';
  const day = (t) => { try { return new Date(t || Date.now()).toLocaleDateString(); } catch { return ''; } };

  // ---- 1. Memories outlive the group ----
  function keep(s, aiIds, entry) {
    for (const id of aiIds) {
      const a = (s.ais || []).find((x) => x.id === id);
      if (!a) continue;
      const list = (Array.isArray(a.groupArchive) ? a.groupArchive : []).filter((x) => x.id !== entry.id);
      list.push(entry);
      a.groupArchive = list.slice(-KEEP);
    }
  }
  // A local AI group, from inside the store's deleteChat (s is the state being saved).
  W.keepGroupMemory = (s, c) => {
    try {
      const name = (id) => id === 'me' ? meName() : ((s.ais || []).find((x) => x.id === id)?.name || 'AI');
      const lines = (c.messages || []).filter((m) => !m.system && (m.text || m.sticker)).slice(-30).map((m) => `${name(m.author)}：${String(m.text || '［表情包］').slice(0, 160)}`);
      for (const id of c.members) {
        const summary = c.memories?.[id]?.summary || '';
        if (!lines.length && !summary) continue;
        keep(s, [id], { id: 'chat:' + c.id, name: c.title || c.members.map(name).join('、'), time: Date.now(), text: ((summary ? '摘要：' + summary + '\n' : '') + lines.join('\n')).slice(-TEXT) });
      }
    } catch {}
  };

  // People and mixed groups live on the server. Whatever a group looked like the last time it was seen is held here,
  // so when it disappears (deleted by the owner, or left) its AIs keep it.
  const known = new Map();
  let knownOwner = '';
  const groupsData = () => (typeof MizukiGroups !== 'undefined' ? MizukiGroups : window.MizukiGroups);
  function snapshot() {
    const G = groupsData(), data = G?.data;
    if (!data || !humanData?.().connected) return;
    if (knownOwner !== G.owner) { known.clear(); knownOwner = G.owner; }
    const myId = humanData().me?.id, mine = new Set((state?.ais || []).map((a) => a.id));
    for (const g of data.groups || []) {
      const ais = (g.ais || []).map((a) => a.id).filter((id) => mine.has(id));
      if (!ais.length) continue;
      const lines = (data.messages || []).filter((m) => m.gid === g.id && !m.system && (m.text || m.sticker)).slice(-30).map((m) => {
        const who = m.aiAuthor ? m.aiAuthor.name : m.sender === myId ? meName() : ((g.members || []).find((p) => p.id === m.sender)?.name || m.sender);
        return `${who}：${String(m.text || '［表情包］').slice(0, 160)}`;
      });
      if (lines.length) known.set(g.id, { name: g.name, ais, lines });
    }
  }
  async function noticeGone() {
    const G = groupsData();
    if (!G?.data || knownOwner !== G.owner || !humanData?.().connected) return;
    const here = new Set((G.data.groups || []).map((g) => g.id)), gone = [...known].filter(([id]) => !here.has(id));
    if (!gone.length) return;
    for (const [id] of gone) known.delete(id);
    await W.edit((s) => { for (const [id, g] of gone) keep(s, g.ais, { id: 'hgroup:' + id, name: g.name, time: Date.now(), text: g.lines.join('\n').slice(-TEXT) }); });
    state = await call('load');
  }
  if (typeof mizukiGroupsSync === 'function') {
    const syncBefore = mizukiGroupsSync;
    mizukiGroupsSync = async (...args) => {
      snapshot();
      const r = await syncBefore(...args);
      noticeGone().catch(() => {});
      return r;
    };
  }
  // Deleting it yourself removes it from this device without a sync.
  const deleteBefore = actions.mizukiDeleteGroup;
  if (deleteBefore) actions.mizukiDeleteGroup = (...args) => { snapshot(); return deleteBefore(...args); };
  setInterval(() => { snapshot(); noticeGone().catch(() => {}); }, 5000);

  // The AI remembers them in every chat.
  W.groupArchiveText = (a) => {
    const list = (a?.groupArchive || []).slice(-4);
    if (!list.length) return '';
    return '\n【你以前待過、現在已經不在的群組（你自己的記憶）】\n' + list.map((g) => `「${g.name}」（${day(g.time)} 結束）\n${String(g.text).slice(-1200)}`).join('\n') + '\n這些是你記得的事，自然地延續就好；私聊的細節不要在別人面前逐字說出。';
  };
  const systemBefore = W.system;
  W.system = (a) => systemBefore(a) + W.groupArchiveText(a);

  // ---- 2. The owner keeps its AIs' faces current on the server ----
  const SENT = 'mzGroupAiFaces';
  const sig = (v) => typeof v === 'string' ? v.length + ':' + v.slice(-48) : '';
  let facing = false;
  async function syncAiFaces() {
    const G = groupsData();
    if (facing || !G?.data || !humanData?.().connected) return;
    facing = true;
    try {
      let sent = {};
      try { sent = JSON.parse(localStorage.getItem(SENT) || '{}') || {}; } catch {}
      const me = String(mizukiMe()).toLowerCase();
      let changed = false;
      for (const g of G.data.groups || []) {
        if (String(g.owner).toLowerCase() !== me) continue;
        for (const entry of g.ais || []) {
          const local = (state?.ais || []).find((x) => x.id === entry.id), key = g.id + ':' + entry.id;
          if (!local?.avatar || !String(local.avatar).startsWith('data:image/')) continue;
          const now = sig(local.avatar);
          if (sent[key] === now) continue;
          if (sent[key] === undefined && entry.avatar) { sent[key] = now; continue; } // first look: trust what is there
          const thumb = local.avatar.length <= 60000 ? local.avatar : await window.mizukiAiThumb(local.avatar);
          if (!thumb) continue;
          await mizukiApi('/v1/groups/aiavatar', { group: g.id, ai: entry.id, avatar: thumb });
          sent[key] = now;
          changed = true;
        }
      }
      try { localStorage.setItem(SENT, JSON.stringify(sent)); } catch {}
      if (changed) await mizukiGroupsSync().catch(() => {});
    } catch {} finally { facing = false; }
  }
  setInterval(() => syncAiFaces(), 20000);

  // ---- 3. The group's own picture ----
  async function shrink(src, side = 256) {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
    const w = img.naturalWidth || side, h = img.naturalHeight || side, cut = Math.min(w, h);
    const cv = document.createElement('canvas'); cv.width = cv.height = side;
    cv.getContext('2d').drawImage(img, (w - cut) / 2, (h - cut) / 2, cut, cut, 0, 0, side, side);
    const webp = cv.toDataURL('image/webp', 0.86);
    return webp.startsWith('data:image/webp') ? webp : cv.toDataURL('image/jpeg', 0.86);
  }
  const groupHere = () => groupsData()?.data?.groups?.find((x) => 'hgroup:' + x.id === chatId);
  const optionsBefore = actions.mizukiGroupOptions;
  if (optionsBefore) actions.mizukiGroupOptions = (...args) => {
    const r = optionsBefore(...args);
    try {
      const g = groupHere(), sheet = document.querySelector('#overlay .sheet, #overlay');
      const anchor = sheet?.querySelector('.card');
      if (g && anchor && !sheet.querySelector('[data-mzgroupface]')) anchor.insertAdjacentHTML('beforebegin', `<div class="card" data-mzgroupface><h3>${mzT('群組頭像', 'Group picture')}</h3><div class="group-avatar-preview">${mizukiGroupFace(g).replace('class="avatar ', 'class="avatar large ')}</div><p class="help">${mzT('預設顯示成員頭像拼圖，最多 9 位；成員換頭像時會一起換。也可以上傳自己的圖片，所有成員都會看到。', "By default it shows up to 9 members' faces, and changes when they change theirs. You can also upload a picture; every member sees it.")}</p><div class="sheet-actions"><button class="pill primary" data-action="mzGroupFaceUpload">${mzT('上傳群組頭像', 'Upload picture')}</button>${g.avatar ? `<button class="pill" data-action="mzGroupFaceReset">${mzT('恢復成員拼圖', 'Back to member faces')}</button>` : ''}</div></div>`);
    } catch {}
    return r;
  };
  async function setFace(image) {
    const g = groupHere();
    if (!g) return;
    try { await mizukiApi('/v1/groups/avatar', { group: g.id, avatar: image }); }
    catch (e) { throw Error(/不支援|找不到此功能|404|not found/i.test(e.message || '') ? mzT('伺服器還是舊版，請先上傳新的伺服器', 'The server is out of date. Upload the new server first.') : (e.message || String(e))); }
    await mizukiGroupsSync().catch(() => {});
    render();
    actions.mizukiGroupOptions();
  }
  actions.mzGroupFaceUpload = async () => {
    const image = await (window.mzPickAvatar || pickImage)();
    if (!image) return;
    await setFace(await shrink(image));
    toast(mzT('群組頭像已更新', 'Group picture updated'), 1400);
  };
  actions.mzGroupFaceReset = async () => {
    await setFace('');
    toast(mzT('已恢復成員頭像拼圖', 'Back to member faces'), 1400);
  };
}
