"use strict";
// Mizuki 2.1.6–2.1.7 — speed and battery, instant sending, live message wake-ups, appearance switch,
// call video quality, live-share black screen, official account bio, 2.1.6 release post.
// Loaded last. Each section wraps only globals that earlier files define.

/* ------------------------------------------------------------------ */
/* 1. State cache                                                       */
/*    Every read used to fetch and deserialize the whole state (images  */
/*    included) from IndexedDB — on iPhone across the native bridge.    */
/*    Reads now come from memory; other windows invalidate the copy.    */
/* ------------------------------------------------------------------ */
{
  const W = WebEngine,
    get = W.get,
    put = W.put,
    channel = "BroadcastChannel" in window ? new BroadcastChannel("mizuki-state") : null;
  let cache = null;
  if (channel) channel.onmessage = () => (cache = null);
  W.get = async (key) => {
    if (key !== "state") return get(key);
    if (cache) return cache;
    const value = await get(key);
    if (value) cache = value;
    return value;
  };
  W.put = async (key, value) => {
    await put(key, value);
    if (key !== "state") return;
    cache = value || null;
    channel?.postMessage(1);
  };
  W.cachedSettings = () => cache?.settings || null;
}

/* ------------------------------------------------------------------ */
/* 2. Cheaper change detection                                          */
/*    The 2-second refresh compared JSON of every chat including base64 */
/*    images; long strings are now compared by length and tail only.   */
/* ------------------------------------------------------------------ */
refreshSignature = function (value) {
  return JSON.stringify(value, (k, v) => {
    if (typeof v === "string") return v.length > 512 ? v.length + ":" + v.slice(-24) : v;
    if (k === "presence" && v) return { ...v, time: undefined };
    if (k === "human" && v) return { ...v, lastSync: undefined };
    return v;
  });
};

/* ------------------------------------------------------------------ */
/* 3. Avatars as cached blob URLs                                        */
/*    A chat repeated the full base64 avatar in every message row, so  */
/*    each render rebuilt megabytes of HTML.                            */
/* ------------------------------------------------------------------ */
{
  const urls = new Map(),
    TINY = "data:image/png;base64,AA==",
    LIMIT = 120;
  const blobUrl = (data) => {
    let url = urls.get(data);
    if (url) return url;
    const comma = data.indexOf(","),
      bin = atob(data.slice(comma + 1)),
      bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    url = URL.createObjectURL(new Blob([bytes], { type: data.slice(5, data.indexOf(";")) }));
    if (urls.size >= LIMIT) {
      const [oldKey, oldUrl] = urls.entries().next().value;
      urls.delete(oldKey);
      setTimeout(() => URL.revokeObjectURL(oldUrl), 60000);
    }
    urls.set(data, url);
    return url;
  };
  const base = avatar;
  avatar = function (p, extra = "") {
    const src = p?.avatar;
    if (typeof src !== "string" || src.length < 4096 || !/^data:image\/(jpeg|png|webp);base64,/.test(src)) return base(p, extra);
    let url;
    try {
      url = blobUrl(src);
    } catch {
      return base(p, extra);
    }
    return base({ ...p, avatar: TINY }, extra).replace(`src="${TINY}"`, `src="${url}"`);
  };
}

/* ------------------------------------------------------------------ */
/* 4. Instant sending                                                    */
/*    The sent message is shown at once and stays visible while the    */
/*    request runs, even if a background refresh replaces `state`.     */
/*    It disappears when the real message arrives or the send fails.   */
/* ------------------------------------------------------------------ */
const mzPending = new Map();
function mzPendingMessage(op, d) {
  const shared = { text: d.text || "", images: d.images || [], sticker: d.sticker || null, virtualCard: d.virtualCard || null, replyTo: d.replyTo || null, time: Date.now(), pending: true, id: "pending-" + d.clientMessageId };
  if (op === "send") return { op, chat: d.id, message: { ...shared, author: "me", clientMessageId: d.clientMessageId } };
  if (op === "human" && d.action === "send" && state?.human?.me?.id) return { op, chat: d.id, message: { ...shared, sender: state.human.me.id, recipient: d.id, client: d.clientMessageId, readAt: null } };
  return null;
}
// Puts pending copies into the current state; drops the ones whose real message is already there.
function mzApplyPending() {
  if (!state || !mzPending.size) return;
  for (const [token, p] of mzPending) {
    const list = p.op === "send" ? state.chats.find((c) => c.id === p.chat)?.messages : state.human?.messages;
    if (!list) continue;
    const real = list.some((m) => !m.pending && (p.op === "send" ? m.clientMessageId === token : m.client === token));
    if (real || Date.now() - p.message.time > 120000) mzPending.delete(token);
    else if (!list.some((m) => m.id === p.message.id)) list.push(p.message);
  }
}
{
  const base = call;
  call = function (op, data = {}) {
    const p = !data.retry && data.clientMessageId && !mzPending.has(data.clientMessageId) ? mzPendingMessage(op, data) : null;
    if (!p) return base(op, data);
    mzPending.set(data.clientMessageId, p);
    mzApplyPending();
    setTimeout(() => !modal && render(), 0);
    const result = base(op, data);
    result.catch(() => {
      mzPending.delete(data.clientMessageId);
      const list = op === "send" ? state?.chats.find((c) => c.id === p.chat)?.messages : state?.human?.messages,
        at = list?.findIndex((m) => m.id === p.message.id);
      if (at >= 0) list.splice(at, 1);
      setTimeout(() => !modal && render(), 0);
    });
    return result;
  };
  const renderBase = render;
  render = function () {
    mzApplyPending();
    renderBase();
  };
}

