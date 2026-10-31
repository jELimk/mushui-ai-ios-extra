"use strict";
// Mizuki 2.1.4 — official account `mizuki`, human groups, typing presence, poke system notices,
// moments audience groups, relationship consent cards, records swipe, language page, icons,
// transparent uploads, sticker panel and assorted fixes. Loaded last; wraps earlier modules.

let MIZUKI_OFFICIAL_ID = "mizuki";
const
  MIZUKI_LEGACY_ID = "official-mushui";

// Every platform now runs the shared WebEngine (MushuiWeb is always true), so detect native hosts explicitly.
function mizukiNativeApp() {
  return !!(window.Desktop && (window.MushuiDesktop || window.AndroidHost || window.IOSHost));
}
function mizukiMe() {
  return (typeof state !== "undefined" && state?.human?.me?.id) || "";
}
function mizukiIsStaffMe() {
  return mizukiMe() === MIZUKI_OFFICIAL_ID;
}
async function mizukiApi(path, body) {
  return WebEngine.humanRequest(path, body);
}
// Unauthenticated request to a chosen server; native hosts avoid CORS through Desktop.invoke("http").
async function mizukiRawRequest(base, path, body) {
  const url = String(base || "").replace(/\/$/, "") + path;
  if (mizukiNativeApp()) {
    const r = await Desktop.invoke("http", { url, body, method: body === undefined ? "GET" : "POST", headers: {}, channel: "account" });
    if (!r.ok) throw Error(r.value?.error?.message || r.value?.error || "HTTP " + r.status);
    return r.value;
  }
  const r = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    v = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(v.error || "HTTP " + r.status);
  return v;
}

/* ------------------------------------------------------------------ */
/* 1. Official account: legacy id `official-mushui` ↔ real account `mizuki` */
/* ------------------------------------------------------------------ */
window.MizukiSync = { staff: false, officialMode: "ai", typing: [] };
{
  const W = WebEngine,
    request = W.humanRequest;
  W.humanRequest = async (path, body, authorized = true) => {
    const alias = mizukiMe() !== MIZUKI_OFFICIAL_ID;
    let p = path,
      b = body;
    if (alias) {
      p = p.replaceAll(MIZUKI_LEGACY_ID, MIZUKI_OFFICIAL_ID);
      if (b && typeof b === "object" && !Array.isArray(b)) {
        b = { ...b };
        for (const k of ["to", "peer", "id", "userId"]) if (b[k] === MIZUKI_LEGACY_ID) b[k] = MIZUKI_OFFICIAL_ID;
      }
    }
    const r = await request(p, b, authorized);
    if (r && path.startsWith("/v1/sync")) {
      if (/^[a-z0-9_]{6,24}$/.test(r.officialId || "")) MIZUKI_OFFICIAL_ID = r.officialId;
      window.MizukiSync = { staff: !!r.staff, officialMode: r.officialMode || "ai", typing: r.typing || [] };
      const sig = JSON.stringify([r.officialMode, (r.friends || []).map((f) => [f.id, f.supportMode])]);
      if (window.mizukiModeSig !== undefined && sig !== window.mizukiModeSig) setTimeout(mizukiRefreshModes, 300);
      window.mizukiModeSig = sig;
    }
    return r;
  };
}
async function mizukiRefreshModes() {
  if (WebEngine.humanSyncing) return void setTimeout(mizukiRefreshModes, 300);
  try {
    state = await call("load");
    if (chatId.startsWith("human:") && !modal && document.activeElement?.tagName !== "TEXTAREA") render();
  } catch {}
}
// Official chat history now lives on the server; the old device-only list is retired.
officialMessages = () => [];
try {
  localStorage.removeItem("mushui-official-messages");
} catch {}

// The official account IS the real `mizuki` account: drop the old device-only pseudo account.
const mizukiHumanDataBase = humanData;
humanData = function () {
  const h = mizukiHumanDataBase(),
    staff = mizukiIsStaffMe(),
    officialName = window.MushuiLocale === "en" ? "Mizuki" : "沐水";
  return {
    ...h,
    officialId: state?.human?.officialId || MIZUKI_OFFICIAL_ID,
    friends: h.friends
      .filter((p) => p.id !== MIZUKI_LEGACY_ID && !(staff && p.id === MIZUKI_OFFICIAL_ID))
      .map((p) => (p.id === MIZUKI_OFFICIAL_ID && !staff ? { ...p, name: officialName, avatar: "official-avatar.png", cover: "official-cover.png", bio: "Hanyo! I'm Mizuki! ٩(ˊᗜˋ*)و", official: true } : p)),
  };
};
{
  const W = WebEngine,
    sync = W.humanSync;
  let migrated = false;
  W.humanSync = async () => {
    if (!migrated) {
      migrated = true;
      await W.edit((s) => {
        const h = s.human;
        if (!h) return;
        for (const m of h.messages || []) {
          if (m.sender === MIZUKI_LEGACY_ID) m.sender = MIZUKI_OFFICIAL_ID;
          if (m.recipient === MIZUKI_LEGACY_ID) m.recipient = MIZUKI_OFFICIAL_ID;
        }
        h.friends = (h.friends || []).filter((p) => p.id !== MIZUKI_LEGACY_ID);
        // Old local release-note posts of the retired pseudo account are removed (not re-posted).
        // (keep the official release-note posts: they are authored by the legacy id on purpose)
        s.moments = (s.moments || []).filter((p) => p.author !== MIZUKI_LEGACY_ID || p.release);
      }).catch(() => {});
    }
    return sync();
  };
}
if (typeof chatId !== "undefined" && chatId === "human:" + MIZUKI_LEGACY_ID) chatId = "human:" + MIZUKI_OFFICIAL_ID;
actions.openOfficialProfile = () => {
  closeModal();
  tab = "chats";
  page = "";
  chatId = "human:" + MIZUKI_OFFICIAL_ID;
  render();
};
actions.openOfficialMoments = actions.openOfficialProfile;

