'use strict';
// iPhone notifications through the free ntfy app (Settings → Notifications). The server sends only a plain
// "new message" line to a long random topic that the person subscribes to in ntfy; never the text or the sender.
{
  let info = null, loading = false, busy = false;
  const W = WebEngine;
  const load = () => {
    if (loading || !humanData().connected) return;
    loading = true;
    W.humanRequest('/v1/ntfy').then((r) => { info = r; }).catch(() => { info = { topic: '', server: 'https://ntfy.sh', error: true }; }).finally(() => { loading = false; if (tab === 'settings' && page === 'notifications') render(); });
  };
  const card = () => {
    if (!humanData().connected) return `<div class="card mz-ntfy"><h3>${mzT('iPhone 通知（ntfy）', 'iPhone notifications (ntfy)')}</h3><p class="small">${mzT('登入好友帳號後才能使用。', 'Sign in to your friend account first.')}</p></div>`;
    if (!info) { load(); return `<div class="card mz-ntfy"><h3>${mzT('iPhone 通知（ntfy）', 'iPhone notifications (ntfy)')}</h3><p class="small">${mzT('讀取中…', 'Loading…')}</p></div>`; }
    const on = !!info.topic, host = String(info.server || 'https://ntfy.sh').replace(/^https?:\/\//, '');
    const steps = on ? `<ol class="small mz-ntfy-steps">
      <li>${mzT('在 App Store 安裝免費的「ntfy」App。', 'Install the free "ntfy" app from the App Store.')}</li>
      <li>${mzT('打開 ntfy，按右上角「＋」。', 'Open ntfy and tap "+" at the top right.')}</li>
      <li>${mzT('「Topic」貼上下面這串名字，按「Subscribe」。', 'Paste the name below into "Topic" and tap "Subscribe".')}</li>
      <li>${mzT('允許 ntfy 發通知，再按「傳送測試通知」確認。', 'Allow ntfy to send notifications, then tap "Send a test" to check.')}</li>
    </ol>
    <div class="mz-ntfy-topic"><code class="user-content">${esc(info.topic)}</code><button class="pill" type="button" data-action="mzNtfyCopy">${mzT('複製', 'Copy')}</button></div>
    ${host !== 'ntfy.sh' ? `<p class="small">${mzT('伺服器：', 'Server: ')}${esc(host)}</p>` : ''}` : '';
    return `<div class="card mz-ntfy"><h3>${mzT('iPhone 通知（ntfy）', 'iPhone notifications (ntfy)')}</h3>
      <p class="small">${mzT('iPhone 版收不到系統推播時，可以用免費的 ntfy App 代收：朋友或群組有新訊息、有人打電話給你時，手機會跳通知。為了隱私，通知只會寫「你有新訊息」，不會有內容和名字。AI 的訊息是在你手機上產生的，App 沒開時不會有。', "When the iPhone app can't get system push, the free ntfy app can do it: you'll get a notification when a friend or group sends a message or someone calls. For privacy it only says \"You have a new message\", with no text or names. AI messages are made on your phone, so they don't come while the app is closed.")}</p>
      <p class="small">${on ? mzT('目前：已開啟', 'Now: on') : mzT('目前：關閉', 'Now: off')}</p>
      ${steps}
      <div class="sheet-actions">${on ? `<button class="pill" type="button" data-action="mzNtfyOff" ${busy ? 'disabled' : ''}>${mzT('關閉', 'Turn off')}</button><button class="pill primary" type="button" data-action="mzNtfyTest" ${busy ? 'disabled' : ''}>${mzT('傳送測試通知', 'Send a test')}</button>` : `<button class="pill primary" type="button" data-action="mzNtfyOn" ${busy ? 'disabled' : ''}>${mzT('開啟 ntfy 通知', 'Turn on ntfy notifications')}</button>`}</div>
    </div>`;
  };
  const before = settingsPage;
  settingsPage = function () {
    const html = before();
    if (page !== 'notifications') return html;
    const end = html.lastIndexOf('</div>');
    return end > 0 ? html.slice(0, end) + card() + html.slice(end) : html + card();
  };
  const act = async (action, done) => {
    if (busy) return;
    busy = true; render();
    try { info = await W.humanRequest('/v1/ntfy', { action }); if (done) toast(done); }
    catch (e) { toast(String(e.message || e).replace(/^.*HTTP \d+[：:]\s*/, ''), 5000); }
    finally { busy = false; render(); }
  };
  actions.mzNtfyOn = () => act('on', mzT('已開啟，照下面的步驟訂閱', 'On. Follow the steps below to subscribe'));
  actions.mzNtfyOff = () => act('off', mzT('已關閉 ntfy 通知', 'ntfy notifications turned off'));
  actions.mzNtfyTest = () => act('test', mzT('測試通知已送出，看看手機有沒有跳出來', 'Test sent. Check your phone'));
  actions.mzNtfyCopy = async () => {
    try { await navigator.clipboard.writeText(info?.topic || ''); toast(mzT('已複製', 'Copied')); }
    catch { toast(mzT('複製失敗，請長按文字自己複製', "Couldn't copy. Press and hold the text to copy it")); }
  };
}
