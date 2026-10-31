"use strict";
// Mizuki 2.1.6 — speed and battery, instant sending, live message wake-ups, appearance switch,
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
/* 9. 2.1.6 release post (official Moments)                             */
/* ------------------------------------------------------------------ */
const MZ_KAOMOJI_RAW = "٩(ˊᗜˋ*)و",
  MZ_KAOMOJI_FIXED = "٩‎(ˊᗜˋ*)‎و";
const MZ_RELEASE_216_EN = `Mizuki 2.1.6 is here! ( ੭ ˙ᗜ˙ )੭ This update makes Mizuki faster and lighter on your battery, and fixes the little problems you told us about one by one.

- Sending: Messages appear the moment you send them — no more two-second wait.
- Performance: Less background syncing and redrawing, so the app runs smoother and your phone stays cooler.
- Back: Going back to the previous page no longer gets stuck.
- Calls: Clearer, smoother video and live screen sharing.
- Live sharing: Fixed the black background after a live share ends.
- Image generation: Fixed images not generating after saving a separate image API key.
- Email: Fixed error 500 when binding an email address.
- Settings: Tidied up Language, Appearance, Sounds and Chats, and added an "Always keep appearance" switch to Memory.

If anything still feels off, come and tell Mizuki — I'm always here! (｡•ᴗ•｡)`;
{
  const version = "2.1.6",
    id = "official-release-" + version;
  let busy = false;
  const english = () => {
    const choice = state?.settings?.uiLanguage || "system";
    return choice === "en" || (choice === "system" && /^en(?:-|$)/i.test(navigator.language || ""));
  };
  const ensure = async () => {
    if (busy || !state?.moments || typeof officialReleaseText !== "string") return;
    if (state.moments.some((p) => p.id === id)) return;
    busy = true;
    try {
      await mutate("officialReleasePost", { version, text: officialReleaseText });
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
        if (p.id === id) p.text = english() ? MZ_RELEASE_216_EN : officialReleaseText;
        // Older official posts stored the kaomoji without bidi marks; show them aligned.
        else if (p.id?.startsWith("official-release-") && p.text?.includes(MZ_KAOMOJI_RAW)) p.text = p.text.split(MZ_KAOMOJI_RAW).join(MZ_KAOMOJI_FIXED);
      }
    base();
  };
}

/* ------------------------------------------------------------------ */
/* 10. Styles                                                            */
/* ------------------------------------------------------------------ */
{
  const st = document.createElement("style");
  st.textContent = `.mz-call .mz-v.mz-stale{display:none}`;
  document.head.append(st);
}
if (state) render();
