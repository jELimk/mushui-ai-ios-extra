'use strict';
// 3.0.4: NOT LOADED (removed from index.html and sw.js) until the server can send mail — add
// <script src="email.js"></script> before releases.js and "email.js" to sw.js FILES to bring it back.
// 3.0.3 — 綁定郵箱 is back: 我 → 設定 → 隱私與安全性 binds a verified email; the sign-in sheet gets
// 忘記密碼, which mails a code to that email. The server routes never went away
// (/v1/account/email, /v1/account/email/verify, /v1/account/password/forgot[/request]).
// Sending mail needs MIZUKI_RESEND_API_KEY + MIZUKI_SMTP_FROM (or 官方服務設定) on the server.
{
  const W = window.WebEngine;
  const T = (zh, en) => (typeof mzT === 'function' ? mzT(zh, en) : zh);

  // 忘記密碼 runs before sign-in, so point the engine at the server typed in the sheet first.
  const baseCall = call;
  call = async function (op, d) {
    if (op === 'human' && (d?.action === 'forgotRequest' || d?.action === 'forgotReset')) {
      const url = String(d.url || '').trim().replace(/\/$/, '');
      if (!url) throw Error(T('請先填好友伺服器網址', 'Enter the friend server URL first'));
      const base = ['localhost', '127.0.0.1'].includes(location.hostname) && url === location.origin ? location.origin : W.url(url);
      if (!(await W.key('human'))) await W.edit((s) => { s.human.serverUrl = base; });
      if (d.action === 'forgotRequest') return W.humanRequest('/v1/account/password/forgot/request', { id: d.userId, email: d.email }, false);
      return W.humanRequest('/v1/account/password/forgot', { id: d.userId, code: d.code, newPassword: d.password }, false);
    }
    return baseCall.apply(this, arguments);
  };

  // 隱私與安全性 → 綁定郵箱
  const basePrivacy = privacySettingsPage;
  privacySettingsPage = function () {
    const h = humanData();
    if (!h.connected) return basePrivacy();
    const me = h.me || {},
      status = me.email
        ? (me.emailVerified ? T('已綁定：', 'Linked: ') : T('尚未驗證：', 'Not verified: ')) + esc(me.email)
        : T('尚未綁定郵箱', 'No email linked');
    return basePrivacy() + `<div class="card"><h3>${T('綁定郵箱', 'Link email')}</h3><p class="feature-note">${status}</p>
<label for="mzEmail">${T('電子郵件地址', 'Email address')}</label><input id="mzEmail" type="email" autocomplete="email" value="${esc(me.email || '')}" placeholder="name@example.com">
<label for="mzEmailPassword">${T('目前密碼', 'Current password')}</label><input id="mzEmailPassword" type="password" autocomplete="current-password">
<button class="pill" data-action="mzEmailSend">${T('寄送驗證碼', 'Send code')}</button>
<label for="mzEmailCode">${T('驗證碼', 'Code')}</label><input id="mzEmailCode" inputmode="numeric" autocomplete="one-time-code">
<button class="pill primary" data-action="mzEmailVerify">${T('驗證並綁定', 'Verify and link')}</button>
<p class="help">${T('綁定後，忘記密碼時可以用郵箱重設。一個郵箱只能綁一個帳號。', 'Once linked, you can reset a forgotten password by email. One email per account.')}</p></div>`;
  };
  actions.mzEmailSend = async () => {
    const email = $('#mzEmail').value.trim(),
      password = $('#mzEmailPassword').value;
    if (!email || !password) throw Error(T('請輸入郵箱與目前密碼', 'Enter your email and current password'));
    const r = await call('human', { action: 'bindEmail', email, password });
    if (r?.sent === false) {
      if (r.me) await W.edit((s) => { s.human.me = { ...s.human.me, ...r.me }; });
      state = await call('load');
      render();
      toast(T('伺服器還沒設定寄信，郵箱已先綁定（未驗證）', 'The server can’t send mail yet; email saved but not verified'));
    } else toast(T('驗證碼已寄出，請查收郵箱', 'Code sent. Check your email'));
  };
  actions.mzEmailVerify = async () => {
    const email = $('#mzEmail').value.trim(),
      code = $('#mzEmailCode').value.trim();
    if (!email || !code) throw Error(T('請輸入郵箱與驗證碼', 'Enter your email and the code'));
    const r = await call('human', { action: 'verifyEmail', email, code });
    state = r.state;
    render();
    toast(T('郵箱已驗證並綁定', 'Email verified and linked'));
  };

  // Sign-in sheet → 忘記密碼
  const baseAccount = actions.humanAccount;
  actions.humanAccount = function () {
    const r = baseAccount.apply(this, arguments);
    if (!humanData().connected)
      document.querySelector('#overlay [data-action="humanLogin"]')?.closest('.sheet-actions')
        ?.insertAdjacentHTML('afterend', `<button class="link-button" data-action="mzForgot">${T('忘記密碼？', 'Forgot password?')}</button>`);
    return r;
  };
  let forgotUrl = '';
  actions.mzForgot = () => {
    forgotUrl = $('#humanServer')?.value || humanData().serverUrl || window.mizukiDefaultServer();
    const id = $('#humanUserId')?.value || '';
    showModal(T('忘記密碼', 'Forgot password'), `<p class="help">${T('輸入 ID 和綁定的郵箱，我們會寄驗證碼給你。', 'Enter your ID and linked email. We’ll mail you a code.')}</p>
<label for="mzForgotId">ID</label><input id="mzForgotId" autocapitalize="off" value="${esc(id)}">
<label for="mzForgotEmail">${T('綁定的郵箱', 'Linked email')}</label><input id="mzForgotEmail" type="email" autocomplete="email">
<button class="pill" data-action="mzForgotSend">${T('寄送驗證碼', 'Send code')}</button>
<label for="mzForgotCode">${T('驗證碼', 'Code')}</label><input id="mzForgotCode" inputmode="numeric" autocomplete="one-time-code">
<label for="mzForgotPassword">${T('新密碼（至少 8 字）', 'New password (8+ characters)')}</label><input id="mzForgotPassword" type="password" autocomplete="new-password">
<div class="sheet-actions"><button class="pill" data-action="closeModal">${T('取消', 'Cancel')}</button><button class="pill primary" data-action="mzForgotReset">${T('重設密碼', 'Reset password')}</button></div>`);
  };
  actions.mzForgotSend = async () => {
    const userId = $('#mzForgotId').value.trim(),
      email = $('#mzForgotEmail').value.trim();
    if (!userId || !email) throw Error(T('請輸入 ID 與郵箱', 'Enter your ID and email'));
    await call('human', { action: 'forgotRequest', url: forgotUrl, userId, email });
    // The server answers the same either way, so nobody can probe which emails are linked.
    toast(T('如果 ID 和郵箱正確，驗證碼已寄出', 'If the ID and email match, a code is on its way'));
  };
  actions.mzForgotReset = async () => {
    const userId = $('#mzForgotId').value.trim(),
      code = $('#mzForgotCode').value.trim(),
      password = $('#mzForgotPassword').value;
    if (!userId || !code || password.length < 8) throw Error(T('請輸入 ID、驗證碼與至少 8 字的新密碼', 'Enter your ID, the code and a new password of 8+ characters'));
    await call('human', { action: 'forgotReset', url: forgotUrl, userId, code, password });
    closeModal();
    toast(T('密碼已重設，請用新密碼登入', 'Password reset. Sign in with the new one'));
    actions.humanAccount();
  };
}
