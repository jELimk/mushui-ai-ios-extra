"use strict";
// Mizuki 2.1.4 follow-ups: AI online status, AI-initiated transfers/gifts/red packets, stable chat order,
// sticky sticker tabs, official release post, profile status bubble, wallet daily claim, 提示音 row,
// human chat options without AI voice settings. Loaded after release211.js.

/* ------------------------------------------------------------------ */
/* 1. AI online status                                                 */
/* ------------------------------------------------------------------ */
function mzAiPresenceMap() {
  const v = state?.settings?.aiPresence;
  return v && typeof v === "object" ? v : {};
}
function mzAiPresence(id) {
  const set = mzAiPresenceMap()[id];
  if (set && set.status && set.status !== "auto" && MZ_STATUS[set.status])
    return { status: set.status, custom: set.custom || "", text: set.status === "custom" ? set.custom : "", auto: false };
  const h = new Date().getHours();
  return h < 7 ? { status: "offline", text: mzT("休息中", "Resting"), auto: true, label: mzT("休息中", "Resting") } : { status: "online", auto: true };
}
function mzAiPresenceText(id) {
  const p = mzAiPresence(id);
  if (p.auto && p.status === "offline") return p.text;
  return mzPresenceLabel(p);
}
function mzSingleAI(chat) {
  return chat && chat.members?.length === 1 ? chat.members[0] : "";
}
async function mzSaveAiPresence(id, value) {
  await WebEngine.edit((s) => {
    const map = s.settings.aiPresence && typeof s.settings.aiPresence === "object" ? s.settings.aiPresence : {};
    if (!value || value.status === "auto") delete map[id];
    else map[id] = { status: value.status, custom: String(value.custom || "").trim().slice(0, 24) };
    s.settings.aiPresence = map;
  });
  state = await WebEngine.view();
}
let mzAiPickerId = "";
function mzAiPresencePicker(id) {
  mzAiPickerId = id;
  const cur = mzAiPresenceMap()[id]?.status || "auto",
    a = ai(id),
    row = (s, title, help) =>
      `<button class="mz-status-row ${cur === s ? "selected" : ""}" data-mzaistatus="${s}">${s === "auto" ? '<i class="mz-pdot" style="--pc:conic-gradient(#34c759 0 50%,#a7a0ae 0)"></i>' : mzPresenceDot({ status: s })}<span><strong>${title}</strong><small>${help}</small></span>${cur === s ? "<b>✓</b>" : ""}</button>`;
  showModal(
    mzT(a.name + " 的線上狀態", a.name + "’s status"),
    `<div class="mz-status-list">${row("auto", mzT("自動", "Automatic"), mzT("白天在線，凌晨 0～7 點休息", "Online by day, resting 0–7 am"))}${row("online", mzT("在線", "Online"), mzT("隨時回覆你", "Replies any time"))}${row("leisure", mzT("休閒", "Leisure"), mzT("輕鬆悠閒，聊天更放鬆", "Relaxed and chatty"))}${row("busy", mzT("忙碌", "Busy"), mzT("回覆會比較簡短", "Shorter replies"))}${row("dnd", mzT("請勿打擾", "Do not disturb"), mzT("不會主動找你，被打擾時回得很短", "Won’t reach out; very short replies"))}${row("offline", mzT("離線", "Offline"), mzT("像是睡著了，被叫醒才回覆", "Asleep; replies as if just woken"))}${row("custom", mzT("自定義", "Custom"), mzT("自己寫一句狀態", "Write a status"))}</div><div class="mz-custom-box"><label for="mzAiCustom">${mzT("自定義狀態", "Custom status")}</label><div class="flex"><input id="mzAiCustom" maxlength="24" placeholder="${mzT("例如：在畫畫", "e.g. Painting")}" value="${esc(mzAiPresenceMap()[id]?.custom || "")}"><button class="pill primary" data-mzaistatus="custom-save">${mzT("使用", "Use")}</button></div></div>`,
  );
}
document.addEventListener("click", async (e) => {
  const opener = e.target.closest(".mz-ai-status");
  if (opener) {
    const id = mzSingleAI(state.chats.find((c) => c.id === chatId));
    if (id) mzAiPresencePicker(id);
    return;
  }
  const b = e.target.closest("[data-mzaistatus]");
  if (!b || !mzAiPickerId) return;
  let status = b.dataset.mzaistatus,
    custom = "";
  if (status === "custom") return document.getElementById("mzAiCustom")?.focus();
  if (status === "custom-save") {
    status = "custom";
    custom = document.getElementById("mzAiCustom")?.value.trim() || "";
    if (!custom) return toast(mzT("請輸入自定義狀態文字", "Type a custom status"));
  }
  try {
    await mzSaveAiPresence(mzAiPickerId, { status, custom });
    closeModal();
    render();
  } catch (err) {
    toast(err.message);
  }
});
// The AI knows its own status and acts on it.
{
  const W = WebEngine,
    system = W.system;
  W.system = (a) => {
    let text = system(a);
    try {
      const p = mzAiPresence(a.id),
        hints = {
          online: "你目前在線，可以正常聊天。",
          leisure: "你目前是「休閒」狀態，心情放鬆、聊天可以更隨性。",
          busy: "你目前是「忙碌」狀態，正在忙別的事，回覆要簡短，可以提到自己在忙。",
          dnd: "你目前設定了「請勿打擾」，使用者還是傳了訊息，只用一兩句很短的話回覆。",
          offline: p.auto ? "現在是深夜／清晨，你本來在休息；若被訊息吵醒，可以表現出剛醒來的樣子。" : "你目前是「離線」狀態，像是睡著或不在手機旁；被叫醒時再回覆，語氣可以帶點剛醒來的感覺。",
          custom: "你目前的狀態是「" + (p.custom || p.text || "") + "」，回覆時符合這個狀態。",
        };
      text += "\n線上狀態：" + (hints[p.status] || hints.online);
      text +=
        "\n虛擬心意：你也可以依個性主動送出虛擬轉帳、紅包或禮物（放在 JSON 的 card）。例如使用者向你要錢、要紅包、要禮物，或生日、節日、慶祝、安慰、道歉、想給驚喜時，可以送一張；金額 1～2000 沐水幣。每次最多一張，不要只用文字假裝轉帳。";
    } catch {}
    return text;
  };
  // Fallback when the model writes the card as text, e.g. [轉帳:520:晚餐] / [紅包:88] / [禮物:花束:送你].
  const packetOf = W.replyPacket;
  W.replyPacket = (raw) => {
    const packet = packetOf(raw);
    try {
      if (packet && !packet.card) {
        const re = /[\[［【]\s*(轉帳|转账|紅包|红包|禮物|礼物|transfer|red ?packet|gift)\s*[:：]\s*([^\]］】]+)[\]］】]/i;
        const fields = [];
        if (typeof packet.text === "string") fields.push(["text", -1]);
        (packet.messages || []).forEach((t, i) => typeof t === "string" && fields.push(["messages", i]));
        for (const [key, i] of fields) {
          const value = i < 0 ? packet[key] : packet[key][i],
            m = value.match(re);
          if (!m) continue;
          const kind = /轉|转|transfer/i.test(m[1]) ? "transfer" : /紅|红|red/i.test(m[1]) ? "redpacket" : "gift",
            parts = m[2].split(/[:：]/).map((x) => x.trim());
          packet.card =
            kind === "gift"
              ? { type: "gift", title: parts[0] || "小禮物", note: parts[1] || "" }
              : { type: kind, amount: Number(String(parts[0]).replace(/[^\d.]/g, "")) || 0, note: parts[1] || "" };
          const rest = value.replace(m[0], "").trim() || (kind === "gift" ? "送你一份小禮物。" : "給你。");
          if (i < 0) packet[key] = rest;
          else packet[key][i] = rest;
          break;
        }
      }
    } catch {}
    return packet;
  };
}