/* ------------------------------------------------------------------ */
/* 5. Live wake-ups                                                      */
/*    One held request per device (/v1/wait) returns as soon as a      */
/*    message arrives, instead of asking the server every 1.5 seconds. */
/* ------------------------------------------------------------------ */
{
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let running = false;
  async function mzWaitLoop() {
    if (running) return;
    running = true;
    try {
      for (;;) {
        if (!state?.human?.connected || window.DesktopDetached || (document.hidden && !window.MushuiDesktop)) {
          await sleep(2000);
          continue;
        }
        let r;
        try {
          r = await WebEngine.humanRequest("/v1/wait?since=" + (Number(state.human.cursor) || 0));
          window.MizukiLiveWait = true;
        } catch (e) {
          window.MizukiLiveWait = false;
          // Older servers have no /v1/wait: keep the previous polling.
          if (e.status === 404 || /HTTP 404|找不到此功能/.test(e.message)) return;
          await sleep(4000);
          continue;
        }
        if (r?.changed) {
          const before = Number(state.human.cursor) || 0;
          await WebEngine.humanSync().catch(() => {});
          if (typeof refreshCrossDevice === "function") await refreshCrossDevice();
          // Never spin: if the sync brought nothing new, pause before waiting again.
          if ((Number(state.human.cursor) || 0) === before) await sleep(1500);
        }
      }
    } finally {
      running = false;
    }
  }
  setTimeout(mzWaitLoop, 1500);
  document.addEventListener("visibilitychange", () => !document.hidden && mzWaitLoop());
}

/* ------------------------------------------------------------------ */
/* 6. 記憶 → 永遠保留的外貌 switch                                       */
/* ------------------------------------------------------------------ */
{
  const W = WebEngine,
    system = W.system;
  W.system = (a) => {
    if (W.cachedSettings()?.keepAppearance !== false) return system(a);
    return system({ ...a, appearance: "", appearanceLocked: false }).replace(/\n角色外觀（[^）]*）：尚未建立/, "");
  };
}

/* ------------------------------------------------------------------ */
/* 7. Calls: sharper, smoother video                                    */
/*    Senders start near 300 kbps by default; raise the ceiling and    */
/*    keep the frame rate for camera and screen.                        */
/* ------------------------------------------------------------------ */
async function mzTuneVideoSender(sender, track) {
  const screen = VoiceUI.rtc?.screen?.sender === sender;
  try {
    track.contentHint = screen ? "detail" : "motion";
  } catch {}
  const params = sender.getParameters();
  if (!params.encodings?.length) return;
  for (const e of params.encodings) {
    e.maxBitrate = screen ? 4000000 : 2500000;
    e.maxFramerate = screen ? 24 : 30;
    e.scaleResolutionDownBy = 1;
  }
  params.degradationPreference = "balanced";
  await sender.setParameters(params);
}
if (window.RTCRtpSender?.prototype?.replaceTrack) {
  const replaceTrack = RTCRtpSender.prototype.replaceTrack;
  RTCRtpSender.prototype.replaceTrack = async function (track) {
    const result = await replaceTrack.call(this, track);
    if (track?.kind === "video") mzTuneVideoSender(this, track).catch(() => {});
    return result;
  };
}