// Opening the official profile never reports "AI removed".
document.addEventListener(
  "click",
  (e) => {
    const el = e.target.closest("[data-momentprofile]");
    if (!el || ![MIZUKI_LEGACY_ID, MIZUKI_OFFICIAL_ID].includes(el.dataset.momentprofile)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    actions.openOfficialProfile();
  },
  true,
);

actions.officialHelp = async () => {
  if (!humanData().connected) throw Error("請先登入帳號，才能聯絡人工客服");
  await mizukiApi("/v1/official/handoff", {});
  await WebEngine.humanSync().catch(() => {});
  state = await call("load");
  render();
  toast("已轉接人工客服，客服人員上線後會在這裡回覆");
};

/* ------------------------------------------------------------------ */
/* 2. Staff (official) app: gate password → ID/password login → normal app */
/* ------------------------------------------------------------------ */
let mizukiGateBusy = false,
  mizukiFeedback = [],
  mizukiFeedbackLoaded = false;

function mizukiGateOk() {
  try {
    return sessionStorage.getItem("mizuki-gate") === "1";
  } catch {
    return !!window.mizukiGateMemory;
  }
}
function mizukiRealServer(v) {
  try {
    const u = new URL(String(v || ""));
    if (!/^https?:$/.test(u.protocol) || u.hostname === "mushui.local" || (mizukiNativeApp() && ["127.0.0.1", "localhost"].includes(u.hostname))) return "";
    return u.origin;
  } catch {
    return "";
  }
}
function mizukiDefaultServer() {
  let saved = "";
  try {
    saved = localStorage.getItem("mizuki-staff-server") || "";
  } catch {}
  return mizukiRealServer(saved) || mizukiRealServer(state?.human?.serverUrl) || (!mizukiNativeApp() ? mizukiRealServer(location.origin) : "");
}
function mizukiGateView() {
  return `<main class="login-gate"><div class="login-gate-card mizuki-gate"><span class="app-icon-preview gate-icon"><i></i></span><p class="eyebrow">水沐 · 官方帳號</p><h1>輸入 App 密碼</h1><p class="help">官方帳號 App 需要先輸入 App 密碼，再登入授權帳號。</p><label for="mizukiGateServer">伺服器網址</label><input id="mizukiGateServer" type="url" autocapitalize="off" value="${esc(mizukiDefaultServer())}" placeholder="https://chat.example.com"><label for="mizukiGatePassword">App 密碼</label><input id="mizukiGatePassword" type="password" autocomplete="off"><button class="pill primary full" data-action="mizukiGateEnter">進入</button><p id="mizukiGateError" class="inline-error"></p></div></main>`;
}
function mizukiStaffLoginView() {
  return `<main class="login-gate"><div class="login-gate-card mizuki-gate"><span class="app-icon-preview gate-icon"><i></i></span><p class="eyebrow">水沐 · 官方帳號</p><h1>登入授權帳號</h1><p class="help">只有授權的官方帳號可以使用此 App。</p><label for="mizukiStaffServer">伺服器網址</label><input id="mizukiStaffServer" type="url" autocapitalize="off" value="${esc(mizukiDefaultServer())}" placeholder="https://你的沐水伺服器"><label for="mizukiStaffId">帳號 ID</label><input id="mizukiStaffId" autocapitalize="off" autocomplete="username" value="mizuki"><label for="mizukiStaffPassword">密碼</label><input id="mizukiStaffPassword" type="password" autocomplete="current-password"><button class="pill primary full" data-action="mizukiStaffLogin">登入</button><p id="mizukiGateError" class="inline-error"></p></div></main>`;
}
actions.mizukiGateEnter = async () => {
  if (mizukiGateBusy) return;
  mizukiGateBusy = true;
  const err = $("#mizukiGateError");
  try {
    const server = mizukiRealServer($("#mizukiGateServer").value.trim()),
      password = $("#mizukiGatePassword").value;
    if (!server) throw Error("請輸入沐水伺服器網址（https://…）");
    await call("human", { action: "configure", url: server });
    state = await call("load");
    let r;
    try {
      r = await WebEngine.humanRequest("/v1/official/gate", { password }, false);
    } catch (e) {
      if (/404|找不到此功能/.test(e.message)) throw Error("伺服器還是舊版本：請先把 Mizuki-2.1.4-Server.zip 部署到 " + server);
      throw Error(String(e.message || e).replace(/^好友伺服器 /, ""));
    }
    try {
      localStorage.setItem("mizuki-staff-server", server);
      sessionStorage.setItem("mizuki-gate", "1");
    } catch {}
    window.mizukiGateMemory = true;
    window.mizukiGateNeedsSetup = !r.configured;
    render();
  } catch (e) {
    if (err) err.textContent = e.message;
  } finally {
    mizukiGateBusy = false;
  }
};
actions.mizukiStaffLogin = async () => {
  if (mizukiGateBusy) return;
  mizukiGateBusy = true;
  const err = $("#mizukiGateError");
  try {
    const userId = $("#mizukiStaffId").value.trim().toLowerCase(),
      password = $("#mizukiStaffPassword").value;
    const url = mizukiRealServer($("#mizukiStaffServer")?.value.trim()) || mizukiDefaultServer();
    if (!url) throw Error("請輸入沐水伺服器網址（https://…），不是 App 內部網址");
    try {
      localStorage.setItem("mizuki-staff-server", url);
    } catch {}
    await humanCall({ action: "login", url, userId, password, deviceName: (typeof deviceLabel === "function" ? deviceLabel() : "官方裝置") + " · 水沐" });
    const status = await mizukiApi("/v1/official/status");
    if (!status.staff) {
      await humanCall({ action: "logout" }).catch(() => {});
      throw Error("此帳號未獲授權使用官方帳號 App");
    }
    window.MizukiVerifiedStaff = true;
    render();
    if (window.mizukiGateNeedsSetup || !status.gateConfigured) actions.mizukiOfficialAdmin();
  } catch (e) {
    if (err) err.textContent = e.message;
  } finally {
    mizukiGateBusy = false;
  }
};
actions.mizukiOfficialAdmin = async () => {
  const cfg = await mizukiApi("/v1/official/admin");
  showModal(
    "官方服務設定",
    `<p class="help">只有官方帳號可以修改。金鑰與密碼只保存在伺服器，不會顯示回來。</p><div class="card"><h3>App 密碼 ${cfg.gateConfigured ? "· 已設定" : "· 尚未設定"}</h3><label for="mizukiAdminGate">新的 App 密碼</label><input id="mizukiAdminGate" type="password" autocomplete="new-password" placeholder="留白不變更"></div><div class="card"><h3>沐水 AI ${cfg.aiConfigured ? "· 已設定" : "· 尚未設定"}</h3><label for="mizukiAdminKey">Anthropic API 金鑰</label><input id="mizukiAdminKey" type="password" autocomplete="off" placeholder="留白不變更"><label for="mizukiAdminModel">模型</label><input id="mizukiAdminModel" value="${esc(cfg.model || "")}"></div><div class="card"><h3>寄信（郵箱驗證）${cfg.smtp.configured ? "· 已設定" : "· 尚未設定"}</h3><label for="mizukiSmtpHost">SMTP 主機</label><input id="mizukiSmtpHost" value="${esc(cfg.smtp.host || "smtp.gmail.com")}"><label for="mizukiSmtpPort">連接埠</label><input id="mizukiSmtpPort" inputmode="numeric" value="${esc(cfg.smtp.port || 587)}"><label for="mizukiSmtpUser">帳號</label><input id="mizukiSmtpUser" value="${esc(cfg.smtp.user || "jeleemk@gmail.com")}"><label for="mizukiSmtpFrom">寄件地址</label><input id="mizukiSmtpFrom" value="${esc(cfg.smtp.from || cfg.smtp.user || "jeleemk@gmail.com")}"><label for="mizukiSmtpPassword">應用程式密碼</label><input id="mizukiSmtpPassword" type="password" autocomplete="off" placeholder="留白不變更"></div><button class="pill primary full" data-action="mizukiSaveOfficialAdmin">儲存官方設定</button>`,
  );
};
actions.mizukiSaveOfficialAdmin = async () => {
  const v = (id) => document.querySelector(id)?.value.trim() || "",
    body = {
      model: v("#mizukiAdminModel"),
      smtp: { host: v("#mizukiSmtpHost"), port: Number(v("#mizukiSmtpPort")) || 587, user: v("#mizukiSmtpUser"), from: v("#mizukiSmtpFrom") },
    };
  if (v("#mizukiAdminGate")) body.gatePassword = $("#mizukiAdminGate").value;
  if (v("#mizukiAdminKey")) body.anthropicKey = v("#mizukiAdminKey");
  if (v("#mizukiSmtpPassword")) body.smtp.password = $("#mizukiSmtpPassword").value;
  await mizukiApi("/v1/official/admin", body);
  window.mizukiGateNeedsSetup = false;
  closeModal();
  toast("官方設定已儲存");
};
if (window.MizukiStaffEdition) {
  window.MizukiVerifiedStaff = true; // role is re-checked below with the server after login
  const staffRender = render;
  render = function () {
    if (!state) return staffRender();
    if (!mizukiGateOk()) {
      $("#app").innerHTML = mizukiGateView();
      document.title = "水沐";
      return;
    }
    if (!state.human?.connected) {
      $("#app").innerHTML = mizukiStaffLoginView();
      document.title = "水沐";
      return;
    }
    if (!mizukiIsStaffMe() && !window.MizukiSync.staff) {
      $("#app").innerHTML =
        `<main class="login-gate"><div class="login-gate-card"><h1>水沐</h1><p>此帳號未獲授權使用官方帳號 App</p><div class="sheet-actions"><button class="pill" data-action="humanLogout">登出</button></div></div></main>`;
      return;
    }
    staffRender();
    document.title = "水沐";
  };
}

/* ------------------------------------------------------------------ */
/* 3. Human groups (server backed) and the staff feedback room          */
/* ------------------------------------------------------------------ */
const MizukiGroups = { owner: "", data: { groups: [], messages: [], cursor: 0 }, syncing: false, lastFull: 0 };
async function mizukiGroupsLoad() {
  const me = mizukiMe();
  if (!me) return false;
  if (MizukiGroups.owner !== me) {
    MizukiGroups.owner = me;
    MizukiGroups.data = (await WebEngine.get("hgroups-" + me).catch(() => null)) || { groups: [], messages: [], cursor: 0 };
  }
  return true;
}
async function mizukiGroupsSync() {
  if (MizukiGroups.syncing || !state?.human?.connected || !(await mizukiGroupsLoad())) return false;
  MizukiGroups.syncing = true;
  let changed = false;
  try {
    const d = MizukiGroups.data;
    for (let i = 0; i < 20; i++) {
      const r = await mizukiApi("/v1/groups?since=" + (d.cursor || 0));
      if (JSON.stringify(r.groups) !== JSON.stringify(d.groups)) changed = true;
      d.groups = r.groups;
      for (const m of r.messages)
        if (+m.id > (d.cursor || 0)) {
          d.messages.push(m);
          d.cursor = +m.id;
          changed = true;
        }
      if (!r.hasMore) break;
    }
    const alive = new Set(d.groups.map((g) => g.id));
    d.messages = d.messages.filter((m) => alive.has(m.gid)).slice(-4000);
    if (changed) await WebEngine.put("hgroups-" + MizukiGroups.owner, d).catch(() => {});
  } finally {
    MizukiGroups.syncing = false;
  }
  return changed;
}
function mizukiGroupFace(g) {
  const people = (g?.members || []).slice(0, 4);
  return `<span class="avatar mizuki-group-face">${people.map((p) => `<i>${p.avatar ? `<img src="${esc(p.avatar)}" alt="">` : esc((p.name || "?").slice(0, 1))}</i>`).join("")}</span>`;
}
function mizukiPreview(m) {
  if (!m) return "開始聊天";
  return m.poke ? m.text : m.text || (m.images?.length ? "［照片］" : m.sticker ? "［表情包］" : "");
}

const mizukiOriginalNewChat = actions.newChat;
actions.newChat = () =>
  showModal(
    "建立聊天",
    `<div class="mizuki-choice-grid"><button class="setting-choice full" data-action="mizukiNewAIGroup"><b>建立 AI 群組</b><small>選一位開始私聊，或選多位 AI 建立群組</small></button><button class="setting-choice full" data-action="mizukiNewHumanGroup"><b>建立人類群組</b><small>邀請已是好友的人類加入群組</small></button></div>`,
  );
actions.mizukiNewAIGroup = () => {
  closeModal();
  mizukiOriginalNewChat();
};
actions.mizukiNewHumanGroup = () => {
  const h = humanData();
  if (!h.connected) throw Error("請先登入帳號，才能建立人類群組");
  const friends = h.friends.filter((p) => !p.official && p.id !== MIZUKI_LEGACY_ID && (p.realFriend !== false || !p.supportUser));
  showModal(
    "建立人類群組",
    `<label for="mizukiGroupName">群組名稱（選填）</label><input id="mizukiGroupName" maxlength="40" placeholder="例如：週末小隊">${friends.length ? friends.map((p) => `<label class="audience-row"><input type="checkbox" name="mizukiGroupMember" value="${esc(p.id)}">${avatar(p)}<span>${esc(p.name)} <small>ID ${esc(p.id)}</small></span></label>`).join("") : '<p class="help">還沒有人類好友，先到聯絡人 → 人類搜尋 ID 加好友。</p>'}<button class="pill primary full" data-action="mizukiCreateHumanGroup">建立群組</button>`,
  );
};
actions.mizukiCreateHumanGroup = async () => {
  const members = [...document.querySelectorAll("input[name=mizukiGroupMember]:checked")].map((e) => e.value);
  if (!members.length) throw Error("請至少選擇一位人類好友");
  const r = await mizukiApi("/v1/groups/create", { name: $("#mizukiGroupName").value.trim(), members });
  await mizukiGroupsSync();
  closeModal();
  tab = "chats";
  page = "";
  chatId = "hgroup:" + r.group.id;
  render();
};

const mizukiChatsBase = chatsView;
chatsView = function () {
  const html = mizukiChatsBase();
  if (search.trim()) return html;
  const rows = [];
  if (mizukiIsStaffMe()) {
    const last = mizukiFeedback.at(-1);
    rows.push({
      id: "feedback:",
      name: "使用者回饋",
      face: `<span class="avatar mizuki-feedback-face">✉</span>`,
      text: last ? last.name + "：" + last.summary.split("\n")[0] : "對話結束後的統整紀錄",
      time: last?.created || 0,
      kind: "官方",
      pinned: true,
    });
  }
  for (const g of MizukiGroups.data.groups || []) {
    const last = MizukiGroups.data.messages.filter((m) => m.gid === g.id).at(-1);
    rows.push({ id: "hgroup:" + g.id, name: g.name, face: mizukiGroupFace(g), text: mizukiPreview(last), time: last?.time || g.created, kind: "人類群組" });
  }
  if (!rows.length) return html;
  const markup = rows
    .map(
      (r) =>
        `<div class="chat-entry ${r.pinned ? "pinned-chat" : ""}" data-mizuki-time="${r.time}"><button class="chat-row" data-mizukichat="${esc(r.id)}"><span class="chat-face">${r.face}</span><div class="chat-info"><h3><span>${esc(r.name)} <small>${r.kind}</small></span><time class="time">${r.time ? ago(r.time) : ""}</time></h3><p>${esc(r.text)}</p></div></button></div>`,
    )
    .join("");
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const content = tpl.content.querySelector(".content");
  if (!content) return html;
  const h = humanData(),
    entryTime = (n) => {
      const ai = n.querySelector("[data-chat]")?.dataset.chat,
        hu = n.querySelector("[data-humanchat]")?.dataset.humanchat;
      if (ai) return state.chats.find((c) => c.id === ai)?.messages.at(-1)?.time || 0;
      if (hu) return h.messages.filter((m) => m.sender === hu || m.recipient === hu).at(-1)?.time || 0;
      return +n.dataset.mizukiTime || 0;
    };
  const extra = document.createElement("template");
  extra.innerHTML = markup;
  for (const n of [...extra.content.querySelectorAll(".chat-entry.pinned-chat")].reverse()) content.insertBefore(n, content.firstChild);
  for (const n of [...extra.content.querySelectorAll(".chat-entry")]) {
    const t = +n.dataset.mizukiTime,
      before = [...content.querySelectorAll(":scope > .chat-entry:not(.pinned-chat)")].find((x) => x !== n && entryTime(x) < t);
    content.insertBefore(n, before || content.querySelector(":scope > .setting-choice") || null);
  }
  content.querySelector(":scope > .help")?.remove();
  return tpl.innerHTML;
};
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-mizukichat]");
  if (!b) return;
  closeModal();
  chatId = b.dataset.mizukichat;
  tab = "chats";
  page = "";
  render();
  if (chatId === "feedback:") await mizukiLoadFeedback(true);
});

