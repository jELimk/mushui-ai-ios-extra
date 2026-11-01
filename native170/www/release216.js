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
const mzPending = new Map(),
  mzSendQueues = new Map();
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
    window.mizukiPinChatBottom?.();
    mzApplyPending();
    setTimeout(() => !modal && render(), 0);
    // Friend messages are shown at once but sent one after another, so they arrive in the order typed.
    let result;
    if (op === "human") {
      const key = "human:" + data.id,
        before = mzSendQueues.get(key) || Promise.resolve();
      result = before.catch(() => {}).then(() => base(op, data));
      mzSendQueues.set(key, result);
    } else result = base(op, data);
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
/* 9. Official release posts (Moments)                                  */
/*    Every post from 3.0.0 on is kept (releases.js); missing ones are  */
/*    restored with their original date. Posts from older versions are */
/*    removed. Each post is shown in the current app language.         */
/* ------------------------------------------------------------------ */
{
  const keep = new Map(MZ_RELEASES.map((r) => ["official-release-" + r.version, r]));
  const older = (p) => (p.id?.startsWith("official-release-") || p.release) && !keep.has(p.id);
  let busy = false;
  const ensure = async () => {
    if (busy || !state?.moments) return;
    const missing = [...keep.keys()].filter((id) => !state.moments.some((p) => p.id === id));
    if (!missing.length && !state.moments.some(older)) return;
    busy = true;
    try {
      await WebEngine.edit((s) => {
        s.moments = s.moments.filter((p) => !older(p));
        for (const id of missing) {
          if (s.moments.some((p) => p.id === id)) continue;
          const r = keep.get(id);
          s.moments.push({ id, author: "official-mushui", text: r.zh, images: [], time: Date.parse(r.date), likes: [], comments: [], official: true, release: true });
        }
      });
      state = await call("load");
      render();
    } catch (e) {
      console.warn("official release posts", e);
    } finally {
      busy = false;
    }
  };
  let checked = false;
  setInterval(ensure, 60000);
  const base = render;
  render = function () {
    if (!checked && state?.moments) {
      checked = true;
      setTimeout(ensure, 1500);
    }
    localize(state?.moments);
    base();
  };
  // Some screens refresh from fresh data without this render step, so localize whatever call() returns too.
  function localize(moments) {
    if (!Array.isArray(moments)) return;
    const en = mzEn();
    for (const p of moments) {
      const r = keep.get(p.id);
      if (r) p.text = en ? r.en : r.zh;
    }
  }
  const baseCall = call;
  call = async function (...args) {
    const r = await baseCall.apply(this, args);
    localize(r?.moments);
    localize(r?.state?.moments);
    return r;
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
    // Same section-label + card list as 隱藏／已刪除的聊天室, inside the page's .content (not after it).
    const section = `<div class="section-label">${mzT("已移除的角色", "Removed roles")}</div><div class="card mz-chat-list">${
      roles.length
        ? roles.map((id) => `<div class="mz-chat-line"><span>${esc(ai(id).name)}</span><button class="pill" data-mz-forget-role="${esc(id)}">${mzT("刪除", "Delete")}</button></div>`).join("") +
          `<p class="help">${mzT("刪除後，這些角色留下的聊天訊息、朋友圈與留言都會一併刪除。", "Deleting removes the messages, posts and comments these roles left behind.")}</p><button class="pill full" data-action="mzForgetAllRoles">${mzT("全部刪除", "Delete all")}</button>`
        : `<p class="help">${mzT("沒有已移除的角色。", "No removed roles.")}</p>`
    }</div>`;
    return base().replace(/<\/div>\s*$/, section + "</div>");
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
// Which device the event came from, so a Star knows whether it was your phone or your computer.
function mzDeviceName() {
  if (window.AndroidHost) return mzT("Android 手機", "Android phone");
  if (window.IOSHost) return /iPad/i.test(navigator.userAgent) ? "iPad" : "iPhone";
  if (window.MushuiDesktop) return mzT("電腦", "Computer");
  return mzT("瀏覽器", "Browser");
}
const mzStarText = (detail, device = mzDeviceName()) => mzT("星星提醒 · ", "Star alert · ") + device + mzT("：", ": ") + detail;
// Star notices are shown as a centered system line, not as a message you typed.
async function mzStarToAI(aiId, text, client) {
  if (!state.ais.some((a) => a.id === aiId)) return;
  let chat = state.chats.find((c) => c.members.length === 1 && c.members[0] === aiId);
  if (!chat) {
    await mutate("newChat", { members: [aiId] });
    chat = state.chats.find((c) => c.members.length === 1 && c.members[0] === aiId);
  }
  if (!chat) return;
  if (!chat.messages.some((m) => m.clientMessageId === client))
    await WebEngine.edit((s) => {
      const c = s.chats.find((x) => x.id === chat.id);
      if (c && !c.messages.some((m) => m.clientMessageId === client)) WebEngine.append(c, "me", text, { starEvent: true, clientMessageId: client });
    });
  // The AI reads the notice like any message and replies in character.
  const r = await call("send", { id: chat.id, retry: true });
  if (r?.state) state = r.state;
}
async function mzStarToHuman(peer, text, client) {
  if (!state.human?.connected) throw Error("尚未登入好友帳號");
  await call("human", { action: "send", id: peer, text, clientMessageId: client, starEvent: true });
}
// Events this page detects itself (opening Mizuki on any device, battery on iPhone).
const MZ_STAR_LAST = "mizuki-star-last";
async function mzFireStar(kind, detail) {
  const st = state?.settings;
  if (!st?.deviceEventsEnabled || !st["deviceEvent" + kind] || !(st.deviceEventTargets || []).length) return;
  let last = {};
  try {
    last = JSON.parse(localStorage.getItem(MZ_STAR_LAST) || "{}");
  } catch {}
  if (Date.now() - (last[kind] || 0) < 3600000) return;
  last[kind] = Date.now();
  try {
    localStorage.setItem(MZ_STAR_LAST, JSON.stringify(last));
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
}
{
  const opened = () => setTimeout(() => mzFireStar("AppOpen", mzT("打開了沐水", "opened Mizuki")), 3000);
  opened();
  document.addEventListener("visibilitychange", () => !document.hidden && opened());
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
  // Events detected by the Android service (charging, screen, other apps) for AI Stars.
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
  let wasCharging = null;
  window.mizukiBattery = (status, level) => {
    const charging = status === "charging" || status === "full";
    if (wasCharging === false && charging) mzFireStar("Battery", mzT("開始充電", "started charging"));
    else if (!charging && level > 0 && level <= 15) mzFireStar("Battery", mzT("電量偏低（" + level + "%）", "battery low (" + level + "%)"));
    wasCharging = charging;
  };
}
// System notices (Stars, pokes, call records) are shown in the current app language and, for Stars,
// as a centered system line on both sides — recognized by the flag or by the "星星提醒 ·" text, so a
// missing flag (older app or server) never turns them into your own bubble. Messages people typed are
// never changed.
const MZ_STAR_RE = /^(?:星星提醒|Star alert) · (.+?)(?:：|: )(.+)$/s;
const MZ_DEVICE_WORDS = [["Android 手機", "Android phone"], ["Windows 電腦", "Windows computer"], ["Mac 電腦", "Mac computer"], ["電腦", "Computer"], ["瀏覽器", "Browser"], ["iPhone", "iPhone"], ["iPad", "iPad"]];
const MZ_STAR_DETAILS = [
  ["打開了沐水", "opened Mizuki"], ["裝置開始充電", "started charging"], ["開始充電", "started charging"], ["電量已充滿", "fully charged"],
  ["裝置螢幕已開啟", "screen turned on"], ["裝置螢幕已關閉", "screen turned off"],
  ["裝置已持續亮屏一段時間", "screen has been on for a long time"], ["裝置已長時間未亮屏", "screen has been off for a long time"],
];
function mzStarLine(text, en) {
  const m = MZ_STAR_RE.exec(String(text || "").trim());
  if (!m) return null;
  const pick = (list, v) => {
    const hit = list.find((x) => x[0] === v || x[1] === v);
    return hit ? hit[en ? 1 : 0] : null;
  };
  let detail = pick(MZ_STAR_DETAILS, m[2]);
  if (!detail) {
    const low = /^(?:電量偏低（(\d+)%）|battery low \((\d+)%\))$/.exec(m[2]),
      app = /^(?:剛才開啟了「(.+)」|opened “(.+)”)$/.exec(m[2]),
      spend = /^(?:可能有一筆消費（(.+)）|possible purchase \((.+)\))$/.exec(m[2]);
    if (low) detail = en ? `battery low (${low[1] || low[2]}%)` : `電量偏低（${low[1] || low[2]}%）`;
    else if (app) detail = en ? `opened “${app[1] || app[2]}”` : `剛才開啟了「${app[1] || app[2]}」`;
    else if (spend) detail = en ? `possible purchase (${spend[1] || spend[2]})` : `可能有一筆消費（${spend[1] || spend[2]}）`;
    else detail = en ? window.mizukiTranslateText?.(m[2]) || m[2] : m[2];
  }
  const device = pick(MZ_DEVICE_WORDS, m[1]) || (en ? window.mizukiTranslateText?.(m[1]) || m[1] : m[1]);
  return (en ? "Star alert · " : "星星提醒 · ") + device + (en ? ": " : "：") + detail;
}
// 我拍了拍Mio的小腦袋 → I poked Mio的小腦袋 (the custom ending stays as written).
function mzPokeLine(text, names) {
  const m = /^(.*?)拍了拍(.*)$/s.exec(String(text || ""));
  if (!m) return null;
  const actor = m[1] === "我" ? "I" : m[1];
  let target = m[2],
    rest = "";
  if (target.startsWith("我")) [target, rest] = ["me", target.slice(1)];
  else if (target.startsWith("你")) [target, rest] = ["you", target.slice(1)];
  else {
    const name = names.filter((n) => n && target.startsWith(n)).sort((a, b) => b.length - a.length)[0];
    if (name) [target, rest] = [name, target.slice(name.length)];
  }
  return `${actor} poked ${target}${rest}`;
}
{
  const base = render;
  render = function () {
    base();
    if (!chatId || !state) return;
    const human = chatId.startsWith("human:"),
      peer = chatId.slice(6),
      list = human ? state.human?.messages?.filter((m) => m.sender === peer || m.recipient === peer) : state.chats.find((c) => c.id === chatId)?.messages,
      en = mzEn(),
      names = human ? [humanFriend(peer)?.name, state.human?.me?.name] : (state.chats.find((c) => c.id === chatId)?.members || []).map((id) => ai(id).name);
    for (const m of list || []) {
      const star = mzStarLine(m.text, en),
        poke = en && (m.poke || /^[^\n]{1,40}拍了拍[^\n]{0,40}$/.test(m.text || "")) ? mzPokeLine(m.text, names) : null,
        call = en && m.callEvent && !star ? window.mizukiTranslateText?.(m.text) : null;
      if (!star && !poke && !call) continue;
      const row = document.querySelector(`[data-message-id="${CSS.escape((human ? "human-" : "") + m.id)}"]`),
        bubble = row?.querySelector(".bubble");
      if (!row || !bubble) continue;
      if (star) row.classList.add("call-event", "mz-star-event");
      const text = star || poke || call;
      if (bubble.textContent !== text) bubble.textContent = text;
    }
  };
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
/* 12b. Chat position: only your own scrolling moves the chat          */
/*     On Android the chat could jump to older messages while typing,  */
/*     after a poke, or when back closed the keyboard. The top visible */
/*     message is remembered from your own swipes only; while the      */
/*     input is focused, for 1.5 s after a poke and for 1 s after the  */
/*     keyboard opens or closes it is put back after any change.       */
/*     If you were at the bottom, the chat stays at the bottom.        */
/* ------------------------------------------------------------------ */
{
  let last = null,
    guardUntil = 0,
    selfScroll = 0,
    lastTouch = 0;
  // Swipes and wheel only: taps (a poke is two taps on an avatar) are not scrolling.
  for (const type of ["touchmove", "wheel"]) document.addEventListener(type, () => (lastTouch = Date.now()), { capture: true, passive: true });
  const typing = () => !!document.activeElement?.matches?.(".composer textarea");
  const box = () => document.querySelector(".message-scroll");
  const read = (n) => {
    const top = n.getBoundingClientRect().top,
      m = mizukiTopMessage(n);
    return { chat: n.dataset.chatId, id: m?.dataset.messageId, offset: m ? m.getBoundingClientRect().top - top : 0, atBottom: n.scrollHeight - n.clientHeight - n.scrollTop < 32 };
  };
  const restore = () => {
    const n = box();
    if (!n || !last || n.dataset.chatId !== last.chat) return;
    let target = n.scrollTop;
    if (last.atBottom) target = n.scrollHeight - n.clientHeight;
    else {
      const m = last.id && n.querySelector('[data-message-id="' + CSS.escape(last.id) + '"]');
      if (!m) return;
      target = n.scrollTop + m.getBoundingClientRect().top - n.getBoundingClientRect().top - last.offset;
    }
    if (Math.abs(target - n.scrollTop) < 2) return;
    selfScroll = Date.now();
    n.scrollTop = target;
  };
  document.addEventListener(
    "scroll",
    (e) => {
      // Only your own scrolling (including momentum) moves the remembered position.
      if (!e.target?.classList?.contains("message-scroll") || Date.now() - lastTouch > 1500 || Date.now() - selfScroll < 100) return;
      last = read(e.target);
    },
    true,
  );
  const resized = () => {
    const n = box();
    if (!n) return;
    if (!last || last.chat !== n.dataset.chatId) last = read(n);
    guardUntil = Date.now() + 1000;
    for (const t of [0, 80, 200, 400, 700, 1000]) setTimeout(restore, t);
  };
  window.visualViewport?.addEventListener("resize", resized);
  window.addEventListener("resize", resized);
  // Some WebViews change the height without a resize event; watch the app's own size too.
  if (window.ResizeObserver) {
    let height = 0;
    new ResizeObserver(([entry]) => {
      const h = Math.round(entry.contentRect.height);
      if (height && h !== height) resized();
      height = h;
    }).observe(document.documentElement);
  }
  document.addEventListener(
    "click",
    (e) => {
      if (e.detail !== 2 || !e.target.closest?.(".message .avatar")) return;
      guardUntil = Date.now() + 1500;
      for (const t of [0, 100, 300, 700, 1200]) setTimeout(restore, t);
    },
    true,
  );
  // Sending your own message shows the newest messages, as before.
  window.mizukiPinChatBottom = () => last && (last.atBottom = true);
  const base = render;
  render = function () {
    base();
    if (Date.now() < guardUntil || typing()) restore();
    else if (box()) last = read(box());
  };
}

/* ------------------------------------------------------------------ */
/* 12c. Chat input placeholder                                          */
/* ------------------------------------------------------------------ */
{
  const base = render;
  render = function () {
    base();
    const text = mzT("說點什麼...(-_-)", "Say something...(-_-)");
    for (const ta of document.querySelectorAll(".composer textarea")) if (ta.placeholder !== text) ta.placeholder = text;
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
  const setup = importSetupModal;
  importSetupModal = function (...args) {
    setup(...args);
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
    // Already translated: drop the observer's copies of this render's changes.
    window.mizukiLiveTranslate?.takeRecords();
  };
  const sheet = showModal;
  showModal = function (...args) {
    const result = sheet.apply(this, args);
    window.mizukiTranslate?.(document.getElementById("overlay"));
    return result;
  };
}
if (state) render();

// 3.0.2 #7 / 3.0.6: 設定 → AI 的日常 → 回覆方式 — two clear choices instead of a switch whose name
// ("一次回覆一則訊息") read like "one by one". aiSingleReply=false is the default: several short messages.
{
  const mzLifeStyle = lifePage;
  lifePage = function () {
    const html = mzLifeStyle(),
      single = !!draft.aiSingleReply,
      choice = (v, zh, en, sub, subEn) => `<button class="setting-choice ${single === v ? "selected" : ""}" data-mz-reply="${v ? "single" : "split"}"><b>${mzT(zh, en)}</b><span class="small" style="display:block">${mzT(sub, subEn)}</span></button>`,
      row = `<div class="mz-reply-style"><h3>${mzT("AI 回覆方式", "How AIs reply")}</h3>${choice(false, "一則一則傳", "One by one", "像真人聊天，分成幾則短訊息，每秒送出一則。", "Like a real chat: a few short messages, one per second.")}${choice(true, "合成一大則", "All in one", "把想說的話寫成一則完整訊息。", "Everything in one complete message.")}</div>`;
    return html.includes("mz-reply-style") ? html : html.replace('</div><div class="card"><h3>持續陪伴</h3>', row + '</div><div class="card"><h3>持續陪伴</h3>');
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-mz-reply]");
    if (!b || !draft) return;
    draft.aiSingleReply = b.dataset.mzReply === "single";
    dirty = true;
    render();
  });
}

// 3.0.2 #19: desktop — Enter in a single-line field confirms it (sign-in, API key, names…):
// the nearest primary button around the field, otherwise the page's 儲存.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || e.shiftKey || e.isComposing || e.defaultPrevented || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const input = e.target;
  if (input.tagName !== "INPUT" || !/^(text|password|email|url|number|tel)$/.test(input.type) || input.dataset.input === "message") return;
  let box = input.parentElement, button = null;
  for (let depth = 0; box && box.id !== "app" && box.id !== "overlay" && depth < 5 && !button; depth++, box = box.parentElement)
    button = box.querySelector("button.primary:not([disabled]), button[type=submit]:not([disabled])");
  button ||= document.querySelector('#overlay .sheet button.primary:not([disabled])') || (!document.querySelector("#overlay .sheet") && document.querySelector('#app [data-action="save"]'));
  if (!button) return;
  e.preventDefault();
  input.blur();
  button.click();
});

// 3.0.2 #20: mouse side buttons — back (button 3) uses the app's own back; forward (button 4) returns to
// where back left. Any other navigation clears the forward list, like a browser.
{
  const where = () => ({ tab, page, chatId }),
    key = (w) => [w.tab, w.page, w.chatId].join("|"),
    forward = [];
  let expected = "",
    moving = false;
  const base = render;
  render = function () {
    base();
    if (!moving && expected && key(where()) !== expected) forward.length = 0;
    expected = key(where());
  };
  const side = (e) => e.button === 3 || e.button === 4;
  document.addEventListener("mousedown", (e) => side(e) && e.preventDefault());
  document.addEventListener("mouseup", (e) => {
    if (!side(e)) return;
    e.preventDefault();
    moving = true;
    try {
    if (e.button === 3) {
      const before = where();
      window.goBack();
      if (key(where()) !== key(before)) {
        forward.push(before);
        expected = key(where());
      }
    } else if (forward.length) {
      const next = forward.pop();
      if (next.tab !== tab) navigate(next.tab);
      if (next.page && next.page !== "settings-home" && typeof draft === "object" && !draft) draft = { ...state.settings };
      tab = next.tab;
      page = next.page;
      chatId = next.chatId;
      render();
      expected = key(where());
    }
    } finally {
      moving = false;
    }
  });
}

// 3.0.3: the friend server moved to https://mizukihumanchat.onrender.com (window.MIZUKI_SERVER).
// Saved addresses that still point at the old mushui.onrender.com are switched over once.
(async () => {
  const next = window.MIZUKI_SERVER,
    old = /^https:\/\/mushui\.onrender\.com\/?$/i;
  if (!next || !window.WebEngine) return;
  const s = await WebEngine.read();
  if (!old.test(s.human?.serverUrl || "") && !old.test(s.settings?.officialServerUrl || "")) return;
  await WebEngine.edit((x) => {
    if (old.test(x.human?.serverUrl || "")) x.human.serverUrl = next;
    if (old.test(x.settings?.officialServerUrl || "")) x.settings.officialServerUrl = next;
  });
  state = await call("load");
  render();
})().catch((e) => console.warn("server move", e));

// 3.0.3: Windows app — the top bar follows the theme instead of the white system bar.
if (window.Desktop && !window.AndroidHost && !window.IOSHost) {
  document.documentElement.classList.add("mz-titlebar");
  // Computed colours come back as rgb(…) or, from color-mix(), as color(srgb r g b) with 0–1 channels.
  const hex = (c) => {
    const to = (n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0");
    let m = /rgba?\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)/.exec(c || "");
    if (m) return "#" + m.slice(1, 4).map((n) => to(+n)).join("");
    m = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(c || "");
    return m ? "#" + m.slice(1, 4).map((n) => to(n * 255)).join("") : "";
  };
  let sent = "";
  const sync = () => {
    const style = getComputedStyle(document.body),
      color = hex(style.backgroundColor),
      symbolColor = hex(style.color);
    if (!color || !symbolColor || sent === color + symbolColor) return;
    sent = color + symbolColor;
    window.Desktop.invoke("titleBar", { color, symbolColor }).catch(() => {});
  };
  const base = render;
  render = function () {
    base();
    sync();
  };
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => setTimeout(sync, 50));
  setTimeout(sync, 300);
}

