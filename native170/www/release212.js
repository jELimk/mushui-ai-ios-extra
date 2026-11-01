"use strict";
// Mizuki 2.1.2 — 設定 → 聊天 (封鎖名單 / 隱藏的聊天室 / 已刪除的聊天室), image generation inside AI 的日常.

/* ------------------------------------------------------------------ */
/* Deleted AI chats are kept in a small local trash so they can be restored. */
/* ------------------------------------------------------------------ */
const MZ_TRASH_KEY = "mizuki-chat-trash";
const MZ_TRASH_DAYS = 30;
let mzTrash = [];
async function mzLoadTrash() {
  try {
    const v = await WebEngine.get(MZ_TRASH_KEY);
    const cutoff = Date.now() - MZ_TRASH_DAYS * 86400000;
    mzTrash = Array.isArray(v) ? v.filter((x) => x && x.chat && x.deletedAt > cutoff) : [];
  } catch {
    mzTrash = [];
  }
  return mzTrash;
}
async function mzSaveTrash() {
  try {
    await WebEngine.put(MZ_TRASH_KEY, mzTrash.slice(0, 30));
  } catch (e) {
    console.warn("chat trash", e);
  }
}
mzLoadTrash();
{
  const baseMutate = mutate;
  mutate = async function (action, data = {}) {
    if (action === "deleteChat" && data?.id) {
      const chat = state?.chats?.find((c) => c.id === data.id);
      if (chat) {
        await mzLoadTrash();
        mzTrash = [{ chat: JSON.parse(JSON.stringify(chat)), deletedAt: Date.now() }, ...mzTrash.filter((x) => x.chat.id !== chat.id)];
        await mzSaveTrash();
      }
    }
    return baseMutate(action, data);
  };
}

/* ------------------------------------------------------------------ */
/* 設定 → 聊天 page                                                    */
/* ------------------------------------------------------------------ */
function mzChatName(id) {
  if (id.startsWith("human:")) return humanFriend(id.slice(6)).name || id.slice(6);
  const c = state.chats.find((x) => x.id === id);
  return c ? title(c) : id;
}
function mzChatCenterPage() {
  const p = chatPrefs(),
    hidden = (p.hidden || []).filter((id) => id.startsWith("human:") || state.chats.some((c) => c.id === id)),
    deletedHuman = p.deleted || [],
    blocked = (state.settings.blockedPeople || []).length,
    when = (t) => (t ? new Date(t).toLocaleDateString() : "");
  const hiddenRows = hidden.length
    ? hidden.map((id) => `<div class="mz-chat-line"><span>${esc(mzChatName(id))}</span><button class="pill" data-unhidechat="${esc(id)}">${mzT("顯示", "Show")}</button></div>`).join("")
    : `<p class="help">${mzT("沒有隱藏的聊天室。在聊天清單點「⋯」可以隱藏。", "No hidden chats. Use ⋯ in the chat list to hide one.")}</p>`;
  const deletedRows =
    [
      ...mzTrash.map(
        (x) =>
          `<div class="mz-chat-line"><span>${esc(title(x.chat) || mzT("聊天室", "Chat"))}<small>${mzT("刪除於 ", "Deleted ")}${when(x.deletedAt)}</small></span><button class="pill" data-mzrestore="${esc(x.chat.id)}">${mzT("還原", "Restore")}</button></div>`,
      ),
      ...deletedHuman.map(
        (id) => `<div class="mz-chat-line"><span>${esc(mzChatName(id))}<small>${mzT("真人聊天", "Human chat")}</small></span><button class="pill" data-mzrestorehuman="${esc(id)}">${mzT("還原", "Restore")}</button></div>`,
      ),
    ].join("") || `<p class="help">${mzT("沒有已刪除的聊天室。AI 聊天室刪除後會保留 30 天。", "No deleted chats. Deleted AI chats are kept for 30 days.")}</p>`;
  return `<header class="top"><div class="between"><div class="flex">${btn("back", "back", "返回")}<h2>${mzT("聊天", "Chats")}</h2></div></div></header><div class="content">
<div class="card"><button class="setting-row" data-page="blocklist"><span class="setting-icon">⊘</span><span class="label">${mzT("封鎖名單", "Blocked")}</span><span class="value">${blocked} ${mzT("位", "")}</span><span class="chevron">›</span></button></div>
<div class="section-label">${mzT("隱藏的聊天室", "Hidden chats")}</div><div class="card mz-chat-list">${hiddenRows}</div>
<div class="section-label">${mzT("已刪除的聊天室", "Deleted chats")}</div><div class="card mz-chat-list">${deletedRows}</div></div>`;
}
{
  const base = settingsPage;
  settingsPage = function () {
    if (page === "mz-chats") return mzChatCenterPage();
    return base();
  };
}
if (typeof pageNames === "object") pageNames["mz-chats"] = "聊天";