async function mizukiLoadFeedback(rerender) {
  if (!mizukiIsStaffMe()) return;
  try {
    mizukiFeedback = (await mizukiApi("/v1/official/feedback")).feedback || [];
    mizukiFeedbackLoaded = true;
    if (rerender && chatId === "feedback:") render();
  } catch (e) {
    toast(e.message);
  }
}
actions.mizukiRunFeedback = async () => {
  const r = await mizukiApi("/v1/official/feedback/run", { idle: 0 });
  await mizukiLoadFeedback(true);
  toast(r.created ? "已統整 " + r.created + " 段新的對話" : "目前沒有新的對話需要統整");
};
function mizukiFeedbackView() {
  const list = mizukiFeedback;
  return `<main class="conversation mizuki-feedback-room"><header class="top">${btn("closeChat", "back", "返回聊天清單")}<span class="avatar tiny mizuki-feedback-face">✉</span><div class="spacer"><h2>使用者回饋</h2><p class="small">每段對話結束後自動壓縮統整 · 共 ${list.length} 則</p></div><button class="pill" data-action="mizukiRunFeedback">立即統整</button></header><section class="message-scroll" data-chat-id="feedback:"><div class="message-list"><div class="day">使用者與沐水官方帳號的對話結束約 10 分鐘後，會統整成一則訊息</div>${
    list
      .map(
        (f) =>
          `<div class="message" data-message-id="feedback-${esc(f.id)}"><span class="avatar mizuki-feedback-face">✉</span><div class="message-body"><div class="bubble mizuki-feedback-bubble"><b>🕒 ${esc(new Date(f.created).toLocaleString())}</b><span>使用者：${esc(f.name)}（ID：${esc(f.owner)}）</span>${f.email ? `<span>郵件：${esc(f.email)}</span>` : ""}<span class="mizuki-feedback-points">${esc(f.summary)}</span></div></div></div>`,
      )
      .join("") || `<p class="help" style="text-align:center">${mizukiFeedbackLoaded ? "目前還沒有使用者回饋。" : "正在載入…"}</p>`
  }</div></section><p class="mizuki-readonly-note">使用者回饋聊天室僅供查看</p></main>`;
}

function mizukiGroupMessageHtml(m, g) {
  const me = mizukiMe(),
    mine = m.sender === me,
    who = (g.members || []).find((p) => p.id === m.sender) || { id: m.sender, name: m.sender },
    s = m.sticker ? stickerById(m.sticker.id) : null;
  if (m.system) return `<div class="mizuki-system-notice">${esc(m.text)}</div>`;
  if (m.poke) return `<div class="mizuki-system-notice">${esc(mine ? "我" : who.name)}${esc(m.text.replace(/^.*?拍了拍/, "拍了拍"))}</div>`;
  return `<div class="message ${mine ? "mine" : ""}" data-message-id="hg-${esc(m.id)}">${avatar(mine ? humanData().me : who)}<div class="message-body">${mine ? "" : `<div class="author">${esc(who.name)}</div>`}<div class="bubble ${s && !m.text && !m.images?.length ? "sticker-only" : ""}">${m.text ? chatMarkup(m.text) : ""}${photos(m.images || [], false, "hg-" + m.id)}${s ? `<button class="chat-sticker" data-previewsticker="${s.id}">${stickerImage(s)}</button>` : ""}</div><div class="stamp">${time(m.time)}</div></div></div>`;
}
function mizukiGroupView() {
  const gid = chatId.slice(7),
    g = MizukiGroups.data.groups.find((x) => x.id === gid);
  if (!g)
    return `<main class="conversation"><header class="top">${btn("closeChat", "back", "返回聊天清單")}<div class="spacer"><h2>人類群組</h2></div></header><div class="empty"><p>正在同步群組…</p></div></main>`;
  const msgs = MizukiGroups.data.messages.filter((m) => m.gid === gid),
    attachments = photoDrafts[chatId] || [];
  return `<main class="conversation mizuki-group-chat"><header class="top">${btn("closeChat", "back", "返回聊天清單")}${mizukiGroupFace(g)}<div class="spacer"><h2>${esc(g.name)}</h2><p class="small">人類群組 · ${(g.members || []).length} 人</p></div>${btn("mizukiGroupOptions", "more", "群組設定")}</header><section class="message-scroll" data-chat-id="${esc(chatId)}" aria-label="聊天訊息"><div class="message-list"><div class="day">人類群組 · 訊息保存在好友伺服器</div>${msgs.map((m) => mizukiGroupMessageHtml(m, g)).join("")}${sending.has(chatId) ? '<div class="typing">正在傳送…</div>' : ""}</div></section>${attachments.length ? `<div class="chat-attachments">${attachments.map((img, i) => `<div class="attachment"><img src="${esc(img)}" alt="待傳照片"><button data-removechatphoto="${i}">×</button></div>`).join("")}</div>` : ""}<form class="composer" id="messageForm"><textarea data-input="message" data-focus="message" aria-label="輸入訊息" placeholder="傳訊息到群組…" rows="1" maxlength="10000">${esc(chatDrafts[chatId] || "")}</textarea><button class="icon-button" type="submit" aria-label="傳送訊息" ${sending.has(chatId) ? "disabled" : ""}>${icon("send")}</button></form></main>`;
}
actions.mizukiGroupOptions = () => {
  const g = MizukiGroups.data.groups.find((x) => x.id === chatId.slice(7));
  if (!g) return;
  const friends = humanData().friends.filter((p) => !p.official && !(g.members || []).some((m) => m.id === p.id));
  showModal(
    "群組設定",
    `<label for="mizukiGroupRename">群組名稱</label><input id="mizukiGroupRename" maxlength="40" value="${esc(g.name)}"><button class="pill" data-action="mizukiRenameGroup">儲存名稱</button><div class="card"><h3>成員</h3>${(g.members || []).map((p) => `<div class="audience-row">${avatar(p)}<span>${esc(p.name)} <small>ID ${esc(p.id)}</small></span></div>`).join("")}</div>${friends.length ? `<div class="card"><h3>邀請好友</h3>${friends.map((p) => `<label class="audience-row"><input type="checkbox" name="mizukiGroupAdd" value="${esc(p.id)}">${avatar(p)}<span>${esc(p.name)}</span></label>`).join("")}<button class="pill" data-action="mizukiAddGroupMembers">加入群組</button></div>` : ""}<button class="link-button danger" data-action="mizukiLeaveGroup">退出群組</button>`,
  );
};
actions.mizukiRenameGroup = async () => {
  await mizukiApi("/v1/groups/rename", { group: chatId.slice(7), name: $("#mizukiGroupRename").value.trim() });
  await mizukiGroupsSync();
  closeModal();
  render();
};
actions.mizukiAddGroupMembers = async () => {
  const members = [...document.querySelectorAll("input[name=mizukiGroupAdd]:checked")].map((e) => e.value);
  if (!members.length) return;
  await mizukiApi("/v1/groups/add", { group: chatId.slice(7), members });
  await mizukiGroupsSync();
  closeModal();
  render();
};
actions.mizukiLeaveGroup = () =>
  confirmModal("退出群組", "退出後不會再收到這個群組的訊息。", async () => {
    const gid = chatId.slice(7);
    await mizukiApi("/v1/groups/leave", { group: gid });
    MizukiGroups.data.groups = MizukiGroups.data.groups.filter((g) => g.id !== gid);
    await WebEngine.put("hgroups-" + MizukiGroups.owner, MizukiGroups.data).catch(() => {});
    closeModal();
    chatId = "";
    render();
  });

const mizukiChatViewBase = chatView;
chatView = function () {
  if (chatId === "feedback:") return mizukiFeedbackView();
  if (chatId.startsWith("hgroup:")) return mizukiGroupView();
  return mizukiChatViewBase();
};

const mizukiSendBase = sendMessage;
sendMessage = async function (retry = false) {
  if (chatId === "feedback:") return;
  if (!chatId.startsWith("hgroup:")) return mizukiSendBase(retry);
  const id = chatId,
    text = (chatDrafts[id] || "").trim(),
    images = [...(photoDrafts[id] || [])],
    sticker = stickerDrafts[id] || null;
  if (sending.has(id) || (!text && !images.length && !sticker)) return;
  if (cardDrafts[id] || fileDrafts[id]?.length) toast("人類群組目前支援文字、照片與表情包");
  sending.add(id);
  chatDrafts[id] = "";
  photoDrafts[id] = [];
  delete stickerDrafts[id];
  delete cardDrafts[id];
  fileDrafts[id] = [];
  composerMenuOpen = "";
  stickerPanelChat = "";
  render();
  try {
    await mizukiApi("/v1/groups/send", {
      group: id.slice(7),
      text,
      images: WebEngine.images(images),
      sticker: sticker ? { id: WebEngine.sticker(sticker).id } : null,
      clientId: "g" + crypto.randomUUID().replaceAll("-", ""),
    });
    await mizukiGroupsSync();
  } catch (e) {
    chatDrafts[id] = text;
    photoDrafts[id] = images;
    if (sticker) stickerDrafts[id] = sticker;
    toast(e.message);
  } finally {
    sending.delete(id);
    render();
  }
};

/* ------------------------------------------------------------------ */
/* 4. Typing presence across devices (humans, official AI, groups)      */
/* ------------------------------------------------------------------ */
let mizukiTypingSentAt = 0,
  mizukiTypingTarget = "",
  mizukiTypingPolling = false;
function mizukiTypingBody(active) {
  if (chatId.startsWith("hgroup:")) return { group: chatId.slice(7), typing: active };
  if (chatId.startsWith("human:")) return { peer: chatId.slice(6), typing: active };
  return null;
}
document.addEventListener("input", (e) => {
  if (!e.target.matches('.composer textarea[data-input="message"]') || !state?.human?.connected) return;
  const body = mizukiTypingBody(!!e.target.value.trim());
  if (!body) return;
  const key = chatId + ":" + body.typing;
  if (key === mizukiTypingTarget && Date.now() - mizukiTypingSentAt < 2500) return;
  mizukiTypingTarget = key;
  mizukiTypingSentAt = Date.now();
  mizukiApi("/v1/typing", body).catch(() => {});
});
function mizukiShowTyping(names) {
  const list = document.querySelector(".conversation .message-list");
  if (!list) return;
  let el = list.querySelector(".mizuki-typing");
  if (!names.length) {
    el?.remove();
    return;
  }
  const text = names.join("、") + " 正在輸入中...";
  if (!el) {
    el = document.createElement("div");
    el.className = "typing mizuki-typing";
    list.append(el);
    const scroll = list.closest(".message-scroll");
    if (scroll && scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 160) scroll.scrollTop = scroll.scrollHeight;
  }
  if (el.textContent !== text) el.innerHTML = `<i></i><i></i><i></i> ${esc(text)}`;
}
setInterval(async () => {
  if (mizukiTypingPolling || !state?.human?.connected || document.hidden) return;
  const id = chatId;
  let path = "";
  if (id.startsWith("hgroup:")) path = "/v1/typing?group=" + encodeURIComponent(id.slice(7));
  else if (id.startsWith("human:")) path = "/v1/typing?peer=" + encodeURIComponent(id.slice(6));
  if (!path) return;
  mizukiTypingPolling = true;
  try {
    const r = await mizukiApi(path);
    if (chatId === id) mizukiShowTyping((r.typing || []).map((p) => (p.id === MIZUKI_OFFICIAL_ID || p.id === MIZUKI_LEGACY_ID ? "沐水" : p.name)));
  } catch {
  } finally {
    mizukiTypingPolling = false;
  }
}, 1500);

// Group + feedback background sync
let mizukiTick = 0;
setInterval(async () => {
  if (!state?.human?.connected || document.hidden) return;
  mizukiTick++;
  const inGroup = chatId.startsWith("hgroup:");
  if (!inGroup && mizukiTick % 4 && !(tab === "chats" && !chatId && mizukiTick % 2 === 0)) return;
  try {
    const changed = await mizukiGroupsSync();
    if (!changed || modal) return;
    const field = document.querySelector('.composer textarea[data-input="message"]');
    if (inGroup && chatId.startsWith("hgroup:")) {
      const list = document.querySelector(".mizuki-group-chat .message-list"),
        g = MizukiGroups.data.groups.find((x) => x.id === chatId.slice(7));
      if (list && g) {
        const scroll = list.closest(".message-scroll"),
          near = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 200;
        list.innerHTML =
          '<div class="day">人類群組 · 訊息保存在好友伺服器</div>' +
          MizukiGroups.data.messages
            .filter((m) => m.gid === g.id)
            .map((m) => mizukiGroupMessageHtml(m, g))
            .join("");
        if (near) scroll.scrollTop = scroll.scrollHeight;
        return;
      }
    }
    if (tab === "chats" && !chatId && document.activeElement !== field) render();
  } catch {}
  if (mizukiIsStaffMe() && mizukiTick % 20 === 0) mizukiLoadFeedback(chatId === "feedback:");
}, 2500);

