"use strict";
// Mizuki 2.1.3 — dark theme, online status (presence), redesigned mobile call screen with
// speaker / earpiece, permission gate, full-screen video, self-view PiP, camera flip and a
// background-call bar. Loaded after release206.js and wraps the globals it needs.

const mzEn = () => window.MushuiLocale === "en";
const mzT = (zh, en) => (mzEn() ? en : zh);

/* ------------------------------------------------------------------ */
/* 1. Dark theme                                                       */
/* ------------------------------------------------------------------ */
const MZ_DARK_KEY = "mizuki-dark-mode";
function mzDarkPref() {
  try {
    return localStorage.getItem(MZ_DARK_KEY) || "system";
  } catch {
    return "system";
  }
}
const mzDarkQuery = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
function mzApplyDark() {
  const pref = mzDarkPref(),
    dark = pref === "dark" || (pref === "system" && !!mzDarkQuery?.matches);
  document.documentElement.classList.toggle("mz-dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#16131b" : "#f9f5fa");
}
mzDarkQuery?.addEventListener?.("change", mzApplyDark);
mzApplyDark();

{
  const before = appearancePage;
  appearancePage = function () {
    const pref = mzDarkPref(),
      opt = (id, zh, en) => `<button class="mz-seg ${pref === id ? "selected" : ""}" data-mzdark="${id}">${mzT(zh, en)}</button>`;
    return (
      `<div class="card mz-dark-card"><h3>${mzT("深色模式", "Dark mode")}</h3><p class="help">${mzT("夜晚看起來更舒服；「跟隨系統」會隨手機或電腦的設定自動切換。", "Easier on the eyes at night. “Follow system” switches with your device.")}</p><div class="mz-segs">${opt("system", "跟隨系統", "Follow system")}${opt("light", "淺色", "Light")}${opt("dark", "深色", "Dark")}</div></div>` +
      before()
    );
  };
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-mzdark]");
  if (!b) return;
  try {
    localStorage.setItem(MZ_DARK_KEY, b.dataset.mzdark);
  } catch {}
  mzApplyDark();
  document.querySelectorAll("[data-mzdark]").forEach((x) => x.classList.toggle("selected", x === b));
});

/* ------------------------------------------------------------------ */
/* 2. Online status                                                    */
/* ------------------------------------------------------------------ */
const MZ_STATUS = {
  online: ["在線", "Online", "#34c759"],
  leisure: ["休閒", "Leisure", "#32ade6"],
  dnd: ["請勿打擾", "Do not disturb", "#ff3b5c"],
  busy: ["忙碌", "Busy", "#ff9f0a"],
  offline: ["離線", "Offline", "#a7a0ae"],
  custom: ["自定義", "Custom", "#a080ba"],
};
window.MizukiPresence = { me: { status: "online", custom: "" }, friends: {}, held: false };
function mzPresenceLabel(p) {
  const s = MZ_STATUS[p?.status] ? p.status : "online";
  if (s === "custom") return p.text || p.custom || MZ_STATUS.custom[0];
  return mzT(MZ_STATUS[s][0], MZ_STATUS[s][1]);
}
function mzPresenceDot(p) {
  const s = MZ_STATUS[p?.status] ? p.status : "online";
  return `<i class="mz-pdot mz-p-${s}" style="--pc:${MZ_STATUS[s][2]}"></i>`;
}
function mzFriendPresence(id) {
  return window.MizukiPresence.friends[id] || humanFriend(id)?.presence || null;
}
{
  const W = WebEngine,
    request = W.humanRequest;
  W.humanRequest = async (path, body, authorized = true) => {
    const r = await request(path, body, authorized);
    if (r && typeof path === "string" && path.startsWith("/v1/sync")) {
      if (r.presence) window.MizukiPresence.me = r.presence;
      window.MizukiPresence.held = !!r.held;
      for (const f of r.friends || []) if (f.presence) window.MizukiPresence.friends[f.id] = f.presence;
    }
    return r;
  };
}
let mzPresencePolling = false;
async function mzPollPresence(force) {
  if (mzPresencePolling || !state?.human?.connected || (document.hidden && !force)) return;
  mzPresencePolling = true;
  try {
    const ids = humanData().friends.map((f) => f.id).join(",");
    const r = await WebEngine.humanRequest("/v1/presence?ids=" + encodeURIComponent(ids));
    const sig = JSON.stringify([r.me, r.friends]);
    window.MizukiPresence.me = r.me || window.MizukiPresence.me;
    Object.assign(window.MizukiPresence.friends, r.friends || {});
    if (sig !== mzPollPresence.sig) {
      mzPollPresence.sig = sig;
      mzPaintPresence();
    }
  } catch {
  } finally {
    mzPresencePolling = false;
  }
}
setInterval(() => mzPollPresence(), 15000);
setTimeout(() => mzPollPresence(), 2500);