document.addEventListener("click", async (e) => {
  const r = e.target.closest("[data-mzrestore]"),
    h = e.target.closest("[data-mzrestorehuman]");
  if (!r && !h) return;
  try {
    if (h) {
      const p = chatPrefs();
      p.deleted = (p.deleted || []).filter((id) => id !== h.dataset.mzrestorehuman);
      saveChatPrefs(p);
      humanCall({ action: "sync" }).catch(() => {});
    } else {
      await mzLoadTrash();
      const item = mzTrash.find((x) => x.chat.id === r.dataset.mzrestore);
      if (!item) return;
      await WebEngine.edit((s) => {
        if (!s.chats.some((c) => c.id === item.chat.id)) s.chats.push(item.chat);
      });
      mzTrash = mzTrash.filter((x) => x !== item);
      await mzSaveTrash();
      state = await WebEngine.view();
    }
    toast(mzT("聊天室已還原", "Chat restored"));
    render();
  } catch (err) {
    toast(err.message);
  }
});
// Unhiding from the 聊天 page stays on the page.
document.addEventListener(
  "click",
  (e) => {
    if (page === "mz-chats" && e.target.closest("[data-unhidechat]")) setTimeout(render, 0);
  },
  true,
);


/* ------------------------------------------------------------------ */
/* Official "已更新至x版本" message follows the app language at display time */
/* ------------------------------------------------------------------ */
const MZ_UPDATE_RE = /已更新至\s*([\w.\-]+)\s*版本！請至官網下載最新版本！\(\*\^▽\^\*\)/g;
function mzAppEnglish() {
  const choice = state?.settings?.uiLanguage || "system";
  return choice === "en" || (choice === "system" && /^en(?:-|$)/i.test(navigator.language || ""));
}
const MZ_OFFICIAL_AUTO = [
  ["您好，這裡是沐水官方帳號。我是沐水 AI，可以幫您解答使用問題、記錄 Bug 與建議；需要真人協助時，點「人工客服」即可轉接。", "Hello, this is the official Mizuki account. I'm the Mizuki AI — I can answer questions about using the app and record bugs and suggestions for you. If you need a real person, tap \"Live support\" to be transferred."],
  ["您好，這裡是沐水官方帳號。版本公告與使用提示會在官方朋友圈分享。", "Hello, this is the official Mizuki account. Version announcements and tips are shared on the official Moments."],
  ["官方 AI 尚未完成伺服器設定，暫時無法自動回覆。您可以點上方「人工客服」，客服人員上線後會在這裡回覆您。", "The official AI is not set up on the server yet, so it can't reply automatically for now. Tap \"Live support\" above, and our staff will reply here once they're online."],
  ["官方 AI 暫時無法回覆，請稍後再試；也可以點上方「人工客服」由真人協助。", "The official AI can't reply right now. Please try again later, or tap \"Live support\" above for help from a real person."],
  ["收到，我再想一想該怎麼回答您。", "Got it — let me think about how to answer that."],
  ["已為您轉接人工客服，請稍候；客服人員上線後會在這裡回覆您。", "You've been transferred to live support. Please wait a moment — our staff will reply here once they're online."],
  ["人工客服已接手，請直接描述您的問題。", "Live support has taken over. Please go ahead and describe your question."],
  ["人工客服已結束，之後由沐水 AI 繼續為您服務。", "Live support has ended. The Mizuki AI will continue helping you from here."],
  ["新版本已推出！記得更新哦！\\(^▽^)/", "A new version is out! Remember to update! \\(^▽^)/"],
];
function mzLocalizeUpdateMessages() {
  const en = mzAppEnglish(),
    text = (v) => (en ? `Updated to version ${v}! Please download the latest version from the official website! (*^▽^*)` : `已更新至${v}版本！請至官網下載最新版本！(*^▽^*)`);
  // Whole bubble / preview at once: the chat formatter turns *…* into italics and splits the text.
  document.querySelectorAll(".message-list .bubble, .chat-row .chat-info p").forEach((el) => {
    const m = el.textContent.match(/已更新至\s*([\w.\-]+)\s*版本！請至官網下載最新版本！|Updated to version ([\w.\-]+)! Please download the latest version/);
    if (!m) return;
    const want = text(m[1] || m[2]);
    if (el.children.length === 0 && el.textContent === want) return;
    const target = el.querySelector(".message-text, .text") || el;
    if (target.textContent !== want || target.children.length) target.textContent = want;
  });  // Official account auto messages (welcome, live-support handoff, AI-unavailable
  // notices — never the AI's own replies) follow the app language at display time.
  for (const el of document.querySelectorAll(".message-list .bubble, .chat-row .chat-info p")) {
    const raw = el.textContent.trim(),
      pair = MZ_OFFICIAL_AUTO.find(([zh, enText]) => raw === zh || raw === enText);
    if (!pair) continue;
    const want = en ? pair[1] : pair[0];
    if (el.children.length === 0 && el.textContent === want) continue;
    const target = el.querySelector(".message-text, .text") || el;
    if (target.textContent !== want || target.children.length) target.textContent = want;
  }
}

