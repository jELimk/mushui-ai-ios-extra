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
/* 3.2.0: the user picks the call quality — 720p30 or 1080p60 — and it
   applies to camera and screen senders alike. */
window.mzCallQuality = () => {
  try { return localStorage.getItem("mzCallQuality") === "1080p60" ? "1080p60" : "720p30"; } catch { return "720p30"; }
};
window.mzQualityProfile = () =>
  window.mzCallQuality() === "1080p60"
    ? { w: 1920, h: 1080, fps: 60, bitrate: 6000000, screenBitrate: 9000000, label: "1080p · 60" }
    : { w: 1280, h: 720, fps: 30, bitrate: 2800000, screenBitrate: 3500000, label: "720p · 30" };
async function mzTuneVideoSender(sender, track) {
  const screen = VoiceUI.rtc?.screen?.sender === sender,
    q = window.mzQualityProfile();
  try {
    track.contentHint = screen ? "detail" : "motion";
  } catch {}
  try {
    await track.applyConstraints({ width: { ideal: q.w }, height: { ideal: q.h }, frameRate: { ideal: q.fps } });
  } catch {}
  const params = sender.getParameters();
  if (!params.encodings?.length) return;
  for (const e of params.encodings) {
    e.maxBitrate = screen ? q.screenBitrate : q.bitrate;
    e.maxFramerate = q.fps;
    e.scaleResolutionDownBy = 1;
  }
  params.degradationPreference = "maintain-resolution";
  await sender.setParameters(params);
}
window.mzApplyCallQuality = () => {
  const c = window.VoiceUI?.rtc;
  if (c?.pc) for (const sender of c.pc.getSenders()) if (sender.track?.kind === "video") mzTuneVideoSender(sender, sender.track).catch(() => {});
  toast(mzT("通話畫質：", "Call quality: ") + window.mzQualityProfile().label, 1600);
};
actions.mzQuality = () => {
  const next = window.mzCallQuality() === "1080p60" ? "720p30" : "1080p60";
  try { localStorage.setItem("mzCallQuality", next); } catch {}
  window.mzApplyCallQuality();
  if (typeof mzCallRender === "function") mzCallRender();
};
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
  const older = (p) => (p.author === "official-mushui" || p.id?.startsWith("official-release-") || p.release) && !keep.has(p.id);
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
// 3.1.8: the event time ALSO travels as epoch ms (starAt, in the message
// metadata), and receivers render the clock from that epoch in their own
// timezone — the baked "HH:MM" is only a fallback for older senders.
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
async function mzStarToAI(aiId, text, client, starAt) {
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
      if (c && !c.messages.some((m) => m.clientMessageId === client)) WebEngine.append(c, "me", text, { starEvent: true, clientMessageId: client, ...(starAt ? { starAt } : {}) });
    });
  // The AI reads the notice like any message and replies in character.
  const r = await call("send", { id: chat.id, retry: true });
  if (r?.state) state = r.state;
}
async function mzStarToHuman(peer, text, client, starAt) {
  if (!state.human?.connected) throw Error("尚未登入好友帳號");
  await call("human", { action: "send", id: peer, text, clientMessageId: client, starEvent: true, starAt: starAt || null });
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
      const when = Date.now();
      if (type === "ai") await mzStarToAI(who, mzStarText(detail, undefined, when), "device-" + id + "-" + who, when);
      else if (type === "human") await mzStarToHuman(who, mzStarText(detail, undefined, when), "device-" + id + "-" + who, when);
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
              await mzStarToAI(target.slice(3), mzStarText(e.detail, undefined, e.time), "device-" + e.id + "-" + target.slice(3), e.time);
            } else if (target.startsWith("human:")) {
              // The native service messages human stars first; the page
              // only steps in when that hasn't happened shortly after.
              if (Date.now() - (e.time || 0) < 90000) continue;
              await mzStarToHuman(target.slice(6), mzStarText(e.detail, undefined, e.time), "device-" + e.id + "-" + target.slice(6), e.time);
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
function mzStarLine(text, en, starAt) {
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
  // 3.1.8: with the event epoch present, the clock is rendered in the
  // VIEWER's timezone; the HH:MM baked into the text is the sender's
  // local time and is only a fallback for stars sent by older versions.
  let hh = null,
    mm = null;
  if (Number.isFinite(starAt) && starAt > 0) {
    const d = new Date(starAt);
    hh = d.getHours();
    mm = String(d.getMinutes()).padStart(2, "0");
  } else if (m[3] !== undefined) {
    hh = +m[3];
    mm = m[4];
  }
  if (hh !== null) line += " · " + (en ? (hh % 12 || 12) + ":" + mm + " " + (hh < 12 ? "AM" : "PM") : String(hh).padStart(2, "0") + ":" + mm);
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
// 3.1.8: human → human avatar invites get the same card as AI invites
// (and as relationship invites): portraits, headline, one-tap 同意.
function mzHumanInviteCard(m) {
  const inv = m.imageInvite;
  if (!inv || inv.target !== "avatar") return "";
  const h = humanData(),
    meP = { name: h.me?.name || "我", avatar: h.me?.avatar || "" },
    mine = m.sender === h.me?.id,
    sender = mine ? meP : humanFriend(m.sender),
    recipient = mine ? humanFriend(m.recipient) : meP,
    face = (p) => `<span class="mizuki-rel-avatar">${avatar(p || {})}</span>`;
  let status;
  if (inv.status === "pending")
    status = mine
      ? `<p class="mizuki-rel-status">${mzT("等待對方回覆", "Waiting for their reply")}</p>`
      : `<div class="sheet-actions"><button class="pill primary" data-hinvite-accept="${esc(m.id)}">${mzT("同意", "Agree")}</button><button class="pill" data-hinvite-custom="${esc(m.id)}">${mzT("自己選圖", "Choose my own")}</button><button class="pill" data-hinvite-dismiss="${esc(m.id)}">${mzT("暫時不用", "Not now")}</button></div>`;
  else if (inv.status === "accepted") status = `<p class="mizuki-rel-status">${mine ? mzT("對方已更換頭像", "They changed their profile photo") : mzT("已更換", "Changed")}</p>`;
  else status = `<p class="mizuki-rel-status">${mine ? mzT("對方暫時沒有更換", "They didn't change it this time") : mzT("這次先不換", "Skipped this time")}</p>`;
  const line = mine ? mzT("您邀請了", "You invited ") + esc(recipient.name) + mzT("更換頭像", " to change their profile photo") : esc(sender.name) + mzT("邀請你更換頭像", " invites you to change your profile photo");
  return `<section class="relationship-request-card mz-invite-card"><div class="mizuki-rel-portraits">${face(sender)}${face(recipient)}</div><b class="mizuki-rel-line">${line}</b><p>${mzT("由你決定，點「同意」就會直接換上這張圖片。", "It's your call — tap Agree and this picture is applied right away.")}</p><small>${mzT("更換後，好友看到的會是新頭像", "After the change, friends see the new photo")}</small>${status}</section>`;
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
      if (human && m.imageInvite?.target === "avatar") {
        const irow = document.querySelector(`[data-message-id="human-${CSS.escape(String(m.id))}"]`),
          ibubble = irow?.querySelector(".bubble");
        if (ibubble && !ibubble.querySelector(".mz-invite-card")) ibubble.insertAdjacentHTML("beforeend", mzHumanInviteCard(m));
      }
      const star = mzStarLine(m.text, en, m.starAt),
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
  const where = () => ({ tab, page, chatId, listenBig: !!window.mzListenExpanded?.() }),
    key = (w) => [w.tab, w.page, w.chatId, w.listenBig].join("|"),
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
      window.mzListenSetExpanded?.(next.listenBig);
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
      /* The Moments/status permissions button vanished the same way (its
         wrapper hung off actions.chatOptions and was dropped when the global
         chain took over). Put it back on every chat sheet. (3.1.8: the poke
         settings button is NOT re-inserted here — it moved to
         我 → 設定 → 通知 → 聊天 for good.) */
      if (!sheet.querySelector('[data-action="chatPermissions"]'))
        put(`<button class="setting-choice full" data-action="chatPermissions">${mzT("朋友圈與狀態權限", "Moments & status permissions")}　›</button>`);
      if (chatId.startsWith("human:") && chatId !== "human:" + MIZUKI_OFFICIAL_ID && !sheet.querySelector('[data-action="mzInviteAvatar"]'))
        put(`<button class="setting-choice full" data-action="mzInviteAvatar">${mzT("邀請對方換頭像", "Invite them to change their photo")}　›</button>`);
      if (chatId.startsWith("human:") && (window.MzGuardianOf || []).includes(chatId.slice(6)) && !sheet.querySelector('[data-action="mzGuardianLock"]'))
        put(`<button class="setting-choice full" data-action="mzGuardianLock">${mzT("鎖定對方 App（家長模式）", "Lock their apps (parental mode)")}　›</button>`);
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
          if (MZ_RELEASES.some((r) => r.version === post.version) || s.moments.some((m) => m.releaseVersion === post.version)) continue;
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
        for (const src of p.images || []) out.push({ src, mid: "", rawMid: "", who, time: p.time, chat: false, caption: p.text || "" });
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
    </div><button class="mz-lb-prev" aria-label="Previous">‹</button><button class="mz-lb-next" aria-label="Next">›</button><div class="mz-lb-caption" hidden></div><div class="mz-lb-bottom"><span class="mz-lb-who"></span><button class="mz-lb-react">${icon("smile")}${mzT("反應", "React")}</button><span class="mz-lb-count"></span></div>`;
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
      if (act === "save") saveIt();
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
  let lbDir = 0;
  const step = (d) => { const n = Math.min(items.length - 1, Math.max(0, idx + d)); if (n !== idx) lbDir = d; idx = n; paint(); };
  const paint = () => {
    const it = items[idx];
    if (!it) return;
    imgEl.src = it.src;
    if (lbDir && imgEl.animate) {
      try { imgEl.animate([{ opacity: 0.25, transform: `translateX(${lbDir * 44}px)` }, { opacity: 1, transform: "translateX(0)" }], { duration: 260, easing: "ease-out" }); } catch {}
    }
    lbDir = 0;
    const cap = el.querySelector(".mz-lb-caption");
    if (cap) { cap.textContent = it.caption || ""; cap.hidden = !it.caption; }
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
  const saveIt = async () => {
    const it = items[idx];
    if (!it) return;
    try {
      let src = it.src;
      if (!src.startsWith("data:image/")) {
        const blob = await (await fetch(src)).blob();
        src = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }
      if (await saveImageToLibrary(src, "沐水照片.jpg")) toast("照片已保存");
    } catch (e) {
      if (e.name !== "AbortError") toast(e.message || "保存照片失敗");
    }
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
    if (window.__mzDurToastKey === started && Date.now() - (window.__mzDurToastAt || 0) < 10000) return;
    const sec = (Date.now() - started) / 1000;
    if (sec >= 1) { window.__mzDurToastKey = started; window.__mzDurToastAt = Date.now(); toast(mzT("通話結束 · 本次通話時長 ", "Call ended · Duration ") + window.mzCallDuration(sec), 3600); }
  };
  window.mzCallDurationToast = durToast;
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
    if (event && ["ended", "結束"].includes(event.status)) {
      const startedAt = window.__mzNativeConnectedAt || 0;
      window.__mzNativeEndedFrom = startedAt;
      const localEnded = !!(window.VoiceUI && VoiceUI.nativeCall && VoiceUI.nativeCall.ended);
      window.__mzNativeConnectedAt = 0;
      const rr = nativeEvent0 ? nativeEvent0(event) : undefined;
      if (!localEnded) durToast(startedAt);
      return rr;
    }
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

/* ------------------------------------------------------------------ */
/* 3.1.8: human avatar invites — sending, and answering with one tap.  */
/* ------------------------------------------------------------------ */
actions.mzInviteAvatar = async () => {
  if (!isHumanChat()) return;
  const peer = chatId.slice(6),
    image = await (window.mzPickAvatar || pickImage)();
  if (!image) return;
  await call("human", { action: "send", id: peer, text: "想邀請你試試這張頭像，喜歡再換。", images: [image], imageInvite: { target: "avatar" }, clientMessageId: crypto.randomUUID() });
  state = await call("load");
  closeModal();
  render();
  toast(mzT("邀請已送出", "Invitation sent"));
};
document.addEventListener("click", async (e) => {
  const acc = e.target.closest("[data-hinvite-accept]"),
    cus = e.target.closest("[data-hinvite-custom]"),
    dis = e.target.closest("[data-hinvite-dismiss]"),
    b = acc || cus || dis;
  if (!b || b.disabled) return;
  const mid = acc?.dataset.hinviteAccept || cus?.dataset.hinviteCustom || dis?.dataset.hinviteDismiss,
    m = humanData().messages.find((x) => String(x.id) === String(mid));
  if (!m?.imageInvite || m.imageInvite.status !== "pending") return;
  b.disabled = true;
  try {
    if (dis) {
      await call("human", { action: "imageInvite", messageId: mid, accept: false });
      state = await call("load");
      toast(mzT("這次先不換", "Skipped this time"));
    } else {
      const image = cus ? await (window.mzPickAvatar || pickImage)() : m.images?.[0];
      if (!image) return;
      await call("human", { action: "imageInvite", messageId: mid, accept: true });
      // Apply it as MY avatar and push the profile, like the AI-invite flow.
      await mutate("settings", { settings: { ...state.settings, avatar: image } });
      state = await call("load");
      try {
        await humanCall({ action: "profile", name: state.settings.nickname || "我", avatar: image });
      } catch {}
      toast(mzT("頭像已更換", "Profile photo changed"));
    }
    render();
  } catch (err) {
    toast(err.message);
  } finally {
    b.disabled = false;
  }
});

/* ------------------------------------------------------------------ */
/* 3.1.8: avatar uploads can be cropped (square) before saving. The   */
/* cropper is an overlay, not a sheet, so it also works above modals. */
/* ------------------------------------------------------------------ */
{
  const st = document.createElement("style");
  st.textContent = `.mz-crop-overlay{position:fixed;inset:0;z-index:3000;background:#0d0a12b8;display:flex;align-items:center;justify-content:center;padding:18px}.mz-crop-card{background:var(--surface,#fff);color:var(--ink);border-radius:22px;padding:18px;width:min(340px,94vw);box-shadow:0 18px 50px #0006}.mz-crop-card h3{margin:2px 0 10px}.mz-crop-stage{position:relative;width:min(280px,76vw);aspect-ratio:1;margin:4px auto 12px;overflow:hidden;border-radius:18px;background:#000;touch-action:none;cursor:grab}.mz-crop-stage img{position:absolute;left:0;top:0;max-width:none;user-select:none;-webkit-user-drag:none;pointer-events:none}.mz-crop-card input[type=range]{width:100%}`;
  document.head.append(st);
}
window.mzPickAvatar = async () => {
  const raw = await pickImage();
  if (!raw) return null;
  return await new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const finish = (v) => {
      if (settled) return;
      settled = true;
      overlay.remove();
      resolve(v);
    };
    const overlay = document.createElement("div");
    overlay.className = "mz-crop-overlay";
    overlay.innerHTML = `<div class="mz-crop-card"><h3>${mzT("裁剪頭像", "Crop photo")}</h3><div class="mz-crop-stage"><img alt=""></div><label>${mzT("縮放", "Zoom")}</label><input type="range" min="100" max="300" value="100"><p class="help">${mzT("拖動圖片選擇要保留的範圍，完成後會存成正方形頭像。", "Drag to choose the area to keep; it is saved as a square photo.")}</p><div class="sheet-actions"><button class="pill" data-crop="cancel">${mzT("取消", "Cancel")}</button><button class="pill primary" data-crop="done">${mzT("完成", "Done")}</button></div></div>`;
    img.onload = () => {
      document.body.append(overlay);
      const stage = overlay.querySelector(".mz-crop-stage"),
        im = overlay.querySelector("img"),
        S = stage.clientWidth || 280,
        base = Math.max(S / img.naturalWidth, S / img.naturalHeight),
        s = { z: 1, x: (S - img.naturalWidth * base) / 2, y: (S - img.naturalHeight * base) / 2 };
      im.src = raw;
      const clamp = () => {
        const w = img.naturalWidth * base * s.z,
          h = img.naturalHeight * base * s.z;
        s.x = Math.min(0, Math.max(S - w, s.x));
        s.y = Math.min(0, Math.max(S - h, s.y));
      };
      const draw = () => {
        im.style.width = img.naturalWidth * base * s.z + "px";
        im.style.height = img.naturalHeight * base * s.z + "px";
        im.style.transform = `translate(${s.x}px,${s.y}px)`;
      };
      clamp();
      draw();
      overlay.querySelector("input[type=range]").oninput = (e) => {
        const nz = +e.target.value / 100,
          cx = (S / 2 - s.x) / s.z,
          cy = (S / 2 - s.y) / s.z;
        s.z = nz;
        s.x = S / 2 - cx * nz;
        s.y = S / 2 - cy * nz;
        clamp();
        draw();
      };
      let drag = null;
      const dragStart = (cx, cy) => { drag = { x: cx - s.x, y: cy - s.y }; };
      const dragMove = (cx, cy) => {
        if (!drag) return;
        s.x = cx - drag.x;
        s.y = cy - drag.y;
        clamp();
        draw();
      };
      stage.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        dragStart(e.clientX, e.clientY);
        try { stage.setPointerCapture(e.pointerId); } catch {}
      });
      stage.addEventListener("pointermove", (e) => dragMove(e.clientX, e.clientY));
      stage.addEventListener("pointerup", () => (drag = null));
      stage.addEventListener("pointercancel", () => (drag = null));
      stage.addEventListener("touchstart", (e) => { const t = e.touches[0]; if (t) dragStart(t.clientX, t.clientY); }, { passive: true });
      stage.addEventListener("touchmove", (e) => { const t = e.touches[0]; if (t) { e.preventDefault(); dragMove(t.clientX, t.clientY); } }, { passive: false });
      stage.addEventListener("touchend", () => (drag = null));
      stage.addEventListener("wheel", (e) => {
        e.preventDefault();
        const slider = overlay.querySelector("input[type=range]"),
          nz = Math.min(3, Math.max(1, s.z * (e.deltaY < 0 ? 1.08 : 0.92))),
          cx = (S / 2 - s.x) / s.z,
          cy = (S / 2 - s.y) / s.z;
        s.z = nz;
        s.x = S / 2 - cx * nz;
        s.y = S / 2 - cy * nz;
        if (slider) slider.value = String(Math.round(nz * 100));
        clamp();
        draw();
      }, { passive: false });
      overlay.querySelector('[data-crop="cancel"]').onclick = () => finish(null);
      overlay.querySelector('[data-crop="done"]').onclick = () => {
        const cv = document.createElement("canvas");
        cv.width = cv.height = 512;
        const k = base * s.z;
        cv.getContext("2d").drawImage(img, -s.x / k, -s.y / k, S / k, S / k, 0, 0, 512, 512);
        finish(cv.toDataURL("image/jpeg", 0.9));
      };
    };
    img.onerror = () => resolve(raw);
    img.src = raw;
  });
};