/* ------------------------------------------------------------------ */
/* 5. Poke shows as a system notice, not a chat bubble                 */
/* ------------------------------------------------------------------ */
document.addEventListener(
  "click",
  async (e) => {
    const av = e.target.closest(".message .avatar");
    if (!av || e.detail !== 2 || !chatId) return;
    if (!chatId.startsWith("human:") && !chatId.startsWith("hgroup:")) return;
    e.stopImmediatePropagation();
    const suffix = state.settings.pokeSuffixes?.me || "",
      row = av.closest(".message"),
      mine = row.classList.contains("mine");
    if (chatId.startsWith("hgroup:")) {
      const g = MizukiGroups.data.groups.find((x) => x.id === chatId.slice(7)),
        m = MizukiGroups.data.messages.find((x) => "hg-" + x.id === row.dataset.messageId),
        target = mine ? "自己" : (g?.members || []).find((p) => p.id === m?.sender)?.name || "群組";
      await mizukiApi("/v1/groups/send", { group: chatId.slice(7), text: (humanData().me.name || "我") + "拍了拍" + target + suffix, poke: true, clientId: "p" + crypto.randomUUID().replaceAll("-", "") });
      await mizukiGroupsSync();
      render();
      return;
    }
    const peer = chatId.slice(6);
    await mizukiApi("/v1/messages", {
      to: peer,
      text: (humanData().me.name || "我") + "拍了拍" + (mine ? "自己" : humanFriend(peer).name) + suffix,
      poke: true,
      clientId: "p" + crypto.randomUUID().replaceAll("-", ""),
    });
    await WebEngine.humanSync().catch(() => {});
    state = await call("load");
    render();
  },
  true,
);
function mizukiPokeNotices() {
  const list = document.querySelector(".conversation .message-list");
  if (!list || !state) return;
  const human = isHumanChat(),
    messages = human ? humanData().messages : state.chats.find((c) => c.id === chatId)?.messages || [];
  const myName = humanData().me?.name || "我",
    myId = humanData().me?.id;
  for (const m of messages) {
    const legacy = human && !m.poke && /^.{1,40}拍了拍你.{0,10}$/.test(m.text || "") && !m.images?.length && !m.sticker;
    if (!m.poke && !legacy && !m.system) continue;
    const id = human ? "human-" + m.id : m.id,
      row = [...list.querySelectorAll("[data-message-id]")].find((n) => n.dataset.messageId === String(id));
    if (!row || row.classList.contains("mizuki-system-notice")) continue;
    let text = m.text || "";
    if (human && (m.poke || legacy)) {
      if (m.sender === myId) text = text.startsWith(myName) ? "我" + text.slice(myName.length) : text;
      else text = text.replace("拍了拍" + myName, "拍了拍我").replace(/拍了拍你/, "拍了拍我");
    }
    const notice = document.createElement("div");
    notice.className = "mizuki-system-notice";
    notice.dataset.messageId = row.dataset.messageId;
    notice.textContent = text;
    row.replaceWith(notice);
  }
}

/* ------------------------------------------------------------------ */
/* 6. Render hooks: official chat polish, staff composer lock          */
/* ------------------------------------------------------------------ */
function mizukiAfterRender() {
  if (!state) return;
  mizukiCheckNativeIcon();
  if (!mizukiIsStaffMe()) {
    document.querySelectorAll('.chat-row[data-humanchat="official-mushui"]').forEach((x) => x.closest(".chat-entry")?.remove());
    const row = document.querySelector('.chat-row[data-humanchat="' + MIZUKI_OFFICIAL_ID + '"]'),
      entry = row?.closest(".chat-entry");
    if (row) {
      // 2.1.4: 沐水 is sorted like any other chat; it is pinned only in Contacts.
      const small = row.querySelector(".chat-info h3 small");
      if (small) small.textContent = "AI · 官方";
      // Keep the menu node (the chat sorter reads its id) but hide it; removing it made the row jump around.
      entry.classList.add("mizuki-official-entry");
    }
    if (tab === "contacts") {
      document.querySelectorAll('[data-humancontact="official-mushui"],[data-humancontact="mizuki"]').forEach((x) => (x.closest(".contact-entry") || x).remove());
      const section = document.querySelector(".official-contact-section");
      if (section) {
        const p = humanData().friends.find((f) => f.id === MIZUKI_OFFICIAL_ID) || { id: MIZUKI_OFFICIAL_ID, name: "Mizuki" };
        section.innerHTML = `<div class="favorites-title">官方帳號</div><button class="contact-row" data-action="openOfficialProfile">${avatar(p)}<span><strong>${esc(p.name || "Mizuki")}</strong><small class="small" style="display:block">沐水官方 AI</small></span></button>`;
      }
    }
  }
  // AI and the official account never show IDs.
  document.querySelectorAll(".contact-row small").forEach((x) => {
    if (/^ID[:：]\s*mizuki$/i.test(x.textContent.trim())) x.textContent = "沐水官方 AI";
  });
  const head = document.querySelector(".conversation .top .small");
  if (head && /ID\s*mizuki/i.test(head.textContent) && !mizukiIsStaffMe()) head.textContent = "官方帳號 · 沐水 AI";
  // Settings: drop the duplicated language block and the bottom account-sync card.
  document.querySelectorAll("#app [data-ui-language]").forEach((b) => b.closest(".content")?.remove());
  const foot = document.querySelector("#app .footer-note");
  if (foot)
    document.querySelectorAll('#app [data-action="accountSync"]').forEach((b) => {
      if (foot.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) (b.closest(".card") || b).remove();
    });
  mizukiBrandText(document.querySelector("#app"));
  mizukiPokeNotices();
  document.querySelectorAll(".bubble .mizuki-rel-card").forEach((card) => {
    const bubble = card.closest(".bubble");
    bubble.classList.add("mizuki-rel-bubble");
    [...bubble.childNodes].forEach((n) => n !== card && !n.contains?.(card) && n.remove());
  });
  const conv = document.querySelector(".conversation");
  if (chatId === "human:" + MIZUKI_LEGACY_ID) chatId = "human:" + MIZUKI_OFFICIAL_ID;
  if (conv && chatId === "human:" + MIZUKI_OFFICIAL_ID && !mizukiIsStaffMe()) {
    conv.querySelectorAll('[data-action="humanVoiceCall"],[data-action="chatPhone"],.top [aria-label*="通話"],[data-deleteofficial],.top [data-action="openOfficialMoments"],.official-quick-actions:not(.mizuki-official-actions)').forEach((x) => x.remove());
    conv.querySelectorAll(".day").forEach((d) => (d.textContent = "沐水官方帳號 · 沐水 AI 回覆，可轉接人工客服"));
    const sub = conv.querySelector(".top .small");
    if (sub) sub.textContent = window.MizukiSync.officialMode === "human" ? "官方帳號 · 人工客服中" : "官方帳號 · 沐水 AI";
    const form = conv.querySelector(".composer");
    if (form && !conv.querySelector(".mizuki-official-actions"))
      form.insertAdjacentHTML(
        "beforebegin",
        `<div class="official-quick-actions mizuki-official-actions"><button class="pill" data-action="officialAccount">帳號</button><button class="pill" data-action="officialHelp" ${window.MizukiSync.officialMode === "human" ? "disabled" : ""}>${window.MizukiSync.officialMode === "human" ? "人工客服中" : "人工客服"}</button></div>`,
      );
  }
  if (conv && mizukiIsStaffMe() && isHumanChat()) {
    const peer = chatId.slice(6),
      f = humanFriend(peer),
      canSend = f.realFriend || f.supportMode === "human";
    const form = conv.querySelector(".composer");
    if (form && !canSend) {
      form.classList.add("mizuki-locked");
      form.querySelectorAll("button").forEach((b) => (b.disabled = true));
      const t = form.querySelector("textarea");
      if (t) {
        t.disabled = true;
        t.value = "";
        t.placeholder = "現在還無法發送消息";
      }
    }
    const head = conv.querySelector(".top");
    if (head && f.supportMode === "human" && !head.querySelector("[data-action=mizukiEndSupport]"))
      head.querySelector(".spacer")?.insertAdjacentHTML("afterend", '<button class="pill" data-action="mizukiEndSupport">結束人工客服</button>');
    const sub = head?.querySelector(".small");
    if (sub && !f.realFriend) sub.textContent = "使用者 · ID " + peer + (f.supportMode === "human" ? " · 人工客服中" : " · 沐水 AI 接待中");
  }
  const eyebrow = document.querySelector(".login-gate .eyebrow");
  if (eyebrow && /MUSHUI/i.test(eyebrow.textContent)) eyebrow.textContent = window.MizukiStaffEdition ? "水沐 · 官方帳號" : "Mizuki · 沐水";
  if (window.MizukiStaffEdition) document.querySelectorAll(".wx-coin-balance").forEach((x) => (x.textContent = "∞"));
}
actions.mizukiEndSupport = async () => {
  await mizukiApi("/v1/official/mode", { peer: chatId.slice(6), mode: "ai" });
  await WebEngine.humanSync().catch(() => {});
  state = await call("load");
  render();
  toast("已結束人工客服，交回沐水 AI");
};