// 3.0.3: sign-in needs only ID, nickname and password — the friend server is built in
// (window.mizukiDefaultServer), so its field is kept as a hidden value instead of shown.
// The sheet can be redrawn after it opens, so this runs whenever the overlay changes.
{
  const tidy = () => {
    const input = document.querySelector("#overlay #humanServer");
    if (input && input.type !== "hidden") {
      input.type = "hidden";
      for (const el of [input.previousElementSibling, input.nextElementSibling])
        if (el && (el.tagName === "LABEL" || (el.classList.contains("help") && /伺服器|server/i.test(el.textContent)))) el.style.display = "none";
      if (!humanData().connected) {
        const sheet = input.closest(".sheet"),
          title = [...(sheet?.querySelectorAll("*") || [])].find((el) => !el.children.length && /^(人類帳號與伺服器|Human account.*)$/i.test(el.textContent.trim())),
          intro = input.previousElementSibling?.previousElementSibling;
        if (title) title.textContent = mzT("登入沐水", "Sign in to Mizuki");
        if (intro?.classList.contains("help")) intro.textContent = mzT("登入或註冊帳號，就能加好友聊天。好友訊息存在沐水伺服器，沒有端到端加密。", "Sign in or sign up to chat with friends. Friend messages are stored on the Mizuki server without end-to-end encryption.");
      }
    }
  };
  // Watch the whole page: the overlay element itself can be created or replaced after load.
  new MutationObserver(tidy).observe(document.documentElement, { childList: true, subtree: true });
  const baseShow = showModal;
  showModal = function () {
    const r = baseShow.apply(this, arguments);
    tidy();
    setTimeout(tidy, 50);
    return r;
  };
}