function mzMeProfile() {
  const me = state?.human?.me || {};
  return { id: me.id, name: me.name || state?.settings?.nickname || "我", avatar: me.avatar || "" };
}
function mzPaintPresence() {
  if (!state) return;
  // Chat list header (image 2): avatar + name + status.
  if (tab === "chats" && !chatId && state.human?.connected) {
    const head = document.querySelector("main.page > header.top");
    const title = head?.querySelector(".between > div:first-child");
    if (title) {
      const me = mzMeProfile(),
        p = window.MizukiPresence.me;
      let box = head.querySelector(".mz-me-head");
      if (!box) {
        title.classList.add("mz-hidden-title");
        title.insertAdjacentHTML("afterend", '<button class="mz-me-head" data-action="mzPresencePicker"></button>');
        box = head.querySelector(".mz-me-head");
      }
      const html = `${avatar(me, "mz-me-face")}<span class="mz-me-text"><strong>${esc(me.name)}</strong><small>${mzPresenceDot(p)}${esc(mzPresenceLabel(p))}<b>›</b></small></span>`;
      if (box.innerHTML !== html) box.innerHTML = html;
    }
  }
  // Presence dots on human chat rows.
  document.querySelectorAll(".chat-row[data-humanchat]").forEach((row) => {
    const id = row.dataset.humanchat;
    if (!id || id === MIZUKI_OFFICIAL_ID) return;
    const face = row.querySelector(".chat-face, .avatar");
    if (!face) return;
    const p = mzFriendPresence(id);
    face.classList.add("mz-face-dot");
    let dot = face.querySelector(":scope > .mz-pdot");
    const s = p?.status && MZ_STATUS[p.status] ? p.status : "offline";
    if (!dot) {
      face.insertAdjacentHTML("beforeend", mzPresenceDot({ status: s }));
      dot = face.querySelector(":scope > .mz-pdot");
    } else {
      dot.className = "mz-pdot mz-p-" + s;
      dot.style.setProperty("--pc", MZ_STATUS[s][2]);
    }
  });
  // Conversation header (image 3): "名字 · ● 在線 ›".
  if (chatId.startsWith("human:")) {
    const id = chatId.slice(6);
    if (id !== MIZUKI_OFFICIAL_ID && id !== "official-mushui") {
      const sub = document.querySelector(".conversation > .top .spacer p.small, .conversation > header.top .spacer .small");
      const p = mzFriendPresence(id);
      if (sub && p) {
        const html = `${mzPresenceDot(p)}${esc(mzPresenceLabel(p))}<b class="mz-chev">›</b>`;
        if (sub.innerHTML !== html) {
          sub.innerHTML = html;
          sub.classList.add("mz-sub-presence");
        }
      }
    }
  }
}

actions.mzPresencePicker = async () => {
  const me = window.MizukiPresence.me || {},
    row = (s) =>
      `<button class="mz-status-row ${me.status === s ? "selected" : ""}" data-mzstatus="${s}">${mzPresenceDot({ status: s })}<span><strong>${mzT(MZ_STATUS[s][0], MZ_STATUS[s][1])}</strong><small>${
        {
          online: mzT("好友可以看到你在線上", "Friends see you are online"),
          leisure: mzT("有空，歡迎找我聊天", "Free to chat"),
          dnd: mzT("不接收任何訊息、通知與來電，切回後才會一次收到", "No messages, notifications or calls until you switch back"),
          busy: mzT("仍會收到訊息，好友會看到你在忙", "Messages still arrive; friends see you are busy"),
          offline: mzT("隱身，好友會看到你離線", "Appear offline to friends"),
          custom: mzT("自己寫一句狀態", "Write your own status"),
        }[s]
      }</small></span>${me.status === s ? "<b>✓</b>" : ""}</button>`;
  showModal(
    mzT("線上狀態", "Online status"),
    `<div class="mz-status-list">${["online", "leisure", "busy", "dnd", "offline", "custom"].map(row).join("")}</div><div class="mz-custom-box"><label for="mzCustomStatus">${mzT("自定義狀態", "Custom status")}</label><div class="flex"><input id="mzCustomStatus" maxlength="24" placeholder="${mzT("例如：寫作業中", "e.g. Studying")}" value="${esc(me.custom || "")}"><button class="pill primary" data-mzstatus="custom-save">${mzT("使用", "Use")}</button></div></div>`,
  );
};
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-mzstatus]");
  if (!b) return;
  let status = b.dataset.mzstatus,
    custom = "";
  if (status === "custom") {
    document.getElementById("mzCustomStatus")?.focus();
    return;
  }
  if (status === "custom-save") {
    status = "custom";
    custom = document.getElementById("mzCustomStatus")?.value.trim() || "";
    if (!custom) return toast(mzT("請輸入自定義狀態文字", "Type a custom status"));
  }
  b.disabled = true;
  try {
    const r = await WebEngine.humanRequest("/v1/presence", { status, custom });
    window.MizukiPresence.me = r.me;
    closeModal();
    toast(mzT("線上狀態：", "Status: ") + mzPresenceLabel(r.me));
    if (status !== "dnd") actions.humanSync?.().catch?.(() => {});
    render();
  } catch (err) {
    const box = document.getElementById("modalError");
    if (box) box.textContent = /404|找不到此功能/.test(err.message) ? mzT("伺服器尚未更新到 2.1.3，請先部署新版伺服器", "Server is older than 2.1.3") : err.message;
  } finally {
    b.disabled = false;
  }
});