/* ------------------------------------------------------------------ */
/* 3.2.0 settings layout: 裝置 moves above 通知 in the settings      */
/* home, 通知 is renamed 權限, and 聊天 + 音效板與好友分享 move     */
/* out of the 權限 page to sit below it on the home. The 模型與 API  */
/* page gains the shared GPT-Live key (above 語音與通話辨識) and    */
/* keeps 照片與圖片生成 below 使用其它 API 網站.                      */
/* ------------------------------------------------------------------ */
if (typeof pageNames === "object") pageNames.notifications = "通知";
{
  const baseSettingsView320 = settingsView;
  settingsView = function () {
    let html = baseSettingsView320();
    // Match the row itself; other settings add siblings to the same card.
    if (!html.includes('data-page="devices"')) html = html.replace(/(<button[^>]*data-page="notifications"[^>]*>[\s\S]*?<\/button>)/, '$1' + settingRow('devices', 'settings', '裝置', '預設瀏覽器'));
    if (!html.includes('data-page="chat"')) html = html.replace(/(<button[^>]*data-page="devices"[^>]*>[\s\S]*?<\/button>)/, '$1' + settingRow('chat', 'chat', '聊天', '拍照與訊息格式'));
    return html;
  };
}
function mz320SettingsDom() {
  if (tab !== "settings") return;
  if (page === "privacy") {
    const content = typeof mzSettingsContent === "function" ? mzSettingsContent() : document.querySelector("#app .content");
    if (content && !content.querySelector(".mz-applock-card")) {
      const c = window.mzAppLockCfg ? window.mzAppLockCfg() : {},
        nativeBio = !!(window.AndroidHost || window.IOSHost),
        card = document.createElement("div");
      card.className = "card mz-applock-card";
      card.innerHTML = `<h3>${mzT("App 鎖", "App lock")}</h3><p class="help">${c.enabled ? mzT("已開啟：打開沐水時需要先解鎖。密碼只保存在這台裝置，不會同步。", "On: opening Mizuki asks for your PIN first. The PIN stays on this device and never syncs.") : mzT("開啟後，打開沐水時要先輸入你設定的密碼（也可以用指紋／臉部辨識）。密碼只保存在這台裝置。", "When on, opening Mizuki asks for your PIN (fingerprint / face unlock can be enabled too). The PIN stays on this device.")}</p>${c.enabled ? `${nativeBio ? `<button class="pill" data-action="mzLockBio">${mzT("指紋／臉部解鎖：", "Fingerprint / face unlock: ")}${c.biometric ? mzT("開", "On") : mzT("關", "Off")}</button>` : ""}<button class="pill" data-action="mzLockSetup">${mzT("更改密碼", "Change PIN")}</button><button class="pill danger" data-action="mzLockDisable">${mzT("關閉 App 鎖", "Turn off app lock")}</button>` : `<button class="pill primary" data-action="mzLockSetup">${mzT("設定密碼並開啟", "Set a PIN and turn on")}</button>`}`;
      content.append(card);
    }
    return;
  }
  if (page === "devices") {
    const content = typeof mzSettingsContent === "function" ? mzSettingsContent() : document.querySelector("#app .content");
    if (content && !content.querySelector(".mz-quality-card")) {
      const card = document.createElement("div");
      card.className = "card mz-quality-card";
      card.innerHTML = `<h3>${mzT("通話畫質", "Call quality")}</h3><p class="help">${mzT("視訊通話與直播／分享畫面送出的最高畫質；網路不穩時系統會自動降低。", "The highest quality sent for video calls and screen sharing; the system lowers it automatically when the network struggles.")}</p><label for="mzQualitySel">${mzT("畫質", "Quality")}</label><select id="mzQualitySel"><option value="720p30" ${window.mzCallQuality() === "720p30" ? "selected" : ""}>720p · 30 FPS</option><option value="1080p60" ${window.mzCallQuality() === "1080p60" ? "selected" : ""}>1080p · 60 FPS</option></select>`;
      content.append(card);
      card.querySelector("#mzQualitySel").onchange = (e) => {
        try { localStorage.setItem("mzCallQuality", e.target.value); } catch {}
        window.mzApplyCallQuality();
      };
    }
    return;
  }
  if (page !== "api") return;
  const content = typeof mzSettingsContent === "function" ? mzSettingsContent() : document.querySelector("#app .content");
  if (!content) return;
  const imagesCard = content.querySelector('[data-page="images"]')?.closest(".card"),
    customCard = content.querySelector('[data-toggle="customEndpoint"]')?.closest(".card");
  if (imagesCard && customCard && customCard.nextElementSibling !== imagesCard) customCard.after(imagesCard);
  if (!content.querySelector('[data-page="usage"]')) {
    const row = document.createElement("div");
    row.className = "card";
    row.innerHTML = `<button class="setting-row" data-page="usage"><span class="setting-icon">${icon("cloud")}</span><span class="label">${mzT("本月用量", "This month's usage")}</span><span class="value">${mzT("每個模型花了多少", "What each model spent")}</span><span class="chevron">›</span></button>`;
    content.append(row);
  }
  const voiceCard = content.querySelector('[data-action="voiceSettings"]')?.closest(".card");
  if (voiceCard && !content.querySelector(".mz-livekey-card")) {
    const card = document.createElement("div");
    card.className = "card mz-livekey-card";
    card.innerHTML = `<h3>GPT-Live</h3><label for="mzLiveKeyInput">${mzT("獨立 GPT-Live API 金鑰", "Dedicated GPT-Live API key")}</label><input id="mzLiveKeyInput" type="password" autocomplete="new-password" placeholder="${mzT("僅保存於本機加密空間；留空不變更", "Stored encrypted on this device; leave empty to keep the current key")}"><p class="small">${mzT("GPT-Live 只用於 AI 電話，所有 AI 共用這把金鑰。請貼 sk-… API 金鑰，不要貼 Voice ID。", "GPT-Live is used only for AI calls, and every AI shares this key. Paste an sk-… API key, not a Voice ID.")}</p><button class="pill primary" data-action="mzSaveLiveKey">${mzT("儲存金鑰", "Save key")}</button>`;
    voiceCard.before(card);
  }
}
{
  const baseRender320 = render;
  render = function () {
    baseRender320();
    try { mz320SettingsDom(); } catch (e) { console.warn("mz320 settings", e); }
  };
}
/* 3.2.0: per-model usage for this month. */
if (typeof pageNames === "object") pageNames.usage = "本月用量";
{
  const baseSettingsPage320 = settingsPage;
  settingsPage = function () {
    if (page !== "usage") return baseSettingsPage320();
    const month = new Date().toISOString().slice(0, 7);
    let all = {}, prices = {};
    window.__mzUsageFlush?.();
    try { all = JSON.parse(localStorage.getItem("mzUsage") || "{}"); } catch {}
    try { prices = JSON.parse(localStorage.getItem("mzUsagePrices") || "{}"); } catch {}
    const rows = Object.entries(all[month] || {}).sort((a, b) => b[1].calls - a[1].calls);
    const fmt = (n) => n >= 10000 ? (typeof mzEn === "function" && mzEn() ? (n / 1000).toFixed(1) + "k" : (n / 10000).toFixed(1) + " 萬") : String(n);
    let total = 0;
    const body = rows.length ? rows.map(([model, r]) => {
      const pr = prices[model] || {},
        cost = (pr.in ? r.in / 1e6 * pr.in : 0) + (pr.out ? r.out / 1e6 * pr.out : 0);
      total += cost;
      return `<div class="card"><h3>${esc(model)}</h3><p class="help">${mzT("本月呼叫 ", "Calls this month: ")}${r.calls} ${mzT("次 · 輸入 ", " · input ")}${fmt(r.in)} tokens · ${mzT("輸出 ", "output ")}${fmt(r.out)} tokens</p><div class="flex" style="gap:8px"><label style="flex:1">${mzT("輸入單價（每百萬 tokens）", "Input price (per 1M tokens)")}<input type="number" min="0" step="any" data-usageprice="${esc(model)}" data-kind="in" value="${pr.in ?? ""}" placeholder="0"></label><label style="flex:1">${mzT("輸出單價（每百萬 tokens）", "Output price (per 1M tokens)")}<input type="number" min="0" step="any" data-usageprice="${esc(model)}" data-kind="out" value="${pr.out ?? ""}" placeholder="0"></label></div><p class="small">${mzT("估算花費：", "Estimated spend: ")}${cost ? "$" + cost.toFixed(2) : mzT("填入單價後顯示", "set prices to see")}</p></div>`;
    }).join("") : `<div class="card"><p class="help">${mzT("這個月還沒有紀錄到 API 用量。開始聊天、生圖或產生摘要後，這裡會自動累積。", "No API usage recorded this month yet. Chatting, image generation and summaries add up here automatically.")}</p></div>`;
    return `<header class="top"><div class="between"><div class="flex">${btn("back", "back", "返回")}<h2>${mzT("本月用量", "This month's usage")}</h2></div></div></header><div class="content"><p class="help">${mzT("只統計這台裝置送出的 API 請求（聊天、摘要、生圖、語音）。單價由你依服務商費率填寫，估算花費 = tokens ÷ 100 萬 × 單價；實際帳單以服務商為準。", "Counts API requests sent from this device only (chat, summaries, images, voice). Enter your provider's rates to estimate spend; the provider's bill is authoritative.")}</p>${body}${rows.length ? `<div class="card"><h3>${mzT("本月估算總花費：", "Estimated total this month: ")}$${total.toFixed(2)}</h3></div>` : ""}</div>`;
  };
}
document.addEventListener("change", (e) => {
  const input = e.target.closest("[data-usageprice]");
  if (!input) return;
  try {
    const prices = JSON.parse(localStorage.getItem("mzUsagePrices") || "{}"),
      model = input.dataset.usageprice,
      v = parseFloat(input.value);
    prices[model] = prices[model] || {};
    prices[model][input.dataset.kind] = isFinite(v) && v > 0 ? v : 0;
    localStorage.setItem("mzUsagePrices", JSON.stringify(prices));
    render();
  } catch {}
});