// 3.0.3: computer scrollbars — the track is always there; the thumb appears while scrolling or while the
// mouse is on the bar, then fades out (CSS in theme-controls.css).
if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
  document.documentElement.classList.add("mz-scrollbars");
  const timers = new WeakMap();
  const show = (el, ms) => {
    if (!el?.classList) return;
    el.classList.add("mz-thumb");
    clearTimeout(timers.get(el));
    if (ms) timers.set(el, setTimeout(() => el.classList.remove("mz-thumb"), ms));
  };
  document.addEventListener("scroll", (e) => show(e.target === document ? document.scrollingElement : e.target, 900), true);
  let hovered = null,
    frame = 0;
  document.addEventListener("mousemove", (e) => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      let el = e.target instanceof Element ? e.target : null,
        hit = null;
      for (; el && el !== document.documentElement; el = el.parentElement) {
        if (el.scrollHeight <= el.clientHeight) continue;
        const r = el.getBoundingClientRect();
        if (r.right - e.clientX <= 12 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) {
          hit = el;
          break;
        }
      }
      if (hovered && hovered !== hit) show(hovered, 400);
      if (hit) show(hit, 0);
      hovered = hit;
    });
  });
}

// 3.0.5: toasts (設定已儲存, errors…) live outside #app/#overlay, so translate them here in English mode.
{
  const baseToast = toast;
  toast = function (text, ...rest) {
    if (mzEn() && typeof text === "string") text = window.mizukiTranslateText?.(text) || text;
    return baseToast.call(this, text, ...rest);
  };
}