/* ------------------------------------------------------------------ */
/* 8. Calls: never leave a black screen                                 */
/*    A video tile whose stream stops delivering frames (for example   */
/*    after a live share ends) is hidden, and the call background and  */
/*    caller card come back.                                            */
/* ------------------------------------------------------------------ */
setInterval(() => {
  const el = typeof callOverlay !== "undefined" ? callOverlay : null;
  if (!el?.classList?.contains("mz-call")) return;
  const now = Date.now();
  let showing = 0;
  for (const id of ["remoteCamera", "remoteScreen", "localCamera"]) {
    const v = document.getElementById(id),
      fig = v?.closest("figure");
    if (!fig) continue;
    const track = v.srcObject?.getVideoTracks?.()[0],
      frames = v.getVideoPlaybackQuality?.().totalVideoFrames ?? v.webkitDecodedFrameCount ?? 0;
    if (String(frames) !== v.dataset.mzFrames) {
      v.dataset.mzFrames = String(frames);
      v.dataset.mzAt = String(now);
    }
    const stale = !track || track.readyState !== "live" || v.videoWidth < 2 || now - Number(v.dataset.mzAt || 0) > 2500;
    fig.classList.toggle("mz-stale", stale);
    if (!fig.hidden && !stale) showing++;
  }
  el.classList.toggle("mz-novideo", el.classList.contains("mz-video") && !showing);
}, 700);

/* ------------------------------------------------------------------ */
/* 9. Release post (official Moments): only the latest version's post  */
/* ------------------------------------------------------------------ */
const MZ_KAOMOJI_RAW = "٩(ˊᗜˋ*)و",
  MZ_KAOMOJI_FIXED = "٩‎(ˊᗜˋ*)‎و";
const MZ_RELEASE_EN_LATEST = `Mizuki 2.1.7 is here! ( ੭ ˙ᗜ˙ )੭
This update tidies up where settings live and fixes Stars, background notifications and more.

- English: Many places that still showed Chinese are now translated.
- Settings: Photos & image generation moved to Model & API, Account sync to Backup & restore, Chats into Notifications, and Call background to Appearance.
- AI chats: When an AI has several things to say, they arrive one by one, a second apart.
- Removed roles: They now show the name they had, and can be deleted one by one or all at once.
- Character profile: Tidied up the buttons at the bottom.
- Stars: Fixed Stars not being notified when you open the app or start charging.
- Background notifications: Fixed Android not receiving messages after the app is closed.
- Account: Email binding was removed; changing your password now asks for your current password.
- Importing an AI: Choose to generate a poke line, profile photo, Moments cover and voice — all applied automatically.

If anything still feels off, come and tell Mizuki — I'm always here! (｡•ᴗ•｡)`;
{
  const version = "2.1.7",
    id = "official-release-" + version;
  let busy = false;
  const english = () => {
    const choice = state?.settings?.uiLanguage || "system";
    return choice === "en" || (choice === "system" && /^en(?:-|$)/i.test(navigator.language || ""));
  };
  const ensure = async () => {
    if (busy || !state?.moments || typeof officialReleaseText !== "string") return;
    // The latest release post is the official account's only post: older release posts are removed.
    const older = (p) => p.id !== id && (p.id?.startsWith("official-release-") || p.release);
    if (state.moments.some((p) => p.id === id) && !state.moments.some(older)) return;
    busy = true;
    try {
      if (state.moments.some(older)) await WebEngine.edit((s) => (s.moments = s.moments.filter((p) => !older(p))));
      if (!state.moments.some((p) => p.id === id)) await mutate("officialReleasePost", { version, text: officialReleaseText });
      else state = await call("load");
      try {
        localStorage.setItem("mushui-official-moment-version", version);
      } catch {}
      render();
    } catch (e) {
      console.warn("official release post", e);
    } finally {
      busy = false;
    }
  };
  setTimeout(ensure, 4000);
  setInterval(ensure, 60000);
  const base = render;
  render = function () {
    if (state?.moments)
      for (const p of state.moments) {
        if (p.id === id) p.text = english() ? MZ_RELEASE_EN_LATEST : officialReleaseText;
        // Older official posts stored the kaomoji without bidi marks; show them aligned.
        else if (p.id?.startsWith("official-release-") && p.text?.includes(MZ_KAOMOJI_RAW)) p.text = p.text.split(MZ_KAOMOJI_RAW).join(MZ_KAOMOJI_FIXED);
      }
    base();
  };
}