/* ------------------------------------------------------------------ */
/* 7. Moments audience: all / self / AI only / humans only / custom groups */
/* ------------------------------------------------------------------ */
function mizukiAudienceGroups() {
  return state.settings.audienceGroups || [];
}
async function mizukiSaveAudienceGroups(list) {
  await mutate("settings", { settings: { ...state.settings, audienceGroups: list } });
  if (draft) draft.audienceGroups = list;
}
function mizukiMemberName(key) {
  const [kind, id] = key.split(":");
  return kind === "ai" ? state.ais.find((a) => a.id === id)?.name || "已移除" : humanData().friends.find((p) => p.id === id)?.name || id;
}
audienceLabel = function (p) {
  const a = p.audience;
  if (a?.type === "ai") return "僅 AI 可見";
  if (a?.type === "human") return "僅人類可見";
  if (a?.type === "group") return "分組可見 · " + (a.label || "自訂分組");
  return !p.visibleTo ? "所有人可見" : p.visibleTo.length ? "部分可見 · " + p.visibleTo.map((id) => person(id).name).join("、") : "僅自己可見";
};
function mizukiApplyAudience(type, groupIds = []) {
  if (type === "all") {
    delete posting.visibleTo;
    delete posting.audience;
  } else if (type === "self") {
    posting.visibleTo = [];
    posting.audience = { type: "self" };
  } else if (type === "ai") {
    posting.visibleTo = state.ais.map((a) => a.id);
    posting.audience = { type: "ai" };
  } else if (type === "human") {
    posting.visibleTo = [];
    posting.audience = { type: "human", humans: humanData().friends.filter((p) => !p.official).map((p) => p.id) };
  } else {
    const groups = mizukiAudienceGroups().filter((g) => groupIds.includes(g.id)),
      members = [...new Set(groups.flatMap((g) => g.members))];
    posting.visibleTo = members.filter((k) => k.startsWith("ai:")).map((k) => k.slice(3));
    posting.audience = { type: "group", groups: groupIds, humans: members.filter((k) => k.startsWith("human:")).map((k) => k.slice(6)), label: groups.map((g) => g.name).join("、") };
  }
}
actions.chooseAudience = () => {
  const cur = posting.audience?.type || (!posting.visibleTo ? "all" : posting.visibleTo.length ? "group" : "self"),
    chosen = posting.audience?.groups || [],
    groups = mizukiAudienceGroups();
  showModal(
    "誰可以看見",
    `<div class="choice-list mizuki-audience-list">${[
      ["all", "所有人"],
      ["self", "僅自己"],
      ["ai", "僅 AI 可見"],
      ["human", "僅人類可見"],
    ]
      .map(([k, l]) => `<button class="setting-choice ${cur === k ? "selected" : ""}" data-mizukiaudience="${k}">${l}</button>`)
      .join("")}</div><div class="between mizuki-audience-head"><h3>分組可見</h3><button class="pill" data-action="mizukiEditAudienceGroup">＋ 新增分組</button></div>${
      groups.length
        ? groups
            .map(
              (g, i) =>
                `<div class="mizuki-group-row"><label class="audience-row"><input type="checkbox" name="mizukiAudGroup" value="${esc(g.id)}" ${chosen.includes(g.id) ? "checked" : ""}><span><b>${esc(g.name)}</b><small>${g.members.map(mizukiMemberName).map(esc).join("、") || "尚無成員"}</small></span></label><div class="mizuki-group-tools"><button class="icon-button" data-mizukigroupmove="${i}:-1" aria-label="上移" ${i ? "" : "disabled"}>↑</button><button class="icon-button" data-mizukigroupmove="${i}:1" aria-label="下移" ${i < groups.length - 1 ? "" : "disabled"}>↓</button><button class="pill" data-mizukigroupedit="${esc(g.id)}">編輯</button></div></div>`,
            )
            .join("")
        : '<p class="help">還沒有分組。點「新增分組」自訂名稱並選擇 AI 或人類。</p>'
    }<div class="sheet-actions"><button class="pill" data-action="audienceBack">返回</button><button class="pill primary" data-action="mizukiSaveAudienceGroupsChoice">套用勾選的分組</button></div>`,
  );
};
actions.mizukiSaveAudienceGroupsChoice = () => {
  const ids = [...document.querySelectorAll("input[name=mizukiAudGroup]:checked")].map((e) => e.value);
  if (!ids.length) throw Error("請勾選至少一個分組，或選擇上方的可見範圍");
  mizukiApplyAudience("group", ids);
  composeModal();
};
actions.mizukiEditAudienceGroup = (id = "") => {
  const g = mizukiAudienceGroups().find((x) => x.id === id) || { id: "", name: "", members: [] },
    friends = humanData().friends.filter((p) => !p.official);
  window.mizukiEditingGroup = g.id;
  showModal(
    g.id ? "編輯分組" : "新增分組",
    `<label for="mizukiAudName">分組名稱</label><input id="mizukiAudName" maxlength="30" value="${esc(g.name)}" placeholder="例如：家人"><h3>AI</h3>${state.ais.map((a) => `<label class="audience-row"><input type="checkbox" name="mizukiAudMember" value="ai:${esc(a.id)}" ${g.members.includes("ai:" + a.id) ? "checked" : ""}>${avatar(a)}<span>${esc(a.name)}</span></label>`).join("") || '<p class="help">沒有 AI</p>'}<h3>人類</h3>${friends.map((p) => `<label class="audience-row"><input type="checkbox" name="mizukiAudMember" value="human:${esc(p.id)}" ${g.members.includes("human:" + p.id) ? "checked" : ""}>${avatar(p)}<span>${esc(p.name)}</span></label>`).join("") || '<p class="help">沒有人類好友</p>'}<div class="sheet-actions">${g.id ? '<button class="link-button danger" data-action="mizukiDeleteAudienceGroup">刪除分組</button>' : ""}<button class="pill" data-action="chooseAudience">返回</button><button class="pill primary" data-action="mizukiSaveAudienceGroup">儲存分組</button></div>`,
  );
};
actions.mizukiSaveAudienceGroup = async () => {
  const name = $("#mizukiAudName").value.trim();
  if (!name) throw Error("請輸入分組名稱");
  const members = [...document.querySelectorAll("input[name=mizukiAudMember]:checked")].map((e) => e.value),
    list = [...mizukiAudienceGroups()],
    id = window.mizukiEditingGroup;
  if (id) list.splice(list.findIndex((g) => g.id === id), 1, { id, name, members });
  else list.push({ id: crypto.randomUUID(), name, members });
  await mizukiSaveAudienceGroups(list);
  actions.chooseAudience();
};
actions.mizukiDeleteAudienceGroup = async () => {
  await mizukiSaveAudienceGroups(mizukiAudienceGroups().filter((g) => g.id !== window.mizukiEditingGroup));
  if (posting.audience?.groups) posting.audience.groups = posting.audience.groups.filter((g) => g !== window.mizukiEditingGroup);
  actions.chooseAudience();
};
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-mizukiaudience],[data-mizukigroupmove],[data-mizukigroupedit]");
  if (!b) return;
  try {
    if (b.dataset.mizukiaudience) {
      mizukiApplyAudience(b.dataset.mizukiaudience);
      composeModal();
    } else if (b.dataset.mizukigroupedit) actions.mizukiEditAudienceGroup(b.dataset.mizukigroupedit);
    else {
      const [i, d] = b.dataset.mizukigroupmove.split(":").map(Number),
        list = [...mizukiAudienceGroups()],
        j = i + d;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      await mizukiSaveAudienceGroups(list);
      actions.chooseAudience();
    }
  } catch (err) {
    modalError(err);
  }
});
{
  const W = WebEngine,
    m = W.mutate;
  W.mutate = async (d) => {
    if (d.action === "post" && d.audience) {
      const audience = d.audience;
      const r = await m({ ...d, audience: undefined });
      await W.edit((s) => {
        const p = s.moments.at(-1);
        if (p && p.author === "me") p.audience = { type: String(audience.type), label: W.clean(audience.label || "", 80), groups: audience.groups || [], humans: audience.humans || [] };
      });
      return { ...r, state: await W.view() };
    }
    if (d.action === "aiRelationInvite") return mizukiAIRelationInvite(d);
    return m(d);
  };
}
{
  const publish = actions.publish;
  actions.publish = async () => {
    const audience = posting.audience;
    if (!audience) return publish();
    const mutateBase = mutate;
    mutate = (action, data) => mutateBase(action, action === "post" ? { ...data, audience } : data);
    try {
      await publish();
    } finally {
      mutate = mutateBase;
    }
  };
}

/* ------------------------------------------------------------------ */
/* 8. Relationship invitation card (macaron UI) + AI must consent      */
/* ------------------------------------------------------------------ */
function mizukiMoebius() {
  return `<svg class="mizuki-moebius" viewBox="0 0 40 56" aria-hidden="true"><path d="M20 8 C33 8 33 26 20 28 C7 30 7 48 20 48 C33 48 33 30 20 28 C7 26 7 8 20 8Z" fill="none" stroke="#e0566f" stroke-width="3.2" stroke-linejoin="round"/><path d="M20 8 C33 8 33 26 20 28" fill="none" stroke="#ff9db0" stroke-width="1.2" opacity=".9"/><path d="M20 28 C7 30 7 48 20 48" fill="none" stroke="#b8324d" stroke-width="1.2" opacity=".8"/></svg>`;
}
function mizukiRelationCard(m) {
  const r = m.relationshipInvite;
  if (!r) return "";
  const human = isHumanChat(),
    meP = { ...person("me"), name: humanData().me?.name || state.settings.nickname || "我", avatar: humanData().me?.avatar || state.settings.avatar },
    outgoing = human ? m.sender === humanData().me?.id : m.author === "me" || r.direction === "out",
    other = human ? humanFriend(outgoing ? m.recipient : m.sender) : person(outgoing ? state.chats.find((c) => c.id === chatId)?.members?.[0] : m.author),
    sender = outgoing ? meP : other,
    recipient = outgoing ? other : meP,
    label = relationTypes[r.type]?.label === "自訂" ? r.label : relationTypes[r.type]?.label || r.label || "關係",
    line = outgoing ? `您邀請了${esc(other.name)}成為${esc(label)}關係` : `${esc(sender.name)}邀請了您成為${esc(label)}關係`,
    status =
      r.status === "pending"
        ? outgoing
          ? '<p class="mizuki-rel-status">等待對方同意…</p>'
          : `<div class="sheet-actions">${human ? `<button class="pill primary" data-relationship-response="accept" data-peer="${esc(m.sender)}">同意</button><button class="pill" data-relationship-response="decline" data-peer="${esc(m.sender)}">婉拒</button>` : `<button class="pill primary" data-acceptrelation="${esc(m.id)}">同意</button><button class="pill" data-declinerelation="${esc(m.id)}">婉拒</button>`}</div>`
        : `<p class="mizuki-rel-status">${r.status === "accepted" ? "已同意 · 關係已成立" : r.status === "declined" ? "已婉拒" : "關係已解除"}</p>`;
  const face = (p) => `<span class="mizuki-rel-avatar">${avatar(p)}</span>`;
  return `<section class="relationship-request-card mizuki-rel-card"><div class="mizuki-rel-portraits">${face(sender)}<span class="mizuki-rel-lens">${mizukiMoebius()}</span>${face(recipient)}</div><b class="mizuki-rel-line">${line}</b>${r.note ? `<p>${esc(r.note)}</p>` : ""}<small>紀念日：${esc(r.anniversary || "尚未設定")}</small>${status}</section>`;
}
relationshipCard = mizukiRelationCard;
relationInviteHtml = mizukiRelationCard;

async function mizukiAIRelationInvite(d) {
  const W = WebEngine;
  let chatRef = "",
    msgId = "";
  await W.edit((s) => {
    const a = W.find(s.ais, d.id);
    let c = s.chats.find((c) => c.members.length === 1 && c.members[0] === a.id);
    if (!c) {
      c = { id: W.id(), title: "", members: [a.id], messages: [], unread: 0, bg: "" };
      s.chats.push(c);
    }
    const p = W.relPresets[d.type],
      label = p?.[0] || W.clean(d.label || "", 40);
    if (!label) throw Error("請填寫自訂關係名稱");
    if (c.messages.some((x) => x.relationshipInvite?.status === "pending" && x.relationshipInvite.direction === "out")) throw Error("已有等待中的關係邀請");
    const m = W.append(c, "me", "邀請你成為「" + label + "」關係", {});
    m.relationshipInvite = { type: d.type, label, note: W.clean(d.notes || "", 300), anniversary: W.date(d.anniversary) || localDay(), status: "pending", direction: "out", draft: d };
    chatRef = c.id;
    msgId = m.id;
  });
  const decide = async () => {
    let s = await W.read();
    const a = W.find(s.ais, d.id),
      c = W.find(s.chats, chatRef),
      m = W.find(c.messages, msgId),
      label = m.relationshipInvite.label;
    let decision = { accept: true, text: "我願意！從今天起我們就是「" + label + "」了。" };
    try {
      decision = W.json(
        await W.complete(s.settings, W.system(a), [
          ...W.textOnly(W.context(s, a, c)),
          { role: "user", content: "使用者剛剛邀請你成為「" + label + "」關係。完全依照你的個性與你們的相處決定是否同意。只回 JSON {accept:true或false,text:你的回覆}" },
        ]),
      );
    } catch {}
    await W.edit((s) => {
      const c = W.find(s.chats, chatRef),
        m = W.find(c.messages, msgId),
        a = W.find(s.ais, d.id);
      if (m.relationshipInvite.status !== "pending") return;
      if (decision.accept) {
        const p = W.relPresets[d.type];
        a.relationship = {
          type: d.type,
          label: m.relationshipInvite.label,
          aiRole: p?.[1] || W.clean(d.aiRole || "使用者的「" + label + "」", 80),
          userRole: p?.[2] || W.clean(d.userRole || "AI 的「" + label + "」", 80),
          callAi: W.clean(d.callAi || "", 40),
          callUser: W.clean(d.callUser || "", 40),
          notes: W.clean(d.notes || "", 1000),
          since: Date.now(),
          anniversary: m.relationshipInvite.anniversary,
          updatedAt: Date.now(),
        };
        m.relationshipInvite.status = "accepted";
      } else m.relationshipInvite.status = "declined";
      W.append(c, a.id, W.clean(String(decision.text || (decision.accept ? "我願意。" : "對不起，我還沒準備好。")), 2000));
      c.unread = (c.unread || 0) + 1;
    });
    try {
      state = await call("load");
      render();
    } catch {}
  };
  setTimeout(() => decide().catch(() => {}), 1200);
  return { state: await W.view(), chatId: chatRef };
}
document.addEventListener(
  "click",
  async (e) => {
    const b = e.target.closest("[data-bindrelationship]");
    if (!b) return;
    const id = b.dataset.bindrelationship,
      a = state.ais.find((x) => x.id === id),
      values = relationshipDraft();
    if (a?.relationship && a.relationship.type === values.type && (values.type !== "custom" || a.relationship.label === values.label)) return; // editing details of an existing relationship
    e.preventDefault();
    e.stopImmediatePropagation();
    try {
      b.disabled = true;
      const r = await mutate("aiRelationInvite", { id, ...values });
      closeModal();
      tab = "chats";
      page = "";
      chatId = r.chatId || chatId;
      render();
      toast("關係邀請已送出，等待對方同意");
    } catch (err) {
      modalError(err);
    } finally {
      b.disabled = false;
    }
  },
  true,
);

