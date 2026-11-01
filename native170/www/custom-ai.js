"use strict";
// Mizuki 3.0.0 — 自訂 AI: build a character from a few choices (人設, 性格, 說話方式…).
// The chat API writes the personality and speaking style; then the same setup sheet as importing
// offers to generate a poke line, profile photo, Moments cover and voice, and the chat opens.

const MZ_CUSTOM_GROUPS = [
  { key: "gender", label: ["性別", "Gender"], multi: false, options: [["男生", "Male"], ["女生", "Female"], ["不指定", "Any"]] },
  {
    key: "role",
    label: ["你們的關係", "Your relationship"],
    multi: false,
    options: [["戀人", "Partner"], ["曖昧對象", "Crush"], ["好朋友", "Best friend"], ["青梅竹馬", "Childhood friend"], ["家人", "Family"], ["同事", "Coworker"], ["網友", "Online friend"]],
  },
  {
    key: "type",
    label: ["人設", "Character type"],
    multi: false,
    options: [["霸道總裁", "Domineering CEO"], ["溫柔大叔", "Gentle older man"], ["陽光少年", "Sunny boy"], ["高冷學霸", "Aloof top student"], ["鄰家青梅", "Girl next door"], ["傲嬌大小姐", "Tsundere heiress"], ["腹黑學長", "Scheming senior"], ["撒嬌系", "Clingy sweetheart"], ["運動系", "Sporty"], ["文藝系", "Artsy"]],
  },
  {
    key: "traits",
    label: ["性格（最多 3 個）", "Personality (up to 3)"],
    multi: 3,
    options: [["霸道", "Bossy"], ["溫柔", "Gentle"], ["傲嬌", "Tsundere"], ["腹黑", "Scheming"], ["陽光", "Cheerful"], ["高冷", "Aloof"], ["黏人", "Clingy"], ["毒舌", "Sharp-tongued"], ["成熟穩重", "Mature"], ["天然呆", "Airheaded"], ["害羞", "Shy"], ["幽默", "Funny"]],
  },
  {
    key: "speech",
    label: ["說話方式", "Speaking style"],
    multi: false,
    options: [["簡短冷淡", "Short and cool"], ["溫柔細膩", "Soft and caring"], ["活潑多話", "Lively and chatty"], ["幽默逗趣", "Playful"], ["撒嬌可愛", "Sweet and cutesy"], ["成熟低沉", "Calm and deep"]],
  },
];
let mzCustomPicks = {};

function mzCustomSheet() {
  const chips = (g) =>
    g.options
      .map(([zh, en]) => {
        const on = g.multi ? (mzCustomPicks[g.key] || []).includes(zh) : mzCustomPicks[g.key] === zh;
        return `<button class="chip mzc-chip ${on ? "selected" : ""}" aria-pressed="${on}" data-mzc-group="${g.key}" data-mzc-value="${esc(zh)}">${esc(mzT(zh, en))}</button>`;
      })
      .join("");
  return `<p class="help">${mzT("選幾個你喜歡的設定，沐水會替這位 AI 寫好個性和說話方式。都可以不選，交給 AI 決定。", "Pick what you like and Mizuki writes the personality and speaking style. Anything left empty is up to the AI.")}</p>
<label for="mzcName">${mzT("名字", "Name")}</label><input id="mzcName" maxlength="40" placeholder="${mzT("留空由 AI 取名", "Leave empty to let the AI choose")}" value="${esc(mzCustomPicks.name || "")}">
${MZ_CUSTOM_GROUPS.map((g) => `<label>${mzT(...g.label)}</label><div class="mzc-chips">${chips(g)}</div>`).join("")}
<label for="mzcNote">${mzT("補充（選填）", "Anything else (optional)")}</label><textarea id="mzcNote" maxlength="500" placeholder="${mzT("例如：喜歡下雨天、會叫我寶貝", "e.g. loves rainy days, calls me sweetheart")}">${esc(mzCustomPicks.note || "")}</textarea>
<div class="sheet-actions"><button class="pill" data-action="mzCustomRandom">${mzT("隨機一下", "Surprise me")}</button><button class="pill primary" data-action="mzCustomCreate">${mzT("建立 AI", "Create AI")}</button></div>`;
}
function mzKeepCustomText() {
  mzCustomPicks.name = document.querySelector("#mzcName")?.value.trim() || "";
  mzCustomPicks.note = document.querySelector("#mzcNote")?.value.trim() || "";
}
actions.mzCustomAI = () => {
  mzCustomPicks = {};
  showModal(mzT("自訂 AI", "Custom AI"), mzCustomSheet());
};
actions.mzCustomRandom = () => {
  mzKeepCustomText();
  const pick = (list) => list[Math.floor(Math.random() * list.length)][0];
  for (const g of MZ_CUSTOM_GROUPS)
    mzCustomPicks[g.key] = g.multi ? [...g.options].sort(() => Math.random() - 0.5).slice(0, 2).map((o) => o[0]) : pick(g.options);
  showModal(mzT("自訂 AI", "Custom AI"), mzCustomSheet());
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-mzc-group]");
  if (!b) return;
  const g = MZ_CUSTOM_GROUPS.find((x) => x.key === b.dataset.mzcGroup),
    value = b.dataset.mzcValue;
  if (g.multi) {
    const list = mzCustomPicks[g.key] || [];
    if (list.includes(value)) mzCustomPicks[g.key] = list.filter((v) => v !== value);
    else if (list.length < g.multi) mzCustomPicks[g.key] = [...list, value];
    else return toast(mzT("最多選 " + g.multi + " 個", "Choose up to " + g.multi));
  } else mzCustomPicks[g.key] = mzCustomPicks[g.key] === value ? "" : value;
  for (const chip of document.querySelectorAll(`[data-mzc-group="${g.key}"]`)) {
    const on = g.multi ? (mzCustomPicks[g.key] || []).includes(chip.dataset.mzcValue) : mzCustomPicks[g.key] === chip.dataset.mzcValue;
    chip.classList.toggle("selected", on);
    chip.setAttribute("aria-pressed", on);
  }
});