// 3.0.5: 通知與裝置 → 裝置權限 — one row per permission with an on/off switch instead of a grid of buttons.
// Web permissions are read from the browser; Android ones are remembered after a successful request.
// Switching one off only explains where to revoke it (apps cannot take a permission back themselves).
{
  const names = { camera: ["相機", "Camera"], microphone: ["麥克風", "Microphone"], notifications: ["通知", "Notifications"], location: ["精確位置", "Precise location"], background: ["背景位置", "Background location"], usage: ["App 使用情況", "App usage"], noticeAccess: ["通知存取", "Notification access"], battery: ["背景電池設定", "Background battery"] };
  const query = { camera: "camera", microphone: "microphone", notifications: "notifications", location: "geolocation" };
  let known = {};
  try { known = JSON.parse(localStorage.getItem("mzPermissions") || "{}"); } catch {}
  const remember = () => { try { localStorage.setItem("mzPermissions", JSON.stringify(known)); } catch {} };
  // Only a plain browser reports permissions reliably; the Android, iPhone and Windows apps answer "prompt"
  // even after the system granted them, which used to flip the switches back off. So the apps keep what
  // was granted here, and a browser only switches a row off when the permission is actually denied.
  const reliable = !window.AndroidHost && !window.IOSHost && !window.Desktop;
  const refresh = async () => {
    if (!reliable) return;
    let changed = false;
    for (const [id, name] of Object.entries(query)) {
      try {
        const s = (await navigator.permissions?.query({ name }))?.state,
          next = s === "granted" ? true : s === "denied" ? false : known[id];
        if (next !== undefined && known[id] !== next) { known[id] = next; changed = true; }
      } catch {}
    }
    if (changed) { remember(); if (tab === "settings" && page === "notifications") render(); }
  };
  const row = (id) => `<div class="toggle-row"><div><h3>${mzT(...names[id])}</h3></div><button class="switch ${known[id] ? "on" : ""}" data-mz-permission="${id}" role="switch" aria-checked="${!!known[id]}" aria-label="${mzT(...names[id])}"></button></div>`;
  const base = notificationPage;
  notificationPage = function () {
    const html = base(),
      ids = ["camera", "microphone", "notifications", "location", ...(window.AndroidHost ? ["background", "usage", "noticeAccess", "battery"] : [])];
    return html.replace(/<div class="permission-grid">[\s\S]*?<\/div>/, `<div class="mz-permission-list">${ids.map(row).join("")}</div>`);
  };
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-mz-permission]");
    if (!b) return;
    const id = b.dataset.mzPermission;
    if (known[id]) return toast(mzT("要關閉這個權限，請到系統設定的 App 權限裡關掉。", "To turn this off, use the app permissions in your system settings."));
    b.disabled = true;
    try {
      const r = await requestDevicePermission(id);
      known[id] = r?.granted !== false;
      remember();
      toast(known[id] ? mzT("已授權", "Allowed") : mzT("請在系統視窗完成授權", "Finish allowing it in the system window"));
    } catch (err) {
      toast(err.message || mzT("系統沒有授權", "The system didn't allow it"));
    } finally {
      b.disabled = false;
      render();
    }
  });
  refresh();
  setInterval(refresh, 15000);
}