/* ------------------------------------------------------------------ */
/* 9. Records: swipe between moments and status, spacing               */
/* ------------------------------------------------------------------ */
{
  const saveStatus = actions.saveMyStatus;
  actions.saveMyStatus = async () => {
    const text = $("#myStatusText")?.value.trim();
    await saveStatus();
    if (!text) return;
    const history = [...(state.settings.statusHistory || [])];
    if (!history.some((x) => x.text === text && Date.now() - (x.time || 0) < 5000)) {
      history.push({ text, time: Date.now(), expires: state.settings.myStatus?.expires || Date.now() });
      await mutate("settings", { settings: { ...state.settings, statusHistory: history.slice(-200) } });
    }
  };
}
function mizukiRecordsPage() {
  const tabSel = window.mizukiRecordTab === "status" ? "status" : "moments",
    posts = state.moments
      .filter((p) => p.author === "me")
      .slice()
      .sort((a, b) => b.time - a.time),
    st = state.settings.myStatus,
    history = [...(state.settings.statusHistory || [])];
  if (st?.text && !history.some((x) => x.text === st.text && x.expires === st.expires)) history.push({ ...st, time: st.time || Date.now() });
  const momentsHtml =
      posts
        .map(
          (p) =>
            `<article class="wx-record-row"><time>${new Date(p.time).toLocaleDateString()}</time><div>${p.images?.length ? `<div class="wx-record-grid">${p.images.map((src) => `<img src="${esc(src)}" loading="lazy" alt="">`).join("")}</div>` : ""}<p>${esc(p.text || "照片")}</p></div></article>`,
        )
        .join("") || '<p class="help">還沒有發布朋友圈。</p>',
    statusHtml =
      history
        .slice()
        .reverse()
        .map(
          (x) =>
            `<article class="wx-record-row"><time>${new Date(x.time || Date.now()).toLocaleDateString()}</time><div><p>${esc(x.text)}</p><small>${x.expires > Date.now() ? "目前狀態" : "已結束"}</small></div></article>`,
        )
        .join("") || '<p class="help">尚未發布狀態。</p>';
  return `<header class="top"><div class="between"><div class="flex">${btn("back", "back", "返回")}<h2>記錄</h2></div></div></header><div class="content mizuki-records"><div class="wx-record-tabs mizuki-record-tabs"><button class="${tabSel === "moments" ? "active" : ""}" data-mizukirecord="moments">朋友圈</button><button class="${tabSel === "status" ? "active" : ""}" data-mizukirecord="status">狀態</button><span class="mizuki-record-indicator" style="transform:translateX(${tabSel === "status" ? "100%" : "0"})"></span></div><div class="mizuki-record-viewport"><div class="mizuki-record-pager" data-tab="${tabSel}"><section class="mizuki-record-pane"><h2 class="mizuki-record-title">我的朋友圈</h2>${momentsHtml}</section><section class="mizuki-record-pane"><h2 class="mizuki-record-title">我的狀態</h2>${statusHtml}</section></div></div><p class="small mizuki-swipe-hint">左右滑動切換朋友圈與狀態</p></div>`;
}
function mizukiSetRecordTab(value) {
  if (window.mizukiRecordTab === value) return;
  window.mizukiRecordTab = value;
  const pager = document.querySelector(".mizuki-record-pager");
  if (pager) {
    pager.dataset.tab = value;
    document.querySelectorAll("[data-mizukirecord]").forEach((b) => b.classList.toggle("active", b.dataset.mizukirecord === value));
    const ind = document.querySelector(".mizuki-record-indicator");
    if (ind) ind.style.transform = value === "status" ? "translateX(100%)" : "translateX(0)";
  } else render();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-mizukirecord]");
  if (b) mizukiSetRecordTab(b.dataset.mizukirecord);
});
// Generic horizontal swipe: touch on phones/tablets, mouse/pen drag on desktop.
const mizukiSwipeZones = [];
function mizukiOnSwipe(test, handler) {
  mizukiSwipeZones.push({ test, handler });
}
{
  let start = null;
  const begin = (x, y, target) => {
    const zone = mizukiSwipeZones.find((z) => z.test(target));
    if (!zone || target.closest("input,textarea,select,.sheet,.contact-mode,.wx-record-tabs")) return;
    start = { x, y, zone, t: Date.now() };
  };
  const end = (x, y) => {
    if (!start) return;
    const dx = x - start.x,
      dy = y - start.y,
      zone = start.zone;
    start = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) zone.handler(dx < 0 ? "left" : "right");
  };
  document.addEventListener("touchstart", (e) => e.touches.length === 1 && begin(e.touches[0].clientX, e.touches[0].clientY, e.target), { passive: true, capture: true });
  document.addEventListener("touchend", (e) => e.changedTouches[0] && end(e.changedTouches[0].clientX, e.changedTouches[0].clientY), { passive: true, capture: true });
  document.addEventListener("touchcancel", () => (start = null), { passive: true, capture: true });
  document.addEventListener("pointerdown", (e) => e.pointerType !== "touch" && begin(e.clientX, e.clientY, e.target), { passive: true, capture: true });
  document.addEventListener("pointerup", (e) => e.pointerType !== "touch" && end(e.clientX, e.clientY), { passive: true, capture: true });
}
mizukiOnSwipe(
  (t) => page === "records" && !chatId && !modal && !!t.closest("#app") && !t.closest(".bottom-nav,nav,.tabbar"),
  (dir) => mizukiSetRecordTab(dir === "left" ? "status" : "moments"),
);
mizukiOnSwipe(
  (t) => tab === "contacts" && !chatId && !page && !modal && !!t.closest("#app") && !t.closest(".bottom-nav,nav"),
  (dir) => {
    const next = dir === "left" ? "human" : "ai";
    if (contactMode === next) return;
    contactMode = next;
    search = "";
    render();
    document.querySelector(".contact-mode")?.classList.add(dir === "left" ? "mizuki-swiped-left" : "mizuki-swiped-right");
  },
);

/* ------------------------------------------------------------------ */
/* 10. Settings: language page (with App display name), official admin  */
/* ------------------------------------------------------------------ */
function mizukiLanguagePage() {
  const lang = state.settings.uiLanguage || "system",
    name = state.settings.appDisplayName || "system";
  return `<header class="top"><div class="between"><div class="flex">${btn("back", "back", "返回")}<h2>語言</h2></div></div></header><div class="content"><div class="card"><h3 class="user-content">語言 / Language</h3><p class="help user-content">每個語言都以自己的語言顯示，例如 English 永遠顯示 English。</p><select data-mizukilang aria-label="語言">${[
    ["system", document.documentElement.lang === "en" ? "Follow system" : "跟隨系統"],
    ["zh-Hant", "繁體中文"],
    ["en", "English"],
  ]
    .map(([v, l]) => `<option value="${v}" ${lang === v ? "selected" : ""}>${l}</option>`)
    .join("")}</select></div><div class="card"><h3>App 顯示名稱</h3><p class="help">選擇啟動畫面與 App 內顯示的名稱；預設跟隨系統語言。</p><select data-mizukiappname aria-label="App 顯示名稱"><option value="system" ${name === "system" ? "selected" : ""}>跟隨系統</option><option value="mushui" ${name === "mushui" ? "selected" : ""}>沐水</option><option value="mizuki" ${name === "mizuki" ? "selected" : ""}>Mizuki</option></select></div></div>`;
}
document.addEventListener("change", async (e) => {
  try {
    if (e.target.matches("[data-mizukilang]")) {
      const value = e.target.value;
      await WebEngine.edit((s) => (s.settings.uiLanguage = value));
      state = await call("load");
      draft = structuredClone(state.settings);
      render();
    }
    if (e.target.matches("[data-mizukiappname]")) {
      await mutate("settings", { settings: { ...state.settings, appDisplayName: e.target.value } });
      draft = structuredClone(state.settings);
      render();
      toast("App 顯示名稱已更新");
    }
  } catch (err) {
    toast(err.message);
  }
});
{
  const page206 = settingsPage;
  settingsPage = function () {
    if (page === "records") return mizukiRecordsPage();
    if (page === "language") return mizukiLanguagePage();
    let html = page206();
    if (page === "settings-home" || /<div class="section-label">讓日常更像你<\/div>/.test(html)) {
      const row = `<button class="setting-row" data-page="language"><span class="setting-icon">${icon("info")}</span><span class="label">語言</span><span class="value">${esc({ en: "English", "zh-Hant": "繁體中文" }[state.settings.uiLanguage] || "跟隨系統")}</span><span class="chevron">›</span></button>`;
      if (!html.includes('data-page="language"')) html = html.replace(/(<div class="section-label">讓日常更像你<\/div>\s*<[^>]+>)/, "$1" + row);
      if (mizukiIsStaffMe() && !html.includes("mizukiOfficialAdmin"))
        html = html.replace(
          /<div class="section-label">讓日常更像你<\/div>/,
          `<div class="section-label">官方帳號</div><section class="card"><button class="setting-row" data-action="mizukiOfficialAdmin"><span class="setting-icon">${icon("settings")}</span><span class="label">官方服務設定</span><span class="value">App 密碼 · AI · 寄信</span><span class="chevron">›</span></button></section><div class="section-label">讓日常更像你</div>`,
        );
    }
    return html;
  };
  const appearance206 = appearancePage;
  appearancePage = function () {
    return appearance206().replace(/<div class="card"><h3>App 顯示名稱<\/h3>[\s\S]*?<\/select><\/div>/, "");
  };
  const settingsView206 = settingsView;
  settingsView = function () {
    return settingsView206().replace(/<div class="content"><div class="section-label">語言 \/ Language<\/div>[\s\S]*?<\/div><\/div><\/div>/, "");
  };
}

/* ------------------------------------------------------------------ */
/* 11. App icon: really change the launcher/taskbar icon, then restart  */
/* ------------------------------------------------------------------ */
async function mizukiIconPng(themeId, size = 512) {
  const t = themes[themeId] || themes.lilac,
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="${size}" height="${size}"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${t.soft}"/><stop offset="1" stop-color="#fff"/></linearGradient></defs><rect width="192" height="192" rx="44" fill="url(#g)"/><path d="M96 28C82 56 54 85 54 116a42 42 0 0 0 84 0c0-31-28-60-42-88Z" fill="${t.accent}"/><path d="M96 82c-9 18-20 31-20 45a20 20 0 0 0 40 0c0-14-11-27-20-45Z" fill="#fff" opacity=".92"/></svg>`;
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(Error("圖標繪製失敗"));
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
  const c = document.createElement("canvas");
  c.width = c.height = size;
  c.getContext("2d").drawImage(img, 0, 0, size, size);
  return c.toDataURL("image/png");
}
async function mizukiApplyNativeIcon(themeId) {
  let png = "";
  try {
    png = await mizukiIconPng(themeId);
  } catch {}
  if (mizukiNativeApp()) {
    try {
      toast("圖標已更新，沐水將重新啟動以套用新圖標", 2500);
      await new Promise((r) => setTimeout(r, 1200));
      await Desktop.invoke("setAppIcon", { theme: themeId, png });
      return;
    } catch (e) {
      toast("此裝置無法更換主畫面圖標：" + e.message, 4000);
    }
  }
  document.querySelectorAll("link[rel=apple-touch-icon],link[rel=icon]").forEach((l) => (l.href = png));
  if (!document.querySelector("link[rel=icon]")) document.head.insertAdjacentHTML("beforeend", `<link rel="icon" href="${png}">`);
}
// Apply the launcher/taskbar icon whenever the saved icon theme differs from the one last applied natively.
let mizukiIconApplying = false;
function mizukiCheckNativeIcon() {
  const theme = state?.settings?.iconTheme;
  if (!theme || mizukiIconApplying) return;
  let applied = null;
  try {
    applied = localStorage.getItem("mizuki-native-icon");
    if (applied === null) {
      localStorage.setItem("mizuki-native-icon", theme);
      return;
    }
    if (applied === theme) return;
    localStorage.setItem("mizuki-native-icon", theme);
  } catch {
    return;
  }
  mizukiIconApplying = true;
  mizukiApplyNativeIcon(theme)
    .catch(() => {})
    .finally(() => (mizukiIconApplying = false));
}

