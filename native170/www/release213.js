"use strict";
// Mizuki 2.1.3 — iOS chat scrolling, themed / custom call backgrounds, phone screen live sharing
// (whole screen or a single app, paused instead of stopped), Android background notifications.

/* ------------------------------------------------------------------ */
/* 1. iOS: the page itself must never scroll — only the message list   */
/* ------------------------------------------------------------------ */
if (window.IOSHost) {
  const st = document.createElement("style");
  document.documentElement.classList.add("mz-ios");
  st.textContent = `html.mz-ios,html.mz-ios body{overflow:hidden;overscroll-behavior:none;height:100%}
html.mz-ios #app{height:var(--app-height,100%);overflow:hidden}
html.mz-ios .message-scroll{overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-y:contain;touch-action:pan-y}`;
  document.head.append(st);
}

/* ------------------------------------------------------------------ */
/* 2. Call backgrounds: theme colours by default, custom per contact   */
/* ------------------------------------------------------------------ */
const MZ_BG_KEY = "mizuki-call-backgrounds";
let mzCallBgs = {};
WebEngine.get(MZ_BG_KEY)
  .then((v) => {
    if (v && typeof v === "object") mzCallBgs = v;
  })
  .catch(() => {});
function mzCallKeyNow() {
  if (VoiceUI.rtc?.peer) return "human:" + VoiceUI.rtc.peer;
  if (VoiceUI.ai?.ai) return "ai:" + VoiceUI.ai.ai;
  return "";
}
function mzCallBackgroundFor(key = mzCallKeyNow()) {
  return (key && mzCallBgs[key]) || "";
}
function mzChatCallKey() {
  if (chatId.startsWith("human:")) return chatId;
  const c = state?.chats?.find((x) => x.id === chatId);
  return c && c.members?.length === 1 ? "ai:" + c.members[0] : "";
}
async function mzShrinkImage(file) {
  const url = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(Error(mzT("無法讀取這張圖片", "Could not read this image")));
    i.src = url;
  });
  const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)),
    cv = document.createElement("canvas");
  cv.width = Math.round(img.naturalWidth * scale);
  cv.height = Math.round(img.naturalHeight * scale);
  cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL("image/jpeg", 0.85);
}
actions.mzCallBackground = () => {
  const key = mzChatCallKey();
  if (!key) return;
  const cur = mzCallBgs[key] || "";
  showModal(
    mzT("通話背景", "Call background"),
    `<p class="help">${mzT("只套用在和這位聊天對象通話時。沒有設定時，會使用目前主題的配色。", "Used only for calls with this contact. Without one, the call screen uses your theme colours.")}</p><div class="mz-bg-preview ${cur ? "" : "mz-bg-theme"}" ${cur ? `style="background-image:url('${cur}')"` : ""}><span>${cur ? "" : mzT("主題配色", "Theme colours")}</span></div><div class="sheet-actions"><button class="pill primary" data-action="mzPickCallBackground">${mzT("選擇圖片", "Choose image")}</button>${cur ? `<button class="pill" data-action="mzClearCallBackground">${mzT("恢復主題配色", "Use theme colours")}</button>` : ""}</div>`,
  );
};
actions.mzPickCallBackground = () => {
  const key = mzChatCallKey();
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.onchange = async () => {
    try {
      const file = input.files?.[0];
      if (!file) return;
      mzCallBgs = { ...mzCallBgs, [key]: await mzShrinkImage(file) };
      await WebEngine.put(MZ_BG_KEY, mzCallBgs);
      actions.mzCallBackground();
      toast(mzT("通話背景已更新", "Call background updated"));
    } catch (e) {
      toast(e.message);
    }
  };
  input.click();
};
actions.mzClearCallBackground = async () => {
  const key = mzChatCallKey(),
    next = { ...mzCallBgs };
  delete next[key];
  mzCallBgs = next;
  await WebEngine.put(MZ_BG_KEY, mzCallBgs);
  actions.mzCallBackground();
};
{
  const options = chatOptions;
  chatOptions = function () {
    options();
    const sheet = document.querySelector(".sheet");
    if (sheet && mzChatCallKey() && !sheet.querySelector('[data-action="mzCallBackground"]'))
      sheet.insertAdjacentHTML("beforeend", `<button class="setting-choice" data-action="mzCallBackground">${mzT("通話背景", "Call background")}　›</button>`);
  };
  actions.chatOptions = chatOptions;
}