// 3.0.6: 模型與 API — a plain, normal-size note at the top (not small print).
{
  const baseApi = apiPage;
  apiPage = function () {
    return `<p class="mz-api-note">${mzT("AI 的回覆會根據你選擇的模型來回答，App 並沒有限制 AI 的回覆。", "AI replies come from the model you choose. The app does not limit what the AI replies.")}</p>` + baseApi();
  };
}

// 3.0.7: AI voice calls — the AI's voice plays through a gain stage (up to 300%), with a volume slider on the
// call screen like a phone call. The level is kept per device. On the computer it also follows the chosen
// output device.
{
  const level = () => {
    let v = 160;
    try { v = +(localStorage.getItem("mzAiVoiceVolume") || 160); } catch {}
    return Math.min(300, Math.max(0, v || 0));
  };
  let ctx = null, gain = null;
  window.mzBoostAiVoice = (el) => {
    try {
      ctx ||= new AudioContext();
      gain ||= ctx.createGain();
      gain.gain.value = level() / 100;
      gain.connect(ctx.destination);
      const out = typeof deviceConfig === "function" ? deviceConfig().output : "";
      if (out && ctx.setSinkId) ctx.setSinkId(out).catch(() => {});
      ctx.createMediaElementSource(el).connect(gain);
      el.volume = 1;
      ctx.resume().catch(() => {});
    } catch {
      el.volume = 1; // Fall back to plain playback at full volume.
    }
  };
  const slider = () => `<label class="mz-ai-volume">${mzT("AI 聲音大小", "AI voice volume")} <input type="range" min="0" max="300" step="10" value="${level()}" data-mz-ai-volume aria-label="${mzT("AI 聲音大小", "AI voice volume")}"><span>${level()}%</span></label>`;
  const baseScreen = callScreen;
  callScreen = function (...args) {
    const r = baseScreen.apply(this, args);
    if (VoiceUI.ai && callOverlay && !callOverlay.querySelector(".mz-ai-volume")) callOverlay.insertAdjacentHTML("beforeend", slider());
    return r;
  };
  document.addEventListener("input", (e) => {
    const r = e.target.closest?.("[data-mz-ai-volume]");
    if (!r) return;
    try { localStorage.setItem("mzAiVoiceVolume", r.value); } catch {}
    if (gain) gain.gain.value = r.value / 100;
    const label = r.nextElementSibling;
    if (label) label.textContent = r.value + "%";
  });
}

