'use strict';
// 3.4.1: forgot the account password → 「忘記密碼？」 on the login sheet reaches support without signing in. It
// opens a support ticket for that account ID with the way support can reach the person (server /v1/support/forgot).
{
  const W = WebEngine;
  const loginBefore = actions.humanAccount;
  actions.humanAccount = (...args) => {
    const r = loginBefore(...args);
    try {
      if (humanData().connected) return r;
      const actionsRow = document.querySelector('.sheet [data-action="humanLogin"]')?.closest('.sheet-actions');
      if (actionsRow && !actionsRow.parentElement.querySelector('[data-action="mzForgotPassword"]')) {
        actionsRow.insertAdjacentHTML('afterend', `<p class="small" style="text-align:center;margin-top:12px"><button type="button" class="link-button" data-action="mzForgotPassword">${mzT('忘記密碼？聯絡客服', 'Forgot password? Contact support')}</button></p>`);
      }
    } catch {}
    return r;
  };
  actions.mzForgotPassword = () => {
    const id = document.querySelector('#humanUserId')?.value.trim() || '';
    showModal(mzT('忘記密碼', 'Forgot password'), `<p class="help">${mzT('把帳號 ID 和聯絡方式留給客服，客服會聯絡你幫忙處理。', 'Leave your account ID and a way to reach you; support will get back to you.')}</p>
<label>${mzT('帳號 ID', 'Account ID')}</label><input id="mzForgotId" autocapitalize="off" autocorrect="off" spellcheck="false" value="${esc(id)}">
<label>${mzT('聯絡方式（例如 Discord、Email、LINE）', 'How to reach you (e.g. Discord, email, LINE)')}</label><input id="mzForgotContact" maxlength="200">
<label>${mzT('想說的話（可不填）', 'Anything else (optional)')}</label><textarea id="mzForgotNote" maxlength="1000"></textarea>
<div class="sheet-actions"><button class="pill" data-action="humanAccount">${mzT('返回', 'Back')}</button><button class="pill primary" data-action="mzForgotSend">${mzT('送出', 'Send')}</button></div>`);
  };
  actions.mzForgotSend = async () => {
    const id = document.querySelector('#mzForgotId')?.value.trim() || '', contact = document.querySelector('#mzForgotContact')?.value.trim() || '', note = document.querySelector('#mzForgotNote')?.value.trim() || '';
    if (!id || !contact) { toast(mzT('請填寫帳號 ID 和聯絡方式', 'Fill in your account ID and how to reach you')); return; }
    const b = document.querySelector('[data-action="mzForgotSend"]'); if (b) b.disabled = true;
    try {
      await W.humanRequest('/v1/support/forgot', { id, contact, note }, false);
      closeModal();
      toast(mzT('已送出，客服會用你留下的聯絡方式聯絡你 (｡•ᴗ•｡)', "Sent. Support will reach you the way you left (｡•ᴗ•｡)"), 6000);
    } catch (e) {
      toast(String(e.message || e).replace(/^.*HTTP \d+[：:]\s*/, ''), 5000);
      if (b) b.disabled = false;
    }
  };
}