actions.mzSaveLiveKey = async () => {
  const input = document.querySelector("#mzLiveKeyInput"),
    v = input?.value.trim() || "";
  if (!v) return toast(mzT("請先貼上 GPT-Live API 金鑰", "Paste the GPT-Live API key first"));
  if (/^(YOUR_KEY|YOUR_API_KEY|YOUR_KEY_HERE|sk-\.\.\.)$/i.test(v)) throw Error("請填入實際 GPT-Live API 金鑰，不要使用 YOUR_KEY 範例文字");
  await WebEngine.key("live", v);
  input.value = "";
  toast(mzT("GPT-Live 金鑰已儲存", "GPT-Live key saved"));
};

/* ------------------------------------------------------------------ */
/* 3.2.0: optional app lock — a PIN (and fingerprint/face where the   */
/* platform offers it) asked when the app opens, and again after it   */
/* has been in the background for a minute. Device-local only.        */
/* ------------------------------------------------------------------ */
window.mzAppLockCfg = () => { try { return JSON.parse(localStorage.getItem("mzAppLock") || "{}"); } catch { return {}; } };
{
  const saveCfg = (c) => { try { localStorage.setItem("mzAppLock", JSON.stringify(c)); } catch {} };
  const hashPin = async (pin) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("mz-lock:" + pin));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  };
  let unlocked = false, hiddenAt = 0, lockEl = null;
  const unlock = () => { unlocked = true; lockEl?.remove(); lockEl = null; };
  const showLock = () => {
    const c = window.mzAppLockCfg();
    if (!c.enabled || !c.pinHash || unlocked || lockEl) return;
    lockEl = document.createElement("div");
    lockEl.className = "mz-lock";
    lockEl.innerHTML = `<div class="mz-lock-card"><div class="mz-lock-drop"></div><h3>${mzT("沐水已鎖定", "Mizuki is locked")}</h3><p class="small">${mzT("輸入密碼解鎖", "Enter your PIN to unlock")}</p><div class="mz-lock-dots"></div><p class="mz-lock-err"></p><div class="mz-lock-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((k) => k === "" ? "<span></span>" : `<button data-lockkey="${k}">${k}</button>`).join("")}</div>${c.biometric && (window.AndroidHost || window.IOSHost) ? `<button class="pill" data-lockbio>${mzT("使用指紋／臉部解鎖", "Use fingerprint / face")}</button>` : ""}</div>`;
    document.body.append(lockEl);
    let pin = "";
    const dots = lockEl.querySelector(".mz-lock-dots"),
      err = lockEl.querySelector(".mz-lock-err"),
      paint = () => { dots.textContent = "●".repeat(pin.length) + "○".repeat(Math.max(0, 8 - pin.length)).slice(0, Math.max(0, 8 - pin.length)); };
    paint();
    const tryPin = async () => {
      if (pin.length < 4) return;
      if ((await hashPin(pin)) === c.pinHash) { unlock(); return; }
      if (pin.length >= 8) { pin = ""; err.textContent = mzT("密碼錯誤，請再試一次", "Wrong PIN — try again"); paint(); }
    };
    lockEl.addEventListener("click", async (e) => {
      if (e.target.closest("[data-lockbio]")) {
        try {
          const r = await call("biometric");
          if (r?.granted) unlock();
          else if (r && r.available === false) toast(mzT("這台裝置沒有可用的指紋／臉部辨識", "No fingerprint / face unlock available on this device"));
        } catch (err2) { toast(err2.message || mzT("生物辨識失敗", "Biometrics failed")); }
        return;
      }
      const k = e.target.closest("[data-lockkey]")?.dataset.lockkey;
      if (k === undefined) return;
      if (k === "⌫") pin = pin.slice(0, -1);
      else if (pin.length < 8) pin += k;
      err.textContent = "";
      paint();
      tryPin();
    });
  };
  const maybeLock = () => { if (!unlocked) showLock(); };
  if (document.body) maybeLock();
  else document.addEventListener("DOMContentLoaded", maybeLock);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > 60000) { unlocked = false; maybeLock(); }
  });
  actions.mzLockSetup = () => {
    showModal(mzT("App 鎖密碼", "App lock PIN"), `<p class="help">${mzT("設定 4–8 位數字密碼。只保存在這台裝置，忘記後只能清除 App 資料重設。", "Set a 4–8 digit PIN. It stays on this device; if you forget it, the app data has to be cleared to reset it.")}</p><label for="mzPin1">${mzT("新密碼", "New PIN")}</label><input id="mzPin1" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password"><label for="mzPin2">${mzT("再輸入一次", "Enter it again")}</label><input id="mzPin2" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password"><button class="pill primary full" data-action="mzLockSetupSave">${mzT("儲存並開啟", "Save and turn on")}</button>`);
  };
  actions.mzLockSetupSave = async () => {
    const p1 = document.querySelector("#mzPin1")?.value.trim() || "",
      p2 = document.querySelector("#mzPin2")?.value.trim() || "";
    if (!/^\d{4,8}$/.test(p1)) throw Error(mzT("密碼需為 4–8 位數字", "The PIN must be 4–8 digits"));
    if (p1 !== p2) throw Error(mzT("兩次輸入不一致", "The two entries don't match"));
    const c = window.mzAppLockCfg();
    saveCfg({ ...c, enabled: true, pinHash: await hashPin(p1) });
    closeModal();
    toast(mzT("App 鎖已開啟", "App lock is on"));
    render();
  };
  actions.mzLockDisable = () => {
    showModal(mzT("關閉 App 鎖", "Turn off app lock"), `<label for="mzPinOff">${mzT("目前密碼", "Current PIN")}</label><input id="mzPinOff" type="password" inputmode="numeric" maxlength="8"><button class="pill danger full" data-action="mzLockDisableSave">${mzT("確認關閉", "Turn off")}</button>`);
  };
  actions.mzLockDisableSave = async () => {
    const p = document.querySelector("#mzPinOff")?.value.trim() || "",
      c = window.mzAppLockCfg();
    if ((await hashPin(p)) !== c.pinHash) throw Error(mzT("密碼錯誤", "Wrong PIN"));
    saveCfg({});
    closeModal();
    toast(mzT("App 鎖已關閉", "App lock is off"));
    render();
  };
  actions.mzLockBio = () => {
    const c = window.mzAppLockCfg();
    saveCfg({ ...c, biometric: !c.biometric });
    toast(c.biometric ? mzT("指紋／臉部解鎖已關閉", "Fingerprint / face unlock off") : mzT("指紋／臉部解鎖已開啟", "Fingerprint / face unlock on"));
    render();
  };
  const st = document.createElement("style");
  st.textContent = `.mz-lock{position:fixed;inset:0;z-index:5000;background:var(--bg,#14101c);display:flex;align-items:center;justify-content:center;padding:20px}.mz-lock-card{text-align:center;max-width:320px;width:100%}.mz-lock-drop{width:54px;height:54px;margin:0 auto 10px;border-radius:50%;background:linear-gradient(160deg,#b79ae0,#8a6bbf)}.mz-lock-dots{letter-spacing:6px;font-size:15px;min-height:22px;color:var(--ink)}.mz-lock-err{color:var(--danger,#d33);min-height:18px;font-size:13px}.mz-lock-pad{display:grid;grid-template-columns:repeat(3,72px);gap:10px;justify-content:center;margin:10px 0 14px}.mz-lock-pad button{height:56px;border-radius:50%;border:1px solid var(--line);background:var(--surface,#fff);color:var(--ink);font-size:20px}`;
  document.head.append(st);
}