// 3.0.7: computer — a call screen can be minimized like on the phone, so you can keep chatting; a small bar
// at the top shows the call and brings it back.
if (window.MushuiDesktop) {
  let timer = 0;
  const pill = () => document.getElementById("mzCallPill");
  const sync = () => {
    const on = callOverlay?.isConnected && callOverlay.classList.contains("mz-dmin");
    if (!on) {
      pill()?.remove();
      clearInterval(timer);
      timer = 0;
      return;
    }
    let p = pill();
    if (!p) {
      p = document.createElement("button");
      p.id = "mzCallPill";
      p.dataset.action = "mzDeskCallRestore";
      document.body.append(p);
    }
    const name = callOverlay.querySelector("h2")?.textContent || "",
      status = callOverlay.querySelector(".status")?.textContent || "";
    p.textContent = `📞 ${name} · ${status.slice(0, 24)} · ${mzT("點此返回", "Tap to return")}`;
  };
  const addButton = () => {
    if (callOverlay?.isConnected && !callOverlay.querySelector(".mz-dmin-btn"))
      callOverlay.insertAdjacentHTML("afterbegin", `<button class="pill mz-dmin-btn" data-action="mzDeskCallMin">${mzT("縮小", "Minimize")}</button>`);
  };
  const baseScreen = callScreen;
  callScreen = function (...args) {
    const r = baseScreen.apply(this, args);
    addButton();
    if (timer) sync();
    return r;
  };
  const baseHide = hideCall;
  hideCall = function (...args) {
    const r = baseHide.apply(this, args);
    sync();
    return r;
  };
  actions.mzDeskCallMin = () => {
    callOverlay?.classList.add("mz-dmin");
    sync();
    timer ||= setInterval(sync, 1000);
  };
  actions.mzDeskCallRestore = () => {
    callOverlay?.classList.remove("mz-dmin");
    sync();
  };
}