function mzUniqueName(name) {
  let n = name,
    i = 2;
  while (state.ais.some((a) => a.name === n)) n = name + i++;
  return n;
}
actions.mzCustomCreate = async () => {
  mzKeepCustomText();
  if (!state.settings.hasKey) throw Error(mzT("請先到「設定 → 模型與 API」填入聊天 API 金鑰", "Add a chat API key in Settings → Model & API first"));
  const p = mzCustomPicks,
    wish = [
      p.name && "名字：" + p.name,
      p.gender && p.gender !== "不指定" && "性別：" + p.gender,
      p.role && "與使用者的關係：" + p.role,
      p.type && "人設：" + p.type,
      p.traits?.length && "性格：" + p.traits.join("、"),
      p.speech && "說話方式：" + p.speech,
      p.note && "補充：" + p.note,
    ].filter(Boolean);
  closeModal();
  showModal(
    mzT("正在建立 AI", "Creating your AI"),
    `<div class="history-loading visible"><span></span>${mzT("正在生成 AI 的個性與說話方式…", "Writing the personality and speaking style…")}</div><p class="small">${mzT("使用你設定的聊天 API，可能產生少量費用。", "Uses your chat API and may cost a little credit.")}</p>`,
  );
  try {
    const raw = await WebEngine.complete(
      state.settings,
      "你是聊天 App 的角色設計師。依照使用者的選擇，用繁體中文設計一位原創的 AI 聊天角色，沒選的部分由你自然補齊。" +
        '只回 JSON：{"name":"名字（2–6 字）","personality":"300–600 字：身分與背景、性格、與使用者的關係、說話方式與語氣、口頭禪、喜歡與討厭的事，用第二人稱「你是…」描述","greeting":"第一則打招呼的訊息，符合說話方式，30 字內","appearance":"外貌描述，150 字內"}',
      [{ role: "user", content: wish.length ? wish.join("\n") : "全部由你決定，設計一位討喜的角色。" }],
    );
    const card = WebEngine.json(raw);
    if (!card?.personality) throw Error(mzT("AI 沒有回傳完整的角色資料，請再試一次", "The AI didn't return a full character; try again"));
    const name = mzUniqueName(String(p.name || card.name || "").trim().slice(0, 40) || mzT("小沐", "Miko"));
    await mutate("import", {
      name: name + ".json",
      text: JSON.stringify({ name, personality: String(card.personality), first_mes: String(card.greeting || ""), appearance: String(card.appearance || "") }),
    });
    const created = state.ais.find((a) => a.name === name);
    if (!created) throw Error(mzT("角色建立失敗", "Could not create the character"));
    const chat = await mutate("newChat", { members: [created.id] });
    closeModal();
    importSetupModal(created, { tab: "chats", page: "", chatId: chat.chatId || "" }, mzT("建立", "created"));
  } catch (e) {
    closeModal();
    showModal(mzT("自訂 AI", "Custom AI"), mzCustomSheet());
    const box = document.querySelector("#modalError");
    if (box) box.textContent = e.message || String(e);
    else toast(e.message || String(e), 5000);
  }
};

// After signing in: offer to make an AI and start chatting right away.
{
  const base = humanCall;
  humanCall = async function (d) {
    const result = await base(d);
    if (["login", "register"].includes(d?.action) && state?.human?.connected && !window.MushuiAIOnly)
      setTimeout(
        () =>
          showModal(
            mzT("開始聊天", "Start chatting"),
            `<p class="help">${mzT("要建立一位屬於你的 AI，馬上開始聊天嗎？", "Create your own AI and start chatting right away?")}</p><div class="sheet-actions"><button class="pill" data-action="closeModal">${mzT("稍後再說", "Later")}</button><button class="pill primary" data-action="mzCustomAI">${mzT("自訂 AI", "Custom AI")}</button></div>`,
          ),
        600,
      );
    return result;
  };
}
// Also from 匯入 AI 角色 and the empty chat list.
{
  const base = importModal;
  importModal = function () {
    base();
    document.querySelector(".sheet [data-action='pickImport']")?.insertAdjacentHTML("afterend", `<button class="pill full" data-action="mzCustomAI">${mzT("或自訂一位 AI", "Or create a custom AI")}</button>`);
  };
  actions.import = importModal;
  const render0 = render;
  render = function () {
    render0();
    const empty = document.querySelector('#app .empty [data-action="import"]');
    if (empty && !empty.parentElement.querySelector('[data-action="mzCustomAI"]'))
      empty.insertAdjacentHTML("afterend", `<button class="pill" data-action="mzCustomAI">${mzT("自訂 AI", "Custom AI")}</button>`);
  };
}
{
  const st = document.createElement("style");
  st.textContent = `.mzc-chips{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 12px}.mzc-chip{cursor:pointer}.mzc-chip.selected{background:var(--accent);border-color:var(--accent);color:#fff}html.mz-dark .mzc-chip:not(.selected){background:#241f2b;color:var(--ink)}`;
  document.head.append(st);
}