/* ------------------------------------------------------------------ */
/* 10. 設定 → 通知 → 聊天 → 封鎖・隱藏・已刪除: removed roles             */
/*     Lists roles that were deleted but still have messages, posts or  */
/*     comments, by the name they had. Delete one, or all at once.      */
/* ------------------------------------------------------------------ */
const MZ_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function mzRemovedRoles() {
  const live = new Set(state.ais.map((a) => a.id)),
    ids = new Set(Object.keys(state.removedAIs || {})),
    add = (id) => MZ_UUID.test(String(id || "")) && !live.has(id) && ids.add(id);
  for (const c of state.chats) for (const m of c.messages) add(m.author);
  for (const p of state.moments) {
    add(p.author);
    for (const x of p.comments || []) add(x.author);
  }
  return [...ids].filter((id) => !live.has(id));
}
async function mzForgetRoles(ids) {
  const gone = new Set(ids);
  await WebEngine.edit((s) => {
    for (const c of s.chats) c.messages = c.messages.filter((m) => !gone.has(m.author));
    s.moments = s.moments.filter((p) => !gone.has(p.author));
    for (const p of s.moments) {
      p.comments = (p.comments || []).filter((x) => !gone.has(x.author));
      p.likes = (p.likes || []).filter((id) => !gone.has(id));
    }
    const removed = { ...(s.removedAIs || {}) };
    for (const id of gone) delete removed[id];
    s.removedAIs = removed;
  });
  state = await call("load");
  render();
}
{
  const base = mzChatCenterPage;
  mzChatCenterPage = function () {
    const roles = mzRemovedRoles();
    return (
      base() +
      `<div class="card"><h3>${mzT("已移除的角色", "Removed roles")}</h3>${
        roles.length
          ? `<p class="help">${mzT("刪除後，這些角色留下的聊天訊息、朋友圈與留言都會一併刪除。", "Deleting removes the messages, posts and comments these roles left behind.")}</p><div class="mz-chat-list">${roles
              .map((id) => `<div class="mz-chat-line"><span><b>${esc(ai(id).name)}</b></span><button class="pill" data-mz-forget-role="${esc(id)}">${mzT("刪除", "Delete")}</button></div>`)
              .join("")}</div><button class="pill full" data-action="mzForgetAllRoles">${mzT("全部刪除", "Delete all")}</button>`
          : `<p class="help">${mzT("沒有已移除的角色。", "No removed roles.")}</p>`
      }</div>`
    );
  };
}
actions.mzForgetAllRoles = () => confirmModal(mzT("刪除全部已移除的角色", "Delete all removed roles"), mzT("這些角色留下的聊天訊息、朋友圈與留言都會刪除，無法復原。", "Their messages, posts and comments will be deleted. This cannot be undone."), async () => {
  closeModal();
  await mzForgetRoles(mzRemovedRoles());
});
document.addEventListener("click", (e) => {
  const id = e.target.closest("[data-mz-forget-role]")?.dataset.mzForgetRole;
  if (!id) return;
  confirmModal(mzT("刪除「" + ai(id).name + "」", "Delete “" + ai(id).name + "”"), mzT("這個角色留下的聊天訊息、朋友圈與留言都會刪除，無法復原。", "Its messages, posts and comments will be deleted. This cannot be undone."), async () => {
    closeModal();
    await mzForgetRoles([id]);
  });
});

/* ------------------------------------------------------------------ */
/* 11. Role profile sheet: one tidy block under 聊天／儲存角色           */
/*     Three layers each added a button (two of them 朋友圈), so the    */
/*     bottom of the sheet was out of line. Order: 朋友圈, 生日, 刪除.   */
/* ------------------------------------------------------------------ */
{
  const base = contactModal;
  contactModal = function (id) {
    base(id);
    const sheet = document.querySelector(".sheet"),
      row = sheet?.querySelector(".sheet-actions");
    if (!row || sheet.querySelector(".mz-contact-more")) return;
    const moments = sheet.querySelector(`[data-momentprofile]`),
      birthday = sheet.querySelector("[data-birthday]"),
      remove = sheet.querySelector("[data-deleteai]");
    row.querySelector("[data-mzmoments]")?.remove();
    const more = document.createElement("div");
    more.className = "mz-contact-more";
    if (moments) {
      moments.innerHTML = `${icon("moments")}　${mzT("朋友圈", "Moments")}`;
      more.append(moments);
    }
    if (birthday) more.append(birthday);
    if (remove) more.append(remove);
    row.after(more);
  };
}