/* ------------------------------------------------------------------ */
/* 3. Phone screen live sharing (Android)                              */
/* ------------------------------------------------------------------ */
const MZS = { on: false, paused: false, canvas: null, ctx: null, stream: null, mode: "", keep: 0 };
function mzScreenSupported() {
  return !!(window.AndroidHost && window.Desktop?.invoke && HTMLCanvasElement.prototype.captureStream);
}
function mzDrawPaused() {
  if (!MZS.ctx) return;
  const { canvas: cv, ctx } = MZS;
  ctx.fillStyle = "rgba(20,16,26,.72)";
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = `600 ${Math.round(cv.width / 16)}px sans-serif`;
  ctx.fillText(mzT("當前直播已暫停", "Live share paused"), cv.width / 2, cv.height / 2);
  ctx.font = `${Math.round(cv.width / 28)}px sans-serif`;
  ctx.fillText(mzT("回到分享的畫面後會自動繼續", "It resumes when the shared app is back"), cv.width / 2, cv.height / 2 + cv.width / 12);
}
async function mzSignalMedia(c) {
  if (!c?.id) return;
  const media = { camera: !!c.cameraStream, screen: !!c.screenStream, muted: !!c.muted };
  if (c.screenStream && MZS.paused) media.paused = true;
  await rtcRequest("media", { id: c.id, media }).catch(() => rtcRequest("media", { id: c.id, media: { camera: media.camera, screen: media.screen, muted: media.muted } }).catch(() => {}));
}
window.mizukiScreenFrame = (url) => {
  if (!MZS.on || !MZS.ctx) return;
  const img = new Image();
  img.onload = () => {
    const cv = MZS.canvas;
    if (cv.width !== img.naturalWidth || cv.height !== img.naturalHeight) {
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
    }
    MZS.ctx.drawImage(img, 0, 0);
    if (MZS.paused) mzDrawPaused();
  };
  img.src = url;
};
window.mizukiScreenState = (s) => {
  if (s?.error) toast(mzT("直播失敗：", "Live share failed: ") + s.error, 6000);
  if (s?.stopped || s?.error) return mzStopScreen(false);
  if (typeof s?.paused === "boolean" && MZS.on) {
    MZS.paused = s.paused;
    if (MZS.paused) mzDrawPaused();
    mzSignalMedia(VoiceUI.rtc);
    mzCallRender?.();
  }
};
async function mzStartScreen(mode) {
  const c = VoiceUI.rtc;
  if (!c?.pc) throw Error(mzT("通話接通後才能直播畫面", "Start live sharing after the call connects"));
  if (!c.screen) c.screen = c.pc.getTransceivers().find((t) => t.mid === "2");
  if (!c.screen) throw Error(mzT("這通電話無法直播畫面，請重新撥打", "This call cannot share the screen; call again"));
  const cv = document.createElement("canvas");
  cv.width = 720;
  cv.height = 1280;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = "#1d1724";
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "600 40px sans-serif";
  ctx.fillText(mzT("正在準備直播…", "Starting live share…"), 360, 640);
  const stream = cv.captureStream(10);
  Object.assign(MZS, { on: true, paused: false, canvas: cv, ctx, stream, mode });
  try {
    await c.screen.sender.replaceTrack(stream.getVideoTracks()[0]);
    c.screenStream = stream;
    await Desktop.invoke("screenShare", { start: true, mode });
  } catch (e) {
    await mzStopScreen(false);
    throw e;
  }
  // Keep a frame flowing while paused so receivers keep the "paused" card.
  clearInterval(MZS.keep);
  MZS.keep = setInterval(() => MZS.on && MZS.paused && mzDrawPaused(), 1000);
  await mzSignalMedia(c);
  mzCallRender?.();
}
async function mzStopScreen(native = true) {
  const c = VoiceUI.rtc,
    was = MZS.on;
  clearInterval(MZS.keep);
  MZS.on = false;
  MZS.paused = false;
  MZS.stream?.getTracks().forEach((t) => t.stop());
  MZS.stream = null;
  MZS.ctx = null;
  if (c?.screenStream) {
    try {
      await c.screen?.sender.replaceTrack(null);
    } catch {}
    c.screenStream = null;
  }
  if (native && window.AndroidHost) await Desktop.invoke("screenStop").catch(() => {});
  if (was) await mzSignalMedia(c);
  if (typeof mzCallRender === "function") mzCallRender();
}
actions.mzScreenMenu = () => {
  if (MZS.on) return mzStopScreen(true);
  if (!mzScreenSupported()) return toast(mzT("這台裝置目前無法直播畫面", "Live sharing isn't available on this device"));
  const ver = Number((navigator.userAgent.match(/Android (\d+)/) || [])[1] || 0);
  showModal(
    mzT("直播畫面", "Live share"),
    `<div class="mz-status-list"><button class="mz-status-row" data-mzscreen="screen"><span><strong>${mzT("整個手機畫面", "Entire screen")}</strong><small>${mzT("對方會看到你手機上顯示的所有內容", "They see everything on your screen")}</small></span></button><button class="mz-status-row" data-mzscreen="app" ${ver && ver < 14 ? "disabled" : ""}><span><strong>${mzT("單一 App 畫面", "A single app")}</strong><small>${ver && ver < 14 ? mzT("需要 Android 14 以上", "Needs Android 14+") : mzT("只直播你選的 App；切到別的畫面時會顯示「直播已暫停」", "Only the chosen app; shows “paused” when you leave it")}</small></span></button></div><p class="help">${mzT("系統會再請你確認一次。直播時通知列會顯示「正在直播畫面」。", "Android asks you to confirm. A notification shows while sharing.")}</p>`,
  );
};
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-mzscreen]");
  if (!b) return;
  closeModal();
  try {
    await mzStartScreen(b.dataset.mzscreen);
  } catch (err) {
    toast(err.message, 5000);
  }
});
{
  const hide = hideCall;
  hideCall = function () {
    if (MZS.on) mzStopScreen(true);
    hide();
  };
}
// Add the 直播畫面 button to the mobile call screen and show "paused" for incoming shares.
{
  const draw = typeof mzCallRender === "function" ? mzCallRender : null;
  if (draw && !window.MushuiDesktop)
    mzCallRender = function () {
      draw();
      const el = callOverlay;
      if (!el?.classList.contains("mz-call")) return;
      const c = VoiceUI.rtc,
        mini = el.querySelector(".mz-row-mini");
      if (mini && c?.pc && c.connected && mzScreenSupported()) {
        let btn = mini.querySelector('[data-action="mzScreenMenu"]');
        if (!btn) {
          mini.insertAdjacentHTML(
            "beforeend",
            `<button class="mz-btn" data-action="mzScreenMenu"><span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 5h17v11h-17Z M8.5 20h7 M12 16v4 M9.5 10.5l2.5-2.5 2.5 2.5 M12 8v5"/></svg></span><small></small></button>`,
          );
          btn = mini.querySelector('[data-action="mzScreenMenu"]');
        }
        const label = MZS.on ? (MZS.paused ? mzT("直播已暫停", "Paused") : mzT("直播中", "Live")) : mzT("直播畫面", "Share screen");
        btn.classList.toggle("mz-on", MZS.on);
        const small = btn.querySelector("small");
        if (small.textContent !== label) small.textContent = label;
      }
      const paused = !!(c?.remoteMedia?.screen && c.remoteMedia.paused);
      el.classList.toggle("mz-remote-paused", paused);
    };
}