// 3.0.7: pasted IDs — copying from a profile often brings "ID：" / "Mizuki ID:" along, full-width letters or
// spaces, so the friend search found nobody. Clean them to the bare ID before searching.
{
  window.mzCleanId = (v) =>
    String(v || "")
      .normalize("NFKC")
      .replace(/^[\s\S]*?\bid\s*[:：]\s*/i, "")
      .replace(/^@/, "")
      .replace(/[^A-Za-z0-9_]/g, "")
      .toLowerCase();
  const baseFind = actions.humanFind;
  actions.humanFind = function (...args) {
    const input = document.querySelector("#friendSearchId");
    if (input) input.value = mzCleanId(input.value);
    return baseFind.apply(this, args);
  };
  document.addEventListener(
    "input",
    (e) => {
      const t = e.target;
      if (t?.dataset?.input === "search" && !e.isComposing && /\bid\s*[:：]/i.test(t.value)) t.value = mzCleanId(t.value);
    },
    true,
  );
}

// 3.0.7: Android — 設定 → 通知與裝置 → 背景通知檢查: shows what the background checker last saw and can post a
// test notification, so "no notifications" can be pinned to a cause (login, Do Not Disturb, system settings…).
if (window.AndroidHost) {
  const card = () => `<section class="card mz-bg-check"><h3>${mzT("背景通知檢查", "Background notification check")}</h3><p class="help">${mzT("App 關掉後，沐水會在背景每幾秒問一次伺服器有沒有新訊息。收不到通知時，按「檢查」看看卡在哪裡。", "When the app is closed, Mizuki asks the server for new messages every few seconds. If notifications don't arrive, tap Check to see why.")}</p><div class="sheet-actions"><button class="pill" data-action="mzBgCheck">${mzT("檢查", "Check")}</button><button class="pill" data-action="mzBgTest">${mzT("測試通知", "Test notification")}</button></div><p class="mz-bg-result help" id="mzBgResult"></p></section>`;
  const base = notificationPage;
  notificationPage = function () {
    return base() + card();
  };
  const when = (t) => (t ? new Date(t).toLocaleTimeString(mzEn() ? "en-US" : "zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—");
  actions.mzBgCheck = async () => {
    const r = await Desktop.invoke("bgNotifyStatus", {}),
      lines = [],
      s = String(r.status || "");
    if (!r.notifications) lines.push(mzT("❌ 系統關閉了沐水的通知：請到手機設定 → 應用程式 → 沐水 → 通知 打開。", "❌ Notifications are off for Mizuki in system settings."));
    else if (r.channel >= 0 && r.channel < 3) lines.push(mzT("❌「好友訊息」這個通知類別被調低或關閉：請到 App 通知設定把它打開。", "❌ The “Friend messages” notification category is muted or off."));
    if (!r.running) lines.push(mzT("❌ 背景接收沒有在執行：請打開沐水一次，或重新登入。", "❌ Background receiving isn't running. Open Mizuki once or sign in again."));
    if (s.startsWith("ok")) lines.push(mzT("✅ 上次和伺服器確認：", "✅ Last checked with the server: ") + when(r.statusAt));
    else if (s === "dnd") lines.push(mzT("🔕 你目前是「請勿打擾」，所以不會通知。", "🔕 You're on Do Not Disturb, so nothing is shown."));
    else if (s === "http-401") lines.push(mzT("❌ 登入已過期：請登出再重新登入。", "❌ Sign-in expired. Sign out and sign in again."));
    else if (s === "no-token") lines.push(mzT("❌ 背景拿不到你的登入資料：請登出再重新登入。", "❌ The background service has no sign-in. Sign out and sign in again."));
    else if (s === "no-server") lines.push(mzT("❌ 背景沒有伺服器網址：請打開沐水一次。", "❌ No server address yet. Open Mizuki once."));
    else if (s) lines.push(mzT("❌ 連不到伺服器（", "❌ Can't reach the server (") + s + mzT("），上次：", "), last: ") + when(r.statusAt));
    else lines.push(mzT("⏳ 背景還沒檢查過，關掉 App 等 10 秒再回來看。", "⏳ Not checked yet. Close the app, wait 10 seconds, then look again."));
    if (!r.battery) lines.push(mzT("⚠️ 建議讓沐水「不限制電池」，不然手機可能會把背景接收關掉（下方「背景電池設定」）。", "⚠️ Set Mizuki's battery use to Unrestricted, or the phone may stop background receiving."));
    lines.push(mzT("ℹ️ AI 的訊息要在 App 開著或「持續陪伴」運行時才會產生。", "ℹ️ AI messages are only created while the app is open or Companionship is running."));
    const el = document.getElementById("mzBgResult");
    if (el) el.innerHTML = lines.map(esc).join("<br>");
  };
  actions.mzBgTest = async () => {
    await Desktop.invoke("bgNotifyTest", {});
    toast(mzT("已送出測試通知，請看通知欄。", "Test notification sent. Check your notification bar."));
  };
}