/* ------------------------------------------------------------------ */
/* 12. 星星 (device events)                                              */
/*     Android: the native service detects events but read settings    */
/*     from a stale copy and posted AI replies into it. The page now    */
/*     sends the saved settings down and answers AI 星星 itself; human  */
/*     星星 are messaged by the service, also while the app is closed.  */
/*     iPhone: only "opened 沐水" and charging / low battery, while the  */
/*     app is running — iOS allows nothing more.                        */
/* ------------------------------------------------------------------ */
const MZ_STAR_KEYS = ["deviceEventsEnabled", "deviceEventTargets", "deviceEventAppOpen", "deviceEventBattery", "deviceEventScreen", "deviceEventIdle", "deviceEventSpend"];
const mzStarText = (detail) => "裝置提醒：" + detail + "。這是我在沐水中選擇分享的資訊。";
async function mzStarToAI(aiId, text, client) {
  if (!state.ais.some((a) => a.id === aiId)) return;
  let chat = state.chats.find((c) => c.members.length === 1 && c.members[0] === aiId);
  if (!chat) {
    await mutate("newChat", { members: [aiId] });
    chat = state.chats.find((c) => c.members.length === 1 && c.members[0] === aiId);
  }
  if (!chat || chat.messages.some((m) => m.clientMessageId === client)) return;
  const r = await call("send", { id: chat.id, text, clientMessageId: client });
  if (r?.state) state = r.state;
}
async function mzStarToHuman(peer, text, client) {
  if (!state.human?.connected) throw Error("尚未登入好友帳號");
  await call("human", { action: "send", id: peer, text, clientMessageId: client });
}
if (window.AndroidHost && window.Desktop?.invoke) {
  let sent = "",
    delivering = false;
  const configure = () => {
    if (!state?.settings) return;
    const d = Object.fromEntries(MZ_STAR_KEYS.map((k) => [k, state.settings[k] ?? null]));
    d.server = state.human?.connected ? state.human.serverUrl || "" : "";
    const sig = JSON.stringify(d);
    if (sig === sent) return;
    sent = sig;
    Desktop.invoke("deviceEventsConfig", d).catch(() => (sent = ""));
  };
  const deliver = async () => {
    if (delivering || !state?.settings?.deviceEventsEnabled) return;
    delivering = true;
    try {
      const r = await Desktop.invoke("deviceEventsPending");
      for (const e of r.events || [])
        for (const target of e.targets || []) {
          if (!target.startsWith("ai:") || (e.delivered || []).includes(target)) continue;
          await mzStarToAI(target.slice(3), mzStarText(e.detail), "device-" + e.id + "-" + target.slice(3));
          await Desktop.invoke("deviceEventsDelivered", { id: e.id, target });
        }
    } catch {
      // AI busy or no key yet: the event stays queued and is tried again.
    } finally {
      delivering = false;
    }
  };
  setTimeout(configure, 2000);
  setInterval(configure, 5000);
  setInterval(deliver, 15000);
  document.addEventListener("visibilitychange", () => !document.hidden && setTimeout(deliver, 1500));
} else {
  const lastKey = "mizuki-star-last";
  const fire = async (kind, detail) => {
    const st = state?.settings;
    if (!st?.deviceEventsEnabled || !st["deviceEvent" + kind] || !(st.deviceEventTargets || []).length) return;
    let last = {};
    try {
      last = JSON.parse(localStorage.getItem(lastKey) || "{}");
    } catch {}
    if (Date.now() - (last[kind] || 0) < 3600000) return;
    last[kind] = Date.now();
    try {
      localStorage.setItem(lastKey, JSON.stringify(last));
    } catch {}
    const id = crypto.randomUUID();
    for (const target of st.deviceEventTargets) {
      const [type, who] = String(target).split(":");
      try {
        if (type === "ai") await mzStarToAI(who, mzStarText(detail), "device-" + id + "-" + who);
        else if (type === "human") await mzStarToHuman(who, mzStarText(detail), "device-" + id + "-" + who);
      } catch (e) {
        console.warn("星星", e);
      }
    }
  };
  let wasCharging = null;
  window.mizukiBattery = (status, level) => {
    const charging = status === "charging" || status === "full";
    if (wasCharging === false && charging) fire("Battery", "裝置開始充電");
    else if (!charging && level > 0 && level <= 15) fire("Battery", "電量偏低（" + level + "%）");
    wasCharging = charging;
  };
  const opened = () => setTimeout(() => fire("AppOpen", "打開了沐水"), 3000);
  opened();
  document.addEventListener("visibilitychange", () => !document.hidden && opened());
}
// iPhone settings: show the events iOS can actually report.
if (window.IOSHost) {
  const base = notificationPage;
  notificationPage = function () {
    return base().replace(
      /<p class="help">此版本無法取得 Android 裝置事件權限；[^<]*<\/p>/,
      toggle("deviceEventsEnabled", "允許裝置事件提醒", "iPhone 只在沐水開著或剛切到背景時偵測得到。") +
        toggle("deviceEventAppOpen", "打開沐水時提醒", "每小時最多一次。") +
        toggle("deviceEventBattery", "開始充電／電量偏低時提醒", "需要沐水正在執行；關閉 App 後 iOS 不會通知沐水。"),
    );
  };
}