/* ------------------------------------------------------------------ */
/* 3.2.0: records-page photos open the viewer with the post text at   */
/* the bottom (translucent black), and profile avatars can be zoomed. */
/* ------------------------------------------------------------------ */
document.addEventListener("click", (e) => {
  const rp = e.target.closest("[data-recordphoto]");
  if (rp) {
    const mine = state.moments.filter((p) => p.author === "me").slice().sort((a, b) => b.time - a.time),
      list = [];
    for (const p of mine) for (const src of p.images || []) list.push({ src, mid: "", rawMid: "", who: person("me"), time: p.time, chat: false, caption: p.text || "" });
    const at = list.findIndex((i) => i.src === rp.dataset.recordphoto);
    if (at >= 0 && typeof window.mzOpenLightbox === "function") window.mzOpenLightbox(list, at);
    return;
  }
  const zv = e.target.closest("[data-mzavatarview]");
  if (zv) {
    const id = zv.dataset.mzavatarview,
      who = id === "official-mushui" ? person(id) : state.ais.find((a) => a.id === id) || (typeof humanFriend === "function" ? humanFriend(id) : null) || person(id);
    if (who?.avatar && typeof window.mzOpenLightbox === "function")
      window.mzOpenLightbox([{ src: who.avatar, mid: "", rawMid: "", who, time: 0, chat: false, caption: "" }], 0);
  }
});

/* ------------------------------------------------------------------ */
/* 3.1.8: if the system mutes the call microphone while the user is   */
/* in another app (e.g. watching a video), recover it when they come  */
/* back — re-acquire the mic and feed the fresh track into the call.  */
/* ------------------------------------------------------------------ */
{
  let recovering = false,
    lastTry = 0;
  const recover = async () => {
    const c = window.VoiceUI?.rtc;
    if (!c?.pc || c.ended || c.muted || recovering || Date.now() - lastTry < 8000) return;
    const track = c.stream?.getAudioTracks?.()[0];
    if (track && track.readyState === "live" && !track.muted) return;
    recovering = true;
    lastTry = Date.now();
    try {
      const fresh = await openMicrophone();
      if (window.VoiceUI?.rtc !== c || c.ended) {
        fresh.getTracks().forEach((t) => t.stop());
        return;
      }
      if (c.mix?.ctx) {
        const src = c.mix.ctx.createMediaStreamSource(fresh);
        if (c.mix.micGain) src.connect(c.mix.micGain);
        else src.connect(c.mix.destination);
        try {
          c.mix.micSource?.disconnect();
        } catch {}
        c.mix.micSource = src;
      } else {
        const sender = c.pc.getSenders().find((x) => x.track?.kind === "audio");
        if (sender) {
          const routed = window.mzMicRoute?.(fresh),
            sendTrack = routed?.getAudioTracks?.()[0] || fresh.getAudioTracks()[0];
          if (sendTrack) await sender.replaceTrack(sendTrack);
        }
      }
      c.stream?.getTracks().forEach((t) => t.stop());
      c.stream = fresh;
      toast(mzT("已重新接上麥克風", "Microphone reconnected"), 1800);
    } catch {
    } finally {
      recovering = false;
    }
  };
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) setTimeout(recover, 600);
  });
  setInterval(() => {
    if (!document.hidden) recover();
  }, 5000);
}