/* ------------------------------------------------------------------ */
/* 3. Call screen (Android / web / AI calls on iOS)                    */
/* ------------------------------------------------------------------ */
const MZC = { speaker: false, userSpeaker: false, minimized: false, since: 0, facing: "user", busy: false, tick: null, native: null, key: "" };
const MZI = {
  mic: '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3 M5 10v2a7 7 0 0 0 14 0v-2 M12 19v3"/>',
  micOff: '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 5.1 2.1 M15 9V6 M5 10v2a7 7 0 0 0 11.6 5.3 M19 10v2 M12 19v3 M3 3l18 18"/>',
  hang: '<path d="M3.5 14.5c4.7-4 12.3-4 17 0l-1.8 2.6-3.6-1.3v-2.4a10 10 0 0 0-6.2 0v2.4l-3.6 1.3Z"/>',
  phone: '<path d="M5 3h4l2 5-3 2a15 15 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2C9 21 3 15 3 5a2 2 0 0 1 2-2Z"/>',
  handset: '<path d="M8 2.5h8a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5Z M11 18.5h2"/>',
  volume: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z M15.5 9a4 4 0 0 1 0 6 M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  camera: '<path d="M3.5 7.5h11v9h-11Z M14.5 10.5l6-3v9l-6-3"/>',
  cameraOff: '<path d="M3.5 7.5h8 M14.5 11V7.5h-3 M14.5 10.5l6-3v9l-6-3 M3.5 7.5v9h11v-2 M3 3l18 18"/>',
  flip: '<path d="M4 8.5h3l1.5-2h7l1.5 2h3v10H4Z M9 13.5a3 3 0 0 1 5.2-2 M15 13.5a3 3 0 0 1-5.2 2 M14.5 9.8v1.9h-1.9 M9.5 17.2v-1.9h1.9"/>',
  pip: '<path d="M3.5 5.5h17v13h-17Z M12 12h6v4.5h-6Z"/>',
};
const mzSvg = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${MZI[n]}</svg>`;
const MZ_MOBILE_CALL = !window.MushuiDesktop;

function mzCallPerson() {
  if (VoiceUI.rtc?.peer) return humanFriend(VoiceUI.rtc.peer);
  if (VoiceUI.ai?.ai) return ai(VoiceUI.ai.ai);
  if (MZC.native?.peer) return humanFriend(MZC.native.peer);
  return null;
}
function mzCallPhase() {
  const c = VoiceUI.rtc;
  if (c && c.offer && !c.pc) return "incoming";
  if (c?.pc) return c.connected ? "active" : "outgoing";
  if (VoiceUI.ai) return "ai";
  return "other";
}
function mzImgUrl(p) {
  const a = p?.avatar || "";
  return /^data:image\/(jpeg|png|webp);base64,/.test(a) || /^[\w./-]+\.(png|jpe?g|webp)$/.test(a) ? a : "";
}
function mzDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)),
    h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60,
    two = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${two(m)}:${two(sec)}` : `${two(m)}:${two(sec)}`;
}
function mzRemoteVideo(c) {
  if (!c?.pc) return null;
  if (c.remoteMedia?.screen && c.remoteScreen) return "remoteScreen";
  if (c.remoteMedia?.camera && c.remoteCamera) return "remoteCamera";
  return null;
}

async function mzCallAudio(active) {
  if (!window.AndroidHost || !window.Desktop?.invoke) return;
  try {
    await Desktop.invoke("callAudio", { active, speaker: MZC.speaker });
  } catch {}
}

async function mzEnsurePermissions(video = false) {
  // Permission gate before placing or answering a call.
  if (window.AndroidHost && window.Desktop?.invoke) {
    const mic = await call("microphone").catch((e) => ({ granted: false, error: e.message }));
    if (!mic.granted) throw Error(mzT("請先允許麥克風權限，才能撥打或接聽電話", "Allow microphone access to make or answer calls"));
    const cam = await Desktop.invoke("cameraPermission").catch(() => ({ granted: false }));
    if (!cam.granted && video) throw Error(mzT("請先允許相機權限，才能開啟視訊", "Allow camera access to use video"));
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) throw Error(mzT("此裝置不支援通話，請確認使用 HTTPS 並更新瀏覽器", "Calls need HTTPS and a recent browser"));
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    s.getTracks().forEach((t) => t.stop());
  } catch {
    throw Error(mzT("請先允許麥克風權限，才能撥打或接聽電話", "Allow microphone access to make or answer calls"));
  }
}

function mzCallSkeleton() {
  callOverlay.classList.add("mz-call");
  callOverlay.innerHTML = `<div class="mz-call-bg"></div><div class="mz-call-shade"></div>
<div class="mz-videos"><figure class="mz-v mz-v-remote" hidden><video id="remoteCamera" autoplay playsinline></video></figure><figure class="mz-v mz-v-screen" hidden><video id="remoteScreen" autoplay playsinline></video></figure><figure class="mz-v mz-v-local" hidden><video id="localCamera" autoplay playsinline muted></video></figure><figure class="mz-v" hidden><video id="localScreen" autoplay playsinline muted></video></figure></div>
<div class="mz-call-top"><button class="mz-top-btn" data-action="mzCallMinimize" aria-label="${mzT("縮小，背景通話", "Minimize")}">${mzSvg("pip")}</button><div class="mz-top-mid"><strong></strong><small></small></div><button class="mz-top-btn mz-flip" data-action="mzFlipCamera" aria-label="${mzT("切換前後鏡頭", "Switch camera")}">${mzSvg("flip")}</button></div>
<div class="mz-call-id"><div class="mz-face"></div><h2></h2><p class="mz-chip status" id="voiceCallStatus"></p><div class="mz-dots"><i></i><i></i><i></i></div></div>
<div class="mz-call-actions"></div>`;
  callOverlay.addEventListener("pointerdown", () => VoiceUI.remoteAudio?.paused && VoiceUI.remoteAudio.play().catch(() => {}), true);
  // The small self-view can be tapped to swap it with the remote picture.
  callOverlay.querySelector(".mz-v-local").addEventListener("click", () => {
    MZC.swap = !MZC.swap;
    mzCallRender();
  });
}

function mzBtn(action, icon, label, cls = "") {
  return `<button class="mz-btn ${cls}" data-action="${action}"><span>${mzSvg(icon)}</span><small>${label}</small></button>`;
}

function mzAttach(id, stream) {
  const v = document.getElementById(id);
  if (!v) return;
  if (v.srcObject !== (stream || null)) v.srcObject = stream || null;
  if (stream && v.paused) v.play().catch(() => {});
}