/* ------------------------------------------------------------------ */
/* 13. Importing an AI: optional generated voice                        */
/*     Next to 拍一拍／頭像／朋友圈背景, the setup sheet can pick a voice */
/*     and speaking style from the personality; it is applied at once. */
/* ------------------------------------------------------------------ */
const MZ_TTS_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"];
async function mzGenerateVoice(id) {
  const a = ai(id),
    raw = await WebEngine.complete(
      state.settings,
      "依照角色個性，替這個角色選一個語音合成聲線並描述說話方式。聲線只能從以下選一個：" + MZ_TTS_VOICES.join("、") + '。只回 JSON：{"voice":"聲線","instructions":"以繁體中文描述語氣、語速與情緒，40 字以內"}',
      [{ role: "user", content: `名字：${a.name}\n個性：${a.personality}` }],
    ),
    picked = WebEngine.json(raw),
    voice = MZ_TTS_VOICES.includes(picked?.voice) ? picked.voice : "coral",
    instructions = String(picked?.instructions || "").trim().slice(0, 200);
  await WebEngine.edit((s) => {
    const x = WebEngine.find(s.ais, id);
    x.voiceProfile = { ...(x.voiceProfile || {}), voice, ...(instructions ? { instructions } : {}) };
  });
  state = await call("load");
}
{
  const pick = actions.pickImport;
  actions.pickImport = async () => {
    await pick();
    const cover = document.querySelector("#importGenerateCover")?.closest("label");
    if (cover && !document.querySelector("#importGenerateVoice"))
      cover.insertAdjacentHTML("afterend", `<label class="flex"><input id="importGenerateVoice" type="checkbox"> ${mzT("依個性生成語音（聲線與說話方式）", "Generate a voice from the personality")}</label>`);
  };
  const generate = actions.generateImportedAI;
  actions.generateImportedAI = async () => {
    const id = pendingImportedAI,
      voice = !!document.querySelector("#importGenerateVoice")?.checked;
    await generate();
    if (!voice || !id) return;
    toast(mzT("正在生成語音…", "Generating voice…"), 4000);
    try {
      await mzGenerateVoice(id);
      render();
      toast(mzT("語音已生成並套用", "Voice generated and applied"));
    } catch (e) {
      toast(mzT("語音生成失敗：", "Voice generation failed: ") + (e.message || e), 5000);
    }
  };
}

/* ------------------------------------------------------------------ */
/* 14. Styles                                                            */
/* ------------------------------------------------------------------ */
{
  const st = document.createElement("style");
  st.textContent = `.mz-call .mz-v.mz-stale{display:none}
.sheet [data-action="saveContactNote"]{width:100%;margin-top:10px}
.mz-contact-more{display:grid;gap:10px;margin-top:10px}.mz-contact-more>.pill{width:100%;margin:0;justify-content:center}.mz-contact-more>.link-button{justify-self:center;margin-top:6px}
.mz-bg-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 2px;border-top:1px solid var(--line)}`;
  document.head.append(st);
}
/* ------------------------------------------------------------------ */
/* 15. Translate last                                                   */
/*     Translation ran in the middle of the render chain, so every     */
/*     later layer put Chinese back (even the bottom tabs). Run it once */
/*     more after all layers.                                           */
/* ------------------------------------------------------------------ */
{
  const base = render;
  render = function () {
    base();
    window.mizukiTranslate?.();
  };
  const sheet = showModal;
  showModal = function (...args) {
    const result = sheet.apply(this, args);
    window.mizukiTranslate?.(document.getElementById("overlay"));
    return result;
  };
}
if (state) render();