/* ===== 3.2.0 item 4: app-lock guardians (parental mode) ===== */
{
  const reqG = WebEngine.humanRequest;
  const healedFor = new Set();
  WebEngine.humanRequest = async (path, body, authorized = true) => {
    const r = await reqG(path, body, authorized);
    try {
      if (r && typeof path === "string" && path.startsWith("/v1/sync")) {
        if (Array.isArray(r.guardianOf)) window.MzGuardianOf = r.guardianOf;
        if (Array.isArray(r.guardians)) {
          window.MzGuardians = r.guardians;
          // Self-heal: an early 3.2.0 build crashed while saving guardians
          // (after the local edit, before the POST), so a device can show
          // guardians chosen while the server has none — and every lock from
          // those guardians is silently dropped. Local picks are the source
          // of truth: if the server list differs, re-register once per
          // distinct list per session.
          const local = [...new Set((state.settings.appLockGuardians || []).filter(x => typeof x === "string" && x.startsWith("human:")).map(x => x.slice(7)))].sort();
          const remote = [...r.guardians].sort();
          const key = local.join(",");
          if (local.length && JSON.stringify(local) !== JSON.stringify(remote) && !healedFor.has(key)) {
            healedFor.add(key);
            reqG("/v1/guardians", { guardians: local }).catch(() => {});
          }
        }
      }
    } catch (e) {}
    return r;
  };
}
{
  const baseNpG = notificationPage;
  notificationPage = function () {
    const count = (state.settings.appLockGuardians || []).length;
    return baseNpG() + `<section class="card"><h3>${mzT("App 鎖定管理員（家長模式）", "App lock guardians (parental mode)")}</h3><p class="help">${mzT("從你的星星裡選管理員。管理員可以在他的沐水裡，鎖定你這台裝置的其它 App 一段時間（例如休息或睡覺時間），時間到自動解除。沐水本身、桌面與電話不會被鎖。目前只有 Android 能鎖定其它 App，且需要開啟「使用情況存取」權限；iPhone 與電腦無法鎖定其它 App。", "Pick guardians from your starred contacts. A guardian can lock this device's other apps for a while from their Mizuki; the lock lifts automatically. Mizuki itself, the launcher and the dialer stay usable. Only Android can lock other apps and it needs Usage Access; iPhone and desktop cannot lock other apps.")}</p><button class="setting-choice" data-action="mzGuardianPick"><span>${mzT("選擇管理員", "Choose guardians")}（${count}）</span><span>${mzT("選擇", "Choose")} ›</span></button></section>`;
  };
}
actions.mzGuardianPick = () => {
  const chosen = new Set(state.settings.appLockGuardians || []);
  const star = state.settings.deviceEventTargets || [];
  const rows = star.map(t => {
    // deviceEventTargets entries are STRINGS ("ai:<id>" / "human:<id>") —
    // an earlier build read them as {kind, id} objects, which produced
    // nameless rows keyed "undefined:undefined": saves looked successful
    // but registered nobody on the server.
    const key = String(t), sep = key.indexOf(":"), kind = sep > 0 ? key.slice(0, sep) : "", id = sep > 0 ? key.slice(sep + 1) : "";
    if ((kind !== "ai" && kind !== "human") || !id) return "";
    const name = kind === "ai" ? (state.ais.find(a => a.id === id)?.name || id) : (humanData().friends.find(f => f.id === id)?.name || id);
    return `<label class="check-row"><span>${esc(name)}${kind === "ai" ? "（AI）" : ""}</span><input type="checkbox" data-guardian="${esc(key)}" ${chosen.has(key) ? "checked" : ""}></label>`;
  }).join("");
  showModal(mzT("選擇 App 管理員", "Choose app guardians"), `<p class="help">${mzT("只能從你特別星標的對象裡選。", "Only specially starred contacts can be chosen.")}</p>${rows || `<p class="help">${mzT("還沒有特別星標的對象。先在星星設定裡把對象加入星星，再回來選管理員。", "No specially starred contacts yet. Star someone in the star settings first.")}</p>`}<button class="pill primary full" data-action="mzGuardianSave">${mzT("儲存", "Save")}</button>`);
};
actions.mzGuardianSave = async () => {
  const picks = [...document.querySelectorAll("[data-guardian]:checked")].map(x => x.dataset.guardian);
  closeModal();
  try { await WebEngine.edit(s => { s.settings.appLockGuardians = picks; }); state = await WebEngine.view(); } catch (e) { toast(mzT("管理員儲存失敗，請再試一次", "Saving guardians failed — please try again"), 3600); render(); return; }
  if (!humanData().connected) { toast(mzT("目前未連上好友伺服器，管理員只存在這台裝置。連上線後請再儲存一次，才會登記到伺服器。", "Not connected to the friend server — guardians are only stored on this device. Save again once you are back online."), 5200); render(); return; }
  if (humanData().connected) {
    const humans = picks.filter(x => x.startsWith("human:")).map(x => x.slice(7));
    try {
      const resp = await WebEngine.humanRequest("/v1/guardians", { guardians: humans });
      // The server silently drops picks whose account id does not match a
      // server-side friendship (e.g. a stale friend entry from before an
      // account purge) and still answers 200 — check what was actually
      // stored instead of toasting a fake success.
      const kept = resp && Array.isArray(resp.guardians) ? resp.guardians.map(x => String(x).toLowerCase()) : null;
      if (kept && humans.some(h => !kept.includes(String(h).toLowerCase()))) { toast(mzT("有管理員沒有被伺服器接受，好友記錄可能對不上。請把對方移除好友後重新加入，再回來選一次。", "A guardian was not accepted by the server — the friendship record may be stale. Remove and re-add that friend, then choose again."), 5200); render(); return; }
    }
    catch (e) { toast(mzT("管理員已存在這台裝置，但同步到伺服器失敗，請連上網路後再儲存一次", "Saved on this device, but syncing to the server failed — save again when you are back online")); render(); return; }
  }
  toast(mzT("已更新 App 管理員", "Guardians updated")); render();
};
let mzLockPick = null;
actions.mzGuardianLock = async () => {
  const peer = typeof chatId === "string" && chatId.startsWith("human:") ? chatId.slice(6) : "";
  mzLockPick = null;
  let apps = null;
  if (peer) { try { const r = await WebEngine.humanRequest("/v1/applist/get", { user: peer }); if (Array.isArray(r?.apps) && r.apps.length) apps = r.apps.slice(0, 300); } catch (e) {} }
  mzLockPick = { peer, apps };
  const list = apps
    ? `<p class="help">${mzT("勾選要鎖的 App（預設全選）；沒有勾的 App 不受影響。", "Tick the apps to lock (all ticked by default); unticked apps stay usable.")}</p>` + apps.map(a => `<label class="check-row"><span>${esc(a.name)}</span><input type="checkbox" data-lockapp="${esc(a.pkg)}" checked></label>`).join("")
    : `<p class="help">${mzT("對方還沒有提供 App 清單（對方要用 Android 版開啟過沐水），這次會直接鎖定全部 App。", "They have not shared an app list yet (they need to open Mizuki on Android), so this lock covers all apps.")}</p>`;
  showModal(mzT("鎖定對方 App", "Lock their apps"), `<p class="help">${mzT("你是對方選定的 App 管理員。鎖定後，對方 Android 手機被選中的 App 會被暫時擋住，沐水、桌面與電話仍可使用；iPhone 與電腦無法被鎖定。", "You are their chosen app guardian. The chosen apps on their Android phone are covered for a while; Mizuki, the launcher and the dialer stay usable. iPhone and desktop cannot be locked.")}</p>${list}<button class="pill primary full" data-mzlock="15">15 ${mzT("分鐘", "min")}</button><button class="pill primary full" data-mzlock="30">30 ${mzT("分鐘", "min")}</button><button class="pill primary full" data-mzlock="60">1 ${mzT("小時", "hour")}</button><button class="pill full" data-mzlock="0">${mzT("解除鎖定", "Unlock")}</button>`);
};
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-mzlock]"); if (!b) return;
  const minutes = Number(b.dataset.mzlock) || 0;
  const peer = typeof chatId === "string" && chatId.startsWith("human:") ? chatId.slice(6) : "";
  let packages = null, pickedCount = 0;
  if (minutes > 0 && mzLockPick && mzLockPick.peer === peer && mzLockPick.apps) {
    const checked = [...document.querySelectorAll("[data-lockapp]:checked")].map(x => x.dataset.lockapp);
    if (!checked.length) { toast(mzT("至少要選一個 App", "Pick at least one app")); return; }
    pickedCount = checked.length;
    if (checked.length < mzLockPick.apps.length) packages = checked;
  }
  mzLockPick = null;
  closeModal();
  if (!peer) return;
  const lock = { minutes }; if (packages) lock.packages = packages;
  const text = minutes > 0 ? (packages ? `先鎖定你的 ${pickedCount} 個 App ${minutes} 分鐘，休息一下。` : `先鎖定你的其它 App ${minutes} 分鐘，休息一下。`) : "已解除你的 App 鎖定。";
  try { await humanCall({ action: "send", id: peer, text, appLock: lock, clientMessageId: "lock" + Date.now() }); await WebEngine.humanSync().catch(() => {}); toast(minutes > 0 ? mzT("已送出鎖定", "Lock sent") : mzT("已送出解除", "Unlock sent")); }
  catch (err) { showError(err); }
});
/* Incoming guardian locks are applied natively whenever the app sees them;
   the background notifier applies them while the app is closed. */
{
  let seen = []; try { seen = JSON.parse(localStorage.getItem("mzAppLockSeen") || "[]"); } catch (e) {}
  const seenSet = new Set(seen.map(String));
  let scanFloor = 0;
  for (const id of seenSet) { const n = +id; if (Number.isFinite(n) && n > scanFloor) scanFloor = n; }
  const applyIncoming = () => {
    try {
      if (!window.AndroidHost) return;
      const mine = new Set(state.settings.appLockGuardians || []);
      for (const m of humanData().messages || []) {
        const mid = +m.id;
        if (Number.isFinite(mid)) { if (mid <= scanFloor && !seenSet.has(String(m.id))) continue; if (mid > scanFloor && !m.appLock) continue; }
        if (!m.appLock || seenSet.has(String(m.id))) continue;
        seenSet.add(String(m.id));
        if (!mine.has("human:" + m.sender)) continue;
        const minutes = Math.max(0, Math.min(1440, Number(m.appLock.minutes) || 0));
        const lockArg = { minutes };
        if (Array.isArray(m.appLock.packages) && m.appLock.packages.length) lockArg.packages = m.appLock.packages;
        Desktop.invoke("appLock", lockArg).catch(() => {});
        toast(minutes > 0 ? mzT(`管理員已鎖定你的其它 App ${minutes} 分鐘`, `A guardian locked your other apps for ${minutes} min`) : mzT("管理員已解除 App 鎖定", "A guardian lifted the app lock"));
      }
      for (const m of humanData().messages || []) { const n = +m.id; if (Number.isFinite(n) && n > scanFloor) scanFloor = n; }
      localStorage.setItem("mzAppLockSeen", JSON.stringify([...seenSet].slice(-80)));
    } catch (e) {}
  };
  setInterval(applyIncoming, 6000); setTimeout(applyIncoming, 5000);
}
/* Publish this device's launchable apps so my guardians can choose WHICH
   apps a lock covers (they pick from this list). Android only; the list is
   refreshed at most once a day and cached for the AI-guardian prompt. */
{
  const publish = async () => {
    try {
      if (!window.AndroidHost || !humanData().connected) return;
      const last = +localStorage.getItem("mzAppListAt") || 0;
      if (Date.now() - last < 86400000 && localStorage.getItem("mzMyApps")) return;
      const r = await Desktop.invoke("installedApps", {});
      const apps = (r?.apps || []).filter(a => a && a.pkg && a.name).slice(0, 400);
      if (!apps.length) return;
      localStorage.setItem("mzMyApps", JSON.stringify(apps));
      await WebEngine.humanRequest("/v1/applist", { apps }).catch(() => {});
      localStorage.setItem("mzAppListAt", String(Date.now()));
    } catch (e) {}
  };
  setTimeout(publish, 9000); setInterval(publish, 3600000);
}