function mzCallRender() {
  if (!callOverlay || !callOverlay.classList.contains("mz-call")) return;
  const el = callOverlay,
    c = VoiceUI.rtc,
    phase = mzCallPhase(),
    p = mzCallPerson(),
    name = MZC.name || p?.name || "",
    img = mzImgUrl(p);
  if (c?.connected && !MZC.since) MZC.since = Date.now();
  // Videos
  const remote = mzRemoteVideo(c),
    local = !!c?.cameraStream,
    video = !!(remote || local);
  if (c?.pc) {
    mzAttach("remoteCamera", c.remoteCamera);
    mzAttach("remoteScreen", c.remoteScreen);
    mzAttach("localCamera", c.cameraStream);
  }
  el.querySelector(".mz-v-remote").hidden = remote !== "remoteCamera";
  el.querySelector(".mz-v-screen").hidden = remote !== "remoteScreen";
  el.querySelector(".mz-v-local").hidden = !local;
  el.classList.toggle("mz-video", video);
  el.classList.toggle("mz-both", !!(remote && local));
  el.classList.toggle("mz-swap", !!(remote && local && MZC.swap));
  el.classList.toggle("mz-local-only", local && !remote);
  el.classList.toggle("mz-mirror", MZC.facing === "user");
  el.classList.toggle("mz-has-camera", local);
  el.classList.toggle("mz-incoming", phase === "incoming");
  el.classList.toggle("mz-waiting", phase === "outgoing");
  // Auto speaker when video starts, unless the user picked a route.
  if (video && !MZC.speaker && !MZC.userSpeaker && c?.pc) {
    MZC.speaker = true;
    mzCallAudio(true);
  }
  // Identity
  const bg = el.querySelector(".mz-call-bg"),
    custom = typeof mzCallBackgroundFor === "function" ? mzCallBackgroundFor() : "",
    bgVal = custom ? `url("${custom}")` : "";
  el.classList.toggle("mz-custom-bg", !!custom);
  if (bg.dataset.img !== bgVal) {
    bg.dataset.img = bgVal;
    bg.style.backgroundImage = bgVal;
  }
  const face = el.querySelector(".mz-face"),
    faceHtml = img ? `<img src="${esc(img)}" alt="">` : `<span>${esc((name || "?").slice(0, 1))}</span>`;
  if (face.dataset.v !== faceHtml) {
    face.dataset.v = faceHtml;
    face.innerHTML = faceHtml;
  }
  el.querySelector(".mz-call-id h2").textContent = name;
  let status = MZC.status || "";
  if (phase === "outgoing") status = mzT("等待對方接受邀請", "Waiting for answer");
  else if (phase === "active") status = mzDuration(Date.now() - MZC.since);
  else if (phase === "incoming") status = mzT("邀請你語音通話", "is calling you");
  el.querySelector(".mz-chip").textContent = status;
  el.querySelector(".mz-top-mid strong").textContent = name;
  el.querySelector(".mz-top-mid small").textContent = phase === "active" ? mzDuration(Date.now() - MZC.since) : status;
  // Actions
  let html;
  if (phase === "incoming")
    html = `<div class="mz-row mz-row-two">${mzBtn("endHumanCall", "hang", mzT("拒絕", "Decline"), "mz-red")}${mzBtn("mzAnswer", "phone", mzT("接聽", "Answer"), "mz-green")}</div>`;
  else if (phase === "outgoing" || phase === "active") {
    const cam = c?.camera || c?.pc?.getTransceivers?.().find((t) => t.mid === "1");
    html =
      (cam ? `<div class="mz-row mz-row-mini">${mzBtn("desktopCamera", local ? "camera" : "cameraOff", local ? mzT("視訊已開啟", "Video on") : mzT("開啟視訊", "Video"), local ? "mz-on" : "")}</div>` : "") +
      `<div class="mz-row">${mzBtn("desktopMute", c?.muted ? "micOff" : "mic", c?.muted ? mzT("麥克風已關閉", "Mic off") : mzT("麥克風已開啟", "Mic on"), c?.muted ? "mz-on" : "")}${mzBtn(
        "endHumanCall",
        "hang",
        phase === "active" ? mzT("掛斷", "Hang up") : mzT("取消", "Cancel"),
        "mz-red mz-big",
      )}${mzBtn("mzSpeaker", MZC.speaker ? "volume" : "handset", MZC.speaker ? mzT("揚聲器", "Speaker") : mzT("一般", "Earpiece"), MZC.speaker ? "mz-on" : "")}</div>`;
  } else html = `<div class="mz-row mz-generic">${MZC.buttons || ""}</div>`;
  const box = el.querySelector(".mz-call-actions");
  if (box.dataset.v !== html) {
    box.dataset.v = html;
    box.innerHTML = html;
  }
  mzCallBar();
}

if (MZ_MOBILE_CALL) {
  callScreen = function (name, status, buttons) {
    if (!callOverlay) {
      callOverlay = document.createElement("section");
      callOverlay.className = "call-overlay";
      callOverlay.setAttribute("role", "dialog");
      document.body.append(callOverlay);
    }
    if (!callOverlay.classList.contains("mz-call")) mzCallSkeleton();
    const key = (VoiceUI.rtc?.id || "") + "|" + (VoiceUI.ai ? "ai" : "") + "|" + (MZC.native?.peer || "");
    if (key !== MZC.key) {
      MZC.key = key;
      MZC.minimized = false;
      MZC.swap = false;
    }
    callOverlay.classList.toggle("mz-min", MZC.minimized);
    MZC.name = name;
    MZC.status = String(status || "").replace(/\n/g, " ");
    MZC.buttons = buttons;
    mzCallRender();
    if (!MZC.tick)
      MZC.tick = setInterval(() => {
        if (!callOverlay) return mzStopTick();
        mzCallRender();
        const a = VoiceUI.remoteAudio;
        if (VoiceUI.rtc?.connected && a && a.paused) a.play().catch(() => {});
      }, 1000);
  };
  const baseHide = hideCall;
  hideCall = function () {
    baseHide();
    mzStopTick();
    MZC.minimized = false;
    MZC.since = 0;
    MZC.key = "";
    if (MZC.speaker || MZC.userSpeaker) {
      MZC.speaker = false;
      MZC.userSpeaker = false;
    }
    mzCallAudio(false);
    mzCallBar();
  };
}
function mzStopTick() {
  clearInterval(MZC.tick);
  MZC.tick = null;
}