/* ------------------------------------------------------------------ */
/* 12. Transparent uploads (avatars, stickers, moments cover)          */
/* ------------------------------------------------------------------ */
{
  const W = WebEngine;
  W.normalize = (src, max = 1600) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try {
          let ratio = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight));
          const draw = (r) => {
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(image.naturalWidth * r));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * r));
            const ctx = canvas.getContext("2d");
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            return canvas;
          };
          let canvas = draw(ratio);
          const ctx = canvas.getContext("2d"),
            px = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          let alpha = false;
          for (let i = 3; i < px.length; i += 16)
            if (px[i] < 250) {
              alpha = true;
              break;
            }
          if (!alpha) {
            const flat = document.createElement("canvas");
            flat.width = canvas.width;
            flat.height = canvas.height;
            const f = flat.getContext("2d");
            f.fillStyle = "#fff";
            f.fillRect(0, 0, flat.width, flat.height);
            f.drawImage(canvas, 0, 0);
            resolve(flat.toDataURL("image/jpeg", 0.83));
            return;
          }
          let out = canvas.toDataURL("image/png");
          while (out.length > 3.9 * 1024 * 1024 && ratio > 0.2) {
            ratio *= 0.75;
            canvas = draw(ratio);
            out = canvas.toDataURL("image/png");
          }
          if (out.length > 3.9 * 1024 * 1024) out = canvas.toDataURL("image/webp", 0.9);
          resolve(out);
        } catch (e) {
          reject(e);
        }
      };
      image.onerror = () => reject(Error("無法讀取圖片"));
      image.src = src;
    });
}

/* ------------------------------------------------------------------ */
/* 13. Stickers: my stickers above defaults, one always-visible add, 200 max */
/* ------------------------------------------------------------------ */
const MIZUKI_STICKER_LIMIT = 200;
actions.addCustomSticker = () => {
  if ((state.settings.customStickers || []).length >= MIZUKI_STICKER_LIMIT) throw Error("最多持有 200 個自訂表情包（不含預設表情包）");
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/png,image/jpeg,image/webp,image/gif";
  input.multiple = true;
  input.onchange = async () => {
    try {
      const files = [...(input.files || [])];
      const list = [...(state.settings.customStickers || [])];
      for (const file of files) {
        if (list.length >= MIZUKI_STICKER_LIMIT) {
          toast("已達 200 個自訂表情包上限");
          break;
        }
        if (file.size > 25 * 1024 * 1024) throw Error("表情包圖片不可超過 25 MB");
        if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) throw Error("僅支援 PNG、JPEG、WebP 或 GIF，其他格式不支援");
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        list.push({ id: crypto.randomUUID(), name: file.name.replace(/\.[^.]+$/, "").slice(0, 40) || "自訂表情", type: file.type, data });
      }
      await mutate("settings", { settings: { ...state.settings, customStickers: list } });
      render();
      toast("表情包已新增");
    } catch (e) {
      toast(e.message);
    }
  };
  input.click();
};
{
  const panelSync = syncComposerPanel;
  syncComposerPanel = function (force = false) {
    panelSync(force);
    const panel = document.querySelector(".sticker-panel");
    if (!panel) return;
    panel.querySelectorAll(".custom-sticker-heading,.custom-sticker-grid,.mizuki-my-stickers").forEach((n) => n.remove());
    const custom = state.settings.customStickers || [];
    const html = `<section class="mizuki-my-stickers"><h3 class="custom-sticker-heading">我的表情包 <small>${custom.length}/${MIZUKI_STICKER_LIMIT}</small></h3><div class="sticker-grid custom-sticker-grid"><button type="button" class="mizuki-sticker-add" data-action="addCustomSticker" aria-label="新增表情包"><span class="custom-sticker-add">＋</span></button>${custom.map((s) => `<button type="button" data-send-custom-sticker="${esc(s.id)}" aria-label="傳送${esc(s.name)}"><img src="${esc(s.data)}" alt=""></button>`).join("")}</div></section>`;
    const anchor = panel.querySelector(".sticker-grid:not(.custom-sticker-grid)") || panel.querySelector(".help")?.nextElementSibling;
    if (anchor) anchor.insertAdjacentHTML("beforebegin", html);
    else panel.insertAdjacentHTML("afterbegin", html);
  };
}

/* ------------------------------------------------------------------ */
/* 14. Voice settings on every device; image key resolution; email     */
/* ------------------------------------------------------------------ */
{
  const options = chatOptions;
  chatOptions = function () {
    options();
    const sheet = document.querySelector(".sheet");
    if (sheet && chatId && !isHumanChat() && !chatId.includes(":") && !sheet.querySelector('[data-action="voiceIdentity"]'))
      sheet.insertAdjacentHTML("beforeend", '<button class="setting-choice" data-action="voiceIdentity">音色設定與試聽　›</button><button class="setting-choice" data-action="voiceSettings">語音辨識設定　›</button>');
  };
  actions.chatOptions = chatOptions;
}
{
  const W = WebEngine,
    proxy = W.proxy;
  W.proxy = async (st, path, body, image = false, method = "POST") => {
    let usedKey = "";
    if (image) {
      const imageKey = await W.key("image").catch(() => "");
      // Do not override the user's explicit "use independent image key" choice.
      // A missing per-device image key MUST NOT send the chat key to the image API.
      if (st.useImageKey && !imageKey) {
        throw Error('已選擇「獨立圖片 API 金鑰」，但此裝置尚未儲存圖片金鑰。請在「AI 的日常 → 照片與圖片生成」輸入金鑰並按「儲存」。金鑰不會跨裝置同步。');
      }
      usedKey = st.useImageKey ? imageKey : (await W.key("chat").catch(() => "")) || "";
      if (st.geminiNative) st.baseUrl = String(st.baseUrl || "").replace(/\/openai\/?$/, "");
    }
    try {
      return await proxy(st, path, body, image, method);
    } catch (e) {
      if (image && [401, 403].includes(e.status)) {
        let host = "";
        try {
          host = new URL(st.baseUrl).host;
        } catch {}
        const which = st.useImageKey ? "這台裝置的「獨立圖片 API 金鑰」" : "使用者選擇的聊天金鑰",
          raw = String(e.rawMessage || e.message || "").replace(/^API HTTP \d+：/, "").replaceAll(usedKey || "\u0000", "[金鑰]").slice(0, 220);
        e.message =
          "圖片服務拒絕（HTTP " + e.status + "）。" +
          (e.status === 401
            ? "金鑰被拒絕（不是餘額問題）。這次送到 " + (host || "圖片服務") + " 的是" + which + "。金鑰不會跨裝置同步；請核對圖片服務的 API 網址、獨立金鑰設定及儲存狀態。"
            : "此金鑰沒有生圖權限：OpenAI 的 gpt-image 模型需要組織完成驗證（Verify Organization），或改用你有權限的圖片模型。") +
          "\n服務原始回覆：" + raw;
      }
      if (image && [400, 404].includes(e.status)) e.message += "（請確認圖片模型名稱與服務網址可生成圖片）";
      throw e;
    }
  };
}
document.addEventListener("input", (e) => {
  if (e.target.dataset?.input === "imageApiKey" && e.target.value && draft) draft.useImageKey = true;
});
actions.bindAccountEmail = async () => {
  const email = document.querySelector("#securityEmail").value.trim(),
    password = document.querySelector("#securityEmailPassword").value;
  if (!email || !password) throw Error("請輸入郵箱與目前密碼");
  const r = await call("human", { action: "bindEmail", email, password });
  if (r?.bound) {
    await WebEngine.humanSync().catch(() => {});
    state = await call("load");
    render();
    toast(r.notice || "郵箱已綁定", 4000);
  } else toast("驗證碼已寄出，請查收郵箱後輸入驗證碼");
};

/* ------------------------------------------------------------------ */
/* Keys: never keep stray spaces/newlines from pasting (common 401 cause) */
/* ------------------------------------------------------------------ */
{
  const W = WebEngine,
    key = W.key;
  W.key = async (slot, value) => {
    if (typeof value === "string") value = value.trim();
    const r = await key(slot, value);
    return typeof r === "string" ? r.trim() : r;
  };
}

/* ------------------------------------------------------------------ */
/* Voice: GPT-Live Voice ID field, clear errors, TTS fallback          */
/* ------------------------------------------------------------------ */
window.mizukiLiveError = (text) => {
  const status = Number(String(text).match(/^\d+/)?.[0]);
  const hint =
    status === 401
      ? "金鑰無效：「獨立 GPT-Live API 金鑰」要貼 sk-… 開頭的 API 金鑰，不是 voice_ 開頭的 Voice ID。"
      : status === 403
        ? "OpenAI 拒絕權限：請在 OpenAI 後台建立「專案（Project）API 金鑰」，權限選 All，或至少開啟 Realtime/Live 與 Voices（api.voices.read），且金鑰要和建立 Voice 的是同一個專案。"
        : status === 404
          ? "找不到模型或 Voice ID：請確認 Voice ID 正確、沒有被刪除，且屬於這把金鑰的專案。"
          : "";
  return Error("GPT-Live HTTP " + text + (hint ? "\n" + hint : ""));
};
{
  const open = actions.voiceIdentity;
  actions.voiceIdentity = () => {
    open();
    const sheet = document.querySelector(".sheet");
    const model = sheet?.querySelector("#liveModel");
    if (!model || sheet.querySelector("#liveVoiceId")) return;
    const a = ai(voiceEditingId),
      v = a.voiceProfile || {},
      current = v.liveVoiceId || (String(v.voice || "").startsWith("voice_") ? v.voice : "");
    model.insertAdjacentHTML(
      "afterend",
      `<label for="liveVoiceId">GPT-Live Voice ID（自訂聲音）</label><input id="liveVoiceId" spellcheck="false" autocapitalize="off" placeholder="例如 voice_6ae4…（在 OpenAI 建立聲音後複製）" value="${esc(current)}"><p class="small">Voice ID 貼在這裡，不要貼到金鑰欄。用文字描述（prompt）建立的聲音只能用在 GPT-Live 電話；一般語音訊息會自動改用預設聲線。</p>`,
    );
  };
  const save = actions.saveVoiceIdentity;
  actions.saveVoiceIdentity = async () => {
    for (const id of ["#ttsKey", "#liveKey"]) {
      const val = document.querySelector(id)?.value.trim() || "";
      if (/^voice_/i.test(val)) throw Error("你在金鑰欄貼的是 Voice ID（voice_…）。請把它貼到「GPT-Live Voice ID」或「聲線名稱／自訂 Voice ID」欄，金鑰欄要貼 sk-… API 金鑰。");
    }
    const liveVoiceId = document.querySelector("#liveVoiceId")?.value.trim() || "";
    if (liveVoiceId && !/^voice_[A-Za-z0-9]+$/.test(liveVoiceId)) throw Error("Voice ID 格式應為 voice_ 開頭");
    const editing = voiceEditingId;
    await save();
    await WebEngine.edit((s) => {
      const p = WebEngine.find(s.ais, editing).voiceProfile || {};
      p.liveVoiceId = liveVoiceId;
      WebEngine.find(s.ais, editing).voiceProfile = p;
    });
    state = await call("load");
  };
}
{
  const W = WebEngine;
  // GPT-Live reads voiceProfile.voice; use the dedicated Live Voice ID during calls.
  const start = window.startAIVoiceCall;
  if (typeof start === "function")
    startAIVoiceCall = async (...args) => {
      const s = await W.read(),
        a = s.ais.find((x) => x.id === args[0]),
        live = a?.voiceProfile?.liveVoiceId,
        old = a?.voiceProfile?.voice;
      if (!live || live === old) return start(...args);
      await W.edit((st) => (W.find(st.ais, a.id).voiceProfile.voice = live));
      try {
        return await start(...args);
      } finally {
        await W.edit((st) => (W.find(st.ais, a.id).voiceProfile.voice = old));
      }
    };
  const synth = W.synthesize;
  if (synth)
    W.synthesize = async (aiId, text) => {
      try {
        return await synth(aiId, text);
      } catch (e) {
        const s = await W.read(),
          v = W.find(s.ais, aiId).voiceProfile?.voice || "";
        if (!String(v).startsWith("voice_")) throw e;
        await W.edit((st) => (W.find(st.ais, aiId).voiceProfile.voice = "marin"));
        try {
          return await synth(aiId, text);
        } finally {
          await W.edit((st) => (W.find(st.ais, aiId).voiceProfile.voice = v));
        }
      }
    };
}