/* ===== 3.2.0 fix: mixed human+AI groups — the owner's app drives the AIs =====
   AI members live on the group owner's account, so only the owner's client
   generates their replies, and only for roster AIs the owner actually has.
   A server-side claim per trigger message keeps the owner's two devices
   from answering twice. */
let mzMixedBusy = false;
async function mzMixedAiTick() {
  if (mzMixedBusy) return;
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem("mzMixedAiSeen") || "{}"); } catch (e) {}
  try {
    if (!humanData().connected) return;
    const me = humanData().me && humanData().me.id;
    if (!me) return;
    const groups = (MizukiGroups.data.groups || []).filter(g => g.owner === me && (g.ais || []).length);
    if (!groups.length) return;
    mzMixedBusy = true;
    // Heal legacy rosters: groups created before the thumbnail fix stored
    // empty AI avatars. The owner uploads a small snapshot once per AI and
    // every member sees the face again (server endpoint is owner-only).
    if (!window.__mzAiAvatarHealed) window.__mzAiAvatarHealed = new Set();
    let healedAny = false;
    for (const g of groups) {
      for (const entry of g.ais || []) {
        const key = g.id + ":" + entry.id;
        if (entry.avatar || window.__mzAiAvatarHealed.has(key)) continue;
        window.__mzAiAvatarHealed.add(key);
        const local = (state.ais || []).find(x => x.id === entry.id);
        if (!local || !local.avatar) continue;
        const thumb = local.avatar.length <= 60000 ? local.avatar : await window.mizukiAiThumb(local.avatar);
        if (!thumb) continue;
        const r = await mizukiApi("/v1/groups/aiavatar", { group: g.id, ai: entry.id, avatar: thumb }).catch(() => null);
        if (r && r.ok) healedAny = true;
      }
    }
    if (healedAny) await mizukiGroupsSync().catch(() => {});
    for (const g of groups) {
      const msgs = (MizukiGroups.data.messages || []).filter(m => m.gid === g.id);
      if (!msgs.length) continue;
      const lastId = Math.max(...msgs.map(m => +m.id || 0));
      const cursor = seen[g.id] || 0;
      seen[g.id] = lastId;
      const triggers = msgs.filter(m => +m.id > cursor && !m.system && !m.poke && (m.text || (m.images || []).length));
      if (!triggers.length) continue;
      const trigger = triggers[triggers.length - 1];
      if (Date.now() - (trigger.time || 0) > 600000) continue;
      // AI messages may trigger other AIs too (the user asked for AI-to-AI
      // replies, not only human-triggered ones), but the streak of
      // consecutive AI messages since the last human spoke is capped so the
      // group can never talk to itself forever.
      let aiSinceHuman = 0;
      for (let i = msgs.length - 1; i >= 0; i--) { const mm = msgs[i]; if (mm.system || mm.poke) continue; if (mm.aiAuthor) aiSinceHuman++; else break; }
      if (trigger.aiAuthor && aiSinceHuman > 4) continue;
      const claim = await mizukiApi("/v1/groups/aiclaim", { group: g.id, messageId: trigger.id }).catch(() => null);
      if (!claim || !claim.claimed) continue;
      const roster = (g.ais || []).map(a => state.ais.find(x => x.id === a.id)).filter(Boolean);
      if (!roster.length) continue;
      const text = trigger.text || "";
      const pool = trigger.aiAuthor ? roster.filter(a => a.id !== trigger.aiAuthor.id) : roster;
      if (!pool.length) continue;
      let responders = pool.filter(a => a.name && text.includes(a.name));
      if (!responders.length) {
        // A human message always gets at least one AI reply — the old 80%
        // roll read as "the AI just doesn't answer". Dice remain only for
        // AI-to-AI pickups, decaying with the streak.
        if (!trigger.aiAuthor) responders = [pool[Math.floor(Math.random() * pool.length)]];
        else if (Math.random() < [0.65, 0.5, 0.35, 0.25][Math.min(3, Math.max(0, aiSinceHuman - 1))]) responders = [pool[Math.floor(Math.random() * pool.length)]];
        if (responders.length && pool.length > 1 && Math.random() < (trigger.aiAuthor ? 0.15 : 0.3)) { const rest = pool.filter(a => a !== responders[0]); responders.push(rest[Math.floor(Math.random() * rest.length)]); }
      }
      responders = responders.slice(0, 2);
      for (const aiObj of responders) {
        window.__mzGroupTyping = { gid: g.id, aiId: aiObj.id, name: aiObj.name };
        try { if (typeof chatId === "string" && chatId === "hgroup:" + g.id && typeof mizukiShowTyping === "function") mizukiShowTyping([aiObj.name]); } catch (e) {}
        const fresh = (MizukiGroups.data.messages || []).filter(m => m.gid === g.id).slice(-20);
        const history = fresh.map(m => {
          if (m.system) return null;
          const name = m.aiAuthor ? m.aiAuthor.name : (m.sender === me ? (state.settings.nickname || "我") : ((g.members || []).find(pp => pp.id === m.sender) || {}).name || m.sender);
          const own = m.aiAuthor && m.aiAuthor.id === aiObj.id;
          return { role: own ? "assistant" : "user", content: own ? (m.text || "") : name + "：" + (m.text || "［照片］") };
        }).filter(Boolean);
        let reply = "";
        try {
          const raw = await WebEngine.complete(state.settings, WebEngine.system(aiObj) + "\n這是人類與 AI 的混合群組聊天，你是群組成員之一。像群組裡的一份子自然回話：一次只回一則短訊息，直接回覆文字，不要替其他人發言。" + (trigger.aiAuthor ? "\n剛才發言的是另一位 AI 成員，像朋友自然接話即可；如果真的沒什麼好補充的，只回 pass 兩個字，系統就不會送出。" : ""), history);
          const packet = WebEngine.replyPacket(raw);
          reply = (packet.messages && packet.messages[0]) || packet.text || "";
        } catch (e) {}
        reply = String(reply || "").trim().slice(0, 2000);
        if (!reply || /^pass$/i.test(reply)) continue;
        await mizukiApi("/v1/groups/send", { group: g.id, text: reply, aiAuthor: { id: aiObj.id }, clientId: "ai" + Date.now() + Math.floor(Math.random() * 1e6) }).catch(() => {});
        await new Promise(r => setTimeout(r, 1200));
      }
      window.__mzGroupTyping = null;
      await mizukiGroupsSync().catch(() => {});
      try { if (typeof chatId === "string" && chatId === "hgroup:" + g.id) render(); } catch (e) {}
    }
  } catch (e) {} finally {
    window.__mzGroupTyping = null;
    mzMixedBusy = false;
    try { localStorage.setItem("mzMixedAiSeen", JSON.stringify(seen)); } catch (e) {}
  }
}
{
  const baseGroupsSync216 = mizukiGroupsSync;
  mizukiGroupsSync = async () => { const r = await baseGroupsSync216(); mzMixedAiTick().catch(() => {}); return r; };
}
setInterval(() => { if (document.hidden || !state?.human?.connected) return; mizukiGroupsSync().catch(() => {}); }, 20000);