/* ------------------------------------------------------------------ */
/* Render hooks                                                         */
/* ------------------------------------------------------------------ */
function mz212AfterRender() {
  if (!state) return;
  mzLocalizeUpdateMessages();
  // Hidden chats no longer appear in the chat list.
  if (tab === "chats") document.querySelectorAll('.content > [data-action="showHiddenChats"]').forEach((b) => b.remove());
  if (tab === "settings" && page === "settings-home") {
    // 照片與圖片生成 lives in 模型與 API.
    document.querySelector('#app .setting-row[data-page="images"]')?.remove();
    const privacy = document.querySelector('.setting-row[data-page="privacy"] .value');
    if (privacy && /封鎖/.test(privacy.textContent)) privacy.textContent = mzT("密碼・登入裝置", "Password · devices");
  }
  // Blocked list lives under 設定 → 聊天 only.
  if (tab === "settings" && page === "privacy") document.querySelector('#app .setting-row[data-page="blocklist"]')?.closest(".card")?.remove();
  // 通知 → 聊天 → 封鎖・隱藏・已刪除
  if (tab === "settings" && page === "chat" && !document.querySelector('#app [data-page="mz-chats"]')) {
    const p = chatPrefs(),
      count = (p.hidden || []).length + (p.deleted || []).length + mzTrash.length;
    mzSettingsContent()?.insertAdjacentHTML(
      "afterbegin",
      `<div class="card"><button class="setting-row" data-page="mz-chats"><span class="setting-icon"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H5l-3 2v-6a8.5 8.5 0 1 1 19-4.5Z"/></svg></span><span class="label">${mzT("封鎖・隱藏・已刪除", "Blocked · hidden · deleted")}</span><span class="value">${count || ""}</span><span class="chevron">›</span></button></div>`,
    );
  }
  // 模型與 API → 照片與圖片生成
  if (tab === "settings" && page === "api" && !document.querySelector('#app [data-page="images"]')) {
    const content = mzSettingsContent();
    content?.insertAdjacentHTML(
      "afterbegin",
      `<div class="card"><button class="setting-row" data-page="images"><span class="setting-icon"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4z M7 15l3-3 2 2 2-3 3 5H7 M8 8h.01"/></svg></span><span class="label">${mzT("照片與圖片生成", "Photos & image generation")}</span><span class="value">${state.settings.autoImages ? mzT("已開啟", "On") : mzT("已關閉", "Off")}</span><span class="chevron">›</span></button></div>`,
    );
  }
}
// The open settings page's own content. On desktop the chat list beside it is also a .content,
// so "#app .content" alone would put rows in the left column.
function mzSettingsContent() {
  const all = [...document.querySelectorAll("#app .content")];
  return all.find((c) => c.previousElementSibling?.querySelector?.('[data-action="back"]')) || all.at(-1);
}
{
  const base = render;
  render = function () {
    base();
    try {
      mz212AfterRender();
    } catch (e) {
      console.warn("mizuki 2.1.2", e);
    }
  };
}
{
  const st = document.createElement("style");
  st.textContent = `.mz-chat-list{display:grid;gap:2px}.mz-chat-line{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 4px;border-bottom:1px solid var(--line)}.mz-chat-line:last-child{border-bottom:0}.mz-chat-line span{display:flex;flex-direction:column;gap:2px;min-width:0}.mz-chat-line small{color:var(--muted);font-size:12px}.mz-chat-line .pill{flex:none;min-height:36px;padding:6px 16px}`;
  document.head.append(st);
}
// Chat views also update without a full render (incremental message lists); re-apply after DOM changes.
{
  let queued = false;
  const app = document.getElementById("app");
  if (app)
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        try {
          mzLocalizeUpdateMessages();
        } catch {}
      });
    }).observe(app, { childList: true, subtree: true, characterData: true });
}
if (state) render();