/* ------------------------------------------------------------------ */
/* 2. Render polish                                                    */
/* ------------------------------------------------------------------ */
function mz211bAfterRender() {
  if (!state) return;
  // Chat list: AI status dots; keep the official row's sort key (hidden menu instead of removed).
  document.querySelectorAll(".chat-row[data-chat]").forEach((row) => {
    const id = mzSingleAI(state.chats.find((c) => c.id === row.dataset.chat));
    if (!id) return;
    const face = row.querySelector(".chat-face, .avatar");
    if (!face) return;
    const p = mzAiPresence(id);
    face.classList.add("mz-face-dot");
    const html = mzPresenceDot(p);
    const dot = face.querySelector(":scope > .mz-pdot");
    if (!dot) face.insertAdjacentHTML("beforeend", html);
    else if (dot.outerHTML !== html) dot.outerHTML = html;
  });
  // AI chat header: "● 在線 ›" (tap to change).
  if (chatId && !chatId.includes(":")) {
    const id = mzSingleAI(state.chats.find((c) => c.id === chatId));
    const sub = document.querySelector(".conversation > .top .spacer p.small, .conversation > header.top .spacer .small");
    if (id && sub) {
      const html = `${mzPresenceDot(mzAiPresence(id))}${esc(mzAiPresenceText(id))}<b class="mz-chev">›</b>`;
      if (sub.innerHTML !== html) {
        sub.innerHTML = html;
        sub.classList.add("mz-sub-presence", "mz-ai-status");
        sub.setAttribute("role", "button");
      }
    }
  }
  // 「我」page: status bubble aligned with the name and a little higher.
  const bubble = document.querySelector(".wx-status-bubble"),
    nameEl = document.querySelector(".wx-profile-main b");
  if (bubble && nameEl)
    requestAnimationFrame(() => {
      const parent = bubble.parentElement.getBoundingClientRect(),
        pad = parseFloat(getComputedStyle(bubble.parentElement).paddingLeft || 0);
      bubble.style.marginLeft = Math.max(0, nameEl.getBoundingClientRect().left - parent.left - pad) + "px";
      bubble.style.marginTop = "-4px";
    });
  // Settings: 沐水幣與提示音 → 提示音 inside 通知與裝置.
  const coins = document.querySelector('.setting-row[data-page="coins"]'),
    notif = document.querySelector('.setting-row[data-page="notifications"]');
  if (coins && notif) {
    coins.querySelector(".label").textContent = mzT("提示音", "Sounds");
    coins.querySelector(".value").textContent = "";
    const icon = coins.querySelector(".setting-icon");
    if (icon && !icon.dataset.mz) {
      icon.dataset.mz = "1";
      icon.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z M15.5 9a4 4 0 0 1 0 6 M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>`;
    }
    if (coins.previousElementSibling !== notif) notif.after(coins);
  }
}
{
  const base = render;
  render = function () {
    base();
    try {
      mz211bAfterRender();
    } catch (e) {
      console.warn("mizuki 2.1.4b", e);
    }
  };
}
if (typeof pageNames === "object") pageNames.coins = "提示音";
// The 提示音 page no longer carries the wallet card; the daily claim lives in 我 → 沐水幣.
if (typeof coinSoundPage === "function") {
  const base = coinSoundPage;
  coinSoundPage = function () {
    return base().replace(/<section class="card wallet-card">[\s\S]*?<\/section>/, "");
  };
}

/* 3. 我 → 沐水幣: balance + daily 1,000 coins */
actions.walletInfo = () => {
  const claimed = Date.now() - (state.settings.coinClaimAt || 0) < 86400000;
  showModal(
    mzT("沐水幣", "Mizuki coins"),
    `<div class="card wx-wallet-card"><span class="small">${mzT("沐水幣餘額", "Balance")}</span><strong>${Number(state.settings.mushuiCoins || 0).toFixed(2)}</strong></div><button class="pill primary full mz-claim" data-action="mzClaimCoins" ${claimed ? "disabled" : ""}>${claimed ? mzT("今日沐水幣已領取，明天再來", "Already claimed today") : mzT("領取每日 1,000 枚沐水幣", "Claim today’s 1,000 coins")}</button><p class="help">${mzT("沐水幣、轉帳、紅包與禮物僅供 App 內角色互動使用，沒有現金價值，不涉及真實支付或贈送。", "Coins, transfers, red packets and gifts are for in-app fun only and have no cash value.")}</p>`,
  );
};
actions.mzClaimCoins = async () => {
  await actions.claimDailyCoins();
  actions.walletInfo();
};

/* 4. Human chats: no AI voice options in ⋯ */
{
  const options = chatOptions;
  chatOptions = function () {
    options();
    if (chatId.includes(":"))
      document.querySelectorAll('.sheet [data-action="voiceIdentity"], .sheet [data-action="voiceSettings"]').forEach((b) => b.remove());
  };
  actions.chatOptions = chatOptions;
}

/* 5. Official release post: publish it (it never ran before) */
setTimeout(function mzReleasePost() {
  if (!state) return setTimeout(mzReleasePost, 2000);
  window.MizukiReleaseReady = true;
  if (typeof ensureOfficialReleaseMoment === "function") ensureOfficialReleaseMoment();
}, 2500);

/* 6. Styles */
{
  const st = document.createElement("style");
  st.textContent = `
.sticker-panel{padding-top:0}
.sticker-panel>.between{position:sticky!important;top:0;z-index:4;margin:0 -14px;padding:10px 14px 18px;background:linear-gradient(var(--bg) 0,var(--bg) 62%,color-mix(in srgb,var(--bg) 0%,transparent) 100%)}
.sticker-panel>.between+.small{margin-top:-8px}
.mz-ai-status{cursor:pointer}
.mz-claim{margin:4px 0 12px}
`;
  document.head.append(st);
}
if (state) render();
