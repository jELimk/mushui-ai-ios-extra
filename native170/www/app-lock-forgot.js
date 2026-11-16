'use strict';
// Forgot the App lock password: ask to turn it off, and after 87 hours it turns off by itself.
// Works from the lock screen (before unlocking) and from Settings → Privacy (when unlocked but the password is forgotten).
// Unlocking with the password in between does not stop the countdown; when the time is up the lock is removed.
// The request is saved as forgotAt in the device-local lock settings (mzAppLock), next to the PIN.
{
  const WAIT = 87 * 3600 * 1000;
  const cfg = () => (window.mzAppLockCfg ? window.mzAppLockCfg() : {});
  const save = (c) => { try { localStorage.setItem('mzAppLock', JSON.stringify(c)); } catch {} };
  const left = () => { const c = cfg(); return c.enabled && +c.forgotAt ? Math.max(0, +c.forgotAt + WAIT - Date.now()) : -1; };
  const span = (ms) => {
    const t = Math.ceil(ms / 60000), h = Math.floor(t / 60), m = t % 60;
    return h ? mzT(h + ' 小時 ' + m + ' 分鐘', h + ' h ' + m + ' min') : mzT(m + ' 分鐘', m + ' min');
  };
  const status = () => mzT('已申請解除：還要 ' + span(left()) + '，App 鎖會自動關閉。期間用密碼解鎖也會繼續倒數。', 'Removal requested: the app lock turns off by itself in ' + span(left()) + '. Unlocking with the password meanwhile does not stop it.');

  // Time is up: remove the lock everywhere on this device.
  const check = () => {
    if (left() !== 0) return false;
    save({});
    document.querySelector('.mz-lock')?.remove();
    toast(mzT('87 小時到了，App 鎖已自動解除', '87 hours are up. The app lock is off.'), 6000);
    if (typeof render === 'function') render();
    return true;
  };

  const request = () => {
    const c = cfg();
    if (!c.enabled || +c.forgotAt) return;
    save({ ...c, forgotAt: Date.now() });
    toast(mzT('已申請解除，87 小時後 App 鎖會自動關閉', 'Requested. The app lock turns off in 87 hours.'), 5000);
    decorate();
    if (typeof render === 'function') render();
  };
  actions.mzLockForgot = () => {
    showModal(mzT('忘記 App 密碼', 'Forgot the App password'), `<p class="help">${mzT('申請後要等 87 小時，App 鎖才會自動關閉。這段時間裡如果想起密碼，還是可以用密碼解鎖，但倒數不會停止，時間到一樣會關閉。', 'After you ask, the app lock turns off by itself in 87 hours. If you remember the password meanwhile you can still unlock with it, but the countdown keeps going and the lock still turns off.')}</p><button class="pill danger full" data-action="mzLockForgotYes">${mzT('申請解除（87 小時後）', 'Turn off in 87 hours')}</button>`);
  };
  actions.mzLockForgotYes = () => { closeModal(); request(); };

  // Lock screen: a "forgot" button (confirmed inside the lock card, since it covers the app), or the countdown.
  // Settings → Privacy: the same on the App lock card. Boxes are only rewritten when their state changes.
  let asking = false;
  const fill = (box, key, html) => { if (box.dataset.k !== key) { box.dataset.k = key; box.innerHTML = html; } };
  const ensure = (parent) => { let box = parent.querySelector(':scope > .mz-lock-forgot'); if (!box) { box = document.createElement('div'); box.className = 'mz-lock-forgot'; parent.append(box); } return box; };
  const decorate = () => {
    const pending = left() > 0, mins = pending ? Math.ceil(left() / 60000) : 0;
    const card = document.querySelector('.mz-lock .login-gate-card');
    if (card) {
      const box = ensure(card);
      if (pending) fill(box, 'wait' + mins, `<p class="help">${status()}</p>`);
      else if (asking) fill(box, 'ask', `<p class="help">${mzT('申請後要等 87 小時，App 鎖才會自動關閉。這段時間裡想起密碼還是可以解鎖，但倒數不會停止，時間到一樣會關閉。', 'After you ask, the app lock turns off by itself in 87 hours. You can still unlock with the password meanwhile, but the countdown keeps going.')}</p><button class="pill danger full" type="button" data-lockforgotyes>${mzT('申請解除（87 小時後）', 'Turn off in 87 hours')}</button>`);
      else fill(box, 'btn', `<button class="pill full" type="button" data-lockforgot>${mzT('忘記密碼', 'Forgot password')}</button>`);
    }
    const set = document.querySelector('.mz-applock-card');
    if (set) {
      if (!cfg().enabled) { set.querySelector(':scope > .mz-lock-forgot')?.remove(); return; }
      const box = ensure(set);
      if (pending) fill(box, 'wait' + mins, `<p class="help">${status()}</p>`);
      else fill(box, 'btn', `<button class="pill" type="button" data-action="mzLockForgot">${mzT('忘記密碼？87 小時後關閉', 'Forgot it? Turn off in 87 hours')}</button>`);
    }
  };
  // The lock screen sits outside #app, so it needs its own click handler.
  document.addEventListener('click', (e) => {
    if (e.target.closest?.('[data-lockforgot]')) { asking = true; decorate(); }
    if (e.target.closest?.('[data-lockforgotyes]')) { asking = false; request(); }
  });

  const tick = () => { if (!check()) decorate(); };
  let queued = false;
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; decorate(); }); } }).observe(document.body || document.documentElement, { childList: true, subtree: true });
  setInterval(tick, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  tick();
  window.mzAppLockForgot = { left, request, check };
}
