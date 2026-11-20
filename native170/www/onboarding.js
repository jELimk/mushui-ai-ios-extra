'use strict';
// 3.4.4: the first time Mizuki opens on a device (from the user's reference video, own wording): 「先問一句」 —
// old user (sign in or import a backup) or new user (a short walk through the five tabs), and a cheeky way out in the
// corner: 「我自己配，別煩我」. People who already have chats never see it.
{
  const KEY = 'mz-welcome-v1';
  const seen = () => { try { return !!localStorage.getItem(KEY); } catch { return true; } };
  const mark = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch {} };
  const close = () => { document.getElementById('mz-welcome')?.remove(); document.getElementById('mz-tour')?.remove(); mark(); };

  const welcome = () => {
    if (document.getElementById('mz-welcome')) return;
    const el = document.createElement('div'); el.id = 'mz-welcome';
    el.innerHTML = `<button class="mz-wl-skip" data-mzwl="skip">${mzT('我自己配，別煩我', "I'll set it up myself, leave me alone")}</button>
<div class="mz-wl-body"><h1>${mzT('先問一句', 'Quick question')}</h1><p>${mzT('你以前用過沐水嗎？這決定我接下來要不要帶你走一遍。', 'Have you used Mizuki before? That decides whether I walk you through it.')}</p>
<button class="mz-wl-card old" data-mzwl="old"><b>${mzT('我是老用戶', "I've used it before")}</b><small>${mzT('我有帳號或備份，登入或匯入就完事', 'I have an account or a backup — sign in or import and done')}</small><span>→</span></button>
<button class="mz-wl-card new" data-mzwl="new"><b>${mzT('我是新用戶', "I'm new")}</b><small>${mzT('第一次用，帶我走一遍', 'First time — show me around')}</small><span>→</span></button></div>`;
    document.body.append(el);
    requestAnimationFrame(() => el.classList.add('on'));
  };

  // the walk: one bubble per bottom tab, the tab lit up
  const STEPS = [
    ['chats', ['聊天', 'Chats'], ['你和 AI、朋友的聊天都在這裡。右上角「＋」可以開新的聊天或群組。', 'Your chats with AIs and friends live here. ＋ at the top starts a new chat or group.']],
    ['contacts', ['聯絡人', 'Contacts'], ['左右滑切換 AI 和人類。在這裡建立自己的 AI，或加朋友。', 'Swipe between AI and people. Make your own AI here, or add friends.']],
    ['moments', ['朋友圈', 'Moments'], ['你和 AI 都能發朋友圈、按讚、留言。', 'You and your AIs can post, like and comment.']],
    ['music', ['聽歌', 'Music'], ['跟 AI 或朋友一起聽歌，最多 10 個人。', 'Listen together with AIs or friends — up to 10 people.']],
    ['settings', ['我', 'Me'], ['主題、字體、模型、通知都在這裡。換個主題試試看吧！', 'Themes, fonts, models and notifications are here. Try a theme!']],
  ];
  const navBtn = (k) => document.querySelector(`#app > .nav [data-tab="${k}"], #app .desktop-rail [data-tab="${k}"]`);
  const tour = (i = 0) => {
    document.getElementById('mz-welcome')?.remove();
    let el = document.getElementById('mz-tour');
    if (!el) { el = document.createElement('div'); el.id = 'mz-tour'; document.body.append(el); }
    const [k, name, text] = STEPS[i], b = navBtn(k);
    const r = b ? b.getBoundingClientRect() : { left: innerWidth / 2 - 30, top: innerHeight - 80, width: 60, height: 50 };
    const last = i === STEPS.length - 1;
    el.innerHTML = `<i class="mz-tour-ring" style="left:${r.left - 6}px;top:${r.top - 6}px;width:${r.width + 12}px;height:${r.height + 12}px"></i>
<div class="mz-tour-tip" style="left:${Math.min(Math.max(16, r.left + r.width / 2 - 140), innerWidth - 296)}px;bottom:${innerHeight - r.top + 18}px"><b>${mzT(...name)}</b><p>${mzT(...text)}</p>
<div class="mz-tour-row"><span>${i + 1} / ${STEPS.length}</span><button data-mzwl="skip">${mzT('跳過', 'Skip')}</button><button class="go" data-mzwl="${last ? 'done' : 'next'}" data-i="${i}">${last ? mzT('開始吧', "Let's go") : mzT('下一步', 'Next')}</button></div></div>`;
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-mzwl]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const what = b.dataset.mzwl;
    if (what === 'skip' || what === 'done') { close(); if (what === 'skip') toast?.(mzT('好，不吵你 (｡•ᴗ•｡)', "Okay, I'll leave you alone (｡•ᴗ•｡)"), 1600); return; }
    if (what === 'old') { close(); try { if (typeof actions.humanAccount === 'function') actions.humanAccount(); else { tab = 'settings'; page = 'backup'; render(); } } catch {} return; }
    if (what === 'new') { mark(); tour(0); return; }
    if (what === 'next') tour(Number(b.dataset.i) + 1);
  }, true);
  // only for a fresh start: no chats yet and never shown on this device
  setTimeout(() => {
    try {
      if (seen() || window.MizukiStaffEdition) return;
      const used = (state?.chats || []).some((c) => (c.messages || []).some((m) => m.author === 'me'));
      if (used) { mark(); return; }
      welcome();
    } catch {}
  }, 1800);
  window.mzWelcome = { welcome, tour };

  const css = document.createElement('style');
  css.textContent = `
#mz-welcome{position:fixed;inset:0;z-index:2147482000;background:var(--bg);color:var(--ink);display:flex;flex-direction:column;padding:max(18px,env(safe-area-inset-top)) 22px 24px;opacity:0;transform:translateY(10px);transition:opacity .25s,transform .25s}
#mz-welcome.on{opacity:1;transform:none}
.mz-wl-skip{align-self:flex-end;border:0;background:none;color:var(--muted);font-size:14px;padding:8px 4px}
.mz-wl-body{margin:auto 0;max-width:520px;width:100%;align-self:center}
.mz-wl-body h1{font-size:30px;margin:0 0 14px}.mz-wl-body p{color:var(--muted);line-height:1.6;margin:0 0 30px}
.mz-wl-card{display:grid;grid-template-columns:1fr auto;gap:4px 10px;width:100%;text-align:left;border:0;border-radius:20px;padding:20px 22px;margin:0 0 14px;color:var(--ink)}
.mz-wl-card b{font-size:19px}.mz-wl-card small{grid-column:1;color:var(--muted);font-size:13px}.mz-wl-card span{grid-row:1/3;grid-column:2;align-self:center;font-size:20px}
.mz-wl-card.old{background:color-mix(in srgb,var(--accent) 22%,var(--bg))}.mz-wl-card.new{background:color-mix(in srgb,var(--ink) 7%,var(--bg))}
#mz-tour{position:fixed;inset:0;z-index:2147482000;background:#0006}
.mz-tour-ring{position:fixed;border-radius:18px;box-shadow:0 0 0 9999px #0005,0 0 0 3px var(--accent);animation:mz-tour-pulse 1.6s ease-in-out infinite;pointer-events:none}
@keyframes mz-tour-pulse{50%{box-shadow:0 0 0 9999px #0005,0 0 0 6px color-mix(in srgb,var(--accent) 60%,transparent)}}
.mz-tour-tip{position:fixed;width:280px;padding:16px 18px;border-radius:18px;background:var(--surface,#fff);color:var(--ink);box-shadow:0 12px 40px #0004}
.mz-tour-tip b{font-size:17px}.mz-tour-tip p{margin:6px 0 12px;line-height:1.55;font-size:14px}
.mz-tour-row{display:flex;align-items:center;gap:8px}.mz-tour-row span{flex:1;color:var(--muted);font-size:12px}
.mz-tour-row button{border:0;background:none;color:var(--muted);padding:6px 10px;border-radius:999px}.mz-tour-row .go{background:var(--accent);color:#fff;font-weight:600}
`;
  document.head.append(css);
}