/* ===== @ mentions: composer member popup (tap to insert), tappable
   mention pills (tap -> that person's profile), and a persistent
   highlight on any message that mentions the viewer. In mixed groups
   an @AI also steers the reply, because the owner engine already
   prioritises AIs whose name appears in the trigger text. ===== */
{
  const mentionMembers = () => {
    try {
      if (typeof chatId !== "string" || !chatId) return null;
      if (chatId.startsWith("hgroup:")) {
        const g = (MizukiGroups.data.groups || []).find(x => x.id === chatId.slice(7));
        if (!g) return null;
        const meId = humanData().me?.id;
        return [
          ...(g.members || []).filter(p => p.id !== meId).map(p => ({ name: p.name, key: "human:" + p.id, face: p, ai: false })),
          ...(g.ais || []).map(a => ({ name: a.name, key: "ai:" + a.id, face: { id: "ai:" + a.id, name: a.name, avatar: a.avatar || (state.ais || []).find(x => x.id === a.id)?.avatar || "" }, ai: true })),
        ].filter(m => m.name);
      }
      if (chatId.startsWith("human:")) {
        const f = (humanData().friends || []).find(p => "human:" + p.id === chatId);
        return f ? [{ name: f.name, key: "human:" + f.id, face: f, ai: false }] : null;
      }
      const ch = (state.chats || []).find(c => c.id === chatId);
      if (ch && Array.isArray(ch.members)) return ch.members.map(id => { const a = ai(id); return a ? { name: a.name, key: "ai:" + a.id, face: a, ai: true } : null; }).filter(Boolean);
    } catch (e) {}
    return null;
  };
  const mentionMyNames = () => {
    const out = [];
    try {
      if (typeof chatId === "string" && (chatId.startsWith("human:") || chatId.startsWith("hgroup:"))) { const n = humanData().me?.name; if (n) out.push(n); }
      const nick = state.settings?.nickname; if (nick) out.push(nick);
    } catch (e) {}
    return [...new Set(out)];
  };
  let mzPop = null, mzPopCtx = null;
  const mzPopClose = () => { if (mzPop) { mzPop.remove(); mzPop = null; mzPopCtx = null; } };
  document.addEventListener("input", e => {
    const ta = e.target;
    if (!ta || ta.tagName !== "TEXTAREA" || ta.dataset.input !== "message") return;
    const members = mentionMembers();
    if (!members || !members.length) { mzPopClose(); return; }
    const v = ta.value, caret = ta.selectionStart;
    let i = caret - 1;
    while (i >= 0 && !/\s/.test(v[i]) && v[i] !== "@") i--;
    if (i < 0 || v[i] !== "@" || (i > 0 && !/\s/.test(v[i - 1]))) { mzPopClose(); return; }
    const token = v.slice(i + 1, caret);
    const list = members.filter(m => !token || m.name.toLowerCase().includes(token.toLowerCase())).slice(0, 8);
    if (!list.length) { mzPopClose(); return; }
    mzPopClose();
    mzPop = document.createElement("div");
    mzPop.className = "mz-mention-pop";
    mzPop.innerHTML = `<div class="mp-head">${mzT("成員", "Members")}</div>` + list.map((m, ix) => `<button type="button" data-mzmentionpick="${ix}">${avatar(m.face, "tiny")}<span>${esc(m.name)}</span>${m.ai ? "<small>AI</small>" : ""}</button>`).join("");
    document.body.append(mzPop);
    const r = ta.getBoundingClientRect();
    mzPop.style.left = Math.max(8, Math.min(r.left, innerWidth - 330)) + "px";
    mzPop.style.bottom = Math.max(8, innerHeight - r.top + 8) + "px";
    mzPopCtx = { ta, atPos: i, list };
    mzPop.querySelectorAll("[data-mzmentionpick]").forEach(b => b.addEventListener("mousedown", ev2 => {
      ev2.preventDefault();
      const m = mzPopCtx.list[+b.dataset.mzmentionpick], vv = mzPopCtx.ta.value, cc = mzPopCtx.ta.selectionStart;
      mzPopCtx.ta.value = vv.slice(0, mzPopCtx.atPos) + "@" + m.name + " " + vv.slice(cc);
      const pos = mzPopCtx.atPos + m.name.length + 2, target = mzPopCtx.ta;
      mzPopClose();
      target.focus(); try { target.setSelectionRange(pos, pos); } catch (e) {}
      target.dispatchEvent(new Event("input", { bubbles: true }));
    }));
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape") mzPopClose(); });
  document.addEventListener("mousedown", e => { if (mzPop && !mzPop.contains(e.target)) mzPopClose(); });
  const mzBoundary = ch => ch === undefined || /[\s，。！？、,.!?;:：；）)\]」』】]/.test(ch);
  const mzPaintMentions = () => {
    try {
      if (mzPop && mzPopCtx && !document.contains(mzPopCtx.ta)) mzPopClose();
      const conv = document.querySelector(".conversation");
      if (!conv) return;
      const members = mentionMembers();
      if (!members || !members.length) return;
      const sorted = [...members].sort((a, b) => b.name.length - a.name.length);
      const mine = mentionMyNames();
      const paintNode = (node) => {
        let text = node.nodeValue, hit = null, at = -1;
        for (const m of sorted) { const ix = text.indexOf("@" + m.name); if (ix >= 0 && mzBoundary(text[ix + m.name.length + 1]) && (at < 0 || ix < at)) { hit = m; at = ix; } }
        if (!hit) return;
        const btn = document.createElement("button");
        btn.type = "button"; btn.className = "mz-mention"; btn.dataset.mzmention = hit.key;
        if (!hit.ai) btn.dataset.humancontact = hit.key.slice(6);
        btn.textContent = "@" + hit.name;
        const frag = document.createDocumentFragment();
        const before = text.slice(0, at), after = text.slice(at + hit.name.length + 1);
        if (before) frag.append(document.createTextNode(before));
        frag.append(btn);
        const rest = document.createTextNode(after);
        frag.append(rest);
        node.replaceWith(frag);
        if (after.includes("@")) paintNode(rest);
      };
      conv.querySelectorAll(".message").forEach(msg => {
        msg.querySelectorAll(".bubble").forEach(bubble => {
          const raw = bubble.textContent || "";
          if (raw.includes("@") && mine.some(n => raw.includes("@" + n))) msg.classList.add("mz-mentioned");
          const walker = document.createTreeWalker(bubble, NodeFilter.SHOW_TEXT, { acceptNode: n => (n.parentElement && (n.parentElement.closest("a,button,.mz-mention") || !n.nodeValue.includes("@"))) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
          const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
          nodes.forEach(paintNode);
        });
      });
    } catch (e) {}
  };
  const renderBeforeMention216 = render;
  render = function () { const r = renderBeforeMention216.apply(this, arguments); try { mzPaintMentions(); } catch (e) {} return r; };
  window.mzPaintMentions = mzPaintMentions;
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-mzmention]");
    if (!el) return;
    const key = el.dataset.mzmention || "";
    if (key.startsWith("ai:")) {
      e.preventDefault();
      momentProfileId = key.slice(3); momentReturnChat = chatId; chatId = ""; tab = "moments"; page = ""; coverExpanded = false; render();
    }
    /* Human mentions carry data-humancontact: the human.js delegation
       opens that friend's profile card for any such button. */
  });
}

/* ---- QR-code sign-in for computers: the desktop shows a one-time code
   (QR + typeable text); a signed-in phone approves it and the server
   hands the desktop a normal session token. ---- */