/* ------------------------------------------------------------------ */
/* Call screen: only show a video tile once real frames arrive          */
/* ------------------------------------------------------------------ */
setInterval(() => {
  const media = (typeof callOverlay !== "undefined" && callOverlay?._mediaCall?.remoteMedia) || {};
  for (const v of document.querySelectorAll(".call-videos video")) {
    const fig = v.closest("figure");
    if (!fig) continue;
    const track = v.srcObject?.getVideoTracks?.()[0],
      flag = v.id === "remoteCamera" ? media.camera : v.id === "remoteScreen" ? media.screen : true,
      live = flag === true && !!track && track.readyState === "live" && !track.muted && v.videoWidth > 2 && v.readyState >= 2;
    fig.classList.toggle("mizuki-live", live);
    if (track && !live && v.paused) v.play().catch(() => {});
  }
}, 300);

/* ------------------------------------------------------------------ */
/* Final render wrapper + styles                                        */
/* ------------------------------------------------------------------ */
function mizukiBrandText(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) if (/mushui/i.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/MUSHUI/g, "MIZUKI").replace(/Mushui/g, "Mizuki");
}
{
  const overlay = document.getElementById("overlay");
  if (overlay) new MutationObserver(() => mizukiBrandText(overlay)).observe(overlay, { childList: true, subtree: true });
}
const mizukiRenderBase = render;
render = function () {
  // Keep already-decoded chat images so re-renders do not make photos flash.
  const keep = new Map();
  document.querySelectorAll(".message-list img").forEach((img) => {
    if (img.src && !keep.has(img.src)) keep.set(img.src, img);
  });
  mizukiRenderBase();
  if (keep.size)
    document.querySelectorAll(".message-list img").forEach((img) => {
      const old = keep.get(img.src);
      if (!old || old === img || old.isConnected) return;
      for (const a of [...img.attributes]) old.setAttribute(a.name, a.value);
      img.replaceWith(old);
      keep.delete(img.src);
    });
  try {
    mizukiAfterRender();
  } catch (e) {
    console.warn("mizuki render", e);
  }
};

const mizukiStyle = document.createElement("style");
mizukiStyle.textContent = `
.call-videos figure:not(.mizuki-live){display:none!important}
.mizuki-official-entry [data-chatmenu]{display:none!important}
.mizuki-official-actions{display:flex;justify-content:flex-start;gap:12px;padding:8px 14px}
.mizuki-system-notice{align-self:center;margin:10px auto;padding:5px 14px;max-width:80%;border-radius:999px;background:color-mix(in srgb,var(--soft) 70%,transparent);color:var(--muted,#8a7f93);font-size:calc(12px * var(--text-scale,1));line-height:1.6;text-align:center;user-select:none}
.message-list>.mizuki-system-notice{display:block;width:fit-content}
.mizuki-typing{display:flex;align-items:center;gap:4px}.mizuki-typing i{width:5px;height:5px;border-radius:50%;background:var(--accent);opacity:.5;animation:mizukiDot 1.2s infinite}.mizuki-typing i:nth-child(2){animation-delay:.2s}.mizuki-typing i:nth-child(3){animation-delay:.4s}@keyframes mizukiDot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-2px)}}
.mizuki-group-face{display:grid!important;grid-template-columns:1fr 1fr;gap:1px;overflow:hidden;padding:0!important;background:var(--soft)}.mizuki-group-face i{display:flex;align-items:center;justify-content:center;font-style:normal;font-size:11px;background:var(--bubble);overflow:hidden}.mizuki-group-face i img{width:100%;height:100%;object-fit:cover}
.mizuki-feedback-face{display:inline-flex!important;align-items:center;justify-content:center;background:linear-gradient(135deg,#f6d6e3,#dccff0)!important;color:var(--accent-deep);font-size:20px}
.mizuki-feedback-bubble{display:flex;flex-direction:column;gap:6px;white-space:normal}.mizuki-feedback-points{white-space:pre-wrap;margin-top:4px;line-height:1.7}
.mizuki-readonly-note{margin:0;padding:14px;text-align:center;color:var(--muted);font-size:13px}
.composer.mizuki-locked textarea::placeholder{color:var(--muted)}.composer.mizuki-locked{opacity:.8}
.mizuki-choice-grid{display:grid;gap:12px}.mizuki-choice-grid .setting-choice{display:flex;flex-direction:column;align-items:flex-start;gap:4px;white-space:normal;padding:16px}.mizuki-choice-grid small{color:var(--muted)}
.mizuki-gate input{margin-bottom:12px}.mizuki-gate label{display:block;text-align:left;margin:10px 0 6px}
.mizuki-audience-head{margin:20px 0 10px;align-items:center}.mizuki-group-row{display:flex;align-items:center;gap:10px;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)}.mizuki-group-row .audience-row{flex:1;min-width:0}.mizuki-group-row small{display:block;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mizuki-group-tools{display:flex;gap:6px;align-items:center}.mizuki-group-tools .icon-button{width:34px;height:34px}.mizuki-audience-list{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mizuki-rel-card{background:linear-gradient(135deg,#fde2ea 0%,#efe2fb 45%,#dff3ec 100%)!important;border:0!important;border-radius:24px!important;padding:20px 18px!important;box-shadow:0 10px 26px #b88fc126;min-width:230px;text-align:center}
.mizuki-rel-portraits{position:relative;display:flex;align-items:center;justify-content:center;margin:2px 0 14px;height:76px}
.mizuki-rel-avatar{position:relative;z-index:1;display:inline-flex;border-radius:50%;padding:4px;background:#fff;box-shadow:0 4px 14px #a07db333}
.mizuki-rel-avatar .avatar{width:64px!important;height:64px!important;border-radius:50%!important;overflow:hidden;font-size:24px}
.mizuki-rel-avatar .avatar img{border-radius:50%}
.mizuki-rel-avatar+.mizuki-rel-lens+.mizuki-rel-avatar{margin-left:-26px}
.mizuki-rel-lens{position:absolute;z-index:2;left:50%;top:50%;width:26px;height:50px;transform:translate(-50%,-50%);border-radius:50%/50%;background:#fff;box-shadow:inset 0 0 0 1.5px #ffd1db;display:flex;align-items:center;justify-content:center}
.mizuki-moebius{width:22px;height:42px;filter:drop-shadow(0 1px 1px #e0566f55)}
.mizuki-rel-line{display:block;margin:4px 0 6px;color:#7b4f6b;font-size:calc(15px * var(--text-scale,1));line-height:1.6}
.mizuki-rel-card p{margin:4px 0;color:#8a6a80}.mizuki-rel-card small{color:#9a86a6}.mizuki-rel-status{margin-top:10px!important;font-size:13px;color:#a2789a!important}
.mizuki-rel-card .sheet-actions{display:flex;justify-content:center;gap:14px;margin-top:14px}
.mizuki-records{overflow-x:hidden}.mizuki-record-viewport{overflow:hidden;width:100%;touch-action:pan-y}.mizuki-record-tabs{position:relative;display:grid!important;grid-template-columns:1fr 1fr;padding-bottom:10px;margin-bottom:0}.mizuki-record-tabs button{border:0;background:none;font:inherit;color:var(--muted);padding:8px 0}.mizuki-record-tabs button.active{color:var(--accent-deep);font-weight:700}.mizuki-record-indicator{position:absolute;left:0;bottom:0;width:50%;height:3px;border-radius:3px;background:var(--accent);transition:transform .28s cubic-bezier(.2,.9,.3,1.2)}
.mizuki-record-pager{display:grid;grid-template-columns:100% 100%;width:100%;transition:transform .32s cubic-bezier(.2,.9,.3,1);touch-action:pan-y}.mizuki-record-pager[data-tab=status]{transform:translateX(-100%)}.mizuki-record-pane{min-width:0;padding:0 2px;overflow:hidden}
.mizuki-swipe-hint{display:block}.desktop-platform .mizuki-swipe-hint{display:none}
.mizuki-record-viewport,.mizuki-record-pager,.mizuki-records{min-width:0;max-width:100%}.mizuki-record-pager[data-tab=moments] .mizuki-record-pane:nth-child(2),.mizuki-record-pager[data-tab=status] .mizuki-record-pane:nth-child(1){visibility:hidden}
@keyframes mizukiInL{from{opacity:.4;transform:translateX(24px)}to{opacity:1;transform:none}}@keyframes mizukiInR{from{opacity:.4;transform:translateX(-24px)}to{opacity:1;transform:none}}
.mizuki-swiped-left~.content,.mizuki-swiped-left~.search~.content{animation:mizukiInL .25s ease}.mizuki-swiped-right~.content,.mizuki-swiped-right~.search~.content{animation:mizukiInR .25s ease}
.mizuki-record-title{margin:28px 0 18px!important}.mizuki-record-pane .wx-record-row:first-of-type{margin-top:0}.mizuki-swipe-hint{text-align:center;margin-top:24px}
.wx-wallet-card{display:flex!important;align-items:center;justify-content:space-between;gap:28px;padding:20px 22px!important}.wx-wallet-card strong{margin-left:auto;font-size:calc(20px * var(--text-scale,1))}
.wallet-balance{display:flex;align-items:center;justify-content:space-between;gap:28px}
.mizuki-my-stickers{margin:6px 0 14px}.mizuki-my-stickers .custom-sticker-heading{display:flex;align-items:center;justify-content:space-between;margin:6px 2px 10px}.mizuki-my-stickers small{color:var(--muted);font-weight:400}.mizuki-sticker-add{display:flex!important;align-items:center;justify-content:center;border:2px dashed var(--line)!important;background:transparent!important;min-height:72px}.mizuki-sticker-add .custom-sticker-add{font-size:26px;color:var(--accent);border:0!important;background:none!important;box-shadow:none!important}
.bubble.mizuki-rel-bubble{background:none!important;padding:0!important;box-shadow:none!important;border:0!important}
.custom-sticker-grid img{background:repeating-conic-gradient(#0000 0 25%,#00000008 0 50%) 50%/12px 12px;object-fit:contain}
.avatar img,.wx-custom-stickers img,.cover img{background:transparent}
`;
document.head.append(mizukiStyle);

if (state) render();
setTimeout(() => {
  if (mizukiIsStaffMe()) mizukiLoadFeedback(false).then(() => tab === "chats" && !chatId && render());
  mizukiGroupsSync().then((c) => c && tab === "chats" && !chatId && render()).catch(() => {});
}, 1500);