actions.mzSpeaker = async () => {
  MZC.speaker = !MZC.speaker;
  MZC.userSpeaker = true;
  if (!window.AndroidHost) {
    // Browsers cannot pick the earpiece; keep the toggle but explain once.
    if (!mzSpeakerNoticeShown) toast(mzT("此裝置的聲音輸出由系統決定", "This device chooses the audio output"));
    mzSpeakerNoticeShown = true;
  }
  await mzCallAudio(true);
  mzCallRender();
};
let mzSpeakerNoticeShown = false;

actions.mzCallMinimize = () => {
  if (!callOverlay) return;
  MZC.minimized = true;
  callOverlay.classList.add("mz-min");
  mzCallBar();
};
actions.mzCallRestore = () => {
  if (MZC.native?.active && !callOverlay) {
    nativeCall("show").catch((e) => toast(e.message));
    return;
  }
  MZC.minimized = false;
  callOverlay?.classList.remove("mz-min");
  mzCallBar();
};

actions.mzAnswer = async () => {
  try {
    await mzEnsurePermissions(false);
  } catch (e) {
    toast(e.message, 6000);
    return;
  }
  MZC.speaker = false;
  MZC.userSpeaker = false;
  await actions.answerHumanCall();
  mzCallAudio(true);
};

{
  const start = actions.humanVoiceCall;
  actions.humanVoiceCall = async (...args) => {
    if (window.webkit?.messageHandlers?.mushuiCall) return start(...args); // iOS: native call asks for permission itself.
    await mzEnsurePermissions(false);
    MZC.speaker = false;
    MZC.userSpeaker = false;
    MZC.since = 0;
    await start(...args);
    mzCallAudio(true);
  };
}

async function mzSetCamera(on, facing) {
  const c = VoiceUI.rtc;
  if (c?.pc && !c.camera) c.camera = c.pc.getTransceivers().find((t) => t.mid === "1");
  if (!c?.camera) throw Error(mzT("通話尚未建立，請稍候再開啟視訊", "Call not ready yet"));
  let next = null;
  if (on) {
    if (window.AndroidHost && window.Desktop?.invoke) {
      const p = await Desktop.invoke("cameraPermission");
      if (!p.granted) throw Error(mzT("需要相機權限", "Camera permission needed"));
    }
    const size = { width: { ideal: 1280 }, height: { ideal: 720 } };
    try {
      next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: facing }, ...size }, audio: false });
    } catch {
      next = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, ...size }, audio: false });
    }
  }
  if (VoiceUI.rtc !== c || c.ended) {
    next?.getTracks().forEach((t) => t.stop());
    return;
  }
  try {
    await c.camera.sender.replaceTrack(next?.getVideoTracks()[0] || null);
  } catch (e) {
    next?.getTracks().forEach((t) => t.stop());
    throw e;
  }
  const old = c.cameraStream;
  c.cameraStream = next || null;
  old?.getTracks().forEach((t) => t.stop());
  MZC.facing = facing;
  mzCallRender();
  if (c.id) await rtcRequest("media", { id: c.id, media: { camera: !!c.cameraStream, screen: !!c.screenStream, muted: !!c.muted } }).catch(() => {});
}
if (MZ_MOBILE_CALL && !window.IOSHost) {
  actions.desktopCamera = async () => {
    if (MZC.busy) return;
    MZC.busy = true;
    try {
      await mzSetCamera(!VoiceUI.rtc?.cameraStream, MZC.facing);
    } finally {
      MZC.busy = false;
    }
  };
}
actions.mzFlipCamera = async () => {
  if (MZC.busy || !VoiceUI.rtc?.cameraStream) return;
  MZC.busy = true;
  try {
    await mzSetCamera(true, MZC.facing === "user" ? "environment" : "user");
  } finally {
    MZC.busy = false;
  }
};

// Back button during a call: keep talking in the background.
{
  const back = window.goBack;
  window.goBack = function () {
    if (callOverlay && !MZC.minimized && callOverlay.classList.contains("mz-call") && (VoiceUI.rtc || VoiceUI.ai)) {
      actions.mzCallMinimize();
      return true;
    }
    return back ? back() : false;
  };
}

// iOS native call state → green bar.
window.mizukiNativeCallState = function (s) {
  MZC.native = s && s.active ? s : null;
  mzCallBar();
};

/* Green "正在通話中 00:00" bar shown while a call runs in the background. */
function mzCallBar() {
  const nat = MZC.native,
    webMin = !!(callOverlay && MZC.minimized),
    show = webMin || !!(nat?.active && nat.minimized);
  let bar = document.getElementById("mzCallBar");
  document.body.classList.toggle("mz-has-callbar", show);
  if (!show) {
    bar?.remove();
    return;
  }
  if (!bar) {
    bar = document.createElement("button");
    bar.id = "mzCallBar";
    bar.dataset.action = "mzCallRestore";
    document.body.append(bar);
  }
  let text;
  if (webMin) {
    const ph = mzCallPhase();
    text =
      ph === "active"
        ? mzT("正在通話中 ", "In call ") + mzDuration(Date.now() - MZC.since)
        : ph === "incoming"
          ? mzT("來電中 · 點此返回通話", "Incoming call · tap to return")
          : ph === "outgoing"
            ? mzT("正在呼叫… 點此返回通話", "Calling… tap to return")
            : mzT("正在通話中 · 點此返回", "In call · tap to return");
  } else text = nat.connectedAt ? mzT("正在通話中 ", "In call ") + mzDuration(Date.now() - nat.connectedAt) : mzT("正在呼叫… 點此返回通話", "Calling… tap to return");
  const html = `${mzSvg("phone")}<span>${esc(text)}</span>`;
  if (bar.innerHTML !== html) bar.innerHTML = html;
}
setInterval(() => {
  if (MZC.native?.active) mzCallBar();
}, 1000);