/* ------------------------------------------------------------------ */
/* 4. Android: background message / call notifications                 */
/* ------------------------------------------------------------------ */
if (window.AndroidHost && window.Desktop?.invoke) {
  let last = "";
  const push = () => {
    const h = state?.human,
      enabled = !!(h?.connected && h.serverUrl && h.me?.id),
      sig = JSON.stringify([enabled, h?.serverUrl, h?.me?.id, document.hidden]);
    if (sig === last) return;
    last = sig;
    Desktop.invoke("bgNotify", { enabled, server: h?.serverUrl || "", me: h?.me?.id || "", foreground: !document.hidden }).catch(() => (last = ""));
  };
  document.addEventListener("visibilitychange", push);
  window.addEventListener("pagehide", () => {
    last = "";
    Desktop.invoke("bgNotify", { foreground: false, enabled: !!state?.human?.connected }).catch(() => {});
  });
  setInterval(push, 5000);
  setTimeout(push, 2000);
  // While the app is hidden the native service posts notifications; avoid duplicates from the page.
  const notice = window.mushuiMobileNotice;
  if (typeof notice === "function")
    window.mushuiMobileNotice = (details) => (document.hidden && !details?.clear && state?.human?.connected ? Promise.resolve(false) : notice(details));
}

/* ------------------------------------------------------------------ */
/* 5. iOS native call screen: theme colours + custom backgrounds       */
/* ------------------------------------------------------------------ */
if (window.webkit?.messageHandlers?.mushuiCall && typeof nativeCall === "function") {
  const base = nativeCall;
  const theme = () => {
    const cs = getComputedStyle(document.documentElement);
    return { accent: cs.getPropertyValue("--accent").trim(), deep: cs.getPropertyValue("--accent-deep").trim(), pink: cs.getPropertyValue("--pink").trim() };
  };
  const backgrounds = () => {
    const out = {};
    let total = 0;
    for (const [k, v] of Object.entries(mzCallBgs))
      if (k.startsWith("human:") && typeof v === "string" && total + v.length < 6_000_000) {
        out[k.slice(6)] = v;
        total += v.length;
      }
    return out;
  };
  nativeCall = async function (command, extra = {}) {
    if (command === "start" || command === "profiles") extra = { ...extra, theme: theme(), backgrounds: backgrounds() };
    return base(command, extra);
  };
  let sig = "";
  setInterval(() => {
    if (!state?.human?.connected) return;
    const t = theme(),
      s = JSON.stringify(t) + Object.entries(mzCallBgs).map(([k, v]) => k + v.length).join();
    if (s === sig) return;
    sig = s;
    base("profiles", { theme: t, backgrounds: backgrounds() }).catch(() => (sig = ""));
  }, 15000);
}

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */
{
  const st = document.createElement("style");
  st.textContent = `
.mz-bg-preview{height:180px;border-radius:20px;margin:12px 0;background-size:cover;background-position:center;display:grid;place-items:center;color:#fff;font-weight:600;box-shadow:inset 0 0 0 1px #ffffff40}
.mz-bg-theme{background:linear-gradient(165deg,color-mix(in srgb,var(--accent) 78%,#1d1724),color-mix(in srgb,var(--accent-deep) 82%,#0c0a10))}
.mz-call.mz-custom-bg .mz-call-shade{background:linear-gradient(#00000066,#00000033 40%,#00000080)}
.mz-row-mini{gap:18px;justify-content:center}
body:has(.call-overlay.mz-call:not(.mz-min)) #overlay{position:relative;z-index:420!important}body:has(.call-overlay.mz-call:not(.mz-min)) .modal-backdrop{z-index:420!important}
body:has(.call-overlay.mz-call:not(.mz-min)) #toast{z-index:430}
.mz-remote-paused .mz-v-screen::after{content:"對方的直播已暫停";position:absolute;inset:0;display:grid;place-items:center;background:#14101ab8;color:#fff;font-weight:600;font-size:18px}
`;
  document.head.append(st);
}
if (state) render();