(() => {
  const origAccount = actions.humanAccount;
  if (typeof origAccount === "function") actions.humanAccount = () => {
    origAccount();
    try {
      const sheet = document.querySelector(".modal-backdrop .sheet"); if (!sheet) return;
      const h = humanData();
      if (h.connected) {
        const card = sheet.querySelector(".card");
        if (card && !card.querySelector('[data-action="mzQrApprove"]')) card.insertAdjacentHTML("beforeend", '<button class="pill" data-action="mzQrApprove">掃碼登入電腦</button>');
      } else {
        const row = sheet.querySelector(".sheet-actions");
        if (row && !sheet.querySelector('[data-action="mzQrLogin"]')) row.insertAdjacentHTML("afterend", '<button class="pill" data-action="mzQrLogin" style="width:100%;margin-top:10px">用手機掃碼登入</button><p class="help">用已登入的手機打開「人類帳號」→「掃碼登入電腦」，掃描或輸入代碼即可，免打密碼。</p>');
      }
    } catch {}
  };
  let mzQrPollSeq = 0;
  actions.mzQrLogin = async () => {
    const serverEl = document.querySelector("#humanServer");
    const base = window.mizukiSafeServer(serverEl?.value || humanData().serverUrl || window.MIZUKI_SERVER || "");
    const mine = ++mzQrPollSeq;
    showModal("用手機掃碼登入", '<div style="text-align:center"><canvas id="mzQrCanvas" width="264" height="264" style="border-radius:12px"></canvas><p id="mzQrCode" style="font-size:22px;letter-spacing:4px;font-weight:700">…</p><p class="help" id="mzQrStatus">正在產生代碼…</p></div>');
    let code = "";
    try {
      const dn = await Promise.resolve(WebEngine.deviceName?.()).catch(() => "");
      await WebEngine.edit(s => { s.human.serverUrl = base; });
      const data = await WebEngine.humanRequest("/v1/qrlogin", { deviceName: dn || "電腦（掃碼登入）" }, false);
      if (!data.code) throw Error("failed");
      code = data.code;
    } catch { const st = document.querySelector("#mzQrStatus"); if (st) st.textContent = "連不上伺服器，請確認伺服器網址後重試。"; return; }
    const codeEl = document.querySelector("#mzQrCode"); if (codeEl) codeEl.textContent = code.slice(0, 5) + " " + code.slice(5);
    const cv = document.querySelector("#mzQrCanvas"); if (cv && window.mzDrawQr) window.mzDrawQr(cv, "mizuki-qrlogin:" + code, 264);
    const st = document.querySelector("#mzQrStatus"); if (st) st.textContent = "請在手機打開「人類帳號」→「掃碼登入電腦」核准（3 分鐘內有效）";
    const deadline = Date.now() + 175000;
    while (mzQrPollSeq === mine && Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 2000));
      if (mzQrPollSeq !== mine || !document.querySelector("#mzQrCanvas")) return;
      try {
        const data = await WebEngine.humanRequest("/v1/qrlogin/poll?code=" + encodeURIComponent(code), undefined, false);
        if (data.status === "approved" && data.token) {
          await WebEngine.key("human", data.token);
          await WebEngine.edit(s => { s.human = { ...WebEngine.defaults().human, serverUrl: base, me: data.me }; });
          await WebEngine.humanSync().catch(() => {});
          try { state = await WebEngine.view(); } catch {}
          closeModal(); toast("掃碼登入成功"); render();
          await WebEngine.accountSync?.().catch(() => {});
          try { state = await WebEngine.view(); } catch {}
          render();
          if (state.accountSync?.needsPassword) actions.mzSyncPassword();
          return;
        }
        if (data.status === "expired") { const s2 = document.querySelector("#mzQrStatus"); if (s2) s2.textContent = "代碼已過期，請關閉後重新產生。"; return; }
      } catch {}
    }
  };
  // AI chats are encrypted with a key made from the password, and a QR sign-in never sees the password.
  actions.mzSyncPassword = () => {
    const locked = state.accountSync?.locked;
    showModal(locked ? "輸入以前的密碼" : "輸入一次密碼", '<p class="help">' + (locked ? "雲端資料是用另一組密碼加密的。輸入現在或以前的密碼就能取回，資料不會被覆蓋。" : "掃碼登入只會同步好友。輸入一次密碼後，這台裝置才能同步 AI 聊天、角色與朋友圈。") + '</p><label>密碼</label><input id="mzSyncPassword" type="password" autocomplete="current-password"><p id="mzSyncPasswordError" class="inline-error"></p><div class="sheet-actions">' + (locked ? '<button class="pill" data-action="mzSyncGiveUp">放棄雲端資料</button>' : "") + '<button class="pill primary" data-action="mzSyncPasswordGo">開始同步</button></div>');
  };
  actions.mzSyncPasswordGo = async () => {
    const password = document.querySelector("#mzSyncPassword")?.value || "", error = document.querySelector("#mzSyncPasswordError");
    if (!password) return;
    const wasLocked = state.accountSync?.locked;
    try {
      try {
        await humanCall({ action: "login", url: humanData().serverUrl, userId: humanData().me.id, password, deviceName: (window.MushuiDesktop ? "Windows 電腦" : deviceLabel()) + " · " + (navigator.platform || "裝置") });
      } catch (e) {
        if (!wasLocked) throw e;
        await WebEngine.accountUnlock(password);
      }
      state = await WebEngine.view();
      if (state.accountSync?.needsPassword) { actions.mzSyncPassword(); return; }
      closeModal(); render(); toast("已開始同步");
    } catch (e) { if (error) error.textContent = e.message || "密碼不正確"; }
  };
  actions.mzSyncGiveUp = () => confirmModal("放棄雲端資料", "雲端上打不開的資料會被這台裝置的資料取代，無法復原。", async () => {
    closeModal();
    await WebEngine.accountDiscardRemote();
    state = await WebEngine.view();
    render();
  });
  let mzQrScanSeq = 0;
  actions.mzQrApprove = () => {
    const mine = ++mzQrScanSeq;
    showModal("掃碼登入電腦", '<video id="mzQrVideo" playsinline muted style="width:100%;border-radius:12px;display:none;background:#000"></video><p class="help">可以掃描電腦上的 QR，或直接輸入電腦顯示的 10 位代碼。</p><label>登入代碼</label><input id="mzQrCodeInput" autocapitalize="characters" autocorrect="off" autocomplete="off" spellcheck="false" placeholder="例如 ABCDE 23456" style="letter-spacing:2px"><div class="sheet-actions"><button class="pill primary" data-action="mzQrApproveSubmit">核准這台電腦登入</button></div>');
    (async () => {
      try {
        if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) return;
        const det = new BarcodeDetector({ formats: ["qr_code"] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        const video = document.querySelector("#mzQrVideo");
        if (!video || mzQrScanSeq !== mine) { stream.getTracks().forEach(t => t.stop()); return; }
        video.srcObject = stream; video.style.display = ""; await video.play().catch(() => {});
        const tick = async () => {
          if (mzQrScanSeq !== mine || !document.querySelector("#mzQrVideo")) { stream.getTracks().forEach(t => t.stop()); return; }
          try {
            const codes = await det.detect(video);
            if (codes && codes[0]?.rawValue) {
              const m = String(codes[0].rawValue).replace(/^mizuki-qrlogin:/i, "").replace(/[\s-]/g, "").toUpperCase();
              const inp = document.querySelector("#mzQrCodeInput");
              if (inp && m) { inp.value = m; stream.getTracks().forEach(t => t.stop()); actions.mzQrApproveSubmit(); return; }
            }
          } catch {}
          setTimeout(tick, 350);
        };
        tick();
      } catch {}
    })();
  };
  actions.mzQrApproveSubmit = async () => {
    mzQrScanSeq++;
    const inp = document.querySelector("#mzQrCodeInput");
    const code = (inp?.value || "").replace(/^mizuki-qrlogin:/i, "").replace(/[\s-]/g, "").toUpperCase();
    if (code.length < 6) { toast("請先輸入電腦上的登入代碼"); return; }
    try { await WebEngine.humanRequest("/v1/qrlogin/approve", { code }); closeModal(); toast("已核准，電腦會自動登入"); }
    catch (e) { toast("核准失敗：" + (e.message || "代碼不正確或已過期")); }
  };
})();

// 3.2.1: after sending a message with several lines, the input box shrinks back to one line.
{
  const baseSend = sendMessage;
  const shrink = () => {
    const box = document.querySelector(".composer textarea");
    if (box && !box.value) box.style.height = "";
  };
  // 3.2.2: tapping send took focus away, so the redrawn input came back without the keyboard.
  const isSend = (t) => t?.closest?.('.composer button[type="submit"]');
  let keepKeyboard = false;
  document.addEventListener("pointerdown", (e) => { if (isSend(e.target)) keepKeyboard = document.activeElement?.matches?.(".composer textarea") || false; }, true);
  document.addEventListener("mousedown", (e) => { if (isSend(e.target)) e.preventDefault(); }, true);
  const refocus = () => document.querySelector(".composer textarea")?.focus({ preventScroll: true });
  sendMessage = function (...args) {
    const keep = keepKeyboard || document.activeElement?.matches?.(".composer textarea");
    keepKeyboard = false;
    const r = baseSend.apply(this, args);
    if (keep) {
      refocus();
      setTimeout(refocus, 0);
    }
    shrink();
    setTimeout(shrink, 0);
    Promise.resolve(r).finally(shrink).catch(() => {});
    return r;
  };
}

// 3.2.1: iPhone swipe-back. WKWebView has no back gesture of its own and Android's comes from the system, so
// a right swipe goes back, with the screen following the finger: from the left edge anywhere, or from any
// spot that has no swipe of its own (a message bubble keeps swipe-to-reply). Add ?swipeback=1 to test it elsewhere.
if (window.IOSHost || /[?&]swipeback=1\b/.test(location.search)) {
  const EDGE = 28;
  let g = null;
  const scrollsSideways = (el) => {
    for (; el && el !== document.body; el = el.parentElement)
      if (el.scrollWidth > el.clientWidth + 2 && /(auto|scroll)/.test(getComputedStyle(el).overflowX)) return true;
    return false;
  };
  const canStart = (t, x, y) => {
    if (!(chatId || page) || modal || callOverlay || y > innerHeight - 56) return false;
    if (!t.closest?.("#app") || document.querySelector(".modal-backdrop")) return false;
    if (t.closest("input,textarea,select,audio,video,.composer,.composer-menu,.sticker-panel")) return false;
    if (x <= EDGE) return true;
    return page !== "records" && !t.closest(".message-body") && !scrollsSideways(t);
  };
  const release = (el, ms) => {
    el.style.transition = "transform " + ms + "ms ease-out";
    el.style.transform = "";
    setTimeout(() => { el.style.transition = ""; el.style.willChange = ""; }, ms + 20);
  };
  document.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    g = e.touches.length === 1 && canStart(e.target, t.clientX, t.clientY) ? { x: t.clientX, y: t.clientY, dx: 0, axis: "", el: null } : null;
  }, { passive: true, capture: true });
  document.addEventListener("touchmove", (e) => {
    const t = e.touches[0];
    if (!g || !t) return;
    const dx = t.clientX - g.x, dy = t.clientY - g.y;
    if (!g.axis && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      g.axis = dx > 0 && dx > Math.abs(dy) * 1.2 ? "x" : "y";
      if (g.axis === "x") {
        g.el = document.querySelector("#app .conversation, #app .page");
        if (g.el) g.el.style.willChange = "transform";
      }
    }
    if (g.axis === "y") { g = null; return; }
    if (g.axis === "x" && g.el) {
      g.dx = Math.max(0, dx);
      g.el.style.transform = "translateX(" + g.dx + "px)";
    }
  }, { passive: true, capture: true });
  document.addEventListener("touchend", () => {
    const d = g;
    g = null;
    if (!d?.el) return;
    if (d.dx < Math.min(90, innerWidth * 0.25)) return release(d.el, 160);
    d.el.style.transition = "transform 130ms ease-out";
    d.el.style.transform = "translateX(100%)";
    setTimeout(() => {
      window.goBack();
      if (d.el.isConnected) release(d.el, 0);
    }, 130);
  }, { passive: true, capture: true });
  document.addEventListener("touchcancel", () => {
    if (g?.el) release(g.el, 160);
    g = null;
  }, { passive: true, capture: true });
}
