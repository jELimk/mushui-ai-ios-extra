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
// 3.1.6: every star line carries the time the event happened (24h "HH:MM"
// on the wire), so a notice delivered late still says when it occurred.
const mzStarTime = (when) => {
  const d = new Date(when || Date.now());
  return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
};
const mzStarText = (detail, device = mzDeviceName(), when) => mzT("星星提醒 · ", "Star alert · ") + device + mzT("：", ": ") + detail + " · " + mzStarTime(when);
// Cooldown bucket: distinct events of one kind no longer swallow each
// other (charging at 10:00 used to hide low battery at 10:20); only the
// same event repeats are held back, for 30 minutes.
const mzStarBucket = (kind, detail) => {
  if (/電量偏低|battery low/i.test(detail)) return kind + ":low";
  if (/開始充電|started charging/i.test(detail)) return kind + ":charge";
  if (/已充滿|fully charged/i.test(detail)) return kind + ":full";
  return kind + ":" + detail;
};
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
  const bucket = mzStarBucket(kind, detail);
  if (Date.now() - (last[bucket] || 0) < 1800000) return;
  const id = crypto.randomUUID();
  let delivered = 0,
    firstError = null;
  for (const target of st.deviceEventTargets) {
    const [type, who] = String(target).split(":");
    try {
      if (type === "ai") await mzStarToAI(who, mzStarText(detail, undefined, Date.now()), "device-" + id + "-" + who);
      else if (type === "human") await mzStarToHuman(who, mzStarText(detail, undefined, Date.now()), "device-" + id + "-" + who);
      else continue;
      delivered++;
    } catch (e) {
      firstError = firstError || e;
      console.warn("星星", e);
    }
  }
  // The hour-long cooldown is stamped only after a star actually went
  // out. A failed attempt (e.g. the friend account was still signing in
  // when the app opened) retries in 5 minutes instead of silencing the
  // star for an hour, and the user is told once per session.
  last[bucket] = delivered ? Date.now() : Date.now() - 1500000;
  try {
    localStorage.setItem(MZ_STAR_LAST, JSON.stringify(last));
  } catch {}
  if (!delivered && firstError && !window.__mzStarFailTold) {
    window.__mzStarFailTold = true;
    toast(mzT("星星提醒沒有送出：", "Star alert wasn't sent: ") + (firstError.message || firstError), 3200);
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
          if ((e.delivered || []).includes(target)) continue;
          try {
            if (target.startsWith("ai:")) {
              await mzStarToAI(target.slice(3), mzStarText(e.detail, undefined, e.time), "device-" + e.id + "-" + target.slice(3));
            } else if (target.startsWith("human:")) {
              // The native service messages human stars first; the page
              // only steps in when that hasn't happened shortly after.
              if (Date.now() - (e.time || 0) < 90000) continue;
              await mzStarToHuman(target.slice(6), mzStarText(e.detail, undefined, e.time), "device-" + e.id + "-" + target.slice(6));
            } else continue;
            await Desktop.invoke("deviceEventsDelivered", { id: e.id, target });
          } catch {
            // Stays queued; a later pass tries again.
          }
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
    if (wasCharging === false && charging) mzFireStar("Battery", level > 0 ? mzT("開始充電（電量 " + level + "%）", "started charging (battery " + level + "%)") : mzT("開始充電", "started charging"));
    else if (!charging && level > 0 && level <= 20) mzFireStar("Battery", mzT("電量偏低（" + level + "%）", "battery low (" + level + "%)"));
    wasCharging = charging;
  };
}
// System notices (Stars, pokes, call records) are shown in the current app language and, for Stars,
// as a centered system line on both sides — recognized by the flag or by the "星星提醒 ·" text, so a
// missing flag (older app or server) never turns them into your own bubble. Messages people typed are
// never changed.
const MZ_STAR_RE = /^(?:星星提醒|Star alert) · (.+?)(?:：|: )(.+?)(?: · (\d{1,2}):(\d{2}))?$/s;
const MZ_DEVICE_WORDS = [["Android 手機", "Android phone"], ["Windows 電腦", "Windows computer"], ["Mac 電腦", "Mac computer"], ["電腦", "Computer"], ["瀏覽器", "Browser"], ["iPhone", "iPhone"], ["iPad", "iPad"]];
const MZ_STAR_DETAILS = [
  ["打開了沐水", "opened Mizuki"], ["裝置開始充電", "started charging"], ["開始充電", "started charging"], ["電量已充滿", "fully charged"],
  ["裝置螢幕已開啟", "screen turned on"], ["裝置螢幕已關閉", "screen turned off"],
  ["裝置已持續亮屏一段時間", "screen has been on for a long time"], ["裝置已長時間未亮屏", "screen has been off for a long time"],
  ["電量偏低", "battery low"], ["裝置電量偏低", "battery low"],
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
    const low = /^(?:(?:裝置)?電量偏低（(\d+)%）|battery low \((\d+)%\))$/.exec(m[2]),
      app = /^(?:剛才開啟了「(.+)」|opened “(.+)”)$/.exec(m[2]),
      spend = /^(?:可能有一筆消費（(.+)）|possible purchase \((.+)\))$/.exec(m[2]),
      charge = /^(?:(?:裝置)?開始充電（電量 (\d+)%）|started charging \(battery (\d+)%\))$/.exec(m[2]),
      full = /^(?:電量已充滿（電量 (\d+)%）|fully charged \(battery (\d+)%\))$/.exec(m[2]),
      site = /^(?:開啟了「(.+)」網站|opened the “(.+)” website)$/.exec(m[2]),
      search = /^(?:在瀏覽器搜尋了「(.+)」|searched the web for “(.+)”)$/.exec(m[2]);
    if (low) detail = en ? `battery low (${low[1] || low[2]}%)` : `電量偏低（${low[1] || low[2]}%）`;
    else if (app) detail = en ? `opened “${app[1] || app[2]}”` : `剛才開啟了「${app[1] || app[2]}」`;
    else if (spend) detail = en ? `possible purchase (${spend[1] || spend[2]})` : `可能有一筆消費（${spend[1] || spend[2]}）`;
    else if (charge) detail = en ? `started charging (battery ${charge[1] || charge[2]}%)` : `開始充電（電量 ${charge[1] || charge[2]}%）`;
    else if (full) detail = en ? `fully charged (battery ${full[1] || full[2]}%)` : `電量已充滿（電量 ${full[1] || full[2]}%）`;
    else if (site) detail = en ? `opened the “${site[1] || site[2]}” website` : `開啟了「${site[1] || site[2]}」網站`;
    else if (search) detail = en ? `searched the web for “${search[1] || search[2]}”` : `在瀏覽器搜尋了「${search[1] || search[2]}」`;
    else detail = en ? window.mizukiTranslateText?.(m[2]) || m[2] : m[2];
  }
  const device = pick(MZ_DEVICE_WORDS, m[1]) || (en ? window.mizukiTranslateText?.(m[1]) || m[1] : m[1]);
  let line = (en ? "Star alert · " : "星星提醒 · ") + device + (en ? ": " : "：") + detail;
  if (m[3] !== undefined) {
    const hh = +m[3];
    line += " · " + (en ? (hh % 12 || 12) + ":" + m[4] + " " + (hh < 12 ? "AM" : "PM") : String(m[3]).padStart(2, "0") + ":" + m[4]);
  }
  return line;
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
// 3.1.6 (Android): browser site/search stars read the browser address
// bar through an accessibility service; offer its switch next to the
// usage-access button. Other apps keep showing just the app name.
if (window.AndroidHost) {
  const baseNpA = notificationPage;
  notificationPage = function () {
    return baseNpA().replace(
      '<button class="pill" data-action="deviceEventsPermission">開啟 Android 使用情況存取權</button>',
      '<button class="pill" data-action="deviceEventsPermission">開啟 Android 使用情況存取權</button><button class="pill" data-action="mzBrowserWatch">' + mzT("開啟瀏覽器偵測（無障礙服務）", "Turn on browser detection (accessibility)") + '</button><p class="small">' + mzT("開啟後，你用瀏覽器看網站或搜尋時，星星提醒會顯示網站名稱與搜尋內容；一般 App 只顯示 App 名稱。只讀取瀏覽器網址列的文字，不讀取網頁內容。", "With this on, star alerts show the website name and what you searched for when you browse; other apps show just the app name. Only the browser address-bar text is read, never page content.") + "</p>",
    );
  };
  actions.mzBrowserWatch = async () => {
    await call("accessibilitySettings");
  };
}
// iPhone settings: show the events iOS can actually report.
if (window.IOSHost) {
  const base = notificationPage;
  notificationPage = function () {
    return base().replace(
      /<p class="help">此版本無法取得 Android 裝置事件權限；[^<]*<\/p>/,
      toggle("deviceEventsEnabled", "允許裝置事件提醒", "iPhone 只在沐水開著或剛切到背景時偵測得到。") +
        toggle("deviceEventAppOpen", "打開沐水時提醒", "同一事件半小時內不重複。") +
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
/*     3.1.5: the remembered position is also refreshed the moment     */
/*     the composer is focused (keyboard opening), and a chat that is  */
/*     at the bottom right now is never pulled up to an older swipe.   */
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
    // If the chat is at the bottom right now it stays at the bottom: a
    // remembered position from an older swipe must never pull it up.
    // (Sending a message pins the chat to the bottom with no swipe at
    // all, so the swipe-only memory can be several actions old.)
    const liveBottom = n.scrollHeight - n.clientHeight - n.scrollTop < 32;
    if (last.atBottom || liveBottom) target = n.scrollHeight - n.clientHeight;
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
  // The moment the composer is tapped, remember the position actually
  // on screen: that is the position the opening keyboard must keep.
  document.addEventListener(
    "focusin",
    (e) => {
      if (!e.target?.matches?.(".composer textarea")) return;
      const n = box();
      if (n) last = read(n);
      if (window.scrollY || document.documentElement.scrollTop) window.scrollTo(0, 0);
    },
    true,
  );
  const resized = () => {
    const n = box();
    if (!n) return;
    if (window.scrollY || document.documentElement.scrollTop) window.scrollTo(0, 0);
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
  const toRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)),
    fromRgb = (a) => "#" + a.map((n) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, "0")).join(""),
    // Sheets and pickers dim the whole app (#3b264e55); the native window buttons
    // sit outside the page, so their strip has to be told to dim along with it.
    titleDimmed = () => !!document.querySelector("#overlay .modal-backdrop, .macaron-picker-backdrop");
  const sync = () => {
    const style = getComputedStyle(document.body);
    let color = hex(style.backgroundColor);
    const symbolColor = hex(style.color);
    if (!color || !symbolColor) return;
    if (titleDimmed()) {
      const a = toRgb(color), veil = toRgb("#3b264e");
      color = fromRgb(a.map((n, i) => n * 0.62 + veil[i] * 0.38));
    }
    if (sent === color + symbolColor) return;
    sent = color + symbolColor;
    window.Desktop.invoke("titleBar", { color, symbolColor }).catch(() => {});
  };
  const base = render;
  render = function () {
    base();
    sync();
  };
  const overlayEl = document.getElementById("overlay");
  if (overlayEl) new MutationObserver(() => sync()).observe(overlayEl, { childList: true });
  new MutationObserver(() => sync()).observe(document.body, { childList: true });
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
  const names = { camera: ["相機", "Camera"], microphone: ["麥克風", "Microphone"], notifications: ["通知", "Notifications"], location: ["精確位置", "Precise location"], usage: ["App 使用情況", "App usage"], noticeAccess: ["通知存取", "Notification access"], battery: ["背景電池設定", "Background battery"] };
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
      ids = ["camera", "microphone", "notifications", "location", ...(window.AndroidHost ? ["usage", "noticeAccess", "battery"] : [])];
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

// 3.1.6: call audio must survive the device entering a rest state
// (Windows lock with Win+L, phone screen off). Chromium suspends
// AudioContexts then, and a microphone or speaker routed through a
// suspended graph goes silent even though the call itself is alive.
// Every long-lived call context registers here; while a call is on
// screen it is resumed on a timer, on state changes and whenever the
// page becomes visible or focused again — for as long as the device
// itself keeps running.
{
  const watched = new Set();
  const sessionActive = () => {
    try {
      const v = window.VoiceUI;
      return !!((v && (v.ai || v.rtc || v.recorder)) || document.querySelector(".call-overlay"));
    } catch {
      return false;
    }
  };
  const revive = () => {
    if (!sessionActive()) return;
    for (const c of [...watched]) {
      if (c.state === "closed") {
        watched.delete(c);
        continue;
      }
      if (c.state !== "running") c.resume().catch(() => {});
    }
  };
  window.mzWatchAudio = (c) => {
    try {
      if (c && !watched.has(c)) {
        watched.add(c);
        c.onstatechange = () => {
          if (c.state !== "running") revive();
        };
      }
    } catch {}
    return c;
  };
  setInterval(revive, 4000);
  document.addEventListener("visibilitychange", revive);
  window.addEventListener("focus", revive);
  window.addEventListener("pageshow", revive);
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
  // In-call playback happens long after the last tap, so the shared boost
  // context may still be suspended; a media element routed through a
  // suspended graph is silent even though it "plays". Callers unlock the
  // graph inside the call-start tap, and check mzAiVoiceRunning() before
  // routing a call reply through it (plain element playback otherwise).
  window.mzUnlockAiVoice = () => {
    try {
      ctx ||= window.mzWatchAudio(new AudioContext());
      gain ||= ctx.createGain();
      gain.gain.value = level() / 100;
      gain.connect(ctx.destination);
      const out = typeof deviceConfig === "function" ? deviceConfig().output : "";
      if (out && ctx.setSinkId) ctx.setSinkId(out).catch(() => {});
      if (ctx.state !== "running") ctx.resume().catch(() => {});
    } catch {}
  };
  window.mzAiVoiceRunning = () => {
    try { return !!ctx && ctx.state === "running"; } catch { return false; }
  };
  window.mzBoostAiVoice = (el) => {
    try {
      ctx ||= window.mzWatchAudio(new AudioContext());
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
// 3.1.2: human-call volumes, Discord-style. Two independent gains: my mic
// level is applied to the voice I SEND (mzMicRoute in voice.js, micGain in
// the desktop mix), and the peer level only changes what I HEAR — the
// remote element is routed through a gain so it can go past 100%. Both are
// adjustable live from the call screen and remembered per device.
{
  const micLevel = () => { let v = 100; try { v = +(localStorage.getItem("mzMicVolume") || 100); } catch {} return Math.min(200, Math.max(10, v || 100)); };
  const peerLevel = () => { let v = 100; try { v = +(localStorage.getItem("mzPeerVolume") || 100); } catch {} return Math.min(300, Math.max(0, v || 0)); };
  let micCtx = null;
  window.mzMicGainNode = null;
  window.mzMicRoute = (stream) => {
    try {
      micCtx ||= window.mzWatchAudio(new AudioContext());
      const src = micCtx.createMediaStreamSource(stream);
      const gain = micCtx.createGain();
      gain.gain.value = micLevel() / 100;
      const dest = micCtx.createMediaStreamDestination();
      src.connect(gain); gain.connect(dest);
      window.mzMicGainNode = gain;
      if (micCtx.state !== "running") micCtx.resume().catch(() => {});
      return dest.stream;
    } catch { return null; }
  };
  window.mzSetMicLevel = (v) => {
    try { localStorage.setItem("mzMicVolume", v); } catch {}
    if (window.mzMicGainNode) window.mzMicGainNode.gain.value = v / 100;
    const mix = window.VoiceUI?.rtc?.mix;
    if (mix?.micGain) mix.micGain.gain.value = v / 100;
  };
  let peerCtx = null, peerGain = null;
  const peerRouted = new WeakSet();
  window.mzPeerChain = (el) => {
    try {
      if (!el) return;
      if (el.dataset.mzPeerBase === undefined) el.dataset.mzPeerBase = String(el.volume || 1);
      const base = +el.dataset.mzPeerBase || 1, lvl = peerLevel() / 100;
      if (peerRouted.has(el)) { if (peerGain) peerGain.gain.value = base * lvl; return; }
      peerCtx ||= window.mzWatchAudio(new AudioContext());
      peerGain ||= peerCtx.createGain();
      try { peerGain.connect(peerCtx.destination); } catch {}
      if (peerCtx.state !== "running") { peerCtx.resume().catch(() => {}); el.volume = Math.min(1, base * lvl); return; }
      peerCtx.createMediaElementSource(el).connect(peerGain);
      peerRouted.add(el);
      peerGain.gain.value = base * lvl;
      el.volume = 1;
    } catch {}
  };
  window.mzSetPeerLevel = (v) => {
    try { localStorage.setItem("mzPeerVolume", v); } catch {}
    const el = window.VoiceUI?.remoteAudio;
    if (el) window.mzPeerChain(el);
    else if (peerGain) peerGain.gain.value = v / 100;
  };
  const humanSlider = () => `<div class="mz-call-volumes"><label class="mz-ai-volume">${mzT("我的聲音", "My voice")} <input type="range" min="10" max="200" step="5" value="${micLevel()}" data-mz-mic-volume aria-label="${mzT("我的聲音", "My voice")}"><span>${micLevel()}%</span></label><label class="mz-ai-volume">${mzT("對方的聲音", "Their voice")} <input type="range" min="0" max="300" step="10" value="${peerLevel()}" data-mz-peer-volume aria-label="${mzT("對方的聲音", "Their voice")}"><span>${peerLevel()}%</span></label></div>`;
  const peerScreen = callScreen;
  callScreen = function (...args) {
    const r = peerScreen.apply(this, args);
    if (VoiceUI.rtc && !VoiceUI.ai && callOverlay && !callOverlay.querySelector(".mz-call-volumes")) callOverlay.insertAdjacentHTML("beforeend", humanSlider());
    return r;
  };
  document.addEventListener("input", (e) => {
    const m = e.target.closest?.("[data-mz-mic-volume]"), q = e.target.closest?.("[data-mz-peer-volume]");
    if (m) { window.mzSetMicLevel(+m.value); const l = m.nextElementSibling; if (l) l.textContent = m.value + "%"; }
    if (q) { window.mzSetPeerLevel(+q.value); const l = q.nextElementSibling; if (l) l.textContent = q.value + "%"; }
  });
}

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
      callOverlay.insertAdjacentHTML("afterbegin", `<button class="mz-top-btn mz-dmin-btn" data-action="mzDeskCallMin" aria-label="${mzT("縮小，背景通話", "Minimize")}" title="${mzT("縮小", "Minimize")}">${mzSvg("pip")}</button>`);
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

/* ------------------------------------------------------------------ */
/* Search (3.0.9):                                                     */
/* 1) The in-chat search entry vanished when a later release replaced  */
/*    actions.chatOptions with the global wrapper chain, whose sheet   */
/*    has no search button. Put the button back on every chat sheet.   */
/* 2) The chat-list search only filtered chat titles. Add a real        */
/*    results section: message-content matches across AI and human     */
/*    chats; tapping one opens the chat and jumps to the message.      */
/* ------------------------------------------------------------------ */
{
  const priorChatOptions = actions.chatOptions;
  if (typeof priorChatOptions === "function" && typeof actions.searchThisChat === "function") {
    actions.chatOptions = () => {
      priorChatOptions();
      const sheet = document.querySelector(".sheet");
      if (!sheet) return;
      const danger = sheet.querySelector('[data-action="deleteChat"]');
      const put = (html) => {
        if (danger) danger.insertAdjacentHTML("beforebegin", html);
        else sheet.insertAdjacentHTML("beforeend", html);
      };
      /* The poke settings + Moments/status permissions buttons vanished the
         same way (their wrapper hung off actions.chatOptions and was dropped
         when the global chain took over). Put them back on every chat sheet. */
      if (!sheet.querySelector('[data-action="configurePoke"]'))
        put(`<button class="setting-choice full" data-action="configurePoke">${mzT("拍一拍設定", "Poke settings")}　›</button>`);
      if (!sheet.querySelector('[data-action="chatPermissions"]'))
        put(`<button class="setting-choice full" data-action="chatPermissions">${mzT("朋友圈與狀態權限", "Moments & status permissions")}　›</button>`);
      if (!sheet.querySelector('[data-action="searchThisChat"]'))
        put(`<button class="setting-choice full" data-action="searchThisChat">${mzT("搜尋聊天記錄", "Search chat history")}　›</button>`);
    };
  }
}
{
  const priorChatsView = chatsView;
  const snippet = (text, q) => {
    const t = String(text || "");
    const i = t.toLowerCase().indexOf(q);
    if (i < 0) return esc(t.slice(0, 60));
    const a = Math.max(0, i - 18),
      b = Math.min(t.length, i + q.length + 26);
    return (a ? "…" : "") + esc(t.slice(a, i)) + "<mark>" + esc(t.slice(i, i + q.length)) + "</mark>" + esc(t.slice(i + q.length, b)) + (b < t.length ? "…" : "");
  };
  chatsView = function () {
    const html = priorChatsView();
    const q = (typeof search === "string" ? search : "").trim().toLowerCase();
    if (!q || !state) return html;
    const groups = [];
    for (const ch of state.chats || []) {
      const hits = (ch.messages || []).filter((m) => String(m.text || "").toLowerCase().includes(q));
      if (hits.length) groups.push({ id: ch.id, name: title(ch), hits });
    }
    try {
      const h = humanData(),
        byPeer = new Map();
      for (const m of h.messages || []) {
        if (!String(m.text || "").toLowerCase().includes(q)) continue;
        const peer = m.sender === h.me?.id ? m.recipient : m.sender;
        if (!peer || peer === h.me?.id) continue;
        if (!byPeer.has(peer)) byPeer.set(peer, []);
        byPeer.get(peer).push(m);
      }
      for (const [peer, hits] of byPeer) groups.push({ id: "human:" + peer, name: h.friends.find((f) => f.id === peer)?.name || peer, hits });
    } catch {}
    if (!groups.length) return html;
    groups.sort((a, b) => (b.hits.at(-1)?.time || 0) - (a.hits.at(-1)?.time || 0));
    const total = groups.reduce((n, g) => n + g.hits.length, 0);
    const rows = groups
      .slice(0, 15)
      .map((g) => {
        const last = g.hits.at(-1);
        return `<button class="chat-row" data-chat="${esc(g.id)}" data-jumpmessage="${esc(last.id)}"><div class="chat-info"><h3><span>${esc(g.name)}</span><time class="time">${ago(last.time || 0)}</time></h3><p>${snippet(last.text, q)}</p></div><span class="badge">${g.hits.length}</span></button>`;
      })
      .join("");
    return html + `<div class="content"><h3 class="small" style="margin:10px 2px 6px">${mzT("聊天記錄", "Chat history")} · ${total} ${mzT("則相符", "matches")}</h3>${rows}</div>`;
  };
}

/* ------------------------------------------------------------------ */
/* Official releases, live (3.0.9): release posts used to be baked     */
/* into each build, so old installs never saw new announcements. Now   */
/* the server serves them (GET /v1/releases) and this client merges    */
/* any post it hasn't seen into the official account's Moments — so    */
/* from 3.0.9 on, every future announcement reaches older installs     */
/* too. The same check powers the once-per-launch update prompt: the  */
/* app stays fully usable on the old version, it just offers the       */
/* update each time it opens.                                          */
/* ------------------------------------------------------------------ */
{
  const newer = (a, b) => {
    const pa = String(a).split(".").map(Number),
      pb = String(b).split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
    }
    return false;
  };
  let releaseChecked = false;
  const mergeServerReleases = async () => {
    if (releaseChecked || !state?.settings) return;
    releaseChecked = true;
    let base = "";
    try {
      base = officialServiceBase();
    } catch {
      return;
    }
    // Update prompt (once per launch).
    try {
      const cfg = await (await fetch(base + "/v1/config")).json();
      if (cfg?.version && window.MIZUKI_APP_VERSION && newer(cfg.version, window.MIZUKI_APP_VERSION) && !document.querySelector(".sheet")) {
        window.__mzSupportUrl = cfg.supportUrl || "";
        showModal(
          mzT("有新版本囉", "A new version is out"),
          `<p class="help">${mzT("沐水 " + cfg.version + " 已推出！新版本修了問題也帶來新功能。舊版本仍可繼續使用，只是新功能要更新後才能用。", "Mizuki " + cfg.version + " is out, with fixes and new features. This version still works — new features just need the update.")}</p><button class="pill primary full" data-action="mzGoUpdate">${mzT("前往更新", "Update now")}</button><button class="link-button full" data-action="closeModal">${mzT("下次再說", "Later")}</button>`
        );
      }
    } catch {}
    // Merge any release posts this install hasn't seen into Moments.
    try {
      const data = await (await fetch(base + "/v1/releases")).json();
      const posts = Array.isArray(data?.posts) ? data.posts : [];
      if (!posts.length) return;
      let seen = [];
      try {
        seen = JSON.parse(localStorage.getItem("mizuki-server-releases") || "[]");
      } catch {}
      const fresh = posts.filter((p) => p?.version && !seen.includes(p.version));
      if (!fresh.length) return;
      await WebEngine.edit((s) => {
        if (!Array.isArray(s.moments)) s.moments = [];
        for (const post of fresh) {
          if (s.moments.some((m) => m.releaseVersion === post.version)) continue;
          s.moments.push({ id: "release-" + post.version, author: "official-mushui", text: mzT(post.zh || "", post.en || post.zh || ""), time: Date.parse(post.date || "") || Date.now(), images: [], comments: [], release: true, releaseVersion: post.version, official: true });
        }
        s.moments.sort((a, b) => (a.time || 0) - (b.time || 0));
      });
      try {
        localStorage.setItem("mizuki-server-releases", JSON.stringify([...new Set([...seen, ...fresh.map((p) => p.version)])]));
      } catch {}
      if (typeof render === "function" && tab === "moments") render();
    } catch {}
  };
  actions.mzGoUpdate = () => {
    const url = window.__mzSupportUrl || "";
    closeModal();
    if (url) window.open(url, "_blank");
    else toast(mzT("請到官方帳號的聊天室取得最新版本下載連結。", "Get the latest download link from the official account's chat."), 2600);
  };
  setTimeout(mergeServerReleases, 4000);
  setTimeout(() => {
    if (!releaseChecked) mergeServerReleases();
  }, 25000);
  setTimeout(() => {
    if (!releaseChecked) mergeServerReleases();
  }, 70000);
}

/* Message windowing (3.1.6 fix round): chat views render only the most
   recent messages (see mzMsgSlice in app.js); this expands the window. */
actions.mzEarlierMessages = () => {
  const sc = document.querySelector(".message-scroll"),
    h0 = sc ? sc.scrollHeight : 0,
    t0 = sc ? sc.scrollTop : 0;
  window.mzMsgWin[chatId] = (window.mzMsgWin[chatId] || 60) + 60;
  render();
  const sc2 = document.querySelector(".message-scroll");
  if (sc2) sc2.scrollTop = t0 + (sc2.scrollHeight - h0);
};

/* Discord-style image viewer (3.1.7): full-screen dark viewer modelled on
   Discord's — ✕ top-left, a ⋮ menu top-right (save / forward / share /
   open in browser / jump to message), sender + time and a react button
   along the bottom. The gallery is built from state, so it covers EVERY
   photo in the conversation (not just the rendered window, and not just
   the tapped message); opened outside a chat it covers the Moments feed.
   Android back closes the menu first, then the viewer. */
{
  let items = [], idx = 0, el = null, imgEl = null, menuEl = null, touchX = null, lastBtn = null;
  document.addEventListener("pointerdown", (e) => {
    const b = e.target.closest?.(".photos [data-photo]");
    if (b) lastBtn = b;
  }, true);
  const fmtWhen = (ts) => {
    if (!ts) return "";
    const d = new Date(ts);
    return mzT(`${d.getMonth() + 1}月${d.getDate()}日 `, `${d.getMonth() + 1}/${d.getDate()} `) + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
  };
  const collectChat = () => {
    const out = [];
    try {
      if (chatId.startsWith("human:")) {
        const peer = chatId.slice(6), h = humanData();
        for (const m of h.messages) {
          if (m.sender !== peer && m.recipient !== peer) continue;
          const who = m.sender === peer ? humanFriend(peer) : h.me;
          for (const src of m.images || []) out.push({ src, mid: "human-" + m.id, rawMid: m.id, who, time: m.time, chat: true });
        }
      } else if (chatId.startsWith("hgroup:")) {
        const gid = chatId.slice(7), g = typeof MizukiGroups !== "undefined" ? MizukiGroups.data.groups.find((x) => x.id === gid) : null;
        for (const m of typeof MizukiGroups !== "undefined" ? MizukiGroups.data.messages : []) {
          if (m.gid !== gid) continue;
          const who = m.sender === humanData().me?.id ? humanData().me : (g?.members || []).find((p) => p.id === m.sender) || { name: m.sender };
          for (const src of m.images || []) out.push({ src, mid: "hg-" + m.id, rawMid: m.id, who, time: m.time, chat: true });
        }
      } else {
        const ch = state.chats.find((c) => c.id === chatId);
        if (ch) for (const m of ch.messages) {
          const who = person(m.author);
          for (const src of m.images || []) out.push({ src, mid: String(m.id), rawMid: m.id, who, time: m.time, chat: true });
        }
      }
    } catch {}
    return out;
  };
  const collectMoments = () => {
    const out = [];
    try {
      for (const p of state.moments.slice().sort((a, b) => b.time - a.time)) {
        const who = person(p.author);
        for (const src of p.images || []) out.push({ src, mid: "", rawMid: "", who, time: p.time, chat: false });
      }
    } catch {}
    return out;
  };
  const build = () => {
    el = document.createElement("div");
    el.className = "mz-lightbox";
    el.hidden = true;
    el.innerHTML = `<img alt=""><button class="mz-lb-close" aria-label="Close">✕</button><button class="mz-lb-dots" aria-label="More">⋮</button><div class="mz-lb-menu" hidden>
      <button data-lb="save">${icon("import")}${mzT("儲存", "Save")}</button>
      <button data-lb="forward">${icon("send")}${mzT("轉發", "Forward")}</button>
      <button data-lb="share"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4m0 0L8 8m4-4 4 4M5 13v7h14v-7"/></svg>${mzT("分享", "Share")}</button>
      <button data-lb="browser"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M3 12h18 M12 3c2.5 2.6 3.9 5.7 3.9 9s-1.4 6.4-3.9 9c-2.5-2.6-3.9-5.7-3.9-9S9.5 5.6 12 3z"/></svg>${mzT("在瀏覽器開啟", "Open in browser")}</button>
      <button data-lb="jump">${icon("chat")}${mzT("跳至訊息", "Jump to message")}</button>
    </div><button class="mz-lb-prev" aria-label="Previous">‹</button><button class="mz-lb-next" aria-label="Next">›</button><div class="mz-lb-bottom"><span class="mz-lb-who"></span><button class="mz-lb-react">${icon("smile")}${mzT("反應", "React")}</button><span class="mz-lb-count"></span></div>`;
    document.body.appendChild(el);
    imgEl = el.querySelector("img");
    menuEl = el.querySelector(".mz-lb-menu");
    el.querySelector(".mz-lb-close").onclick = () => showLb(null);
    el.querySelector(".mz-lb-dots").onclick = (e) => { e.stopPropagation(); menuEl.hidden = !menuEl.hidden; };
    el.querySelector(".mz-lb-prev").onclick = (e) => { e.stopPropagation(); step(-1); };
    el.querySelector(".mz-lb-next").onclick = (e) => { e.stopPropagation(); step(1); };
    el.querySelector(".mz-lb-react").onclick = () => reactTo();
    menuEl.addEventListener("click", (e) => {
      const b = e.target.closest("[data-lb]");
      if (!b) return;
      const act = b.dataset.lb;
      menuEl.hidden = true;
      if (act === "save") saveImageToLibrary();
      else if (act === "forward") forwardIt();
      else if (act === "share") shareIt();
      else if (act === "browser") openInBrowser();
      else if (act === "jump") jumpTo();
    });
    el.addEventListener("click", (e) => { if (e.target === el) showLb(null); });
    el.addEventListener("touchstart", (e) => { touchX = e.touches[0]?.clientX ?? null; }, { passive: true });
    el.addEventListener("touchend", (e) => {
      if (touchX == null) return;
      const dx = (e.changedTouches[0]?.clientX ?? touchX) - touchX;
      touchX = null;
      if (Math.abs(dx) > 42) step(dx < 0 ? 1 : -1);
    }, { passive: true });
  };
  const step = (d) => { idx = Math.min(items.length - 1, Math.max(0, idx + d)); paint(); };
  const paint = () => {
    const it = items[idx];
    if (!it) return;
    imgEl.src = it.src;
    try { photoToSave = it.src; } catch {}
    el.querySelector(".mz-lb-who").innerHTML = it.who ? `${avatar(it.who)}<span class="mz-lb-meta"><span class="mz-lb-name">${esc(it.who.name || "")}</span><span class="mz-lb-time">${esc(fmtWhen(it.time))}</span></span>` : "";
    el.querySelector(".mz-lb-count").textContent = items.length > 1 ? (idx + 1) + " / " + items.length : "";
    el.querySelector(".mz-lb-prev").style.visibility = idx > 0 ? "" : "hidden";
    el.querySelector(".mz-lb-next").style.visibility = idx < items.length - 1 ? "" : "hidden";
    el.querySelector(".mz-lb-react").hidden = !it.chat;
    const canBrowser = /^https?:\/\//.test(it.src);
    for (const b of menuEl.querySelectorAll("[data-lb]")) {
      const act = b.dataset.lb;
      b.style.display = act === "save" || act === "share" ? "" : act === "browser" ? (canBrowser ? "" : "none") : it.chat ? "" : "none";
    }
  };
  function showLb(list, start) {
    if (!el) build();
    if (!list) {
      el.hidden = true;
      menuEl.hidden = true;
      document.body.style.overflow = "";
      return;
    }
    items = list;
    idx = Math.min(Math.max(0, start || 0), list.length - 1);
    menuEl.hidden = true;
    el.hidden = false;
    document.body.style.overflow = "hidden";
    paint();
  }
  window.mzOpenLightbox = showLb;
  const closeLb = () => showLb(null);
  const jumpTo = () => {
    const it = items[idx];
    if (!it?.mid) return;
    const sel = `[data-message-id="${it.mid}"]`;
    closeLb();
    let row = document.querySelector(sel);
    let guard = 0;
    while (!row && it.chat && guard++ < 15) {
      window.mzMsgWin[chatId] = (window.mzMsgWin[chatId] || 60) + 120;
      render();
      row = document.querySelector(sel);
    }
    if (row) {
      row.scrollIntoView({ block: "center", behavior: "smooth" });
      row.classList.add("mz-flash");
      setTimeout(() => row.classList.remove("mz-flash"), 1600);
    }
  };
  const reactTo = () => {
    const it = items[idx];
    if (!it?.chat) return;
    closeLb();
    try { messageMenuId = it.rawMid; } catch {}
    if (typeof mzReactionPicker === "function") mzReactionPicker(it.rawMid);
  };
  const forwardIt = () => {
    const it = items[idx];
    if (!it?.chat) return;
    closeLb();
    try { messageMenuId = it.rawMid; } catch {}
    actions.forwardMessage?.();
  };
  const shareIt = async () => {
    const it = items[idx];
    try {
      const blob = await (await fetch(it.src)).blob();
      const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
      const file = new File([blob], "mizuki-photo." + ext, { type: blob.type || "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }); return; }
      if (navigator.share) { await navigator.share({ url: it.src }); return; }
      toast(mzT("此裝置不支援分享", "Sharing is not supported on this device"));
    } catch (e) { if (e?.name !== "AbortError") toast(e?.message || mzT("分享失敗", "Share failed")); }
  };
  const openInBrowser = () => {
    const it = items[idx];
    if (!/^https?:\/\//.test(it.src)) return;
    closeLb();
    if (window.MushuiDesktop || window.AndroidHost) Desktop.invoke("openLink", { url: it.src, browser: state.settings.defaultBrowser || "system" }).catch((err) => toast(err.message || mzT("無法開啟瀏覽器", "Could not open a browser")));
    else window.open(it.src, "_blank", "noopener,noreferrer");
  };
  photoSheet = function (image) {
    try { photoToSave = image; } catch {}
    const inChat = !!document.querySelector(".conversation");
    let list = inChat ? collectChat() : collectMoments();
    if (!list.length) list = [{ src: image, mid: "", rawMid: "", who: null, time: 0, chat: false }];
    let start = list.findIndex((i) => i.src === image);
    if (lastBtn && inChat) {
      const row = lastBtn.closest("[data-message-id]");
      if (row) {
        const btns = [...row.querySelectorAll("[data-photo]")];
        const k = btns.indexOf(lastBtn);
        const first = list.findIndex((i) => i.mid === row.dataset.messageId);
        if (first >= 0 && k >= 0 && list[first + k]?.src === image) start = first + k;
        else if (first >= 0 && k >= 0 && list[first + k]) start = first + k;
      }
      lastBtn = null;
    }
    showLb(list, Math.max(0, start));
  };
  document.addEventListener("keydown", (e) => {
    if (!el || el.hidden) return;
    if (e.key === "Escape") { if (!menuEl.hidden) menuEl.hidden = true; else closeLb(); }
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
  });
  const goBackBeforeLb = window.goBack;
  window.goBack = function () {
    if (el && !el.hidden) {
      if (menuEl && !menuEl.hidden) { menuEl.hidden = true; return true; }
      closeLb();
      return true;
    }
    return goBackBeforeLb ? goBackBeforeLb() : false;
  };
}

/* Hang-up duration (3.1.7): when you end a connected call, say how long it
   lasted — the chat notice already carries it, but at hang-up time you are
   looking at the call screen, not the chat. */
{
  const durToast = (started) => {
    if (!started || !window.mzCallDuration) return;
    const sec = (Date.now() - started) / 1000;
    if (sec >= 1) toast(mzT("通話結束 · 本次通話時長 ", "Call ended · Duration ") + window.mzCallDuration(sec), 3600);
  };
  const endHuman0 = actions.endHumanCall;
  if (typeof endHuman0 === "function")
    actions.endHumanCall = async (...args) => {
      const c = window.VoiceUI?.rtc, started = c?.connected ? c.connectedAt || 0 : 0;
      const r = await endHuman0(...args);
      durToast(started);
      return r;
    };
  const nativeEvent0 = window.mushuiNativeCallEvent;
  window.mushuiNativeCallEvent = (event) => {
    if (event && ["connected", "active", "通話中"].includes(event.status) && !window.__mzNativeConnectedAt) window.__mzNativeConnectedAt = Date.now();
    if (event && ["ended", "結束"].includes(event.status)) window.__mzNativeConnectedAt = 0;
    if (nativeEvent0) return nativeEvent0(event);
  };
  const endNative0 = actions.endNativeCall;
  if (typeof endNative0 === "function")
    actions.endNativeCall = async (...args) => {
      const started = window.__mzNativeConnectedAt || 0;
      const r = await endNative0(...args);
      window.__mzNativeConnectedAt = 0;
      durToast(started);
      return r;
    };
}