// iOS: pass avatars to the native call screen so it can show the blurred photo backdrop.
if (window.webkit?.messageHandlers?.mushuiCall && typeof nativeCall === "function") {
  const baseNative = nativeCall;
  const mzAvatars = () => {
    const out = {};
    let total = 0;
    for (const f of humanData().friends || []) {
      const a = f.avatar || "";
      if (!/^data:image\//.test(a) || a.length > 400000 || total + a.length > 2000000) continue;
      out[f.id] = a;
      total += a.length;
    }
    return out;
  };
  nativeCall = async function (command, extra = {}) {
    if (command === "start" && extra.peer) extra = { ...extra, avatar: humanFriend(extra.peer).avatar || "" };
    return baseNative(command, extra);
  };
  let mzAvatarSig = "";
  setInterval(() => {
    if (!state?.human?.connected) return;
    const av = mzAvatars(),
      sig = Object.keys(av).join(",") + Object.values(av).reduce((n, a) => n + a.length, 0);
    if (sig === mzAvatarSig) return;
    mzAvatarSig = sig;
    baseNative("profiles", { avatars: av }).catch(() => (mzAvatarSig = ""));
  }, 20000);
}


/* ------------------------------------------------------------------ */
/* 3b. Official release Moments post follows the app language          */
/* ------------------------------------------------------------------ */
const MZ_RELEASE_EN = `This is update 2.1.3

 - Fixed iPhone chats jumping to the top so you couldn't scroll down
 - The call screen background now follows your theme colours
 - Set a custom call background for each AI or friend (⋯ in the chat → Call background)
 - Share your screen during calls on Android: the entire screen or a single app
 - When sharing a single app, leaving it shows “Live share paused” instead of ending the share
 - Share the Mizuki app screen during calls on iPhone
 - Android notifications keep working after you leave the app: messages pop up briefly, calls stay until answered or ended
 - Image generation errors now show which key was used and the service's original reply

8 updates this time!
Found a problem or bug? Just tell Mizuki! Mizuki doesn't bite humans! ٩(ˊᗜˋ*)و`;
function mzLocalizeRelease() {
  if (!state?.moments || typeof officialReleaseText !== "string") return;
  const choice = state.settings?.uiLanguage || "system",
    en = choice === "en" || (choice === "system" && /^en(?:-|$)/i.test(navigator.language || ""));
  for (const p of state.moments) if (p.id === "official-release-2.1.3") p.text = en ? MZ_RELEASE_EN : officialReleaseText;
}

/* ------------------------------------------------------------------ */
/* 4. Render hook                                                      */
/* ------------------------------------------------------------------ */
{
  const base = render;
  render = function () {
    try {
      mzLocalizeRelease();
    } catch {}
    base();
    try {
      mzPaintPresence();
      mzCallBar();
    } catch (e) {
      console.warn("mizuki 2.1.3 render", e);
    }
  };
}

/* ------------------------------------------------------------------ */
/* 5. Styles                                                           */
/* ------------------------------------------------------------------ */
{
  const st = document.createElement("style");
  st.id = "mizuki211Style";
  st.textContent = `
/* ---------- dark theme ---------- */
html.mz-dark{color-scheme:dark;--bg:#16131b!important;--ink:#ece6f3!important;--muted:#9d93a8!important;--line:#2d2735!important;--soft:color-mix(in srgb,var(--accent) 20%,#1f1b26)!important;--pink:color-mix(in srgb,var(--accent) 26%,#231d29)!important;--bubble:color-mix(in srgb,var(--accent) 30%,#251f2d)!important;--surface:#201c27;--card:#1e1a25;--shadow:0 8px 26px #0006!important;--cover:linear-gradient(135deg,#2c2338,#2f2430 55%,#2b2722)!important;--control-track:#2a2432!important;--control-border:#3a3245!important;--startup-bg:#16131b}
html.mz-dark body{background:var(--bg);color:var(--ink)}
html.mz-dark input,html.mz-dark textarea,html.mz-dark select{background:#221d29!important;color:var(--ink)!important;border-color:var(--line)!important}
html.mz-dark input::placeholder,html.mz-dark textarea::placeholder{color:#7f768a}
html.mz-dark .icon-button,html.mz-dark .pill:not(.primary):not(.hangup),html.mz-dark .chip,html.mz-dark .provider-grid button,html.mz-dark .model-grid button,html.mz-dark .swatch,html.mz-dark .memory-grid button,html.mz-dark .attachment button,html.mz-dark .relation-direction,html.mz-dark .setting-choice,html.mz-dark .chat-menu-button,html.mz-dark .save,html.mz-dark .category-choice{background:#241f2b!important;color:var(--ink)!important;border-color:#332c3c!important}
html.mz-dark .card,html.mz-dark .soft-note,html.mz-dark .collapse-cover,html.mz-dark .login-gate-card,html.mz-dark .moments-pull-status{background:#1f1b26e8!important;border-color:#2e2836!important}
html.mz-dark .nav{background:#1a1720f2!important;border-top-color:#2a2431!important}
html.mz-dark .search{background:#231e2a!important}
html.mz-dark .conversation .top,html.mz-dark .conversation>header.top{background:#1a1720ee!important;border-bottom-color:#26212d!important}
html.mz-dark .composer,html.mz-dark .chat-attachments,html.mz-dark .official-quick-actions-top,html.mz-dark .mizuki-official-actions{background:#1a1720f0!important;border-top-color:#2a2431!important}
html.mz-dark .composer textarea{background:#241f2b!important}
html.mz-dark .bubble{background:#252030;color:var(--ink)}
html.mz-dark .mine .bubble,html.mz-dark .message.me .bubble,html.mz-dark .bubble.mine{background:var(--bubble)}
html.mz-dark .page.with-bg:before{background:#16131bcc!important}
html.mz-dark .sheet,html.mz-dark .modal,html.mz-dark .sheet-card{background:#1d1923!important;color:var(--ink)}
html.mz-dark .sheet pre{background:#26202e!important}
html.mz-dark .error-box{background:#3a1d26!important}
html.mz-dark .switch{background:#3a3344!important}
html.mz-dark .handle{background:#4a4154!important}
html.mz-dark .contact-mode{background:#211c28!important}html.mz-dark .contact-mode .selected{background:#3a3146!important;color:var(--ink)!important}
html.mz-dark .contact-delete{background:#3a2430!important}
html.mz-dark .chat-pin,html.mz-dark .sticker-grid button,html.mz-dark .image-draft button:last-child{background:#2a2431cc!important}
html.mz-dark .virtual-card,html.mz-dark .image-invitation,html.mz-dark .wallet-card,html.mz-dark .voice-player{background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 22%,#1e1a24),#1e1a24)!important;border-color:#352d3f!important}
html.mz-dark .virtual-card.red-packet-card{background:linear-gradient(145deg,#4a2230,#3a1c28)!important;border-color:#6a3446!important}
html.mz-dark .moment-profile .avatar{background:#2a2431}
html.mz-dark .desktop-rail{background:#18151e!important}
html.mz-dark .desktop-sidebar{background:#1b1821!important}
html.mz-dark #app{border-inline-color:#2a2431!important}
html.mz-dark .sound-row{border-bottom-color:#2a2431!important}
html.mz-dark .source-choice{background:#2a2432!important}
html.mz-dark .avatar{border-color:#ffffff22}
html.mz-dark .mizuki-rel-card{filter:saturate(.9) brightness(.92)}
html.mz-dark .mizuki-rel-avatar,html.mz-dark .mizuki-rel-lens{background:#2a2431}
html.mz-dark .app-icon-preview{background:linear-gradient(145deg,var(--icon-bg),#2a2431)}
html.mz-dark .wx-custom-stickers article img{background:#2a2431}
html.mz-dark .startup{background:var(--bg)!important;color:var(--ink)}
html.mz-dark .chat-entry,html.mz-dark .contact-row,html.mz-dark .setting-row{color:var(--ink)}
html.mz-dark img.sticker,html.mz-dark .sticker img{background:transparent}
.mz-dark-card{margin-bottom:16px}.mz-segs{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px;padding:4px;border-radius:16px;background:color-mix(in srgb,var(--soft) 60%,transparent)}
.mz-seg{padding:10px 6px;border-radius:12px;font-weight:600;color:var(--muted)}.mz-seg.selected{background:var(--bg);color:var(--accent-deep);box-shadow:0 2px 10px #0000000f}
html.mz-dark .mz-seg.selected{background:#2c2636;color:var(--ink)}

/* ---------- presence ---------- */
.mz-hidden-title{display:none!important}
.mz-me-head{display:flex;align-items:center;gap:12px;text-align:left;min-width:0;padding:4px 8px 4px 0;border-radius:18px}
.mz-me-head .avatar{width:50px!important;height:50px!important;flex:none;font-size:20px}
.mz-me-text{display:flex;flex-direction:column;gap:3px;min-width:0}
.mz-me-text strong{font-size:calc(21px * var(--text-scale,1));font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:56vw}
.mz-me-text small,.mz-sub-presence{display:inline-flex!important;align-items:center;gap:5px;color:var(--muted);font-size:calc(13px * var(--text-scale,1))}
.mz-me-text b,.mz-chev{font-weight:400;opacity:.7;margin-left:2px}
.mz-pdot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--pc,#34c759);flex:none;box-shadow:0 0 0 2px color-mix(in srgb,var(--pc,#34c759) 22%,transparent)}
.mz-pdot.mz-p-dnd{background:radial-gradient(circle,#fff 0 1.4px,transparent 1.6px),var(--pc)}
.mz-face-dot{position:relative}
.mz-face-dot>.mz-pdot{position:absolute;right:-1px;bottom:-1px;width:12px;height:12px;border:2px solid var(--bg);box-shadow:none}
.mz-face-dot>.mz-pdot.mz-p-offline{display:none}
.mz-status-list{display:grid;gap:8px}
.mz-status-row{display:flex;align-items:center;gap:12px;text-align:left;padding:12px 14px;border-radius:16px;background:color-mix(in srgb,var(--soft) 45%,transparent)}
.mz-status-row .mz-pdot{width:12px;height:12px}
.mz-status-row span{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}.mz-status-row small{color:var(--muted);font-size:12px}
.mz-status-row.selected{background:color-mix(in srgb,var(--accent) 18%,transparent)}.mz-status-row b{color:var(--accent-deep)}
.mz-custom-box .flex{gap:8px;flex-wrap:nowrap}.mz-custom-box input{flex:1}

/* ---------- call screen ---------- */
.call-overlay.mz-call{position:fixed;inset:0;z-index:300;display:block;padding:0;margin:0;color:#fff;background:#1d1a22;overflow:hidden;border-radius:0;max-width:none;width:auto;height:auto;transform:none;box-shadow:none}
.call-overlay.mz-call.mz-min{display:none!important}
.mz-call-bg{position:absolute;inset:0;background-color:var(--accent-deep);background-image:none;background-size:cover;background-position:center}
.mz-call:not(.mz-custom-bg) .mz-call-bg{background:radial-gradient(120% 80% at 20% 0%,color-mix(in srgb,var(--accent) 85%,#fff 10%),transparent 60%),radial-gradient(100% 70% at 100% 100%,color-mix(in srgb,var(--pink) 70%,var(--accent)),transparent 65%),linear-gradient(165deg,color-mix(in srgb,var(--accent) 78%,#1d1724),color-mix(in srgb,var(--accent-deep) 82%,#0c0a10))}
.mz-call-shade{position:absolute;inset:0;background:linear-gradient(#0000004d,#00000026 40%,#00000066)}
.mz-call-top{position:absolute;left:0;right:0;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;padding:calc(env(safe-area-inset-top) + 10px) 16px 8px}
.mz-top-btn{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:#ffffff1f;color:#fff;backdrop-filter:blur(10px)}
.mz-top-btn svg,.mz-btn svg,#mzCallBar svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.mz-flip{visibility:hidden}.mz-has-camera .mz-flip{visibility:visible}
.mz-top-mid{display:none;flex-direction:column;align-items:center;text-shadow:0 1px 4px #0008}.mz-top-mid small{opacity:.85;font-variant-numeric:tabular-nums}
.mz-video .mz-top-mid{display:flex}
.mz-call-id{position:absolute;left:0;right:0;top:calc(env(safe-area-inset-top) + 16vh);z-index:3;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;padding:0 24px}
.mz-face{width:112px;height:112px;border-radius:26px;overflow:hidden;background:#ffffff26;display:grid;place-items:center;box-shadow:0 12px 32px #0005}
.mz-face img{width:100%;height:100%;object-fit:cover}.mz-face span{font-size:44px;font-weight:700}
.mz-call-id h2{font-size:30px;font-weight:700;color:#fff;letter-spacing:.5px}
.mz-chip{color:#fff!important;padding:6px 16px;border-radius:999px;background:#ffffff26;backdrop-filter:blur(8px);font-size:15px;max-width:86vw;font-variant-numeric:tabular-nums;line-height:1.5}
.mz-dots{display:none;gap:7px;margin-top:10px}.mz-waiting .mz-dots,.mz-incoming .mz-dots{display:flex}
.mz-dots i{width:7px;height:7px;border-radius:50%;background:#fff;opacity:.35;animation:mzDot 1.2s infinite}.mz-dots i:nth-child(2){animation-delay:.2s}.mz-dots i:nth-child(3){animation-delay:.4s}
@keyframes mzDot{40%{opacity:1;transform:scale(1.25)}}
.mz-call-actions{position:absolute;left:0;right:0;bottom:calc(env(safe-area-inset-bottom) + 34px);z-index:5;display:flex;flex-direction:column;align-items:center;gap:22px}
.mz-row{display:flex;justify-content:space-evenly;align-items:flex-start;width:100%;max-width:440px;padding:0 12px}
.mz-row-two{justify-content:space-around}
.mz-btn{display:flex;flex-direction:column;align-items:center;gap:10px;color:#fff;min-width:88px}
.mz-btn>span{width:66px;height:66px;border-radius:50%;display:grid;place-items:center;background:#ffffff2e;backdrop-filter:blur(12px);transition:background .2s,color .2s}
.mz-btn small{font-size:13px;opacity:.92;white-space:nowrap}
.mz-btn.mz-on>span{background:#fff;color:#2b2531}
.mz-btn.mz-red>span{background:#ff4d4f;color:#fff}.mz-btn.mz-green>span{background:#34c759;color:#fff}
.mz-btn.mz-big>span{width:74px;height:74px}
.mz-row-mini .mz-btn>span{width:50px;height:50px}.mz-row-mini .mz-btn svg{width:21px;height:21px}
.mz-generic{flex-wrap:wrap;gap:12px;justify-content:center}
.mz-generic .pill{min-width:110px;min-height:52px;border-radius:26px!important;background:#ffffff2e!important;color:#fff!important;border:0!important;backdrop-filter:blur(12px)}
.mz-generic .pill.hangup{background:#ff4d4f!important}
.mz-videos{position:absolute;inset:0;z-index:2;pointer-events:none}
.mz-v{position:absolute;inset:0;margin:0;background:#000;pointer-events:auto}.mz-v[hidden]{display:none}
.mz-v video{width:100%;height:100%;object-fit:cover;display:block}
.mz-v-screen video{object-fit:contain}
.mz-mirror .mz-v-local video{transform:scaleX(-1)}
.mz-video .mz-call-bg,.mz-video .mz-call-id{display:none}
.mz-video .mz-call-shade{z-index:3;background:linear-gradient(#00000059,#0000 22%,#0000 70%,#00000080);pointer-events:none}
.mz-both .mz-v-local{inset:auto;left:14px;top:calc(env(safe-area-inset-top) + 64px);width:31vw;max-width:150px;aspect-ratio:3/4;border-radius:16px;overflow:hidden;z-index:4;box-shadow:0 8px 24px #0007;border:2px solid #ffffff55}
.mz-swap.mz-both .mz-v-local{inset:0;width:auto;max-width:none;aspect-ratio:auto;border-radius:0;border:0;z-index:2}
.mz-swap.mz-both .mz-v-remote:not([hidden]),.mz-swap.mz-both .mz-v-screen:not([hidden]){inset:auto;left:14px;top:calc(env(safe-area-inset-top) + 64px);width:31vw;max-width:150px;aspect-ratio:3/4;border-radius:16px;overflow:hidden;z-index:4;box-shadow:0 8px 24px #0007;border:2px solid #ffffff55}
#mzCallBar{position:fixed;left:0;right:0;top:0;z-index:290;display:flex;align-items:center;justify-content:center;gap:8px;padding:calc(env(safe-area-inset-top) + 6px) 12px 7px;background:#2fbf5b;color:#fff;font-weight:600;font-size:14px;font-variant-numeric:tabular-nums;box-shadow:0 2px 10px #0002;border-radius:0}
#mzCallBar svg{width:17px;height:17px}
body.mz-has-callbar #app{padding-top:calc(34px)}
body.mz-has-callbar .conversation>.top,body.mz-has-callbar main.page>header.top{margin-top:0}
`;
  document.head.append(st);
}
if (state) render();
